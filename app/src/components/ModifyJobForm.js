import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserId } from '../utils/mockAuth';
import './JobForm.css';

/**
 * ModifyJobForm Component
 * This component allows users to modify parameters for an existing job
 * without re-uploading the image files.
 */
const ModifyJobForm = () => {
  const navigate = useNavigate();
  
  // State for form fields
  const [formData, setFormData] = useState({
    detectionModel: '1000-redwood',
    email: '',
    classify: 'False',
    hierarchicalClassificationType: 'off',
    performSmoothing: 'False'
  });
  
  // State for job details from the status page
  const [jobDetails, setJobDetails] = useState(null);
  
  // State for validation errors
  const [errors, setErrors] = useState({
    email: '',
    api: ''
  });
  
  // State for API message type (success or error)
  const [apiMessageType, setApiMessageType] = useState('error');
  
  // State for loading state and success
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  
  // Destructure formData for easier access in the JSX
  const { 
    detectionModel, 
    email, 
    classify, 
    hierarchicalClassificationType, 
    performSmoothing 
  } = formData;

  // Function to fetch the original job parameters
  const fetchOriginalJobParameters = useCallback(async (jobId) => {
    try {
      // In a real implementation, you would fetch the job details from an API
      // For this example, we'll use some default values
      // You could implement an API endpoint like /api/get-job-details?jobId=xxx
      
      // Placeholder for API call
      
      // Set default values for now
      setFormData({
        detectionModel: '1000-redwood',
        email: '',
        classify: 'False',
        hierarchicalClassificationType: 'off',
        performSmoothing: 'False'
      });
      
    } catch (error) {
      console.error('Error fetching job parameters:', error);
      setErrors({
        ...errors,
        api: 'Failed to load original job parameters. Using default values.'
      });
    }
  }, [errors]); // Add dependencies for useCallback
  
  // Load job details from session storage when component mounts
  useEffect(() => {
    const storedJobDetails = sessionStorage.getItem('modifyJobDetails');
    console.log('Retrieved job details from session storage:', storedJobDetails);
    
    if (storedJobDetails) {
      try {
        const parsedDetails = JSON.parse(storedJobDetails);
        console.log('Parsed job details:', parsedDetails);
        setJobDetails(parsedDetails);
        
        // Try to load the original job parameters if available
        if (parsedDetails && parsedDetails.jobId) {
          fetchOriginalJobParameters(parsedDetails.jobId);
        }
      } catch (error) {
        console.error('Error parsing job details:', error);
        setErrors({
          ...errors,
          api: 'Error loading job details. Please try again.'
        });
        
        // Navigate back to status page after a delay
        setTimeout(() => {
          navigate('/status');
        }, 2000);
      }
    } else {
      console.log('No job details found in session storage');
      // If no job details found, redirect to the status page
      setErrors({
        ...errors,
        api: 'No job details found. Redirecting to status page.'
      });
      
      setTimeout(() => {
        navigate('/status');
      }, 2000);
    }
  }, [navigate, fetchOriginalJobParameters]);
  
  // Validate email format
  const validateEmail = (email) => {
    if (!email) return true; // Empty email is valid (will use AD email)
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  };
  
  // Validate form before submission
  const validateForm = () => {
    let isValid = true;
    const newErrors = { email: '' };
    
    // Validate email (optional, but must be valid if provided)
    if (formData.email && !validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
      isValid = false;
    }
    
    setErrors(prevErrors => ({
      ...prevErrors,
      ...newErrors
    }));
    
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
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Reset states
    setSubmitSuccess(false);
    setErrors({...errors, api: ''});
    
    // Validate form before submission
    if (!validateForm()) {
      return;
    }
    
    // Ensure we have job details
    if (!jobDetails || !jobDetails.jobId) {
      setErrors({
        ...errors, 
        api: 'Missing job details. Please go back to the job status page and try again.'
      });
      return;
    }
    
    // Set loading state
    setIsSubmitting(true);
    
    try {
      // Get the user ID
      const userId = await getUserId();
      
      // Prepare the request body
      const requestBody = {
        email: formData.email,
        model_version: formData.detectionModel,
        classify: formData.classify,
        hitax_type: formData.hierarchicalClassificationType,
        do_smoothing: formData.performSmoothing,
        image_path_prefix: jobDetails.imagePath,
        request_name: userId,
        api_instance_name: "web",
        caller: "awc",
        modify_params: "True"
      };
      
      // Send the request to the Flask server
      const response = await fetch('/api-proxy/request_detections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      // Handle the response
      if (response.ok) {
        
        // Show success message
        setApiMessageType('success');
        setErrors({
          ...errors, 
          api: 'Job parameters modified successfully! A new job has been created with the updated parameters.'
        });
        setSubmitSuccess(true);
        
        // After 2 seconds, redirect back to the status page
        setTimeout(() => {
          navigate('/status');
        }, 2000);
      } else {
        // Handle error response
        const responseText = await response.text();
        let errorDetail = '';
        
        try {
          // Try to parse as JSON
          const errorJson = JSON.parse(responseText);
          errorDetail = errorJson.error || errorJson.message || responseText;
        } catch (parseError) {
          // If not JSON, use the response text directly
          errorDetail = responseText || `Status ${response.status}`;
        }
        
        throw new Error(`Error ${response.status}: ${errorDetail}`);
      }
    } catch (error) {
      console.error('Error modifying job:', error);
      
      // Show error message
      setApiMessageType('error');
      setErrors({
        ...errors,
        api: error.message || 'Failed to modify job parameters. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // If job details are not loaded, show loading message
  if (!jobDetails) {
    return (
      <div className="job-form-container">
        <h2>Loading job details...</h2>
      </div>
    );
  }
  
  return (
    <div className="job-form-container">
      <h2>Modify Job Parameters</h2>
      
      <div className="job-details">
        <p><strong>Job ID:</strong> {jobDetails.jobId}</p>
        <p><strong>Folder:</strong> {jobDetails.folderName || 'N/A'}</p>
        <p><strong>Number of Images:</strong> {jobDetails.numImages || 'N/A'}</p>
      </div>
      
      {/* API Message (Error or Success) */}
      {errors.api && (
        <div className={`api-${apiMessageType === 'success' ? 'success' : 'error'}-message`}>
          {errors.api}
        </div>
      )}
      
      {!submitSuccess && (
        <form onSubmit={handleSubmit} className="job-form">
          {/* Detection Model Dropdown (model_version in API) */}
          <div className="form-group">
            <label htmlFor="detectionModel">Model Version:</label>
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
            <label htmlFor="email">Email: <span className="optional-label">(optional - will use your AD email if empty)</span></label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={handleInputChange}
              placeholder="Enter your email address or leave empty to use AD email"
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
              {/* Hierarchical Classification Type Dropdown (hitax_type in API) */}
              <div className="form-group">
                <label htmlFor="hierarchicalClassificationType">Hitax Type:</label>
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

              {/* Perform Smoothing Dropdown (do_smoothing in API) */}
              <div className="form-group">
                <label htmlFor="performSmoothing">Do Smoothing:</label>
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

          {/* Action Buttons */}
          <div className="form-actions">
            <button
              type="button"
              className="cancel-button"
              onClick={() => navigate('/status')}
            >
              Cancel
            </button>
            
            <button 
              type="submit" 
              className="submit-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit this job'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default ModifyJobForm;
