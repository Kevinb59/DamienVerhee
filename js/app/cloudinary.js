/**
 * Outils de transformation Cloudinary côté front.
 */

/**
 * Détecte si une URL pointe vers un asset Cloudinary uploadé.
 *
 * @param {string} url
 * @returns {boolean}
 */
function isCloudinaryUploadUrl(url) {
  const raw = String(url || '').trim()
  return /res\.cloudinary\.com\//i.test(raw) && /\/upload\//i.test(raw)
}

/**
 * Injecte ou remplace le bloc de transformation Cloudinary.
 *
 * @param {string} sourceUrl
 * @param {string} transform
 * @returns {string}
 */
function rewriteCloudinaryTransform(sourceUrl, transform) {
  const raw = String(sourceUrl || '').trim()
  if (!isCloudinaryUploadUrl(raw)) {
    return raw
  }
  const marker = '/upload/'
  const markerIndex = raw.indexOf(marker)
  if (markerIndex === -1) {
    return raw
  }

  const beforeUpload = raw.slice(0, markerIndex + marker.length)
  const afterUpload = raw.slice(markerIndex + marker.length)
  const slashIndex = afterUpload.indexOf('/')
  if (slashIndex === -1) {
    return `${beforeUpload}${transform}/${afterUpload}`
  }

  /**
   * 1) Purpose:
   *    - Ne garder qu'un bloc de transformation stable.
   * 2) Key variables:
   *    - firstPathPart: première section après `/upload/`.
   *    - versionLike: détecte un préfixe de version `v123`.
   * 3) Logic flow:
   *    - si la première section est une version => insertion de la transformation avant elle
   *    - sinon => remplacement de la transformation existante
   */
  const firstPathPart = afterUpload.slice(0, slashIndex)
  const remaining = afterUpload.slice(slashIndex + 1)
  const versionLike = /^v\d+$/i.test(firstPathPart)
  if (versionLike) {
    return `${beforeUpload}${transform}/${afterUpload}`
  }
  return `${beforeUpload}${transform}/${remaining}`
}

/**
 * Transformations prédéfinies pour les contextes du site.
 */
export const CLOUDINARY_PRESETS = {
  productCover: 'f_auto,q_auto,dpr_auto,c_fill,g_auto,w_640,h_900',
  articleThumb: 'f_auto,q_auto,dpr_auto,c_fill,g_auto,w_300,h_300',
  galleryThumb: 'f_auto,q_auto,dpr_auto,c_fill,g_auto,w_640,h_640',
  galleryPoster: 'f_auto,q_auto,dpr_auto,c_fill,g_auto,w_1280,h_720',
  articleHero: 'f_auto,q_auto,dpr_auto,c_limit,w_1600,h_1200',
}

/**
 * Retourne une URL optimisée Cloudinary (ou l'URL d'origine si non Cloudinary).
 *
 * @param {string} url
 * @param {string} preset
 * @returns {string}
 */
export function optimizeCloudinaryImage(url, preset) {
  const raw = String(url || '').trim()
  if (!raw || !preset) {
    return raw
  }
  return rewriteCloudinaryTransform(raw, preset)
}
