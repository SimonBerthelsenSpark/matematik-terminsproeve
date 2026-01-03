import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExams } from '../hooks/useExams.js';
import { Layout } from '../components/Layout.jsx';
import { Loader2, AlertCircle, CheckCircle, X } from '../components/Icons.jsx';
import { Trash2 } from '../components/Icons.jsx';
import { permanentlyDeleteExam } from '../services/firestoreService.js';
import { ClassManagement } from '../components/ClassManagement.jsx';
import { getAllClasses, getStudents } from '../services/classService.js';

/**
 * HomePage - Display list of all exams
 */
export function HomePage() {
  const navigate = useNavigate();
  const { exams, loading, error, refreshExams } = useExams();
  const [deleting, setDeleting] = useState(null);
  const [classStudentCounts, setClassStudentCounts] = useState({});

  /**
   * Load student counts for all classes
   */
  useEffect(() => {
    const loadStudentCounts = async () => {
      try {
        const classes = await getAllClasses();
        const counts = {};
        
        for (const cls of classes) {
          const students = await getStudents(cls.id);
          counts[cls.className] = students.length;
        }
        
        setClassStudentCounts(counts);
      } catch (err) {
        console.error('Error loading student counts:', err);
      }
    };
    
    loadStudentCounts();
  }, []);

  /**
   * Handle exam deletion
   */
  const handleDeleteExam = async (examId, examBeskrivelse) => {
    const confirmed = window.confirm(
      `Er du sikker på at du vil slette "${examBeskrivelse}"?\n\n` +
      `Dette vil permanent slette:\n` +
      `- Prøven\n` +
      `- Alle uploadede filer (Rettevejledning, Omsætningstabel, Elevbesvarelser)\n` +
      `- Alle rettelser og resultater\n\n` +
      `Denne handling kan ikke fortrydes!`
    );

    if (!confirmed) return;

    setDeleting(examId);
    try {
      await permanentlyDeleteExam(examId);
      await refreshExams(); // Reload exam list
      console.log('✅ Exam deleted successfully');
    } catch (err) {
      console.error('Failed to delete exam:', err);
      alert(`Fejl ved sletning: ${err.message}`);
    } finally {
      setDeleting(null);
    }
  };

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
      <div className="space-y-6">
        {/* Class Management Section */}
        <ClassManagement />

        {/* Header with Create Button */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Prøveoversigt</h2>
              <p className="text-gray-600 mt-1">
                Administrer og ret dine prøver
              </p>
            </div>
            <button
              onClick={() => navigate('/exams/new')}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
            >
              + Opret ny prøve
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <Loader2 />
            <p className="text-gray-600 mt-4">Indlæser prøver...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <AlertCircle />
              <div>
                <p className="font-semibold text-red-800">Kunne ikke indlæse prøver</p>
                <p className="text-red-700 text-sm mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && exams.length === 0 && (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <div className="text-gray-400 mb-4">
              <svg
                className="mx-auto h-24 w-24"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              Ingen prøver endnu
            </h3>
            <p className="text-gray-600 mb-6">
              Kom i gang ved at oprette din første prøve
            </p>
            <button
              onClick={() => navigate('/exams/new')}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors"
            >
              Opret ny prøve
            </button>
          </div>
        )}

        {/* Exam Cards Grid */}
        {!loading && !error && exams.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {exams.map((exam) => (
              <ExamCard
                key={exam.id}
                exam={exam}
                onOpen={() => navigate(`/exams/${exam.id}`)}
                onDelete={() => handleDeleteExam(exam.id, exam.beskrivelse)}
                isDeleting={deleting === exam.id}
                formatDate={formatDate}
                getTypeBadgeColor={getTypeBadgeColor}
                totalStudents={classStudentCounts[exam.klasse] || 0}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

/**
 * ExamCard - Individual exam card component
 */
function ExamCard({ exam, onOpen, onDelete, isDeleting, formatDate, getTypeBadgeColor, totalStudents }) {
  const navigate = useNavigate();
  const stats = exam.stats || {};
  const hasRettevejledning = exam.rettevejledningRef ? true : false;
  const hasOmsaetningstabel = exam.omsætningstabelRef ? true : false;

  const handleCardClick = (e) => {
    // Don't open if clicking action buttons or delete button
    if (e.target.closest('.action-button') || e.target.closest('.delete-button')) {
      return;
    }
    onOpen();
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    onDelete();
  };

  const handleEditClick = (e) => {
    e.stopPropagation();
    navigate(`/exams/${exam.id}/edit`);
  };

  const handleMatrixClick = (e) => {
    e.stopPropagation();
    navigate(`/exams/${exam.id}/matrix`);
  };

  const handleGradeClick = (e) => {
    e.stopPropagation();
    navigate(`/exams/${exam.id}`);
  };

  return (
    <div
      onClick={handleCardClick}
      className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer border-2 border-transparent hover:border-indigo-300 relative"
    >
      {/* Delete Button */}
      <button
        onClick={handleDeleteClick}
        disabled={isDeleting}
        className="delete-button absolute top-3 right-3 p-2 bg-red-50 hover:bg-red-100 disabled:bg-gray-100 text-red-600 disabled:text-gray-400 rounded-lg transition-colors"
        title="Slet prøve"
      >
        {isDeleting ? <Loader2 /> : <Trash2 />}
      </button>

      {/* Header with Type Badge */}
      <div className="flex items-start justify-between mb-3 pr-10">
        <h3 className="text-lg font-bold text-gray-800 flex-1 pr-2">
          {exam.beskrivelse || 'Ingen beskrivelse'}
        </h3>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold border ${getTypeBadgeColor(
            exam.type
          )}`}
        >
          {exam.type || 'Ukendt'}
        </span>
      </div>

      {/* Exam Info */}
      <div className="space-y-2 mb-4 text-sm">
        <div className="flex items-center gap-2 text-gray-600">
          <span className="font-medium">📅 Dato:</span>
          <span>{formatDate(exam.dato)}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <span className="font-medium">👥 Klasse:</span>
          <span>{exam.klasse || '-'}</span>
        </div>
      </div>

      {/* File Status */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-xs font-semibold text-gray-700 mb-2">📄 Filer:</p>
        <div className="space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Rettevejledning</span>
            {hasRettevejledning ? (
              <CheckCircle className="w-4 h-4 text-green-600" />
            ) : (
              <X className="w-4 h-4 text-red-400" />
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Omsætningstabel</span>
            {hasOmsaetningstabel ? (
              <CheckCircle className="w-4 h-4 text-green-600" />
            ) : (
              <X className="w-4 h-4 text-red-400" />
            )}
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="pt-3 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-gray-500">Elever</p>
            <p className="font-bold text-gray-800">
              {totalStudents}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Indleveret</p>
            <p className="font-bold text-gray-800">
              {stats.totalSubmissions || 0}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Rettet</p>
            <p className="font-bold text-gray-800">
              {stats.gradedCount || 0}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Gns. karakter</p>
            <p className="font-bold text-gray-800">
              {stats.averageGrade
                ? stats.averageGrade.toFixed(1)
                : '-'}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Gns. point</p>
            <p className="font-bold text-gray-800">
              {stats.averagePoints
                ? stats.averagePoints.toFixed(1)
                : '-'}
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-3 gap-2">
        <button
          onClick={handleEditClick}
          className="action-button px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1"
          title="Rediger prøve"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Rediger
        </button>
        <button
          onClick={handleMatrixClick}
          className="action-button px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1"
          title="Student matriks"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Matriks
        </button>
        <button
          onClick={handleGradeClick}
          className="action-button px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1"
          title="Ret opgaver"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          Ret opgaver
        </button>
      </div>
    </div>
  );
}
