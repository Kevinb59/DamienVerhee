function asText(value) {
	const raw = String(value || '').trim();
	const quoted =
		(raw.startsWith('"') && raw.endsWith('"')) ||
		(raw.startsWith("'") && raw.endsWith("'"));
	return quoted ? raw.slice(1, -1).trim() : raw;
}

/**
 * Vérifie les credentials Cloudinary via l'endpoint ping (auth basic API key/secret).
 * Cette route n'expose jamais le secret; elle sert uniquement au diagnostic.
 */
module.exports = async function handler(req, res) {
	if (req.method !== 'GET') {
		return res.status(405).json({ ok: false, message: 'Methode non autorisee.' });
	}

	const cloudName = asText(process.env.CLOUDINARY_CLOUD_NAME);
	const apiKey = asText(process.env.CLOUDINARY_API_KEY);
	const apiSecret = asText(process.env.CLOUDINARY_API_SECRET);
	if (!cloudName || !apiKey || !apiSecret) {
		return res.status(500).json({
			ok: false,
			message: 'Variables Cloudinary manquantes.',
			hasCloudName: !!cloudName,
			hasApiKey: !!apiKey,
			hasApiSecret: !!apiSecret,
		});
	}

	const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
	const url = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/ping`;
	const response = await fetch(url, {
		method: 'GET',
		headers: {
			Authorization: `Basic ${auth}`,
		},
	});
	const json = await response.json().catch(() => ({}));

	if (!response.ok) {
		return res.status(502).json({
			ok: false,
			message: 'Credentials Cloudinary invalides ou incoherents.',
			status: response.status,
			cloudName,
			apiKeySuffix: apiKey.slice(-6),
			upstream: json,
		});
	}

	return res.status(200).json({
		ok: true,
		message: 'Credentials Cloudinary valides.',
		cloudName,
		apiKeySuffix: apiKey.slice(-6),
		upstream: json,
	});
};
