import React, { useState, useEffect } from 'react';
import { getUserId } from '../utils/mockAuth';
import './JobStatusPage.css';

/**
 * Job Status Page Component
 * This component displays a table of all jobs created by the current user
 */
const JobStatusPage = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
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
      
      {!loading && !error && jobs.length > 0 && (
        <div className="table-container">
          <table className="jobs-table">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Status</th>
                <th>Message</th>
                <th>Folder Name</th>
                <th>Number of Images</th>
                <th>Job Submission Time</th>
                <th>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => (
                <tr key={job.id}>
                  <td className="job-id">{job.id}</td>
                  <td>{renderStatusBadge(job.request_status)}</td>
                  <td className="message-cell">{typeof job.message === 'object' ? JSON.stringify(job.message) : job.message || '-'}</td>
                  <td>{job.folder_name || '-'}</td>
                  <td className="numeric">{job.num_images}</td>
                  <td>{job.job_submission_time}</td>
                  <td>{job.last_updated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
