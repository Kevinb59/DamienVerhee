/**
 * Transforme une URL de partage (YouTube, Vimeo) en URL utilisable comme src d’iframe embed.
 * Si aucune règle ne correspond, retourne null pour laisser l’appelant utiliser l’URL telle quelle.
 */

/**
 * Extrait l’identifiant vidéo YouTube depuis divers formats d’URL.
 * @param {string} u - URL déjà nettoyée (trim)
 * @returns {string|null}
 */
function extractYouTubeId(u) {
	try {
		const url = new URL(u, 'https://example.com');
		const host = (url.hostname || '').replace(/^www\./, '').replace(/^m\./, '');

		if (host === 'youtu.be') {
			const id = url.pathname.replace(/^\//, '').split('/')[0];
			return id && /^[\w-]{11}$/.test(id) ? id : null;
		}

		if (host.endsWith('youtube.com')) {
			if (url.pathname.startsWith('/embed/')) {
				const id = url.pathname.slice('/embed/'.length).split('/')[0];
				return id && /^[\w-]{11}$/.test(id) ? id : null;
			}
			if (url.pathname.startsWith('/shorts/')) {
				const id = url.pathname.slice('/shorts/'.length).split('/')[0];
				return id && /^[\w-]{11}$/.test(id) ? id : null;
			}
			if (url.pathname === '/watch' || url.pathname.startsWith('/watch')) {
				const v = url.searchParams.get('v');
				return v && /^[\w-]{11}$/.test(v) ? v : null;
			}
		}
	} catch {
		return null;
	}
	return null;
}

/**
 * Extrait l’identifiant Vimeo (numérique) depuis l’URL de la page ou du player.
 * @param {string} u
 * @returns {string|null}
 */
function extractVimeoId(u) {
	try {
		const url = new URL(u, 'https://example.com');
		const host = (url.hostname || '').replace(/^www\./, '');
		if (host === 'vimeo.com') {
			const m = url.pathname.match(/^\/(\d+)/);
			return m ? m[1] : null;
		}
		if (host === 'player.vimeo.com') {
			const m = url.pathname.match(/^\/video\/(\d+)/);
			return m ? m[1] : null;
		}
	} catch {
		return null;
	}
	return null;
}

/**
 * @param {string} input - URL collée par l’utilisateur
 * @returns {string|null} - URL d’embed, ou null si on garde `input` tel quel (ex. iframe déjà en embed, autre domaine)
 */
export function normalizeVideoEmbedUrl(input) {
	const raw = String(input || '').trim();
	if (!raw) {
		return null;
	}

	const yt = extractYouTubeId(raw);
	if (yt) {
		return `https://www.youtube.com/embed/${yt}`;
	}

	const vm = extractVimeoId(raw);
	if (vm) {
		return `https://player.vimeo.com/video/${vm}`;
	}

	return null;
}
