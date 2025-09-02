import logging
import json
import os
from azure.cosmos.cosmos_client import CosmosClient

import azure.functions as func

# Configuration constants
COSMOS_ENDPOINT = os.environ.get('COSMOS_ENDPOINT')
COSMOS_WRITE_KEY = os.environ.get('COSMOS_WRITE_KEY')
COSMOS_DB_NAME = 'camera-trap'
COSMOS_CONTAINER_NAME = 'batch_api_jobs'
STORAGE_ACCOUNT_NAME = os.environ.get('STORAGE_ACCOUNT_NAME', 'storage')
STORAGE_CONTAINER_UPLOAD = os.environ.get('STORAGE_CONTAINER_UPLOAD', 'test-centralised-upload')

def get_job_by_id(container_client, job_id):
    """
    Retrieve a job from Cosmos DB by ID.
    
    Args:
        container_client: The Cosmos DB container client
        job_id: The ID of the job to retrieve
        
    Returns:
        The job document as a dictionary
        
    Raises:
        Exception: If the job cannot be found
    """
    try:
        job_item = container_client.read_item(item=job_id, partition_key=job_id)
        return job_item
    except Exception as e:
        logging.error(f"Failed to retrieve job {job_id}: {str(e)}")
        raise


def ensure_container_sas_url(params):
    """
    Process parameters before updating.
    
    Args:
        params: The parameters dictionary to process
        
    Returns:
        The processed parameters dictionary
    """
    # Remove input_container_sas if present
    if 'input_container_sas' in params:
        del params['input_container_sas']
    
    # Ensure 'caller' field is set to 'awc'
    params['caller'] = 'awc'
    
    return params


def update_job_params(container_client, job_item, new_params):
    """
    Update a job's parameters in Cosmos DB.
    
    Args:
        container_client: The Cosmos DB container client
        job_item: The job document to update
        new_params: The new parameters to set
        
    Returns:
        The updated job document
    """
    try:
        # Update the call_params field
        job_item['call_params'] = new_params
        
        # Update the document in Cosmos DB
        updated_item = container_client.replace_item(item=job_item, body=job_item)
        logging.info(f"Updated job parameters for job ID: {job_item['id']}")
        return updated_item
    except Exception as e:
        logging.error(f"Failed to update job parameters: {str(e)}")
        raise
def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    Azure Function HTTP trigger to update parameters for an existing job.
    
    Args:
        req: The HTTP request object
        
    Returns:
        An HTTP response indicating success or failure
    """
    logging.info('Processing request to update job parameters.')
    
    # Check if the user is authenticated
    client_principal = req.headers.get('x-ms-client-principal')
    if not client_principal:
        return func.HttpResponse(
            json.dumps({"error": "Authentication required"}),
            status_code=401,
            mimetype="application/json"
        )
    
    try:
        # Extract the job ID from the route parameters
        job_id = req.route_params.get('jobId')
        if not job_id:
            return func.HttpResponse(
                json.dumps({"error": "Job ID is required"}),
                status_code=400,
                mimetype="application/json"
            )
        
        # Parse request body to get the updated parameters
        req_body = req.get_json()
        if not req_body:
            return func.HttpResponse(
                json.dumps({"error": "Request body is required"}),
                status_code=400,
                mimetype="application/json"
            )
        
        # Connect to Cosmos DB
        cosmos_client = CosmosClient(COSMOS_ENDPOINT, credential=COSMOS_WRITE_KEY)
        db_client = cosmos_client.get_database_client(COSMOS_DB_NAME)
        container_client = db_client.get_container_client(COSMOS_CONTAINER_NAME)
        
        # Get the current job document
        try:
            job_item = get_job_by_id(container_client, job_id)
        except Exception as e:
            return func.HttpResponse(
                json.dumps({"error": f"Job not found: {str(e)}"}),
                status_code=404,
                mimetype="application/json"
            )
        
        # Log the current and new parameters
        logging.info(f"Current job parameters: {json.dumps(job_item['call_params'])}")
        logging.info(f"New job parameters: {json.dumps(req_body)}")
        
        # Ensure container_sas_url is present
        req_body = ensure_container_sas_url(req_body)
        
        # Update the job document
        update_job_params(container_client, job_item, req_body)
        
        return func.HttpResponse(
            json.dumps({"success": True, "message": "Job parameters updated successfully"}),
            status_code=200,
            mimetype="application/json"
        )
        
    except Exception as e:
        logging.error(f"Error updating job parameters: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            mimetype="application/json"
        )
