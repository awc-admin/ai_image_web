import React, { useState } from 'react';
import './JobForm.css';

/**
 * Job Submission Form Component
 * This component provides a form for users to submit image processing jobs
 * with various configuration options.
 */
const JobForm = () => {
  // State for all form fields using useState hook
  const [formData, setFormData] = useState({
    // Default values for the form fields
    files: null,
    detectionModel: '1000-redwood',
    email: '',
    classify: 'False',
    hierarchicalClassificationType: 'off',
    performSmoothing: 'False'
  });
  
  // State for validation errors
  const [errors, setErrors] = useState({
    files: '',
    email: '',
    api: ''
  });
  
  // State for success message and loading state
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Destructure formData for easier access in the JSX
  const { 
    detectionModel, 
    email, 
    classify, 
    hierarchicalClassificationType, 
    performSmoothing 
  } = formData;

  // Validate email format
  const validateEmail = (email) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  };
  
  // Validate form before submission
  const validateForm = () => {
    let isValid = true;
    const newErrors = { files: '', email: '' };
    
    // Validate files
    if (!formData.files || formData.files.length === 0) {
      newErrors.files = 'You must select at least one file';
      isValid = false;
    }
    
    // Validate email (optional, but must be valid if provided)
    if (formData.email && !validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
      isValid = false;
    }
    
    setErrors(newErrors);
    return isValid;
  };

  // Handle changes to any input field
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Clear error when user starts typing in the field
    if (name === 'email' && errors.email) {
      setErrors({
        ...errors,
        email: ''
      });
    }
    
    setFormData({
      ...formData,
      [name]: value
    });
  };

  // Special handler for file input since it has different structure
  const handleFileChange = (e) => {
    // Clear file error when user selects files
    if (errors.files) {
      setErrors({
        ...errors,
        files: ''
      });
    }
    
    setFormData({
      ...formData,
      files: e.target.files
    });
  };

  // Reset form to initial state
  const resetForm = () => {
    setFormData({
      files: null,
      detectionModel: '1000-redwood',
      email: '',
      classify: 'False',
      hierarchicalClassificationType: 'off',
      performSmoothing: 'False'
    });
    setErrors({
      files: '',
      email: '',
      api: ''
    });
    
    // Reset the file input element
    const fileInput = document.getElementById('files');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Reset success message and API error
    setSubmitSuccess(false);
    setErrors({...errors, api: ''});
    
    // Validate form before submission
    if (!validateForm()) {
      // Don't proceed if validation fails
      return;
    }
    
    // Set loading state
    setIsSubmitting(true);
    
    try {
      // Prepare form data for API
      const apiData = {
        email: formData.email,
        detectionModel: formData.detectionModel,
        classify: formData.classify,
        hierarchicalClassificationType: formData.hierarchicalClassificationType,
        performSmoothing: formData.performSmoothing,
        fileCount: formData.files ? formData.files.length : 0
      };
      
      // Log the data being sent to the API
      console.log('Sending data to API:', apiData);
      
      // For demonstration, we'll use a timeout to simulate the API call
      // In production, you would use the commented code to make a real API call
      
      /*
      // Send data to API endpoint
      const response = await fetch('/api/submit-job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiData)
      });
      
      // Process response
      const result = await response.json();
      
      if (response.ok) {
        // Show success message
        setSubmitSuccess(true);
        // Reset form
        resetForm();
        console.log('Job submitted successfully:', result);
      } else {
        // Handle API error
        setErrors({
          ...errors,
          api: result.error || 'An error occurred while submitting the job'
        });
        console.error('API error:', result);
      }
      */
      
      // Simulate API call for demonstration
      setTimeout(() => {
        setSubmitSuccess(true);
        
        // Log the form data to the console
        console.log('Job Submission Form Data:', formData);
        
        // For files, log the number of files and their names
        if (formData.files) {
          console.log(`Selected ${formData.files.length} files`);
          
          // Convert FileList to Array to use forEach
          Array.from(formData.files).forEach((file, index) => {
            if (index < 5) { // Only log first 5 files to avoid console clutter
              console.log(`- ${file.name} (${Math.round(file.size / 1024)} KB)`);
            }
          });
          
          if (formData.files.length > 5) {
            console.log(`... and ${formData.files.length - 5} more files`);
          }
        }
        
        // Reset form after successful submission
        resetForm();
        
        // Hide success message after 5 seconds
        setTimeout(() => {
          setSubmitSuccess(false);
        }, 5000);
        
        // Reset loading state
        setIsSubmitting(false);
      }, 1500);
      
    } catch (error) {
      // Handle network error
      setErrors({
        ...errors,
        api: 'Network error. Please try again later.'
      });
      console.error('Network error:', error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="job-form-container">
      <h2>Submit a New Image Processing Job</h2>
      
      {/* Success Message */}
      {submitSuccess && (
        <div className="success-message">
          Your job has been submitted successfully! 
          {formData.email ? ' We\'ll send the results to your email when processing is complete.' : ' No email provided for notifications.'}
        </div>
      )}
      
      {/* API Error Message */}
      {errors.api && (
        <div className="api-error-message">
          {errors.api}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="job-form">
        {/* File Upload Field */}
        <div className={`form-group ${errors.files ? 'has-error' : ''}`}>
          <label htmlFor="files">Select Images Directory:</label>
          <input
            type="file"
            id="files"
            onChange={handleFileChange}
            webkitdirectory="true"
            multiple
            className="file-input"
          />
          {errors.files && <div className="error-message">{errors.files}</div>}
          {formData.files && formData.files.length > 0 && (
            <div className="file-info">
              <div><strong>{formData.files.length} files selected</strong></div>
              {formData.files.length > 0 && (
                <div className="file-preview">
                  {Array.from(formData.files).slice(0, 3).map((file, index) => (
                    <div key={index} className="file-item">
                      <span className="file-name">{file.name}</span>
                      <span className="file-size">({Math.round(file.size / 1024)} KB)</span>
                    </div>
                  ))}
                  {formData.files.length > 3 && (
                    <div className="file-more">...and {formData.files.length - 3} more files</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Detection Model Dropdown */}
        <div className="form-group">
          <label htmlFor="detectionModel">Detection Model:</label>
          <select
            id="detectionModel"
            name="detectionModel"
            value={detectionModel}
            onChange={handleInputChange}
            className="form-select"
          >
            <option value="1000-redwood">1000-redwood</option>
            <option value="5b">5b</option>
          </select>
        </div>

        {/* Email Field */}
        <div className={`form-group ${errors.email ? 'has-error' : ''}`}>
          <label htmlFor="email">Email:</label>
          <input
            type="email"
            id="email"
            name="email"
            value={email}
            onChange={handleInputChange}
            placeholder="Enter your email address (optional)"
            className="form-input"
          />
          {errors.email && <div className="error-message">{errors.email}</div>}
        </div>

        {/* Classify Dropdown */}
        <div className="form-group">
          <label htmlFor="classify">Classify:</label>
          <select
            id="classify"
            name="classify"
            value={classify}
            onChange={handleInputChange}
            className="form-select"
          >
            <option value="True">True</option>
            <option value="False">False</option>
          </select>
        </div>

        {/* Conditional Fields - only shown when Classify is True */}
        {classify === 'True' && (
          <>
            {/* Hierarchical Classification Type Dropdown */}
            <div className="form-group">
              <label htmlFor="hierarchicalClassificationType">Hierarchical Classification Type:</label>
              <select
                id="hierarchicalClassificationType"
                name="hierarchicalClassificationType"
                value={hierarchicalClassificationType}
                onChange={handleInputChange}
                className="form-select"
              >
                <option value="off">off</option>
                <option value="label rollup">label rollup</option>
                <option value="hitax classifier">hitax classifier</option>
              </select>
            </div>

            {/* Perform Smoothing Dropdown */}
            <div className="form-group">
              <label htmlFor="performSmoothing">Perform Smoothing:</label>
              <select
                id="performSmoothing"
                name="performSmoothing"
                value={performSmoothing}
                onChange={handleInputChange}
                className="form-select"
              >
                <option value="True">True</option>
                <option value="False">False</option>
              </select>
            </div>
          </>
        )}

        {/* Submit Button */}
        <div className="form-group">
          <button 
            type="submit" 
            className="submit-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Job'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default JobForm;
