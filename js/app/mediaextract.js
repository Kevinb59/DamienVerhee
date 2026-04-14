/**
 * Extraction des médias présents dans le HTML produit par l’éditeur (images / vidéos).
 * Sert à alimenter la galerie dynamique sans dupliquer manuellement chaque fichier.
 *
 * @param {string} html - Fragment HTML (corps d’article)
 * @returns {Array<{ type: 'image'|'video', url: string, thumbUrl: string }>}
 */
export function extractMediaFromHtml(html) {
  if (!html || typeof html !== 'string') {
    return []
  }

  const div = document.createElement('div')
  div.innerHTML = html
  const seen = new Set()
  const out = []

  // Images : src directes
  div.querySelectorAll('img[src]').forEach((img) => {
    const url = img.getAttribute('src') || ''
    if (url && !seen.has(url)) {
      seen.add(url)
      out.push({ type: 'image', url, thumbUrl: url })
    }
  })

  // Vidéos : balise video (src ou source enfant)
  div.querySelectorAll('video').forEach((video) => {
    let url = video.getAttribute('src') || ''
    if (!url) {
      const srcEl = video.querySelector('source[src]')
      url = srcEl ? srcEl.getAttribute('src') || '' : ''
    }
    const poster = video.getAttribute('poster') || url
    if (url && !seen.has(url)) {
      seen.add(url)
      out.push({ type: 'video', url, thumbUrl: poster || url })
    }
  })

  // iframes type YouTube/Vimeo (aperçu lien)
  div.querySelectorAll('iframe[src]').forEach((frame) => {
    const url = frame.getAttribute('src') || ''
    if (url && !seen.has(url)) {
      seen.add(url)
      out.push({ type: 'video', url, thumbUrl: url })
    }
  })

  return out
}

/**
 * Fusionne les médias extraits du HTML avec la liste éditoriale (sans doublons d’URL).
 *
 * @param {Array<{ url: string, type?: string, thumbUrl?: string, caption?: string, id?: string }>} editorial
 * @param {Array<{ url: string, type: string, thumbUrl: string }>} fromHtml
 * @returns {Array<{ id: string, type: 'image'|'video', url: string, thumbUrl: string, caption: string }>}
 */
export function mergeArticleMedia(editorial, fromHtml) {
  const byUrl = new Map()

  const add = (m, isEditorial) => {
    const url = m.url
    if (!url || byUrl.has(url)) {
      return
    }
    const id = m.id || `m_${byUrl.size}_${url.slice(-8)}`
    byUrl.set(url, {
      id,
      type: m.type === 'video' ? 'video' : 'image',
      url,
      thumbUrl: m.thumbUrl || url,
      caption: isEditorial ? m.caption || '' : ''
    })
  }

  ;(editorial || []).forEach((m) => add(m, true))
  ;(fromHtml || []).forEach((m) => add(m, false))

  return Array.from(byUrl.values())
}
