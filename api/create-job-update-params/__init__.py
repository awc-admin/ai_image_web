import logging
import json
import os
from azure.cosmos.cosmos_client import CosmosClient

import azure.functions as func

# Configuration constants - these would be loaded from environment variables in production
COSMOS_ENDPOINT = os.environ.get('COSMOS_ENDPOINT')
COSMOS_WRITE_KEY = os.environ.get('COSMOS_WRITE_KEY')
API_INSTANCE_NAME = os.environ.get('API_INSTANCE_NAME', 'web')

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a request to update job parameters.')
    
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
        db_client = cosmos_client.get_database_client('camera-trap')
        container_client = db_client.get_container_client('batch_api_jobs')
        
        # Get the current job document
        try:
            job_item = container_client.read_item(item=job_id, partition_key=job_id)
        except Exception as e:
            return func.HttpResponse(
                json.dumps({"error": f"Job not found: {str(e)}"}),
                status_code=404,
                mimetype="application/json"
            )
        
        # Log the current and new parameters
        logging.info(f"Current job parameters: {json.dumps(job_item['call_params'])}")
        logging.info(f"New job parameters: {json.dumps(req_body)}")
        
        # Make sure input_container_sas is present
        if 'input_container_sas' not in req_body or not req_body['input_container_sas']:
            logging.warning("input_container_sas is missing or empty in the request")
            # Provide a default value
            req_body['input_container_sas'] = f"https://{os.environ.get('STORAGE_ACCOUNT_NAME', 'storage')}.blob.core.windows.net/{os.environ.get('STORAGE_CONTAINER_UPLOAD', 'test-centralised-upload')}"
        
        # Update the call_params field
        job_item['call_params'] = req_body
        
        # Update the job document in Cosmos DB
        container_client.replace_item(item=job_item, body=job_item)
        
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
