/**
 * Miniatures vidéo (YouTube / Vimeo) sans passer par Cloudinary.
 *
 * 1) But : éviter d’utiliser une URL d’embed comme `src` d’une balise img (icône cassée).
 * 2) Variables clés : URL vidéo, éventuelle thumb explicite côté BDD.
 * 3) Flux : thumb image plausible -> sinon dérivation depuis l’URL vidéo.
 */

/**
 * Indique si l’URL peut raisonnablement servir de miniature image.
 *
 * @param {string} url
 * @returns {boolean}
 */
export function isPlausibleImageThumbUrl(url) {
  const s = String(url || '').trim()
  if (!s) {
    return false
  }
  if (/youtube\.com\/embed|youtu\.be|youtube\.com\/watch|vimeo\.com\/|player\.vimeo\.com/i.test(s)) {
    return false
  }
  if (/\.(jpe?g|png|webp|gif|bmp|svg)(\?|#|$)/i.test(s)) {
    return true
  }
  if (/res\.cloudinary\.com\/.+\/image\//i.test(s)) {
    return true
  }
  return false
}

/**
 * @param {string} url
 * @returns {string}
 */
export function extractYouTubeId(url) {
  const raw = String(url || '').trim()
  const patterns = [
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/i,
    /youtube\.com\/watch\?[^#]*v=([a-zA-Z0-9_-]{6,})/i,
    /youtu\.be\/([a-zA-Z0-9_-]{6,})/i
  ]
  for (const re of patterns) {
    const m = raw.match(re)
    if (m?.[1]) {
      return m[1]
    }
  }
  return ''
}

/**
 * @param {string} url
 * @returns {string}
 */
export function extractVimeoId(url) {
  const raw = String(url || '').trim()
  const m =
    raw.match(/vimeo\.com\/(?:video\/)?(\d{6,})/i) ||
    raw.match(/player\.vimeo\.com\/video\/(\d{6,})/i)
  return m?.[1] || ''
}

/**
 * URL d’image de prévisualisation pour une vidéo (embed ou fichier).
 *
 * @param {string} videoUrl
 * @param {string} [explicitThumb]
 * @returns {string}
 */
export function resolveVideoPosterUrl(videoUrl, explicitThumb) {
  const thumb = String(explicitThumb || '').trim()
  if (thumb && isPlausibleImageThumbUrl(thumb)) {
    return thumb
  }
  const sources = [String(videoUrl || '').trim(), thumb]
  for (const src of sources) {
    if (!src) {
      continue
    }
    const ytId = extractYouTubeId(src)
    if (ytId) {
      return `https://img.youtube.com/vi/${encodeURIComponent(ytId)}/hqdefault.jpg`
    }
    const vimeoId = extractVimeoId(src)
    if (vimeoId) {
      return `https://vumbnail.com/${encodeURIComponent(vimeoId)}.jpg`
    }
  }
  return ''
}
