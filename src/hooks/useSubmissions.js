import { useState, useCallback } from 'react';
import {
  getSubmissions as getSubmissionsService,
  checkFilenameExists as checkFilenameExistsService,
  addSubmission as addSubmissionService,
  updateSubmissionStatus as updateSubmissionStatusService
} from '../services/firestoreService.js';

/**
 * Custom hook for managing student submissions
 * Provides state management and operations for exam submissions
 * 
 * @returns {Object} Hook state and functions
 * @property {Array} submissions - List of submissions
 * @property {boolean} loading - Loading state
 * @property {string|null} error - Error message if any
 * @property {Function} loadSubmissions - Load submissions for an exam
 * @property {Function} checkFilenameExists - Check if filename already exists
 * @property {Function} addSubmission - Add new submission
 * @property {Function} updateSubmissionStatus - Update submission status
 * @property {Function} clearSubmissions - Clear submissions state
 */
export function useSubmissions() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Load submissions for a specific exam
   * @param {string} examId - Exam document ID
   * @param {string} statusFilter - Optional status filter ('pending', 'processing', 'graded', 'error')
   * @returns {Promise<Array>} Array of submissions
   */
  const loadSubmissions = useCallback(async (examId, statusFilter = null) => {
    try {
      setLoading(true);
      setError(null);

      if (!examId) {
        throw new Error('Exam ID is required');
      }

      const fetchedSubmissions = await getSubmissionsService(examId, statusFilter);
      setSubmissions(fetchedSubmissions);
      
      console.log(`📄 Loaded ${fetchedSubmissions.length} submissions for exam ${examId}`);
      
      return fetchedSubmissions;
    } catch (err) {
      console.error('Error loading submissions:', err);
      setError(err.message || 'Failed to load submissions');
      setSubmissions([]);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Check if a filename already exists for an exam
   * @param {string} examId - Exam document ID
   * @param {string} filename - Filename to check
   * @returns {Promise<boolean>} True if filename exists
   */
  const checkFilenameExists = useCallback(async (examId, filename) => {
    try {
      if (!examId) {
        throw new Error('Exam ID is required');
      }

      if (!filename) {
        throw new Error('Filename is required');
      }

      const exists = await checkFilenameExistsService(examId, filename);
      return exists;
    } catch (err) {
      console.error('Error checking filename:', err);
      throw err;
    }
  }, []);

  /**
   * Add a new submission
   * @param {string} examId - Exam document ID
   * @param {Object} submissionData - Submission metadata
   * @returns {Promise<string>} Submission document ID
   */
  const addSubmission = useCallback(async (examId, submissionData) => {
    try {
      setError(null);

      if (!examId) {
        throw new Error('Exam ID is required');
      }

      if (!submissionData.fileName) {
        throw new Error('Filename is required');
      }

      const submissionId = await addSubmissionService(examId, submissionData);
      
      // Add to local state
      const newSubmission = {
        id: submissionId,
        ...submissionData,
        status: 'pending',
        uploadedAt: new Date()
      };
      
      setSubmissions(prevSubmissions => [...prevSubmissions, newSubmission]);
      
      console.log(`✅ Added submission: ${submissionId}`);
      
      return submissionId;
    } catch (err) {
      console.error('Error adding submission:', err);
      setError(err.message || 'Failed to add submission');
      throw err;
    }
  }, []);

  /**
   * Update submission status
   * @param {string} examId - Exam document ID
   * @param {string} submissionId - Submission document ID
   * @param {string} status - New status ('pending', 'processing', 'graded', 'error')
   * @param {Object} additionalData - Additional fields to update
   * @returns {Promise<void>}
   */
  const updateSubmissionStatus = useCallback(async (examId, submissionId, status, additionalData = {}) => {
    try {
      setError(null);

      if (!examId) {
        throw new Error('Exam ID is required');
      }

      if (!submissionId) {
        throw new Error('Submission ID is required');
      }

      const validStatuses = ['pending', 'processing', 'graded', 'error'];
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }

      await updateSubmissionStatusService(examId, submissionId, status, additionalData);
      
      // Update local state
      setSubmissions(prevSubmissions =>
        prevSubmissions.map(sub =>
          sub.id === submissionId
            ? { ...sub, status, ...additionalData }
            : sub
        )
      );
      
      console.log(`✅ Updated submission ${submissionId} status to: ${status}`);
    } catch (err) {
      console.error('Error updating submission status:', err);
      setError(err.message || 'Failed to update submission status');
      throw err;
    }
  }, []);

  /**
   * Clear submissions state
   * Useful when switching between exams
   */
  const clearSubmissions = useCallback(() => {
    setSubmissions([]);
    setLoading(false);
    setError(null);
  }, []);

  return {
    submissions,
    loading,
    error,
    loadSubmissions,
    checkFilenameExists,
    addSubmission,
    updateSubmissionStatus,
    clearSubmissions
  };
}
