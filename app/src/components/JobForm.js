import React, { useState, useEffect } from 'react';
import './JobForm.css';
import { getUserEmail, getUserId } from '../utils/mockAuth';

// Access environment variables 
const STORAGE_CONTAINER_UPLOAD = process.env.REACT_APP_STORAGE_CONTAINER_UPLOAD || 'test-centralised-upload';
const STORAGE_ACCOUNT_NAME = process.env.REACT_APP_STORAGE_ACCOUNT_NAME || 'imageclassifydatastore';

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
  // Create a reference to store files for upload
  const fileInputRef = React.useRef(null);
  
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
  
  // State for API message type (success or error)
  const [apiMessageType, setApiMessageType] = useState('error');
  
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
  
  // State for tracking if the job has been submitted to AI processing
  const [jobSubmitted, setJobSubmitted] = useState(false);
  
  // State for UI controls
  const [isAzCopyPanelOpen, setIsAzCopyPanelOpen] = useState(false);
  const [autoSubmitAfterUpload, setAutoSubmitAfterUpload] = useState(false);
  
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
  
  // Helper to check if a file is an image
  const isImageFile = (file) => {
    // List of common image file extensions
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp', '.svg'];
    const fileName = file.name.toLowerCase();
    return imageExtensions.some(ext => fileName.endsWith(ext));
  };

  // Validate form before submission
  const validateForm = () => {
    let isValid = true;
    const newErrors = { files: '', email: '' };
    
    // Get only image files from the selection
    const allFiles = Array.from(formData.files || []);
    const imageFiles = allFiles.filter(file => isImageFile(file));
    const nonImageFiles = allFiles.filter(file => !isImageFile(file));
    
    // Validate that we have at least one image file
    if (!formData.files || formData.files.length === 0 || imageFiles.length === 0) {
      newErrors.files = 'You must select at least one image file';
      isValid = false;
    } else if (nonImageFiles.length > 0) {
      // Just show a warning about non-image files but don't prevent submission
      newErrors.files = `Note: ${nonImageFiles.length} non-image files will be ignored.`;
      // This is just a warning, not an error, so we don't set isValid to false
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
      path: file.webkitRelativePath || '', // This captures the relative path including subfolders
      relativePath: file.webkitRelativePath ? file.webkitRelativePath.substring(0, file.webkitRelativePath.lastIndexOf('/') + 1) : '',
      status: 'pending' // Initial status for all files
    }));
    
    // Extract the top-level folder name from the webkitRelativePath
    let imagePath = '';
    if (files && files.length > 0) {
      // Get the first file's path
      const firstFile = files[0];
      if (firstFile.webkitRelativePath) {
        // Extract the top-level folder name (first part of the path)
        const pathParts = firstFile.webkitRelativePath.split('/');
        if (pathParts.length > 0) {
          imagePath = pathParts[0];
        }
      }
    }
    
    // Create upload state object with renamed parameters to match API
    const uploadState = {
      jobId,
      status,
      timestamp: Date.now(),
      files,
      formData: {
        email: formData.email,
        model_version: formData.detectionModel,
        classify: formData.classify,
        hitax_type: formData.hierarchicalClassificationType,
        do_smoothing: formData.performSmoothing,
        // Add the additional fields
        image_path_prefix: imagePath,
        request_name: '',  // Will be updated later when we have the actual user ID
        input_container_sas: '',  // Will be updated later when we have the SAS URL
        api_instance_name: 'web'  // Set the api_instance_name field
      },
      uploaded: 0,
      num_images: files.filter(file => {
        // Check if it's an image file by extension
        const fileName = file.name.toLowerCase();
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp', '.svg'];
        return imageExtensions.some(ext => fileName.endsWith(ext));
      }).length
    };
    
    // Save to localStorage with job ID as key
    localStorage.setItem(UPLOAD_STATE_KEY_PREFIX + jobId, JSON.stringify(uploadState));
    return uploadState;
  };
  
  const getUploadState = (jobId) => {
    const stateJson = localStorage.getItem(UPLOAD_STATE_KEY_PREFIX + jobId);
    return stateJson ? JSON.parse(stateJson) : null;
  };
  
  const updateFileStatus = (jobId, fileName, newStatus, filePath = '') => {
    const state = getUploadState(jobId);
    if (!state) return;
    
    // Find and update the file status - handle both simple filenames and path-based lookups
    const updatedFiles = state.files.map(file => {
      // Match either by name alone or by full path if available
      if (file.name === fileName || 
         (filePath && file.path === filePath) || 
         (file.path && file.path.endsWith('/' + fileName))) {
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
  const uploadFileViaAPI = async (file, jobId, relativePath = '', retries = 3) => {
    try {
      // Skip files that are too large (>100MB) to avoid timeouts
      const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
      if (file.size > MAX_FILE_SIZE) {
        console.warn(`File ${file.name} is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Skipping.`);
        return false;
      }

      // Read the file as a base64 string
      const fileContent = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
      });
      
      // Get the relative path from the file or from the parameter
      const filePath = file.webkitRelativePath || 
                       (relativePath ? relativePath + file.name : file.name);
      
      // Prepare the payload
      const payload = {
        jobId,
        fileName: file.name,
        filePath: filePath, // Send the full path including subfolders
        fileContent: fileContent,
        contentType: file.type
      };
      
      // Upload via API with retry logic
      let lastError = null;
      for (let attempt = 0; attempt < retries + 1; attempt++) {
        try {
          // If this is a retry, wait before trying again with exponential backoff
          if (attempt > 0) {
            const backoffTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10 seconds
            console.log(`Retrying upload for ${file.name} (attempt ${attempt}/${retries}) after ${backoffTime}ms`);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
          }
          
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
          
          // If we get here, the upload succeeded
          return true;
        } catch (error) {
          lastError = error;
          console.warn(`Upload attempt ${attempt + 1}/${retries + 1} failed for ${file.name}:`, error);
          
          // If this is a connection error, continue to retry
          // Otherwise (like a 400 Bad Request), stop retrying
          const isConnectionError = error.message.includes('fetch') || 
                                    error.message.includes('network') ||
                                    error.message.includes('connection');
          if (!isConnectionError) {
            console.error(`Non-connection error, stopping retry attempts:`, error);
            break;
          }
          
          // If we've reached the max retries, give up
          if (attempt >= retries) {
            console.error(`Max retries (${retries}) reached for ${file.name}`);
          }
        }
      }
      
      // If we get here, all retry attempts failed
      console.error(`Upload failed after ${retries} retries for ${file.name}:`, lastError);
      return false;
    } catch (error) {
      console.error(`Error preparing upload for ${file.name}:`, error);
      return false;
    }
  };
  
  // Function to upload a batch of files in parallel
  const uploadFileBatch = async (jobId, files, batchSize = 3) => {
    // Create a copy of the files array to avoid mutation
    const pendingBatch = [...files];
    
    // Track successful uploads in this batch
    let successCount = 0;
    
    // Process files in parallel
    const uploadPromises = [];
    
    // Take up to batchSize files from the pending batch
    for (let i = 0; i < Math.min(batchSize, pendingBatch.length); i++) {
      const file = pendingBatch[i];
      
      // Get the relative path from the file's webkitRelativePath property
      const relativePath = file.webkitRelativePath ? 
                           file.webkitRelativePath.substring(0, file.webkitRelativePath.lastIndexOf('/') + 1) : '';
      
      // Create a local successCount reference for this closure to avoid the ESLint warning
      const incrementSuccessCount = () => {
        successCount++;
      };
      
      // Create a promise for this file upload
      const uploadPromise = (async () => {
        try {
          // Upload the file with its relative path
          const success = await uploadFileViaAPI(file, jobId, relativePath);
          
          if (success) {
            // Update file status in localStorage
            const newUploadedCount = updateFileStatus(jobId, file.name, 'complete', file.webkitRelativePath);
            
            // Increment success count for this batch
            incrementSuccessCount();
            
            // Update progress UI
            setUploadProgress(prev => ({
              ...prev,
              uploaded: newUploadedCount,
              percentage: Math.round((newUploadedCount / prev.total) * 100)
            }));
            
            return true;
          }
          return false;
        } catch (error) {
          console.error(`Error uploading file ${file.name}:`, error);
          return false;
        }
      })();
      
      uploadPromises.push(uploadPromise);
    }
    
    // Wait for all uploads in this batch to complete
    const results = await Promise.all(uploadPromises);
    
    // Check if any uploads failed
    const allSuccessful = results.every(result => result === true);
    
    return {
      successCount,
      allSuccessful
    };
  };

  // Function to upload all files in a resilient manner with parallel processing
  const uploadFiles = async (jobId, files) => {
    // Get the current upload state from localStorage
    const state = getUploadState(jobId);
    if (!state) {
      setErrors({...errors, api: 'Upload state not found'});
      setUploadState(UPLOAD_STATES.ERROR);
      return;
    }
    
    // If files is null or empty but we have a state, we need to prompt the user
    if (!files || files.length === 0) {
      setErrors({...errors, api: 'Please reselect your files. Browser security restrictions have caused the file references to be lost.'});
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
      .filter(Boolean) // Remove any undefined values
      .filter(file => isImageFile(file)); // Only include image files
      
    // If no pending files were found, it might be because the file objects don't match by name
    // In that case, we'll use all files from the provided FileList
    if (pendingFiles.length === 0 && files.length > 0) {
      console.log('No matching files found by name. Using all files from input.');
      
      // Update the state with new file info
      saveUploadState(jobId, files);
      
      // Use all files from the input
      pendingFiles.push(...Array.from(files).filter(file => isImageFile(file)));
    }
    
    // If we still have no files to upload, something is wrong
    if (pendingFiles.length === 0) {
      setErrors({...errors, api: 'No files to upload. Please try selecting your files again.'});
      return;
    }
    
    // Set initial progress state
    setUploadProgress({
      total: state.files.length,
      uploaded: state.uploaded,
      current: pendingFiles.length > 0 ? 'Multiple files' : null,
      percentage: Math.round((state.uploaded / state.files.length) * 100)
    });
    
    // Set upload state to uploading
    setUploadState(UPLOAD_STATES.UPLOADING);
    
    // Define the batch size based on VM resources (B2s: 2 cores, 4GB RAM)
    // For normal uploads, 5 concurrent uploads for speed
    // For large file sets (>100), reduce to 3 to avoid overwhelming the server
    const MAX_CONCURRENT_UPLOADS = 5;
    const totalFiles = pendingFiles.length;
    const CONCURRENT_UPLOADS = totalFiles > 100 ? 3 : MAX_CONCURRENT_UPLOADS;
    
    // Process files in batches
    let fileIndex = 0;
    let failureCount = 0;
    const maxFailures = Math.max(5, Math.ceil(pendingFiles.length * 0.05)); // 5% failure tolerance
    
    while (fileIndex < pendingFiles.length) {
      // Get the next batch of files
      const batch = pendingFiles.slice(fileIndex, fileIndex + CONCURRENT_UPLOADS);
      
      // Update the current file name in the UI
      setUploadProgress(prev => ({
        ...prev,
        current: batch.length > 1 ? `${batch.length} files in parallel` : batch[0].name
      }));
      
      // Upload this batch
      const { allSuccessful, successCount } = await uploadFileBatch(jobId, batch, CONCURRENT_UPLOADS);
      
      // If any upload in the batch failed, increment failure count
      if (!allSuccessful) {
        failureCount += (batch.length - successCount);
        
        // If too many failures, stop the upload
        if (failureCount > maxFailures) {
          setErrors({...errors, api: `Upload stopped after ${failureCount} failed files. You can resume the upload later.`});
          return;
        }
      }
      
      // Move to the next batch
      fileIndex += CONCURRENT_UPLOADS;
    }
    
    // All files uploaded, update state to completing
    setUploadState(UPLOAD_STATES.COMPLETING);
    
    // Upload completed successfully
    setUploadState(UPLOAD_STATES.COMPLETE);
    // Ensure jobSubmitted is false after upload completion to show the "Submit this job" button
    setJobSubmitted(false);
    // Don't set submitSuccess to true here, as this is just the upload completion
    // setSubmitSuccess will only be set to true after the job is submitted to the AI server
    
    // Auto-submit job if the checkbox was checked
    if (autoSubmitAfterUpload && jobDetails && jobDetails.jobId) {
      // Small delay to ensure UI updates first
      setTimeout(() => {
        handleSubmitJob();
      }, 500);
    }
    
    // We keep the upload state in localStorage until the user submits the job to AI processing
    // or decides to go back to the form
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
    
    // Store files in the ref for persistence
    if (fileInputRef.current) {
      // Unfortunately, we can't directly assign to fileInputRef.current.files
      // in modern browsers due to security restrictions, but having the ref
      // is still valuable for our hidden input 
    }
    
    // Filter out non-image files
    const allFiles = Array.from(e.target.files || []);
    const imageFiles = allFiles.filter(file => isImageFile(file));
    
    // If there were non-image files, show an informational message
    if (imageFiles.length < allFiles.length) {
      const nonImageCount = allFiles.length - imageFiles.length;
      setErrors({
        ...errors,
        files: `Note: ${nonImageCount} non-image files will be ignored.`
      });
    }
    
    // Update state with the selected files (all files for now, we'll filter during upload)
    setFormData({
      ...formData,
      files: e.target.files
    });
    
    // Log info about selected files for debugging
    if (e.target.files && e.target.files.length > 0) {
      console.log(`Selected ${e.target.files.length} files (${imageFiles.length} image files)`);
    }
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
    
    // Reset API message type to default (error)
    setApiMessageType('error');
    
    // Reset job states
    setJobSubmitted(false);
    setSubmitSuccess(false);
    
    // Reset UI controls
    setIsAzCopyPanelOpen(false);
    setAutoSubmitAfterUpload(false);
    
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
    
    // Clear file reference in our ref too
    if (fileInputRef.current) {
      // We can't directly modify fileInputRef.current.files in modern browsers
      // but we've set the form state to null which should be sufficient
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
    
    // Make sure we have at least one image file
    const imageFiles = Array.from(formData.files || []).filter(file => isImageFile(file));
    if (imageFiles.length === 0) {
      setErrors({
        ...errors,
        files: 'You must select at least one image file'
      });
      return;
    }
    
    // Set loading state
    setIsSubmitting(true);
    setUploadState(UPLOAD_STATES.CREATING_JOB);
    
    try {
      // If no email is provided, try to get it from the user's AD profile
      let userEmail = formData.email;
      
      if (!userEmail || userEmail.trim() === '') {
        // Try to get the user email from AD
        userEmail = await getUserEmail();
        console.log('Using email from Azure AD:', userEmail);
      }
      
      // Count only image files
      const imageFiles = Array.from(formData.files || []).filter(file => isImageFile(file));
      const imageCount = imageFiles.length;
      
      // Extract the top-level folder name from the webkitRelativePath
      let imagePath = '';
      if (formData.files && formData.files.length > 0) {
        // Get the first file's path
        const firstFile = formData.files[0];
        if (firstFile.webkitRelativePath) {
          // Extract the top-level folder name (first part of the path)
          const pathParts = firstFile.webkitRelativePath.split('/');
          if (pathParts.length > 0) {
            imagePath = pathParts[0];
          }
        }
      }
      
      // Get the user ID from AD (for request_name)
      const userId = await getUserId();
      
      // Prepare form data for API with renamed parameters
      const apiData = {
        email: userEmail,
        model_version: formData.detectionModel,          
        classify: formData.classify,
        hitax_type: formData.hierarchicalClassificationType,
        do_smoothing: formData.performSmoothing,
        num_images: imageCount,
        // Add the additional fields
        image_path_prefix: imagePath,
        request_name: userId,  // Use the userId from Azure AD
        api_instance_name: 'web'  // Add the api_instance_name field
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
        
        // Extract SAS URL and AzCopy command from response headers
        const sasTokenUrl = response.headers.get('X-SAS-Token-URL');
        const azCopyCommand = response.headers.get('X-AzCopy-Command');
        
        // Make a copy of the current files to preserve them
        const currentFiles = formData.files;
        
        // Also store in our ref for persistence
        if (fileInputRef.current && currentFiles) {
          // We can't directly assign FileList objects in modern browsers
          // But we've already saved the file metadata in localStorage via saveUploadState
          // This ensures files are available in the component state
        }
        
        // Create enhanced result with user email, SAS URL and AzCopy command
        const enhancedResult = {
          ...result,
          userEmail: userEmail || await getUserEmail(), // Make sure we have the email
          sasTokenUrl,
          azCopyCommand
        };
        
        // Store job details
        setJobDetails(enhancedResult);
        
        // Save the upload state to localStorage with updated SAS URL and user ID
        const savedState = saveUploadState(result.jobId, currentFiles);
        
        // Update the saved state with the SAS URL and userId
        if (savedState) {
          const updatedState = {
            ...savedState,
            formData: {
              ...savedState.formData,
              input_container_sas: sasTokenUrl || 
                `https://${STORAGE_ACCOUNT_NAME}.blob.core.windows.net/${STORAGE_CONTAINER_UPLOAD}/${result.jobId}`,
              request_name: userId,
              api_instance_name: 'web'
            }
          };
          localStorage.setItem(UPLOAD_STATE_KEY_PREFIX + result.jobId, JSON.stringify(updatedState));
        }
        
        // Reset the isSubmitting state
        setIsSubmitting(false);
        
        // Create a new FormData object that preserves the selected files
        setFormData(prevData => ({
          ...prevData,
          // Keep the same files reference
          files: currentFiles
        }));
        
        // Show a success message with success styling
        setApiMessageType('success');
        setErrors({
          ...errors,
          api: 'Job created successfully! You can now choose to upload directly in the browser or use AzCopy for larger uploads.'
        });
        
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
        
        setApiMessageType('error');
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
      setApiMessageType('error');
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
    
    // Reset the submitSuccess and jobSubmitted flags when starting a new upload
    // This ensures proper messaging during the upload process
    setSubmitSuccess(false);
    setJobSubmitted(false);
    
    // Get the upload state from localStorage
    const savedState = getUploadState(jobDetails.jobId);
    
    if (!savedState || !savedState.files || savedState.files.length === 0) {
      setErrors({...errors, api: 'Cannot find files to upload. Please try again.'});
      return;
    }
    
    // Try all possible sources for files, in order of preference
    let filesToUse = null;
    
    // 1. First check formData (component state)
    if (formData.files && formData.files.length > 0) {
      filesToUse = formData.files;
      console.log('Using files from formData state');
    } 
    // 2. Then check our ref (persistent storage)
    else if (fileInputRef.current && fileInputRef.current.files && fileInputRef.current.files.length > 0) {
      filesToUse = fileInputRef.current.files;
      console.log('Using files from fileInputRef');
    }
    // 3. Then check the visible input element
    else {
      const fileInput = document.getElementById('files');
      if (fileInput && fileInput.files && fileInput.files.length > 0) {
        filesToUse = fileInput.files;
        console.log('Using files from visible input element');
      }
    }
    
    if (!filesToUse || filesToUse.length === 0) {
      // If we have saved file metadata but can't access the actual files,
      // ask the user to reselect the files
      setErrors({...errors, api: 'Please reselect your image files. File access was lost due to browser security restrictions.'});
      
      // Focus on the file input to help the user reselect files
      const fileInput = document.getElementById('files');
      if (fileInput) {
        fileInput.click();
      }
      return;
    }
    
    // Clear any error messages as we're about to start the upload
    setErrors({...errors, api: ''});
    
    // Start the upload process with the available files
    await uploadFiles(jobDetails.jobId, filesToUse);
  };

  // Handle submitting the job to the AI server
  const handleSubmitJob = async () => {
    if (!jobDetails || !jobDetails.jobId) {
      setErrors({...errors, api: 'Missing job details'});
      return;
    }
    
    // Show loading state
    setIsSubmitting(true);
    setApiMessageType('info');
    setErrors({...errors, api: 'Submitting job to AI server...'});
    
    try {
      // Call the complete-upload endpoint
      const response = await fetch('/api/complete-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId: jobDetails.jobId })
      });
      
      // Process response
      if (response.ok) {
        const result = await response.json();
        console.log('Job submitted successfully:', result);
        
        // Update state to indicate job is submitted
        setJobSubmitted(true);
        setSubmitSuccess(true); // Now we can set submitSuccess to true as the job is fully submitted
        
        // Show success message
        setApiMessageType('success');
        setErrors({...errors, api: 'Job submitted successfully! You will be notified by email when processing is complete.'});
        
        // Update upload state
        setUploadState(UPLOAD_STATES.COMPLETE);
        
      } else {
        // Handle error response
        const errorData = await response.json();
        console.error('Error submitting job:', errorData);
        
        setApiMessageType('error');
        setErrors({...errors, api: `Error submitting job: ${errorData.error || 'Unknown error'}`});
      }
    } catch (error) {
      console.error('Network error:', error);
      setApiMessageType('error');
      setErrors({...errors, api: `Network error: ${error.message}`});
    } finally {
      setIsSubmitting(false);
    }
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
            detectionModel: incompleteUpload.formData.model_version || '1000-redwood',
            email: incompleteUpload.formData.email || '',
            classify: incompleteUpload.formData.classify || 'False',
            hierarchicalClassificationType: incompleteUpload.formData.hitax_type || 'off',
            performSmoothing: incompleteUpload.formData.do_smoothing || 'False'
          });
          
          // Set job details
          setJobDetails({
            jobId: incompleteUpload.jobId,
            azCopyCommand: `azcopy copy "<local_folder_path>/*" "https://storage.blob.core.windows.net/${STORAGE_CONTAINER_UPLOAD}/${incompleteUpload.jobId}?sv=..." --recursive=true`
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
      {/* Hidden file input for maintaining file reference */}
      <input 
        type="file" 
        ref={fileInputRef}
        style={{ display: 'none' }}
        webkitdirectory="true"
        multiple
      />
      
      <h2>Submit a New Image Processing Job</h2>
      
      {/* API Message (Error or Success) - Only show if not a success message and job not submitted yet */}
      {errors.api && !submitSuccess && apiMessageType !== 'success' && (
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
          {(uploadState === UPLOAD_STATES.IDLE || uploadState === UPLOAD_STATES.CREATING_JOB || (jobDetails && uploadState !== UPLOAD_STATES.UPLOADING && uploadState !== UPLOAD_STATES.COMPLETING && uploadState !== UPLOAD_STATES.COMPLETE && uploadState !== UPLOAD_STATES.ERROR)) ? (
            <div className="upload-options">
              <h4>Choose Upload Method</h4>
              
              <div className="option-container">
                {/* Browser Upload Option */}
                <div className="upload-option">
                  <h5>Option 1: Browser Upload</h5>
                  <p>Best for smaller uploads (up to a few GB total).</p>
                  
                  <div className="auto-submit-option">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={autoSubmitAfterUpload}
                        onChange={(e) => setAutoSubmitAfterUpload(e.target.checked)}
                      />
                      Submit job after uploading is done
                    </label>
                  </div>
                  
                  <div className="upload-actions">
                    <button
                      type="button"
                      className="upload-button"
                      onClick={handleStartUpload}
                    >
                      {uploadProgress.uploaded > 0 ? 'Resume Upload' : 'Start Browser Upload'}
                    </button>
                  </div>
                </div>
                
                {/* AzCopy Option - Collapsible */}
                <div className="upload-option">
                  <div 
                    className="collapsible-header" 
                    onClick={() => setIsAzCopyPanelOpen(!isAzCopyPanelOpen)}
                  >
                    <h5>Option 2: AzCopy Command (for large uploads)</h5>
                    <span className={`collapse-arrow ${isAzCopyPanelOpen ? 'open' : ''}`}>▼</span>
                  </div>
                  
                  {isAzCopyPanelOpen && (
                    <div className="collapsible-content">
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

                      {/* Text about making sure images are uploaded */}
                      <div className="upload-warning">
                        <p>Make sure all your images have been uploaded via the AzCopy command before clicking the 'Submit this job' button</p>
                      </div>

                      {/* Submit this job button */}
                      <div className="submit-job-action">
                        <button
                          type="button"
                          className="submit-job-button"
                          onClick={handleSubmitJob}
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? 'Submitting...' : 'Submit this job'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="upload-actions bottom-actions">
                <button
                  type="button"
                  className="go-back-button"
                  onClick={() => {
                    // Remove the upload state first to avoid resume prompt
                    if (jobDetails && jobDetails.jobId) {
                      removeUploadState(jobDetails.jobId);
                    }
                    // Then reset the form
                    resetForm();
                  }}
                >
                  Back to front page
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
          
          {uploadState === UPLOAD_STATES.COMPLETE && !jobSubmitted && (
            <div className="upload-status">
              <h4>Upload completed successfully!</h4>
              <p>Your job has been created and all files were uploaded successfully. Click "Submit this job" to start AI processing.</p>
              
              <button
                type="button"
                className="submit-job-button"
                onClick={handleSubmitJob}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit this job'}
              </button>
            </div>
          )}
          
          {uploadState === UPLOAD_STATES.COMPLETE && jobSubmitted && (
            <div className="upload-status success-status">
              <h4>Job submitted successfully!</h4>
              <p>Your job has been submitted for AI processing. The processing will begin shortly.</p>
              
              {formData.email ? (
                <p>You will receive an email at <strong>{formData.email}</strong> (provided by you) when processing is complete.</p>
              ) : (
                <p>You will receive an email at <strong>{jobDetails.userEmail || 'your AD email address'}</strong> (from your Azure AD account) when processing is complete.</p>
              )}
              <p>Job ID: <strong>{jobDetails.jobId}</strong></p>
              <button
                type="button"
                className="go-back-button"
                onClick={() => {
                  // Remove the upload state first to avoid resume prompt
                  if (jobDetails && jobDetails.jobId) {
                    removeUploadState(jobDetails.jobId);
                  }
                  setSubmitSuccess(false);
                  resetForm();
                  setUploadState(UPLOAD_STATES.IDLE);
                  setJobDetails(null);
                }}
              >
                Back to front page
              </button>
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
            accept="image/*"
          />
          <div className="form-hint">Only image files (JPG, JPEG, PNG, GIF, etc.) will be processed.</div>
          {errors.files && (
            <div className={errors.files.startsWith('Note:') ? 'info-message' : 'error-message'}>
              {errors.files}
            </div>
          )}
          {formData.files && formData.files.length > 0 && (
            <div className="file-info">
              {/* Display counts of image files vs. total files */}
              {(() => {
                const totalFiles = formData.files.length;
                const imageFiles = Array.from(formData.files).filter(file => isImageFile(file));
                const imageCount = imageFiles.length;
                
                return (
                  <div>
                    <strong>
                      {imageCount} image {imageCount === 1 ? 'file' : 'files'} selected
                      {totalFiles > imageCount && ` (${totalFiles - imageCount} non-image files will be ignored)`}
                    </strong>
                  </div>
                );
              })()}
              
              {formData.files.length > 0 && (
                <div className="file-preview">
                  {/* Show only image files in the preview */}
                  {Array.from(formData.files)
                    .filter(file => isImageFile(file))
                    .slice(0, 3)
                    .map((file, index) => (
                      <div key={index} className="file-item">
                        <span className="file-name">
                          {file.webkitRelativePath ? file.webkitRelativePath : file.name}
                        </span>
                        <span className="file-size">({Math.round(file.size / 1024)} KB)</span>
                      </div>
                    ))
                  }
                  {Array.from(formData.files).filter(file => isImageFile(file)).length > 3 && (
                    <div className="file-more">...and {Array.from(formData.files).filter(file => isImageFile(file)).length - 3} more image files</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

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
