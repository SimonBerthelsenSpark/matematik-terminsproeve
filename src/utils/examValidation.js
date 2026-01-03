/**
 * Exam validation utilities
 * Validates exam state and readiness for operations
 */

import { ERROR_MESSAGES } from '../constants/messages.js';
import logger from './logger.js';

/**
 * Validate if exam is ready for AI grading
 * @param {Object} exam - Exam object
 * @returns {Object} {valid: boolean, errors: string[]}
 */
export function validateExamReadyForGrading(exam) {
  const errors = [];
  
  if (!exam) {
    errors.push(ERROR_MESSAGES.EXAM_NOT_FOUND);
    return { valid: false, errors };
  }
  
  // Check for rettevejledning
  if (!exam.rettevejledningRef || !exam.rettevejledningRef.storagePath) {
    errors.push(ERROR_MESSAGES.MISSING_RETTEVEJLEDNING);
  }
  
  // Check for omsætningstabel
  if (!exam.omsætningstabelRef || !exam.omsætningstabelRef.storagePath) {
    errors.push(ERROR_MESSAGES.MISSING_OMSAETNINGSTABEL);
  }
  
  if (errors.length > 0) {
    logger.warn('Exam validation failed:', exam.id, errors);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate exam creation data
 * @param {Object} examData - Exam data to validate
 * @returns {Object} {valid: boolean, errors: Object}
 */
export function validateExamData(examData) {
  const errors = {};
  
  // Beskrivelse
  if (!examData.beskrivelse || !examData.beskrivelse.trim()) {
    errors.beskrivelse = ERROR_MESSAGES.REQUIRED_FIELD;
  } else if (examData.beskrivelse.trim().length < 3) {
    errors.beskrivelse = 'Beskrivelsen skal være mindst 3 tegn';
  }
  
  // Dato
  if (!examData.dato) {
    errors.dato = ERROR_MESSAGES.REQUIRED_FIELD;
  } else {
    const date = new Date(examData.dato);
    if (isNaN(date.getTime())) {
      errors.dato = ERROR_MESSAGES.INVALID_DATE;
    }
  }
  
  // Klasse
  if (!examData.klasse || !examData.klasse.trim()) {
    errors.klasse = ERROR_MESSAGES.REQUIRED_FIELD;
  }
  
  // Type
  if (!examData.type) {
    errors.type = ERROR_MESSAGES.REQUIRED_FIELD;
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Validate if exam has submissions to grade
 * @param {Array} submissions - Array of submissions
 * @param {Array} gradingResults - Array of grading results
 * @returns {Object} {valid: boolean, ungraded: Array}
 */
export function validateHasSubmissionsToGrade(submissions, gradingResults) {
  // Find submissions that don't have grading results
  const gradedSubmissionIds = new Set(
    gradingResults.map(r => r.submissionId)
  );
  
  const ungradedSubmissions = submissions.filter(
    sub => !gradedSubmissionIds.has(sub.id) && sub.status !== 'error'
  );
  
  if (ungradedSubmissions.length === 0) {
    logger.info('No ungraded submissions found');
  }
  
  return {
    valid: ungradedSubmissions.length > 0,
    ungraded: ungradedSubmissions,
    count: ungradedSubmissions.length
  };
}

/**
 * Validate file upload
 * @param {File} file - File to validate
 * @param {Object} options - Validation options
 * @returns {Object} {valid: boolean, error: string|null}
 */
export function validateFileUpload(file, options = {}) {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = ['.pdf', '.doc', '.docx']
  } = options;
  
  if (!file) {
    return { valid: false, error: ERROR_MESSAGES.REQUIRED_FIELD };
  }
  
  // Check file size
  if (file.size > maxSize) {
    return { valid: false, error: ERROR_MESSAGES.FILE_TOO_LARGE };
  }
  
  // Check file type
  const fileExt = '.' + file.name.split('.').pop().toLowerCase();
  if (!allowedTypes.includes(fileExt)) {
    return { 
      valid: false, 
      error: `${ERROR_MESSAGES.INVALID_FILE_TYPE} (Tilladt: ${allowedTypes.join(', ')})` 
    };
  }
  
  return { valid: true, error: null };
}

/**
 * Validate class data
 * @param {Object} classData - Class data to validate
 * @returns {Object} {valid: boolean, errors: Object}
 */
export function validateClassData(classData) {
  const errors = {};
  
  if (!classData.className || !classData.className.trim()) {
    errors.className = ERROR_MESSAGES.CLASS_NAME_REQUIRED;
  } else if (classData.className.trim().length < 1) {
    errors.className = 'Klassenavn skal være mindst 1 tegn';
  } else if (classData.className.trim().length > 50) {
    errors.className = 'Klassenavn må højst være 50 tegn';
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Validate student data
 * @param {Object} studentData - Student data to validate
 * @returns {Object} {valid: boolean, errors: Object}
 */
export function validateStudentData(studentData) {
  const errors = {};
  
  // Student number
  if (!studentData.studentNumber || !studentData.studentNumber.trim()) {
    errors.studentNumber = ERROR_MESSAGES.STUDENT_NUMBER_REQUIRED;
  }
  
  // Student name
  if (!studentData.studentName || !studentData.studentName.trim()) {
    errors.studentName = ERROR_MESSAGES.STUDENT_NAME_REQUIRED;
  } else if (studentData.studentName.trim().length < 2) {
    errors.studentName = 'Elevnavn skal være mindst 2 tegn';
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Validate grading result before save
 * @param {Object} gradingData - Grading data to validate
 * @returns {Object} {valid: boolean, error: string|null}
 */
export function validateGradingData(gradingData) {
  if (!gradingData) {
    return { valid: false, error: 'Mangler rettelsesdata' };
  }
  
  if (!gradingData.opgaver || !Array.isArray(gradingData.opgaver)) {
    return { valid: false, error: 'Mangler opgaver' };
  }
  
  if (typeof gradingData.totalPoint !== 'number') {
    return { valid: false, error: 'Mangler totalPoint' };
  }
  
  if (typeof gradingData.karakter !== 'number') {
    return { valid: false, error: 'Mangler karakter' };
  }
  
  return { valid: true, error: null };
}

/**
 * Validate teacher grading adjustments
 * @param {Object} teacherGrading - Teacher grading data
 * @returns {Object} {valid: boolean, error: string|null}
 */
export function validateTeacherGrading(teacherGrading) {
  if (!teacherGrading) {
    return { valid: false, error: 'Mangler lærer-rettelse' };
  }
  
  if (typeof teacherGrading.totalPoint !== 'number') {
    return { valid: false, error: 'Mangler totalPoint' };
  }
  
  if (typeof teacherGrading.karakter !== 'number') {
    return { valid: false, error: 'Mangler karakter' };
  }
  
  // Validate grade is valid Danish grade
  const validGrades = [-3, 0, 2, 4, 7, 10, 12];
  if (!validGrades.includes(teacherGrading.karakter)) {
    return { valid: false, error: 'Ugyldig karakter' };
  }
  
  return { valid: true, error: null };
}

/**
 * Validate bulk upload files
 * @param {FileList|Array} files - Files to validate
 * @param {number} maxCount - Maximum number of files
 * @returns {Object} {valid: Array, invalid: Array, errors: Array}
 */
export function validateBulkUpload(files, maxCount = 100) {
  const valid = [];
  const invalid = [];
  const errors = [];
  
  if (files.length > maxCount) {
    errors.push(`For mange filer. Maksimum er ${maxCount}.`);
    return { valid: [], invalid: Array.from(files), errors };
  }
  
  Array.from(files).forEach(file => {
    const validation = validateFileUpload(file);
    if (validation.valid) {
      valid.push(file);
    } else {
      invalid.push(file);
      errors.push(`${file.name}: ${validation.error}`);
    }
  });
  
  return { valid, invalid, errors };
}
