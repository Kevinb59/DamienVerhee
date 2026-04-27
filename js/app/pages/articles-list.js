/**
 * Page liste des articles : charge les entrées publiées via store et les affiche.
 */
import { listArticles } from '../store.js'
import { initMediaModal } from '../ui/mediaModal.js'
import { CLOUDINARY_PRESETS, optimizeCloudinaryImage } from '../cloudinary.js'

function esc(s) {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

/**
 * Formate une date ISO `YYYY-MM-DD` en `DD/MM/YYYY`.
 * Retourne la valeur d’origine si le format n’est pas reconnu.
 *
 * @param {string} ymd
 * @returns {string}
 */
function formatDateFr(ymd) {
  const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) {
    return String(ymd || '')
  }
  return `${m[3]}/${m[2]}/${m[1]}`
}

async function render() {
  const mount = document.getElementById('articles-root')
  if (!mount) {
    return
  }

  mount.innerHTML = '<p>Chargement…</p>'

  try {
    const articles = await listArticles({ publishedOnly: true })
    if (!articles.length) {
      mount.innerHTML = '<p>Aucun article pour le moment.</p>'
      return
    }

    const ul = document.createElement('ul')
    ul.className = 'dv-article-list'

    for (const a of articles) {
      const li = document.createElement('li')
      const href = `article.html?slug=${encodeURIComponent(a.slug)}`
      // Métadonnées événement : tout dans une pastille (date + début + fin éventuelle + lieu).
      const eventHtml = a.isEvent
        ? `<span class="dv-event-pill">Événement ${esc(formatDateFr(a.eventDate || ''))}${a.eventTime ? ` · ${esc(a.eventTime)}` : ''}${a.eventEndDate ? ` → ${esc(formatDateFr(a.eventEndDate))}` : ''}${a.eventEndTime ? ` · ${esc(a.eventEndTime)}` : ''}${a.eventLocation ? ` — ${esc(a.eventLocation)}` : ''}</span>`
        : ''

      /**
       * Vignette : premier média de l’article (thumbUrl prioritaire), sinon fallback visuel neutre.
       * Variables clés : medias[] (données article), firstMedia (première entrée), thumbSrc (URL effective).
       * Flux : lecture du 1er média -> calcul de la source -> rendu image ronde.
       */
      const medias = Array.isArray(a.media) ? a.media : []
      const firstMedia = medias[0] || null
      const thumbSrc = firstMedia ? firstMedia.thumbUrl || firstMedia.url || '' : ''
      const optimizedThumbSrc = optimizeCloudinaryImage(thumbSrc, CLOUDINARY_PRESETS.articleThumb)
      const thumbHtml = thumbSrc
        ? `<span class="dv-article-list__thumb-wrap"><img class="dv-article-list__thumb" src="${esc(optimizedThumbSrc)}" alt="" loading="lazy" decoding="async" /></span>`
        : `<span class="dv-article-list__thumb-wrap dv-article-list__thumb-wrap--empty" aria-hidden="true"></span>`

      li.innerHTML = `
				${thumbHtml}
				${eventHtml}
				<h2 class="dv-article-list__title">${esc(a.title)}</h2>
				<p class="dv-article-list__excerpt">${esc(a.excerpt || '')}</p>
				<div class="dv-article-list__actions">
					<a class="button small" href="${href}">Lire</a>
				</div>
			`
      ul.appendChild(li)
    }

    mount.innerHTML = ''
    mount.appendChild(ul)
  } catch (e) {
    mount.innerHTML = `<p>Impossible de charger les articles (${esc(String(e.message))}).</p>`
  }

  initMediaModal()
}

render()
