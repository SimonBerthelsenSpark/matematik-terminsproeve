import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ExamContextProvider } from './hooks/useExamContext.jsx';
import { ConfirmProvider } from './components/ui.jsx';
import './index.css';
import { setUsageRecorder } from './services/aiService.js';
import { recordUsage } from './services/usageService.js';

// Alt AI-forbrug registreres pr. dag og pr. prøve
setUsageRecorder(recordUsage);

// Siderne lazy-loades, så forsiden ikke skal hente pdf.js, mammoth m.m.
const HomePage = lazy(() => import('./pages/HomePage.jsx').then(m => ({ default: m.HomePage })));
const CreateExamPage = lazy(() => import('./pages/CreateExamPage.jsx').then(m => ({ default: m.CreateExamPage })));
const EditExamPage = lazy(() => import('./pages/EditExamPage.jsx').then(m => ({ default: m.EditExamPage })));
const StudentMatrixPage = lazy(() => import('./pages/StudentMatrixPage.jsx').then(m => ({ default: m.StudentMatrixPage })));
const ClassesPage = lazy(() => import('./pages/ClassesPage.jsx').then(m => ({ default: m.ClassesPage })));
const UsagePage = lazy(() => import('./pages/UsagePage.jsx').then(m => ({ default: m.UsagePage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx').then(m => ({ default: m.SettingsPage })));
const ExamDetailPage = lazy(() => import('./pages/ExamDetailPage.jsx').then(m => ({ default: m.ExamDetailPage })));

function PageLoader() {
  return (
    <div className="min-h-screen bg-paper" aria-busy="true" />
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 4000,
          style: {
            borderRadius: '10px',
            padding: '12px 14px',
            fontSize: '14px',
            color: '#1E2B3A',
            border: '1px solid #DDE1E6',
            boxShadow: '0 8px 24px rgba(30, 43, 58, 0.12)',
            whiteSpace: 'pre-line',
          },
          success: { iconTheme: { primary: '#2E6B4E', secondary: '#fff' } },
          error: { iconTheme: { primary: '#B4372B', secondary: '#fff' }, duration: 6000 }
        }}
      />
      <ConfirmProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Home - Exam List */}
          <Route path="/" element={<HomePage />} />

          {/* Klasser og elever */}
          <Route path="/klasser" element={<ClassesPage />} />

          {/* Indstillinger (slet alle data) */}
          <Route path="/forbrug" element={<UsagePage />} />
          <Route path="/indstillinger" element={<SettingsPage />} />

          {/* Create New Exam */}
          <Route path="/exams/new" element={<CreateExamPage />} />

          {/* Edit Exam */}
          <Route path="/exams/:examId/edit" element={<EditExamPage />} />

          {/* Student Matrix - Upload individual student exams */}
          <Route path="/exams/:examId/matrix" element={<StudentMatrixPage />} />

          {/* Exam Detail & Grading */}
          <Route
            path="/exams/:examId"
            element={
              <ExamContextProvider>
                <ExamDetailPage />
              </ExamContextProvider>
            }
          />

          {/* Catch all - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      </ConfirmProvider>
    </BrowserRouter>
  </React.StrictMode>
);
