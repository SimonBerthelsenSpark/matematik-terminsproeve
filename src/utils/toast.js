import toast from 'react-hot-toast';

/**
 * Toast notification utilities
 * Centralized toast notifications with consistent styling
 */

const DEFAULT_DURATION = 4000;

export const showToast = {
  /**
   * Success toast
   * @param {string} message - Success message
   * @param {Object} options - Additional options
   */
  success: (message, options = {}) => {
    toast.success(message, {
      duration: DEFAULT_DURATION,
      ...options,
      style: {
        background: '#10B981',
        color: '#fff',
        ...options.style
      },
      iconTheme: {
        primary: '#fff',
        secondary: '#10B981',
      }
    });
  },

  /**
   * Error toast
   * @param {string} message - Error message
   * @param {Object} options - Additional options
   */
  error: (message, options = {}) => {
    toast.error(message, {
      duration: DEFAULT_DURATION + 1000, // Slightly longer for errors
      ...options,
      style: {
        background: '#EF4444',
        color: '#fff',
        ...options.style
      }
    });
  },

  /**
   * Info toast
   * @param {string} message - Info message
   * @param {Object} options - Additional options
   */
  info: (message, options = {}) => {
    toast(message, {
      duration: DEFAULT_DURATION,
      ...options,
      icon: 'ℹ️',
      style: {
        background: '#3B82F6',
        color: '#fff',
        ...options.style
      }
    });
  },

  /**
   * Warning toast
   * @param {string} message - Warning message
   * @param {Object} options - Additional options
   */
  warning: (message, options = {}) => {
    toast(message, {
      duration: DEFAULT_DURATION,
      ...options,
      icon: '⚠️',
      style: {
        background: '#F59E0B',
        color: '#fff',
        ...options.style
      }
    });
  },

  /**
   * Loading toast
   * @param {string} message - Loading message
   * @returns {string} Toast ID for updating
   */
  loading: (message) => {
    return toast.loading(message, {
      style: {
        background: '#6366F1',
        color: '#fff',
      }
    });
  },

  /**
   * Promise toast - shows loading, then success or error
   * @param {Promise} promise - Promise to track
   * @param {Object} messages - Messages for each state
   */
  promise: (promise, messages = {}) => {
    return toast.promise(promise, {
      loading: messages.loading || 'Behandler...',
      success: messages.success || 'Færdig!',
      error: messages.error || 'Noget gik galt'
    }, {
      success: {
        style: {
          background: '#10B981',
          color: '#fff',
        }
      },
      error: {
        style: {
          background: '#EF4444',
          color: '#fff',
        }
      },
      loading: {
        style: {
          background: '#6366F1',
          color: '#fff',
        }
      }
    });
  },

  /**
   * Custom toast with action button
   * @param {string} message - Message
   * @param {Object} action - Action config {label, onClick}
   * @param {string} type - Type: 'success', 'error', 'info', 'warning'
   */
  withAction: (message, action, type = 'info') => {
    const backgrounds = {
      success: '#10B981',
      error: '#EF4444',
      info: '#3B82F6',
      warning: '#F59E0B'
    };

    toast.custom((t) => (
      <div
        className={`${
          t.visible ? 'animate-enter' : 'animate-leave'
        } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
        style={{ backgroundColor: backgrounds[type] }}
      >
        <div className="flex-1 w-0 p-4">
          <p className="text-sm font-medium text-white">
            {message}
          </p>
        </div>
        <div className="flex border-l border-white/20">
          <button
            onClick={() => {
              action.onClick();
              toast.dismiss(t.id);
            }}
            className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-white hover:bg-black/10 focus:outline-none"
          >
            {action.label}
          </button>
        </div>
      </div>
    ), {
      duration: 8000, // Longer duration for action toasts
    });
  },

  /**
   * Dismiss a specific toast
   * @param {string} toastId - Toast ID to dismiss
   */
  dismiss: (toastId) => {
    toast.dismiss(toastId);
  },

  /**
   * Dismiss all toasts
   */
  dismissAll: () => {
    toast.dismiss();
  }
};

// Convenience aliases
export const notify = showToast;
export default showToast;
