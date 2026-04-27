const { getFirestoreAdmin } = require('./_firebase-admin')
const { preflight } = require('./_cors')

function asText(value) {
  return String(value || '').trim()
}

/**
 * 1) But : vérifier le token Firebase côté serveur.
 * 2) Variable clé : FIREBASE_WEB_API_KEY.
 * 3) Flux : idToken -> identitytoolkit -> extraction UID.
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

module.exports = async function handler(req, res) {
  if (preflight(req, res)) {
    return
  }
  // 1) But : renvoyer la dernière publication partagée (serveur) pour l'admin.
  // 2) Variables clés : token admin + doc meta/sitePublication.
  // 3) Flux : auth -> lecture Firestore -> réponse JSON uniformisée.
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, message: 'Methode non autorisee.' })
  }

  const authHeader = asText(req.headers.authorization || req.headers.Authorization)
  const bearer = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : ''
  if (!bearer) {
    return res.status(401).json({ ok: false, message: 'Token manquant.' })
  }

  let uid = ''
  try {
    uid = await resolveUidFromIdToken(bearer)
  } catch (_error) {
    return res.status(401).json({ ok: false, message: 'Authentification invalide.' })
  }
  if (!isAllowedAdmin(uid)) {
    return res.status(403).json({ ok: false, message: 'Acces refuse.' })
  }

  try {
    const db = getFirestoreAdmin()
    const doc = await db.collection('meta').doc('sitePublication').get()
    const data = doc.exists ? doc.data() || {} : {}
    return res.status(200).json({
      ok: true,
      publishedAt: asText(data.publishedAt) || null,
      publishedByUid: asText(data.publishedByUid) || null
    })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: `Lecture statut publication impossible. ${String(
        error?.message || ''
      ).trim()}`
    })
  }
}

