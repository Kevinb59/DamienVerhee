/**
 * Albums et médias galerie « fixe » fictifs (chemins locaux sous `images/`).
 * Même forme que les collections Firestore `galleryAlbums` / `galleryItems` pour bascule Firebase.
 */

/**
 * Construit une URL relative vers un fichier dans un sous-dossier de `images/`.
 * Les noms réels peuvent contenir espaces ou casse mixte : encodage du segment fichier uniquement.
 *
 * @param {string} subDir - ex. `articles`, `prix-et-recompenses`
 * @param {string} fileName - nom exact du fichier sur disque
 * @returns {string}
 */
function imageUrl(subDir, fileName) {
  const safe = String(fileName || '')
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/')
  return `images/${subDir}/${safe}`
}

/** @type {Array<{ id: string, title: string, sortOrder: number }>} */
const ALBUMS = [
  { id: 'seed_album_dedicaces', title: 'Photos de dédicaces', sortOrder: 0 },
  {
    id: 'seed_album_presse',
    title: 'Revue de presse',
    sortOrder: 1
  },
  {
    id: 'seed_album_prix',
    title: 'Prix et récompenses',
    sortOrder: 2
  },
  {
    id: 'seed_album_humour',
    title: 'Humour',
    sortOrder: 3
  }
]

/**
 * Médias initiaux : fichiers dans `images/articles/`, `images/prix-et-recompenses/`, `images/humour/`.
 * sortOrder définit l’ordre d’affichage dans chaque album ; addedAt fixe pour un tri stable hors session admin.
 *
 * @type {Array<{ id: string, albumId: string, type: 'image', url: string, thumbUrl: string, caption: string, sortOrder: number, addedAt: string }>}
 */
const ITEMS = [
  {
    id: 'seed_gi_presse_courrier_ouest',
    albumId: 'seed_album_presse',
    type: 'image',
    url: imageUrl('articles', 'article courrier de l ouest 1 3 22.jpg'),
    thumbUrl: imageUrl('articles', 'article courrier de l ouest 1 3 22.jpg'),
    caption: 'Courrier de l’Ouest — mars 2022 (extrait fictif pour maquette).',
    sortOrder: 0,
    addedAt: '2025-03-01T10:00:00.000Z'
  },
  {
    id: 'seed_gi_presse_nr_janv',
    albumId: 'seed_album_presse',
    type: 'image',
    url: imageUrl('articles', 'ARTICLE NOUVELLE REPUBLIQUE JANVIER 2022.JPG'),
    thumbUrl: imageUrl('articles', 'ARTICLE NOUVELLE REPUBLIQUE JANVIER 2022.JPG'),
    caption: 'La Nouvelle République — janvier 2022.',
    sortOrder: 1,
    addedAt: '2025-03-01T10:01:00.000Z'
  },
  {
    id: 'seed_gi_presse_nr_fev',
    albumId: 'seed_album_presse',
    type: 'image',
    url: imageUrl('articles', 'article NR fevrier 2025.jpg'),
    thumbUrl: imageUrl('articles', 'article NR fevrier 2025.jpg'),
    caption: 'La Nouvelle République — février 2025.',
    sortOrder: 2,
    addedAt: '2025-03-01T10:02:00.000Z'
  },
  {
    id: 'seed_gi_prix_litteraire',
    albumId: 'seed_album_prix',
    type: 'image',
    url: imageUrl('prix-et-recompenses', 'PRIX LITTERAIRE.webp'),
    thumbUrl: imageUrl('prix-et-recompenses', 'PRIX LITTERAIRE.webp'),
    caption: 'Prix littéraire — visuel de démonstration.',
    sortOrder: 0,
    addedAt: '2025-03-02T10:00:00.000Z'
  },
  /**
   * Album humour : visuels locaux `images/humour/*.png` (maquette ; légendes fictives).
   */
  {
    id: 'seed_gi_humour_bellucci',
    albumId: 'seed_album_humour',
    type: 'image',
    url: imageUrl('humour', 'bellucci.png'),
    thumbUrl: imageUrl('humour', 'bellucci.png'),
    caption: 'Humour — pastiche (maquette).',
    sortOrder: 0,
    addedAt: '2025-03-03T10:00:00.000Z'
  },
  {
    id: 'seed_gi_humour_goldman',
    albumId: 'seed_album_humour',
    type: 'image',
    url: imageUrl('humour', 'goldman.png'),
    thumbUrl: imageUrl('humour', 'goldman.png'),
    caption: 'Humour — pastiche (maquette).',
    sortOrder: 1,
    addedAt: '2025-03-03T10:01:00.000Z'
  },
  {
    id: 'seed_gi_humour_graig',
    albumId: 'seed_album_humour',
    type: 'image',
    url: imageUrl('humour', 'graig.png'),
    thumbUrl: imageUrl('humour', 'graig.png'),
    caption: 'Humour — pastiche (maquette).',
    sortOrder: 2,
    addedAt: '2025-03-03T10:02:00.000Z'
  },
  {
    id: 'seed_gi_humour_musk',
    albumId: 'seed_album_humour',
    type: 'image',
    url: imageUrl('humour', 'musk.png'),
    thumbUrl: imageUrl('humour', 'musk.png'),
    caption: 'Humour — pastiche (maquette).',
    sortOrder: 3,
    addedAt: '2025-03-03T10:03:00.000Z'
  }
]

/**
 * @returns {typeof ALBUMS}
 */
export function getSeedGalleryAlbums() {
  return ALBUMS
}

/**
 * @returns {typeof ITEMS}
 */
export function getSeedGalleryItems() {
  return ITEMS
}
