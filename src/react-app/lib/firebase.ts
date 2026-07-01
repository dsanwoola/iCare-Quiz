import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase web config. These values are NOT secrets — they are public
// identifiers for the project. All access control is enforced by Firestore
// Security Rules (see firestore.rules) and Storage Rules (storage.rules).
// They can be overridden at build time via VITE_FIREBASE_* env vars.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "AIzaSyBwqkcfLydHWvEwKJDIJWXZChcDkqSvvQw",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "icare-quiz-arena.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "icare-quiz-arena",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "icare-quiz-arena.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "591045640387",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "1:591045640387:web:1e9bb66fb9bd1e173ae276",
};

export const app = initializeApp(firebaseConfig);

// App Check — attests that requests come from our genuine app, protecting the
// billed AI Logic (Gemini) quota, Firestore, and Storage from abuse.
// Must be initialized right after the app, before other services are used.
// The reCAPTCHA Enterprise site key is a public identifier (safe to ship).
// For local development, register a debug token in .env.local as
// VITE_APPCHECK_DEBUG_TOKEN so localhost isn't blocked.
if (import.meta.env.DEV && import.meta.env.VITE_APPCHECK_DEBUG_TOKEN) {
  // The App Check SDK reads this global to use a registered debug token.
  (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN =
    import.meta.env.VITE_APPCHECK_DEBUG_TOKEN;
}

export const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider(
    import.meta.env.VITE_RECAPTCHA_KEY ?? "6LfpYj4tAAAAAC_NC5cU2xNQXtd-7cFRDPJRzags"
  ),
  isTokenAutoRefreshEnabled: true,
});

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();
