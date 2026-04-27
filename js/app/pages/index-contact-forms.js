/**
 * Gestion des formulaires de contact de la page d'accueil :
 * - formulaire auteur -> GAS propriétaire
 * - formulaire maison d'édition -> GAS NomBre7
 */

const CONTACT_ENDPOINT = '/api/contact'
const MIN_SUBMIT_DELAY_MS = 1500
const BUTTON_STATUS_RESET_MS = 2600

/**
 * Génère un identifiant de requête lisible pour tracer les soumissions.
 *
 * 1) But : associer chaque envoi à un identifiant stable côté front.
 * 2) Variables clés :
 *    - nowPart : timestamp court pour l'ordre temporel.
 *    - randPart : aléa pour éviter les collisions.
 * 3) Flux : concatène les deux segments en préfixe `req_`.
 *
 * @returns {string}
 */
function buildRequestId() {
  const nowPart = Date.now().toString(36)
  const randPart = Math.random().toString(36).slice(2, 8)
  return `req_${nowPart}${randPart}`
}

/**
 * Nettoie une valeur texte potentiellement absente.
 *
 * @param {FormDataEntryValue | null} value
 * @returns {string}
 */
function asTrimmedText(value) {
  return String(value || '').trim()
}

/**
 * Valide l'email avec une expression volontairement simple.
 *
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * Récupère la cible de contact depuis l'attribut de formulaire.
 *
 * @param {HTMLFormElement} formEl
 * @returns {'author' | 'publisher' | null}
 */
function readTarget(formEl) {
  const rawTarget = String(formEl.dataset.contactTarget || '').trim()
  if (rawTarget === 'author' || rawTarget === 'publisher') {
    return rawTarget
  }
  return null
}

/**
 * Construit le payload unifié attendu par l'API.
 *
 * 1) But : normaliser les deux formulaires vers un contrat commun.
 * 2) Variables clés :
 *    - target : type de destinataire (author/publisher).
 *    - loadedAt : timestamp initial pour contrôle anti-spam temporel.
 *    - payload : structure stable envoyée à `/api/contact`.
 * 3) Flux : lit les champs, valide les requis, puis retourne les données prêtes à poster.
 *
 * @param {HTMLFormElement} formEl
 * @returns {{ ok: true, payload: any } | { ok: false, message: string }}
 */
function buildPayload(formEl) {
  const target = readTarget(formEl)
  if (!target) {
    return { ok: false, message: 'Configuration de formulaire invalide.' }
  }

  const formData = new FormData(formEl)
  const loadedAt = Number(formData.get('form-loaded-at') || 0)
  const honeypot = asTrimmedText(formData.get('website'))
  const name = asTrimmedText(formData.get(target === 'author' ? 'name' : 'publisher-name'))
  const email = asTrimmedText(formData.get(target === 'author' ? 'email' : 'publisher-email'))
  const subject = asTrimmedText(formData.get(target === 'author' ? 'subject' : 'publisher-subject'))
  const message = asTrimmedText(formData.get(target === 'author' ? 'message' : 'publisher-message'))

  if (honeypot) {
    return { ok: false, message: 'Soumission invalide.' }
  }
  if (!name || !email || !subject || !message) {
    return { ok: false, message: 'Merci de compléter tous les champs requis.' }
  }
  if (!isValidEmail(email)) {
    return { ok: false, message: 'Adresse email invalide.' }
  }
  if (!loadedAt || Date.now() - loadedAt < MIN_SUBMIT_DELAY_MS) {
    return { ok: false, message: 'Merci de patienter une seconde avant l’envoi.' }
  }

  return {
    ok: true,
    payload: {
      formType: target === 'author' ? 'contact_author' : 'contact_publisher',
      target,
      sourcePage: window.location.pathname || '/index.html',
      submittedAt: new Date().toISOString(),
      requestId: buildRequestId(),
      name,
      email,
      subject,
      message,
      consent: true
    }
  }
}

/**
 * Applique l'état "envoi en cours" au bouton de soumission.
 *
 * @param {HTMLFormElement} formEl
 * @param {boolean} pending
 */
function setPendingState(formEl, pending) {
  const submitButton = formEl.querySelector('input[type="submit"]')
  if (!(submitButton instanceof HTMLInputElement)) {
    return
  }
  const defaultLabel = submitButton.dataset.defaultLabel || submitButton.value || 'Envoyer'
  submitButton.disabled = pending
  submitButton.value = pending ? 'Envoi en cours...' : defaultLabel
}

/**
 * Affiche un statut directement dans le bouton de soumission.
 *
 * 1) But : centraliser tous les retours utilisateur (envoi, erreur, succès) dans le bouton.
 * 2) Variables clés :
 *    - submitButton : bouton cible du formulaire.
 *    - resetDelayMs : délai avant retour au libellé par défaut.
 *    - timerKey : stockage du timer pour éviter les collisions d'affichage.
 * 3) Flux : applique le texte de statut -> optionnellement planifie un reset automatique.
 *
 * @param {HTMLFormElement} formEl
 * @param {string} text
 * @param {{ disabled?: boolean, resetDelayMs?: number }} options
 */
function setButtonStatus(formEl, text, options) {
  const submitButton = formEl.querySelector('input[type="submit"]')
  if (!(submitButton instanceof HTMLInputElement)) {
    return
  }
  const defaultLabel = submitButton.dataset.defaultLabel || submitButton.value || 'Envoyer'
  const disabled = Boolean(options && options.disabled)
  const resetDelayMs = Number((options && options.resetDelayMs) || 0)
  const timerKey = '__dvContactButtonTimer'

  const existingTimer = formEl[timerKey]
  if (typeof existingTimer === 'number') {
    window.clearTimeout(existingTimer)
    formEl[timerKey] = null
  }

  submitButton.value = text
  submitButton.disabled = disabled
  if (resetDelayMs > 0) {
    formEl[timerKey] = window.setTimeout(() => {
      submitButton.value = defaultLabel
      submitButton.disabled = false
      formEl[timerKey] = null
    }, resetDelayMs)
  }
}

/**
 * Branche le comportement complet de soumission.
 *
 * 1) But : centraliser validation, anti-spam, appel API et retours UX.
 * 2) Variables clés :
 *    - payloadResult : résultat de la validation/normalisation.
 *    - response : réponse brute de l'API interne.
 *    - responseJson : réponse JSON structurée attendue.
 * 3) Flux :
 *    - bloque les doubles clics,
 *    - valide localement,
 *    - envoie vers `/api/contact`,
 *    - affiche un message succès/erreur puis réinitialise au besoin.
 *
 * @param {HTMLFormElement} formEl
 */
function wireContactForm(formEl) {
  formEl.addEventListener('submit', async (event) => {
    event.preventDefault()

    const payloadResult = buildPayload(formEl)
    if (!payloadResult.ok) {
      setButtonStatus(formEl, payloadResult.message, { resetDelayMs: BUTTON_STATUS_RESET_MS })
      return
    }

    setPendingState(formEl, true)
    try {
      const response = await fetch(CONTACT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadResult.payload)
      })
      const responseJson = await response.json().catch(() => ({}))
      if (!response.ok || !responseJson.ok) {
        const apiMessage = String(responseJson.message || 'Échec lors de l’envoi du message.')
        throw new Error(apiMessage)
      }

      formEl.reset()
      const loadedAtInput = formEl.querySelector('input[name="form-loaded-at"]')
      if (loadedAtInput instanceof HTMLInputElement) {
        loadedAtInput.value = String(Date.now())
      }
      setButtonStatus(formEl, 'Message envoyé', { resetDelayMs: BUTTON_STATUS_RESET_MS })
    } catch (error) {
      const errorLabel = error instanceof Error && error.message ? error.message : 'Erreur d’envoi'
      setButtonStatus(formEl, errorLabel, { resetDelayMs: BUTTON_STATUS_RESET_MS })
    }
  })
}

/**
 * Initialisation des deux formulaires de contact.
 *
 * 1) But : préparer les champs anti-spam et brancher les écouteurs submit.
 * 2) Variables clés :
 *    - forms : liste des formulaires ciblés sur la page d'accueil.
 *    - loadedAtInput : champ caché utilisé pour le contrôle temporel anti-spam.
 * 3) Flux : hydrate les timestamps puis connecte `wireContactForm` sur chaque formulaire.
 */
function initContactForms() {
  const forms = document.querySelectorAll('.dv-index-contact__form')
  for (const formEl of forms) {
    if (!(formEl instanceof HTMLFormElement)) {
      continue
    }
    const loadedAtInput = formEl.querySelector('input[name="form-loaded-at"]')
    if (loadedAtInput instanceof HTMLInputElement) {
      loadedAtInput.value = String(Date.now())
    }
    wireContactForm(formEl)
  }
}

initContactForms()
