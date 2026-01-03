import { useState, useEffect, useCallback } from 'react';
import {
  getAllExams,
  getExam as getExamService,
  createExam as createExamService,
  updateExam as updateExamService
} from '../services/firestoreService.js';

/**
 * Custom hook for managing exams
 * Provides state management and CRUD operations for exams
 * 
 * @returns {Object} Hook state and functions
 * @property {Array} exams - List of all exams
 * @property {boolean} loading - Loading state
 * @property {string|null} error - Error message if any
 * @property {Function} loadExams - Load all exams from Firestore
 * @property {Function} createExam - Create new exam
 * @property {Function} getExam - Get single exam by ID
 * @property {Function} updateExam - Update exam
 * @property {Function} refreshExams - Reload exams list
 */
export function useExams() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Load all exams from Firestore
   * @param {Object} options - Query options (limitCount, status, type, klasse)
   */
  const loadExams = useCallback(async (options = {}) => {
    try {
      setLoading(true);
      setError(null);
      
      const fetchedExams = await getAllExams(options);
      
      // Sort by date (newest first) - handle Timestamp objects
      const sortedExams = fetchedExams.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
        const dateB = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
        return dateB - dateA;
      });
      
      setExams(sortedExams);
      console.log(`📚 Loaded ${sortedExams.length} exams`);
    } catch (err) {
      console.error('Error loading exams:', err);
      setError(err.message || 'Failed to load exams');
      setExams([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Create a new exam
   * @param {Object} examData - Exam data (beskrivelse, dato, klasse, type)
   * @returns {Promise<string>} Created exam ID
   */
  const createExam = useCallback(async (examData) => {
    try {
      setError(null);
      
      // Validate required fields
      if (!examData.beskrivelse || examData.beskrivelse.trim() === '') {
        throw new Error('Exam description is required');
      }
      
      const examId = await createExamService(examData);
      console.log(`✅ Created exam: ${examId}`);
      
      // Refresh exams list
      await loadExams();
      
      return examId;
    } catch (err) {
      console.error('Error creating exam:', err);
      setError(err.message || 'Failed to create exam');
      throw err;
    }
  }, [loadExams]);

  /**
   * Get a single exam by ID
   * @param {string} examId - Exam document ID
   * @returns {Promise<Object|null>} Exam data or null
   */
  const getExam = useCallback(async (examId) => {
    try {
      setError(null);
      
      if (!examId) {
        throw new Error('Exam ID is required');
      }
      
      const exam = await getExamService(examId);
      return exam;
    } catch (err) {
      console.error('Error getting exam:', err);
      setError(err.message || 'Failed to get exam');
      throw err;
    }
  }, []);

  /**
   * Update an exam
   * @param {string} examId - Exam document ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<void>}
   */
  const updateExam = useCallback(async (examId, updates) => {
    try {
      setError(null);
      
      if (!examId) {
        throw new Error('Exam ID is required');
      }
      
      await updateExamService(examId, updates);
      console.log(`✅ Updated exam: ${examId}`);
      
      // Update local state
      setExams(prevExams => 
        prevExams.map(exam => 
          exam.id === examId ? { ...exam, ...updates } : exam
        )
      );
    } catch (err) {
      console.error('Error updating exam:', err);
      setError(err.message || 'Failed to update exam');
      throw err;
    }
  }, []);

  /**
   * Refresh exams list
   * Alias for loadExams() for clarity
   */
  const refreshExams = useCallback(() => {
    return loadExams();
  }, [loadExams]);

  // Load exams on mount
  useEffect(() => {
    loadExams();
  }, [loadExams]);

  return {
    exams,
    loading,
    error,
    loadExams,
    createExam,
    getExam,
    updateExam,
    refreshExams
  };
}
