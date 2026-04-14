/**
 * Façade unique pour les pages : mock en mémoire (seed JS) ou Firebase selon la config.
 * Les pages importent uniquement ce module pour rester inchangées au moment du basculement.
 */

import { getDataProvider } from './config.js'
import * as mockRepository from './data/mockRepository.js'
import * as firebaseRepository from './data/firebaseRepository.js'

/**
 * @returns {typeof mockRepository}
 */
function repo() {
  return getDataProvider() === 'firebase' ? firebaseRepository : mockRepository
}

export const listArticles = (opts) => repo().listArticles(opts)
export const getArticle = (id) => repo().getArticle(id)
export const getArticleBySlug = (slug) => repo().getArticleBySlug(slug)
export const saveArticle = (data) => repo().saveArticle(data)
export const deleteArticle = (id) => repo().deleteArticle(id)

export const listGalleryAlbums = () => repo().listGalleryAlbums()
export const saveGalleryAlbum = (data) => repo().saveGalleryAlbum(data)
export const deleteGalleryAlbum = (id) => repo().deleteGalleryAlbum(id)
export const listGalleryItems = (albumId) => repo().listGalleryItems(albumId)
export const saveGalleryItem = (data) => repo().saveGalleryItem(data)
export const deleteGalleryItem = (id) => repo().deleteGalleryItem(id)
export const reorderGalleryItems = (albumId, ids) =>
  repo().reorderGalleryItems(albumId, ids)

export const listProducts = (opts) => repo().listProducts(opts)
export const getProduct = (id) => repo().getProduct(id)
export const saveProduct = (data) => repo().saveProduct(data)
export const deleteProduct = (id) => repo().deleteProduct(id)

export const listDynamicGalleryItems = () => repo().listDynamicGalleryItems()
export const listLatestCombinedGalleryMedia = (limit) =>
  repo().listLatestCombinedGalleryMedia(limit)

/**
 * Upload média (image/vidéo) via le provider actif.
 * - mock: renvoie une DataURL locale
 * - firebase: upload Firebase Storage puis URL publique
 *
 * @param {File} file
 * @param {{ folder?: string }} [opts]
 * @returns {Promise<{ url: string, kind: 'image'|'video' }>}
 */
export const uploadMediaAsset = (file, opts) => repo().uploadMediaAsset(file, opts)

/**
 * Derniers articles publiés triés par date de création (plus récent en premier).
 *
 * @param {number} [limit]
 * @returns {Promise<object[]>}
 */
export async function listLatestArticles(limit = 3) {
  const all = await listArticles({ publishedOnly: true })
  all.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  return all.slice(0, limit)
}

/**
 * Articles marqués comme événements (réutilisables ailleurs sur le site : agenda, blocs d’accueil, etc.).
 *
 * @param {{ upcomingOnly?: boolean }} [opts]
 * @returns {Promise<import('./data/mockRepository.js').ArticleRecord[]>}
 */
export async function listEventArticles(opts = {}) {
  const all = await listArticles({ publishedOnly: true })
  let events = all.filter((a) => a.isEvent)
  if (opts.upcomingOnly) {
    const today = new Date().toISOString().slice(0, 10)
    events = events.filter((a) => a.eventDate && a.eventDate >= today)
  }
  events.sort((a, b) =>
    String(a.eventDate || '').localeCompare(String(b.eventDate || ''))
  )
  return events
}

/**
 * Formatage prix pour affichage (EUR par défaut).
 *
 * @param {number} cents
 * @param {string} [currency]
 * @returns {string}
 */
export function formatPrice(cents, currency = 'EUR') {
  const v = (Number(cents) || 0) / 100
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency
    }).format(v)
  } catch {
    return `${v.toFixed(2)} ${currency}`
  }
}
