import React, { useState, useEffect } from 'react';
import { BlobServiceClient } from '@azure/storage-blob';
import './JobForm.css';

// Constants for localStorage keys and upload states
const UPLOAD_STATE_KEY_PREFIX = 'upload_job_';
const UPLOAD_STATES = {
  IDLE: 'idle',
  CREATING_JOB: 'creating_job',
  UPLOADING: 'uploading',
  COMPLETING: 'completing',
  COMPLETE: 'complete',
  ERROR: 'error'
};

/**
 * Job Submission Form Component
 * This component provides a form for users to submit image processing jobs
 * with various configuration options and supports resilient file uploads.
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
  
  // New state for managing uploads
  const [uploadState, setUploadState] = useState(UPLOAD_STATES.IDLE);
  const [jobDetails, setJobDetails] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({
    total: 0,
    uploaded: 0,
    current: null,
    percentage: 0
  });
  
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
  
  // LocalStorage utilities for saving and retrieving upload state
  const saveUploadState = (jobId, fileList, status = UPLOAD_STATES.UPLOADING) => {
    if (!fileList || fileList.length === 0) {
      console.error("No files provided to saveUploadState");
      return null;
    }
    
    // Convert FileList to an array of file metadata
    const files = Array.from(fileList).map(file => ({
      name: file.name,
      size: file.size,
      type: file.type,
      path: file.webkitRelativePath || '',
      status: 'pending' // Initial status for all files
    }));
    
    // Create upload state object
    const uploadState = {
      jobId,
      status,
      timestamp: Date.now(),
      files,
      formData: {
        detectionModel: formData.detectionModel,
        email: formData.email,
        classify: formData.classify,
        hierarchicalClassificationType: formData.hierarchicalClassificationType,
        performSmoothing: formData.performSmoothing
      },
      uploaded: 0
    };
    
    // Save to localStorage with job ID as key
    localStorage.setItem(UPLOAD_STATE_KEY_PREFIX + jobId, JSON.stringify(uploadState));
    return uploadState;
  };
  
  const getUploadState = (jobId) => {
    const stateJson = localStorage.getItem(UPLOAD_STATE_KEY_PREFIX + jobId);
    return stateJson ? JSON.parse(stateJson) : null;
  };
  
  const updateFileStatus = (jobId, fileName, newStatus) => {
    const state = getUploadState(jobId);
    if (!state) return;
    
    // Find and update the file status
    const updatedFiles = state.files.map(file => {
      if (file.name === fileName) {
        return { ...file, status: newStatus };
      }
      return file;
    });
    
    // Update the uploaded count
    const uploadedCount = updatedFiles.filter(file => file.status === 'complete').length;
    
    // Save the updated state
    localStorage.setItem(
      UPLOAD_STATE_KEY_PREFIX + jobId, 
      JSON.stringify({
        ...state,
        files: updatedFiles,
        uploaded: uploadedCount
      })
    );
    
    return uploadedCount;
  };
  
  const removeUploadState = (jobId) => {
    localStorage.removeItem(UPLOAD_STATE_KEY_PREFIX + jobId);
  };
  
  const findIncompleteUploads = () => {
    // Find all upload state keys in localStorage
    const uploadJobs = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(UPLOAD_STATE_KEY_PREFIX)) {
        const state = JSON.parse(localStorage.getItem(key));
        
        // Check if the job is incomplete (has pending files)
        const hasPendingFiles = state.files.some(file => file.status === 'pending');
        if (hasPendingFiles) {
          uploadJobs.push(state);
        }
      }
    }
    
    // Sort by timestamp (newest first) and return the most recent job
    return uploadJobs.sort((a, b) => b.timestamp - a.timestamp)[0] || null;
  };

  // File upload functions using API instead of direct blob storage
  const uploadFileViaAPI = async (file, jobId) => {
    try {
      // Read the file as a base64 string
      const fileContent = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
      });
      
      // Prepare the payload
      const payload = {
        jobId,
        fileName: file.name,
        fileContent: fileContent,
        contentType: file.type
      };
      
      // Upload via API
      const response = await fetch('/api/upload-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }
      
      return true;
    } catch (error) {
      console.error(`Error uploading file ${file.name}:`, error);
      return false;
    }
  };
  
  // Function to upload all files in a resilient manner
  const uploadFiles = async (jobId, files) => {
    // Get the current upload state from localStorage
    const state = getUploadState(jobId);
    if (!state) {
      setErrors({...errors, api: 'Upload state not found'});
      setUploadState(UPLOAD_STATES.ERROR);
      return;
    }
    
    // Find files that are still pending upload
    const pendingFiles = state.files
      .filter(f => f.status === 'pending')
      .map(f => {
        // Find the matching File object from the FileList
        return Array.from(files).find(file => file.name === f.name);
      })
      .filter(Boolean); // Remove any undefined values
    
    // Set initial progress state
    setUploadProgress({
      total: state.files.length,
      uploaded: state.uploaded,
      current: pendingFiles.length > 0 ? pendingFiles[0].name : null,
      percentage: Math.round((state.uploaded / state.files.length) * 100)
    });
    
    // Set upload state to uploading
    setUploadState(UPLOAD_STATES.UPLOADING);
    
    // Upload each pending file one by one
    for (let i = 0; i < pendingFiles.length; i++) {
      const file = pendingFiles[i];
      
      // Update progress
      setUploadProgress(prev => ({
        ...prev,
        current: file.name,
        percentage: Math.round(((state.uploaded + i) / state.files.length) * 100)
      }));
      
      // Upload the file
      const success = await uploadFileViaAPI(file, jobId);
      
      if (success) {
        // Update file status in localStorage
        const newUploadedCount = updateFileStatus(jobId, file.name, 'complete');
        
        // Update progress
        setUploadProgress(prev => ({
          ...prev,
          uploaded: newUploadedCount
        }));
      } else {
        // If upload fails, keep status as pending so we can retry later
        setErrors({...errors, api: `Failed to upload ${file.name}. You can resume the upload later.`});
        return;
      }
    }
    
      // All files uploaded, update state to completing
    setUploadState(UPLOAD_STATES.COMPLETING);
    
    // Call the complete-upload endpoint (to be implemented)
    try {
      // In a real implementation, you would call a separate API endpoint to finalize
      // For now, we'll just mark it as complete
      
      // Upload completed successfully
      setUploadState(UPLOAD_STATES.COMPLETE);
      setSubmitSuccess(true);      // Remove the upload state from localStorage
      removeUploadState(jobId);
      
      // Hide success message after 5 seconds
      setTimeout(() => {
        setSubmitSuccess(false);
        resetForm();
        setUploadState(UPLOAD_STATES.IDLE);
        setJobDetails(null);
      }, 5000);
      
    } catch (error) {
      console.error('Error completing upload:', error);
      setErrors({...errors, api: 'Error completing upload. Please try again.'});
      setUploadState(UPLOAD_STATES.ERROR);
    }
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
    
    setUploadState(UPLOAD_STATES.IDLE);
    setJobDetails(null);
    setUploadProgress({
      total: 0,
      uploaded: 0,
      current: null,
      percentage: 0
    });
    
    // Reset the file input element
    const fileInput = document.getElementById('files');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  // Handle form submission to create a job
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Reset states
    setSubmitSuccess(false);
    setErrors({...errors, api: ''});
    
    // Validate form before submission
    if (!validateForm()) {
      return;
    }
    
    // Set loading state
    setIsSubmitting(true);
    setUploadState(UPLOAD_STATES.CREATING_JOB);
    
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
      
      // Make API call to create-job endpoint
      const response = await fetch('/api/create-job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiData)
      });
      
      // Process response
      if (response.ok) {
        const result = await response.json();
        console.log('Job created successfully:', result);
        
        // Store job details
        setJobDetails(result);
        
        // Save the upload state to localStorage
        saveUploadState(result.jobId, formData.files);
        
        // Reset the isSubmitting state
        setIsSubmitting(false);
        
        // Show a success message
        setErrors({
          ...errors,
          api: 'Job created successfully! You can now choose to upload directly in the browser or use AzCopy for larger uploads.'
        });
        
        // Add success class to the message
        setTimeout(() => {
          const apiErrorMessage = document.querySelector('.api-error-message');
          if (apiErrorMessage) {
            apiErrorMessage.className = 'api-success-message';
          }
        }, 0);
        
        // Store current files in a variable to ensure they're available for upload
        const currentFiles = formData.files;
        
      } else {
        const errorText = await response.text();
        let errorMessage = 'An error occurred while creating the job';
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
          // If the response is not valid JSON, use the raw text
          errorMessage = errorText || errorMessage;
        }
        
        setErrors({
          ...errors,
          api: errorMessage
        });
        setUploadState(UPLOAD_STATES.ERROR);
        setIsSubmitting(false);
      }
      
    } catch (error) {
      // Handle network error
      console.error('Network error:', error);
      setErrors({
        ...errors,
        api: 'Network error. Please try again later.'
      });
      setUploadState(UPLOAD_STATES.ERROR);
      setIsSubmitting(false);
    }
  };
  
  // Handle starting the upload process
  const handleStartUpload = async () => {
    if (!jobDetails || !jobDetails.jobId) {
      setErrors({...errors, api: 'Missing job details'});
      return;
    }
    
    // If we don't have files in formData but have a valid job ID, 
    // the user might be resuming an upload with newly selected files
    const fileInput = document.getElementById('files');
    const filesToUse = formData.files || (fileInput && fileInput.files ? fileInput.files : null);
    
    if (!filesToUse || filesToUse.length === 0) {
      setErrors({...errors, api: 'Please select image files to upload'});
      return;
    }
    
    // Start the upload process with the available files
    await uploadFiles(jobDetails.jobId, filesToUse);
  };

  // useEffect to check for incomplete uploads when component mounts
  useEffect(() => {
    // Only check for incomplete uploads if we're in the idle state
    if (uploadState === UPLOAD_STATES.IDLE) {
      const incompleteUpload = findIncompleteUploads();
      
      if (incompleteUpload) {
        console.log('Found incomplete upload:', incompleteUpload);
        
        // Display a confirmation dialog to the user
        const shouldResume = window.confirm(
          `You have an unfinished upload with ${incompleteUpload.files.length} files. ` +
          `${incompleteUpload.uploaded} of them have been uploaded. ` +
          'Would you like to resume this upload?'
        );
        
        if (shouldResume) {
          // Restore form data from the saved state
          setFormData({
            files: null, // We'll need to handle this specially
            ...incompleteUpload.formData
          });
          
          // Set job details
          setJobDetails({
            jobId: incompleteUpload.jobId,
            azCopyCommand: `azcopy copy "<local_folder_path>/*" "https://storage.blob.core.windows.net/test-centralised-upload/${incompleteUpload.jobId}?sv=..." --recursive=true`
          });
          
          // Set progress state
          setUploadProgress({
            total: incompleteUpload.files.length,
            uploaded: incompleteUpload.uploaded,
            current: null,
            percentage: Math.round((incompleteUpload.uploaded / incompleteUpload.files.length) * 100)
          });
          
          // Show a message to the user
          setErrors({
            ...errors,
            api: `Please select the same directory of files and click "Resume Upload" to continue.`
          });
        } else {
          // User declined to resume, remove the incomplete upload
          removeUploadState(incompleteUpload.jobId);
        }
      }
    }
  }, [uploadState]); // eslint-disable-line react-hooks/exhaustive-deps
  
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
      
      {/* Job Details and Upload Progress */}
      {jobDetails && (
        <div className="job-details">
          <h3>Job Details</h3>
          <p><strong>Job ID:</strong> {jobDetails.jobId}</p>
          <p><strong>Status:</strong> Ready for upload</p>
          
          {/* Upload Progress Bar */}
          {uploadState === UPLOAD_STATES.UPLOADING && (
            <div className="upload-progress">
              <div className="progress-label">
                Uploading: {uploadProgress.uploaded} of {uploadProgress.total} files ({uploadProgress.percentage}%)
                {uploadProgress.current && ` - Current: ${uploadProgress.current}`}
              </div>
              <div className="progress-bar-container">
                <div 
                  className="progress-bar" 
                  style={{width: `${uploadProgress.percentage}%`}}
                ></div>
              </div>
            </div>
          )}
          
          {/* Upload Options */}
          {uploadState === UPLOAD_STATES.IDLE || uploadState === UPLOAD_STATES.CREATING_JOB ? (
            <div className="upload-options">
              <h4>Choose Upload Method</h4>
              
              <div className="option-container">
                {/* Browser Upload Option */}
                <div className="upload-option">
                  <h5>Option 1: Browser Upload</h5>
                  <p>Best for smaller uploads (up to a few GB total).</p>
                  
                  <div className="upload-actions">
                    <button
                      type="button"
                      className="upload-button"
                      onClick={handleStartUpload}
                      disabled={uploadState === UPLOAD_STATES.CREATING_JOB}
                    >
                      {uploadProgress.uploaded > 0 ? 'Resume Upload' : 'Start Browser Upload'}
                    </button>
                  </div>
                </div>
                
                {/* AzCopy Option */}
                <div className="upload-option">
                  <h5>Option 2: AzCopy Command (for large uploads)</h5>
                  <p>Recommended for very large datasets. Copy this command and run it in your terminal:</p>
                  
                  <div className="azcopy-command">
                    <pre>{jobDetails.azCopyCommand}</pre>
                    <button 
                      type="button" 
                      className="copy-button"
                      onClick={() => {
                        navigator.clipboard.writeText(jobDetails.azCopyCommand);
                        alert('AzCopy command copied to clipboard!');
                      }}
                    >
                      Copy to Clipboard
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="upload-actions bottom-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={resetForm}
                >
                  Cancel Job
                </button>
              </div>
            </div>
          ) : null}
          
          {/* Upload Status Message */}
          {uploadState === UPLOAD_STATES.COMPLETING && (
            <div className="upload-status">
              <p>Finalizing upload...</p>
            </div>
          )}
          
          {uploadState === UPLOAD_STATES.COMPLETE && (
            <div className="upload-status">
              <p>Upload completed successfully!</p>
            </div>
          )}
          
          {uploadState === UPLOAD_STATES.ERROR && (
            <div className="upload-status error">
              <p>Upload encountered an error. Please try again.</p>
            </div>
          )}
        </div>
      )}
      
      {/* Form - Only show if not uploading */}
      {(uploadState === UPLOAD_STATES.IDLE) && (
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
            {isSubmitting ? 'Creating Job...' : 'Create Job'}
          </button>
        </div>
      </form>
      )}
    </div>
  );
};

export default JobForm;
