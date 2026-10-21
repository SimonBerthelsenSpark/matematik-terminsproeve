/**
 * Login med e-mail og adgangskode (Firebase Auth).
 * En lærer skal 1) bekræfte sin e-mail og 2) være godkendt af en administrator (brugere/{email}).
 */
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { doc, getDoc, getDocs, setDoc, deleteDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase.js';
import { erAdminEmail } from '../config/admins.js';

const norm = (email) => String(email || '').trim().toLowerCase();

const FEJL = {
  'auth/invalid-credential': 'Forkert e-mail eller adgangskode.',
  'auth/wrong-password': 'Forkert e-mail eller adgangskode.',
  'auth/user-not-found': 'Forkert e-mail eller adgangskode.',
  'auth/invalid-email': 'E-mailadressen er ikke gyldig.',
  'auth/email-already-in-use': 'Der findes allerede en konto med den e-mail. Log ind i stedet.',
  'auth/weak-password': 'Adgangskoden skal være på mindst 8 tegn.',
  'auth/too-many-requests': 'For mange forsøg. Vent lidt, og prøv igen.',
  'auth/network-request-failed': 'Ingen forbindelse. Tjek dit netværk.',
  'auth/operation-not-allowed': 'Login med e-mail er ikke slået til i Firebase endnu.'
};
export const authFejl = (err) => FEJL[err?.code] || err?.message || 'Noget gik galt';

export async function logInd(email, password) {
  await setPersistence(auth, browserLocalPersistence);
  return signInWithEmailAndPassword(auth, norm(email), password);
}

export async function opretKonto(email, password) {
  if (String(password).length < 8) throw Object.assign(new Error(), { code: 'auth/weak-password' });
  const cred = await createUserWithEmailAndPassword(auth, norm(email), password);
  await sendEmailVerification(cred.user);
  return cred;
}

export const sendBekraeftelse = () => sendEmailVerification(auth.currentUser);
export const nulstilAdgangskode = (email) => sendPasswordResetEmail(auth, norm(email));
export const logUd = () => signOut(auth);

/** Godkendt lærer? Returnerer { godkendt, rolle }. */
export async function hentGodkendelse(email) {
  const e = norm(email);
  if (erAdminEmail(e)) return { godkendt: true, rolle: 'admin' };
  try {
    const snap = await getDoc(doc(db, 'brugere', e));
    if (!snap.exists()) return { godkendt: false, rolle: null };
    return { godkendt: true, rolle: snap.data().rolle === 'admin' ? 'admin' : 'laerer' };
  } catch {
    return { godkendt: false, rolle: null };
  }
}

// ---------- Administration af lærere ----------

export async function hentBrugere() {
  const snap = await getDocs(collection(db, 'brugere'));
  return snap.docs.map(d => ({ email: d.id, ...d.data() })).sort((a, b) => a.email.localeCompare(b.email));
}

export async function godkendBruger(email, rolle = 'laerer') {
  const e = norm(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error('Skriv en gyldig e-mailadresse');
  await setDoc(doc(db, 'brugere', e), {
    email: e,
    rolle: rolle === 'admin' ? 'admin' : 'laerer',
    godkendtAf: auth.currentUser?.email || null,
    godkendtAt: serverTimestamp()
  });
}

export const fjernBruger = (email) => deleteDoc(doc(db, 'brugere', norm(email)));
