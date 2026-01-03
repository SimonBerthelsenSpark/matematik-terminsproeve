/**
 * Logging utility
 * Provides structured logging with different levels
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

// Set current log level based on environment
const currentLevel = import.meta.env.MODE === 'production' 
  ? LOG_LEVELS.WARN 
  : LOG_LEVELS.DEBUG;

/**
 * Format log message with timestamp and context
 * @param {string} level - Log level
 * @param {Array} args - Log arguments
 * @returns {Array} Formatted arguments
 */
function formatLogMessage(level, args) {
  const timestamp = new Date().toLocaleTimeString('da-DK');
  const levelIcons = {
    DEBUG: '🔍',
    INFO: 'ℹ️',
    WARN: '⚠️',
    ERROR: '❌'
  };
  
  return [
    `%c${levelIcons[level]} [${level}] ${timestamp}`,
    `color: ${getLogColor(level)}; font-weight: bold`,
    ...args
  ];
}

/**
 * Get color for log level
 * @param {string} level - Log level
 * @returns {string} CSS color
 */
function getLogColor(level) {
  const colors = {
    DEBUG: '#6B7280',
    INFO: '#3B82F6',
    WARN: '#F59E0B',
    ERROR: '#EF4444'
  };
  
  return colors[level] || '#000000';
}

/**
 * Logger class with different log levels
 */
export const logger = {
  /**
   * Debug level logging
   * Only visible in development
   * @param  {...any} args - Arguments to log
   */
  debug: (...args) => {
    if (currentLevel <= LOG_LEVELS.DEBUG) {
      console.log(...formatLogMessage('DEBUG', args));
    }
  },

  /**
   * Info level logging
   * General information
   * @param  {...any} args - Arguments to log
   */
  info: (...args) => {
    if (currentLevel <= LOG_LEVELS.INFO) {
      console.info(...formatLogMessage('INFO', args));
    }
  },

  /**
   * Warning level logging
   * Non-critical issues
   * @param  {...any} args - Arguments to log
   */
  warn: (...args) => {
    if (currentLevel <= LOG_LEVELS.WARN) {
      console.warn(...formatLogMessage('WARN', args));
    }
  },

  /**
   * Error level logging
   * Critical errors
   * @param  {...any} args - Arguments to log
   */
  error: (...args) => {
    if (currentLevel <= LOG_LEVELS.ERROR) {
      console.error(...formatLogMessage('ERROR', args));
    }
  },

  /**
   * Group logging - start
   * @param {string} label - Group label
   */
  group: (label) => {
    if (currentLevel <= LOG_LEVELS.INFO) {
      console.group(label);
    }
  },

  /**
   * Group logging - end
   */
  groupEnd: () => {
    if (currentLevel <= LOG_LEVELS.INFO) {
      console.groupEnd();
    }
  },

  /**
   * Table logging for arrays/objects
   * @param {Array|Object} data - Data to display as table
   */
  table: (data) => {
    if (currentLevel <= LOG_LEVELS.INFO) {
      console.table(data);
    }
  },

  /**
   * Time logging - start timer
   * @param {string} label - Timer label
   */
  time: (label) => {
    if (currentLevel <= LOG_LEVELS.DEBUG) {
      console.time(label);
    }
  },

  /**
   * Time logging - end timer
   * @param {string} label - Timer label
   */
  timeEnd: (label) => {
    if (currentLevel <= LOG_LEVELS.DEBUG) {
      console.timeEnd(label);
    }
  }
};

/**
 * Domain-specific loggers for better organization
 */
export const examLogger = {
  created: (examId, exam) => {
    logger.info('Exam created:', examId, exam);
  },
  updated: (examId, changes) => {
    logger.info('Exam updated:', examId, changes);
  },
  deleted: (examId) => {
    logger.warn('Exam deleted:', examId);
  },
  error: (operation, error) => {
    logger.error(`Exam ${operation} error:`, error);
  }
};

export const classLogger = {
  created: (classId, className) => {
    logger.info('Class created:', classId, className);
  },
  deleted: (classId, className) => {
    logger.warn('Class deleted:', classId, className);
  },
  studentAdded: (classId, studentId) => {
    logger.info('Student added to class:', classId, studentId);
  },
  studentDeleted: (classId, studentId) => {
    logger.warn('Student deleted from class:', classId, studentId);
  },
  error: (operation, error) => {
    logger.error(`Class ${operation} error:`, error);
  }
};

export const submissionLogger = {
  uploaded: (examId, fileName) => {
    logger.info('Submission uploaded:', examId, fileName);
  },
  deleted: (examId, submissionId) => {
    logger.warn('Submission deleted:', examId, submissionId);
  },
  error: (operation, error) => {
    logger.error(`Submission ${operation} error:`, error);
  }
};

export const gradingLogger = {
  started: (examId, count) => {
    logger.info(`Grading started for ${count} submissions:`, examId);
  },
  completed: (examId, submissionId, grade) => {
    logger.info('Grading completed:', examId, submissionId, `Grade: ${grade}`);
  },
  failed: (examId, submissionId, error) => {
    logger.error('Grading failed:', examId, submissionId, error);
  },
  teacherAdjusted: (examId, submissionId, oldGrade, newGrade) => {
    logger.info('Teacher adjusted grade:', examId, submissionId, `${oldGrade} → ${newGrade}`);
  }
};

export const storageLogger = {
  uploaded: (path, size) => {
    logger.info('File uploaded:', path, `Size: ${size} bytes`);
  },
  deleted: (path) => {
    logger.warn('File deleted:', path);
  },
  error: (operation, path, error) => {
    logger.error(`Storage ${operation} error:`, path, error);
  }
};

export const migrationLogger = {
  started: (source, target, count) => {
    logger.info(`Migration started: ${source} → ${target}`, `Count: ${count}`);
  },
  progress: (current, total) => {
    logger.info(`Migration progress: ${current}/${total}`);
  },
  completed: (count, duration) => {
    logger.info(`Migration completed: ${count} items in ${duration}ms`);
  },
  error: (error) => {
    logger.error('Migration error:', error);
  }
};

// Export default logger
export default logger;
