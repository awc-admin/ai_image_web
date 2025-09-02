/**
 * Utility functions for file operations
 */

/**
 * Check if a file is an image based on its extension
 * 
 * @param {File} file - The file to check
 * @returns {boolean} - True if the file is an image
 */
export const isImageFile = (file) => {
  // List of common image file extensions
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp', '.svg'];
  const fileName = file.name.toLowerCase();
  return imageExtensions.some(ext => fileName.endsWith(ext));
};

/**
 * Format a file size in bytes to a human-readable string
 * 
 * @param {number} bytes - The file size in bytes
 * @param {number} decimals - Number of decimal places to show
 * @returns {string} - Formatted file size (e.g., "1.5 MB")
 */
export const formatFileSize = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Extract the top-level folder name from a file's relative path
 * 
 * @param {File} file - The file with a webkitRelativePath
 * @returns {string} - The top folder name or empty string
 */
export const extractTopFolderName = (file) => {
  if (file && file.webkitRelativePath) {
    const pathParts = file.webkitRelativePath.split('/');
    if (pathParts.length > 0) {
      return pathParts[0];
    }
  }
  return '';
};

/**
 * Filter an array of files to get only image files
 * 
 * @param {FileList|Array} files - The files to filter
 * @returns {Array} - Array containing only image files
 */
export const filterImageFiles = (files) => {
  return Array.from(files || []).filter(file => isImageFile(file));
};

/**
 * Calculate total size of all files in an array
 * 
 * @param {Array} files - Array of File objects
 * @returns {number} - Total size in bytes
 */
export const calculateTotalFileSize = (files) => {
  return files.reduce((total, file) => total + file.size, 0);
};
