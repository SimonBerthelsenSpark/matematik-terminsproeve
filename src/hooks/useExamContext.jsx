import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getExam } from '../services/firestoreService.js';

/**
 * Context for managing current exam state
 */
const ExamContext = createContext(null);

/**
 * Provider component for exam context
 * Wraps components that need access to current exam data
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @returns {React.Component} Context provider
 */
export function ExamContextProvider({ children }) {
  const [examId, setExamId] = useState(null);
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Load exam data when examId changes
   */
  useEffect(() => {
    if (!examId) {
      setExam(null);
      setLoading(false);
      setError(null);
      return;
    }

    const loadExam = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const examData = await getExam(examId);
        
        if (!examData) {
          throw new Error('Exam not found');
        }
        
        setExam(examData);
        console.log(`📖 Loaded exam context: ${examId}`);
      } catch (err) {
        console.error('Error loading exam in context:', err);
        setError(err.message || 'Failed to load exam');
        setExam(null);
      } finally {
        setLoading(false);
      }
    };

    loadExam();
  }, [examId]);

  /**
   * Set current exam ID
   * @param {string} id - Exam document ID
   */
  const setCurrentExamId = useCallback((id) => {
    setExamId(id);
  }, []);

  /**
   * Clear current exam
   */
  const clearExam = useCallback(() => {
    setExamId(null);
    setExam(null);
    setError(null);
  }, []);

  /**
   * Refresh current exam data
   */
  const refreshExam = useCallback(async () => {
    if (!examId) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const examData = await getExam(examId);
      
      if (!examData) {
        throw new Error('Exam not found');
      }
      
      setExam(examData);
      console.log(`🔄 Refreshed exam context: ${examId}`);
    } catch (err) {
      console.error('Error refreshing exam:', err);
      setError(err.message || 'Failed to refresh exam');
    } finally {
      setLoading(false);
    }
  }, [examId]);

  /**
   * Update exam data in context (optimistic update)
   * @param {Object} updates - Fields to update
   */
  const updateExamInContext = useCallback((updates) => {
    if (!exam) {
      return;
    }

    setExam(prevExam => ({
      ...prevExam,
      ...updates
    }));
  }, [exam]);

  const value = {
    examId,
    exam,
    loading,
    error,
    setCurrentExamId,
    clearExam,
    refreshExam,
    updateExamInContext
  };

  return (
    <ExamContext.Provider value={value}>
      {children}
    </ExamContext.Provider>
  );
}

/**
 * Custom hook to access exam context
 * Must be used within ExamContextProvider
 * 
 * @returns {Object} Exam context value
 * @property {string|null} examId - Current exam ID
 * @property {Object|null} exam - Current exam data
 * @property {boolean} loading - Loading state
 * @property {string|null} error - Error message if any
 * @property {Function} setCurrentExamId - Set current exam ID
 * @property {Function} clearExam - Clear current exam
 * @property {Function} refreshExam - Refresh current exam data
 * @property {Function} updateExamInContext - Update exam data optimistically
 * 
 * @example
 * function ExamDetailPage() {
 *   const { exam, loading, setCurrentExamId } = useExamContext();
 *   
 *   useEffect(() => {
 *     setCurrentExamId('exam-123');
 *   }, []);
 *   
 *   if (loading) return <div>Loading...</div>;
 *   return <div>{exam?.beskrivelse}</div>;
 * }
 */
export function useExamContext() {
  const context = useContext(ExamContext);
  
  if (!context) {
    throw new Error('useExamContext must be used within ExamContextProvider');
  }
  
  return context;
}
