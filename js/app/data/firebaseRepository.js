import { getFirebaseClientConfig } from '../config.js';

let firebaseCoreCtx = null;

function nowIso() {
	return new Date().toISOString();
}

function newId() {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	return `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function slugify(title) {
	return (
		String(title || '')
			.normalize('NFD')
			.replace(/\p{Diacritic}/gu, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
			.slice(0, 80) || 'article'
	);
}

/**
 * Déduit le type logique de média depuis le MIME.
 *
 * @param {File} file
 * @returns {'image'|'video'}
 */
function detectMediaKind(file) {
	const mime = String(file?.type || '').toLowerCase();
	return mime.startsWith('video/') ? 'video' : 'image';
}

/**
 * Initialise l'application Firebase et Firestore une seule fois.
 *
 * 1) But:
 *    - Centraliser l'acces Firestore pour toutes les operations CRUD.
 * 2) Variables cles:
 *    - cfg: config client injectee dans window.__FIREBASE_CONFIG__.
 *    - app: instance Firebase partagee entre Auth/Firestore/Storage.
 * 3) Flux:
 *    - import dynamique des SDK Firebase
 *    - reutilisation getApp() si l'app existe deja
 *    - creation du contexte memoise
 *
 * @returns {Promise<{ db: any, fsApi: any, app: any }>}
 */
async function getFirebaseCoreContext() {
	if (firebaseCoreCtx) {
		return firebaseCoreCtx;
	}
	const cfg = getFirebaseClientConfig();
	if (!cfg) {
		throw new Error('Firebase non configure: definir window.__FIREBASE_CONFIG__.');
	}
	const appMod = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js');
	const fsMod = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
	const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(cfg);
	const db = fsMod.getFirestore(app);
	firebaseCoreCtx = { db, fsApi: fsMod, app };
	return firebaseCoreCtx;
}

/**
 * Récupère le token Firebase de l'utilisateur admin connecté.
 *
 * 1) But:
 *    - transmettre une preuve d'authentification à la route API serveur.
 * 2) Variables cles:
 *    - auth/currentUser: session Firebase active dans le navigateur admin.
 * 3) Flux:
 *    - lire l'instance Auth liée à la même app Firebase
 *    - exiger un utilisateur connecté
 *    - récupérer un ID token frais
 *
 * @returns {Promise<string>}
 */
async function getCurrentAdminIdToken() {
	const { app } = await getFirebaseCoreContext();
	const authMod = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js');
	const auth = authMod.getAuth(app);
	if (!auth.currentUser) {
		throw new Error('Session admin absente: reconnectez-vous pour uploader un fichier.');
	}
	return auth.currentUser.getIdToken(true);
}

/**
 * Demande une signature Cloudinary temporaire via l'API interne.
 *
 * @param {{ folder: string, fileName: string }} payload
 * @returns {Promise<{ cloudName: string, apiKey: string, timestamp: number, signature: string, folder: string, publicId: string, uploadUrl: string }>}
 */
async function requestCloudinarySignature(payload) {
	const idToken = await getCurrentAdminIdToken();
	const response = await fetch('/api/cloudinary-sign', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${idToken}`,
		},
		body: JSON.stringify(payload),
	});
	const data = await response.json().catch(() => ({}));
	if (!response.ok || !data?.ok) {
		const message = String(data?.message || 'Signature Cloudinary indisponible.');
		throw new Error(message);
	}
	return data;
}

/**
 * Transforme snapshot -> objet record standardise avec id.
 *
 * @param {any} snap
 * @returns {Record<string, any>}
 */
function docToRecord(snap) {
	return { id: snap.id, ...snap.data() };
}

/**
 * Lit toute une collection Firestore et applique un tri JS.
 *
 * @param {string} collectionName
 * @param {(a: any, b: any) => number} sorter
 * @returns {Promise<any[]>}
 */
async function readCollectionSorted(collectionName, sorter) {
	const { db, fsApi } = await getFirebaseCoreContext();
	const ref = fsApi.collection(db, collectionName);
	const snap = await fsApi.getDocs(ref);
	const items = snap.docs.map(docToRecord);
	items.sort(sorter);
	return items;
}

/**
 * Upload un fichier vers Cloudinary et renvoie son URL publique.
 *
 * @param {File} file
 * @param {{ folder?: string }} [opts]
 * @returns {Promise<{ url: string, kind: 'image'|'video' }>}
 */
export async function uploadMediaAsset(file, opts = {}) {
	if (!(file instanceof File)) {
		throw new Error('Aucun fichier valide a envoyer.');
	}

	// 1) But: conserver un upload sécurisé sans exposer CLOUDINARY_API_SECRET.
	// 2) Variables cles: signatureData (depuis l'API), formData (payload upload Cloudinary).
	// 3) Flux: demander signature auth -> upload direct Cloudinary -> retourner secure_url.
	const signatureData = await requestCloudinarySignature({
		folder: String(opts.folder || 'uploads'),
		fileName: String(file.name || 'media'),
	});

	const formData = new FormData();
	formData.append('file', file);
	formData.append('api_key', signatureData.apiKey);
	formData.append('timestamp', String(signatureData.timestamp));
	formData.append('signature', signatureData.signature);
	formData.append('folder', signatureData.folder);
	formData.append('public_id', signatureData.publicId);
	formData.append('resource_type', signatureData.resourceType || 'auto');

	const uploadResponse = await fetch(signatureData.uploadUrl, {
		method: 'POST',
		body: formData,
	});
	const uploadJson = await uploadResponse.json().catch(() => ({}));
	if (!uploadResponse.ok || !uploadJson?.secure_url) {
		const message = String(uploadJson?.error?.message || 'Upload Cloudinary impossible.');
		throw new Error(message);
	}
	return { url: String(uploadJson.secure_url), kind: detectMediaKind(file) };
}

/**
 * @param {{ publishedOnly?: boolean }} [opts]
 * @returns {Promise<any[]>}
 */
export async function listArticles(opts = {}) {
	const items = await readCollectionSorted('articles', (a, b) =>
		String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')),
	);
	return opts.publishedOnly ? items.filter((a) => a.published) : items;
}

/**
 * @param {string} id
 * @returns {Promise<any|null>}
 */
export async function getArticle(id) {
	const { db, fsApi } = await getFirebaseCoreContext();
	const snap = await fsApi.getDoc(fsApi.doc(db, 'articles', id));
	return snap.exists() ? docToRecord(snap) : null;
}

/**
 * @param {string} slug
 * @returns {Promise<any|null>}
 */
export async function getArticleBySlug(slug) {
	const items = await listArticles({ publishedOnly: false });
	return items.find((a) => a.slug === slug) || null;
}

/**
 * Garantit un slug unique parmi les articles (hors id courant).
 *
 * @param {any[]} articles
 * @param {string} baseSlug
 * @param {string} [exceptId]
 * @returns {string}
 */
function uniqueSlug(articles, baseSlug, exceptId) {
	let slug = baseSlug || 'article';
	let n = 0;
	while (articles.some((a) => a.slug === slug && a.id !== exceptId)) {
		n += 1;
		slug = `${baseSlug}-${n}`;
	}
	return slug;
}

/**
 * @param {Record<string, any>} article
 * @returns {Promise<any>}
 */
export async function saveArticle(article) {
	const { db, fsApi } = await getFirebaseCoreContext();
	const t = nowIso();
	const all = await listArticles({ publishedOnly: false });

	// 1) But: aligner le comportement Firestore sur mockRepository.
	// 2) Variables cles: all, prev, payload.
	// 3) Flux: update (preserve createdAt) ou create (defaults complets).
	if (article.id) {
		const ref = fsApi.doc(db, 'articles', article.id);
		const snap = await fsApi.getDoc(ref);
		if (!snap.exists()) {
			throw new Error('Article introuvable');
		}
		const prev = docToRecord(snap);
		const payload = {
			...prev,
			...article,
			id: undefined,
			createdAt: prev.createdAt || t,
			updatedAt: t,
			slug:
				article.title != null
					? uniqueSlug(all, slugify(article.title), article.id)
					: prev.slug,
			summaryLine: article.summaryLine === undefined ? prev.summaryLine ?? '' : String(article.summaryLine || ''),
		};
		delete payload.id;
		await fsApi.setDoc(ref, payload);
		return { id: article.id, ...payload };
	}

	const id = newId();
	const payload = {
		title: article.title || 'Sans titre',
		slug: uniqueSlug(all, slugify(article.title || 'sans-titre')),
		excerpt: article.excerpt || '',
		summaryLine: article.summaryLine != null ? String(article.summaryLine) : '',
		bodyHtml: article.bodyHtml || '',
		published: article.published !== false,
		createdAt: t,
		updatedAt: t,
		isEvent: !!article.isEvent,
		eventDate: article.eventDate || null,
		eventTime: article.eventTime || null,
		eventEndDate: article.eventEndDate || null,
		eventEndTime: article.eventEndTime || null,
		eventLocation: article.eventLocation || '',
		media: Array.isArray(article.media) ? article.media : [],
	};
	await fsApi.setDoc(fsApi.doc(db, 'articles', id), payload);
	return { id, ...payload };
}

/**
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteArticle(id) {
	const { db, fsApi } = await getFirebaseCoreContext();
	await fsApi.deleteDoc(fsApi.doc(db, 'articles', id));
}

/**
 * @returns {Promise<any[]>}
 */
export async function listGalleryAlbums() {
	return readCollectionSorted('galleryAlbums', (a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
}

/**
 * @param {Record<string, any>} album
 * @returns {Promise<any>}
 */
export async function saveGalleryAlbum(album) {
	const { db, fsApi } = await getFirebaseCoreContext();
	const albums = await listGalleryAlbums();
	if (album.id) {
		const ref = fsApi.doc(db, 'galleryAlbums', album.id);
		const snap = await fsApi.getDoc(ref);
		if (!snap.exists()) {
			throw new Error('Album introuvable');
		}
		const payload = { ...snap.data(), ...album };
		delete payload.id;
		await fsApi.setDoc(ref, payload);
		return { id: album.id, ...payload };
	}
	const id = newId();
	const maxOrder = albums.reduce((m, x) => Math.max(m, Number(x.sortOrder || 0)), -1);
	const payload = { title: album.title || 'Nouvel album', sortOrder: maxOrder + 1 };
	await fsApi.setDoc(fsApi.doc(db, 'galleryAlbums', id), payload);
	return { id, ...payload };
}

/**
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteGalleryAlbum(id) {
	const { db, fsApi } = await getFirebaseCoreContext();
	await fsApi.deleteDoc(fsApi.doc(db, 'galleryAlbums', id));

	// 1) But: conserver l'integrite referentielle de la galerie.
	// 2) Variables cles: items, batch.
	// 3) Flux: supprimer tous les items lies a l'album retire.
	const items = await listGalleryItems(id);
	const batch = fsApi.writeBatch(db);
	items.forEach((item) => {
		batch.delete(fsApi.doc(db, 'galleryItems', item.id));
	});
	await batch.commit();
}

/**
 * @param {string} albumId
 * @returns {Promise<any[]>}
 */
export async function listGalleryItems(albumId) {
	const { db, fsApi } = await getFirebaseCoreContext();
	const ref = fsApi.collection(db, 'galleryItems');
	const q = fsApi.query(ref, fsApi.where('albumId', '==', albumId));
	const snap = await fsApi.getDocs(q);
	const items = snap.docs.map(docToRecord);
	items.sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
	return items;
}

/**
 * @param {Record<string, any>} item
 * @returns {Promise<any>}
 */
export async function saveGalleryItem(item) {
	const { db, fsApi } = await getFirebaseCoreContext();
	if (!item.albumId) {
		throw new Error('albumId requis');
	}
	if (item.id) {
		const ref = fsApi.doc(db, 'galleryItems', item.id);
		const snap = await fsApi.getDoc(ref);
		if (!snap.exists()) {
			throw new Error('Element introuvable');
		}
		const payload = { ...snap.data(), ...item };
		delete payload.id;
		await fsApi.setDoc(ref, payload);
		return { id: item.id, ...payload };
	}
	const inAlbum = await listGalleryItems(item.albumId);
	const maxOrder = inAlbum.reduce((m, x) => Math.max(m, Number(x.sortOrder || 0)), -1);
	const id = newId();
	const payload = {
		albumId: item.albumId,
		type: item.type === 'video' ? 'video' : 'image',
		url: item.url || '',
		thumbUrl: item.thumbUrl || item.url || '',
		caption: item.caption || '',
		sortOrder: maxOrder + 1,
		addedAt: nowIso(),
	};
	await fsApi.setDoc(fsApi.doc(db, 'galleryItems', id), payload);
	return { id, ...payload };
}

/**
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteGalleryItem(id) {
	const { db, fsApi } = await getFirebaseCoreContext();
	await fsApi.deleteDoc(fsApi.doc(db, 'galleryItems', id));
}

/**
 * @param {string} albumId
 * @param {string[]} orderedIds
 * @returns {Promise<void>}
 */
export async function reorderGalleryItems(albumId, orderedIds) {
	const { db, fsApi } = await getFirebaseCoreContext();

	// 1) But: persister l'ordre drag-and-drop.
	// 2) Variables cles: orderedIds, batch, index.
	// 3) Flux: boucle ids -> update sortOrder -> commit groupé.
	const batch = fsApi.writeBatch(db);
	orderedIds.forEach((id, index) => {
		const ref = fsApi.doc(db, 'galleryItems', id);
		batch.update(ref, { albumId, sortOrder: index });
	});
	await batch.commit();
}

/**
 * @param {{ publishedOnly?: boolean }} [opts]
 * @returns {Promise<any[]>}
 */
export async function listProducts(opts = {}) {
	const items = await readCollectionSorted('products', (a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
	return opts.publishedOnly ? items.filter((p) => p.published) : items;
}

/**
 * @param {string} id
 * @returns {Promise<any|null>}
 */
export async function getProduct(id) {
	const { db, fsApi } = await getFirebaseCoreContext();
	const snap = await fsApi.getDoc(fsApi.doc(db, 'products', id));
	return snap.exists() ? docToRecord(snap) : null;
}

/**
 * @param {Record<string, any>} product
 * @returns {Promise<any>}
 */
export async function saveProduct(product) {
	const { db, fsApi } = await getFirebaseCoreContext();
	const all = await listProducts({ publishedOnly: false });
	if (product.id) {
		const ref = fsApi.doc(db, 'products', product.id);
		const snap = await fsApi.getDoc(ref);
		if (!snap.exists()) {
			throw new Error('Produit introuvable');
		}
		const payload = { ...snap.data(), ...product };
		payload.priceCents = Number(payload.priceCents) || 0;
		payload.priceBeforePromoCents = payload.promo
			? payload.priceBeforePromoCents != null
				? Number(payload.priceBeforePromoCents)
				: null
			: null;
		delete payload.id;
		await fsApi.setDoc(ref, payload);
		return { id: product.id, ...payload };
	}
	const id = newId();
	const maxOrder = all.reduce((m, x) => Math.max(m, Number(x.sortOrder || 0)), -1);
	const payload = {
		title: product.title || 'Produit',
		imageUrl: product.imageUrl || '',
		synopsis: product.synopsis || '',
		priceCents: Number(product.priceCents) || 0,
		currency: product.currency || 'EUR',
		promo: !!product.promo,
		priceBeforePromoCents: product.promo ? Number(product.priceBeforePromoCents) || null : null,
		sumupUrl: product.sumupUrl || '#',
		published: product.published !== false,
		sortOrder: maxOrder + 1,
	};
	await fsApi.setDoc(fsApi.doc(db, 'products', id), payload);
	return { id, ...payload };
}

/**
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteProduct(id) {
	const { db, fsApi } = await getFirebaseCoreContext();
	await fsApi.deleteDoc(fsApi.doc(db, 'products', id));
}

/**
 * @returns {Promise<any[]>}
 */
export async function listDynamicGalleryItems() {
	const articles = await listArticles({ publishedOnly: true });
	const out = [];
	for (const a of articles) {
		const medias = Array.isArray(a.media) ? a.media : [];
		for (const m of medias) {
			out.push({
				id: `dyn_${a.id}_${m.id}`,
				albumId: '__virtual_dynamic__',
				type: m.type === 'video' ? 'video' : 'image',
				url: m.url,
				thumbUrl: m.thumbUrl || m.url,
				caption: m.caption || a.title,
				sortOrder: 0,
				articleId: a.id,
				articleSlug: a.slug,
				articleTitle: a.title,
				articleExcerpt: a.excerpt || '',
				articleUpdatedAt: a.updatedAt,
			});
		}
	}
	out.sort((x, y) => String(y.articleUpdatedAt).localeCompare(String(x.articleUpdatedAt)));
	return out;
}

/**
 * @returns {Promise<any[]>}
 */
async function listAllFixedGalleryItemsWithSort() {
	const albums = await listGalleryAlbums();
	const out = [];
	let albumIdx = 0;
	for (const al of albums) {
		const items = await listGalleryItems(al.id);
		let itemIdx = 0;
		for (const it of items) {
			const sortAt = it.addedAt || new Date(2000, 0, 1 + albumIdx, 0, itemIdx).toISOString();
			out.push({ ...it, sortAt });
			itemIdx += 1;
		}
		albumIdx += 1;
	}
	return out;
}

/**
 * @param {number} [limit]
 * @returns {Promise<any[]>}
 */
export async function listLatestCombinedGalleryMedia(limit = 10) {
	const dynamic = await listDynamicGalleryItems();
	const fixed = await listAllFixedGalleryItemsWithSort();

	const dynSlides = dynamic.map((d) => ({
		source: 'dynamic',
		sortAt: d.articleUpdatedAt,
		type: d.type,
		url: d.url,
		thumbUrl: d.thumbUrl || d.url,
		articleId: d.articleId,
		articleSlug: d.articleSlug,
		articleTitle: d.articleTitle,
		articleExcerpt: d.articleExcerpt || '',
	}));

	const fixSlides = fixed.map((f) => ({
		source: 'fixed',
		sortAt: f.sortAt,
		type: f.type,
		url: f.url,
		thumbUrl: f.thumbUrl || f.url,
	}));

	const merged = [...dynSlides, ...fixSlides].sort((a, b) => String(b.sortAt).localeCompare(String(a.sortAt)));
	return merged.slice(0, limit);
}
