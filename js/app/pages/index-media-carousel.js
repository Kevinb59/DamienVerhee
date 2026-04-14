/**
 * Diaporama d’accueil (fond jaune / accent4) : jusqu’à 10 derniers médias (galerie dynamique + fixe).
 * Source dynamique : bandeau titre + résumé + bouton article. Source fixe : média seul.
 */
import { listLatestCombinedGalleryMedia } from '../store.js'

/** Durée alignée sur la transition CSS du track et du viewport (hauteur). */
const TRACK_TRANSITION_MS = 400
const MAX_SLIDES = 10

/** Ratio par défaut (16:9) tant que les dimensions natives ne sont pas connues. */
const DEFAULT_ASPECT = { w: 16, h: 9 }

function esc(s) {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

/**
 * Construit le HTML d’une slide : zone média + bandeau optionnel (articles uniquement).
 *
 * @param {{ source: string, type: string, url: string, thumbUrl: string, articleSlug?: string, articleTitle?: string, articleExcerpt?: string }} slide
 * @param {boolean} isFixed
 */
function slideHtml(slide, isFixed) {
  const isVideo = slide.type === 'video'
  const mediaUrl = slide.url
  const poster = slide.thumbUrl || slide.url
  // Médias non visibles : pas de préchargement vidéo lourd ; le poster est préchargé côté JS (voisins).
  const videoPreload = 'none'
  const mediaBlock = isVideo
    ? `<video class="dv-index-media-carousel__video" src=${JSON.stringify(mediaUrl)} poster=${JSON.stringify(poster)} controls playsinline preload="${videoPreload}"></video>`
    : `<img src=${JSON.stringify(poster)} alt="" data-position="center" />`

  const articleHref = slide.articleSlug
    ? `article.html?slug=${encodeURIComponent(slide.articleSlug)}`
    : slide.articleId
      ? `article.html?id=${encodeURIComponent(slide.articleId)}`
      : ''

  // Bandeau en overlay : une seule ligne flex (texte titre+résumé | bouton) pour centrer le CTA en hauteur sur tout le bloc.
  const banner =
    !isFixed && articleHref
      ? `
			<div class="content dv-index-media-carousel__banner">
				<div class="dv-index-media-carousel__banner-inner">
					<div class="dv-index-media-carousel__banner-text">
						<h3 class="dv-index-media-carousel__banner-title">${esc(slide.articleTitle || '')}</h3>
						<p class="dv-index-media-carousel__banner-excerpt">${esc(slide.articleExcerpt || '')}</p>
					</div>
					<div class="dv-index-media-carousel__banner-cta">
						<a href="${articleHref}" class="button primary">Lire l’article</a>
					</div>
				</div>
			</div>`
      : ''

  const cls = isFixed ? ' class="dv-slide--fixed"' : ''
  const dataAttrs = `data-media-type=${JSON.stringify(slide.type)} data-media-url=${JSON.stringify(mediaUrl)} data-poster-url=${JSON.stringify(poster)}`
  return `<article${cls} ${dataAttrs}>
		<div class="image">${mediaBlock}</div>
		${banner}
	</article>`
}

/**
 * Précharge l’image affichée ou le poster vidéo d’une slide (voisins pour navigation fluide).
 *
 * @param {HTMLElement} articleEl - élément article du carrousel
 */
function preloadSlideMedia(articleEl) {
  const type = articleEl.dataset.mediaType
  const url = articleEl.dataset.mediaUrl
  const poster = articleEl.dataset.posterUrl
  if (!url && !poster) {
    return
  }
  // Vidéo : on évite de télécharger le flux entier ; le poster suffit pour l’aperçu.
  const src = type === 'video' ? poster || url : url
  if (!src) {
    return
  }
  const img = new Image()
  img.src = src
}

/**
 * Précharge les médias des slides précédente et suivante par rapport à la position active.
 *
 * @param {HTMLElement[]} slideEls - liste des articles visibles dans le DOM
 * @param {number} activeIndex - index courant (0-based)
 */
function preloadAdjacentSlides(slideEls, activeIndex) {
  const n = slideEls.length
  if (n < 2) {
    return
  }
  const next = (activeIndex + 1) % n
  const prev = (activeIndex - 1 + n) % n
  preloadSlideMedia(slideEls[next])
  preloadSlideMedia(slideEls[prev])
}

/**
 * Applique `preload` vidéo : une slide active en `metadata`, le reste en `none`.
 *
 * @param {HTMLElement[]} slideEls
 * @param {number} activeIndex
 */
function applyVideoPreloadPolicy(slideEls, activeIndex) {
  slideEls.forEach((el, i) => {
    const v = el.querySelector('video.dv-index-media-carousel__video')
    if (v) {
      v.preload = i === activeIndex ? 'metadata' : 'none'
    }
  })
}

/**
 * Applique `aspect-ratio` sur la zone `.image` à partir des dimensions natives (photo ou vidéo).
 * Objectif : conserver les proportions réelles du média dans la slide.
 *
 * @param {HTMLElement} article - élément `article` d’une slide
 * @param {() => void} [onSized] - rappel après mise à jour du ratio (ex. recalcul hauteur viewport)
 */
function applyNativeAspectToSlideArticle(article, onSized) {
  const box = article.querySelector('.image')
  if (!box) {
    return
  }

  const applyRatio = (w, h) => {
    if (w > 0 && h > 0) {
      box.style.aspectRatio = `${w} / ${h}`
    } else {
      box.style.aspectRatio = `${DEFAULT_ASPECT.w} / ${DEFAULT_ASPECT.h}`
    }
    onSized?.()
  }

  const img = box.querySelector('img')
  const video = box.querySelector('video.dv-index-media-carousel__video')

  if (img) {
    const run = () => applyRatio(img.naturalWidth, img.naturalHeight)
    if (img.complete && img.naturalWidth > 0) {
      run()
    } else {
      img.addEventListener('load', run, { once: true })
      img.addEventListener(
        'error',
        () => applyRatio(DEFAULT_ASPECT.w, DEFAULT_ASPECT.h),
        { once: true }
      )
    }
    return
  }

  if (video) {
    const run = () => applyRatio(video.videoWidth, video.videoHeight)
    if (video.readyState >= 1 && video.videoWidth > 0) {
      run()
    } else {
      video.addEventListener('loadedmetadata', run, { once: true })
      video.addEventListener(
        'error',
        () => applyRatio(DEFAULT_ASPECT.w, DEFAULT_ASPECT.h),
        { once: true }
      )
    }
  }
}

/**
 * Pilote la piste horizontale (translateX), flèches et pastilles — pas de masquage des slides.
 *
 * @param {HTMLElement} section - élément .carousel
 * @param {HTMLDivElement} dotsRoot
 */
function runCarousel(section, dotsRoot) {
  const track = section.querySelector('.dv-index-media-carousel__track')
  const viewport = section.querySelector('.dv-index-media-carousel__viewport')
  if (!track || !viewport) {
    return
  }
  const slides = Array.from(track.querySelectorAll(':scope > article'))
  const dotBtns = Array.from(dotsRoot.querySelectorAll('button'))
  if (!slides.length) {
    return
  }

  const n = slides.length
  let pos = 0
  let locked = false

  // Largeur de piste = n × 100 % du viewport ; chaque slide occupe 1/n de la piste (= 100 % du viewport).
  const slidePct = 100 / n
  track.style.width = `${n * 100}%`
  slides.forEach((el) => {
    el.style.flex = `0 0 ${slidePct}%`
    el.style.minWidth = `${slidePct}%`
  })

  /**
   * Ajuste la largeur + hauteur du viewport à la slide active.
   * Objectif : éviter les "marges blanches" latérales quand le média actif est plus étroit,
   * tout en gardant la limite max (500px) définie en CSS.
   */
  function updateViewportBox() {
    const active = slides[pos]
    if (!active) {
      return
    }
    const imageBox = active.querySelector('.image')
    // Largeur active = largeur réelle du média affiché (fallback: largeur viewport courante).
    let w =
      imageBox && imageBox instanceof HTMLElement
        ? imageBox.offsetWidth
        : viewport.getBoundingClientRect().width
    if (w < 4) {
      const sectionW = section.getBoundingClientRect().width
      w = Math.min(500, sectionW)
    }
    viewport.style.width = `${Math.ceil(w)}px`

    let h = active.offsetHeight
    if (h < 4) {
      h = (w * DEFAULT_ASPECT.h) / DEFAULT_ASPECT.w
    }
    viewport.style.height = `${Math.ceil(h)}px`
  }

  // Chaque slide : proportions natives ; quand la slide active change de taille (chargement), on resynchronise.
  slides.forEach((article, index) => {
    applyNativeAspectToSlideArticle(article, () => {
      if (index === pos) {
        window.requestAnimationFrame(() => updateViewportBox())
      }
    })
  })

  let resizeTimer = 0
  function onResize() {
    window.clearTimeout(resizeTimer)
    resizeTimer = window.setTimeout(() => updateViewportBox(), 80)
  }
  window.addEventListener('resize', onResize)

  function applyTrackTransform() {
    const offsetPct = n > 0 ? (-pos * 100) / n : 0
    track.style.transform = `translateX(${offsetPct}%)`
  }

  function applyDotActive() {
    dotBtns.forEach((btn, i) => {
      btn.classList.toggle('is-active', i === pos)
      btn.setAttribute('aria-current', i === pos ? 'true' : 'false')
    })
  }

  function switchTo(next) {
    if (locked || next === pos || next < 0 || next >= n) {
      return
    }
    locked = true
    pos = next
    // Hauteur et translation démarrent ensemble (même durée CSS) pour un changement de cadre fluide.
    updateViewportBox()
    applyTrackTransform()
    applyDotActive()
    preloadAdjacentSlides(slides, pos)
    applyVideoPreloadPolicy(slides, pos)
    // Sans transition CSS (ex. préférence utilisateur), déverrouiller tout de suite.
    window.setTimeout(() => {
      if (locked) {
        locked = false
      }
    }, TRACK_TRANSITION_MS + 50)
  }

  // Fin de l’animation : prêt pour le clic suivant (évite les courses avec transitionend).
  track.addEventListener('transitionend', (e) => {
    if (e.target !== track || e.propertyName !== 'transform') {
      return
    }
    locked = false
  })

  applyTrackTransform()
  applyDotActive()
  applyVideoPreloadPolicy(slides, 0)
  preloadAdjacentSlides(slides, 0)
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => updateViewportBox())
  })

  section.querySelector('.next')?.addEventListener('click', (e) => {
    e.preventDefault()
    const nextIdx = pos + 1 >= n ? 0 : pos + 1
    switchTo(nextIdx)
  })
  section.querySelector('.previous')?.addEventListener('click', (e) => {
    e.preventDefault()
    const prevIdx = pos - 1 < 0 ? n - 1 : pos - 1
    switchTo(prevIdx)
  })

  dotBtns.forEach((btn, i) => {
    btn.addEventListener('click', () => switchTo(i))
  })

  if (slides.length < 2) {
    section.querySelector('nav')?.setAttribute('hidden', 'true')
    dotsRoot.setAttribute('hidden', 'true')
  }

  /*
   * Swipe tactile (mobile/tablette) :
   * - glissement horizontal > seuil => slide précédente/suivante
   * - ignore les interactions sur vidéo/contrôles pour ne pas gêner la lecture.
   */
  let touchStartX = 0
  let touchStartY = 0
  let touchActive = false
  const SWIPE_MIN_DELTA = 45
  const SWIPE_MAX_VERTICAL = 60

  section.addEventListener(
    'touchstart',
    (e) => {
      if (!e.touches || e.touches.length !== 1) {
        return
      }
      const t = e.target
      if (
        t instanceof Element &&
        (t.closest('video') ||
          t.closest('a') ||
          t.closest('button') ||
          t.closest('input') ||
          t.closest('textarea'))
      ) {
        touchActive = false
        return
      }
      touchActive = true
      touchStartX = e.touches[0].clientX
      touchStartY = e.touches[0].clientY
    },
    { passive: true }
  )

  section.addEventListener(
    'touchend',
    (e) => {
      if (!touchActive || !e.changedTouches || !e.changedTouches.length) {
        return
      }
      touchActive = false
      const dx = e.changedTouches[0].clientX - touchStartX
      const dy = e.changedTouches[0].clientY - touchStartY
      if (Math.abs(dy) > SWIPE_MAX_VERTICAL || Math.abs(dx) < SWIPE_MIN_DELTA) {
        return
      }
      if (dx < 0) {
        const nextIdx = pos + 1 >= n ? 0 : pos + 1
        switchTo(nextIdx)
      } else {
        const prevIdx = pos - 1 < 0 ? n - 1 : pos - 1
        switchTo(prevIdx)
      }
    },
    { passive: true }
  )
}

async function render() {
  const root = document.getElementById('index-media-carousel-root')
  if (!root) {
    return
  }

  root.innerHTML = '<p class="dv-index-media-carousel__loading">Chargement…</p>'

  try {
    const slides = await listLatestCombinedGalleryMedia(MAX_SLIDES)
    if (!slides.length) {
      root.innerHTML =
        '<p class="dv-index-media-carousel__empty">Aucun média pour le moment.</p>'
      return
    }

    const articlesHtml = slides
      .map((s) => slideHtml(s, s.source === 'fixed'))
      .join('')
    const dotsHtml = slides
      .map(
        (_, i) =>
          `<button type="button" class="dv-index-media-carousel__dot" aria-label="Média ${i + 1}" aria-current="${i === 0 ? 'true' : 'false'}"></button>`
      )
      .join('')

    // Viewport + piste : translation horizontale (pas de display:none → plus de section « vide » entre deux médias).
    root.innerHTML = `
			<div class="dv-index-media-carousel-wrap">
				<section class="carousel accent4 dv-index-media-carousel" id="index-media-carousel">
					<div class="dv-index-media-carousel__viewport">
						<div class="dv-index-media-carousel__track">
							${articlesHtml}
						</div>
					</div>
					<nav>
						<a href="#" class="previous"><span class="label">Précédent</span></a>
						<a href="#" class="next"><span class="label">Suivant</span></a>
					</nav>
					<div class="dv-index-media-carousel__dots" role="tablist" aria-label="Médias du diaporama">
						${dotsHtml}
					</div>
					<ul class="actions special dv-index-media-carousel__actions">
						<li><a href="galerie.html" class="button primary">Voir la galerie</a></li>
					</ul>
				</section>
			</div>
		`

    const section = root.querySelector('#index-media-carousel')
    const dotsRoot = root.querySelector('.dv-index-media-carousel__dots')
    if (section && dotsRoot) {
      runCarousel(section, dotsRoot)
    }

    // Polyfill object-fit du thème : cibler les nouvelles images (navigateurs anciens)
    if (
      section &&
      window.jQuery &&
      typeof window.browser !== 'undefined' &&
      !window.browser.canUse('object-fit')
    ) {
      window
        .jQuery(section)
        .find('img[data-position]')
        .each(function () {
          const $this = window.jQuery(this)
          const $parent = $this.parent()
          $parent
            .css('background-image', 'url("' + $this.attr('src') + '")')
            .css('background-size', 'cover')
            .css('background-repeat', 'no-repeat')
            .css('background-position', $this.data('position'))
          $this.css('opacity', '0')
        })
    }
  } catch (e) {
    root.innerHTML = `<p class="dv-index-media-carousel__empty">${esc(String(e.message))}</p>`
  }
}

render()
