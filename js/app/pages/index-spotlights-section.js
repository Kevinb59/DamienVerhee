/**
 * Bloc d’accueil « spotlights » : calendrier des événements (articles `isEvent`) et panneau de détail.
 */
import { listEventArticles } from '../store.js'
import { CLOUDINARY_PRESETS, optimizeCloudinaryImage } from '../cloudinary.js'

/** Texte affiché lorsqu’aucun jour à événement n’est sélectionné (ou jour sans événement). */
const HINT_EMPTY =
  'Cliquez sur un événement sur le calendrier pour en savoir plus.'
const ARTICLE_THUMB_FALLBACK = 'images/blanked.webp'

/**
 * Échappe du texte pour insertion dans du HTML.
 *
 * @param {string} s
 * @returns {string}
 */
function esc(s) {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

/**
 * Parse une date locale `YYYY-MM-DD` sans décalage UTC.
 *
 * @param {string} ymd
 * @returns {Date}
 */
function parseLocalYmd(ymd) {
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10))
  return new Date(y, m - 1, d)
}

/**
 * Formate une `Date` locale en `YYYY-MM-DD`.
 *
 * @param {Date} d
 * @returns {string}
 */
function formatYmd(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Liste chaque jour calendaire entre deux bornes inclusives (chaînes `YYYY-MM-DD`).
 *
 * @param {string} startYmd
 * @param {string} endYmd
 * @returns {string[]}
 */
function enumerateDateStrings(startYmd, endYmd) {
  const out = []
  const cur = parseLocalYmd(startYmd)
  const end = parseLocalYmd(endYmd)
  while (cur <= end) {
    out.push(formatYmd(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

/**
 * Construit une map `date ISO jour → articles événements` (plusieurs entrées possibles le même jour).
 *
 * @returns {Promise<Map<string, Array<Record<string, any>>>>}
 */
async function buildEventsByDateMap() {
  const events = await listEventArticles({ upcomingOnly: false })
  /** @type {Map<string, Array<Record<string, any>>>} */
  const map = new Map()
  for (const ev of events) {
    if (!ev.eventDate) {
      continue
    }
    const end = ev.eventEndDate || ev.eventDate
    for (const ymd of enumerateDateStrings(ev.eventDate, end)) {
      if (!map.has(ymd)) {
        map.set(ymd, [])
      }
      map.get(ymd).push(ev)
    }
  }
  for (const [, arr] of map) {
    arr.sort((a, b) => String(a.title).localeCompare(String(b.title), 'fr'))
  }
  return map
}

/**
 * Rend le panneau de droite : consigne seule, ou titre + extrait + lien article.
 *
 * @param {Record<string, any> | null} article
 */
function renderEventDetail(article) {
  const root = document.getElementById('index-event-detail-root')
  if (!root) {
    return
  }
  if (!article) {
    // 1) But : état vide centré verticalement dans la carte détail.
    // 2) Variable clé : classe CSS `is-empty` sur le conteneur racine.
    // 3) Flux : la consigne reste lisible même quand aucune date n’est sélectionnée.
    root.classList.add('is-empty')
    // 1) But : mettre en évidence le mot "événement" pour rappeler les jours marqués du calendrier.
    // 2) Variable clé : span dédié stylé en pastille verte via CSS.
    // 3) Flux : le message reste textuel mais offre un repère visuel immédiat.
    root.innerHTML = `<p class="dv-event-detail__hint">Cliquez sur un <span class="dv-event-detail__hint-event">événement</span> sur le calendrier pour en savoir plus.</p>`
    return
  }
  root.classList.remove('is-empty')
  const href = `article.html?slug=${encodeURIComponent(article.slug)}`
  /**
   * Miniature du détail événement :
   * - priorité au premier média (thumbUrl puis url)
   * - fallback visuel neutre si aucun média n’est disponible.
   */
  const medias = Array.isArray(article.media) ? article.media : []
  const firstMedia = medias[0] || null
  const thumbSrc = firstMedia ? firstMedia.thumbUrl || firstMedia.url || '' : ''
  /**
   * 1) But : conserver une vignette visible même sans média article.
   * 2) Variables clés :
   *    - `thumbSrc` : miniature issue du contenu si disponible.
   *    - `ARTICLE_THUMB_FALLBACK` : image neutre commune.
   * 3) Flux : source article -> fallback `blanked.webp` -> rendu image optimisée.
   */
  const finalThumbSrc = thumbSrc || ARTICLE_THUMB_FALLBACK
  const optimizedThumbSrc = optimizeCloudinaryImage(
    finalThumbSrc,
    CLOUDINARY_PRESETS.articleThumb
  )
  const thumbHtml = `<span class="dv-event-detail__thumb-wrap"><img class="dv-event-detail__thumb" src="${esc(optimizedThumbSrc)}" alt="" loading="lazy" decoding="async" /></span>`

  root.innerHTML = `
		${thumbHtml}
		<h3>${esc(article.title)}</h3>
		<p class="dv-event-detail__excerpt">${esc(article.excerpt || '')}</p>
		<ul class="actions special">
			<li><a href="${href}" class="button primary">Voir l’événement</a></li>
		</ul>
	`
}

/**
 * Jours du mois affiché + débord sur mois précédent/suivant pour compléter la grille (lun → dim).
 *
 * @param {number} year
 * @param {number} monthIndex - 0–11
 * @returns {{ ymd: string, inMonth: boolean, day: number }[]}
 */
function buildMonthCells(year, monthIndex) {
  const first = new Date(year, monthIndex, 1)
  /** Lundi = 0 … dimanche = 6 */
  const startOffset = (first.getDay() + 6) % 7
  const cur = new Date(year, monthIndex, 1 - startOffset)
  const cells = []
  for (let i = 0; i < 42; i++) {
    const inMonth = cur.getMonth() === monthIndex
    cells.push({
      ymd: formatYmd(cur),
      inMonth,
      day: cur.getDate()
    })
    cur.setDate(cur.getDate() + 1)
  }
  return cells
}

/**
 * Affiche le calendrier dans `#index-event-calendar-root`.
 *
 * @param {Map<string, Array<Record<string, any>>>} byDate
 * @param {{ year: number, monthIndex: number, selectedYmd: string | null }} view
 * @param {(ymd: string, hasEvent: boolean) => void} onPickDay
 */
function renderCalendar(byDate, view, onPickDay) {
  const root = document.getElementById('index-event-calendar-root')
  if (!root) {
    return
  }
  const todayYmd = formatYmd(new Date())

  const rawMonth = new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric'
  }).format(new Date(view.year, view.monthIndex, 1))
  const monthLabel = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1)
  const weekdays = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']
  const cells = buildMonthCells(view.year, view.monthIndex)

  const cellsHtml = cells
    .map((c) => {
      const has = (byDate.get(c.ymd) || []).length > 0
      const sel = view.selectedYmd === c.ymd
      const cls = [
        'dv-cal__day',
        !c.inMonth ? 'is-other-month' : '',
        has ? 'has-event' : '',
        c.ymd < todayYmd ? 'is-past' : '',
        c.ymd === todayYmd ? 'is-today' : '',
        sel ? 'is-selected' : ''
      ]
        .filter(Boolean)
        .join(' ')
      return `<button type="button" class="${cls}" data-date="${c.ymd}" ${!c.inMonth ? 'tabindex="-1"' : ''}>${c.day}</button>`
    })
    .join('')

  root.innerHTML = `
		<div class="dv-cal-card">
			<div class="dv-cal__toolbar">
				<button type="button" class="dv-cal__nav" data-cal-nav="prev" aria-label="Mois précédent">‹</button>
				<h4 class="dv-cal__title">${esc(monthLabel)}</h4>
				<button type="button" class="dv-cal__nav" data-cal-nav="next" aria-label="Mois suivant">›</button>
			</div>
			<div class="dv-cal__weekdays" aria-hidden="true">
				${weekdays.map((w) => `<span>${esc(w)}</span>`).join('')}
			</div>
			<div class="dv-cal__grid" role="grid" aria-label="Jours du mois">
				${cellsHtml}
			</div>
		</div>
	`

  root.querySelector('[data-cal-nav="prev"]')?.addEventListener('click', () => {
    onPickDay('__nav_prev__', false)
  })
  root.querySelector('[data-cal-nav="next"]')?.addEventListener('click', () => {
    onPickDay('__nav_next__', false)
  })

  root.querySelectorAll('.dv-cal__day[data-date]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ymd = btn.getAttribute('data-date')
      if (!ymd) {
        return
      }
      const hasEvent = (byDate.get(ymd) || []).length > 0
      onPickDay(ymd, hasEvent)
    })
  })
}

/**
 * Anime un bloc à l’entrée viewport (une seule fois).
 *
 * @param {Element|null} el
 */
function revealOnScroll(el) {
  if (!(el instanceof HTMLElement)) {
    return
  }
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    el.classList.add('is-visible')
    return
  }
  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0]
      if (!entry || !entry.isIntersecting) {
        return
      }
      el.classList.add('is-visible')
      observer.disconnect()
    },
    { threshold: 0.2 }
  )
  observer.observe(el)
}

async function init() {
  const calRoot = document.getElementById('index-event-calendar-root')
  const detailRoot = document.getElementById('index-event-detail-root')
  if (!calRoot || !detailRoot) {
    return
  }
  revealOnScroll(document.getElementById('index-rl-grid'))

  const byDate = await buildEventsByDateMap()

  const now = new Date()
  /** État mois affiché + jour sélectionné pour le surlignage. */
  const view = {
    year: now.getFullYear(),
    monthIndex: now.getMonth(),
    selectedYmd: /** @type {string | null} */ (null)
  }

  function refresh() {
    renderCalendar(byDate, view, (ymd, hasEvent) => {
      if (ymd === '__nav_prev__') {
        view.selectedYmd = null
        if (view.monthIndex === 0) {
          view.monthIndex = 11
          view.year -= 1
        } else {
          view.monthIndex -= 1
        }
        renderEventDetail(null)
        refresh()
        return
      }
      if (ymd === '__nav_next__') {
        view.selectedYmd = null
        if (view.monthIndex === 11) {
          view.monthIndex = 0
          view.year += 1
        } else {
          view.monthIndex += 1
        }
        renderEventDetail(null)
        refresh()
        return
      }
      view.selectedYmd = ymd
      if (hasEvent) {
        const list = byDate.get(ymd) || []
        renderEventDetail(list[0] || null)
      } else {
        renderEventDetail(null)
      }
      refresh()
    })
  }

  renderEventDetail(null)
  refresh()
}

init()
