/**
 * Utility functions for form validation and handling
 */

/**
 * Validate an email format
 * 
 * @param {string} email - The email to validate
 * @returns {boolean} - True if the email is valid
 */
export const validateEmail = (email) => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

/**
 * Create a default form validation errors object
 * 
 * @returns {Object} - Empty errors object
 */
export const createDefaultErrors = () => ({
  files: '',
  email: '',
  api: ''
});

/**
 * Create a default form data object with initial values
 * 
 * @returns {Object} - Form data with default values
 */
export const getDefaultFormData = () => ({
  files: null,
  detectionModel: '1000-redwood',
  email: '',
  classify: 'False',
  hierarchicalClassificationType: 'off',
  performSmoothing: 'False'
});

/**
 * Sanitize a string for Cosmos DB by replacing invalid characters with underscores
 * 
 * @param {string} value - The string to sanitize
 * @returns {string} - Sanitized string with invalid characters replaced by underscores
 */
export const sanitizeForCosmosDb = (value) => {
  if (!value) return '';
  // Replace any character that is not a-z, A-Z, 0-9, period, underscore, or hyphen with underscore
  const invalidCharsPattern = /[^a-zA-Z0-9._-]/g;
  return value.toString().replace(invalidCharsPattern, '_');
};

/**
 * Map form data to API format
 * 
 * @param {Object} formData - The form data to transform
 * @param {string} userId - The user ID
 * @param {number} imageCount - The number of images
 * @param {string} imagePath - The image path prefix
 * @returns {Object} - Formatted data for the API
 */
export const mapFormDataToApiFormat = (formData, userId, imageCount, imagePath) => {
  return {
    email: formData.email,
    model_version: formData.detectionModel,          
    classify: formData.classify,
    hitax_type: formData.hierarchicalClassificationType,
    do_smoothing: formData.performSmoothing,
    num_images: imageCount,
    image_path_prefix: imagePath,
    request_name: sanitizeForCosmosDb(userId),
    api_instance_name: 'web',
    input_container_sas: ''
  };
};
