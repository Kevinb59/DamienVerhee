import { getFirebaseClientConfig } from '../config.js';

let firebaseAuthContext = null;

/**
 * Initialise Firebase App/Auth une seule fois pour la session admin.
 *
 * 1) Purpose:
 *    - Centraliser l'init Firebase pour l'authentification admin.
 * 2) Key variables:
 *    - cfg: configuration client Firebase injectee cote HTML.
 *    - app/auth: instances Firebase conservees en cache.
 * 3) Logic flow:
 *    - verifier la presence de la config
 *    - importer dynamiquement firebase-app et firebase-auth
 *    - initialiser puis retourner le contexte
 *
 * @returns {Promise<{ auth: import('firebase/auth').Auth, authApi: any }>}
 */
async function getFirebaseAuthContext() {
	if (firebaseAuthContext) {
		return firebaseAuthContext;
	}
	const cfg = getFirebaseClientConfig();
	if (!cfg) {
		throw new Error(
			'Configuration Firebase absente. Definissez window.__FIREBASE_CONFIG__ avant de charger admin-main.js.',
		);
	}
	const appMod = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js');
	const authMod = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js');
	/**
	 * 1) But : une seule app [DEFAULT] partagée avec Firestore (store) si déjà initialisée.
	 * 2) Variable clé : getApps() avant initializeApp.
	 * 3) Flux : réutiliser l’instance existante ou créer la config client.
	 */
	const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(cfg);
	const auth = authMod.getAuth(app);
	firebaseAuthContext = { auth, authApi: authMod };
	return firebaseAuthContext;
}

/**
 * Token ID Firebase pour les routes API admin (rebuild, rebuild-status, etc.).
 *
 * 1) But : réutiliser strictement la même instance `Auth` que le portail de connexion.
 * 2) Variables clés : éviter un second import SDK (ex. autre version) où `currentUser` serait toujours null.
 * 3) Flux : contexte mémoïsé -> utilisateur courant -> `getIdToken()`.
 *
 * @returns {Promise<string>}
 */
export async function getCurrentAdminIdToken() {
	const { auth } = await getFirebaseAuthContext();
	const user = auth.currentUser;
	if (!user) {
		throw new Error('Session admin expirée. Reconnectez-vous.');
	}
	return user.getIdToken();
}

/**
 * Convertit la configuration UID admin en Set exploitable.
 *
 * Sources supportees:
 * - window.__ADMIN_UIDS__ = ['uid1', 'uid2']
 * - window.__ADMIN_UIDS__ = 'uid1,uid2'
 *
 * @returns {Set<string>}
 */
function getAllowedAdminUids() {
	const raw = typeof window !== 'undefined' ? window.__ADMIN_UIDS__ : null;
	if (Array.isArray(raw)) {
		return new Set(raw.map((uid) => String(uid).trim()).filter(Boolean));
	}
	if (typeof raw === 'string') {
		return new Set(
			raw
				.split(',')
				.map((uid) => uid.trim())
				.filter(Boolean),
		);
	}
	return new Set();
}

function setAuthMessage(text) {
	const el = document.getElementById('admin-auth-message');
	if (el) {
		el.textContent = text || '';
	}
}

function setGateLoadingState(loading) {
	const form = document.getElementById('admin-login-form');
	const submit = form?.querySelector('button[type="submit"]');
	if (!(submit instanceof HTMLButtonElement)) {
		return;
	}
	submit.disabled = !!loading;
	submit.textContent = loading ? 'Connexion...' : 'Se connecter';
}

/**
 * Affiche le shell admin uniquement si l'utilisateur est authentifie et autorise.
 *
 * 1) Purpose:
 *    - Bloquer l'acces au panneau admin sans login Firebase valide.
 * 2) Key variables:
 *    - allowedUids: liste blanche UID admin.
 *    - user: utilisateur courant remonte par onAuthStateChanged.
 * 3) Logic flow:
 *    - brancher le formulaire de login
 *    - ecouter l'etat auth
 *    - autoriser si UID valide, sinon deconnecter et afficher erreur
 *
 * @returns {Promise<{ uid: string, email: string }>}
 */
export async function enforceAdminAccess() {
	const gate = document.getElementById('admin-auth-gate');
	const shell = document.getElementById('admin-shell');
	const form = document.getElementById('admin-login-form');
	const logoutButton = document.getElementById('admin-logout-button');
	const emailInput = document.getElementById('admin-login-email');
	const passwordInput = document.getElementById('admin-login-password');

	if (!gate || !shell || !form || !emailInput || !passwordInput) {
		throw new Error('Structure auth admin incomplete dans admin.html.');
	}

	const allowedUids = getAllowedAdminUids();
	if (!allowedUids.size) {
		throw new Error('Aucun UID admin configure. Definissez window.__ADMIN_UIDS__.');
	}

	const { auth, authApi } = await getFirebaseAuthContext();

	form.addEventListener('submit', async (event) => {
		event.preventDefault();
		const email = String(emailInput.value || '').trim();
		const password = String(passwordInput.value || '');
		if (!email || !password) {
			setAuthMessage('Veuillez renseigner email et mot de passe.');
			return;
		}
		try {
			setGateLoadingState(true);
			setAuthMessage('');
			await authApi.signInWithEmailAndPassword(auth, email, password);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Connexion refusee.';
			setAuthMessage(`Connexion impossible: ${message}`);
		} finally {
			setGateLoadingState(false);
		}
	});

	if (logoutButton) {
		/**
		 * 1) But : une seule action — fermer la session Firebase puis afficher l’accueil public.
		 * 2) Variables clés : `auth` / `authApi` du contexte partagé avec le login.
		 * 3) Flux : signOut (best effort) -> redirection vers `index.html` (évite rester sur l’admin déconnecté).
		 */
		logoutButton.addEventListener('click', async () => {
			try {
				await authApi.signOut(auth);
			} finally {
				window.location.assign('index.html');
			}
		});
	}

	return new Promise((resolve) => {
		authApi.onAuthStateChanged(auth, async (user) => {
			if (!user) {
				gate.hidden = false;
				shell.hidden = true;
				passwordInput.value = '';
				return;
			}
			if (!allowedUids.has(user.uid)) {
				await authApi.signOut(auth);
				setAuthMessage('Compte connecte non autorise pour cette administration.');
				gate.hidden = false;
				shell.hidden = true;
				return;
			}
			setAuthMessage('');
			gate.hidden = true;
			shell.hidden = false;
			resolve({ uid: user.uid, email: String(user.email || '') });
		});
	});
}
