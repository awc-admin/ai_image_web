import logging
import json
import os
import requests
from datetime import datetime, timezone

import azure.functions as func
from azure.cosmos.cosmos_client import CosmosClient

# Configuration constants
COSMOS_ENDPOINT = os.environ.get('COSMOS_ENDPOINT')
COSMOS_WRITE_KEY = os.environ.get('COSMOS_WRITE_KEY')
COSMOS_DB_NAME = 'camera-trap'
COSMOS_CONTAINER_NAME = 'batch_api_jobs'

# The URL of the external Flask server API endpoint - configurable
AI_SERVER_ENDPOINT = os.environ.get('AI_SERVER_ENDPOINT', 'http://20.11.8.84:5000/request_detections')

def get_utc_time() -> str:
    """
    Return current UTC time as a string in the ISO 8601 format.
    Example: '2021-02-08T20:02:05.699689Z'
    """
    return datetime.now(timezone.utc).isoformat(timespec='microseconds').replace('+00:00', 'Z')

class JobStatusTable:
    """
    A wrapper around the Cosmos DB client to manage job status.
    """
    allowed_statuses = [
        'created', 'submitting_job', 'running', 'failed', 'problem', 'completed', 'canceled'
    ]
    
    def __init__(self):
        # Connect to Cosmos DB
        cosmos_client = CosmosClient(COSMOS_ENDPOINT, credential=COSMOS_WRITE_KEY)
        db_client = cosmos_client.get_database_client(COSMOS_DB_NAME)
        self.db_jobs_client = db_client.get_container_client(COSMOS_CONTAINER_NAME)
    
    def get_job_status(self, job_id: str) -> dict:
        """
        Get the job status entry from Cosmos DB.
        """
        try:
            item = self.db_jobs_client.read_item(item=job_id, partition_key=job_id)
            logging.info(f"Retrieved job status for job ID: {job_id}")
            return item
        except Exception as e:
            logging.error(f"Failed to retrieve job status: {str(e)}")
            raise
    
    def update_job_status(self, job_id: str, status: dict) -> dict:
        """
        Update the status field of a job entry in Cosmos DB.
        """
        try:
            # Get the current item
            item = self.db_jobs_client.read_item(item=job_id, partition_key=job_id)
            
            # Validate status
            if 'request_status' not in status or 'message' not in status:
                raise ValueError("Status must contain 'request_status' and 'message' fields")
                
            if status['request_status'] not in self.allowed_statuses:
                raise ValueError(f"Invalid request_status. Must be one of: {', '.join(self.allowed_statuses)}")
            
            # Update the status and last_updated fields
            item['status'] = status
            item['last_updated'] = get_utc_time()
            
            # Update the item in Cosmos DB
            updated_item = self.db_jobs_client.replace_item(item=item['id'], body=item)
            logging.info(f"Updated job status for job ID: {job_id}")
            return updated_item
        except Exception as e:
            logging.error(f"Failed to update job status: {str(e)}")
            raise

def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    Azure Function HTTP trigger to complete a job upload and start processing.
    
    This function is called after all files have been uploaded to blob storage.
    It updates the job status and makes a request to the external AI server to start processing.
    
    Args:
        req: The HTTP request object
        
    Returns:
        An HTTP response with job status
    """
    logging.info('Python HTTP trigger function processed a complete-upload request.')
    
    # Check if the user is authenticated
    # In production, this will be populated by Azure Static Web Apps
    # In development, we'll allow requests without authentication
    client_principal = req.headers.get('x-ms-client-principal')
    if not client_principal and not os.environ.get('AZURE_FUNCTIONS_ENVIRONMENT') == 'Development':
        return func.HttpResponse(
            json.dumps({"error": "Authentication required"}),
            status_code=401,
            mimetype="application/json"
        )
    
    try:
        # Parse request body
        req_body = req.get_json() if req.get_body() else {}
        
        # Extract job ID
        job_id = req_body.get('jobId')
        
        # Validate required fields
        if not job_id:
            return func.HttpResponse(
                json.dumps({"error": "jobId is required"}),
                status_code=400,
                mimetype="application/json"
            )
        
        # Connect to Cosmos DB and get the job details
        job_table = JobStatusTable()
        job_item = None
        
        try:
            job_item = job_table.get_job_status(job_id)
        except Exception as e:
            return func.HttpResponse(
                json.dumps({"error": f"Job not found: {str(e)}"}),
                status_code=404,
                mimetype="application/json"
            )
        
        # Update the job status to indicate we're submitting to the AI server
        update_status = {
            'request_status': 'created',  # Keep the status as "created"
            'message': 'Calling AI server API...'
        }
        
        try:
            job_table.update_job_status(job_id, update_status)
        except Exception as e:
            return func.HttpResponse(
                json.dumps({"error": f"Failed to update job status: {str(e)}"}),
                status_code=500,
                mimetype="application/json"
            )
        
        # Get the call_params from the job item
        call_params = job_item.get('call_params', {})
        
        # Make a request to the external Flask server API
        try:
            # Prepare headers for the request
            headers = {
                'Content-Type': 'application/json'
            }
            
            # Make the POST request to the AI server
            response = requests.post(
                AI_SERVER_ENDPOINT,
                headers=headers,
                json=call_params,
                timeout=30  # Set a timeout to avoid hanging indefinitely
            )
            
            # Check if the request was successful (status code 200)
            if response.status_code == 200:
                # Update the job status to indicate successful submission
                success_status = {
                    'request_status': 'created',  # Keep the status as "created"
                    'message': 'AI processing request submitted successfully. Processing will begin shortly.'
                }
                
                job_table.update_job_status(job_id, success_status)
                
                # Return a success response
                return func.HttpResponse(
                    json.dumps({
                        "success": True,
                        "message": "Job submitted for processing",
                        "jobId": job_id
                    }),
                    status_code=200,
                    mimetype="application/json"
                )
            else:
                # Handle error response from the AI server
                error_message = f"AI server returned status code {response.status_code}"
                try:
                    error_data = response.json()
                    if 'error' in error_data:
                        error_message = error_data['error']
                except:
                    if response.text:
                        error_message = response.text
                
                # Update the job status to indicate the error
                error_status = {
                    'request_status': 'problem',  # Change to "problem" to indicate an issue
                    'message': f"Error submitting to AI server: {error_message}"
                }
                
                job_table.update_job_status(job_id, error_status)
                
                # Return an error response
                return func.HttpResponse(
                    json.dumps({
                        "success": False,
                        "error": error_message,
                        "jobId": job_id
                    }),
                    status_code=500,
                    mimetype="application/json"
                )
                
        except Exception as e:
            # Handle network or other errors
            error_message = f"Error making request to AI server: {str(e)}"
            logging.error(error_message)
            
            # Update the job status to indicate the error
            error_status = {
                'request_status': 'problem',  # Change to "problem" to indicate an issue
                'message': error_message
            }
            
            job_table.update_job_status(job_id, error_status)
            
            # Return an error response
            return func.HttpResponse(
                json.dumps({
                    "success": False,
                    "error": error_message,
                    "jobId": job_id
                }),
                status_code=500,
                mimetype="application/json"
            )
            
    except Exception as e:
        # Handle unexpected errors
        error_message = f"Unexpected error: {str(e)}"
        logging.error(error_message)
        
        return func.HttpResponse(
            json.dumps({
                "success": False,
                "error": error_message
            }),
            status_code=500,
            mimetype="application/json"
        )
