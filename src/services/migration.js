/**
 * Engangs-overtagelse af data fra før login (prøver, klasser og forbrug uden ejer).
 * Virker kun, mens databasen endnu ikke er låst med de nye regler – bagefter kan data uden ejer ikke læses.
 */
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db, kraevUid } from '../config/firebase.js';

const SAMLINGER = ['exams', 'classes', 'usageDaily'];

/** @returns {Promise<null | { exams: string[], classes: string[], usageDaily: string[] }>} null hvis reglerne allerede er låst */
export async function findDataUdenEjer() {
  const out = {};
  try {
    for (const navn of SAMLINGER) {
      const snap = await getDocs(collection(db, navn));
      out[navn] = snap.docs.filter(d => !d.data().ownerUid).map(d => d.id);
    }
    return out;
  } catch (err) {
    if (err?.code === 'permission-denied') return null;
    throw err;
  }
}

export async function overtagData(fundet) {
  const uid = kraevUid();
  const refs = SAMLINGER.flatMap(navn => (fundet?.[navn] || []).map(id => doc(db, navn, id)));
  for (let i = 0; i < refs.length; i += 450) {
    const batch = writeBatch(db);
    refs.slice(i, i + 450).forEach(r => batch.update(r, { ownerUid: uid }));
    await batch.commit();
  }
  return refs.length;
}
