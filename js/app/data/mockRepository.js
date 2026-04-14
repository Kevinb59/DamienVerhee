/**
 * Fausse BDD en mémoire (aucun localStorage) : même schéma que Firestore pour un remplacement direct via store.js → firebaseRepository.
 * Au chargement de la page, l’état est reconstruit depuis les modules seed (catalogDamienVerhee, etc.). Les CRUD admin ne survivent pas au F5.
 */

import { getDefaultProducts } from './catalogDamienVerhee.js'
import { getSeedArticles } from './seedArticlesFictifs.js'

/**
 * État runtime unique (session navigateur). Réinitialisé à chaque rechargement.
 * @type {{ articles: ArticleRecord[], galleryAlbums: GalleryAlbumRecord[], galleryItems: GalleryItemRecord[], products: ProductRecord[] }|null}
 */
let memState = null

/**
 * @typedef {Object} ArticleRecord
 * @property {string} id
 * @property {string} title
 * @property {string} slug
 * @property {string} excerpt
 * @property {string} summaryLine - accroche une ligne (accueil uniquement, pas la page article)
 * @property {string} bodyHtml
 * @property {boolean} published
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {boolean} isEvent
 * @property {string|null} eventDate
 * @property {string|null} eventTime
 * @property {string|null} eventEndDate
 * @property {string|null} eventEndTime
 * @property {string} eventLocation
 * @property {Array<{ id: string, type: 'image'|'video', url: string, thumbUrl: string, caption?: string }>} media
 */

/**
 * @typedef {Object} GalleryAlbumRecord
 * @property {string} id
 * @property {string} title
 * @property {number} sortOrder
 */

/**
 * @typedef {Object} GalleryItemRecord
 * @property {string} id
 * @property {string} albumId
 * @property {'image'|'video'} type
 * @property {string} url
 * @property {string} thumbUrl
 * @property {string} caption
 * @property {number} sortOrder
 * @property {string} [addedAt] - ISO date pour trier les médias fixes avec les dynamiques
 */

/**
 * @typedef {Object} ProductRecord
 * @property {string} id
 * @property {string} title
 * @property {string} imageUrl
 * @property {string} synopsis
 * @property {number} priceCents
 * @property {string} currency
 * @property {boolean} promo
 * @property {number|null} priceBeforePromoCents
 * @property {string} sumupUrl
 * @property {boolean} published
 * @property {number} sortOrder
 */

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function nowIso() {
  return new Date().toISOString()
}

/**
 * Déduit le type logique de média depuis le MIME.
 *
 * @param {File} file
 * @returns {'image'|'video'}
 */
function detectMediaKind(file) {
  const mime = String(file?.type || '').toLowerCase()
  return mime.startsWith('video/') ? 'video' : 'image'
}

/**
 * Lit un fichier local en DataURL (mode mock, sans persistance serveur).
 *
 * 1) But : simuler l’upload pour garder le même flux UI que Firebase.
 * 2) Variables clés :
 *    - file : fichier sélectionné dans l’admin.
 *    - result : URL data:* exploitable partout (img/video/iframe source vidéo).
 * 3) Flux :
 *    - FileReader lit le blob
 *    - resolve avec l’URL encodée
 *
 * @param {File} file
 * @returns {Promise<string>}
 */
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'))
    reader.readAsDataURL(file)
  })
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
  )
}

/**
 * Clone profond pour éviter de muter les exports des modules seed par référence.
 *
 * @template T
 * @param {T} obj
 * @returns {T}
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

/**
 * Fabrique l’état initial : données statiques éditables dans js/app/data/*.js (puis Firebase).
 *
 * @returns {{ articles: ArticleRecord[], galleryAlbums: GalleryAlbumRecord[], galleryItems: GalleryItemRecord[], products: ProductRecord[] }}
 */
function createInitialState() {
  return {
    // Articles fictifs (sans événements) : seedArticlesFictifs.js — médias `images/pic*.jpg`
    articles: deepClone(getSeedArticles()),
    galleryAlbums: [
      { id: 'seed_album_dedicaces', title: 'Photos de dédicaces', sortOrder: 0 }
    ],
    galleryItems: [],
    // Boutique : catalogue dans catalogDamienVerhee.js (même forme que collection Firestore `products`).
    products: deepClone(getDefaultProducts())
  }
}

/**
 * Retourne l’état mémoire, initialisé une fois par cycle de vie de la page.
 */
function ensureState() {
  if (!memState) {
    memState = createInitialState()
  }
  return memState
}

// ——— Articles ———

/**
 * @param {{ publishedOnly?: boolean }} [opts]
 * @returns {Promise<ArticleRecord[]>}
 */
export async function listArticles(opts = {}) {
  const state = ensureState()
  let list = [...state.articles]
  if (opts.publishedOnly) {
    list = list.filter((a) => a.published)
  }
  list.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
  return list
}

/**
 * @param {string} id
 * @returns {Promise<ArticleRecord|null>}
 */
export async function getArticle(id) {
  const state = ensureState()
  return state.articles.find((a) => a.id === id) || null
}

/**
 * @param {string} slug
 * @returns {Promise<ArticleRecord|null>}
 */
export async function getArticleBySlug(slug) {
  const state = ensureState()
  return state.articles.find((a) => a.slug === slug) || null
}

/**
 * Garantit un slug unique parmi les articles (hors id courant).
 *
 * @param {ArticleRecord[]} articles
 * @param {string} baseSlug
 * @param {string} [exceptId]
 * @returns {string}
 */
function uniqueSlug(articles, baseSlug, exceptId) {
  let slug = baseSlug || 'article'
  let n = 0
  while (articles.some((a) => a.slug === slug && a.id !== exceptId)) {
    n += 1
    slug = `${baseSlug}-${n}`
  }
  return slug
}

/**
 * @param {Partial<ArticleRecord> & { title?: string }} article
 * @returns {Promise<ArticleRecord>}
 */
export async function saveArticle(article) {
  const state = ensureState()
  const t = nowIso()
  let record

  if (article.id) {
    const idx = state.articles.findIndex((a) => a.id === article.id)
    if (idx === -1) {
      throw new Error('Article introuvable')
    }
    const prev = state.articles[idx]
    record = {
      ...prev,
      ...article,
      createdAt: prev.createdAt,
      updatedAt: t
    }
    if (article.summaryLine === undefined) {
      record.summaryLine = prev.summaryLine ?? ''
    }
    if (article.title != null) {
      record.slug = uniqueSlug(
        state.articles,
        slugify(article.title),
        record.id
      )
    }
    state.articles[idx] = record
  } else {
    record = {
      id: newId(),
      title: article.title || 'Sans titre',
      slug: uniqueSlug(state.articles, slugify(article.title || 'sans-titre')),
      excerpt: article.excerpt || '',
      summaryLine:
        article.summaryLine != null ? String(article.summaryLine) : '',
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
      media: Array.isArray(article.media) ? article.media : []
    }
    state.articles.push(record)
  }

  return record
}

/**
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteArticle(id) {
  const state = ensureState()
  state.articles = state.articles.filter((a) => a.id !== id)
}

// ——— Galerie fixe ———

/**
 * @returns {Promise<GalleryAlbumRecord[]>}
 */
export async function listGalleryAlbums() {
  const state = ensureState()
  const list = [...state.galleryAlbums]
  list.sort((a, b) => a.sortOrder - b.sortOrder)
  return list
}

/**
 * @param {Partial<GalleryAlbumRecord> & { title?: string }} album
 * @returns {Promise<GalleryAlbumRecord>}
 */
export async function saveGalleryAlbum(album) {
  const state = ensureState()
  let record
  if (album.id) {
    const idx = state.galleryAlbums.findIndex((x) => x.id === album.id)
    if (idx === -1) {
      throw new Error('Album introuvable')
    }
    record = { ...state.galleryAlbums[idx], ...album }
    state.galleryAlbums[idx] = record
  } else {
    const maxOrder = state.galleryAlbums.reduce(
      (m, x) => Math.max(m, x.sortOrder),
      -1
    )
    record = {
      id: newId(),
      title: album.title || 'Nouvel album',
      sortOrder: maxOrder + 1
    }
    state.galleryAlbums.push(record)
  }
  return record
}

/**
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteGalleryAlbum(id) {
  const state = ensureState()
  state.galleryAlbums = state.galleryAlbums.filter((a) => a.id !== id)
  state.galleryItems = state.galleryItems.filter((i) => i.albumId !== id)
}

/**
 * @param {string} albumId
 * @returns {Promise<GalleryItemRecord[]>}
 */
export async function listGalleryItems(albumId) {
  const state = ensureState()
  let list = state.galleryItems.filter((i) => i.albumId === albumId)
  list.sort((a, b) => a.sortOrder - b.sortOrder)
  return list
}

/**
 * @param {Partial<GalleryItemRecord> & { albumId?: string, url?: string }} item
 * @returns {Promise<GalleryItemRecord>}
 */
export async function saveGalleryItem(item) {
  const state = ensureState()
  if (!item.albumId) {
    throw new Error('albumId requis')
  }
  let record
  if (item.id) {
    const idx = state.galleryItems.findIndex((x) => x.id === item.id)
    if (idx === -1) {
      throw new Error('Élément introuvable')
    }
    record = { ...state.galleryItems[idx], ...item }
    state.galleryItems[idx] = record
  } else {
    const inAlbum = state.galleryItems.filter((i) => i.albumId === item.albumId)
    const maxOrder = inAlbum.reduce((m, x) => Math.max(m, x.sortOrder), -1)
    record = {
      id: newId(),
      albumId: item.albumId,
      type: item.type === 'video' ? 'video' : 'image',
      url: item.url || '',
      thumbUrl: item.thumbUrl || item.url || '',
      caption: item.caption || '',
      sortOrder: maxOrder + 1,
      addedAt: nowIso()
    }
    state.galleryItems.push(record)
  }
  return record
}

/**
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteGalleryItem(id) {
  const state = ensureState()
  state.galleryItems = state.galleryItems.filter((i) => i.id !== id)
}

/**
 * Réordonne les médias d’un album fixe (ids dans l’ordre souhaité).
 *
 * @param {string} albumId
 * @param {string[]} orderedIds
 * @returns {Promise<void>}
 */
export async function reorderGalleryItems(albumId, orderedIds) {
  const state = ensureState()
  orderedIds.forEach((gid, index) => {
    const it = state.galleryItems.find(
      (i) => i.id === gid && i.albumId === albumId
    )
    if (it) {
      it.sortOrder = index
    }
  })
}

// ——— Boutique ———

/**
 * @param {{ publishedOnly?: boolean }} [opts]
 * @returns {Promise<ProductRecord[]>}
 */
export async function listProducts(opts = {}) {
  const state = ensureState()
  let list = [...state.products]
  if (opts.publishedOnly) {
    list = list.filter((p) => p.published)
  }
  list.sort((a, b) => a.sortOrder - b.sortOrder)
  return list
}

/**
 * @param {string} id
 * @returns {Promise<ProductRecord|null>}
 */
export async function getProduct(id) {
  const state = ensureState()
  return state.products.find((p) => p.id === id) || null
}

/**
 * @param {Partial<ProductRecord>} product
 * @returns {Promise<ProductRecord>}
 */
export async function saveProduct(product) {
  const state = ensureState()
  let record
  if (product.id) {
    const idx = state.products.findIndex((p) => p.id === product.id)
    if (idx === -1) {
      throw new Error('Produit introuvable')
    }
    record = { ...state.products[idx], ...product }
    if (record.promo) {
      record.priceBeforePromoCents =
        record.priceBeforePromoCents != null
          ? Number(record.priceBeforePromoCents)
          : null
    } else {
      record.priceBeforePromoCents = null
    }
    record.priceCents = Number(record.priceCents) || 0
    state.products[idx] = record
  } else {
    const maxOrder = state.products.reduce(
      (m, x) => Math.max(m, x.sortOrder),
      -1
    )
    record = {
      id: newId(),
      title: product.title || 'Produit',
      imageUrl: product.imageUrl || '',
      synopsis: product.synopsis || '',
      priceCents: Number(product.priceCents) || 0,
      currency: product.currency || 'EUR',
      promo: !!product.promo,
      priceBeforePromoCents: product.promo
        ? Number(product.priceBeforePromoCents) || null
        : null,
      sumupUrl: product.sumupUrl || '#',
      published: product.published !== false,
      sortOrder: maxOrder + 1
    }
    state.products.push(record)
  }
  return record
}

/**
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteProduct(id) {
  const state = ensureState()
  state.products = state.products.filter((p) => p.id !== id)
}

/**
 * Médias dynamiques : fusion de tous les `article.media`, tri par date d’article décroissante.
 *
 * @returns {Promise<Array<GalleryItemRecord & { articleId: string, articleTitle: string, articleUpdatedAt: string }>>}
 */
export async function listDynamicGalleryItems() {
  const articles = await listArticles({ publishedOnly: true })
  const out = []
  for (const a of articles) {
    const medias = Array.isArray(a.media) ? a.media : []
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
        articleUpdatedAt: a.updatedAt
      })
    }
  }
  out.sort((x, y) =>
    String(y.articleUpdatedAt).localeCompare(String(x.articleUpdatedAt))
  )
  return out
}

/**
 * Médias fixes de tous les albums, avec date de tri (addedAt ou repli stable).
 *
 * @returns {Promise<Array<GalleryItemRecord & { sortAt: string }>>}
 */
export async function listAllFixedGalleryItemsWithSort() {
  const state = ensureState()
  const albums = [...state.galleryAlbums].sort(
    (a, b) => a.sortOrder - b.sortOrder
  )
  const out = []
  let albumIdx = 0
  for (const al of albums) {
    const items = state.galleryItems
      .filter((i) => i.albumId === al.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    let itemIdx = 0
    for (const it of items) {
      const sortAt =
        it.addedAt || new Date(2000, 0, 1 + albumIdx, 0, itemIdx).toISOString()
      out.push({ ...it, sortAt })
      itemIdx += 1
    }
    albumIdx += 1
  }
  return out
}

/**
 * Les `limit` médias les plus récents (articles + galerie fixe), pour diaporama d’accueil.
 *
 * @param {number} [limit]
 * @returns {Promise<Array<{ source: 'dynamic'|'fixed', sortAt: string, type: string, url: string, thumbUrl: string, articleId?: string, articleSlug?: string, articleTitle?: string, articleExcerpt?: string }>>}
 */
export async function listLatestCombinedGalleryMedia(limit = 10) {
  const dynamic = await listDynamicGalleryItems()
  const fixed = await listAllFixedGalleryItemsWithSort()

  const dynSlides = dynamic.map((d) => ({
    source: 'dynamic',
    sortAt: d.articleUpdatedAt,
    type: d.type,
    url: d.url,
    thumbUrl: d.thumbUrl || d.url,
    articleId: d.articleId,
    articleSlug: d.articleSlug,
    articleTitle: d.articleTitle,
    articleExcerpt: d.articleExcerpt || ''
  }))

  const fixSlides = fixed.map((f) => ({
    source: 'fixed',
    sortAt: f.sortAt,
    type: f.type,
    url: f.url,
    thumbUrl: f.thumbUrl || f.url
  }))

  const merged = [...dynSlides, ...fixSlides].sort((a, b) =>
    String(b.sortAt).localeCompare(String(a.sortAt))
  )
  return merged.slice(0, limit)
}

/**
 * Upload média (mock) : retourne une DataURL + type détecté.
 *
 * @param {File} file
 * @returns {Promise<{ url: string, kind: 'image'|'video' }>}
 */
export async function uploadMediaAsset(file) {
  if (!(file instanceof File)) {
    throw new Error('Aucun fichier valide à envoyer.')
  }
  const url = await readFileAsDataUrl(file)
  return {
    url,
    kind: detectMediaKind(file)
  }
}
