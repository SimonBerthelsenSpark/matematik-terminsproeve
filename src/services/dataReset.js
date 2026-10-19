/**
 * Slet ALT data: alle prøver, rettelser, besvarelser, klasser, elever og alle filer i Storage.
 * Kan ikke fortrydes. Bruges kun fra siden Indstillinger.
 */
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { ref, listAll, deleteObject } from 'firebase/storage';
import { db, storage } from '../config/firebase.js';

// Kendte undersamlinger (Firestore-klienten kan ikke selv finde dem)
const SUBCOLLECTIONS = {
  exams: ['gradingResults', 'studentSubmissions'],
  classes: ['students']
};

async function deleteRefs(refs, onDeleted) {
  // Firestore tillader højst 500 operationer pr. batch
  for (let i = 0; i < refs.length; i += 450) {
    const batch = writeBatch(db);
    const chunk = refs.slice(i, i + 450);
    chunk.forEach(r => batch.delete(r));
    await batch.commit();
    onDeleted?.(chunk.length);
  }
}

async function deleteCollection(name, onDeleted) {
  const snap = await getDocs(collection(db, name));
  const refs = [];
  for (const d of snap.docs) {
    for (const sub of SUBCOLLECTIONS[name] || []) {
      const subSnap = await getDocs(collection(db, name, d.id, sub));
      subSnap.docs.forEach(s => refs.push(doc(db, name, d.id, sub, s.id)));
    }
    refs.push(doc(db, name, d.id));
  }
  await deleteRefs(refs, onDeleted);
  return refs.length;
}

async function deleteStorageTree(path, onDeleted) {
  const { items, prefixes } = await listAll(ref(storage, path));
  let count = 0;
  for (const item of items) {
    try {
      await deleteObject(item);
      count++;
      onDeleted?.(1);
    } catch (err) {
      if (err.code !== 'storage/object-not-found') throw err;
    }
  }
  for (const p of prefixes) count += await deleteStorageTree(p.fullPath, onDeleted);
  return count;
}

/**
 * @param {(status: { phase: string, documents: number, files: number }) => void} [onProgress]
 * @returns {Promise<{ documents: number, files: number, storageError: string|null }>}
 */
export async function deleteAllData(onProgress) {
  const state = { phase: 'Sletter filer…', documents: 0, files: 0 };
  const report = () => onProgress?.({ ...state });
  report();

  // 1) Filer først – så der ikke efterlades filer uden reference, hvis noget fejler
  let storageError = null;
  try {
    await deleteStorageTree('', (n) => { state.files += n; report(); });
  } catch (err) {
    // Fx hvis Storage-reglerne ikke tillader "list"
    storageError = err.message;
  }

  // 2) Database
  state.phase = 'Sletter prøver og rettelser…';
  report();
  await deleteCollection('exams', (n) => { state.documents += n; report(); });

  state.phase = 'Sletter klasser og elever…';
  report();
  await deleteCollection('classes', (n) => { state.documents += n; report(); });

  state.phase = 'Færdig';
  report();
  return { documents: state.documents, files: state.files, storageError };
}
