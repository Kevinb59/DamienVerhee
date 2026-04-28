import { getApiUrl } from '../apiBase.js'

const MIN_SUBMIT_DELAY_MS = 1200

/**
 * Valide une adresse e-mail côté client (même règle simple que les autres formulaires).
 *
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim())
}

/**
 * Branche le formulaire newsletter de l’index : envoi vers `/api/newsletter-subscribe` (Brevo).
 *
 * 1) But : inscription sans Firestore ; liste et désabonnement gérés dans Brevo.
 * 2) Variables clés : `form`, champ `#newsletter-email`, zone `#newsletter-form-status`.
 * 3) Flux : submit → fetch POST JSON → message succès / erreur + réinitialisation du bouton.
 */
function setupNewsletterForm() {
	const form = document.getElementById('index-newsletter-form')
	const emailInput = document.getElementById('newsletter-email')
	const statusEl = document.getElementById('newsletter-form-status')
	const submitBtn = form?.querySelector('input[type="submit"], button[type="submit"]')

	if (!form || !emailInput || !statusEl) {
		return
	}

	const loadedAt = Date.now()

	form.addEventListener('submit', async (evt) => {
		evt.preventDefault()
		statusEl.textContent = ''
		statusEl.removeAttribute('data-state')

		const email = String(emailInput.value || '').trim()
		if (!isValidEmail(email)) {
			statusEl.dataset.state = 'error'
			statusEl.textContent = 'Veuillez saisir une adresse e-mail valide.'
			return
		}

		const elapsed = Date.now() - loadedAt
		if (elapsed < MIN_SUBMIT_DELAY_MS) {
			statusEl.dataset.state = 'error'
			statusEl.textContent = 'Merci de patienter un instant avant de valider.'
			return
		}

		const prevDisabled = submitBtn ? submitBtn.disabled : false
		const prevValue = submitBtn && 'value' in submitBtn ? submitBtn.value : ''
		if (submitBtn) {
			submitBtn.disabled = true
			if ('value' in submitBtn) {
				submitBtn.value = 'Envoi…'
			}
		}

		try {
			const res = await fetch(getApiUrl('/api/newsletter-subscribe'), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
				body: JSON.stringify({ email }),
			})
			const data = await res.json().catch(() => ({}))
			if (res.ok && data.ok) {
				statusEl.dataset.state = 'success'
				statusEl.textContent =
					typeof data.message === 'string' ? data.message : 'Inscription enregistrée.'
				emailInput.value = ''
			} else {
				statusEl.dataset.state = 'error'
				statusEl.textContent =
					typeof data.message === 'string'
						? data.message
						: "L'inscription n'a pas abouti. Réessayez plus tard."
			}
		} catch {
			statusEl.dataset.state = 'error'
			statusEl.textContent = 'Erreur réseau. Vérifiez votre connexion.'
		} finally {
			if (submitBtn) {
				submitBtn.disabled = prevDisabled
				if ('value' in submitBtn && prevValue) {
					submitBtn.value = prevValue
				}
			}
		}
	})
}

setupNewsletterForm()
