import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { HomePage } from './pages/HomePage.jsx';
import { CreateExamPage } from './pages/CreateExamPage.jsx';
import { EditExamPage } from './pages/EditExamPage.jsx';
import { StudentMatrixPage } from './pages/StudentMatrixPage.jsx';
import { ExamDetailPage } from './pages/ExamDetailPage.jsx';
import { ExamContextProvider } from './hooks/useExamContext.jsx';
import './index.css';

// Import Firebase configuration
import { db, storage } from './config/firebase.js';

// Import PDF.js
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Make pdfjs available globally for fileParser
window.pdfjsLib = pdfjsLib;

// Import Mammoth.js
import mammoth from 'mammoth';
window.mammoth = mammoth;

// Make Firebase available globally (for legacy components)
window.db = db;
window.storage = storage;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            borderRadius: '8px',
            padding: '16px',
          }
        }}
      />
      <Routes>
        {/* Home - Exam List */}
        <Route path="/" element={<HomePage />} />
        
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
    </BrowserRouter>
  </React.StrictMode>
);
