/* eslint-disable no-console */
const fs = require('fs')
const path = require('path')
const admin = require('firebase-admin')

/**
 * 1) But : générer un snapshot public statique depuis Firestore.
 * 2) Variables clés : credentials Firebase Admin en variables d'environnement.
 * 3) Flux : lecture collections -> tri -> écriture module JS consommé côté front.
 */
function readEnv(name) {
  const value = String(process.env[name] || '').trim()
  return value
}

function getServiceAccountFromEnv() {
  const projectId = readEnv('FIREBASE_PROJECT_ID')
  const clientEmail = readEnv('FIREBASE_CLIENT_EMAIL')
  const privateKey = readEnv('FIREBASE_PRIVATE_KEY')
  if (!projectId || !clientEmail || !privateKey) {
    return null
  }
  return {
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, '\n')
  }
}

function ensureFirebaseAdmin(serviceAccount) {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    })
  }
  return admin.firestore()
}

async function readCollection(db, name) {
  const snap = await db.collection(name).get()
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
}

function sortContent(content) {
  content.articles.sort((a, b) =>
    String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
  )
  content.galleryAlbums.sort(
    (a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)
  )
  content.galleryItems.sort((a, b) => {
    const albumCmp = String(a.albumId || '').localeCompare(String(b.albumId || ''))
    if (albumCmp !== 0) {
      return albumCmp
    }
    return Number(a.sortOrder || 0) - Number(b.sortOrder || 0)
  })
  content.products.sort(
    (a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)
  )
}

function writeGeneratedModule(content) {
  const targetPath = path.resolve(
    __dirname,
    '../js/app/data/site-content.generated.js'
  )
  const body = `/**\n * Données publiques statiques générées au build depuis Firestore.\n * Fichier auto-généré par scripts/generate-site-content.js.\n */\nexport const SITE_CONTENT = ${JSON.stringify(
    content,
    null,
    2
  )}\n`
  fs.writeFileSync(targetPath, body, 'utf8')
  console.log(
    `[generate-site-content] Fichier généré: ${targetPath} (${content.articles.length} articles, ${content.products.length} produits)`
  )
}

async function run() {
  const serviceAccount = getServiceAccountFromEnv()
  if (!serviceAccount) {
    console.warn(
      '[generate-site-content] Variables Firebase Admin absentes: generation d’un snapshot vide.'
    )
    writeGeneratedModule({
      generatedAt: new Date().toISOString(),
      articles: [],
      galleryAlbums: [],
      galleryItems: [],
      products: []
    })
    return
  }
  const db = ensureFirebaseAdmin(serviceAccount)
  const content = {
    generatedAt: new Date().toISOString(),
    articles: await readCollection(db, 'articles'),
    galleryAlbums: await readCollection(db, 'galleryAlbums'),
    galleryItems: await readCollection(db, 'galleryItems'),
    products: await readCollection(db, 'products')
  }
  sortContent(content)
  writeGeneratedModule(content)
}

run().catch((error) => {
  console.error('[generate-site-content] Erreur:', error)
  process.exit(1)
})

