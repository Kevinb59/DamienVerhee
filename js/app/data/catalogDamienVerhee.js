/**
 * Catalogue « fausse BDD » : ouvrages de Damien Verhée.
 * Sources : résumés et couvertures Babelio (https://www.babelio.com/auteur/Damien-Verhee/556017/bibliographie).
 * Pour *Le chant du Marais* et *Le sang du Marais*, les jaquettes affichées sur Babelio pointent vers Amazon — mêmes URL que sur la fiche auteur.
 * Liens d’achat : boutique SumUp (https://damien-verhee-auteur.sumupstore.com/) ;
 * chaque produit publié pointe vers son URL /article/... dédiée.
 */

/**
 * @typedef {Object} CatalogBookSeed
 * @property {string} id
 * @property {string} title
 * @property {string} imageUrl
 * @property {string} synopsis
 * @property {number} priceCents
 * @property {string} currency
 * @property {boolean} promo
 * @property {number|null} priceBeforePromoCents
 * @property {string} sumupUrl
 * @property {boolean} published
 */

/** @type {CatalogBookSeed[]} */
export const CATALOG_BOOKS = [
  {
    id: 'seed_livre_homme_tomates',
    title: "L'homme qui regardait pousser les tomates",
    imageUrl:
      'https://www.babelio.com/couv/cvt_Lhomme-qui-regardait-pousser-les-tomates_4945.jpg',
    synopsis:
      "Romain vit en ascète, consacrant son existence à l'écoute des autres. Il pérégrine de ville en ville. Emmanuelle est une femme épanouie, heureuse et bien dans son couple. Ils se rencontrent au hasard de la vie. Tout les oppose et de cette discussion naît l'envie de se retrouver. Seulement, voilà, sans avoir échangé ni numéro de téléphone, ni même un nom ou une adresse, comment Romain peut-il espérer la revoir ?",
    priceCents: 1690,
    currency: 'EUR',
    promo: false,
    priceBeforePromoCents: null,
    sumupUrl:
      'https://damien-verhee-auteur.sumupstore.com/article/l-homme-qui-regardait-pousser-les-tomates',
    published: true
  },
  {
    id: 'seed_livre_pour_eternite',
    title: 'Pour une éternité',
    imageUrl: 'https://www.babelio.com/couv/cvt_Pour-une-eternite_9270.jpg',
    synopsis:
      "Saint-Hilaire-la-Palud, Poitou. 1913 : Louis est colombophile et profite de l'insouciance de ses 17 ans. Jeanne, 18 ans, est infirmière à Niort. Ils se rencontrent sans se douter que cette rencontre sera éternelle. 1914 gronde et l'Europe se suicide dans un effroyable conflit meurtrier. Louis est mobilisé, leurs vies vont basculer. La seconde partie de l'ouvrage se déguste à l'envers, de la fin présumée jusqu'au cœur du récit.",
    priceCents: 1890,
    currency: 'EUR',
    promo: false,
    priceBeforePromoCents: null,
    sumupUrl:
      'https://damien-verhee-auteur.sumupstore.com/article/pour-une-eternite',
    published: true
  },
  {
    id: 'seed_livre_silence_ocean',
    title: "Le silence de l'océan",
    imageUrl: 'https://www.babelio.com/couv/cvt_Le-silence-de-locean_3932.jpg',
    synopsis:
      "Lorsque Sophie découvre l'adultère de son mari, sa vie chavire. Coincée entre leurs deux enfants et un travail exigeant, elle décide de rester malgré tout avec lui. Mais c'est sans compter sa rencontre avec Romain, acteur de théâtre à la renommée croissante. Lui aussi est marié, mais son couple est en plein bouleversement. Ces deux âmes perdues étaient faites pour se croiser et s'apprivoiser. Pourtant, leurs choix de vie respectifs les rattrapent.",
    priceCents: 2290,
    currency: 'EUR',
    promo: false,
    priceBeforePromoCents: null,
    sumupUrl:
      'https://damien-verhee-auteur.sumupstore.com/article/le-silence-de-l-ocean-collector-bleu',
    published: true
  },
  {
    id: 'seed_livre_90_jours_lynx',
    title: 'Les 90 jours du lynx',
    imageUrl: 'https://www.babelio.com/couv/cvt_Les-90-jours-du-lynx_5730.jpg',
    synopsis:
      "Alexandre Bouteiller est un génie précoce. Tout lui réussit dans la vie. De Paris à Lausanne, en passant par Lille, il assume une vie de star médiatique et reconnue. Auteur de best-sellers mondiaux, il est la proie des paparazzi qui se régalent de ses frasques. On l'aime ou on le déteste, mais il ne laisse pas indifférent. Fier, charmeur, il enchaîne les conquêtes autant que les succès — jusqu'au jour où sa vie bascule.",
    priceCents: 1950,
    currency: 'EUR',
    promo: false,
    priceBeforePromoCents: null,
    sumupUrl: 'https://damien-verhee-auteur.sumupstore.com/article/les-90-jours-du-lynx',
    published: true
  },
  {
    id: 'seed_livre_laisser_faner',
    title: 'Laisser faner les roses',
    imageUrl:
      'https://www.babelio.com/couv/cvt_Laisser-faner-les-roses_8548.jpg',
    synopsis:
      "En plein chaos dans sa vie, Julia se retrouve seule et sans emploi. À l'occasion du décès de sa mère, une interrogation s'impose : qui étaient réellement ses parents ? Ses premières recherches la propulsent soudain au cœur du danger ; les événements s'enchaînent sans lui laisser le moindre répit. Entre services secrets et machinations mortelles, son quotidien est bouleversé. Sous la menace de l'inquiétant Pietr, elle doit survivre.",
    priceCents: 1890,
    currency: 'EUR',
    promo: false,
    priceBeforePromoCents: null,
    sumupUrl:
      'https://damien-verhee-auteur.sumupstore.com/article/laisser-faner-les-roses',
    published: true
  },
  {
    id: 'seed_livre_treblinka',
    title: 'Bienvenue à Treblinka !',
    imageUrl:
      'https://www.babelio.com/couv/cvt_Bienvenue-a-Treblinka-_7101.jpg',
    synopsis:
      "Une histoire dans l'Histoire : celle de Delphin, le grand-père de l'auteur, à travers un roman historique sur la Seconde Guerre mondiale. En 1939, Delphin a 30 ans. Cheminot syndiqué à la CGT dans le Pas-de-Calais, près de Béthune, il mène une vie paisible auprès de sa femme Marie-Laure et de leur fille. Mais la guerre éclate, et un drame dont il est témoin fait basculer son destin : le massacre de Lestrem ouvre la voie à une épreuve inouïe.",
    priceCents: 2190,
    currency: 'EUR',
    promo: false,
    priceBeforePromoCents: null,
    sumupUrl:
      'https://damien-verhee-auteur.sumupstore.com/article/bienvenue-a-treblinka',
    published: true
  },
  {
    id: 'seed_livre_chant_marais',
    title: 'Le chant du Marais',
    imageUrl: 'https://m.media-amazon.com/images/I/41nvtgfAHqL._SX95_.jpg',
    synopsis:
      "Dans un petit village où le Marais poitevin semble chanter sa précieuse nature, Julien est un adolescent de 17 ans, plus en réussite dans la musique que dans sa scolarité. Sa jumelle, Jade, est sa parfaite opposée. Autour d'eux gravitent de nombreuses personnalités, dont Thierry, important entrepreneur qui délaisse son épouse, Hélène. Le décès d'une jeune fille sème le trouble : les habitants basculent dans l'hystérie d'événements inquiétants.",
    priceCents: 1690,
    currency: 'EUR',
    promo: false,
    priceBeforePromoCents: null,
    sumupUrl: 'https://damien-verhee-auteur.sumupstore.com/',
    published: false
  },
  {
    id: 'seed_livre_sang_marais',
    title: 'Le sang du Marais',
    imageUrl: 'https://m.media-amazon.com/images/I/51gdBAtQUkL._SX95_.jpg',
    synopsis:
      "Cinq années après les terribles événements qui avaient secoué le village de Saint-Hilaire-la-Palud, dans le Marais sauvage, une succession de faits tout aussi dramatiques vient semer à nouveau la terreur. On retrouve les personnages du premier tome : que sont devenus Hélène, Laura, l'adjudant-chef Marescaux, Jade, Eléa, et le groupe Ekaliptus ? Un thriller qui prolonge *Le chant du Marais*.",
    priceCents: 1690,
    currency: 'EUR',
    promo: false,
    priceBeforePromoCents: null,
    sumupUrl: 'https://damien-verhee-auteur.sumupstore.com/',
    published: false
  },
  {
    id: 'seed_livre_evaille_mots',
    title: "L'évaille des mots",
    imageUrl: 'https://www.babelio.com/couv/cvt_Levaille-des-mots_2024.jpg',
    synopsis:
      "« L'évaille des mots » vous emmène au fil de la lecture à contre-courant dans une rivière en crue d'écrits : de chapitre en chapitre, de l'amour à la mort en passant par la rupture ou des questions de société. D'émotions en partages où une part de chacun saura résonner. Des textes d'un soir où l'imagination déborde, un cœur en désordre — la voix d'un auteur aussi parolier que romancier.",
    priceCents: 1290,
    currency: 'EUR',
    promo: false,
    priceBeforePromoCents: null,
    sumupUrl:
      'https://damien-verhee-auteur.sumupstore.com/article/l-evaille-des-mots',
    published: true
  }
]

/**
 * Produit prêt pour le state (avec ordre d’affichage).
 * @returns {Array<CatalogBookSeed & { sortOrder: number }>}
 */
export function getDefaultProducts() {
  return CATALOG_BOOKS.map((p, index) => ({
    ...p,
    sortOrder: index
  }))
}
