const admin = require('firebase-admin')

function asText(value) {
  return String(value || '').trim()
}

/**
 * 1) But : centraliser l'initialisation Firebase Admin côté API Vercel.
 * 2) Variables clés : FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.
 * 3) Flux : lecture env -> normalisation clé privée -> init singleton -> renvoi firestore.
 */
function getFirestoreAdmin() {
  const projectId = asText(process.env.FIREBASE_PROJECT_ID)
  const clientEmail = asText(process.env.FIREBASE_CLIENT_EMAIL)
  const privateKeyRaw = asText(process.env.FIREBASE_PRIVATE_KEY)

  if (!projectId || !clientEmail || !privateKeyRaw) {
    throw new Error(
      'Credentials Firebase Admin manquants (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).'
    )
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKeyRaw.replace(/\\n/g, '\n')
      })
    })
  }

  return admin.firestore()
}

module.exports = { getFirestoreAdmin }

