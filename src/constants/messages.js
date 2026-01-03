/**
 * Application messages
 * Centralized messages for consistency and easier i18n in future
 */

export const ERROR_MESSAGES = {
  // General
  SOMETHING_WENT_WRONG: 'Noget gik galt. Prøv igen senere.',
  NETWORK_ERROR: 'Netværksfejl. Tjek din internetforbindelse.',
  PERMISSION_DENIED: 'Du har ikke tilladelse til denne handling.',
  
  // Exam
  EXAM_NOT_FOUND: 'Prøve ikke fundet',
  EXAM_CREATE_FAILED: 'Kunne ikke oprette prøve',
  EXAM_UPDATE_FAILED: 'Kunne ikke opdatere prøve',
  EXAM_DELETE_FAILED: 'Kunne ikke slette prøve',
  MISSING_RETTEVEJLEDNING: 'Mangler rettevejledning. Upload rettevejledning før AI-rettelse.',
  MISSING_OMSAETNINGSTABEL: 'Mangler omsætningstabel. Upload omsætningstabel før AI-rettelse.',
  NO_SUBMISSIONS_TO_GRADE: 'Ingen besvarelser at rette',
  
  // Class
  CLASS_NOT_FOUND: 'Klasse ikke fundet',
  CLASS_CREATE_FAILED: 'Kunne ikke oprette klasse',
  CLASS_DELETE_FAILED: 'Kunne ikke slette klasse',
  CLASS_NAME_REQUIRED: 'Klassenavn er påkrævet',
  CLASS_NAME_EXISTS: 'Klassenavn findes allerede',
  
  // Student
  STUDENT_NOT_FOUND: 'Elev ikke fundet',
  STUDENT_ADD_FAILED: 'Kunne ikke tilføje elev',
  STUDENT_DELETE_FAILED: 'Kunne ikke slette elev',
  STUDENT_NUMBER_REQUIRED: 'Elevnummer er påkrævet',
  STUDENT_NAME_REQUIRED: 'Elevnavn er påkrævet',
  STUDENT_EXISTS: 'Elev findes allerede i klassen',
  
  // Submission
  SUBMISSION_UPLOAD_FAILED: 'Upload fejlede',
  SUBMISSION_DELETE_FAILED: 'Kunne ikke slette besvarelse',
  SUBMISSION_NOT_FOUND: 'Besvarelse ikke fundet',
  FILE_TOO_LARGE: 'Filen er for stor. Maksimal størrelse er 10 MB.',
  INVALID_FILE_TYPE: 'Ugyldig filtype. Accepterer kun PDF og Word dokumenter.',
  FILENAME_EXISTS: 'En fil med dette navn findes allerede',
  
  // Grading
  GRADING_FAILED: 'AI-rettelse fejlede',
  GRADING_TIMEOUT: 'AI-rettelse tog for lang tid',
  GRADING_INVALID_RESPONSE: 'Ugyldig respons fra AI',
  TEACHER_GRADING_SAVE_FAILED: 'Kunne ikke gemme lærer-rettelse',
  
  // Validation
  REQUIRED_FIELD: 'Dette felt er påkrævet',
  INVALID_DATE: 'Ugyldig dato',
  INVALID_NUMBER: 'Ugyldig nummer',
  INVALID_EMAIL: 'Ugyldig e-mail adresse',
  
  // Export  
  EXPORT_FAILED: 'Eksport fejlede',
  NO_DATA_TO_EXPORT: 'Ingen data at eksportere'
};

export const SUCCESS_MESSAGES = {
  // Exam
  EXAM_CREATED: 'Prøve oprettet!',
  EXAM_UPDATED: 'Prøve opdateret!',
  EXAM_DELETED: 'Prøve slettet!',
  FILE_UPLOADED: 'Fil uploadet!',
  RETTEVEJLEDNING_UPLOADED: 'Rettevejledning uploadet!',
  OMSAETNINGSTABEL_UPLOADED: 'Omsætningstabel uploadet!',
  
  // Class
  CLASS_CREATED: 'Klasse oprettet!',
  CLASS_UPDATED: 'Klasse opdateret!',
  CLASS_DELETED: 'Klasse slettet!',
  
  // Student
  STUDENT_ADDED: 'Elev tilføjet!',
  STUDENT_UPDATED: 'Elev opdateret!',
  STUDENT_DELETED: 'Elev slettet!',
  
  // Submission
  SUBMISSION_UPLOADED: 'Besvarelse uploadet!',
  SUBMISSION_DELETED: 'Besvarelse slettet!',
  SUBMISSIONS_UPLOADED: (count) => `${count} besvarelser uploadet!`,
  
  // Grading
  GRADING_COMPLETE: 'Rettelse færdig!',
  ALL_GRADING_COMPLETE: 'Alle rettelser færdige!',
  TEACHER_GRADING_SAVED: 'Lærer-rettelse gemt!',
  
  // Export
  EXPORT_COMPLETE: 'Eksport færdig!',
  EXPORT_STARTED: 'Eksporterer...',
  
  // General
  SAVED: 'Gemt!',
  COPIED: 'Kopieret!',
  CHANGES_SAVED: 'Ændringer gemt!'
};

export const INFO_MESSAGES = {
  // Grading
  GRADING_IN_PROGRESS: 'Retter opgaver...',
  UPLOADING: 'Uploader...',
  LOADING: 'Indlæser...',
  PROCESSING: 'Behandler...',
  DELETING: 'Sletter...',
  
  // Export
  GENERATING_PDF: 'Genererer PDF...',
  GENERATING_EXCEL: 'Genererer Excel...',
  
  // Migration
  MIGRATING_DATA: 'Migrerer data...',
  
  // Empty States
  NO_EXAMS: 'Ingen prøver endnu',
  NO_CLASSES: 'Ingen klasser endnu',
  NO_STUDENTS: 'Ingen elever i denne klasse',
  NO_SUBMISSIONS: 'Ingen uploadede besvarelser endnu',
  NO_GRADING_RESULTS: 'Ingen rettelser endnu'
};

export const WARNING_MESSAGES = {
  UNSAVED_CHANGES: 'Du har ændringer der ikke er gemt. Vil du fortsætte?',
  DELETE_EXAM_CONFIRM: (examName) => 
    `Er du sikker på at du vil slette "${examName}"?\n\nDette vil permanent slette:\n- Prøven\n- Alle uploadede filer\n- Alle rettelser og resultater\n\nDenne handling kan ikke fortrydes!`,
  DELETE_CLASS_CONFIRM: (className) => 
    `Er du sikker på at du vil slette klassen "${className}"?\n\nDette vil også slette alle elever i klassen.\n\nDenne handling kan ikke fortrydes!`,
  DELETE_STUDENT_CONFIRM: (studentName) => 
    `Er du sikker på at du vil slette eleven "${studentName}"?`,
  DELETE_SUBMISSION_CONFIRM: (studentName) => 
    `Slet besvarelsen for ${studentName}?`,
  DELETE_SUBMISSION_WITH_GRADING: (studentName) =>
    `Dette vil slette både besvarelsen OG rettelsen for ${studentName}.\n\nEr du sikker?`,
  REPLACE_SUBMISSION: 'En besvarelse findes allerede. Vil du erstatte den?',
  INVALID_FILE_SIZE: 'Nogle filer er for store og blev ikke uploadet.',
  DANSK_NOT_SUPPORTED: 'Rettelse af dansk prøver er ikke fuldt understøttet endnu.',
  NO_CLASS_STUDENTS: 'Klassen har ingen registrerede elever. Opret elever først.',
  MIGRATION_IN_PROGRESS: 'Data migration er i gang. Vent venligst...'
};

export const CONFIRM_MESSAGES = {
  DELETE_EXAM: 'Slet prøve?',
  DELETE_CLASS: 'Slet klasse?',
  DELETE_STUDENT: 'Slet elev?',
  DELETE_SUBMISSION: 'Slet besvarelse?',
  START_GRADING: 'Start AI-rettelse?',
  RESET_GRADING: 'Nulstil rettelser?',
  LEAVE_PAGE: 'Forlad siden?'
};
