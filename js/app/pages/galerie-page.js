/**
 * Galerie publique : flux unique de miniatures (médias articles + albums fixes).
 */
import { listDynamicGalleryItems, listGalleryAlbums, listGalleryItems } from '../store.js'
import { initMediaModal } from '../ui/mediaModal.js'
import { CLOUDINARY_PRESETS, optimizeCloudinaryImage } from '../cloudinary.js'

function esc(s) {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
} 

const ALBUM_ALL = '__all__'
const ALBUM_ARTICLES = '__articles__'

/**
 * Rend uniquement les miniatures carrées (sans descriptions).
 *
 * @param {Array<{ type: string, url: string, thumbUrl?: string }>} items
 * @returns {string}
 */
function renderThumbs(items) {
  return items
    .map((m) => {
      const type = m.type === 'video' ? 'video' : 'image'
      const optimizedMediaUrl =
        type === 'video'
          ? optimizeCloudinaryImage(m.url, CLOUDINARY_PRESETS.galleryPoster)
          : optimizeCloudinaryImage(m.url, CLOUDINARY_PRESETS.articleHero)
      const optimizedThumb = optimizeCloudinaryImage(
        m.thumbUrl || m.url,
        CLOUDINARY_PRESETS.galleryThumb
      )
      const u = JSON.stringify(optimizedMediaUrl)
      const t = JSON.stringify(optimizedThumb)
      return `
			<button type="button" class="dv-media-thumb" data-media-modal data-media-type="${type}" data-media-url=${u}>
				${type === 'video' ? `<video src=${u} muted playsinline preload="metadata"></video><span class="dv-media-thumb__play">▶</span>` : `<img src=${t} alt="" loading="lazy" decoding="async" />`}
			</button>`
    })
    .join('')
}

/**
 * Construit la liste combinée des médias (articles + albums fixes) avec métadonnées de tri/filtre.
 *
 * @returns {Promise<Array<{ type: 'image'|'video', url: string, thumbUrl: string, sortAt: string, albumId: string, albumLabel: string }>>}
 */
async function loadCombinedMedia() {
  const out = []

  // 1) Bloc dynamique : "Articles" = album virtuel unique pour tous les médias extraits d’articles.
  const dynamicItems = await listDynamicGalleryItems()
  dynamicItems.forEach((m) => {
    out.push({
      type: m.type === 'video' ? 'video' : 'image',
      url: m.url,
      thumbUrl: m.thumbUrl || m.url,
      sortAt: String(m.articleUpdatedAt || ''),
      albumId: ALBUM_ARTICLES,
      albumLabel: 'Articles'
    })
  })

  // 2) Bloc fixe : chaque album conserve son identité pour le filtre "Album".
  const albums = await listGalleryAlbums()
  for (const album of albums) {
    const items = await listGalleryItems(album.id)
    items.forEach((m, idx) => {
      out.push({
        type: m.type === 'video' ? 'video' : 'image',
        url: m.url,
        thumbUrl: m.thumbUrl || m.url,
        sortAt: String(m.addedAt || `2000-01-01T00:00:${String(idx).padStart(2, '0')}Z`),
        albumId: album.id,
        albumLabel: album.title
      })
    })
  }
  return out
}

/**
 * Recalcule l’affichage selon le tri et l’album choisis.
 *
 * @param {Array<any>} allMedia
 * @param {HTMLSelectElement} albumSelect
 * @param {HTMLSelectElement} sortSelect
 * @param {HTMLElement} root
 */
function renderFilteredGrid(allMedia, albumSelect, sortSelect, root) {
  const selectedAlbum = albumSelect.value || ALBUM_ALL
  const selectedSort = sortSelect.value || 'newest'

  let filtered = allMedia
  if (selectedAlbum !== ALBUM_ALL) {
    filtered = filtered.filter((m) => m.albumId === selectedAlbum)
  }

  filtered = [...filtered].sort((a, b) => {
    const cmp = String(a.sortAt).localeCompare(String(b.sortAt))
    return selectedSort === 'oldest' ? cmp : -cmp
  })

  root.innerHTML = filtered.length
    ? `<div class="dv-media-grid">${renderThumbs(filtered)}</div>`
    : '<p>Aucun média pour ce filtre.</p>'

  initMediaModal()
}

async function init() {
  const root = document.getElementById('gallery-grid-root')
  const albumSelect = document.getElementById('gallery-album-select')
  const sortSelect = document.getElementById('gallery-sort-select')
  if (!root || !albumSelect || !sortSelect) {
    return
  }

  root.innerHTML = '<p>Chargement…</p>'
  const allMedia = await loadCombinedMedia()

  // 1) Sources d’album : "Tous" + "Articles" + albums fixes (ordre admin).
  const options = [
    { value: ALBUM_ALL, label: 'Tous les médias' },
    { value: ALBUM_ARTICLES, label: 'Articles' }
  ]
  const fixedAlbums = await listGalleryAlbums()
  fixedAlbums.forEach((a) => {
    options.push({ value: a.id, label: a.title })
  })
  albumSelect.innerHTML = options
    .map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`)
    .join('')

  // 2) État initial demandé : toutes les miniatures, tri du plus récent au plus ancien.
  albumSelect.value = ALBUM_ALL
  sortSelect.value = 'newest'
  renderFilteredGrid(allMedia, albumSelect, sortSelect, root)

  albumSelect.addEventListener('change', () => {
    renderFilteredGrid(allMedia, albumSelect, sortSelect, root)
  })
  sortSelect.addEventListener('change', () => {
    renderFilteredGrid(allMedia, albumSelect, sortSelect, root)
  })
}

init()
