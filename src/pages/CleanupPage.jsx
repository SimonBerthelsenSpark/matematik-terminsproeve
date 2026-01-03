import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout.jsx';
import { Loader2, AlertCircle, CheckCircle, Trash2 } from '../components/Icons.jsx';
import { 
  cleanupOldGradingHistory, 
  cleanupAllOldGradingHistory 
} from '../utils/cleanupGradingHistory.js';

/**
 * CleanupPage - Admin utility to clean up old gradingHistory collection data
 */
export function CleanupPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [examId, setExamId] = useState('');

  /**
   * Clean up grading history for a specific exam
   */
  const handleCleanupExam = async () => {
    if (!examId.trim()) {
      alert('Indtast venligst et Exam ID');
      return;
    }

    if (!window.confirm(`Slet gammel rettelsesdata for exam "${examId}"?\n\nDette kan ikke fortrydes.`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const count = await cleanupOldGradingHistory(examId.trim());

      setResult({
        type: 'exam',
        examId: examId.trim(),
        count
      });
    } catch (err) {
      console.error('Error cleaning up exam:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Clean up ALL old grading history
   */
  const handleCleanupAll = async () => {
    if (!window.confirm(
      '⚠️ ADVARSEL: Dette vil slette ALLE gamle rettelser fra gradingHistory collection.\n\n' +
      'Dette påvirker kun den gamle datastruktur og vil ikke påvirke nye rettelser.\n\n' +
      'Er du sikker?'
    )) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const count = await cleanupAllOldGradingHistory();

      setResult({
        type: 'all',
        count
      });
    } catch (err) {
      console.error('Error cleaning up all:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Ryd Op i Gammel Data</h2>
              <p className="text-gray-600 mt-1">
                Slet gamle rettelser fra gradingHistory collection
              </p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors"
            >
              Tilbage til oversigt
            </button>
          </div>
        </div>

        {/* Warning Box */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800">Hvad gør dette?</p>
              <p className="text-amber-700 text-sm mt-1">
                Dette værktøj sletter gammel rettelsesdata fra den forældede <code>gradingHistory</code> collection.
                Systemet bruger nu en ny struktur (<code>exams/[examId]/gradingResults</code>), men gamle data kan 
                stadig vises hvis de ikke er ryddet op.
              </p>
              <p className="text-amber-600 text-xs mt-2">
                ⚠️ Denne handling kan ikke fortrydes. Sørg for at du har backup hvis nødvendigt.
              </p>
            </div>
          </div>
        </div>

        {/* Result Message */}
        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-green-800">Oprydning gennemført!</p>
                <p className="text-green-700 text-sm mt-1">
                  {result.type === 'exam' 
                    ? `Slettet ${result.count} gamle rettelser for exam "${result.examId}"`
                    : `Slettet ${result.count} gamle rettelser i alt`
                  }
                </p>
                <button
                  onClick={() => setResult(null)}
                  className="mt-2 text-sm text-green-600 hover:text-green-700 underline"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800">Fejl</p>
                <p className="text-red-700 text-sm mt-1">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="mt-2 text-sm text-red-600 hover:text-red-700 underline"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cleanup for Specific Exam */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Ryd op for specifik prøve
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Slet gamle rettelser for en enkelt prøve. Find Exam ID i URL'en når du ser på en prøve.
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              value={examId}
              onChange={(e) => setExamId(e.target.value)}
              placeholder="Indtast Exam ID (f.eks. 8KBeHHzg72YjOfokd96d)"
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
            />
            <button
              onClick={handleCleanupExam}
              disabled={loading || !examId.trim()}
              className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 />
                  Rydder op...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Ryd op
                </>
              )}
            </button>
          </div>
        </div>

        {/* Cleanup All */}
        <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-red-200">
          <h3 className="text-lg font-semibold text-red-800 mb-4">
            ⚠️ Ryd op i ALLE gamle rettelser
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Slet <strong>alle</strong> gamle rettelser fra gradingHistory collection på én gang.
            Brug kun dette hvis du er sikker på at al vigtig data er blevet migreret til den nye struktur.
          </p>
          <button
            onClick={handleCleanupAll}
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 />
                Rydder op...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Slet ALLE gamle rettelser
              </>
            )}
          </button>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-semibold text-blue-800">Hvordan bruger jeg dette?</p>
              <ol className="text-blue-700 text-sm mt-2 space-y-1 list-decimal list-inside">
                <li>Find det Exam ID, hvor du vil rydde op (fra URL'en)</li>
                <li>Indtast Exam ID i feltet ovenfor og klik "Ryd op"</li>
                <li>Alternativt kan du slette alle gamle rettelser på én gang (FORSIGTIG!)</li>
                <li>Efter oprydning vil gamle rettelser ikke længere vises i systemet</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
