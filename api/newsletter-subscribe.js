/**
 * API Vercel : inscription newsletter via Brevo (liste + désabonnement gérés côté Brevo).
 */

const { preflight } = require('./_cors')

/**
 * Normalise une adresse email et vérifie un format minimal.
 *
 * @param {unknown} raw
 * @returns {{ ok: true, email: string } | { ok: false, message: string }}
 */
function normalizeEmail(raw) {
	const email = String(raw || '')
		.trim()
		.toLowerCase()
		.slice(0, 254)
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		return { ok: false, message: 'Adresse e-mail invalide.' }
	}
	return { ok: true, email }
}

/**
 * Point d’entrée : POST JSON `{ "email": "…" }` → création / mise à jour du contact Brevo sur la liste configurée.
 *
 * 1) But : ne jamais exposer la clé API Brevo côté navigateur.
 * 2) Variables clés : `BREVO_API_KEY`, `BREVO_NEWSLETTER_LIST_ID` (identifiant numérique de la liste dans Brevo).
 * 3) Flux : OPTIONS CORS → validation email → appel `POST https://api.brevo.com/v3/contacts` avec `updateEnabled: true`.
 */
module.exports = async function handler(req, res) {
	if (preflight(req, res)) {
		return
	}
	if (req.method !== 'POST') {
		return res.status(405).json({ ok: false, message: 'Méthode non autorisée.' })
	}

	const normalized = normalizeEmail(req.body?.email)
	if (!normalized.ok) {
		return res.status(400).json(normalized)
	}

	const apiKey = String(process.env.BREVO_API_KEY || '').trim()
	const listIdRaw = String(process.env.BREVO_NEWSLETTER_LIST_ID || '').trim()
	const listId = Number.parseInt(listIdRaw, 10)
	if (!apiKey || !Number.isFinite(listId) || listId <= 0) {
		return res.status(500).json({
			ok: false,
			message: 'Inscription indisponible : configuration serveur incomplète (Brevo).',
		})
	}

	// Pas d’attributs personnalisés ici : ils doivent exister dans Brevo sinon l’API renvoie une erreur.
	const brevoBody = {
		email: normalized.email,
		listIds: [listId],
		updateEnabled: true,
	}

	try {
		const brevoRes = await fetch('https://api.brevo.com/v3/contacts', {
			method: 'POST',
			headers: {
				'api-key': apiKey,
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
			body: JSON.stringify(brevoBody),
		})

		const brevoJson = await brevoRes.json().catch(() => ({}))

		if (brevoRes.ok) {
			return res.status(200).json({
				ok: true,
				message: 'Merci ! Vous êtes inscrit·e à la newsletter.',
			})
		}

		const brevoMsg =
			typeof brevoJson?.message === 'string'
				? brevoJson.message
				: Array.isArray(brevoJson?.message)
					? brevoJson.message.join(' ')
					: 'Le service d’inscription a refusé la demande.'

		if (brevoRes.status === 400 || brevoRes.status === 409) {
			return res.status(400).json({ ok: false, message: brevoMsg })
		}

		return res.status(502).json({
			ok: false,
			message: 'Inscription momentanément indisponible. Réessayez plus tard.',
		})
	} catch (_err) {
		return res.status(502).json({
			ok: false,
			message: 'Erreur réseau pendant l’inscription.',
		})
	}
}
