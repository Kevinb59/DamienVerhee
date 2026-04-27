/**
 * Construction des URLs des routes serverless `/api/*` (Vercel, etc.).
 *
 * 1) But : en local (`file://` ou serveur sans `/api`), pointer vers le déploiement qui expose les fonctions.
 * 2) Variables clés : `window.__API_BASE__` (optionnel, sans slash final).
 * 3) Flux : base vide → chemins relatifs ; sinon `base + path`.
 *
 * @param {string} path - ex. `/api/cloudinary-sign`
 * @returns {string}
 */
export function getApiUrl(path) {
	const p = String(path || '').trim()
	const normalized = p.startsWith('/') ? p : `/${p}`
	const raw =
		typeof window !== 'undefined' && window.__API_BASE__ != null
			? String(window.__API_BASE__).trim()
			: ''
	const base = raw.replace(/\/$/, '')
	return base ? `${base}${normalized}` : normalized
}
