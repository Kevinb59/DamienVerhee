/**
 * Console d’administration : articles (Quill + événements + médias), galerie fixe (glisser-déposer), boutique.
 * Dépendances globales : Quill, Sortable (chargées dans admin.html avant ce module).
 */
import {
	listArticles,
	saveArticle,
	deleteArticle,
	getArticle,
	listGalleryAlbums,
	saveGalleryAlbum,
	deleteGalleryAlbum,
	listGalleryItems,
	listDynamicGalleryItems,
	saveGalleryItem,
	deleteGalleryItem,
	reorderGalleryItems,
	listProducts,
	getProduct,
	saveProduct,
	deleteProduct,
	uploadMediaAsset,
} from '../store.js';
import { DYNAMIC_GALLERY_ALBUM_ID } from '../config.js';
import { resolveVideoPosterUrl } from '../video-poster.js';
import { extractMediaFromHtml, mergeArticleMedia } from '../mediaextract.js';
import { setupQuillMediaResize } from './quill-media-resize.js';
import { normalizeVideoEmbedUrl } from './video-embed-url.js';
import { enforceAdminAccess, getCurrentAdminIdToken } from './admin-auth.js';
import { getApiUrl } from '../apiBase.js';

/* global Quill, Sortable */

await enforceAdminAccess();

// ——— Quill : tailles de police et iframe vidéo (YouTube / Vimeo / URL embed) ———
const BlockEmbed = Quill.import('blots/block/embed');
const Link = Quill.import('formats/link');

/** Attributs width/height gérés comme le blot vidéo natif Quill (delta + redimensionnement admin). */
const VIDEO_DIM_ATTRS = ['height', 'width'];

class VideoBlot extends BlockEmbed {
	static create(value) {
		const node = super.create(value);
		const raw = String(value || '').trim();
		const normalized = normalizeVideoEmbedUrl(raw);
		const src = normalized || raw;
		node.setAttribute('src', this.sanitize(src));
		node.setAttribute('frameborder', '0');
		node.setAttribute('allowfullscreen', 'true');
		node.setAttribute(
			'allow',
			'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
		);
		node.setAttribute('width', '560');
		node.removeAttribute('height');
		return node;
	}

	static formats(domNode) {
		return VIDEO_DIM_ATTRS.reduce((formats, attr) => {
			if (domNode.hasAttribute(attr)) {
				formats[attr] = domNode.getAttribute(attr);
			}
			return formats;
		}, {});
	}

	static value(domNode) {
		return domNode.getAttribute('src');
	}

	static sanitize(url) {
		return Link.sanitize(url) ? url : 'about:blank';
	}

	format(name, val) {
		if (VIDEO_DIM_ATTRS.indexOf(name) > -1) {
			if (val) {
				this.domNode.setAttribute(name, val);
			} else {
				this.domNode.removeAttribute(name);
			}
		} else {
			super.format(name, val);
		}
	}
}

VideoBlot.blotName = 'video';
VideoBlot.tagName = 'IFRAME';
VideoBlot.className = 'ql-video';
Quill.register(VideoBlot, true);

const SizeStyle = Quill.import('attributors/style/size');
SizeStyle.whitelist = ['10px', '12px', '14px', '16px', '18px', '24px', '32px'];
Quill.register(SizeStyle, true);

/**
 * Ouvre un sélecteur de fichier natif et retourne le fichier choisi.
 *
 * 1) But : réutiliser la même logique partout (Quill, médias annexes, galerie, produit).
 * 2) Variables clés :
 *    - accept : filtre MIME/extensions.
 *    - file : premier fichier sélectionné.
 * 3) Flux :
 *    - création d’un input file temporaire
 *    - résolution Promise au changement
 *
 * @param {string} accept
 * @returns {Promise<File|null>}
 */
function pickFileFromDevice(accept) {
	return new Promise((resolve) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = accept;
		input.addEventListener('change', () => {
			resolve(input.files && input.files[0] ? input.files[0] : null);
		});
		input.click();
	});
}

/**
 * Upload un fichier via le provider actif et affiche une erreur utilisateur claire si besoin.
 *
 * @param {File|null} file
 * @param {string} folder
 * @returns {Promise<{ url: string, kind: 'image'|'video' }|null>}
 */
async function uploadFileWithFeedback(file, folder) {
	if (!file) {
		return null;
	}
	try {
		return await uploadMediaAsset(file, { folder });
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error('Upload média:', msg);
		window.alert(
			"Impossible d'envoyer le fichier. Réessayez, ou choisissez une image par lien à la place.",
		);
		return null;
	}
}

/**
 * Affiche un choix explicite "Importer" / "Lien" / "Annuler" pour l’insertion d’image Quill.
 *
 * 1) But : laisser l’admin choisir entre upload Cloudinary et URL externe pour les images.
 * 2) Variables clés : resolveOnce pour fermeture unique + overlay modal.
 * 3) Flux : clic bouton ou Esc -> fermeture -> renvoi du mode sélectionné.
 *
 * @returns {Promise<'file'|'url'|null>}
 */
function askQuillImageInsertMode() {
	return new Promise((resolve) => {
		const overlay = document.createElement('div');
		overlay.className = 'dv-admin-dialog';
		overlay.innerHTML = `
			<div class="dv-admin-dialog__panel" role="dialog" aria-modal="true" aria-label="Choisir une source image">
				<h4>Ajouter une image</h4>
				<p>Depuis votre ordinateur ou avec une adresse web ?</p>
				<div class="dv-admin-dialog__actions">
					<button type="button" class="button primary" data-choice="file">Ordinateur</button>
					<button type="button" class="button" data-choice="url">Lien</button>
					<button type="button" class="button" data-choice="cancel">Annuler</button>
				</div>
			</div>
		`;

		let done = false;
		const cleanup = () => {
			document.removeEventListener('keydown', onKeyDown);
			overlay.remove();
		};
		const resolveOnce = (value) => {
			if (done) {
				return;
			}
			done = true;
			cleanup();
			resolve(value);
		};
		const onKeyDown = (evt) => {
			if (evt.key === 'Escape') {
				resolveOnce(null);
			}
		};

		document.addEventListener('keydown', onKeyDown);
		overlay.addEventListener('click', (evt) => {
			const btn = evt.target.closest('[data-choice]');
			if (btn) {
				const choice = btn.getAttribute('data-choice');
				resolveOnce(choice === 'file' || choice === 'url' ? choice : null);
				return;
			}
			if (evt.target === overlay) {
				resolveOnce(null);
			}
		});

		document.body.appendChild(overlay);
		overlay.querySelector('[data-choice="file"]')?.focus();
	});
}

/**
 * Ajoute title + aria-label sur chaque contrôle du toolbar Quill (infobulle au survol).
 * Cible : .dv-admin__quill-wrap .ql-toolbar (thème Snow 1.3.x).
 */
function attachQuillToolbarTooltips() {
	const toolbar = document.querySelector('.dv-admin__quill-wrap .ql-toolbar');
	if (!toolbar) {
		return;
	}

	function setTip(el, text) {
		if (!el || !text) {
			return;
		}
		el.setAttribute('title', text);
		el.setAttribute('aria-label', text);
	}

	// Boutons directs (formats simples, listes, alignement, lien, médias, nettoyage).
	toolbar.querySelectorAll('button').forEach((btn) => {
		if (btn.classList.contains('ql-bold')) {
			setTip(btn, 'Gras');
			return;
		}
		if (btn.classList.contains('ql-italic')) {
			setTip(btn, 'Italique');
			return;
		}
		if (btn.classList.contains('ql-underline')) {
			setTip(btn, 'Souligné');
			return;
		}
		if (btn.classList.contains('ql-strike')) {
			setTip(btn, 'Barré');
			return;
		}
		if (btn.classList.contains('ql-blockquote')) {
			setTip(btn, 'Citation');
			return;
		}
		if (btn.classList.contains('ql-code-block')) {
			setTip(btn, 'Bloc de code');
			return;
		}
		if (btn.classList.contains('ql-link')) {
			setTip(btn, 'Insérer ou modifier un lien');
			return;
		}
		if (btn.classList.contains('ql-image')) {
			setTip(btn, 'Insérer une image (Importer ou Lien)');
			return;
		}
		if (btn.classList.contains('ql-video')) {
			setTip(btn, 'Insérer une vidéo (lien uniquement)');
			return;
		}
		if (btn.classList.contains('ql-clean')) {
			setTip(btn, 'Retirer tout le formatage sur la sélection');
			return;
		}
		if (btn.classList.contains('ql-list')) {
			const v = btn.getAttribute('value') || '';
			setTip(btn, v === 'ordered' ? 'Liste numérotée' : 'Liste à puces');
			return;
		}
		if (btn.classList.contains('ql-align')) {
			const v = btn.getAttribute('value') || '';
			const alignTips = {
				'': 'Aligner à gauche',
				center: 'Centrer le texte',
				right: 'Aligner à droite',
				justify: 'Justifier',
			};
			setTip(btn, alignTips[v] ?? 'Alignement');
			return;
		}
		if (btn.classList.contains('ql-indent')) {
			const v = btn.getAttribute('value') || '';
			setTip(btn, v === '-1' ? 'Diminuer le retrait' : 'Augmenter le retrait');
			return;
		}
	});

	// Menus déroulants : libellé sur la poignée + chaque option du panneau.
	toolbar.querySelectorAll('.ql-picker').forEach((picker) => {
		const label = picker.querySelector('.ql-picker-label');
		if (!label) {
			return;
		}

		if (picker.classList.contains('ql-header')) {
			setTip(label, 'Niveau de titre ou paragraphe normal');
			picker.querySelectorAll('.ql-picker-item').forEach((item) => {
				const v = item.getAttribute('data-value');
				if (v === '1') {
					setTip(item, 'Titre principal (très grand)');
				} else if (v === '2') {
					setTip(item, 'Titre de section');
				} else if (v === '3') {
					setTip(item, 'Sous-titre');
				} else {
					setTip(item, 'Paragraphe normal (sans titre)');
				}
			});
			return;
		}

		if (picker.classList.contains('ql-size')) {
			setTip(label, 'Taille de police');
			picker.querySelectorAll('.ql-picker-item').forEach((item) => {
				const v = item.getAttribute('data-value');
				setTip(item, v ? `Taille ${v}` : 'Taille par défaut');
			});
			return;
		}

		if (picker.classList.contains('ql-color')) {
			setTip(label, 'Couleur du texte');
			picker.querySelectorAll('.ql-picker-item').forEach((item) => {
				const v = item.getAttribute('data-value');
				setTip(item, !v || v === 'false' ? 'Couleur par défaut' : `Texte ${v}`);
			});
			return;
		}

		if (picker.classList.contains('ql-background')) {
			setTip(label, 'Couleur de surlignage (fond)');
			picker.querySelectorAll('.ql-picker-item').forEach((item) => {
				const v = item.getAttribute('data-value');
				setTip(item, !v || v === 'false' ? 'Aucun surlignage' : `Fond ${v}`);
			});
			return;
		}

		// Snow : alignement = icônes dans un .ql-picker (pas des boutons ql-align séparés).
		if (picker.classList.contains('ql-align')) {
			setTip(label, 'Alignement du paragraphe');
			picker.querySelectorAll('.ql-picker-item').forEach((item) => {
				const v = item.getAttribute('data-value') || '';
				const alignItemTips = {
					'': 'Aligner à gauche',
					center: 'Centrer le texte',
					right: 'Aligner à droite',
					justify: 'Justifier',
				};
				setTip(item, alignItemTips[v] ?? 'Alignement');
			});
		}
	});
}

const quill = new Quill('#article-editor', {
	theme: 'snow',
	modules: {
		toolbar: {
			container: [
				[{ header: [1, 2, 3, false] }],
				[{ size: SizeStyle.whitelist }],
				['bold', 'italic', 'underline', 'strike'],
				[{ color: [] }, { background: [] }],
				[{ align: [] }],
				[{ list: 'ordered' }, { list: 'bullet' }],
				['blockquote', 'code-block'],
				['link', 'image', 'video'],
				['clean'],
			],
			handlers: {
				async image() {
					const mode = await askQuillImageInsertMode();
					if (!mode) {
						return;
					}
					let imageUrl = '';
					if (mode === 'file') {
						const file = await pickFileFromDevice('image/*');
						const uploaded = await uploadFileWithFeedback(file, 'articles/editor/images');
						imageUrl = uploaded?.url || '';
					} else {
						imageUrl = String(window.prompt('Adresse web (URL) de l’image :') || '').trim();
					}
					if (!imageUrl) {
						return;
					}
					const range = quill.getSelection(true);
					quill.insertEmbed(range.index, 'image', imageUrl);
				},
				async video() {
					const videoUrl = String(
						window.prompt(
							'Lien de la vidéo (YouTube, Vimeo ou adresse directe du fichier) :',
						) || '',
					).trim();
					if (!videoUrl) {
						return;
					}
					const range = quill.getSelection(true);
					quill.insertEmbed(range.index, 'video', videoUrl);
				},
			},
		},
	},
});

attachQuillToolbarTooltips();
setupQuillMediaResize(quill);

/**
 * Charge du HTML dans Quill via le convertisseur officiel (delta) pour garder les blots cohérents
 * — nécessaire notamment pour le redimensionnement des images (attribut width).
 * @param {string} [html]
 */
function quillSetHtmlFromString(html) {
	const raw = html && String(html).trim() ? String(html) : '<p><br></p>';
	try {
		quill.setContents(quill.clipboard.convert(raw), 'silent');
	} catch {
		quill.root.innerHTML = raw;
	}
}

let editingArticleId = null;

/**
 * Libellé du bouton principal : création vs édition d’un article existant.
 * Variable clé : editingArticleId (null → « Créer l’article », sinon → « Enregistrer les modifications »).
 */
function updateArticleSaveButtonLabel() {
	const btn = document.getElementById('btn-save-article');
	if (!btn) {
		return;
	}
	btn.textContent = editingArticleId ? 'Enregistrer les modifications' : 'Créer l’article';
}

/**
 * Affiche/masque le bloc de champs événement selon la case "article-is-event".
 * But : garder le formulaire lisible et éviter de saisir des infos événement quand la case est décochée.
 */
function syncEventFieldsVisibility() {
	const isEvent = document.getElementById('article-is-event')?.checked;
	const wrap = document.getElementById('article-event-fields');
	if (!wrap) {
		return;
	}
	if (isEvent) {
		wrap.classList.add('is-open');
		wrap.setAttribute('aria-hidden', 'false');
	} else {
		wrap.classList.remove('is-open');
		wrap.setAttribute('aria-hidden', 'true');
	}
}

// ——— Onglets admin (boutons dans .dv-admin__masthead-tabs) ———
// But : synchroniser les classes/ARIA des boutons avec l’affichage des panneaux #tab-*.
// Clé : data-tab → id du panneau tab-${tab} ; rafraîchissement des listes à l’ouverture de chaque module.
document.querySelectorAll('.dv-admin__masthead-tabs button').forEach((btn) => {
	btn.addEventListener('click', () => {
		const tab = btn.dataset.tab;
		document.querySelectorAll('.dv-admin__masthead-tabs button').forEach((b) => {
			b.classList.remove('is-active');
			b.setAttribute('aria-selected', 'false');
		});
		document.querySelectorAll('.dv-admin__panel').forEach((p) => p.classList.remove('is-active'));
		btn.classList.add('is-active');
		btn.setAttribute('aria-selected', 'true');
		document.getElementById(`tab-${tab}`)?.classList.add('is-active');
		if (tab === 'articles') {
			refreshArticleList();
		}
		if (tab === 'gallery') {
			refreshGalleryAdmin();
		}
		if (tab === 'shop') {
			refreshProductList();
		}
	});
});

// ——— Articles : liste / formulaire ———
async function refreshArticleList() {
	const ul = document.getElementById('admin-article-list');
	if (!ul) {
		return;
	}
	ul.innerHTML = '';
	const items = await listArticles({ publishedOnly: false });
	for (const a of items) {
		const li = document.createElement('li');
		li.innerHTML = `<span>${a.title}</span><span>
			<button type="button" class="button small" data-edit-article="${a.id}">Modifier</button>
			<button type="button" class="button small" data-del-article="${a.id}">Supprimer</button>
		</span>`;
		ul.appendChild(li);
	}
}

function resetArticleForm() {
	editingArticleId = null;
	document.getElementById('article-title').value = '';
	document.getElementById('article-excerpt').value = '';
	document.getElementById('article-summary-line').value = '';
	document.getElementById('article-is-event').checked = false;
	document.getElementById('article-event-date').value = '';
	document.getElementById('article-event-time').value = '';
	document.getElementById('article-event-end').value = '';
	document.getElementById('article-event-end-time').value = '';
	document.getElementById('article-event-loc').value = '';
	quillSetHtmlFromString('');
	document.getElementById('extra-media-rows').innerHTML = '';
	syncEventFieldsVisibility();
	updateArticleSaveButtonLabel();
}

/**
 * Synchronise l’affichage d’une ligne média selon la source choisie (lien ou fichier).
 *
 * @param {HTMLElement} row
 */
function syncExtraMediaRowSource(row) {
	const modeSelect = row.querySelector('.extra-source-mode');
	const typeSelect = row.querySelector('.extra-type');
	const type = typeSelect?.value || 'image';
	const fileInput = row.querySelector('.extra-file');
	if (modeSelect) {
		/**
		 * 1) But : imposer la stratégie média des articles.
		 * 2) Variables clés :
		 *    - image => lien ou fichier (au choix admin)
		 *    - video => lien uniquement (pas d’upload vidéo)
		 * 3) Flux : changement type => verrouillage source seulement pour la vidéo.
		 */
		if (type === 'video') {
			modeSelect.value = 'url';
			modeSelect.disabled = true;
		} else {
			modeSelect.disabled = false;
		}
	}
	const mode = modeSelect?.value || 'url';
	const urlWrap = row.querySelector('.extra-url-wrap');
	const fileWrap = row.querySelector('.extra-file-wrap');
	if (urlWrap) {
		urlWrap.hidden = mode !== 'url';
	}
	if (fileWrap) {
		fileWrap.hidden = mode !== 'file';
	}
	if (fileInput) {
		fileInput.setAttribute('accept', 'image/*');
	}
}

function addExtraMediaRow(url = '', type = 'image', caption = '') {
	const wrap = document.getElementById('extra-media-rows');
	const row = document.createElement('div');
	row.className = 'dv-admin__extra-row';
	row.innerHTML = `
		<select class="extra-source-mode" aria-label="Source du média">
			<option value="url">Lien</option>
			<option value="file">Fichier</option>
		</select>
		<div class="extra-url-wrap">
			<input type="url" placeholder="URL média" class="extra-url" value="${url.replace(/"/g, '&quot;')}" />
		</div>
		<div class="extra-file-wrap" hidden>
			<input type="file" class="extra-file" accept="image/*,video/*" />
		</div>
		<select class="extra-type" aria-label="Type de média"><option value="image">Image</option><option value="video" ${type === 'video' ? 'selected' : ''}>Vidéo</option></select>
		<input type="text" placeholder="Légende" class="extra-cap" value="${caption.replace(/"/g, '&quot;')}" />
		<button type="button" class="button small extra-rm" aria-label="Supprimer le média">Supprimer le média</button>
	`;
	row.querySelector('.extra-source-mode')?.addEventListener('change', () => syncExtraMediaRowSource(row));
	row.querySelector('.extra-type')?.addEventListener('change', () => syncExtraMediaRowSource(row));
	row.querySelector('.extra-rm').onclick = () => row.remove();
	syncExtraMediaRowSource(row);
	wrap.appendChild(row);
}

document.getElementById('btn-add-extra-media')?.addEventListener('click', () => addExtraMediaRow());
document.getElementById('article-is-event')?.addEventListener('change', syncEventFieldsVisibility);

document.getElementById('admin-article-list')?.addEventListener('click', async (e) => {
	const edit = e.target.closest('[data-edit-article]');
	const del = e.target.closest('[data-del-article]');
	if (edit) {
		const art = await getArticle(edit.dataset.editArticle);
		if (!art) {
			return;
		}
		editingArticleId = art.id;
		document.getElementById('article-title').value = art.title;
		document.getElementById('article-excerpt').value = art.excerpt || '';
		document.getElementById('article-summary-line').value = art.summaryLine || '';
		document.getElementById('article-is-event').checked = !!art.isEvent;
		document.getElementById('article-event-date').value = art.eventDate || '';
		document.getElementById('article-event-time').value = art.eventTime || '';
		document.getElementById('article-event-end').value = art.eventEndDate || '';
		document.getElementById('article-event-end-time').value = art.eventEndTime || '';
		document.getElementById('article-event-loc').value = art.eventLocation || '';
		quillSetHtmlFromString(art.bodyHtml || '');
		document.getElementById('extra-media-rows').innerHTML = '';
		// Médias « manuels » : ceux qui ne sont pas détectés dans le HTML (approximation : on reprend la liste enregistrée)
		(art.media || []).forEach((m) => addExtraMediaRow(m.url, m.type, m.caption || ''));
		syncEventFieldsVisibility();
		updateArticleSaveButtonLabel();
		return;
	}
	// Suppression : message explicite + titre dans la boîte pour limiter les clics accidentels.
	if (del) {
		const id = del.dataset.delArticle;
		const titleEl = del.closest('li')?.querySelector('span:first-child');
		const title = titleEl?.textContent?.trim() || 'cet article';
		const ok = window.confirm(
			`Supprimer l’article « ${title} » ? Cette action est définitive.`,
		);
		if (!ok) {
			return;
		}
		try {
			await deleteArticle(id);
			if (editingArticleId === id) {
				resetArticleForm();
			}
			await refreshArticleList();
			window.alert('Article supprimé.');
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error('Suppression article:', msg);
			window.alert('La suppression n’a pas abouti. Réessayez.');
		}
	}
});

document.getElementById('btn-save-article')?.addEventListener('click', async () => {
	const title = document.getElementById('article-title').value.trim();
	const bodyHtml = quill.root.innerHTML;
	const fromEditor = [];

	// 1) Médias annexes : chaque ligne peut venir d’un lien ou d’un fichier.
	// 2) Si fichier => upload immédiat via provider actif pour obtenir l’URL finale à stocker.
	const rows = Array.from(document.querySelectorAll('#extra-media-rows .dv-admin__extra-row'));
	for (const row of rows) {
		const type = row.querySelector('.extra-type')?.value || 'image';
		const mode = row.querySelector('.extra-source-mode')?.value || (type === 'video' ? 'url' : 'file');
		let url = '';
		if (mode === 'file') {
			const file = row.querySelector('.extra-file')?.files?.[0] || null;
			const uploaded = await uploadFileWithFeedback(file, 'articles/extra-media');
			url = uploaded?.url || '';
		} else {
			url = row.querySelector('.extra-url')?.value.trim() || '';
		}
		if (type === 'video' && mode !== 'url') {
			window.alert('Pour une vidéo, utilisez un lien (pas de fichier sur cette ligne).');
			return;
		}
		if (!url) {
			continue;
		}
		fromEditor.push({
			url,
			type,
			caption: row.querySelector('.extra-cap')?.value.trim() || '',
		});
	}
	const merged = mergeArticleMedia(fromEditor, extractMediaFromHtml(bodyHtml));
	const isEvent = document.getElementById('article-is-event').checked;

	// Bloc événement : si la case est décochée, on force les champs à null/'' pour éviter des résidus cachés.
	const payload = {
		id: editingArticleId || undefined,
		title,
		excerpt: document.getElementById('article-excerpt').value.trim(),
		summaryLine: document.getElementById('article-summary-line').value.trim(),
		bodyHtml,
		// En admin, les articles créés/édités via ce formulaire sont publiés directement.
		published: true,
		isEvent,
		eventDate: isEvent ? document.getElementById('article-event-date').value || null : null,
		eventTime: isEvent ? document.getElementById('article-event-time').value || null : null,
		eventEndDate: isEvent ? document.getElementById('article-event-end').value || null : null,
		eventEndTime: isEvent ? document.getElementById('article-event-end-time').value || null : null,
		eventLocation: isEvent ? document.getElementById('article-event-loc').value.trim() : '',
		media: merged,
	};

	const wasNew = !editingArticleId;
	try {
		await saveArticle(payload);
		await refreshArticleList();
		// 1) But : toujours repartir d'un formulaire vide après enregistrement.
		// 2) Variables clés : resetArticleForm remet editingArticleId à null + vide tous les champs.
		// 3) Flux : comportement identique après création ET après modification.
		resetArticleForm();
		window.alert(wasNew ? 'Article enregistré.' : 'Modifications enregistrées.');
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error('Enregistrement article:', msg);
		window.alert("L'enregistrement n'a pas abouti. Vérifiez les champs et réessayez.");
	}
});

// ——— Galerie fixe : albums + tri ———
let galleryAlbumId = null;

/**
 * Remplit le sélecteur « album cible » pour l’ajout (albums Firestore uniquement, pas l’album virtuel).
 *
 * 1) But : choisir explicitement l’album de destination sans confondre avec « Médias articles ».
 * 2) Variables clés : `albums` (liste serveur), `galleryAlbumId` (album actuellement affiché).
 * 3) Flux : options -> valeur par défaut alignée sur l’album actif s’il est éditable, sinon premier album.
 *
 * @param {Array<{ id: string, title?: string }>} albums
 */
function fillGitemTargetAlbumSelect(albums) {
	const sel = document.getElementById('gitem-target-album');
	if (!sel) {
		return;
	}
	const prev = sel.value;
	sel.innerHTML = '';
	for (const a of albums) {
		const o = document.createElement('option');
		o.value = a.id;
		o.textContent = a.title || 'Album';
		sel.appendChild(o);
	}
	const ids = albums.map((a) => a.id);
	if (ids.length === 0) {
		const o = document.createElement('option');
		o.value = '';
		o.textContent = '— Créez un album —';
		sel.appendChild(o);
		sel.disabled = true;
		return;
	}
	sel.disabled = false;
	if (prev && ids.includes(prev)) {
		sel.value = prev;
		return;
	}
	if (galleryAlbumId !== DYNAMIC_GALLERY_ALBUM_ID && ids.includes(galleryAlbumId)) {
		sel.value = galleryAlbumId;
		return;
	}
	sel.value = ids[0];
}

/**
 * Affiche ou masque l’UI d’édition selon que l’album actif est le virtuel « Médias articles ».
 *
 * 1) But : album virtuel = lecture seule (pas d’ajout, pas de suppression d’album, pas de tri).
 * 2) Variables clés : `galleryAlbumId`, `DYNAMIC_GALLERY_ALBUM_ID`.
 * 3) Flux : bascule bandeau d’ajout + bouton supprimer album + texte d’aide liste.
 */
function syncGalleryVirtualAlbumUi() {
	const isVirtual = galleryAlbumId === DYNAMIC_GALLERY_ALBUM_ID;
	const addBand = document.getElementById('admin-gallery-add-band');
	if (addBand) {
		addBand.hidden = isVirtual;
	}
	const delAlbum = document.getElementById('btn-del-album');
	if (delAlbum) {
		delAlbum.disabled = isVirtual;
		delAlbum.title = isVirtual ? 'Album non modifiable ici' : '';
	}
	const renameAlbum = document.getElementById('btn-rename-album');
	if (renameAlbum) {
		renameAlbum.disabled = isVirtual;
		renameAlbum.title = isVirtual ? 'Album non modifiable ici' : '';
	}
	const hint = document.getElementById('admin-gallery-items-hint');
	if (hint) {
		hint.textContent = isVirtual
			? 'Médias extraits des articles publiés (lecture seule, non réordonnables ici).'
			: 'Glisser-déposer pour réordonner les médias de cet album.';
	}
}

async function refreshGalleryAdmin() {
	const albumSel = document.getElementById('admin-gallery-album');
	if (!albumSel) {
		return;
	}
	const albums = await listGalleryAlbums();
	const prevSelection = galleryAlbumId;
	albumSel.innerHTML = '';

	const optDyn = document.createElement('option');
	optDyn.value = DYNAMIC_GALLERY_ALBUM_ID;
	optDyn.textContent = 'Médias articles';
	albumSel.appendChild(optDyn);

	for (const a of albums) {
		const o = document.createElement('option');
		o.value = a.id;
		o.textContent = a.title || 'Album';
		albumSel.appendChild(o);
	}

	const optionIds = [DYNAMIC_GALLERY_ALBUM_ID, ...albums.map((x) => x.id)];
	if (prevSelection && optionIds.includes(prevSelection)) {
		galleryAlbumId = prevSelection;
		albumSel.value = galleryAlbumId;
	} else if (albums.length) {
		galleryAlbumId = albums[0].id;
		albumSel.value = galleryAlbumId;
	} else {
		galleryAlbumId = DYNAMIC_GALLERY_ALBUM_ID;
		albumSel.value = galleryAlbumId;
	}

	fillGitemTargetAlbumSelect(albums);
	syncGalleryVirtualAlbumUi();
	await renderGalleryItemsList();
}

/**
 * Construit l’aperçu miniature d’un média galerie (image ou vidéo) pour la liste admin.
 * Pas de lien vers l’URL : glisser-déposer + suppression uniquement ; l’URL reste en BDD (mock / Firebase).
 *
 * @param {HTMLElement} wrap - conteneur carré `.dv-admin__gitem-thumb-wrap`
 * @param {{ type: string, url: string, thumbUrl?: string, caption?: string }} it
 */
function mountGalleryItemThumb(wrap, it) {
	const url = String(it.url || '').trim();
	const thumb = String(it.thumbUrl || '').trim();
	const thumbSrc = (thumb || url).trim();
	const isVideo = it.type === 'video';
	const looksLikeImage = (s) => /\.(jpe?g|png|webp|gif|bmp|svg)(\?|#|$)/i.test(s);
	const looksLikeVideoFile = (s) => /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(s);

	/**
	 * Remplace une miniature cassée par un pictogramme neutre (URL Firebase invalide, CORS, etc.).
	 *
	 * @param {HTMLImageElement} im
	 */
	function onThumbImgError(im) {
		im.remove();
		if (wrap.querySelector('.dv-admin__gitem-thumb-placeholder')) {
			return;
		}
		const ph = document.createElement('div');
		ph.className = 'dv-admin__gitem-thumb-placeholder';
		ph.setAttribute('role', 'img');
		ph.setAttribute('aria-label', 'Miniature introuvable');
		ph.textContent = '?';
		wrap.appendChild(ph);
	}

	if (!thumbSrc) {
		const ph = document.createElement('div');
		ph.className = 'dv-admin__gitem-thumb-placeholder';
		ph.setAttribute('role', 'img');
		ph.setAttribute('aria-label', 'Aperçu indisponible');
		ph.textContent = isVideo ? '▶' : '—';
		wrap.appendChild(ph);
		return;
	}

	if (isVideo && (looksLikeImage(thumb) || (thumb && !looksLikeVideoFile(thumb)))) {
		const im = document.createElement('img');
		im.className = 'dv-admin__gitem-thumb';
		im.draggable = false;
		im.loading = 'lazy';
		im.decoding = 'async';
		im.src = thumb || thumbSrc;
		im.alt = it.caption ? String(it.caption).slice(0, 120) : 'Aperçu vidéo';
		im.addEventListener('error', () => onThumbImgError(im), { once: true });
		wrap.appendChild(im);
		return;
	}

	if (isVideo && looksLikeVideoFile(url)) {
		const v = document.createElement('video');
		v.className = 'dv-admin__gitem-thumb dv-admin__gitem-thumb--video';
		v.src = url;
		v.muted = true;
		v.playsInline = true;
		v.preload = 'metadata';
		v.setAttribute('aria-label', 'Aperçu vidéo');
		wrap.appendChild(v);
		return;
	}

	if (isVideo) {
		const ph = document.createElement('div');
		ph.className = 'dv-admin__gitem-thumb-placeholder';
		ph.setAttribute('role', 'img');
		ph.setAttribute('aria-label', 'Vidéo (aperçu non disponible pour cette URL)');
		ph.textContent = '▶';
		wrap.appendChild(ph);
		return;
	}

	const im = document.createElement('img');
	im.className = 'dv-admin__gitem-thumb';
	im.draggable = false;
	im.loading = 'lazy';
	im.decoding = 'async';
	im.src = thumbSrc;
	im.alt = it.caption ? String(it.caption).slice(0, 120) : 'Miniature';
	im.addEventListener('error', () => onThumbImgError(im), { once: true });
	wrap.appendChild(im);
}

async function renderGalleryItemsList() {
	const listEl = document.getElementById('admin-gallery-items');
	if (!galleryAlbumId || !listEl) {
		return;
	}

	/**
	 * 1) But : l’album « Médias articles » agrège les médias Firestore des articles (pas `galleryItems`).
	 * 2) Variables clés : `DYNAMIC_GALLERY_ALBUM_ID`, `listDynamicGalleryItems`.
	 * 3) Flux : sinon lecture classique `listGalleryItems(albumId)` + tri drag-and-drop.
	 */
	const isVirtualAlbum = galleryAlbumId === DYNAMIC_GALLERY_ALBUM_ID;
	const items = isVirtualAlbum
		? await listDynamicGalleryItems()
		: await listGalleryItems(galleryAlbumId);

	listEl.innerHTML = '';
	const ul = document.createElement('ul');
	ul.id = 'sort-gallery-items';
	ul.className = 'dv-admin__sortable-list dv-admin__sortable-list--gallery';

	items.forEach((it) => {
		const li = document.createElement('li');
		li.className = 'dv-admin__gitem-li';
		li.dataset.id = it.id;

		const row = document.createElement('div');
		row.className = 'dv-admin__gitem-row';

		const thumbWrap = document.createElement('div');
		thumbWrap.className = 'dv-admin__gitem-thumb-wrap';
		mountGalleryItemThumb(thumbWrap, it);

		const meta = document.createElement('div');
		meta.className = 'dv-admin__gitem-meta';
		const typeEl = document.createElement('span');
		typeEl.className = 'dv-admin__gitem-type';
		typeEl.textContent = it.type === 'video' ? 'Vidéo' : 'Image';
		const capEl = document.createElement('p');
		capEl.className = 'dv-admin__gitem-cap';
		const cap = String(it.caption || '').trim();
		capEl.textContent = cap || 'Sans légende';

		meta.appendChild(typeEl);
		meta.appendChild(capEl);

		if (isVirtualAlbum && it.articleTitle) {
			const artEl = document.createElement('p');
			artEl.className = 'dv-admin__gitem-article';
			artEl.textContent = `Article : ${it.articleTitle}`;
			meta.appendChild(artEl);
		}

		const actions = document.createElement('div');
		actions.className = 'dv-admin__gitem-actions';
		if (!isVirtualAlbum) {
			const delBtn = document.createElement('button');
			delBtn.type = 'button';
			delBtn.className = 'button small';
			delBtn.dataset.delGitem = it.id;
			delBtn.textContent = 'Supprimer';
			actions.appendChild(delBtn);
		}

		row.appendChild(thumbWrap);
		row.appendChild(meta);
		row.appendChild(actions);
		li.appendChild(row);
		ul.appendChild(li);
	});

	if (!items.length) {
		const empty = document.createElement('p');
		empty.className = 'dv-admin__empty-msg';
		empty.textContent = isVirtualAlbum
			? 'Aucun média issu d’article pour le moment.'
			: 'Aucun média dans cet album.';
		listEl.appendChild(empty);
		return;
	}

	listEl.appendChild(ul);

	if (!isVirtualAlbum && typeof Sortable !== 'undefined') {
		if (ul._dvSortable) {
			ul._dvSortable.destroy();
		}
		ul._dvSortable = Sortable.create(ul, {
			animation: 150,
			ghostClass: 'dv-sortable-ghost',
			filter: 'button',
			preventOnFilter: true,
			onEnd: async () => {
				const ids = Array.from(ul.children).map((child) => child.dataset.id);
				await reorderGalleryItems(galleryAlbumId, ids);
			},
		});
	}

	ul.addEventListener('click', async (e) => {
		const b = e.target.closest('[data-del-gitem]');
		if (b) {
			if (!window.confirm('Supprimer ce média ?')) {
				return;
			}
			try {
				await deleteGalleryItem(b.dataset.delGitem);
				await renderGalleryItemsList();
				window.alert('Média supprimé.');
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				console.error('Suppression média galerie:', msg);
				window.alert('La suppression n’a pas abouti. Réessayez.');
			}
		}
	});
}

document.getElementById('admin-gallery-album')?.addEventListener('change', async (e) => {
	galleryAlbumId = e.target.value;
	syncGalleryVirtualAlbumUi();
	await renderGalleryItemsList();
});

document.getElementById('btn-new-album')?.addEventListener('click', async () => {
	const title = window.prompt('Nom du nouvel album :');
	if (!title || !title.trim()) {
		return;
	}
	try {
		await saveGalleryAlbum({ title: title.trim() });
		await refreshGalleryAdmin();
		window.alert('Album créé.');
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error('Création album:', msg);
		window.alert('La création de l’album n’a pas abouti. Réessayez.');
	}
});

/**
 * 1) But : renommer l’album Firestore sélectionné (hors album virtuel « Médias articles »).
 * 2) Variables clés : `galleryAlbumId`, liste `listGalleryAlbums` pour le titre courant.
 * 3) Flux : prompt -> `saveGalleryAlbum` avec id -> rafraîchissement + message de confirmation.
 */
document.getElementById('btn-rename-album')?.addEventListener('click', async () => {
	if (galleryAlbumId === DYNAMIC_GALLERY_ALBUM_ID) {
		window.alert('Cet album ne peut pas être renommé ici.');
		return;
	}
	if (!galleryAlbumId) {
		return;
	}
	try {
		const albums = await listGalleryAlbums();
		const current = albums.find((a) => a.id === galleryAlbumId);
		const next = window.prompt('Nouveau nom de l’album :', current?.title || '');
		if (!next || !String(next).trim()) {
			return;
		}
		await saveGalleryAlbum({ id: galleryAlbumId, title: String(next).trim() });
		await refreshGalleryAdmin();
		window.alert('Nom de l’album mis à jour.');
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error('Renommage album:', msg);
		window.alert('Le renommage n’a pas abouti. Réessayez.');
	}
});

document.getElementById('btn-del-album')?.addEventListener('click', async () => {
	if (galleryAlbumId === DYNAMIC_GALLERY_ALBUM_ID) {
		window.alert('Cet album ne peut pas être supprimé.');
		return;
	}
	if (!galleryAlbumId || !window.confirm('Supprimer cet album et tous les médias qu’il contient ?')) {
		return;
	}
	try {
		await deleteGalleryAlbum(galleryAlbumId);
		await refreshGalleryAdmin();
		window.alert('Album supprimé.');
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error('Suppression album:', msg);
		window.alert('La suppression n’a pas abouti. Réessayez.');
	}
});

/**
 * Bascule champ Lien/Fichier pour l’ajout de média galerie.
 */
function syncGallerySourceMode() {
	const mode = document.getElementById('gitem-source-mode')?.value || 'url';
	const urlWrap = document.getElementById('gitem-url-wrap');
	const fileWrap = document.getElementById('gitem-file-wrap');
	if (urlWrap) {
		urlWrap.hidden = mode !== 'url';
	}
	if (fileWrap) {
		fileWrap.hidden = mode !== 'file';
	}
}

/**
 * Vidéo : source « fichier » interdite (embed / URL uniquement), comme demandé côté admin.
 *
 * 1) But : aligner l’UI sur la règle métier (images = lien ou fichier ; vidéos = lien seul).
 * 2) Variables clés : `gitem-type`, option `file` du sélecteur source.
 * 3) Flux : si vidéo -> forcer URL + désactiver fichier + vider l’input file.
 */
function syncGalleryItemTypeMode() {
	const type = document.getElementById('gitem-type')?.value || 'image';
	const modeSel = document.getElementById('gitem-source-mode');
	const fileOpt = modeSel?.querySelector('option[value="file"]');
	const fileInput = document.getElementById('gitem-file');
	if (type === 'video') {
		if (fileOpt) {
			fileOpt.disabled = true;
		}
		if (modeSel && modeSel.value === 'file') {
			modeSel.value = 'url';
		}
		if (fileInput) {
			fileInput.value = '';
		}
	} else if (fileOpt) {
		fileOpt.disabled = false;
	}
	syncGallerySourceMode();
}

document.getElementById('gitem-source-mode')?.addEventListener('change', syncGallerySourceMode);
document.getElementById('gitem-type')?.addEventListener('change', syncGalleryItemTypeMode);

document.getElementById('btn-add-gitem')?.addEventListener('click', async () => {
	const targetAlbum = document.getElementById('gitem-target-album')?.value?.trim() || '';
	if (!targetAlbum) {
		window.alert('Créez d’abord un album.');
		return;
	}
	if (targetAlbum === DYNAMIC_GALLERY_ALBUM_ID) {
		window.alert('Choisissez un autre album : celui-ci se remplit tout seul à partir des articles.');
		return;
	}

	const type = document.getElementById('gitem-type')?.value || 'image';
	const sourceMode = document.getElementById('gitem-source-mode')?.value || 'url';

	if (type === 'video' && sourceMode === 'file') {
		window.alert('Pour une vidéo, indiquez un lien (pas de fichier).');
		return;
	}

	// 1) Source galerie : lien direct OU fichier local (images uniquement).
	let url = '';
	if (sourceMode === 'file') {
		const file = document.getElementById('gitem-file')?.files?.[0] || null;
		const uploaded = await uploadFileWithFeedback(file, 'gallery/fixed');
		url = uploaded?.url || '';
	} else {
		url = document.getElementById('gitem-url')?.value.trim() || '';
	}
	if (type === 'video') {
		url = normalizeVideoEmbedUrl(url) || url;
	}
	if (!url) {
		window.alert('Ajoutez une adresse web ou choisissez une image sur votre ordinateur.');
		return;
	}

	const poster =
		type === 'video' ? resolveVideoPosterUrl(url, '') || url : url;

	try {
		await saveGalleryItem({
			albumId: targetAlbum,
			url,
			type,
			thumbUrl: poster,
			caption: document.getElementById('gitem-cap')?.value.trim() || '',
		});
		document.getElementById('gitem-url').value = '';
		const gitemFile = document.getElementById('gitem-file');
		if (gitemFile) {
			gitemFile.value = '';
		}
		await renderGalleryItemsList();
		window.alert('Média ajouté.');
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error('Ajout média galerie:', msg);
		window.alert("L'ajout du média n'a pas abouti. Vérifiez le lien ou le fichier et réessayez.");
	}
});

// ——— Boutique ———
let editingProductId = null;

/**
 * Met à jour le libellé du bouton produit selon le contexte.
 *
 * 1) But : distinguer clairement création vs mise à jour.
 * 2) Variables clés :
 *    - editingProductId : null = création, string = édition.
 * 3) Flux : texte du bouton synchronisé après chaque changement d’état.
 */
function updateProductSaveButtonLabel() {
	const btn = document.getElementById('btn-save-product');
	if (!btn) {
		return;
	}
	btn.textContent = editingProductId ? 'Enregistrer les modifications' : 'Créer le produit';
}

async function refreshProductList() {
	const ul = document.getElementById('admin-product-list');
	if (!ul) {
		return;
	}
	ul.innerHTML = '';
	const items = await listProducts({ publishedOnly: false });
	for (const p of items) {
		const li = document.createElement('li');
		li.innerHTML = `<span>${p.title}</span><span>
			<button type="button" class="button small" data-edit-product="${p.id}">Modifier</button>
			<button type="button" class="button small" data-del-product="${p.id}">Supprimer</button>
		</span>`;
		ul.appendChild(li);
	}
}

function eurosToCents(str) {
	const n = parseFloat(String(str).replace(',', '.'));
	if (Number.isNaN(n)) {
		return 0;
	}
	return Math.round(n * 100);
}

/**
 * Vérifie l’intégrité minimale d’un produit avant sauvegarde.
 *
 * 1) But : éviter l’enregistrement de fiches incomplètes.
 * 2) Variables clés :
 *    - payload : données prêtes à persister.
 *    - promo : active la validation de l’ancien prix.
 * 3) Flux : accumulation des erreurs -> retour de la liste au submitter.
 *
 * @param {{ title: string, imageUrl: string, priceCents: number, promo: boolean, priceBeforePromoCents: number|null, sumupUrl: string }} payload
 * @returns {string[]}
 */
function validateProductPayload(payload) {
	const errors = [];
	if (!payload.title) {
		errors.push('Indiquez un titre pour le livre.');
	}
	if (!payload.imageUrl) {
		errors.push('Ajoutez une couverture (lien ou fichier).');
	}
	if (!Number.isFinite(payload.priceCents) || payload.priceCents <= 0) {
		errors.push('Indiquez un prix valide (supérieur à 0).');
	}
	if (payload.promo) {
		const oldPrice = Number(payload.priceBeforePromoCents || 0);
		if (oldPrice <= 0) {
			errors.push('En promotion : indiquez aussi l’ancien prix.');
		}
		if (oldPrice > 0 && oldPrice <= payload.priceCents) {
			errors.push('L’ancien prix doit être plus élevé que le prix actuel.');
		}
	}
	if (payload.sumupUrl && payload.sumupUrl !== '#') {
		try {
			const parsed = new URL(payload.sumupUrl);
			if (!/^https?:$/i.test(parsed.protocol)) {
				errors.push('Le lien d’achat doit commencer par http:// ou https://');
			}
		} catch {
			errors.push('Le lien d’achat ne semble pas correct.');
		}
	}
	return errors;
}

/**
 * Bascule champ Lien/Fichier pour la couverture produit.
 */
function syncProductImageSourceMode() {
	const mode = document.getElementById('prod-image-mode')?.value || 'url';
	const urlWrap = document.getElementById('prod-image-url-wrap');
	const fileWrap = document.getElementById('prod-image-file-wrap');
	if (urlWrap) {
		urlWrap.hidden = mode !== 'url';
	}
	if (fileWrap) {
		fileWrap.hidden = mode !== 'file';
	}
}

document.getElementById('prod-image-mode')?.addEventListener('change', syncProductImageSourceMode);

document.getElementById('admin-product-list')?.addEventListener('click', async (e) => {
	const edit = e.target.closest('[data-edit-product]');
	const del = e.target.closest('[data-del-product]');
	if (edit) {
		const p = await getProduct(edit.dataset.editProduct);
		if (!p) {
			return;
		}
		editingProductId = p.id;
		document.getElementById('prod-title').value = p.title;
		document.getElementById('prod-image-mode').value = 'url';
		document.getElementById('prod-image').value = p.imageUrl;
		const imgFile = document.getElementById('prod-image-file');
		if (imgFile) {
			imgFile.value = '';
		}
		document.getElementById('prod-synopsis').value = p.synopsis;
		document.getElementById('prod-price').value = (p.priceCents / 100).toFixed(2);
		document.getElementById('prod-promo').checked = !!p.promo;
		document.getElementById('prod-oldprice').value =
			p.priceBeforePromoCents != null ? (p.priceBeforePromoCents / 100).toFixed(2) : '';
		document.getElementById('prod-sumup').value = p.sumupUrl;
		document.getElementById('prod-published').checked = !!p.published;
		syncProductImageSourceMode();
		updateProductSaveButtonLabel();
		return;
	}
	if (del && window.confirm('Retirer ce livre de la boutique ?')) {
		await deleteProduct(del.dataset.delProduct);
		refreshProductList();
		if (editingProductId === del.dataset.delProduct) {
			editingProductId = null;
			updateProductSaveButtonLabel();
		}
		window.alert('Livre retiré de la boutique.');
	}
});

document.getElementById('btn-new-product')?.addEventListener('click', () => {
	editingProductId = null;
	document.getElementById('prod-title').value = '';
	document.getElementById('prod-image-mode').value = 'url';
	document.getElementById('prod-image').value = '';
	const imgFile = document.getElementById('prod-image-file');
	if (imgFile) {
		imgFile.value = '';
	}
	document.getElementById('prod-synopsis').value = '';
	document.getElementById('prod-price').value = '';
	document.getElementById('prod-promo').checked = false;
	document.getElementById('prod-oldprice').value = '';
	document.getElementById('prod-sumup').value = '';
	document.getElementById('prod-published').checked = true;
	syncProductImageSourceMode();
	updateProductSaveButtonLabel();
});

document.getElementById('btn-save-product')?.addEventListener('click', async () => {
	try {
		const promo = document.getElementById('prod-promo').checked;
		const imageMode = document.getElementById('prod-image-mode')?.value || 'url';
		let imageUrl = '';
		if (imageMode === 'file') {
			const file = document.getElementById('prod-image-file')?.files?.[0] || null;
			const uploaded = await uploadFileWithFeedback(file, 'products/covers');
			imageUrl = uploaded?.url || document.getElementById('prod-image').value.trim();
		} else {
			imageUrl = document.getElementById('prod-image').value.trim();
		}
		const payload = {
			id: editingProductId || undefined,
			title: document.getElementById('prod-title').value.trim(),
			imageUrl,
			synopsis: document.getElementById('prod-synopsis').value.trim(),
			priceCents: eurosToCents(document.getElementById('prod-price').value),
			promo,
			priceBeforePromoCents: promo ? eurosToCents(document.getElementById('prod-oldprice').value) : null,
			sumupUrl: document.getElementById('prod-sumup').value.trim() || '#',
			published: document.getElementById('prod-published').checked,
			currency: 'EUR',
		};
		const errors = validateProductPayload(payload);
		if (errors.length) {
			window.alert(errors.join('\n'));
			return;
		}
		const isNew = !editingProductId;
		await saveProduct(payload);
		await refreshProductList();
		if (isNew) {
			editingProductId = null;
		}
		updateProductSaveButtonLabel();
		window.alert(isNew ? 'Livre ajouté à la boutique.' : 'Fiche livre mise à jour.');
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error('Enregistrement produit:', msg);
		window.alert("L'enregistrement n'a pas abouti. Vérifiez les champs et réessayez.");
	}
});

/**
 * Déclenche un rebuild Vercel sécurisé depuis l'admin.
 *
 * 1) But : publier le snapshot statique public sans exposer les secrets côté client.
 * 2) Variables clés :
 *    - idToken : jeton Firebase admin transmis en Bearer.
 *    - button : verrouillage UI pendant l'appel API.
 * 3) Flux :
 *    - récupération du token Firebase courant
 *    - POST vers /api/rebuild
 *    - feedback utilisateur explicite (succès/erreur)
 */
async function triggerSiteRebuild() {
	const button = document.getElementById('btn-publish-site');
	const defaultLabel = button?.textContent || 'Publier le site';
	try {
		if (button) {
			button.disabled = true;
			button.textContent = 'Publication en cours...';
		}
		const idToken = await getCurrentAdminIdToken();
		const response = await fetch(getApiUrl('/api/rebuild'), {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${idToken}`,
			},
		});
		const payload = await response.json().catch(() => ({}));
		if (!response.ok || !payload?.ok) {
			throw new Error(payload?.message || 'Rebuild impossible.');
		}
		renderLastPublishStatus(payload?.publishedAt || null);
		window.alert(
			'Publication en cours. Veuillez patienter environ 1 à 3 minutes avant que les changements apparaissent sur le site.',
		);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error('Publication site:', msg);
		window.alert(
			"La publication n'a pas pu démarrer. Réessayez dans un instant. Si le problème continue, vérifiez votre connexion ou contactez la personne qui gère l'hébergement.",
		);
	} finally {
		if (button) {
			button.disabled = false;
			button.textContent = defaultLabel;
		}
	}
}

/**
 * Affiche le statut "Dernière publication" dans le bandeau admin.
 *
 * 1) But : donner une trace visuelle persistante du dernier clic de publication.
 * 2) Variables clés :
 *    - publishedAtIso : timestamp ISO serveur (Firestore).
 *    - formatted : rendu FR DD/MM/YYYY à HH:MM.
 * 3) Flux :
 *    - récupération API de statut (si nécessaire)
 *    - validation date
 *    - mise à jour texte du bandeau
 */
async function renderLastPublishStatus(publishedAtIso = null) {
	const statusNode = document.getElementById('admin-publish-status');
	if (!statusNode) {
		return;
	}

	let rawIso = publishedAtIso;
	if (!rawIso) {
		try {
			const idToken = await getCurrentAdminIdToken();
			const response = await fetch(getApiUrl('/api/rebuild-status'), {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${idToken}`,
				},
			});
			const payload = await response.json().catch(() => ({}));
			rawIso = response.ok && payload?.ok ? payload.publishedAt : null;
		} catch (_error) {
			rawIso = null;
		}
	}

	if (!rawIso) {
		statusNode.textContent = 'Dernière publication : jamais';
		return;
	}
	const dt = new Date(rawIso);
	if (Number.isNaN(dt.getTime())) {
		statusNode.textContent = 'Dernière publication : jamais';
		return;
	}
	const formatted = new Intl.DateTimeFormat('fr-FR', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	}).format(dt);
	statusNode.textContent = `Dernière publication le ${formatted.replace(',', ' à')}`;
}

document.getElementById('btn-publish-site')?.addEventListener('click', () => {
	triggerSiteRebuild();
});

// Chargement initial : onglet articles
updateArticleSaveButtonLabel();
syncEventFieldsVisibility();
syncGallerySourceMode();
syncProductImageSourceMode();
updateProductSaveButtonLabel();
renderLastPublishStatus().catch(() => {
	/* no-op: fallback "jamais" deja geré */
});
refreshArticleList();
