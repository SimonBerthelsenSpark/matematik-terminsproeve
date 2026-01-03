import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useExams } from '../hooks/useExams.js';
import { Layout } from '../components/Layout.jsx';
import { Loader2, AlertCircle, CheckCircle, X, Trash2 } from '../components/Icons.jsx';
import { getAllClasses, getStudents } from '../services/classService.js';
import { uploadStudentSubmission } from '../services/storageService.js';
import { addSubmission, getSubmissions, deleteSubmission, getGradingResults } from '../services/firestoreService.js';
import { removeStudentFromOldGradingHistory } from '../utils/cleanupGradingHistory.js';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase.js';

/**
 * StudentMatrixPage - Upload individual exam papers for each student
 */
export function StudentMatrixPage() {
  const navigate = useNavigate();
  const { examId } = useParams();
  const { exams } = useExams();

  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [gradingResults, setGradingResults] = useState([]);
  const [uploadingStudentId, setUploadingStudentId] = useState(null);
  const [deletingSubmissionId, setDeletingSubmissionId] = useState(null);
  const [error, setError] = useState(null);

  /**
   * Load exam and students
   */
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Find exam
        const currentExam = exams.find(e => e.id === examId);
        if (!currentExam) {
          setError('Prøve ikke fundet');
          setLoading(false);
          return;
        }
        setExam(currentExam);

        // Find class and get students
        const classes = await getAllClasses();
        const examClass = classes.find(c => c.className === currentExam.klasse);
        
        if (examClass) {
          const studentList = await getStudents(examClass.id);
          setStudents(studentList);
        } else {
          // Class not found in database, might be a custom class name
          setStudents([]);
        }

        // Get existing submissions
        const existingSubmissions = await getSubmissions(examId);
        setSubmissions(existingSubmissions);

        // Get grading results from new subcollection
        let results = await getGradingResults(examId);
        console.log('📊 Grading results from new format:', results.length);
        
        // FALLBACK: If no results in new format, try old gradingHistory collection
        if (results.length === 0) {
          console.log('📊 No results in new format, checking old gradingHistory...');
          try {
            const historyQuery = query(
              collection(db, 'gradingHistory'),
              where('examId', '==', examId)
            );
            const historySnapshot = await getDocs(historyQuery);
            console.log('📊 History snapshot size:', historySnapshot.size);
            
            if (!historySnapshot.empty) {
              const historyEntry = historySnapshot.docs[0].data();
              console.log('📊 Found gradingHistory entry:', historyEntry);
              
              if (historyEntry.opgaver && Array.isArray(historyEntry.opgaver)) {
                // Transform old format to match new format for display
                // We need to match with submission IDs based on elevNavn
                results = historyEntry.opgaver
                  .filter(item => !item.error)
                  .map(item => {
                    // Find matching submission by checking if submission fileName contains the elevNavn
                    const elevNavnWithoutExt = item.elevNavn?.replace(/\.[^/.]+$/, '') || 'unknown';
                    const matchingSubmission = existingSubmissions.find(sub =>
                      sub.fileName && sub.fileName.includes(elevNavnWithoutExt)
                    );
                    
                    return {
                      submissionId: matchingSubmission?.id || elevNavnWithoutExt,
                      elevNavn: item.elevNavn,
                      aiGrading: {
                        karakter: item.karakter,
                        totalPoint: item.totalPoint
                      },
                      lærerGrading: item.lærerTotalPoint !== undefined ? {
                        lærerKarakter: item.lærerKarakter,
                        lærerTotalPoint: item.lærerTotalPoint
                      } : null
                    };
                  });
                console.log('📊 Transformed old results:', results.length);
                console.log('📊 First transformed result:', results[0]);
              }
            }
          } catch (historyErr) {
            console.warn('Could not load from gradingHistory:', historyErr);
          }
        }
        
        console.log('📊 Final grading results count:', results.length);
        if (results.length > 0) {
          console.log('📊 First result:', results[0]);
          console.log('📊 First result submissionId:', results[0].submissionId);
        }
        setGradingResults(results);

        console.log('📝 Submissions loaded:', existingSubmissions);
        console.log('📝 Submissions count:', existingSubmissions.length);
        if (existingSubmissions.length > 0) {
          console.log('📝 First submission:', existingSubmissions[0]);
          console.log('📝 First submission id:', existingSubmissions[0].id);
        }

        setLoading(false);
      } catch (err) {
        console.error('Error loading data:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    if (exams.length > 0) {
      loadData();
    }
  }, [examId, exams]);

  /**
   * Handle file upload for a student
   */
  const handleFileUpload = async (student, file) => {
    if (!file) return;

    try {
      setUploadingStudentId(student.id);

      // Extract file extension from uploaded file
      const fileExtension = file.name.split('.').pop();
      
      // Create filename: studentNumber_studentName.extension
      const fileName = `${student.studentNumber}_${student.studentName}.${fileExtension}`;

      // Upload file to storage
      const uploadResult = await uploadStudentSubmission(examId, file, fileName);

      // Add submission to Firestore
      await addSubmission(examId, {
        fileName: fileName,
        originalFileName: file.name,
        storagePath: uploadResult.storagePath,
        fileSize: file.size,
        contentType: file.type
      });

      // Reload submissions and grading results
      const updatedSubmissions = await getSubmissions(examId);
      setSubmissions(updatedSubmissions);
      
      const updatedResults = await getGradingResults(examId);
      setGradingResults(updatedResults);

      alert(`Besvarelse uploadet for ${student.studentName}!`);
    } catch (err) {
      console.error('Error uploading file:', err);
      alert(`Fejl ved upload: ${err.message}`);
    } finally {
      setUploadingStudentId(null);
    }
  };

  /**
   * Handle delete submission
   */
  const handleDeleteSubmission = async (student) => {
    const fileName = `${student.studentNumber}_${student.studentName}`;
    const submission = submissions.find(sub =>
      sub.fileName && sub.fileName.startsWith(fileName)
    );

    if (!submission) return;

    // Check if submission is graded
    const submissionId = submission.id;
    const isGraded = gradingResults.some(result => result.submissionId === submissionId);

    const confirmMessage = isGraded
      ? `Dette vil slette både besvarelsen OG rettelsen for ${student.studentName}.\n\nEr du sikker?`
      : `Slet besvarelsen for ${student.studentName}?`;

    if (!window.confirm(confirmMessage)) return;

    try {
      setDeletingSubmissionId(student.id);

      // Delete submission and new grading results
      await deleteSubmission(examId, submissionId, submission.storagePath);

      // ALSO delete from old gradingHistory collection if it exists
      try {
        await removeStudentFromOldGradingHistory(examId, student.studentName);
        console.log('✅ Cleaned up old grading history');
      } catch (historyErr) {
        console.warn('⚠️ Could not clean up old grading history:', historyErr);
        // Don't fail the operation if old cleanup fails
      }

      // Reload submissions and grading results
      const updatedSubmissions = await getSubmissions(examId);
      setSubmissions(updatedSubmissions);

      const updatedResults = await getGradingResults(examId);
      setGradingResults(updatedResults);

      alert(`Besvarelse${isGraded ? ' og rettelse' : ''} slettet for ${student.studentName}!`);
    } catch (err) {
      console.error('Error deleting submission:', err);
      alert(`Fejl ved sletning: ${err.message}`);
    } finally {
      setDeletingSubmissionId(null);
    }
  };

  /**
   * Check if student has submission
   */
  const hasSubmission = (student) => {
    const fileName = `${student.studentNumber}_${student.studentName}`;
    return submissions.some(sub =>
      sub.fileName && sub.fileName.startsWith(fileName)
    );
  };

  /**
   * Check if student has grading result
   */
  const getGradingInfo = (student) => {
    const fileName = `${student.studentNumber}_${student.studentName}`;
    const submission = submissions.find(sub =>
      sub.fileName && sub.fileName.startsWith(fileName)
    );

    if (!submission) {
      console.log(`🔍 No submission for ${student.studentName}`);
      return null;
    }

    console.log(`🔍 Looking for grading result for ${student.studentName}`);
    console.log(`🔍 Submission ID: ${submission.id}`);
    console.log(`🔍 Available grading results:`, gradingResults.map(r => r.submissionId));
    
    const result = gradingResults.find(r => r.submissionId === submission.id);
    console.log(`🔍 Found result:`, result ? 'YES' : 'NO');
    
    return result;
  };

  /**
   * Format date
   */
  const formatDate = (date) => {
    if (!date) return '-';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${day}/${month}/${year}`;
  };

  if (loading) {
    return (
      <Layout>
        <div className="bg-white rounded-lg shadow-lg p-12 text-center">
          <Loader2 />
          <p className="text-gray-600 mt-4">Indlæser elever...</p>
        </div>
      </Layout>
    );
  }

  if (error || !exam) {
    return (
      <Layout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle />
            <div>
              <p className="font-semibold text-red-800">Fejl</p>
              <p className="text-red-700 text-sm mt-1">{error || 'Prøve ikke fundet'}</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Student Matriks</h2>
              <p className="text-gray-600 mt-1">
                {exam.beskrivelse} - {exam.klasse}
              </p>
              <p className="text-sm text-gray-500">
                📅 {formatDate(exam.dato)}
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

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-semibold text-blue-800">Upload elevbesvarelser</p>
              <p className="text-blue-700 text-sm mt-1">
                Upload individuelle elevbesvarelser for hver elev i klassen. Filerne navngives automatisk med elevnummer og navn.
              </p>
              <p className="text-blue-600 text-xs mt-1">
                Accepterer PDF og Word dokumenter (.pdf, .doc, .docx)
              </p>
            </div>
          </div>
        </div>

        {/* Student List */}
        {students.length === 0 ? (
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
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              Ingen elever i klassen
            </h3>
            <p className="text-gray-600 mb-6">
              Klassen "{exam.klasse}" har ingen registrerede elever. Opret elever i klasseadministrationen først.
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors"
            >
              Gå til startside
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Elevnr.
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Navn
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      AI Karakter
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Lærer Karakter
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Upload besvarelse
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Handlinger
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {students.map((student) => {
                    const uploaded = hasSubmission(student);
                    const gradingInfo = getGradingInfo(student);
                    const isUploading = uploadingStudentId === student.id;
                    const isDeleting = deletingSubmissionId === student.id;

                    return (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {student.studentNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {student.studentName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {gradingInfo ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                              <CheckCircle className="w-4 h-4" />
                              Rettet
                            </span>
                          ) : uploaded ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                              <CheckCircle className="w-4 h-4" />
                              Uploadet
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
                              <X className="w-4 h-4" />
                              Mangler
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {gradingInfo ? (
                            <span className="font-semibold text-blue-600">
                              {gradingInfo.aiGrading?.karakter || '-'}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {gradingInfo?.lærerGrading?.lærerKarakter !== undefined ? (
                            <span className="font-semibold text-amber-600">
                              {gradingInfo.lærerGrading.lærerKarakter}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {!uploaded && (
                            <div className="flex items-center gap-2">
                              <input
                                type="file"
                                accept=".pdf,.doc,.docx"
                                id={`file-${student.id}`}
                                onChange={(e) => {
                                  const file = e.target.files[0];
                                  if (file) {
                                    handleFileUpload(student, file);
                                    e.target.value = ''; // Reset input
                                  }
                                }}
                                disabled={isUploading}
                                className="text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50"
                              />
                              {isUploading && (
                                <Loader2 />
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {uploaded && (
                            <button
                              onClick={() => handleDeleteSubmission(student)}
                              disabled={isDeleting}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 font-semibold rounded-lg transition-colors disabled:opacity-50"
                              title={gradingInfo ? "Slet besvarelse og rettelse" : "Slet besvarelse"}
                            >
                              {isDeleting ? (
                                <Loader2 />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                              Slet
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Summary */}
        {students.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Oversigt</h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{students.length}</p>
                <p className="text-sm text-gray-600">Elever i alt</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-900">
                  {submissions.length}
                </p>
                <p className="text-sm text-green-600">Uploadet</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-900">
                  {gradingResults.length}
                </p>
                <p className="text-sm text-blue-600">Rettet</p>
              </div>
              <div className="text-center p-4 bg-amber-50 rounded-lg">
                <p className="text-2xl font-bold text-amber-900">
                  {students.length - submissions.length}
                </p>
                <p className="text-sm text-amber-600">Mangler</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
