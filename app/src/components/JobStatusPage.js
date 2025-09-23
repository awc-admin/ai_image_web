import React, { useState, useEffect } from 'react';
import { getUserId } from '../utils/mockAuth';
import { useNavigate } from 'react-router-dom';
import './JobStatusPage.css';

/**
 * Job Status Page Component
 * This component displays a table of all jobs created by the current user
 */
const JobStatusPage = () => {
  // State management with meaningful variable names
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [jobsPerPage] = useState(5);
  const [actionMessage, setActionMessage] = useState('');
  const [actionMessageType, setActionMessageType] = useState('info'); // 'info', 'success', or 'error'
  const [processingJobId, setProcessingJobId] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const navigate = useNavigate();
  
  // Effect to fetch jobs data from the API
  useEffect(() => {
    const fetchJobs = async () => {
      try {
        setLoading(true);
        
        // Get the current user ID
        const userId = await getUserId();
        
        // Fetch jobs from the API
        const response = await fetch(`/api/get-jobs-by-user?userId=${encodeURIComponent(userId)}`);
        
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log("Jobs data from API:", data);
        setJobs(data);
        setError(null);
      } catch (err) {
        console.error("Error fetching jobs:", err);
        setError('Failed to load jobs. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchJobs();
  }, [refreshTrigger]);
  
  // Helper function to render the status badge with appropriate color
  const renderStatusBadge = (status) => {
    const statusClasses = {
      'created': 'status-badge created',
      'submitting_job': 'status-badge submitting',
      'running': 'status-badge running',
      'completed': 'status-badge completed',
      'failed': 'status-badge error',
      'problem': 'status-badge error',
      'canceled': 'status-badge canceled'
    };
    
    return <span className={statusClasses[status] || 'status-badge'}>{status}</span>;
  };

  // Helper function to render message content
  const renderMessage = (message) => {
    if (!message) return '-';
    
    if (typeof message === 'object') {
      // For message objects with URL links
      if (message.text && message.url) {
        return (
          <a href={message.url} target="_blank" rel="noopener noreferrer" className="message-link">
            {message.text}
          </a>
        );
      }
      return JSON.stringify(message);
    }
    
    // Check if message is a URL-like string
    if (typeof message === 'string' && (message.startsWith('http://') || message.startsWith('https://'))) {
      return (
        <a href={message} target="_blank" rel="noopener noreferrer" className="message-link">
          View Link
        </a>
      );
    }
    
    return message;
  };
  
  // Helper function to get the number of images based on the priority logic
  const getNumberOfImages = (job) => {
    // First try to get from status.num_images
    if (job.status && job.status.num_images !== undefined) {
      return job.status.num_images;
    }
    
    // Then try to get from call_params.num_images
    if (job.call_params && job.call_params.num_images !== undefined) {
      return job.call_params.num_images;
    }
    
    // Finally, fall back to the job.num_images (if it exists)
    return job.num_images || '-';
  };
  
  // Helper function to render the parameters
  const renderParameters = (job) => {
    // Debug to see what we're getting from the API
    console.log("Job parameters data:", job);
    
    // Check if call_params exists and has required fields
    if (!job.call_params) {
      console.log("No call_params found for job:", job.id);
      return '-';
    }
    
    const params = job.call_params;
    
    return (
      <div className="parameters-container">
        <div><strong>model_version:</strong> {params.model_version || '-'}</div>
        <div><strong>classify:</strong> {params.classify !== undefined ? String(params.classify) : '-'}</div>
        <div><strong>hitax_type:</strong> {params.hitax_type || '-'}</div>
        <div><strong>do_smoothing:</strong> {params.do_smoothing !== undefined ? String(params.do_smoothing) : '-'}</div>
      </div>
    );
  };
  
  // Pagination logic
  const indexOfLastJob = currentPage * jobsPerPage;
  const indexOfFirstJob = indexOfLastJob - jobsPerPage;
  const currentJobs = jobs.slice(indexOfFirstJob, indexOfLastJob);
  const totalPages = Math.ceil(jobs.length / jobsPerPage);
  
  // Pagination controls
  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  const nextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const prevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
  
  // Function for refreshing the job list
  const refreshJobList = () => {
    setRefreshTrigger(prev => prev + 1);
  };
  
  // Function to handle updating job status
  const handleUpdateStatus = async (jobId) => {
    try {
      setProcessingJobId(jobId);
      setActionMessage('');
      
      // Use the proxy endpoint to call the Flask server
      const response = await fetch(`/api-proxy/task/${jobId}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      // Set success message
      setActionMessage('Status updated successfully.');
      setActionMessageType('success');
      
      // Refresh the job list
      setTimeout(() => {
        setRefreshTrigger(prev => prev + 1);
      }, 1000);
    } catch (err) {
      // Show a more user-friendly error message
      if (err.message.includes('Failed to fetch')) {
        setActionMessage('Error connecting to the server. Please try again later.');
      } else {
        setActionMessage(`Error: ${err.message}. Please try again.`);
      }
      setActionMessageType('error');
    } finally {
      setTimeout(() => setProcessingJobId(null), 1000);
    }
  };
  
  // Function to handle cancelling a job
  const handleCancelJob = async (jobId) => {
    try {
      setProcessingJobId(jobId);
      setActionMessage('');
      setActionMessageType('info');
      
      // Create the request body for the Flask server
      const requestBody = {
        caller: "awc",
        request_id: jobId,
        api_instance_name: "web"
      };
      
      // Send the cancel request
      const response = await fetch(`/api-proxy/cancel_request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      // If the response is not OK, try to extract error details
      if (!response.ok) {
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
      
      // Set success message
      setActionMessage('Job cancelled successfully.');
      setActionMessageType('success');
      
      // Refresh the job list
      setTimeout(() => {
        setRefreshTrigger(prev => prev + 1);
      }, 1000);
    } catch (err) {
      // Show a more user-friendly error message
      if (err.message.includes('Failed to fetch')) {
        setActionMessage('Error connecting to the server. Please try again later.');
      } else {
        setActionMessage(`Error: ${err.message}. Please try again.`);
      }
      setActionMessageType('error');
    } finally {
      setTimeout(() => setProcessingJobId(null), 1000);
    }
  };
  
  // Function to handle modifying job parameters
  const handleModifyJob = (job) => {
    // Create a log to see if the function is being called
    console.log('Modify job clicked for job ID:', job.id);
    
    try {
      // Store the job details in session storage to access in the modify form
      const jobData = {
        jobId: job.id,
        folderName: job.folder_name || '',
        imagePath: job.image_path_prefix || `${job.id}/${job.folder_name || ''}`,
        numImages: job.num_images || 0
      };
      
      console.log('Storing job details in session storage:', jobData);
      sessionStorage.setItem('modifyJobDetails', JSON.stringify(jobData));
      
      // Navigate to the modify job form
      navigate('/modify-job');
    } catch (error) {
      console.error('Error in handleModifyJob:', error);
      setActionMessage('Error preparing job modification. Please try again.');
      setActionMessageType('error');
    }
  };

  return (
    <div className="job-status-container">
      <h2>Job Status</h2>
      
      <div className="controls">
        <button 
          className="refresh-button"
          onClick={refreshJobList}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Refresh Jobs'}
        </button>
      </div>
      
      {loading && <div className="loading-message">Loading job data...</div>}
      
      {error && <div className="error-message">{error}</div>}
      
      {!loading && !error && jobs.length === 0 && (
        <div className="no-jobs-message">
          No jobs found. Create a new job to see it here.
        </div>
      )}
      
      {actionMessage && (
        <div className={`action-message ${actionMessageType}`}>
          {actionMessage}
        </div>
      )}

      {!loading && !error && jobs.length > 0 && (
        <>
          <div className="table-container">
            <table className="jobs-table">
              <thead>
                <tr>
                  <th className="col-actions">Actions</th>
                  <th className="col-job-id">Job ID</th>
                  <th className="col-status">Status</th>
                  <th className="col-message">Message</th>
                  <th className="col-folder">Folder Name</th>
                  <th className="col-images">Number of Images</th>
                  <th className="col-parameters">Parameters</th>
                  <th className="col-submission">Job Submission Time</th>
                  <th className="col-updated">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {currentJobs.map(job => (
                  <tr key={job.id}>
                    <td className="actions-cell col-actions">
                      <div className="actions-button-container">
                        {(job.request_status === 'running' || job.request_status === 'problem') && (
                          <button 
                            className="action-button update-button"
                            onClick={() => handleUpdateStatus(job.id)}
                            disabled={processingJobId === job.id}
                            title="Update the status of this job"
                          >
                            {processingJobId === job.id ? 'Updating...' : 'Update Status'}
                          </button>
                        )}
                        
                        {job.request_status !== 'completed' && job.request_status !== 'canceled' && (
                          <button 
                            className="action-button cancel-button"
                            onClick={() => handleCancelJob(job.id)}
                            disabled={processingJobId === job.id}
                            title="Cancel this job"
                          >
                            {processingJobId === job.id ? 'Cancelling...' : 'Cancel Job'}
                          </button>
                        )}
                        
                        {/* Modify button - appears for all jobs */}
                        <button 
                          className="action-button modify-button"
                          onClick={(e) => {
                            e.preventDefault();  // Prevent default button behavior
                            e.stopPropagation(); // Stop event propagation
                            handleModifyJob(job);
                          }}
                          disabled={processingJobId === job.id}
                          title="Modify job parameters"
                        >
                          Modify
                        </button>
                        
                        {(job.request_status !== 'running' && job.request_status !== 'problem' && 
                          (job.request_status === 'completed' || job.request_status === 'canceled')) && (
                          <div className="button-spacer"></div>
                        )}
                      </div>
                    </td>
                    <td className="job-id col-job-id">{job.id}</td>
                    <td className="col-status">{renderStatusBadge(job.request_status)}</td>
                    <td className="message-cell col-message">{renderMessage(job.message)}</td>
                    <td className="col-folder">{job.folder_name || '-'}</td>
                    <td className="numeric col-images">{getNumberOfImages(job)}</td>
                    <td className="col-parameters">{renderParameters(job)}</td>
                    <td className="col-submission">{job.job_submission_time}</td>
                    <td className="col-updated">{job.last_updated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {totalPages > 1 && (
            <div className="pagination">
              <button 
                className="pagination-button" 
                onClick={prevPage} 
                disabled={currentPage === 1}
              >
                &laquo; Previous
              </button>
              
              <div className="page-numbers">
                {Array.from({ length: totalPages }).map((_, index) => (
                  <button
                    key={index}
                    onClick={() => paginate(index + 1)}
                    className={`page-number ${currentPage === index + 1 ? 'active' : ''}`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
              
              <button 
                className="pagination-button" 
                onClick={nextPage} 
                disabled={currentPage === totalPages}
              >
                Next &raquo;
              </button>
            </div>
          )}
          
          <div className="pagination-info">
            Showing {indexOfFirstJob + 1}-{Math.min(indexOfLastJob, jobs.length)} of {jobs.length} jobs
          </div>
        </>
      )}
      
      <div className="actions">
        <button
          className="back-button"
          onClick={() => navigate('/')}
        >
          Back to Job Creation
        </button>
      </div>
    </div>
  );
};

export default JobStatusPage;
