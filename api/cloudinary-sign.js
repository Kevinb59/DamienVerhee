const crypto = require('crypto');

function asText(value) {
	return String(value || '').trim();
}

function sanitizePathPart(value) {
	return asText(value)
		.toLowerCase()
		.replace(/[^a-z0-9/_-]/g, '_')
		.replace(/\/{2,}/g, '/')
		.replace(/^\/|\/$/g, '')
		.slice(0, 180);
}

function sanitizeFileName(value) {
	return asText(value)
		.toLowerCase()
		.replace(/\.[a-z0-9]+$/i, '')
		.replace(/[^a-z0-9_-]/g, '_')
		.slice(0, 80);
}

/**
 * Génère une signature Cloudinary conforme (tri alpha des clés, concat key=value avec &).
 *
 * @param {Record<string, string|number|boolean|null|undefined>} params
 * @param {string} apiSecret
 * @returns {{ signature: string, stringToSign: string }}
 */
function signCloudinaryParams(params, apiSecret) {
	const stringToSign = Object.keys(params)
		.sort()
		.filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
		.map((key) => `${key}=${params[key]}`)
		.join('&');
	const signature = crypto.createHash('sha1').update(`${stringToSign}${apiSecret}`).digest('hex');
	return { signature, stringToSign };
}

/**
 * Vérifie le token Firebase via l'API REST Identity Toolkit.
 *
 * 1) But:
 *    - valider côté serveur que l'appel vient d'un utilisateur authentifié.
 * 2) Variables cles:
 *    - firebaseApiKey: clé publique web Firebase (utilisée ici pour lookup sécurisé).
 *    - idToken: JWT Firebase transmis par le client admin.
 * 3) Flux:
 *    - appel accounts:lookup
 *    - extraction localId (UID)
 *    - retour uid pour contrôle d'autorisation
 *
 * @param {string} idToken
 * @returns {Promise<string>}
 */
async function resolveUidFromIdToken(idToken) {
	const firebaseApiKey = asText(process.env.FIREBASE_WEB_API_KEY);
	if (!firebaseApiKey) {
		throw new Error('FIREBASE_WEB_API_KEY manquant.');
	}
	const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseApiKey)}`;
	const response = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ idToken }),
	});
	const json = await response.json().catch(() => ({}));
	if (!response.ok || !json?.users?.[0]?.localId) {
		throw new Error('Token Firebase invalide.');
	}
	return String(json.users[0].localId);
}

/**
 * Vérifie que l'UID est autorisé pour l'administration.
 *
 * @param {string} uid
 * @returns {boolean}
 */
function isAllowedAdmin(uid) {
	const fromEnv = asText(process.env.FIREBASE_ADMIN_UIDS);
	const allowed = fromEnv
		.split(',')
		.map((entry) => entry.trim())
		.filter(Boolean);
	return allowed.includes(uid);
}

/**
 * Point d'entrée Vercel serverless pour générer une signature Cloudinary.
 */
module.exports = async function handler(req, res) {
	if (req.method !== 'POST') {
		return res.status(405).json({ ok: false, message: 'Methode non autorisee.' });
	}

	const cloudName = asText(process.env.CLOUDINARY_CLOUD_NAME);
	const apiKey = asText(process.env.CLOUDINARY_API_KEY);
	const apiSecret = asText(process.env.CLOUDINARY_API_SECRET);
	if (!cloudName || !apiKey || !apiSecret) {
		return res.status(500).json({ ok: false, message: 'Configuration Cloudinary incomplète.' });
	}

	// 1) But: bloquer l'accès à la signature aux seuls admins Firebase.
	// 2) Variables cles: bearer, idToken, uid.
	// 3) Flux: extraire token -> verifier -> comparer UID autorise.
	const authHeader = asText(req.headers.authorization || req.headers.Authorization);
	const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
	if (!bearer) {
		return res.status(401).json({ ok: false, message: 'Token manquant.' });
	}
	let uid = '';
	try {
		uid = await resolveUidFromIdToken(bearer);
	} catch (_error) {
		return res.status(401).json({ ok: false, message: 'Authentification invalide.' });
	}
	if (!isAllowedAdmin(uid)) {
		return res.status(403).json({ ok: false, message: 'Acces refuse.' });
	}

	const folder = sanitizePathPart(req.body?.folder || 'uploads');
	const fileName = sanitizeFileName(req.body?.fileName || 'media');
	const timestamp = Math.floor(Date.now() / 1000);
	const publicId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${fileName}`;
	const resourceType = 'auto';

	const signedParams = {
		folder,
		public_id: publicId,
		timestamp,
	};
	const { signature, stringToSign } = signCloudinaryParams(signedParams, apiSecret);

	return res.status(200).json({
		ok: true,
		cloudName,
		apiKey,
		timestamp,
		signature,
		folder,
		publicId,
		stringToSign,
		uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
	});
};
