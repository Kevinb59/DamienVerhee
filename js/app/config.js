/**
 * Configuration runtime du site (Vercel / GitHub Pages / local).
 * Objectif : basculer de la fausse BDD (mémoire + modules seed) vers Firebase sans retoucher les pages.
 *
 * Variables clés :
 * - window.__APP_DATA_PROVIDER__ : 'static' | 'mock' | 'firebase' (défaut : static)
 * - window.__FIREBASE_CONFIG__ : objet config Firebase (apiKey, projectId, …) quand le provider est firebase
 */

/**
 * Lit le provider de données actif.
 * @returns {'static'|'mock'|'firebase'}
 */
export function getDataProvider() {
  // Priorité : variable globale injectée avant les modules (ex. snippet dans index.html ou Vercel)
  if (
    typeof window !== 'undefined' &&
    window.__APP_DATA_PROVIDER__ === 'static'
  ) {
    return 'static'
  }
  if (
    typeof window !== 'undefined' &&
    window.__APP_DATA_PROVIDER__ === 'firebase'
  ) {
    return 'firebase'
  }
  return 'static'
}

/**
 * Config Firebase client (pour initialisation ultérieure dans firebaseRepository).
 * @returns {Record<string, unknown>|null}
 */
export function getFirebaseClientConfig() {
  if (
    typeof window !== 'undefined' &&
    window.__FIREBASE_CONFIG__ &&
    typeof window.__FIREBASE_CONFIG__ === 'object'
  ) {
    return window.__FIREBASE_CONFIG__
  }
  return null
}

/**
 * Identifiant logique de l’album unique « dynamique » (médias issus des articles).
 * Utilisé en UI pour filtrer ; les données fixes utilisent d’autres albumId.
 */
export const DYNAMIC_GALLERY_ALBUM_ID = '__dynamic_article_media__'
