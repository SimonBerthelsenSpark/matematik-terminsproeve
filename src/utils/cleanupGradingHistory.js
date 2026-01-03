import { collection, query, where, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase.js';

/**
 * Delete grading history entries in the old gradingHistory collection for a specific exam
 * This is needed because old data from gradingHistory collection may still exist
 * 
 * @param {string} examId - The exam ID to clean up
 * @returns {Promise<number>} Number of deleted entries
 */
export async function cleanupOldGradingHistory(examId) {
  try {
    console.log(`🧹 Cleaning up old grading history for exam: ${examId}`);
    
    // Query for all gradingHistory entries for this exam
    const historyQuery = query(
      collection(db, 'gradingHistory'),
      where('examId', '==', examId)
    );
    
    const historySnapshot = await getDocs(historyQuery);
    console.log(`📊 Found ${historySnapshot.size} old grading history entries`);
    
    if (historySnapshot.empty) {
      console.log('✅ No old grading history to clean up');
      return 0;
    }
    
    // Delete each document
    const deletePromises = [];
    historySnapshot.forEach((docSnap) => {
      const docRef = doc(db, 'gradingHistory', docSnap.id);
      deletePromises.push(deleteDoc(docRef));
      console.log(`🗑️ Deleting gradingHistory document: ${docSnap.id}`);
    });
    
    await Promise.all(deletePromises);
    
    console.log(`✅ Deleted ${historySnapshot.size} old grading history entries`);
    return historySnapshot.size;
  } catch (error) {
    console.error('❌ Error cleaning up old grading history:', error);
    throw new Error(`Failed to cleanup grading history: ${error.message}`);
  }
}

/**
 * Delete a specific student's grading data from the old gradingHistory collection
 * This removes the student's opgave data from the opgaver array
 * 
 * @param {string} examId - The exam ID
 * @param {string} studentName - The student name (elevNavn) to remove
 * @returns {Promise<boolean>} Success status
 */
export async function removeStudentFromOldGradingHistory(examId, studentName) {
  try {
    console.log(`🧹 Removing student "${studentName}" from old grading history for exam: ${examId}`);
    
    // Query for gradingHistory entries for this exam
    const historyQuery = query(
      collection(db, 'gradingHistory'),
      where('examId', '==', examId)
    );
    
    const historySnapshot = await getDocs(historyQuery);
    
    if (historySnapshot.empty) {
      console.log('✅ No old grading history found');
      return false;
    }
    
    // For each gradingHistory document, filter out the student's data
    let removed = false;
    for (const docSnap of historySnapshot.docs) {
      const data = docSnap.data();
      
      if (data.opgaver && Array.isArray(data.opgaver)) {
        // Check if student exists in opgaver array
        const studentExists = data.opgaver.some(item => 
          item.elevNavn && item.elevNavn.includes(studentName)
        );
        
        if (studentExists) {
          console.log(`🗑️ Found student in gradingHistory document: ${docSnap.id}`);
          
          // Filter out the student's data
          const filteredOpgaver = data.opgaver.filter(item => 
            !item.elevNavn || !item.elevNavn.includes(studentName)
          );
          
          // If no opgaver left, delete the entire document
          if (filteredOpgaver.length === 0) {
            await deleteDoc(doc(db, 'gradingHistory', docSnap.id));
            console.log(`✅ Deleted entire gradingHistory document (no students left): ${docSnap.id}`);
          } else {
            // Otherwise, update with filtered opgaver
            const docRef = doc(db, 'gradingHistory', docSnap.id);
            await updateDoc(docRef, {
              opgaver: filteredOpgaver,
              antalOpgaver: filteredOpgaver.length
            });
            console.log(`✅ Removed student from gradingHistory document: ${docSnap.id}`);
          }
          
          removed = true;
        }
      }
    }
    
    if (!removed) {
      console.log(`⚠️ Student "${studentName}" not found in old grading history`);
    }
    
    return removed;
  } catch (error) {
    console.error('❌ Error removing student from old grading history:', error);
    throw new Error(`Failed to remove student from grading history: ${error.message}`);
  }
}

/**
 * Delete ALL grading history entries (complete cleanup)
 * WARNING: This will delete all old grading data from the gradingHistory collection
 * 
 * @returns {Promise<number>} Number of deleted entries
 */
export async function cleanupAllOldGradingHistory() {
  try {
    console.log('🧹 Cleaning up ALL old grading history');
    
    const historySnapshot = await getDocs(collection(db, 'gradingHistory'));
    console.log(`📊 Found ${historySnapshot.size} old grading history entries`);
    
    if (historySnapshot.empty) {
      console.log('✅ No old grading history to clean up');
      return 0;
    }
    
    // Delete each document
    const deletePromises = [];
    historySnapshot.forEach((docSnap) => {
      const docRef = doc(db, 'gradingHistory', docSnap.id);
      deletePromises.push(deleteDoc(docRef));
      console.log(`🗑️ Deleting gradingHistory document: ${docSnap.id}`);
    });
    
    await Promise.all(deletePromises);
    
    console.log(`✅ Deleted ${historySnapshot.size} old grading history entries`);
    return historySnapshot.size;
  } catch (error) {
    console.error('❌ Error cleaning up all old grading history:', error);
    throw new Error(`Failed to cleanup all grading history: ${error.message}`);
  }
}
