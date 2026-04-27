function asText(value) {
  return String(value || '').trim()
}

/**
 * 1) But : vérifier le token Firebase côté serveur.
 * 2) Variable clé : FIREBASE_WEB_API_KEY pour appeler identitytoolkit.
 * 3) Flux : idToken -> endpoint Google -> extraction UID.
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
  // 1) But : route protégée déclenchant le deploy hook Vercel.
  // 2) Variables clés : Authorization Bearer + VERCEL_DEPLOY_HOOK_URL.
  // 3) Flux : auth Firebase -> check UID admin -> POST hook Vercel.
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Methode non autorisee.' })
  }

  const hookUrl = asText(process.env.VERCEL_DEPLOY_HOOK_URL)
  if (!hookUrl) {
    return res
      .status(500)
      .json({ ok: false, message: 'VERCEL_DEPLOY_HOOK_URL manquant.' })
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
    return res
      .status(401)
      .json({ ok: false, message: 'Authentification invalide.' })
  }
  if (!isAllowedAdmin(uid)) {
    return res.status(403).json({ ok: false, message: 'Acces refuse.' })
  }

  try {
    const hookResponse = await fetch(hookUrl, { method: 'POST' })
    if (!hookResponse.ok) {
      const body = await hookResponse.text().catch(() => '')
      return res.status(502).json({
        ok: false,
        message: 'Echec du deploy hook Vercel.',
        status: hookResponse.status,
        body
      })
    }
    return res.status(200).json({
      ok: true,
      message: 'Rebuild Vercel declenche avec succes.'
    })
  } catch (_error) {
    return res.status(502).json({
      ok: false,
      message: 'Erreur reseau lors du declenchement du rebuild.'
    })
  }
}

