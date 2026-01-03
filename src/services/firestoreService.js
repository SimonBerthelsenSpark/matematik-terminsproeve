import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { deleteFile } from './storageService.js';

// ==================== EXAM OPERATIONS ====================

/**
 * Create a new exam
 * @param {Object} examData - Exam data (beskrivelse, dato, klasse, type)
 * @returns {Promise<string>} Created exam ID
 */
export async function createExam(examData) {
  try {
    const docRef = await addDoc(collection(db, 'exams'), {
      beskrivelse: examData.beskrivelse || '',
      dato: examData.dato ? Timestamp.fromDate(new Date(examData.dato)) : serverTimestamp(),
      klasse: examData.klasse || '',
      type: examData.type || 'Matematik',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: examData.createdBy || 'anonymous',
      
      // File references (initially null)
      rettevejledningRef: null,
      omsætningstabelRef: null,
      
      // Statistics
      stats: {
        totalSubmissions: 0,
        gradedCount: 0,
        errorCount: 0,
        averagePoints: 0,
        averageGrade: 0,
        lastGradedAt: null
      },
      
      // Status
      status: 'draft',
      isDeleted: false
    });
    
    return docRef.id;
  } catch (error) {
    console.error('Error creating exam:', error);
    throw new Error(`Failed to create exam: ${error.message}`);
  }
}

/**
 * Get a single exam by ID
 * @param {string} examId - Exam document ID
 * @returns {Promise<Object|null>} Exam data with id, or null if not found
 */
export async function getExam(examId) {
  try {
    const docRef = doc(db, 'exams', examId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data()
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting exam:', error);
    throw new Error(`Failed to get exam: ${error.message}`);
  }
}

/**
 * Get all exams (non-deleted, ordered by creation date)
 * @param {Object} options - Query options (limitCount, status, type, klasse)
 * @returns {Promise<Array>} Array of exam objects
 */
export async function getAllExams(options = {}) {
  try {
    const {
      limitCount = 50,
      status = null,
      type = null,
      klasse = null
    } = options;
    
    let q = query(
      collection(db, 'exams'),
      where('isDeleted', '==', false)
    );
    
    // Add filters if provided
    if (status) {
      q = query(q, where('status', '==', status));
    }
    if (type) {
      q = query(q, where('type', '==', type));
    }
    if (klasse) {
      q = query(q, where('klasse', '==', klasse));
    }
    
    // Order by creation date and limit
    q = query(q, orderBy('createdAt', 'desc'), limit(limitCount));
    
    const querySnapshot = await getDocs(q);
    const exams = [];
    
    querySnapshot.forEach((doc) => {
      exams.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return exams;
  } catch (error) {
    console.error('Error getting all exams:', error);
    throw new Error(`Failed to get exams: ${error.message}`);
  }
}

/**
 * Update exam metadata
 * @param {string} examId - Exam document ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateExam(examId, updates) {
  try {
    const docRef = doc(db, 'exams', examId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating exam:', error);
    throw new Error(`Failed to update exam: ${error.message}`);
  }
}

/**
 * Update exam file reference (rettevejledning or omsætningstabel)
 * @param {string} examId - Exam document ID
 * @param {string} fileType - 'rettevejledningRef' or 'omsætningstabelRef'
 * @param {Object} fileData - File metadata from storage service
 * @returns {Promise<void>}
 */
export async function updateExamFileRef(examId, fileType, fileData) {
  try {
    const docRef = doc(db, 'exams', examId);
    await updateDoc(docRef, {
      [fileType]: {
        fileName: fileData.metadata.fileName,
        storagePath: fileData.storagePath,
        uploadedAt: serverTimestamp(),
        fileSize: fileData.metadata.fileSize,
        contentType: fileData.metadata.contentType
      },
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating exam file reference:', error);
    throw new Error(`Failed to update exam file reference: ${error.message}`);
  }
}

/**
 * Update exam statistics
 * @param {string} examId - Exam document ID
 * @param {Object} stats - Statistics to update
 * @returns {Promise<void>}
 */
export async function updateExamStats(examId, stats) {
  try {
    const docRef = doc(db, 'exams', examId);
    const updates = {};
    
    // Build update object with dot notation for nested fields
    if (stats.totalSubmissions !== undefined) {
      updates['stats.totalSubmissions'] = stats.totalSubmissions;
    }
    if (stats.gradedCount !== undefined) {
      updates['stats.gradedCount'] = stats.gradedCount;
    }
    if (stats.errorCount !== undefined) {
      updates['stats.errorCount'] = stats.errorCount;
    }
    if (stats.averagePoints !== undefined) {
      updates['stats.averagePoints'] = stats.averagePoints;
    }
    if (stats.averageGrade !== undefined) {
      updates['stats.averageGrade'] = stats.averageGrade;
    }
    if (stats.lastGradedAt !== undefined) {
      updates['stats.lastGradedAt'] = serverTimestamp();
    }
    
    updates.updatedAt = serverTimestamp();
    
    await updateDoc(docRef, updates);
  } catch (error) {
    console.error('Error updating exam stats:', error);
    throw new Error(`Failed to update exam stats: ${error.message}`);
  }
}

/**
 * Soft delete an exam
 * @param {string} examId - Exam document ID
 * @returns {Promise<void>}
 */
export async function deleteExam(examId) {
  try {
    const docRef = doc(db, 'exams', examId);
    await updateDoc(docRef, {
      isDeleted: true,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error deleting exam:', error);
    throw new Error(`Failed to delete exam: ${error.message}`);
  }
}

// ==================== STUDENT SUBMISSION OPERATIONS ====================

/**
 * Add a student submission
 * @param {string} examId - Exam document ID
 * @param {Object} submissionData - Submission metadata
 * @returns {Promise<string>} Submission document ID
 */
export async function addSubmission(examId, submissionData) {
  try {
    // Document ID is filename without extension for uniqueness
    const docId = submissionData.fileName.replace(/\.[^/.]+$/, '');
    const docRef = doc(db, 'exams', examId, 'studentSubmissions', docId);
    
    await setDoc(docRef, {
      fileName: submissionData.fileName,
      originalFileName: submissionData.originalFileName || submissionData.fileName,
      storagePath: submissionData.storagePath,
      uploadedAt: serverTimestamp(),
      fileSize: submissionData.fileSize || 0,
      contentType: submissionData.contentType || 'application/pdf',
      
      status: 'pending',
      uploadedBy: submissionData.uploadedBy || 'anonymous',
      
      gradingResultId: null,
      error: null,
      retryCount: 0
    });
    
    // Increment exam submission count
    await updateDoc(doc(db, 'exams', examId), {
      'stats.totalSubmissions': increment(1),
      updatedAt: serverTimestamp()
    });
    
    return docId;
  } catch (error) {
    console.error('Error adding submission:', error);
    throw new Error(`Failed to add submission: ${error.message}`);
  }
}

/**
 * Get all submissions for an exam
 * @param {string} examId - Exam document ID
 * @param {string} statusFilter - Optional status filter ('pending', 'processing', 'graded', 'error')
 * @returns {Promise<Array>} Array of submission objects
 */
export async function getSubmissions(examId, statusFilter = null) {
  try {
    let q = collection(db, 'exams', examId, 'studentSubmissions');
    
    if (statusFilter) {
      q = query(q, where('status', '==', statusFilter));
    }
    
    q = query(q, orderBy('uploadedAt', 'asc'));
    
    const querySnapshot = await getDocs(q);
    const submissions = [];
    
    querySnapshot.forEach((doc) => {
      submissions.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return submissions;
  } catch (error) {
    console.error('Error getting submissions:', error);
    throw new Error(`Failed to get submissions: ${error.message}`);
  }
}

/**
 * Check if a filename already exists for an exam
 * @param {string} examId - Exam document ID
 * @param {string} fileName - Sanitized filename to check
 * @returns {Promise<boolean>} True if filename exists
 */
export async function checkFilenameExists(examId, fileName) {
  try {
    const docId = fileName.replace(/\.[^/.]+$/, '');
    const docRef = doc(db, 'exams', examId, 'studentSubmissions', docId);
    const docSnap = await getDoc(docRef);
    
    return docSnap.exists();
  } catch (error) {
    console.error('Error checking filename:', error);
    throw new Error(`Failed to check filename: ${error.message}`);
  }
}

/**
 * Update submission status
 * @param {string} examId - Exam document ID
 * @param {string} submissionId - Submission document ID
 * @param {string} status - New status
 * @param {Object} additionalData - Additional fields to update
 * @returns {Promise<void>}
 */
export async function updateSubmissionStatus(examId, submissionId, status, additionalData = {}) {
  try {
    const docRef = doc(db, 'exams', examId, 'studentSubmissions', submissionId);
    
    // Check if document exists first
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      // Document exists, update it
      await updateDoc(docRef, {
        status,
        ...additionalData
      });
    } else {
      // Document doesn't exist, create it with setDoc
      console.warn(`⚠️ Submission ${submissionId} doesn't exist, creating it now...`);
      await setDoc(docRef, {
        fileName: submissionId,
        originalFileName: submissionId,
        storagePath: additionalData.storagePath || `exams/${examId}/submissions/${submissionId}`,
        uploadedAt: serverTimestamp(),
        fileSize: 0,
        contentType: 'application/pdf',
        status,
        uploadedBy: 'system',
        gradingResultId: additionalData.gradingResultId || null,
        error: null,
        retryCount: 0,
        ...additionalData
      });
    }
  } catch (error) {
    console.error('Error updating submission status:', error);
    throw new Error(`Failed to update submission status: ${error.message}`);
  }
}

/**
 * Delete a student submission and its associated grading result
 * @param {string} examId - Exam document ID
 * @param {string} submissionId - Submission document ID
 * @param {string} storagePath - Storage path of the file to delete
 * @returns {Promise<void>}
 */
export async function deleteSubmission(examId, submissionId, storagePath) {
  try {
    // First, check if there's a grading result for this submission
    const gradingResultRef = doc(db, 'exams', examId, 'gradingResults', submissionId);
    const gradingResultSnap = await getDoc(gradingResultRef);
    
    if (gradingResultSnap.exists()) {
      // Delete the grading result
      await deleteDoc(gradingResultRef);
      console.log(`✅ Deleted grading result for: ${submissionId}`);
    }
    
    // Delete the submission document
    const submissionRef = doc(db, 'exams', examId, 'studentSubmissions', submissionId);
    await deleteDoc(submissionRef);
    console.log(`✅ Deleted submission: ${submissionId}`);
    
    // Delete the file from storage
    if (storagePath) {
      try {
        await deleteFile(storagePath);
        console.log(`✅ Deleted file: ${storagePath}`);
      } catch (fileErr) {
        console.warn(`⚠️ Could not delete file ${storagePath}:`, fileErr.message);
        // Continue even if file deletion fails
      }
    }
    
    // Decrement exam submission count
    const examRef = doc(db, 'exams', examId);
    await updateDoc(examRef, {
      'stats.totalSubmissions': increment(-1),
      updatedAt: serverTimestamp()
    });
    
    // Recalculate exam stats if a grading result was deleted
    if (gradingResultSnap.exists()) {
      await recalculateExamStats(examId);
    }
  } catch (error) {
    console.error('Error deleting submission:', error);
    throw new Error(`Failed to delete submission: ${error.message}`);
  }
}

// ==================== GRADING RESULT OPERATIONS ====================

/**
 * Save grading result
 * @param {string} examId - Exam document ID
 * @param {string} submissionId - Submission document ID
 * @param {Object} gradingData - Grading result data
 * @returns {Promise<string>} Grading result document ID
 */
export async function saveGradingResult(examId, submissionId, gradingData) {
  try {
    // Use submissionId as document ID to prevent duplicates
    const docRef = doc(db, 'exams', examId, 'gradingResults', submissionId);
    
    // Check if a grading result already exists for this submission
    const existingDoc = await getDoc(docRef);
    
    if (existingDoc.exists()) {
      console.warn(`⚠️ Grading result already exists for ${submissionId}, skipping to prevent duplicate`);
      return existingDoc.id;
    }
    
    // Save the grading result using setDoc with submissionId as document ID
    await setDoc(docRef, {
      submissionId,
      examId,
      elevNavn: gradingData.elevNavn || submissionId,
      
      // AI Grading
      aiGrading: {
        opgaver: gradingData.opgaver || [],
        totalPoint: gradingData.totalPoint || 0,
        karakter: gradingData.karakter || 0,
        karakterBegrundelse: gradingData.karakterBegrundelse || '',
        samletFeedback: gradingData.samletFeedback || '',
        
        // AI metadata
        aiProvider: gradingData.aiProvider || 'openai',
        aiModel: gradingData.aiModel || 'gpt-4o',
        apiCost: gradingData.apiCost || 0,
        processedAt: serverTimestamp(),
        processingTimeMs: gradingData.processingTimeMs || 0
      },
      
      // No teacher grading initially
      lærerGrading: null,
      
      // Final grade (initially same as AI grading)
      finalGrade: {
        totalPoint: gradingData.totalPoint || 0,
        karakter: gradingData.karakter || 0,
        source: 'ai'
      },
      
      status: 'graded',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log(`✅ Created grading result document: ${submissionId}`);
    
    // Update or create submission with grading result ID
    try {
      await updateSubmissionStatus(examId, submissionId, 'graded', {
        gradingResultId: submissionId
      });
      console.log(`✅ Updated submission status for: ${submissionId}`);
    } catch (submissionError) {
      // Log warning but don't fail the entire operation - grading result is already saved
      console.warn(`⚠️ Could not update submission ${submissionId}, but grading result saved:`, submissionError.message);
    }
    
    return submissionId;
  } catch (error) {
    console.error('Error saving grading result:', error);
    throw new Error(`Failed to save grading result: ${error.message}`);
  }
}

/**
 * Get all grading results for an exam
 * @param {string} examId - Exam document ID
 * @returns {Promise<Array>} Array of grading result objects
 */
export async function getGradingResults(examId) {
  try {
    const q = query(
      collection(db, 'exams', examId, 'gradingResults'),
      orderBy('createdAt', 'asc')
    );
    
    const querySnapshot = await getDocs(q);
    const results = [];
    
    querySnapshot.forEach((doc) => {
      results.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return results;
  } catch (error) {
    console.error('Error getting grading results:', error);
    throw new Error(`Failed to get grading results: ${error.message}`);
  }
}

/**
 * Get a single grading result
 * @param {string} examId - Exam document ID
 * @param {string} resultId - Grading result document ID
 * @returns {Promise<Object|null>} Grading result or null
 */
export async function getGradingResult(examId, resultId) {
  try {
    const docRef = doc(db, 'exams', examId, 'gradingResults', resultId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data()
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting grading result:', error);
    throw new Error(`Failed to get grading result: ${error.message}`);
  }
}

/**
 * Update grading result with teacher adjustments
 * @param {string} examId - Exam document ID
 * @param {string} resultId - Grading result document ID
 * @param {Object} teacherGrading - Teacher grading data
 * @returns {Promise<void>}
 */
export async function updateTeacherGrading(examId, resultId, teacherGrading) {
  try {
    const docRef = doc(db, 'exams', examId, 'gradingResults', resultId);
    await updateDoc(docRef, {
      lærerGrading: {
        opgaver: teacherGrading.opgaver || [],
        lærerTotalPoint: teacherGrading.totalPoint,
        lærerKarakter: teacherGrading.karakter,
        adjustedAt: serverTimestamp(),
        adjustedBy: teacherGrading.adjustedBy || 'anonymous'
      },
      finalGrade: {
        totalPoint: teacherGrading.totalPoint,
        karakter: teacherGrading.karakter,
        source: 'teacher'
      },
      status: 'reviewed',
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating teacher grading:', error);
    throw new Error(`Failed to update teacher grading: ${error.message}`);
  }
}

/**
 * Recalculate and update exam statistics based on grading results
 * @param {string} examId - Exam document ID
 * @returns {Promise<void>}
 */
export async function recalculateExamStats(examId) {
  try {
    const results = await getGradingResults(examId);
    
    if (results.length === 0) {
      return;
    }
    
    let totalPoints = 0;
    let totalGrades = 0;
    let count = 0;
    
    results.forEach(result => {
      if (result.finalGrade) {
        totalPoints += result.finalGrade.totalPoint || 0;
        totalGrades += result.finalGrade.karakter || 0;
        count++;
      }
    });
    
    const averagePoints = count > 0 ? totalPoints / count : 0;
    const averageGrade = count > 0 ? totalGrades / count : 0;
    
    await updateExamStats(examId, {
      gradedCount: count,
      averagePoints: Math.round(averagePoints * 10) / 10,  // Round to 1 decimal
      averageGrade: Math.round(averageGrade * 10) / 10,
      lastGradedAt: true  // Will be converted to serverTimestamp
    });
  } catch (error) {
    console.error('Error recalculating exam stats:', error);
    throw new Error(`Failed to recalculate exam stats: ${error.message}`);
  }
}

/**
 * Delete a single grading result
 * @param {string} examId - Exam document ID
 * @param {string} resultId - Grading result document ID
 * @returns {Promise<void>}
 */
export async function deleteGradingResult(examId, resultId) {
  try {
    const docRef = doc(db, 'exams', examId, 'gradingResults', resultId);
    await deleteDoc(docRef);
    console.log(`✅ Deleted grading result: ${resultId}`);
    
    // Recalculate exam stats after deletion
    await recalculateExamStats(examId);
  } catch (error) {
    console.error('Error deleting grading result:', error);
    throw new Error(`Failed to delete grading result: ${error.message}`);
  }
}

/**
 * Delete all grading results for an exam
 * @param {string} examId - Exam document ID
 * @returns {Promise<number>} Number of deleted results
 */
export async function deleteAllGradingResults(examId) {
  try {
    const results = await getGradingResults(examId);
    console.log(`🗑️ Deleting ${results.length} grading results...`);
    
    const batch = writeBatch(db);
    results.forEach(result => {
      const resultRef = doc(db, 'exams', examId, 'gradingResults', result.id);
      batch.delete(resultRef);
    });
    
    await batch.commit();
    
    // Reset exam stats
    await updateExamStats(examId, {
      gradedCount: 0,
      averagePoints: 0,
      averageGrade: 0
    });
    
    console.log(`✅ Deleted ${results.length} grading results`);
    return results.length;
  } catch (error) {
    console.error('Error deleting all grading results:', error);
    throw new Error(`Failed to delete all grading results: ${error.message}`);
  }
}

/**
 * Permanently delete an exam with all its data (submissions, results, files)
 * @param {string} examId - Exam document ID
 * @returns {Promise<void>}
 */
export async function permanentlyDeleteExam(examId) {
  try {
    console.log(`🗑️ Starting permanent deletion of exam: ${examId}`);
    
    // First, get the exam to retrieve file references
    const exam = await getExam(examId);
    if (!exam) {
      throw new Error('Exam not found');
    }
    
    // Delete files from Storage
    const filesToDelete = [];
    
    if (exam.rettevejledningRef?.storagePath) {
      filesToDelete.push(exam.rettevejledningRef.storagePath);
    }
    
    if (exam.omsætningstabelRef?.storagePath) {
      filesToDelete.push(exam.omsætningstabelRef.storagePath);
    }
    
    // Get all submissions to delete their files
    const submissions = await getSubmissions(examId);
    submissions.forEach(submission => {
      if (submission.storagePath) {
        filesToDelete.push(submission.storagePath);
      }
    });
    
    // Delete all files from Storage
    console.log(`📁 Deleting ${filesToDelete.length} files from Storage...`);
    for (const filePath of filesToDelete) {
      try {
        await deleteFile(filePath);
        console.log(`✅ Deleted: ${filePath}`);
      } catch (err) {
        console.warn(`⚠️ Could not delete file: ${filePath}`, err.message);
        // Continue even if file deletion fails
      }
    }
    
    // Delete Firestore data using batch
    const batch = writeBatch(db);
    
    // Delete all grading results
    const gradingResults = await getGradingResults(examId);
    console.log(`📊 Deleting ${gradingResults.length} grading results...`);
    gradingResults.forEach(result => {
      const resultRef = doc(db, 'exams', examId, 'gradingResults', result.id);
      batch.delete(resultRef);
    });
    
    // Delete all submissions
    console.log(`📝 Deleting ${submissions.length} submissions...`);
    submissions.forEach(submission => {
      const submissionRef = doc(db, 'exams', examId, 'studentSubmissions', submission.id);
      batch.delete(submissionRef);
    });
    
    // Delete the exam document itself
    const examRef = doc(db, 'exams', examId);
    batch.delete(examRef);
    
    // Commit all deletions
    await batch.commit();
    
    console.log(`✅ Exam ${examId} permanently deleted`);
  } catch (error) {
    console.error('Error permanently deleting exam:', error);
    throw new Error(`Failed to delete exam: ${error.message}`);
  }
}
