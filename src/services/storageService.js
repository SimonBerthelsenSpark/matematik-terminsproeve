import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { storage } from '../config/firebase.js';

/**
 * Sanitize filename to remove special characters and ensure compatibility
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
export function sanitizeFilename(filename) {
  const clean = (str) => transliterate(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Fjern accenter (é → e)
    .replace(/[^a-zA-Z0-9._-]/g, '_')  // Ugyldige tegn → _
    .replace(/_+/g, '_')                // Saml flere _
    .replace(/^_+|_+$/g, '')            // Fjern _ i start/slut
    .substring(0, 200);

  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1) return clean(filename);

  const ext = filename.slice(lastDotIndex + 1).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return `${clean(filename.slice(0, lastDotIndex))}.${ext}`;
}

/**
 * Translitterér danske bogstaver, så "Søren" og "Soren" ikke ender som samme filnavn.
 * (Uden dette blev ø til "_" og å til "a".)
 */
function transliterate(str) {
  const map = { æ: 'ae', ø: 'oe', å: 'aa', Æ: 'Ae', Ø: 'Oe', Å: 'Aa', ü: 'ue', Ü: 'Ue', ö: 'oe', Ö: 'Oe', ä: 'ae', Ä: 'Ae', ß: 'ss' };
  return String(str).replace(/[æøåÆØÅüÜöÖäÄß]/g, ch => map[ch]);
}

/**
 * Upload a file to Firebase Storage
 * @param {File} file - File to upload
 * @param {string} storagePath - Full path in storage (e.g., 'exams/examId/rettevejledning/file.pdf')
 * @param {Object} metadata - Optional metadata for the file
 * @returns {Promise<{storagePath: string, downloadURL: string, metadata: Object}>}
 */
export async function uploadFile(file, storagePath, metadata = {}) {
  try {
    const storageRef = ref(storage, storagePath);
    
    // Prepare metadata
    const fileMetadata = {
      contentType: file.type,
      customMetadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
        ...metadata
      }
    };
    
    // Upload file
    const snapshot = await uploadBytes(storageRef, file, fileMetadata);
    
    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return {
      storagePath,
      downloadURL,
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type,
        uploadedAt: new Date(),
      }
    };
  } catch (error) {
    console.error('Error uploading file:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
}

/**
 * Upload rettevejledning file for an exam
 * @param {string} examId - Exam document ID
 * @param {File} file - File to upload
 * @returns {Promise<Object>} Upload result with storage path and download URL
 */
export async function uploadRettevejledning(examId, file) {
  try {
    const sanitizedName = sanitizeFilename(file.name);
    const storagePath = `exams/${examId}/rettevejledning/${sanitizedName}`;
    return await uploadFile(file, storagePath);
  } catch (error) {
    console.error('Error uploading rettevejledning:', error);
    throw error;
  }
}

/**
 * Upload omsætningstabel file for an exam
 * @param {string} examId - Exam document ID
 * @param {File} file - File to upload
 * @returns {Promise<Object>} Upload result with storage path and download URL
 */
export async function uploadOmsaetningstabel(examId, file) {
  try {
    const sanitizedName = sanitizeFilename(file.name);
    const storagePath = `exams/${examId}/omsaetningstabel/${sanitizedName}`;
    return await uploadFile(file, storagePath);
  } catch (error) {
    console.error('Error uploading omsætningstabel:', error);
    throw error;
  }
}

/**
 * Upload bedømmelseskema file for a Danish exam
 * @param {string} examId - Exam document ID
 * @param {File} file - File to upload
 * @returns {Promise<Object>} Upload result with storage path and download URL
 */
export async function uploadBedoemmelseskema(examId, file) {
  try {
    const sanitizedName = sanitizeFilename(file.name);
    const storagePath = `exams/${examId}/bedoemmelseskema/${sanitizedName}`;
    return await uploadFile(file, storagePath);
  } catch (error) {
    console.error('Error uploading bedømmelseskema:', error);
    throw error;
  }
}

/**
 * Upload exam file (rettevejledning, omsætningstabel, or bedoemmelseskema)
 * @param {string} examId - Exam document ID
 * @param {File} file - File to upload
 * @param {string} fileType - 'rettevejledning', 'omsætningstabel', or 'bedoemmelseskema'
 * @returns {Promise<Object>} Upload result with storage path and download URL
 */
export async function uploadExamFile(examId, file, fileType) {
  try {
    if (fileType === 'rettevejledning') {
      return await uploadRettevejledning(examId, file);
    } else if (fileType === 'omsætningstabel') {
      return await uploadOmsaetningstabel(examId, file);
    } else if (fileType === 'bedoemmelseskema') {
      return await uploadBedoemmelseskema(examId, file);
    } else {
      throw new Error(`Invalid file type: ${fileType}`);
    }
  } catch (error) {
    console.error('Error uploading exam file:', error);
    throw error;
  }
}

/**
 * Upload student submission with custom filename
 * @param {string} examId - Exam document ID
 * @param {File} file - File to upload
 * @param {string} customFileName - Custom filename for the submission
 * @returns {Promise<Object>} Upload result with storage path and download URL
 */
export async function uploadStudentSubmission(examId, file, customFileName) {
  try {
    const sanitizedName = sanitizeFilename(customFileName);
    const storagePath = `exams/${examId}/submissions/${sanitizedName}`;
    const result = await uploadFile(file, storagePath);
    
    return {
      ...result,
      sanitizedFileName: sanitizedName,
      originalFileName: file.name
    };
  } catch (error) {
    console.error('Error uploading student submission:', error);
    throw error;
  }
}

/**
 * Upload student submission file for an exam
 * @param {string} examId - Exam document ID
 * @param {File} file - File to upload
 * @returns {Promise<Object>} Upload result with storage path, download URL, and sanitized filename
 */
export async function uploadSubmission(examId, file) {
  try {
    const sanitizedName = sanitizeFilename(file.name);
    const storagePath = `exams/${examId}/submissions/${sanitizedName}`;
    const result = await uploadFile(file, storagePath);
    
    return {
      ...result,
      sanitizedFileName: sanitizedName,
      originalFileName: file.name
    };
  } catch (error) {
    console.error('Error uploading submission:', error);
    throw error;
  }
}

/**
 * Get download URL for a file in storage
 * @param {string} storagePath - Path to file in storage
 * @returns {Promise<string>} Download URL
 */
export async function getFileDownloadURL(storagePath) {
  try {
    const storageRef = ref(storage, storagePath);
    return await getDownloadURL(storageRef);
  } catch (error) {
    // Only log the error in debug mode - not an error for missing student submissions
    if (error.code === 'storage/object-not-found') {
      console.debug('File not found in storage:', storagePath);
    } else {
      console.error('Error getting download URL:', error);
    }
    throw error; // Re-throw the original error, not a wrapped one
  }
}

/**
 * Delete a file from Firebase Storage
 * @param {string} storagePath - Path to file in storage
 * @returns {Promise<void>}
 */
export async function deleteFile(storagePath) {
  try {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
  } catch (error) {
    // If file doesn't exist, that's okay
    if (error.code === 'storage/object-not-found') {
      console.warn('File not found, already deleted:', storagePath);
      return;
    }
    console.error('Error deleting file:', error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

/**
 * Slet alle filer under en mappe i Storage (rekursivt).
 * Kræver at Storage-reglerne tillader "list" på stien.
 * @param {string} folderPath - fx 'exams/abc123'
 * @returns {Promise<number>} antal slettede filer
 */
export async function deleteStorageFolder(folderPath) {
  const { items, prefixes } = await listAll(ref(storage, folderPath));
  let count = 0;
  for (const item of items) {
    await deleteFile(item.fullPath);
    count++;
  }
  for (const prefix of prefixes) {
    count += await deleteStorageFolder(prefix.fullPath);
  }
  return count;
}

/**
 * Delete all files in an exam folder
 * @param {string} examId - Exam document ID
 * @param {string} folderType - Folder type: 'rettevejledning', 'omsaetningstabel', 'bedoemmelseskema' or 'submissions'
 * @returns {Promise<number>} antal slettede filer
 */
export async function deleteExamFolder(examId, folderType) {
  return deleteStorageFolder(`exams/${examId}/${folderType}`);
}
