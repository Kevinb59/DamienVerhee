/**
 * En-têtes CORS + réponse OPTIONS pour les fonctions `/api/*`.
 *
 * 1) But : éviter les échecs de préflight quand l’admin et l’API ne sont pas strictement same-origin.
 * 2) Variables clés : `Origin` réfléchi (pas `*` avec credentials).
 * 3) Flux : OPTIONS → 204 ; sinon pose les en-têtes et laisse le handler continuer.
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @returns {boolean} true si la requête a été entièrement traitée (OPTIONS).
 */
function preflight(req, res) {
	const origin = String(req.headers.origin || '').trim()
	if (origin) {
		res.setHeader('Access-Control-Allow-Origin', origin)
		res.setHeader('Vary', 'Origin')
	}
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
	res.setHeader(
		'Access-Control-Allow-Headers',
		'Authorization, Content-Type, Accept',
	)
	if (req.method === 'OPTIONS') {
		res.statusCode = 204
		res.end()
		return true
	}
	return false
}

module.exports = { preflight }
