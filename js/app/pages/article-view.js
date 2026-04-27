/**
 * Détail d’un article : corps riche + grille de médias en miniature (modal plein écran).
 */
import { getArticle, getArticleBySlug } from '../store.js'
import { initMediaModal } from '../ui/mediaModal.js'
import { CLOUDINARY_PRESETS, optimizeCloudinaryImage } from '../cloudinary.js'

function esc(s) {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

function qs(name) {
  return new URLSearchParams(window.location.search).get(name)
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
  const mount = document.getElementById('article-root')
  const mediaMount = document.getElementById('article-media-root')
  if (!mount || !mediaMount) {
    return
  }

  const id = qs('id')
  const slug = qs('slug')
  mount.innerHTML = '<p>Chargement…</p>'

  try {
    let article = null
    if (id) {
      article = await getArticle(id)
    } else if (slug) {
      article = await getArticleBySlug(slug)
    }

    if (!article || !article.published) {
      mount.innerHTML = '<p>Article introuvable.</p>'
      return
    }

    // Bloc événement : affiche début, fin (date/heure) et lieu quand disponibles.
    const eventBlock =
      article.isEvent && (article.eventDate || article.eventLocation)
        ? `<p class="box"><strong>Événement</strong><br/>
					${esc(article.eventDate ? formatDateFr(article.eventDate) : '—')}
					${article.eventTime ? ` · ${esc(article.eventTime)}` : ''}
					${article.eventEndDate ? ` → ${esc(formatDateFr(article.eventEndDate))}` : ''}
					${article.eventEndTime ? ` · ${esc(article.eventEndTime)}` : ''}
					<br/>${esc(article.eventLocation || '')}</p>`
        : ''

    const medias = Array.isArray(article.media) ? article.media : []
    const thumbs = medias
      .map((m) => {
        const type = m.type === 'video' ? 'video' : 'image'
        const optimizedMediaUrl =
          type === 'video'
            ? optimizeCloudinaryImage(m.url, CLOUDINARY_PRESETS.galleryPoster)
            : optimizeCloudinaryImage(m.url, CLOUDINARY_PRESETS.articleHero)
        const optimizedThumb =
          type === 'video'
            ? optimizeCloudinaryImage(m.thumbUrl || m.url, CLOUDINARY_PRESETS.galleryThumb)
            : optimizeCloudinaryImage(m.thumbUrl || m.url, CLOUDINARY_PRESETS.galleryThumb)
        const u = JSON.stringify(optimizedMediaUrl)
        const t = JSON.stringify(optimizedThumb)
        return `
				<button type="button" class="dv-media-thumb" data-media-modal data-media-type="${type}" data-media-url=${u}>
					${type === 'video' ? `<video src=${u} muted playsinline preload="metadata"></video><span class="dv-media-thumb__play">▶</span>` : `<img src=${t} alt="" loading="lazy" decoding="async" />`}
				</button>`
      })
      .join('')

    // Chapô = excerpt uniquement ; summaryLine (accueil) n’est pas affiché ici.
    mount.innerHTML = `
			<header class="major">
				<h1>${esc(article.title)}</h1>
				<p>${esc(article.excerpt || '')}</p>
			</header>
			${eventBlock}
			<div class="dv-article-separator" aria-hidden="true"></div>
			<div class="dv-article-body">${article.bodyHtml || ''}</div>
		`

    // 1) Section média séparée : hors du flux du corps d’article pour éviter les "bords blancs" latéraux.
    // 2) Variables clés :
    //    - thumbs : grille de miniatures si médias disponibles.
    //    - mediaMount : point d’injection de la section colorée dédiée.
    // 3) Flux : la section colorée vit comme un bloc autonome, comme sur l’index.
    mediaMount.innerHTML = `
			<div class="dv-article-media-band">
				${thumbs ? `<h3>Médias</h3><div class="dv-media-grid">${thumbs}</div>` : '<p class="dv-article-media-band__empty">Aucun média associé à cet article.</p>'}
				<p class="dv-article-media-band__actions"><a href="articles.html" class="button">← Tous les articles</a></p>
			</div>
		`
  } catch (e) {
    mount.innerHTML = `<p>Erreur : ${esc(String(e.message))}</p>`
    mediaMount.innerHTML = `<p>Erreur : ${esc(String(e.message))}</p>`
  }

  initMediaModal()
}

render()
