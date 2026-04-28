const { preflight } = require('./_cors')

function asText(value) {
	return String(value || '').trim()
}

/**
 * 1) But : vérifier le token Firebase côté serveur pour protéger les actions admin.
 * 2) Variable clé : FIREBASE_WEB_API_KEY pour appeler identitytoolkit.
 * 3) Flux : idToken -> endpoint Google -> extraction UID.
 *
 * @param {string} idToken
 * @returns {Promise<string>}
 */
async function resolveUidFromIdToken(idToken) {
	const firebaseApiKey = asText(process.env.FIREBASE_WEB_API_KEY)
	if (!firebaseApiKey) {
		throw new Error('FIREBASE_WEB_API_KEY manquant.')
	}
	const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(
		firebaseApiKey
	)}`
	const response = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ idToken })
	})
	const json = await response.json().catch(() => ({}))
	if (!response.ok || !json?.users?.[0]?.localId) {
		throw new Error('Token Firebase invalide.')
	}
	return String(json.users[0].localId)
}

function isAllowedAdmin(uid) {
	const allowed = asText(process.env.FIREBASE_ADMIN_UIDS)
		.split(',')
		.map((entry) => entry.trim())
		.filter(Boolean)
	return allowed.includes(uid)
}

/**
 * Valide le payload de campagne.
 *
 * @param {any} body
 * @returns {{ ok: true, action: 'test'|'launch', subject: string, htmlContent: string } | { ok: false, message: string }}
 */
function validatePayload(body) {
	const action = asText(body?.action)
	const subject = asText(body?.subject).slice(0, 255)
	const htmlContent = String(body?.htmlContent || '').trim()
	if (action !== 'test' && action !== 'launch') {
		return { ok: false, message: 'Action newsletter invalide.' }
	}
	if (!subject) {
		return { ok: false, message: 'Objet newsletter requis.' }
	}
	if (!htmlContent) {
		return { ok: false, message: 'Contenu newsletter vide.' }
	}
	return { ok: true, action, subject, htmlContent }
}

/**
 * 1) But : envoyer un test au gestionnaire uniquement.
 * 2) Variables clés : BREVO_NEWSLETTER_MANAGER_EMAIL + sender.
 * 3) Flux : appel SMTP transactional Brevo -> 201 attendu.
 */
async function sendTestEmail(apiKey, sender, managerEmail, subject, htmlContent) {
	const testRes = await fetch('https://api.brevo.com/v3/smtp/email', {
		method: 'POST',
		headers: {
			'api-key': apiKey,
			'Content-Type': 'application/json',
			Accept: 'application/json'
		},
		body: JSON.stringify({
			sender,
			to: [{ email: managerEmail }],
			subject,
			htmlContent
		})
	})
	const json = await testRes.json().catch(() => ({}))
	if (!testRes.ok) {
		const message = asText(json?.message) || 'Envoi test Brevo refusé.'
		throw new Error(message)
	}
}

/**
 * 1) But : créer puis envoyer immédiatement une campagne vers la liste Brevo.
 * 2) Variables clés : listId (liste abonnés), sender (expéditeur), htmlContent.
 * 3) Flux : create campaign -> sendNow -> renvoi campaignId.
 */
async function launchCampaign(apiKey, sender, listId, subject, htmlContent) {
	const createRes = await fetch('https://api.brevo.com/v3/emailCampaigns', {
		method: 'POST',
		headers: {
			'api-key': apiKey,
			'Content-Type': 'application/json',
			Accept: 'application/json'
		},
		body: JSON.stringify({
			name: `Newsletter ${new Date().toISOString()}`,
			subject,
			type: 'classic',
			htmlContent,
			sender,
			recipients: { listIds: [listId] }
		})
	})
	const createJson = await createRes.json().catch(() => ({}))
	if (!createRes.ok || !createJson?.id) {
		const message = asText(createJson?.message) || 'Création de campagne Brevo refusée.'
		throw new Error(message)
	}
	const campaignId = Number(createJson.id)
	const sendRes = await fetch(`https://api.brevo.com/v3/emailCampaigns/${campaignId}/sendNow`, {
		method: 'POST',
		headers: {
			'api-key': apiKey,
			'Content-Type': 'application/json',
			Accept: 'application/json'
		},
		body: JSON.stringify({})
	})
	const sendJson = await sendRes.json().catch(() => ({}))
	if (!sendRes.ok) {
		const message = asText(sendJson?.message) || 'Envoi de campagne Brevo refusé.'
		throw new Error(message)
	}
	return campaignId
}

module.exports = async function handler(req, res) {
	if (preflight(req, res)) {
		return
	}
	if (req.method !== 'POST') {
		return res.status(405).json({ ok: false, message: 'Méthode non autorisée.' })
	}

	// 1) But : route strictement admin (tester/lancer) via token Firebase.
	// 2) Variables clés : Authorization Bearer + FIREBASE_ADMIN_UIDS.
	// 3) Flux : auth -> validation payload -> action test|launch.
	const authHeader = asText(req.headers.authorization || req.headers.Authorization)
	const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
	if (!bearer) {
		return res.status(401).json({ ok: false, message: 'Token manquant.' })
	}
	let uid = ''
	try {
		uid = await resolveUidFromIdToken(bearer)
	} catch (_err) {
		return res.status(401).json({ ok: false, message: 'Authentification invalide.' })
	}
	if (!isAllowedAdmin(uid)) {
		return res.status(403).json({ ok: false, message: 'Accès refusé.' })
	}

	const validated = validatePayload(req.body)
	if (!validated.ok) {
		return res.status(400).json(validated)
	}

	const apiKey = asText(process.env.BREVO_API_KEY)
	const senderEmail = asText(process.env.BREVO_SENDER_EMAIL)
	const senderName = asText(process.env.BREVO_SENDER_NAME || 'Damien Verhée')
	const listId = Number.parseInt(asText(process.env.BREVO_NEWSLETTER_LIST_ID), 10)
	const managerEmail = asText(process.env.BREVO_NEWSLETTER_MANAGER_EMAIL)
	if (!apiKey || !senderEmail) {
		return res.status(500).json({
			ok: false,
			message: 'Configuration Brevo incomplète (BREVO_API_KEY, BREVO_SENDER_EMAIL).'
		})
	}

	try {
		const sender = { email: senderEmail, name: senderName || senderEmail }
		if (validated.action === 'test') {
			if (!managerEmail) {
				return res.status(500).json({
					ok: false,
					message: 'BREVO_NEWSLETTER_MANAGER_EMAIL manquant pour le test.'
				})
			}
			await sendTestEmail(apiKey, sender, managerEmail, validated.subject, validated.htmlContent)
			return res.status(200).json({
				ok: true,
				message: `Email de test envoyé à ${managerEmail}.`
			})
		}

		if (!Number.isFinite(listId) || listId <= 0) {
			return res.status(500).json({
				ok: false,
				message: 'BREVO_NEWSLETTER_LIST_ID manquant ou invalide.'
			})
		}
		const campaignId = await launchCampaign(
			apiKey,
			sender,
			listId,
			validated.subject,
			validated.htmlContent
		)
		return res.status(200).json({
			ok: true,
			message: `Campagne lancée sur Brevo (id: ${campaignId}).`,
			campaignId
		})
	} catch (error) {
		return res.status(502).json({
			ok: false,
			message: `Erreur Brevo: ${asText(error?.message || 'action impossible')}`
		})
	}
}

