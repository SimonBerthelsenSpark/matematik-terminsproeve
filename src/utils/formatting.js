/**
 * Formatting utilities
 * Centralized formatting functions for dates, numbers, etc.
 */

/**
 * Format a date to Danish format (DD/MM/YYYY)
 * @param {Date|Timestamp|string} date - Date to format
 * @returns {string} Formatted date string
 */
export function formatDate(date) {
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

  // Check if date is valid
  if (isNaN(dateObj.getTime())) {
    return '-';
  }

  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  
  return `${day}/${month}/${year}`;
}

/**
 * Format a date to Danish format with time (DD/MM/YYYY HH:MM)
 * @param {Date|Timestamp|string} date - Date to format
 * @returns {string} Formatted date and time string
 */
export function formatDateTime(date) {
  if (!date) return '-';
  
  let dateObj;
  if (date.toDate) {
    dateObj = date.toDate();
  } else if (date instanceof Date) {
    dateObj = date;
  } else {
    dateObj = new Date(date);
  }

  if (isNaN(dateObj.getTime())) {
    return '-';
  }

  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Format a number with specified decimal places
 * @param {number} num - Number to format
 * @param {number} decimals - Number of decimal places (default: 1)
 * @returns {string} Formatted number
 */
export function formatNumber(num, decimals = 1) {
  if (num === null || num === undefined || isNaN(num)) {
    return '-';
  }
  
  return Number(num).toFixed(decimals);
}

/**
 * Format file size to human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format a percentage
 * @param {number} value - Value to format
 * @param {number} total - Total value
 * @param {number} decimals - Number of decimal places (default: 1)
 * @returns {string} Formatted percentage
 */
export function formatPercentage(value, total, decimals = 1) {
  if (!total || total === 0) return '0%';
  
  const percentage = (value / total) * 100;
  return formatNumber(percentage, decimals) + '%';
}

/**
 * Format duration in milliseconds to human readable format
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
export function formatDuration(ms) {
  if (!ms || ms === 0) return '0s';
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}t ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} suffix - Suffix to add (default: '...')
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength, suffix = '...') {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  
  return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Format student name for filename (replace spaces with underscores)
 * @param {string} name - Student name
 * @returns {string} Formatted name
 */
export function formatStudentNameForFile(name) {
  if (!name) return '';
  return name.trim().replace(/\s+/g, '_');
}

/**
 * Parse student name from filename
 * @param {string} filename - Filename to parse
 * @returns {Object} {studentNumber, studentName, extension}
 */
export function parseStudentFilename(filename) {
  // Expected format: "25_Peter_Jensen.pdf"
  const match = filename.match(/^(\d+)_(.+?)\.([^.]+)$/);
  
  if (!match) {
    return null;
  }
  
  const [, studentNumber, studentName, extension] = match;
  
  return {
    studentNumber,
    studentName: studentName.replace(/_/g, ' '),
    extension
  };
}

/**
 * Capitalize first letter of each word
 * @param {string} text - Text to capitalize
 * @returns {string} Capitalized text
 */
export function capitalizeWords(text) {
  if (!text) return '';
  
  return text
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
