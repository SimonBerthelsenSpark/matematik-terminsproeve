/**
 * Application configuration
 * Centralized configuration values
 */

export const APP_CONFIG = {
  // Application
  APP_NAME: 'Matematik Terminsprøve Retter',
  APP_VERSION: '2.0.0',
  
  // File Upload
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10 MB
  ALLOWED_SUBMISSION_TYPES: ['.pdf', '.doc', '.docx'],
  ALLOWED_GUIDE_TYPES: ['.pdf', '.doc', '.docx'],
  ALLOWED_TABLE_TYPES: ['.pdf', '.doc', '.docx', '.xls', '.xlsx'],
  
  // Pagination
  STUDENTS_PER_PAGE: 50,
  EXAMS_PER_PAGE: 20,
  RESULTS_PER_PAGE: 30,
  
  // Caching
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
  CLASSES_CACHE_KEY: 'classes',
  EXAMS_CACHE_KEY: 'exams',
  
  // AI Grading
  AI_TIMEOUT: 120000, // 2 minutes
  AI_RETRY_ATTEMPTS: 3,
  AI_RETRY_DELAY: 2000, // 2 seconds
  
  // API
  API_BASE_URL: '/.netlify/functions',
  
  // Toast
  TOAST_DURATION: 4000,
  TOAST_ERROR_DURATION: 5000,
  
  // UI
  DEBOUNCE_DELAY: 300,
  ANIMATION_DURATION: 200,
  
  // Exam Types
  EXAM_TYPES: ['Matematik', 'Dansk'],
  DEFAULT_EXAM_TYPE: 'Matematik',
  
  // Grading
  DANISH_GRADES: [-3, 0, 2, 4, 7, 10, 12],
  MIN_GRADE: -3,
  MAX_GRADE: 12,
  
  // Export
  EXCEL_FILENAME: 'karakterer_export',
  PDF_FILENAME: 'elevrapport',
  
  // Feature Flags
  FEATURES: {
    BULK_UPLOAD: true,
    EXPORT_EXCEL: true,
    EXPORT_PDF: true,
    DANSK_EXAMS: false, // Not fully supported yet
    AUTO_SAVE: true,
    DARK_MODE: false, // Future feature
  }
};

/**
 * Environment configuration
 */
export const ENV = {
  MODE: import.meta.env.MODE || 'development',
  IS_PRODUCTION: import.meta.env.MODE === 'production',
  IS_DEVELOPMENT: import.meta.env.MODE === 'development',
};

/**
 * Exam status values
 */
export const EXAM_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  ARCHIVED: 'archived'
};

/**
 * Submission status values
 */
export const SUBMISSION_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  GRADED: 'graded',
  REVIEWED: 'reviewed',
  ERROR: 'error'
};

/**
 * Grading source values
 */
export const GRADING_SOURCE = {
  AI: 'ai',
  TEACHER: 'teacher'
};

/**
 * File type mappings
 */
export const FILE_TYPES = {
  PDF: { ext: '.pdf', mime: 'application/pdf' },
  DOC: { ext: '.doc', mime: 'application/msword' },
  DOCX: { ext: '.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  XLS: { ext: '.xls', mime: 'application/vnd.ms-excel' },
  XLSX: { ext: '.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
};

/**
 * Firestore collection names
 */
export const COLLECTIONS = {
  EXAMS: 'exams',
  CLASSES: 'classes',
  STUDENTS: 'students',
  SUBMISSIONS: 'studentSubmissions',
  GRADING_RESULTS: 'gradingResults',
  GRADING_HISTORY: 'gradingHistory', // Old format, to be migrated
};

/**
 * Storage paths
 */
export const STORAGE_PATHS = {
  EXAMS: 'exams',
  RETTEVEJLEDNING: (examId) => `exams/${examId}/rettevejledning`,
  OMSAETNINGSTABEL: (examId) => `exams/${examId}/omsaetningstabel`,
  SUBMISSIONS: (examId) => `exams/${examId}/submissions`
};

/**
 * Date formats
 */
export const DATE_FORMAT = {
  DEFAULT: 'DD/MM/YYYY',
  WITH_TIME: 'DD/MM/YYYY HH:mm',
  ISO: 'YYYY-MM-DD'
};

/**
 * Validation rules
 */
export const VALIDATION = {
  MIN_CLASS_NAME_LENGTH: 1,
  MAX_CLASS_NAME_LENGTH: 50,
  MIN_STUDENT_NAME_LENGTH: 2,
  MAX_STUDENT_NAME_LENGTH: 100,
  MIN_STUDENT_NUMBER_LENGTH: 1,
  MAX_STUDENT_NUMBER_LENGTH: 20,
  MIN_EXAM_DESCRIPTION_LENGTH: 3,
  MAX_EXAM_DESCRIPTION_LENGTH: 200
};
