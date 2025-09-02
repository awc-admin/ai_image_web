/**
 * Utility functions for upload state management
 */

// Constants for localStorage keys and upload states
export const UPLOAD_STATE_KEY_PREFIX = 'upload_job_';

export const UPLOAD_STATES = {
  IDLE: 'idle',
  CREATING_JOB: 'creating_job',
  UPLOADING: 'uploading',
  COMPLETING: 'completing',
  COMPLETE: 'complete',
  ERROR: 'error'
};

/**
 * Create a default upload progress object
 * 
 * @returns {Object} - Default upload progress state
 */
export const getDefaultUploadProgress = () => ({
  total: 0,
  uploaded: 0,
  current: null,
  percentage: 0
});

/**
 * Save upload state to localStorage
 * 
 * @param {string} jobId - The job ID
 * @param {Object} uploadState - The upload state object
 */
export const saveUploadState = (jobId, uploadState) => {
  try {
    localStorage.setItem(
      `${UPLOAD_STATE_KEY_PREFIX}${jobId}`, 
      JSON.stringify(uploadState)
    );
  } catch (error) {
    console.error('Error saving upload state to localStorage:', error);
  }
};

/**
 * Load upload state from localStorage
 * 
 * @param {string} jobId - The job ID
 * @returns {Object|null} - The upload state or null if not found
 */
export const loadUploadState = (jobId) => {
  try {
    const stateJson = localStorage.getItem(`${UPLOAD_STATE_KEY_PREFIX}${jobId}`);
    return stateJson ? JSON.parse(stateJson) : null;
  } catch (error) {
    console.error('Error loading upload state from localStorage:', error);
    return null;
  }
};

/**
 * Clear upload state from localStorage
 * 
 * @param {string} jobId - The job ID
 */
export const clearUploadState = (jobId) => {
  try {
    localStorage.removeItem(`${UPLOAD_STATE_KEY_PREFIX}${jobId}`);
  } catch (error) {
    console.error('Error clearing upload state from localStorage:', error);
  }
};
