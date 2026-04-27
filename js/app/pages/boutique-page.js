/**
 * Liste produits boutique : affichage + lien externe SumUp « Acheter ».
 * Résumé tronqué à 3 lignes avec bouton pour tout afficher ou réduire.
 */
import { listProducts, formatPrice } from '../store.js'
import { CLOUDINARY_PRESETS, optimizeCloudinaryImage } from '../cloudinary.js'

function esc(s) {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

/**
 * Branche le clic sur les boutons Voir plus / Réduire (délégation sur la grille).
 * logique : bascule classe is-expanded + clamp sur le paragraphe ; aria pour l’accessibilité.
 *
 * @param {HTMLElement} grid
 */
function bindSynopsisToggles(grid) {
  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('.dv-product-card__toggle')
    if (!btn || btn.hidden) {
      return
    }
    const block = btn.closest('.dv-product-card__synopsis-block')
    const synopsisEl = block?.querySelector('.dv-product-card__synopsis')
    if (!synopsisEl) {
      return
    }

    const expanded = !block.classList.contains('is-expanded')
    block.classList.toggle('is-expanded', expanded)
    synopsisEl.classList.toggle('dv-product-card__synopsis--clamped', !expanded)
    btn.setAttribute('aria-expanded', expanded ? 'true' : 'false')
    const labelEl = btn.querySelector('.dv-product-card__toggle-label')
    if (labelEl) {
      labelEl.textContent = expanded ? 'Réduire' : 'Voir plus'
    }
    btn.setAttribute(
      'aria-label',
      expanded ? 'Réduire le résumé' : 'Agrandir le résumé'
    )
  })
}

/**
 * Masque le bouton si le texte tient déjà en 3 lignes (scrollHeight vs clientHeight avec clamp actif).
 *
 * @param {HTMLElement} grid
 */
function hideToggleWhenSynopsisShort(grid) {
  grid.querySelectorAll('.dv-product-card__synopsis-block').forEach((block) => {
    const synopsisEl = block.querySelector('.dv-product-card__synopsis')
    const btn = block.querySelector('.dv-product-card__toggle')
    if (!synopsisEl || !btn) {
      return
    }
    // Objectif : ne proposer l’agrandissement que si le contenu dépasse le clamp courant
    const overflows = synopsisEl.scrollHeight > synopsisEl.clientHeight + 2
    btn.hidden = !overflows
  })
}

async function render() {
  const mount = document.getElementById('boutique-root')
  if (!mount) {
    return
  }

  mount.innerHTML = '<p>Chargement…</p>'

  try {
    const products = await listProducts({ publishedOnly: true })
    if (!products.length) {
      mount.innerHTML = '<p>Aucun ouvrage en ligne pour le moment.</p>'
      return
    }

    const grid = document.createElement('div')
    grid.className = 'dv-product-grid'

    for (const p of products) {
      const card = document.createElement('article')
      card.className = 'dv-product-card'

      const promoHtml =
        p.promo && p.priceBeforePromoCents != null
          ? `<span class="dv-price dv-price--old">${esc(formatPrice(p.priceBeforePromoCents, p.currency))}</span>`
          : ''

      // Bloc résumé : paragraphe avec line-clamp + bouton icône (thème Font Awesome du site)
      const synopsisText = esc(p.synopsis || '')
      const optimizedImageUrl = optimizeCloudinaryImage(p.imageUrl, CLOUDINARY_PRESETS.productCover)
      card.innerHTML = `
				${optimizedImageUrl ? `<img class="dv-product-card__img" src="${esc(optimizedImageUrl)}" alt="" loading="lazy" decoding="async" />` : ''}
				<div class="dv-product-card__body">
					<h3 class="dv-product-card__title">${esc(p.title)}</h3>
					<div class="dv-product-card__synopsis-block">
						<p class="dv-product-card__synopsis dv-product-card__synopsis--clamped">${synopsisText}</p>
						<button type="button" class="dv-product-card__toggle" aria-expanded="false" aria-label="Agrandir le résumé">
							<span class="icon solid fa-chevron-down dv-product-card__toggle-chevron" aria-hidden="true"></span>
							<span class="dv-product-card__toggle-label">Voir plus</span>
						</button>
					</div>
					<div class="dv-price-row">
						${promoHtml}
						<span class="dv-price">${esc(formatPrice(p.priceCents, p.currency))}</span>
					</div>
					<ul class="actions special" style="margin-top:1rem;">
						<li><a href=${JSON.stringify(p.sumupUrl && String(p.sumupUrl).trim() ? p.sumupUrl : '#')} class="button primary" target="_blank" rel="noopener noreferrer">Acheter</a></li>
					</ul>
				</div>
			`
      grid.appendChild(card)
    }

    bindSynopsisToggles(grid)

    mount.innerHTML = ''
    mount.appendChild(grid)

    // Après insertion DOM : mesurer si le clamp cache du contenu ; sinon pas de bouton
    hideToggleWhenSynopsisShort(grid)
  } catch (e) {
    mount.innerHTML = `<p>Erreur : ${esc(String(e.message))}</p>`
  }
}

render()
