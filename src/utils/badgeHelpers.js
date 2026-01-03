/**
 * Badge and status color helpers
 * Centralized color schemes for consistent UI
 */

/**
 * Get badge color classes based on exam type
 * @param {string} type - Exam type ('Matematik', 'Dansk', etc.)
 * @returns {string} Tailwind CSS classes
 */
export function getExamTypeBadgeColor(type) {
  const colors = {
    'Matematik': 'bg-blue-100 text-blue-800 border-blue-200',
    'Dansk': 'bg-green-100 text-green-800 border-green-200',
    'Engelsk': 'bg-purple-100 text-purple-800 border-purple-200',
    'Tysk': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'Fransk': 'bg-pink-100 text-pink-800 border-pink-200'
  };
  
  return colors[type] || 'bg-gray-100 text-gray-800 border-gray-200';
}

/**
 * Get badge color classes based on submission status
 * @param {string} status - Submission status ('pending', 'processing', 'graded', 'error')
 * @returns {string} Tailwind CSS classes
 */
export function getStatusBadgeColor(status) {
  const colors = {
    'pending': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'processing': 'bg-blue-100 text-blue-800 border-blue-200',
    'graded': 'bg-green-100 text-green-800 border-green-200',
    'reviewed': 'bg-purple-100 text-purple-800 border-purple-200',
    'error': 'bg-red-100 text-red-800 border-red-200'
  };
  
  return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
}

/**
 * Get status text in Danish
 * @param {string} status - Status key
 * @returns {string} Danish status text
 */
export function getStatusText(status) {
  const texts = {
    'pending': 'Afventer',
    'processing': 'Behandler',
    'graded': 'Rettet',
    'reviewed': 'Gennemgået',
    'error': 'Fejl',
    'draft': 'Kladde',
    'active': 'Aktiv',
    'archived': 'Arkiveret'
  };
  
  return texts[status] || status;
}

/**
 * Get grade color (background & text) based on grade value
 * @param {number} grade - Grade (0-12 or -3)
 * @returns {string} Tailwind CSS classes
 */
export function getGradeColor(grade) {
  if (grade === -3) {
    return 'bg-red-100 text-red-900';
  } else if (grade === 0 || grade === 2) {
    return 'bg-red-50 text-red-800';
  } else if (grade === 4) {
    return 'bg-orange-100 text-orange-800';
  } else if (grade === 7) {
    return 'bg-yellow-100 text-yellow-800';
  } else if (grade === 10) {
    return 'bg-green-100 text-green-800';
  } else if (grade === 12) {
    return 'bg-emerald-100 text-emerald-900';
  }
  
  return 'bg-gray-100 text-gray-800';
}

/**
 * Get progress color based on percentage
 * @param {number} percentage - Progress percentage (0-100)
 * @returns {string} Tailwind CSS color class
 */
export function getProgressColor(percentage) {
  if (percentage === 100) {
    return 'bg-green-600';
  } else if (percentage >= 75) {
    return 'bg-blue-600';
  } else if (percentage >= 50) {
    return 'bg-yellow-500';
  } else if (percentage >= 25) {
    return 'bg-orange-500';
  } else {
    return 'bg-red-500';
  }
}

/**
 * Get icon for exam type
 * @param {string} type - Exam type
 * @returns {string} Emoji icon
 */
export function getExamTypeIcon(type) {
  const icons = {
    'Matematik': '📐',
    'Dansk': '📚',
    'Engelsk': '🇬🇧',
    'Tysk': '🇩🇪',
    'Fransk': '🇫🇷'
  };
  
  return icons[type] || '📄';
}

/**
 * Get icon for status
 * @param {string} status - Status
 * @returns {string} Emoji icon
 */
export function getStatusIcon(status) {
  const icons = {
    'pending': '⏳',
    'processing': '🔄',
    'graded': '✅',
    'reviewed': '👁️',
    'error': '❌',
    'draft': '📝',
    'active': '🟢',
    'archived': '📦'
  };
  
  return icons[status] || '❓';
}

/**
 * Get severity level color
 * @param {string} severity - Severity level ('info', 'success', 'warning', 'error')
 * @returns {string} Tailwind CSS classes
 */
export function getSeverityColor(severity) {
  const colors = {
    'info': 'bg-blue-50 border-blue-200 text-blue-800',
    'success': 'bg-green-50 border-green-200 text-green-800',
    'warning': 'bg-amber-50 border-amber-200 text-amber-800',
    'error': 'bg-red-50 border-red-200 text-red-800'
  };
  
  return colors[severity] || 'bg-gray-50 border-gray-200 text-gray-800';
}

/**
 * Get file type color
 * @param {string} extension - File extension
 * @returns {string} Tailwind CSS classes
 */
export function getFileTypeColor(extension) {
  const ext = extension.toLowerCase().replace('.', '');
  
  const colors = {
    'pdf': 'bg-red-100 text-red-800',
    'doc': 'bg-blue-100 text-blue-800',
    'docx': 'bg-blue-100 text-blue-800',
    'xls': 'bg-green-100 text-green-800',
    'xlsx': 'bg-green-100 text-green-800',
    'txt': 'bg-gray-100 text-gray-800'
  };
  
  return colors[ext] || 'bg-gray-100 text-gray-800';
}

/**
 * Get file type icon
 * @param {string} extension - File extension
 * @returns {string} Emoji icon
 */
export function getFileTypeIcon(extension) {
  const ext = extension.toLowerCase().replace('.', '');
  
  const icons = {
    'pdf': '📕',
    'doc': '📘',
    'docx': '📘',
    'xls': '📗',
    'xlsx': '📗',
    'txt': '📄'
  };
  
  return icons[ext] || '📎';
}
