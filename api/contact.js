/**
 * API Vercel : proxy sécurisé vers les Google Apps Script des formulaires contact.
 */

const { preflight } = require('./_cors')

const AUTHOR_EMAIL = 'dverhee74@gmail.com'
const PUBLISHER_EMAIL = 'contact@nombre7.fr'
const ALLOWED_TARGETS = new Set(['author', 'publisher'])

/**
 * Retourne l'URL GAS selon la cible demandée.
 *
 * @param {'author' | 'publisher'} target
 * @returns {string}
 */
function resolveGasUrl(target) {
  return target === 'author'
    ? String(process.env.CONTACT_GAS_URL_AUTHOR || '')
    : String(process.env.CONTACT_GAS_URL_PUBLISHER || '')
}

/**
 * Échappe les caractères sensibles pour la version texte simple.
 *
 * @param {unknown} value
 * @returns {string}
 */
function asSafeText(value) {
  return String(value || '').replace(/[<>"'`]/g, '').trim()
}

/**
 * Vérifie le minimum attendu dans le payload entrant.
 *
 * 1) But : filtrer les requêtes invalides avant d'appeler GAS.
 * 2) Variables clés :
 *    - requiredTextFields : champs texte obligatoires.
 *    - emailRegex : validation email minimale côté serveur.
 *    - sanitized : payload nettoyé et prêt à transmettre.
 * 3) Flux : valide méthode/champs, normalise, puis retourne `ok`/`message`.
 *
 * @param {any} body
 * @returns {{ ok: true, payload: any } | { ok: false, message: string }}
 */
function validateAndNormalize(body) {
  const target = asSafeText(body?.target)
  if (!ALLOWED_TARGETS.has(target)) {
    return { ok: false, message: 'Cible de contact invalide.' }
  }

  const requiredTextFields = ['formType', 'sourcePage', 'submittedAt', 'requestId', 'name', 'email', 'subject', 'message']
  const sanitized = {}
  for (const key of requiredTextFields) {
    const value = asSafeText(body?.[key])
    if (!value) {
      return { ok: false, message: `Champ manquant: ${key}` }
    }
    sanitized[key] = value
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(sanitized.email)) {
    return { ok: false, message: 'Adresse email invalide.' }
  }

  sanitized.target = target
  sanitized.consent = Boolean(body?.consent)
  sanitized.recipientEmail = target === 'author' ? AUTHOR_EMAIL : PUBLISHER_EMAIL
  sanitized.forwardTo = resolveGasUrl(target)
  return { ok: true, payload: sanitized }
}

/**
 * Point d'entrée Vercel serverless.
 *
 * 1) But : protéger les URLs GAS (variables Vercel) et standardiser les réponses.
 * 2) Variables clés :
 *    - normalizedResult : validation serveur du payload front.
 *    - gasUrl : endpoint GAS cible selon author/publisher.
 *    - gasResponseJson : retour structuré du script GAS.
 * 3) Flux :
 *    - accepte POST JSON uniquement,
 *    - valide/sanitise les champs,
 *    - transfère vers le GAS concerné,
 *    - renvoie une réponse uniforme au front.
 */
module.exports = async function handler(req, res) {
  if (preflight(req, res)) {
    return
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Méthode non autorisée.' })
  }

  const normalizedResult = validateAndNormalize(req.body)
  if (!normalizedResult.ok) {
    return res.status(400).json(normalizedResult)
  }

  const gasUrl = normalizedResult.payload.forwardTo
  if (!gasUrl) {
    return res.status(500).json({
      ok: false,
      message: 'Configuration serveur incomplète: URL GAS manquante.'
    })
  }

  const gasPayload = {
    ...normalizedResult.payload,
    serverReceivedAt: new Date().toISOString()
  }

  try {
    const gasResponse = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gasPayload)
    })
    const gasResponseJson = await gasResponse.json().catch(() => ({}))
    if (!gasResponse.ok || gasResponseJson.ok === false) {
      const message = String(gasResponseJson.message || 'Le service de contact est momentanément indisponible.')
      return res.status(502).json({ ok: false, message })
    }

    return res.status(200).json({
      ok: true,
      message: 'Message transmis avec succès.',
      requestId: normalizedResult.payload.requestId,
      status: 'received'
    })
  } catch (_error) {
    return res.status(502).json({
      ok: false,
      message: 'Erreur réseau pendant la transmission du message.'
    })
  }
}
