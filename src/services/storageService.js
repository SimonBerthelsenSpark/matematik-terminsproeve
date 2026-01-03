import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../config/firebase.js';

/**
 * Sanitize filename to remove special characters and ensure compatibility
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
export function sanitizeFilename(filename) {
  try {
    // Preserve extension
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1) {
      // No extension, sanitize entire filename
      return filename
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')  // Remove diacritics
        .replace(/[^a-zA-Z0-9._-]/g, '_')  // Replace invalid chars
        .replace(/_+/g, '_')                // Collapse multiple underscores
        .substring(0, 200);                 // Limit length
    }

    const ext = filename.slice(lastDotIndex + 1);
    const nameWithoutExt = filename.slice(0, lastDotIndex);
    
    // Sanitize name portion
    const sanitized = nameWithoutExt
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')  // Remove diacritics
      .replace(/[^a-zA-Z0-9._-]/g, '_')  // Replace invalid chars with underscore
      .replace(/_+/g, '_')                // Collapse multiple underscores
      .replace(/^_+|_+$/g, '')            // Remove leading/trailing underscores
      .substring(0, 200);                 // Limit length
    
    return `${sanitized}.${ext}`;
  } catch (error) {
    console.error('Error sanitizing filename:', error);
    return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  }
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
 * Delete all files in an exam folder
 * @param {string} examId - Exam document ID
 * @param {string} folderType - Folder type: 'rettevejledning', 'omsaetningstabel', or 'submissions'
 * @returns {Promise<void>}
 */
export async function deleteExamFolder(examId, folderType) {
  try {
    // Note: Firebase Storage doesn't have a delete folder operation
    // Files should be tracked in Firestore and deleted individually
    console.warn('deleteExamFolder requires individual file deletion based on Firestore metadata');
  } catch (error) {
    console.error('Error deleting exam folder:', error);
    throw error;
  }
}
