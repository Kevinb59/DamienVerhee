/**
 * Gestion des formulaires de contact de la page d'accueil :
 * - formulaire auteur -> GAS propriétaire
 * - formulaire maison d'édition -> GAS NomBre7
 */

const CONTACT_ENDPOINT = '/api/contact'
const MIN_SUBMIT_DELAY_MS = 1500

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
 * Met à jour le message de statut sous un formulaire.
 *
 * @param {HTMLFormElement} formEl
 * @param {string} text
 * @param {'success' | 'error' | 'neutral'} type
 */
function setStatus(formEl, text, type) {
  const statusEl = formEl.querySelector('.dv-contact-status')
  if (!(statusEl instanceof HTMLElement)) {
    return
  }
  statusEl.textContent = text
  statusEl.classList.remove('is-success', 'is-error')
  if (type === 'success') {
    statusEl.classList.add('is-success')
  } else if (type === 'error') {
    statusEl.classList.add('is-error')
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
    setStatus(formEl, '', 'neutral')

    const payloadResult = buildPayload(formEl)
    if (!payloadResult.ok) {
      setStatus(formEl, payloadResult.message, 'error')
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
      setStatus(formEl, 'Votre message a bien été envoyé.', 'success')
    } catch (error) {
      setStatus(formEl, error instanceof Error ? error.message : 'Erreur réseau. Réessayez dans un instant.', 'error')
    } finally {
      setPendingState(formEl, false)
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
