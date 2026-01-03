import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDlDZT4opvhzWrVRakiStwMgm19LlGpCKk",
  authDomain: "retopgave.firebaseapp.com",
  projectId: "retopgave",
  storageBucket: "retopgave.firebasestorage.app",
  messagingSenderId: "984421361006",
  appId: "1:984421361006:web:76753ca2e518670a254d7f",
  measurementId: "G-SG72TNTWVQ"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Legacy global access (for backward compatibility)
window.db = db;
window.firebase = {
  app,
  db,
  storage,
  firestore: () => db
};
