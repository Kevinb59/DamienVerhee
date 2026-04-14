/**
 * Articles fictifs pour la phase de conception (aucun événement).
 * Médias : images locales du thème (dossier `images/` à la racine du site).
 * Même forme que les documents Firestore `articles` pour migration Firebase.
 */

/**
 * @typedef {Object} ArticleSeed
 * @property {string} id
 * @property {string} title
 * @property {string} slug
 * @property {string} excerpt
 * @property {string} summaryLine - une ligne pour l’accueil uniquement
 * @property {string} bodyHtml
 * @property {boolean} published
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {boolean} isEvent
 * @property {string|null} eventDate
 * @property {string|null} eventTime
 * @property {string|null} eventEndDate
 * @property {string|null} [eventEndTime]
 * @property {string} eventLocation
 * @property {Array<{ id: string, type: 'image', url: string, thumbUrl: string, caption?: string }>} media
 */

/**
 * Fabrique une entrée média image pointant vers `images/`.
 *
 * @param {string} id - id stable dans l’article
 * @param {string} file - nom de fichier (ex. pic03.jpg)
 * @param {string} [caption]
 */
function img(id, file, caption = '') {
  const url = `images/${file}`
  return { id, type: 'image', url, thumbUrl: url, caption }
}

/** @type {ArticleSeed[]} */
const ARTICLES = [
  /**
   * Article technique : montre toutes les options de l’éditeur Quill (titres, styles, couleurs, alignements, listes, citation, code, lien, image).
   * HTML calqué sur la sortie Quill (styles inline, pre.ql-syntax) pour un rendu identique admin / site public.
   */
  {
    id: 'seed_art_demo_formatage',
    title: 'Démo : toutes les mises en forme de l’éditeur',
    slug: 'demo-formatage-editeur',
    excerpt:
      'Référence visuelle : titres, gras, couleurs, alignements, listes, citation, bloc de code, lien et image — pour tester le rendu sur le site.',
    summaryLine:
      'Article de démonstration des styles du corps de texte (admin Quill).',
    bodyHtml: `
			<h1>HEADING 1</h1>
			<h2>HEADING 2</h2>
			<h3>HEADING 3</h3>
			<p>Normal</p>
			<p><strong>Gras</strong> / <em>Italique</em> / <u>Souligné</u> / <s>Barré</s></p>
			<p><span style="color: rgb(230, 0, 0);">Texte coloré</span></p>
			<p><span style="background-color: rgb(255, 0, 0);">Fond de texte coloré</span></p>
			<p><span style="color: rgb(255, 255, 255); background-color: rgb(204, 0, 0);">Fond et texte colorés</span></p>
			<p><span style="font-size: 14px;">Taille 14px</span> — <span style="font-size: 24px;">Taille 24px</span></p>
			<p style="text-align: left;">Alignement gauche</p>
			<p style="text-align: center;">Alignement centré</p>
			<p style="text-align: right;">Alignement droite</p>
			<p style="text-align: justify;">Alignement justifié : un peu plus de texte sur plusieurs lignes pour que l’effet soit visible dans le navigateur. L’éditeur permet d’aligner chaque paragraphe à gauche, au centre, à droite ou en justifié. En justifié, les espaces entre les mots sont égalisés pour occuper l’espace disponible.</p>
			<ol>
				<li>Ceci</li>
				<li>Est</li>
				<li>Une</li>
				<li>Liste</li>
				<li>Numérotée</li>
			</ol>
			<ul>
				<li>Ceci</li>
				<li>Est</li>
				<li>Une</li>
				<li>Liste</li>
				<li>À puces</li>
			</ul>
			<blockquote><em>Ceci est une citation.</em></blockquote>
			<pre class="ql-syntax" spellcheck="false">Ceci est un bloc de code</pre>
			<p>Ceci est un lien vers <a href="https://www.google.com" target="_blank" rel="noopener noreferrer">Google</a>.</p>
			<p><img src="images/pic01.jpg" alt="Exemple d’image insérée dans le corps du texte" /></p>
		`.trim(),
    published: true,
    createdAt: '2026-04-13T08:00:00.000Z',
    updatedAt: '2026-04-13T20:00:00.000Z',
    isEvent: false,
    eventDate: null,
    eventTime: null,
    eventEndDate: null,
    eventLocation: '',
    media: [img('m_demo', 'pic01.jpg', 'Illustration démo éditeur')]
  },
  {
    id: 'seed_art_salon',
    title: 'Retour sur un week-end au salon du livre',
    slug: 'retour-salon-du-livre',
    excerpt:
      'Des échanges intenses, des signatures jusqu’au bout de la nuit et cette impression que chaque lecteur raconte une histoire unique.',
    summaryLine:
      'Salon, fatigue joyeuse et questions de lecteurs qui éclairent le texte.',
    bodyHtml: `
			<p>Je rentre toujours épuisé et pourtant chargé d’énergie après un salon. Les questions qu’on vous pose révèlent parfois des angles sur vos propres personnages que vous n’aviez pas envisagés.</p>
			<p><img src="images/pic01.jpg" alt="" /></p>
			<p>Entre deux tables, j’ai croisé d’anciens lecteurs devenus presque des habitués. On parle moins des ventes que des moments partagés autour d’un passage qui les a marqués.</p>
			<p><img src="images/pic02.jpg" alt="" /></p>
		`.trim(),
    published: true,
    createdAt: '2025-02-18T14:30:00.000Z',
    updatedAt: '2025-02-20T09:00:00.000Z',
    isEvent: false,
    eventDate: null,
    eventTime: null,
    eventEndDate: null,
    eventLocation: '',
    media: [
      img('m_s1', 'pic01.jpg', 'Allée du salon'),
      img('m_s2', 'pic02.jpg', 'Stand et rencontres')
    ]
  },
  {
    id: 'seed_art_page_blanche',
    title: 'Le silence avant la page blanche',
    slug: 'silence-avant-page-blanche',
    excerpt:
      'Ce moment où le document est vide et où toutes les possibilités coexistent — avant que la première phrase ne tranche.',
    summaryLine: 'Trop d’idées, peur de choisir : survivre à l’écran vide.',
    bodyHtml: `
			<p>La page blanche n’est pas l’absence d’idées : c’est souvent l’inverse. Trop d’images, trop de chemins possibles, et la peur de fermer une porte en en choisissant une autre.</p>
			<p><img src="images/pic03.jpg" alt="" /></p>
			<p>Ma méthode : noter trois phrases brutes, sans les relire, puis revenir le lendemain. Rarement la bonne est dans les trois ; presque toujours elle est entre elles.</p>
		`.trim(),
    published: true,
    createdAt: '2025-02-10T11:00:00.000Z',
    updatedAt: '2025-02-12T16:45:00.000Z',
    isEvent: false,
    eventDate: null,
    eventTime: null,
    eventEndDate: null,
    eventLocation: '',
    media: [img('m_pb', 'pic03.jpg', 'Ambiance calme')]
  },
  {
    id: 'seed_art_marais',
    title: 'Carnet de bord : lumières sur le Marais poitevin',
    slug: 'carnet-marais-poitevin',
    excerpt:
      'Quand le brouillard se lève et que les reflets doublent le ciel, le décor impose son rythme aux scènes que j’écris.',
    summaryLine:
      'Ramasser des détails du Marais avant qu’ils ne deviennent phrases.',
    bodyHtml: `
			<p>Je marche souvent sans carnet, juste pour laisser les sons et les odeurs s’imprimer. Plus tard, au clavier, un détail remonte : une barque qui grince, une herbe trop haute sur le chemin.</p>
			<p><img src="images/pic04.jpg" alt="" /></p>
			<p>Ce n’est pas du reportage : c’est une réserve d’authenticité pour quand le récit a besoin de souffle.</p>
		`.trim(),
    published: true,
    createdAt: '2025-02-05T08:15:00.000Z',
    updatedAt: '2025-02-06T19:20:00.000Z',
    isEvent: false,
    eventDate: null,
    eventTime: null,
    eventEndDate: null,
    eventLocation: '',
    media: [img('m_ma', 'pic04.jpg', 'Marais au petit matin')]
  },
  {
    id: 'seed_art_inspirations',
    title: 'Lectures du mois : ce qui nourrit l’écriture',
    slug: 'lectures-du-mois-inspirations',
    excerpt:
      'Romans, essais, bandes dessinées : tout ce qui a traversé ma table de chevet et laissé une trace dans le manuscrit en cours.',
    summaryLine:
      'Ce qui se lit ce mois-ci et comment ça influence la scène du milieu.',
    bodyHtml: `
			<p>Ce mois-ci, j’ai alterné un polar nerveux et un récit plus contemplatif. Le contraste m’a aidé à équilibrer le ton d’une scène centrale que je retouchais depuis des semaines.</p>
			<p><img src="images/pic05.jpg" alt="" /></p>
			<p>Je ne cherche pas à copier : je note des gestes, des rythmes de phrases, des silences entre les dialogues.</p>
		`.trim(),
    published: true,
    createdAt: '2025-01-28T17:00:00.000Z',
    updatedAt: '2025-02-01T12:00:00.000Z',
    isEvent: false,
    eventDate: null,
    eventTime: null,
    eventEndDate: null,
    eventLocation: '',
    media: [img('m_lec', 'pic05.jpg', 'Pile de lectures')]
  },
  {
    id: 'seed_art_numerique',
    title: 'Une semaine sans fil : ce que ça change à l’atelier',
    slug: 'semaine-sans-reseaux',
    excerpt:
      'Moins de notifications, plus de pauses utiles. Retour d’expérience honnête sur une parenthèse numérique.',
    summaryLine:
      'Sept jours sans scroll : concentration retrouvée ou illusion ?',
    bodyHtml: `
			<p>J’ai coupé les réseaux pendant sept jours — pas le mail professionnel, mais tout le reste. Les premiers jours : agacement. Puis des plages de deux heures d’affilée sans me lever « pour vérifier un truc ».</p>
			<p><img src="images/pic06.jpg" alt="" /></p>
			<p>Le gain n’est pas magique en nombre de pages, mais en qualité d’attention. Je garde désormais des créneaux « avion » même quand je suis chez moi.</p>
		`.trim(),
    published: true,
    createdAt: '2025-01-20T10:30:00.000Z',
    updatedAt: '2025-01-22T14:10:00.000Z',
    isEvent: false,
    eventDate: null,
    eventTime: null,
    eventEndDate: null,
    eventLocation: '',
    media: [img('m_num', 'pic06.jpg', 'Espace de travail dégagé')]
  },
  {
    id: 'seed_art_club',
    title: 'Club de lecture : trois questions qui ont fait débat',
    slug: 'club-de-lecture-trois-questions',
    excerpt:
      'Le personnage était-il coupable de naïveté ? La fin vous a-t-elle semblé juste ? Voici ce qui est ressorti de notre dernière séance.',
    summaryLine:
      'Quand les lecteurs réinterprètent une scène que vous croyiez close.',
    bodyHtml: `
			<p>On était une quinzaine, autour d’un café trop petit et d’un gâteau partagé en trop petites parts — classique. La discussion a dévié sur la responsabilité des adultes dans les choix des adolescents du roman.</p>
			<p><img src="images/pic07.jpg" alt="" /></p>
			<p>Je n’interviens jamais pour « trancher » : le texte appartient aux lecteurs. En revanche, j’adore quand une scène que j’avais écrite vite prend une autre lecture collective.</p>
		`.trim(),
    published: true,
    createdAt: '2025-01-12T15:45:00.000Z',
    updatedAt: '2025-01-14T09:30:00.000Z',
    isEvent: false,
    eventDate: null,
    eventTime: null,
    eventEndDate: null,
    eventLocation: '',
    media: [img('m_club', 'pic07.jpg', 'Échanges avec les lecteurs')]
  },
  {
    id: 'seed_art_musique',
    title: 'Playlist d’écriture : bruit blanc ou morceaux précis ?',
    slug: 'playlist-ecriture-musique',
    excerpt:
      'J’alterne selon les chapitres : parfois le silence, parfois une même piste en boucle jusqu’à ce que la scène tienne debout.',
    summaryLine: 'Silence, boucle ou playlist : adapter le son à chaque scène.',
    bodyHtml: `
			<p>Les scènes d’action tolèrent souvent un rythme plus appuyé ; les dialogues intimes, presque jamais. J’ai testé le bruit de pluie enregistré : efficace pour les retours sur des passages déjà écrits, moins pour inventer.</p>
			<p><img src="images/pic08.jpg" alt="" /></p>
			<p>L’important est de ne pas se battre contre son propre rituel : si ça marche, on garde ; si ça distrait, on coupe.</p>
		`.trim(),
    published: true,
    createdAt: '2025-01-05T13:00:00.000Z',
    updatedAt: '2025-01-08T11:25:00.000Z',
    isEvent: false,
    eventDate: null,
    eventTime: null,
    eventEndDate: null,
    eventLocation: '',
    media: [img('m_mus', 'pic08.jpg', 'Ambiance sonore')]
  },
  {
    id: 'seed_art_manuscrit',
    title: 'Coulisses : premières notes du prochain roman',
    slug: 'coulisses-prochain-roman',
    excerpt:
      'Fiches personnages, frise chronologique bancale et une scène d’ouverture réécrite onze fois — le chantier avant le chantier.',
    summaryLine:
      'Brouillons, dates bancales et une image qui change un personnage.',
    bodyHtml: `
			<p>Je ne montre presque jamais ces brouillons. Ce sont des griffonnages, des flèches entre des dates incohérentes, des post-it qui se décollent. Pourtant, sans cette phase, le livre suivant resterait une intention.</p>
			<p><img src="images/pic09.jpg" alt="" /></p>
			<p>Une image m’est revenue en boucle cette semaine ; je l’ai collée au mur pour ne pas la perdre. Elle ne figurera peut-être pas dans le livre, mais elle a déjà modifié le regard d’un personnage secondaire.</p>
			<p><img src="images/pic01.jpg" alt="" /></p>
		`.trim(),
    published: true,
    createdAt: '2024-12-20T09:40:00.000Z',
    updatedAt: '2025-01-02T18:00:00.000Z',
    isEvent: false,
    eventDate: null,
    eventTime: null,
    eventEndDate: null,
    eventLocation: '',
    media: [
      img('m_ms1', 'pic09.jpg', 'Notes et repères'),
      img('m_ms2', 'pic01.jpg', 'Élément visuel du moodboard')
    ]
  },
  {
    id: 'seed_art_relecture',
    title: 'Relecture : quand il faut tuer ses phrases préférées',
    slug: 'relecture-tuer-ses-phrases',
    excerpt:
      'Celle qu’on aime trop sonne souvent faux à la lecture à voix haute. Petit inventaire des passages sacrifiés la semaine dernière.',
    summaryLine:
      'Supprimer la phrase qu’on aimait trop : petite trahison nécessaire.',
    bodyHtml: `
			<p>La relecture est une phase de trahison nécessaire : trahison envers l’euphorie du premier jet. J’ai supprimé une métaphore que je trouvais brillante ; elle volait la scène au personnage.</p>
			<p><img src="images/pic02.jpg" alt="" /></p>
			<p>Conseil de copiste : lire à voix basse les dialogues. Si vous hésitez sur une respiration, la ponctuation n’est pas encore la bonne.</p>
		`.trim(),
    published: true,
    createdAt: '2024-12-08T14:00:00.000Z',
    updatedAt: '2024-12-10T10:15:00.000Z',
    isEvent: false,
    eventDate: null,
    eventTime: null,
    eventEndDate: null,
    eventLocation: '',
    media: [img('m_rel', 'pic02.jpg', 'Pages annotées')]
  },
  {
    id: 'seed_art_poste',
    title: 'Lettre ouverte aux retardataires de la poste',
    slug: 'lettre-ouverte-retardataires-poste',
    excerpt:
      'Texte léger sur les cartes manuscrites encore glissées dans des romans, et ce plaisir vieille école d’ouvrir une enveloppe.',
    summaryLine:
      'Cartes, timbres de travers : un geste qui n’a rien d’une stratégie.',
    bodyHtml: `
			<p>Je continue d’envoyer des cartes à des lecteurs qui en font la demande. Ce n’est pas scalable, ce n’est pas « stratégie » : c’est un geste qui me rappelle pourquoi j’ai commencé à écrire.</p>
			<p><img src="images/pic03.jpg" alt="" /></p>
			<p>Si un jour tout est dématérialisé, il restera au moins cette photo d’un timbre mal collé et d’une encre qui a un peu bavé.</p>
		`.trim(),
    published: true,
    createdAt: '2024-11-25T11:20:00.000Z',
    updatedAt: '2024-11-28T16:40:00.000Z',
    isEvent: false,
    eventDate: null,
    eventTime: null,
    eventEndDate: null,
    eventLocation: '',
    media: [img('m_post', 'pic03.jpg', 'Courrier et papeterie')]
  },
  /** Événements (calendrier d’accueil) — dates en avril 2026 pour la démo. */
  {
    id: 'seed_evt_club_ocean',
    title: 'Club de lecture — « Le silence de l’océan »',
    slug: 'club-lecture-silence-ocean',
    excerpt:
      'Échanges autour du huitième roman : personnages, structure et ce que la critique a relevé. Inscriptions limitées.',
    summaryLine: '',
    bodyHtml: `
			<p>Une soirée dédiée aux questions de lecture collective autour du roman. Inscription recommandée.</p>
		`.trim(),
    published: true,
    createdAt: '2026-03-10T10:00:00.000Z',
    updatedAt: '2026-03-10T10:00:00.000Z',
    isEvent: true,
    eventDate: '2026-04-12',
    eventTime: '19:00',
    eventEndDate: null,
		eventEndTime: null,
    eventLocation: 'Médiathèque du Marais',
    media: []
  },
  {
    id: 'seed_evt_dedicace',
    title: 'Dédicace — Librairie Pages du Marais',
    slug: 'dedicace-pages-du-marais',
    excerpt:
      'Rencontre et signatures : romans historiques, thrillers et dernier ouvrage. Échanges libres avec les lecteurs.',
    summaryLine: '',
    bodyHtml:
      `<p>Retrouvez-moi pour une séance de dédicaces et de discussion autour des parcours de lecture.</p>`.trim(),
    published: true,
    createdAt: '2026-03-12T11:00:00.000Z',
    updatedAt: '2026-03-12T11:00:00.000Z',
    isEvent: true,
    eventDate: '2026-04-18',
    eventTime: '15:00',
    eventEndDate: null,
		eventEndTime: null,
    eventLocation: 'Librairie Pages du Marais',
    media: []
  },
  {
    id: 'seed_evt_salon_regional',
    title: 'Salon régional du livre',
    slug: 'salon-regional-livre-2026',
    excerpt:
      'Stand partagé avec des auteurs de la région : tables rondes, dédicaces et animations autour des premières pages.',
    summaryLine: '',
    bodyHtml:
      `<p>Week-end dédié aux rencontres avec le public et aux échanges entre auteurs.</p>`.trim(),
    published: true,
    createdAt: '2026-03-15T09:00:00.000Z',
    updatedAt: '2026-03-15T09:00:00.000Z',
    isEvent: true,
    eventDate: '2026-04-25',
    eventTime: '10:00',
    eventEndDate: '2026-04-27',
		eventEndTime: null,
    eventLocation: 'Parc des expositions — Hall B',
    media: []
  }
]

/**
 * @returns {ArticleSeed[]}
 */
export function getSeedArticles() {
  return ARTICLES
}
