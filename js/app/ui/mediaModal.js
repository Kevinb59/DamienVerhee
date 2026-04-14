/**
 * Lightbox simple : miniature cliquable → plein écran (image, vidéo ou iframe).
 * Utilisation : placer data-media-modal data-media-type="image|video" data-media-url="..." sur un bouton ou lien.
 *
 * @param {ParentNode} [root]
 */
export function initMediaModal(root = document.body) {
  if (root.querySelector?.('.dv-media-modal')) {
    return
  }

  const overlay = document.createElement('div')
  overlay.className = 'dv-media-modal'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.innerHTML = `
		<div class="dv-media-modal__backdrop" data-close-modal></div>
		<div class="dv-media-modal__panel">
			<button type="button" class="dv-media-modal__nav dv-media-modal__nav--prev" data-nav="prev" aria-label="Média précédent"><span class="dv-media-modal__icon">‹</span></button>
			<button type="button" class="dv-media-modal__close" data-close-modal aria-label="Fermer"><span class="dv-media-modal__icon">&times;</span></button>
			<div class="dv-media-modal__body"></div>
			<button type="button" class="dv-media-modal__nav dv-media-modal__nav--next" data-nav="next" aria-label="Média suivant"><span class="dv-media-modal__icon">›</span></button>
		</div>
	`
  document.body.appendChild(overlay)

  const bodyEl = overlay.querySelector('.dv-media-modal__body')
  let items = []
  let currentIndex = -1

  function close() {
    overlay.classList.remove('is-open')
    bodyEl.innerHTML = ''
    document.body.style.overflow = ''
    currentIndex = -1
  }

  /**
   * Rend le média courant de la collection active.
   *
   * 1) But : centraliser l’affichage pour navigation flèches/clavier/swipe.
   * 2) Variables clés :
   *    - items : collection ordonnée des vignettes ouvertes dans la page.
   *    - currentIndex : position active dans cette collection.
   * 3) Flux :
   *    - vide le body
   *    - insère image / vidéo / iframe
   *    - affiche/masque les flèches si un seul média
   */
  function renderCurrentMedia() {
    if (currentIndex < 0 || currentIndex >= items.length) {
      return
    }
    const current = items[currentIndex]
    const url = current?.url || ''
    const type = current?.type || 'image'

    bodyEl.innerHTML = ''
    if (
      type === 'video' &&
      (url.includes('youtube.com') || url.includes('youtu.be'))
    ) {
      const iframe = document.createElement('iframe')
      iframe.className = 'dv-media-modal__iframe'
      iframe.src = url
      iframe.setAttribute('allowfullscreen', 'true')
      bodyEl.appendChild(iframe)
    } else if (type === 'video') {
      const v = document.createElement('video')
      v.className = 'dv-media-modal__video'
      v.controls = true
      v.autoplay = true
      v.src = url
      bodyEl.appendChild(v)
    } else {
      const img = document.createElement('img')
      img.className = 'dv-media-modal__img'
      img.src = url
      img.alt = ''
      bodyEl.appendChild(img)
    }

    const hasMany = items.length > 1
    overlay.classList.toggle('has-nav', hasMany)
    overlay.classList.add('is-open')
    document.body.style.overflow = 'hidden'
  }

  function open(itemsList, startIndex) {
    items = Array.isArray(itemsList) ? itemsList : []
    if (!items.length) {
      return
    }
    currentIndex = Math.max(0, Math.min(startIndex, items.length - 1))
    renderCurrentMedia()
  }

  function move(step) {
    if (items.length <= 1 || currentIndex < 0) {
      return
    }
    const len = items.length
    currentIndex = (currentIndex + step + len) % len
    renderCurrentMedia()
  }

  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-media-modal]')
    if (!t) {
      return
    }
    e.preventDefault()
    const nodeList = Array.from(root.querySelectorAll('[data-media-modal]'))
    const mediaItems = nodeList.map((el) => ({
      url: el.getAttribute('data-media-url') || '',
      type: el.getAttribute('data-media-type') || 'image'
    }))
    const startIndex = nodeList.indexOf(t)
    if (startIndex >= 0 && mediaItems[startIndex]?.url) {
      open(mediaItems, startIndex)
    }
  })

  overlay.addEventListener('click', (e) => {
    if (e.target.matches('[data-close-modal]')) {
      close()
      return
    }
    const navBtn = e.target.closest('[data-nav]')
    if (navBtn) {
      move(navBtn.getAttribute('data-nav') === 'prev' ? -1 : 1)
    }
  })

  /**
   * Navigation clavier :
   * - Escape ferme
   * - Flèches gauche/droite changent de média
   */
  document.addEventListener('keydown', (e) => {
    if (!overlay.classList.contains('is-open')) {
      return
    }
    if (e.key === 'Escape') {
      close()
      return
    }
    if (e.key === 'ArrowLeft') {
      move(-1)
      return
    }
    if (e.key === 'ArrowRight') {
      move(1)
    }
  })

  /**
   * Swipe mobile :
   * - glisser horizontalement dans la modal => média précédent/suivant
   * - seuil volontaire pour éviter les déclenchements accidentels
   */
  let touchStartX = 0
  let touchStartY = 0
  overlay.addEventListener(
    'touchstart',
    (e) => {
      if (!overlay.classList.contains('is-open') || !e.touches?.length) {
        return
      }
      touchStartX = e.touches[0].clientX
      touchStartY = e.touches[0].clientY
    },
    { passive: true }
  )
  overlay.addEventListener(
    'touchend',
    (e) => {
      if (!overlay.classList.contains('is-open') || !e.changedTouches?.length) {
        return
      }
      const dx = e.changedTouches[0].clientX - touchStartX
      const dy = e.changedTouches[0].clientY - touchStartY
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) {
        return
      }
      move(dx > 0 ? -1 : 1)
    },
    { passive: true }
  )
}
