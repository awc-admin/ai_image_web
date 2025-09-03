import React, { useState, useEffect } from 'react';
import { getUserId } from '../utils/mockAuth';
import './JobStatusPage.css';

// Flask server URL for job operations
const FLASK_SERVER_URL = 'http://20.11.8.84:5000';

/**
 * Job Status Page Component
 * This component displays a table of all jobs created by the current user
 */
const JobStatusPage = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [jobsPerPage] = useState(5);
  const [actionMessage, setActionMessage] = useState('');
  const [processingJobId, setProcessingJobId] = useState(null);
  
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
        setJobs(data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch jobs:', err);
        setError('Failed to load jobs. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchJobs();
  }, []);
  
  // Helper function to render the status badge with appropriate color
  const renderStatusBadge = (status) => {
    let className;
    switch (status) {
      case 'created':
        className = 'status-badge created';
        break;
      case 'submitting_job':
        className = 'status-badge submitting';
        break;
      case 'running':
        className = 'status-badge running';
        break;
      case 'completed':
        className = 'status-badge completed';
        break;
      case 'failed':
      case 'problem':
        className = 'status-badge error';
        break;
      case 'canceled':
        className = 'status-badge canceled';
        break;
      default:
        className = 'status-badge';
    }
    
    return <span className={className}>{status}</span>;
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
  
  // Get current jobs for pagination
  const indexOfLastJob = currentPage * jobsPerPage;
  const indexOfFirstJob = indexOfLastJob - jobsPerPage;
  const currentJobs = jobs.slice(indexOfFirstJob, indexOfLastJob);
  
  // Calculate page numbers
  const totalPages = Math.ceil(jobs.length / jobsPerPage);
  
  // Change page
  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  const nextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const prevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
  
  // Function to handle updating job status
  const handleUpdateStatus = async (jobId) => {
    try {
      setProcessingJobId(jobId);
      setActionMessage('');
      
      // Send GET request to update status
      const response = await fetch(`${FLASK_SERVER_URL}/task/${jobId}`);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      setActionMessage('Update request sent. Please reload the page for the latest status.');
    } catch (err) {
      console.error('Failed to update job status:', err);
      setActionMessage(`Error: ${err.message}. Please try again.`);
    } finally {
      setTimeout(() => setProcessingJobId(null), 1000);
    }
  };
  
  // Function to handle cancelling a job
  const handleCancelJob = async (jobId) => {
    try {
      setProcessingJobId(jobId);
      setActionMessage('');
      
      // Create the request body
      const requestBody = {
        caller: "awc",
        request_id: jobId,
        api_instance_name: "web"
      };
      
      // Send POST request to cancel the job
      const response = await fetch(`${FLASK_SERVER_URL}/cancel_request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      setActionMessage('Cancel request sent. Please reload the page for the latest status.');
    } catch (err) {
      console.error('Failed to cancel job:', err);
      setActionMessage(`Error: ${err.message}. Please try again.`);
    } finally {
      setTimeout(() => setProcessingJobId(null), 1000);
    }
  };

  return (
    <div className="job-status-container">
      <h2>Job Status</h2>
      
      {loading && (
        <div className="loading-message">Loading job data...</div>
      )}
      
      {error && (
        <div className="error-message">{error}</div>
      )}
      
      {!loading && !error && jobs.length === 0 && (
        <div className="no-jobs-message">
          No jobs found. Create a new job to see it here.
        </div>
      )}
      
      {/* Display action feedback message */}
      {actionMessage && (
        <div className="action-message">
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
                  <th className="col-submission">Job Submission Time</th>
                  <th className="col-updated">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {currentJobs.map(job => (
                  <tr key={job.id}>
                    <td className="actions-cell col-actions">
                      {/* Update Status button - show for running or problem status */}
                      {(job.request_status === 'running' || job.request_status === 'problem') && (
                        <button 
                          className="action-button update-button"
                          onClick={() => handleUpdateStatus(job.id)}
                          disabled={processingJobId === job.id}
                        >
                          {processingJobId === job.id ? 'Updating...' : 'Update Status'}
                        </button>
                      )}
                      
                      {/* Cancel Job button - show for non-completed status */}
                      {job.request_status !== 'completed' && (
                        <button 
                          className="action-button cancel-button"
                          onClick={() => handleCancelJob(job.id)}
                          disabled={processingJobId === job.id}
                        >
                          {processingJobId === job.id ? 'Cancelling...' : 'Cancel Job'}
                        </button>
                      )}
                    </td>
                    <td className="job-id col-job-id">{job.id}</td>
                    <td className="col-status">{renderStatusBadge(job.request_status)}</td>
                    <td className="message-cell col-message">{renderMessage(job.message)}</td>
                    <td className="col-folder">{job.folder_name || '-'}</td>
                    <td className="numeric col-images">{job.num_images}</td>
                    <td className="col-submission">{job.job_submission_time}</td>
                    <td className="col-updated">{job.last_updated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
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
          onClick={() => window.history.back()}
        >
          Back to Job Creation
        </button>
      </div>
    </div>
  );
};

export default JobStatusPage;
