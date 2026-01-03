import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useExamContext } from '../hooks/useExamContext.jsx';
import { Layout } from '../components/Layout.jsx';
import { MathExamGrader } from '../components/MathExamGrader.jsx';
import { Loader2, AlertCircle } from '../components/Icons.jsx';

/**
 * ExamDetailPage - Display exam details and grading interface
 * Shell version that wraps the existing MathExamGrader component
 */
export function ExamDetailPage() {
  const { examId } = useParams();
  const { exam, loading, error, setCurrentExamId } = useExamContext();

  // Set the exam ID from URL params
  useEffect(() => {
    if (examId) {
      setCurrentExamId(examId);
    }
  }, [examId, setCurrentExamId]);

  /**
   * Format date to DD/MM/YYYY
   */
  const formatDate = (date) => {
    if (!date) return '-';
    
    let dateObj;
    if (date.toDate) {
      // Firestore Timestamp
      dateObj = date.toDate();
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      dateObj = new Date(date);
    }

    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${day}/${month}/${year}`;
  };

  /**
   * Get badge color based on exam type
   */
  const getTypeBadgeColor = (type) => {
    if (type === 'Matematik') {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    } else if (type === 'Dansk') {
      return 'bg-green-100 text-green-800 border-green-200';
    }
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <Layout>
      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-lg shadow-lg p-12 text-center">
          <Loader2 />
          <p className="text-gray-600 mt-4">Indlæser prøve...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle />
            <div>
              <p className="font-semibold text-red-800">Kunne ikke indlæse prøve</p>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Exam Details */}
      {exam && !loading && !error && (
        <div className="space-y-6">
          {/* Render MathExamGrader component - handles both Matematik and Dansk */}
          <MathExamGrader />
        </div>
      )}
    </Layout>
  );
}
