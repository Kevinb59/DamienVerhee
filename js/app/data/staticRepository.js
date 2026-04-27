import { SITE_CONTENT } from './site-content.generated.js'

/**
 * 1) But : fournir un repository 100% lecture pour le site public.
 * 2) Variables clés : SITE_CONTENT généré au build.
 * 3) Flux : chaque lecture clone les données pour éviter les mutations runtime.
 */
function clone(data) {
  return JSON.parse(JSON.stringify(data))
}

function getStaticState() {
  return {
    articles: Array.isArray(SITE_CONTENT.articles) ? SITE_CONTENT.articles : [],
    galleryAlbums: Array.isArray(SITE_CONTENT.galleryAlbums)
      ? SITE_CONTENT.galleryAlbums
      : [],
    galleryItems: Array.isArray(SITE_CONTENT.galleryItems)
      ? SITE_CONTENT.galleryItems
      : [],
    products: Array.isArray(SITE_CONTENT.products) ? SITE_CONTENT.products : []
  }
}

export async function listArticles(opts = {}) {
  const state = getStaticState()
  let list = [...state.articles]
  if (opts.publishedOnly) {
    list = list.filter((a) => a.published)
  }
  list.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
  return clone(list)
}

export async function getArticle(id) {
  const state = getStaticState()
  const item = state.articles.find((a) => a.id === id) || null
  return clone(item)
}

export async function getArticleBySlug(slug) {
  const state = getStaticState()
  const item = state.articles.find((a) => a.slug === slug) || null
  return clone(item)
}

export async function listGalleryAlbums() {
  const state = getStaticState()
  const list = [...state.galleryAlbums].sort(
    (a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)
  )
  return clone(list)
}

export async function listGalleryItems(albumId) {
  const state = getStaticState()
  const list = state.galleryItems
    .filter((i) => i.albumId === albumId)
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
  return clone(list)
}

export async function listProducts(opts = {}) {
  const state = getStaticState()
  let list = [...state.products]
  if (opts.publishedOnly) {
    list = list.filter((p) => p.published)
  }
  list.sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
  return clone(list)
}

export async function getProduct(id) {
  const state = getStaticState()
  const item = state.products.find((p) => p.id === id) || null
  return clone(item)
}

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
  out.sort((x, y) => String(y.articleUpdatedAt).localeCompare(String(x.articleUpdatedAt)))
  return out
}

async function listAllFixedGalleryItemsWithSort() {
  const state = getStaticState()
  const albums = [...state.galleryAlbums].sort(
    (a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)
  )
  const out = []
  let albumIdx = 0
  for (const al of albums) {
    const items = state.galleryItems
      .filter((i) => i.albumId === al.id)
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
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

function readOnlyError() {
  return Promise.reject(
    new Error('Mode public statique: action d’administration non autorisée.')
  )
}

export const saveArticle = () => readOnlyError()
export const deleteArticle = () => readOnlyError()
export const saveGalleryAlbum = () => readOnlyError()
export const deleteGalleryAlbum = () => readOnlyError()
export const saveGalleryItem = () => readOnlyError()
export const deleteGalleryItem = () => readOnlyError()
export const reorderGalleryItems = () => readOnlyError()
export const saveProduct = () => readOnlyError()
export const deleteProduct = () => readOnlyError()
export const uploadMediaAsset = () => readOnlyError()

