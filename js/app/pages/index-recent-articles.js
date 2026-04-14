/**
 * Bloc d’accueil : les 3 articles publiés les plus récents (date de création).
 * Affiche miniature ronde du premier média, titre et summaryLine (hors page article).
 */
import { listLatestArticles } from '../store.js'

const PLACEHOLDER_IMG = 'images/pic01.jpg'

function esc(s) {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

/**
 * URL du premier média image, sinon vignette vidéo, sinon image de secours.
 *
 * @param {{ media?: Array<{ type?: string, url?: string, thumbUrl?: string }> }} article
 * @returns {string}
 */
function firstMediaThumbUrl(article) {
  const list = Array.isArray(article.media) ? article.media : []
  const firstImg = list.find((m) => m.type === 'image')
  const first = firstImg || list[0]
  if (!first) {
    return PLACEHOLDER_IMG
  }
  if (first.type === 'video') {
    return first.thumbUrl || first.url || PLACEHOLDER_IMG
  }
  return first.thumbUrl || first.url || PLACEHOLDER_IMG
}

/**
 * Déclenche une animation d’entrée depuis le bas quand la section devient visible au scroll.
 *
 * 1) But : animer "Derniers articles" uniquement à l’arrivée dans le viewport.
 * 2) Variables clés :
 *    - sectionEl : section parent contenant le bloc des articles.
 *    - observer : écoute l’intersection et n’anime qu’une seule fois.
 * 3) Flux :
 *    - si IntersectionObserver est disponible : animation on-enter puis disconnect.
 *    - sinon : affichage immédiat (fallback).
 *
 * @param {HTMLElement} sectionEl
 */
function setupRevealOnScroll(sectionEl) {
  if (!(sectionEl instanceof HTMLElement)) {
    return
  }
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    sectionEl.classList.add('is-visible')
    return
  }
  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0]
      if (!entry || !entry.isIntersecting) {
        return
      }
      sectionEl.classList.add('is-visible')
      observer.disconnect()
    },
    { threshold: 0.2 }
  )
  observer.observe(sectionEl)
}

async function render() {
  const mount = document.getElementById('index-recent-articles')
  if (!mount) {
    return
  }
  setupRevealOnScroll(mount)
  setupRevealOnScroll(document.getElementById('index-contact-author-card'))
  setupRevealOnScroll(document.getElementById('index-contact-publisher-card'))

  mount.innerHTML = '<p>Chargement…</p>'

  try {
    const articles = await listLatestArticles(3)
    if (!articles.length) {
      mount.innerHTML = '<p>Aucun article pour le moment.</p>'
      return
    }

    const frag = document.createDocumentFragment()
    for (const a of articles) {
      const thumb = firstMediaThumbUrl(a)
      const line = a.summaryLine || a.excerpt || ''
      const slug = encodeURIComponent(a.slug)
      const section = document.createElement('section')
      const srcJson = JSON.stringify(thumb)
      section.innerHTML = `
				<a href="article.html?slug=${slug}" class="dv-index-recent__link">
					<span class="dv-index-recent__thumb-wrap">
						<img class="dv-index-recent__thumb" src=${srcJson} alt="" width="120" height="120" />
					</span>
					<h3>${esc(a.title)}</h3>
					<p class="dv-index-recent__line">${esc(line)}</p>
				</a>
			`
      frag.appendChild(section)
    }
    mount.innerHTML = ''
    mount.appendChild(frag)
  } catch (e) {
    mount.innerHTML = `<p>${esc(String(e.message))}</p>`
  }
}

render()
