/**
 * Implémentation Firestore / Storage (à brancher quand la BDD Firebase sera prête).
 *
 * Collections prévues (même schéma que mockRepository) :
 * - articles          — documents ArticleRecord
 * - galleryAlbums     — albums galerie fixe uniquement
 * - galleryItems      — médias galerie fixe (champ albumId)
 * - products          — fiches boutique
 *
 * Fichiers médias : Firebase Storage ; les URL publiques sont stockées dans bodyHtml / media / galleryItems.
 *
 * Étapes d’intégration :
 * 1. npm i firebase
 * 2. Initialiser l’app avec getFirebaseClientConfig() depuis config.js
 * 3. Remplir chaque fonction ci-dessous (getDocs, setDoc, etc.)
 * 4. Définir window.__APP_DATA_PROVIDER__ = 'firebase' et window.__FIREBASE_CONFIG__ sur chaque page (ou build Vercel)
 */

import { getFirebaseClientConfig } from '../config.js'

function notReady() {
  const cfg = getFirebaseClientConfig()
  if (!cfg) {
    return Promise.reject(
      new Error(
        'Firebase : définir window.__FIREBASE_CONFIG__ (apiKey, projectId, …).'
      )
    )
  }
  return Promise.reject(
    new Error(
      'Firebase : implémenter les requêtes dans js/app/data/firebaseRepository.js (voir commentaires du fichier).'
    )
  )
}

let firebaseStorageCtx = null

/**
 * Déduit le type logique de média depuis le MIME.
 *
 * @param {File} file
 * @returns {'image'|'video'}
 */
function detectMediaKind(file) {
  const mime = String(file?.type || '').toLowerCase()
  return mime.startsWith('video/') ? 'video' : 'image'
}

/**
 * Initialise Firebase Storage en import dynamique ESM (sans bundler).
 *
 * 1) But : permettre l’upload direct depuis le navigateur admin.
 * 2) Variables clés :
 *    - cfg : config client injectée via window.__FIREBASE_CONFIG__.
 *    - app/storage : singletons mis en cache pour éviter les ré-inits.
 * 3) Flux :
 *    - import des modules Firebase depuis CDN gstatic
 *    - initApp + getStorage une seule fois
 *
 * @returns {Promise<{ storage: import('firebase/storage').FirebaseStorage, api: any }>}
 */
async function getFirebaseStorageContext() {
  if (firebaseStorageCtx) {
    return firebaseStorageCtx
  }
  const cfg = getFirebaseClientConfig()
  if (!cfg) {
    throw new Error(
      'Firebase non configuré : définir window.__FIREBASE_CONFIG__ avant admin-main.js.'
    )
  }
  const appMod = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js')
  const storageMod = await import(
    'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js'
  )
  const app = appMod.initializeApp(cfg)
  const storage = storageMod.getStorage(app)
  firebaseStorageCtx = { storage, api: storageMod }
  return firebaseStorageCtx
}

/**
 * Upload un fichier vers Firebase Storage et renvoie son URL publique.
 *
 * @param {File} file
 * @param {{ folder?: string }} [opts]
 * @returns {Promise<{ url: string, kind: 'image'|'video' }>}
 */
export async function uploadMediaAsset(file, opts = {}) {
  if (!(file instanceof File)) {
    throw new Error('Aucun fichier valide à envoyer.')
  }
  const { storage, api } = await getFirebaseStorageContext()

  // 1) Organisation des fichiers par dossier fonctionnel (articles/galerie/produits).
  const folder = String(opts.folder || 'uploads').replace(/[^a-z0-9/_-]/gi, '_')
  const safeName = String(file.name || 'media').replace(/[^a-z0-9._-]/gi, '_')
  const ext = safeName.includes('.') ? '' : file.type === 'video/mp4' ? '.mp4' : '.bin'
  const key = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}${ext}`

  // 2) Upload binaire + récupération URL signée publique (download URL).
  const fileRef = api.ref(storage, key)
  await api.uploadBytes(fileRef, file, {
    contentType: file.type || undefined
  })
  const url = await api.getDownloadURL(fileRef)

  return {
    url,
    kind: detectMediaKind(file)
  }
}

export const listArticles = () => notReady()
export const getArticle = () => notReady()
export const getArticleBySlug = () => notReady()
export const saveArticle = () => notReady()
export const deleteArticle = () => notReady()

export const listGalleryAlbums = () => notReady()
export const saveGalleryAlbum = () => notReady()
export const deleteGalleryAlbum = () => notReady()
export const listGalleryItems = () => notReady()
export const saveGalleryItem = () => notReady()
export const deleteGalleryItem = () => notReady()
export const reorderGalleryItems = () => notReady()

export const listProducts = () => notReady()
export const getProduct = () => notReady()
export const saveProduct = () => notReady()
export const deleteProduct = () => notReady()

/**
 * Agrégation côté client ou Cloud Function : même résultat que mockRepository.listDynamicGalleryItems.
 */
export const listDynamicGalleryItems = () => notReady()

/** Même agrégation que mockRepository.listLatestCombinedGalleryMedia (requête / index côté client ou CF). */
export const listLatestCombinedGalleryMedia = () => notReady()
