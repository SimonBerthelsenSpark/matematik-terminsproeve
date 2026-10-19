import { useState, useCallback } from 'react';
import {
  uploadRettevejledning as uploadRettevejledningService,
  uploadOmsaetningstabel as uploadOmsaetningstabelService,
  uploadBedoemmelseskema as uploadBedoemmelseskemaService,
  uploadSubmission as uploadSubmissionService,
  sanitizeFilename
} from '../services/storageService.js';
import {
  updateExamFileRef,
  addSubmission,
  checkFilenameExists
} from '../services/firestoreService.js';

// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
  rettevejledning: 10 * 1024 * 1024,  // 10MB
  omsaetningstabel: 5 * 1024 * 1024,   // 5MB
  bedoemmelseskema: 10 * 1024 * 1024,  // 10MB
  submission: 20 * 1024 * 1024         // 20MB
};

// Accepted file types
export const ACCEPTED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt']
};

/**
 * Custom hook for handling file uploads
 * Provides state management for file uploads with progress tracking and validation
 * 
 * @returns {Object} Hook state and functions
 * @property {boolean} uploading - Upload in progress state
 * @property {number} uploadProgress - Upload progress (0-100)
 * @property {string|null} error - Error message if any
 * @property {string|null} downloadURL - Download URL of uploaded file
 * @property {Function} uploadRettevejledning - Upload grading guidelines
 * @property {Function} uploadOmsaetningstabel - Upload conversion table
 * @property {Function} uploadSubmission - Upload student submission
 * @property {Function} resetUpload - Reset upload state
 */
export function useFileUpload() {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [downloadURL, setDownloadURL] = useState(null);

  /**
   * Validate file before upload
   * @param {File} file - File to validate
   * @param {number} maxSize - Maximum file size in bytes
   * @returns {Object} Validation result {valid: boolean, error: string|null}
   */
  const validateFile = useCallback((file, maxSize) => {
    // Check if file exists
    if (!file) {
      return { valid: false, error: 'No file provided' };
    }

    // Check file type
    const acceptedTypes = Object.keys(ACCEPTED_FILE_TYPES);
    if (!acceptedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `Invalid file type. Accepted types: PDF, DOCX, TXT`
      };
    }

    // Check file size
    if (file.size > maxSize) {
      const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return {
        valid: false,
        error: `File too large (${fileSizeMB}MB). Maximum size: ${maxSizeMB}MB`
      };
    }

    return { valid: true, error: null };
  }, []);

  /**
   * Upload rettevejledning (grading guidelines) file
   * @param {string} examId - Exam document ID
   * @param {File} file - File to upload
   * @returns {Promise<Object>} Upload result
   */
  const uploadRettevejledning = useCallback(async (examId, file) => {
    try {
      setUploading(true);
      setUploadProgress(0);
      setError(null);
      setDownloadURL(null);

      // Validate exam ID
      if (!examId) {
        throw new Error('Exam ID is required');
      }

      // Validate file
      const validation = validateFile(file, FILE_SIZE_LIMITS.rettevejledning);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      setUploadProgress(25);
      console.log(`📤 Uploading rettevejledning for exam ${examId}...`);

      // Upload to Storage
      const uploadResult = await uploadRettevejledningService(examId, file);
      setUploadProgress(75);

      // Update Firestore with file reference
      await updateExamFileRef(examId, 'rettevejledningRef', uploadResult);
      setUploadProgress(100);

      setDownloadURL(uploadResult.downloadURL);
      console.log(`✅ Rettevejledning uploaded successfully`);

      return uploadResult;
    } catch (err) {
      console.error('Error uploading rettevejledning:', err);
      setError(err.message || 'Failed to upload rettevejledning');
      throw err;
    } finally {
      setUploading(false);
    }
  }, [validateFile]);

  /**
   * Upload omsætningstabel (conversion table) file
   * @param {string} examId - Exam document ID
   * @param {File} file - File to upload
   * @returns {Promise<Object>} Upload result
   */
  const uploadOmsaetningstabel = useCallback(async (examId, file) => {
    try {
      setUploading(true);
      setUploadProgress(0);
      setError(null);
      setDownloadURL(null);

      // Validate exam ID
      if (!examId) {
        throw new Error('Exam ID is required');
      }

      // Validate file
      const validation = validateFile(file, FILE_SIZE_LIMITS.omsaetningstabel);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      setUploadProgress(25);
      console.log(`📤 Uploading omsætningstabel for exam ${examId}...`);

      // Upload to Storage
      const uploadResult = await uploadOmsaetningstabelService(examId, file);
      setUploadProgress(75);

      // Update Firestore with file reference
      await updateExamFileRef(examId, 'omsætningstabelRef', uploadResult);
      setUploadProgress(100);

      setDownloadURL(uploadResult.downloadURL);
      console.log(`✅ Omsætningstabel uploaded successfully`);

      return uploadResult;
    } catch (err) {
      console.error('Error uploading omsætningstabel:', err);
      setError(err.message || 'Failed to upload omsætningstabel');
      throw err;
    } finally {
      setUploading(false);
    }
  }, [validateFile]);

  /**
   * Upload bedømmelseskema (Danish assessment schema) file
   * @param {string} examId - Exam document ID
   * @param {File} file - File to upload
   * @returns {Promise<Object>} Upload result
   */
  const uploadBedoemmelseskema = useCallback(async (examId, file) => {
    try {
      setUploading(true);
      setUploadProgress(0);
      setError(null);
      setDownloadURL(null);

      // Validate exam ID
      if (!examId) {
        throw new Error('Exam ID is required');
      }

      // Validate file
      const validation = validateFile(file, FILE_SIZE_LIMITS.bedoemmelseskema);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      setUploadProgress(25);
      console.log(`📤 Uploading bedømmelseskema for exam ${examId}...`);

      // Upload to Storage
      const uploadResult = await uploadBedoemmelseskemaService(examId, file);
      setUploadProgress(75);

      // Update Firestore with file reference
      await updateExamFileRef(examId, 'bedoemmelseskemaRef', uploadResult);
      setUploadProgress(100);

      setDownloadURL(uploadResult.downloadURL);
      console.log(`✅ Bedømmelseskema uploaded successfully`);

      return uploadResult;
    } catch (err) {
      console.error('Error uploading bedømmelseskema:', err);
      setError(err.message || 'Failed to upload bedømmelseskema');
      throw err;
    } finally {
      setUploading(false);
    }
  }, [validateFile]);

  /**
   * Upload student submission file
   * @param {string} examId - Exam document ID
   * @param {File} file - File to upload
   * @returns {Promise<Object>} Upload result with submission ID
   */
  const uploadSubmission = useCallback(async (examId, file) => {
    try {
      setUploading(true);
      setUploadProgress(0);
      setError(null);
      setDownloadURL(null);

      // Validate exam ID
      if (!examId) {
        throw new Error('Exam ID is required');
      }

      // Validate file
      const validation = validateFile(file, FILE_SIZE_LIMITS.submission);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      setUploadProgress(15);

      // Tjek for dublet FØR upload – ellers overskrives en anden elevs fil i Storage
      const sanitizedFileName = sanitizeFilename(file.name);
      const filenameExists = await checkFilenameExists(examId, sanitizedFileName);
      if (filenameExists) {
        throw new Error(`Der findes allerede en besvarelse med filnavnet "${sanitizedFileName}"`);
      }

      // Upload to Storage
      const uploadResult = await uploadSubmissionService(examId, file);
      setUploadProgress(75);

      // Add submission to Firestore
      const submissionData = {
        fileName: uploadResult.sanitizedFileName,
        originalFileName: uploadResult.originalFileName,
        storagePath: uploadResult.storagePath,
        fileSize: uploadResult.metadata.fileSize,
        contentType: uploadResult.metadata.contentType
      };

      const submissionId = await addSubmission(examId, submissionData);
      setUploadProgress(100);

      setDownloadURL(uploadResult.downloadURL);
      console.log(`✅ Submission uploaded successfully: ${submissionId}`);

      return {
        ...uploadResult,
        submissionId
      };
    } catch (err) {
      console.error('Error uploading submission:', err);
      setError(err.message || 'Failed to upload submission');
      throw err;
    } finally {
      setUploading(false);
    }
  }, [validateFile]);

  /**
   * Reset upload state
   */
  const resetUpload = useCallback(() => {
    setUploading(false);
    setUploadProgress(0);
    setError(null);
    setDownloadURL(null);
  }, []);

  return {
    uploading,
    uploadProgress,
    error,
    downloadURL,
    uploadRettevejledning,
    uploadOmsaetningstabel,
    uploadBedoemmelseskema,
    uploadSubmission,
    resetUpload
  };
}
