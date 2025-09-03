import logging
import json
import os
import uuid
from datetime import datetime, timezone, timedelta

import azure.functions as func
from azure.cosmos.cosmos_client import CosmosClient
from azure.storage.blob import BlobServiceClient, generate_blob_sas, BlobSasPermissions

# Configuration constants
COSMOS_ENDPOINT = os.environ.get('COSMOS_ENDPOINT')
COSMOS_WRITE_KEY = os.environ.get('COSMOS_WRITE_KEY')
COSMOS_DB_NAME = 'camera-trap'
COSMOS_CONTAINER_NAME = 'batch_api_jobs'

STORAGE_ACCOUNT_NAME = os.environ.get('STORAGE_ACCOUNT_NAME')
STORAGE_ACCOUNT_KEY = os.environ.get('STORAGE_ACCOUNT_KEY')
STORAGE_CONTAINER_UPLOAD = os.environ.get('STORAGE_CONTAINER_UPLOAD', 'test-centralised-upload')

# Default job settings
DEFAULT_SAS_EXPIRY_MINUTES = 60
API_INSTANCE = 'web'  # Hardcoded to avoid environment variable issues

def get_utc_time() -> str:
    """
    Return current UTC time as a string in the ISO 8601 format.
    Example: '2021-02-08T20:02:05.699689Z'
    """
    return datetime.now(timezone.utc).isoformat(timespec='microseconds').replace('+00:00', 'Z')


def build_azure_storage_uri(account, container, path=None, sas_token=None):
    """
    Build an Azure Storage URI for a blob or directory.
    """
    uri = f"https://{account}.blob.core.windows.net/{container}"
    
    if path:
        # Ensure path doesn't start with a slash
        if path.startswith('/'):
            path = path[1:]
        uri = f"{uri}/{path}"
    
    if sas_token:
        # Ensure SAS token starts with a question mark
        if not sas_token.startswith('?'):
            sas_token = f"?{sas_token}"
        uri = f"{uri}{sas_token}"
    
    return uri


def get_blob_permissions(read=True, write=True, create=True, add=True, list_permission=True):
    """
    Create standardized permissions for blob SAS tokens.
    """
    return BlobSasPermissions(
        read=read,
        add=add,
        create=create,
        write=write,
        delete=False,
        delete_previous_version=False,
        tag=False,
        list=list_permission,
        move=False,
        execute=False,
        ownership=False,
        permissions=False
    )

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
    
    def create_job_status(self, job_id: str, status: dict, call_params: dict) -> dict:
        """
        Create a new job status entry in Cosmos DB.
        """
        # Validate status
        if 'request_status' not in status or 'message' not in status:
            raise ValueError("Status must contain 'request_status' and 'message' fields")
            
        if status['request_status'] not in self.allowed_statuses:
            raise ValueError(f"Invalid request_status. Must be one of: {', '.join(self.allowed_statuses)}")
        
        # Create timestamp
        cur_time = get_utc_time()
        
        # Modify image_path_prefix to include job_id
        if 'image_path_prefix' in call_params:
            original_path = call_params['image_path_prefix']
            call_params['image_path_prefix'] = f"{job_id}/{original_path}"
        else:
            call_params['image_path_prefix'] = job_id
            
        # Remove input_container_sas if present
        if 'input_container_sas' in call_params:
            del call_params['input_container_sas']
            
        # Sanitize request_name for Cosmos DB
        if 'request_name' in call_params:
            import re
            invalid_chars_pattern = r'[^a-zA-Z0-9._-]'
            call_params['request_name'] = re.sub(invalid_chars_pattern, '_', call_params['request_name'])
            
        # Add 'caller' field with hard-coded value "awc"
        call_params['caller'] = 'awc'
        
        # Create job item
        item = {
            'id': job_id,
            'api_instance': API_INSTANCE,
            'status': status,
            'job_submission_time': cur_time,
            'last_updated': cur_time,
            'call_params': call_params
        }
        
        # Store in Cosmos DB
        try:
            created_item = self.db_jobs_client.create_item(item)
            logging.info(f"Created job status for job ID: {job_id}")
            return created_item
        except Exception as e:
            logging.error(f"Failed to create job status: {str(e)}")
            raise

def generate_sas_token(blob_name="", expiry_minutes=DEFAULT_SAS_EXPIRY_MINUTES, read=True, write=True):
    """
    Generate a SAS token for Azure Blob Storage.
    
    Args:
        blob_name: The name of the blob or directory (empty string for container-level access)
        expiry_minutes: How long the SAS token should be valid (in minutes)
        read: Whether to grant read permission
        write: Whether to grant write permission
        
    Returns:
        The SAS token string
    """
    try:
        # Set permissions
        permissions = get_blob_permissions(
            read=read,
            write=write,
            create=write,
            add=write,
            list_permission=True
        )
        
        # Set expiry time
        expiry = datetime.now(timezone.utc) + timedelta(minutes=expiry_minutes)
        
        # Generate the SAS token
        sas_token = generate_blob_sas(
            account_name=STORAGE_ACCOUNT_NAME,
            container_name=STORAGE_CONTAINER_UPLOAD,
            blob_name=blob_name,
            account_key=STORAGE_ACCOUNT_KEY,
            permission=permissions,
            expiry=expiry
        )
        
        return sas_token
    except Exception as e:
        logging.error(f"Error generating SAS token: {str(e)}")
        raise
        

def generate_directory_sas_url(job_id):
    """
    Generate a SAS URL for a specific directory in blob storage.
    
    Args:
        job_id: The job ID, which will be used as the directory name
        
    Returns:
        The full SAS URL for the directory
    """
    try:
        # Directory path within the container
        directory_path = f"{job_id}/"
        
        # Generate the SAS token
        sas_token = generate_sas_token(
            blob_name=directory_path, 
            read=True,   # Read permission is useful for listing uploaded files
            write=True   # Write permission needed for upload
        )
        
        # Build the full SAS URL
        sas_url = build_azure_storage_uri(
            account=STORAGE_ACCOUNT_NAME,
            container=STORAGE_CONTAINER_UPLOAD,
            path=directory_path,
            sas_token=sas_token
        )
        
        logging.info(f"Generated directory SAS URL for job ID: {job_id}")
        return sas_url
    except Exception as e:
        logging.error(f"Error generating directory SAS URL: {str(e)}")
        raise

def generate_azcopy_command(sas_url):
    """
    Generate an AzCopy command for uploading local files to the SAS URL.
    
    Args:
        sas_url: The SAS URL to upload to
        
    Returns:
        A command string that can be run to upload files using AzCopy
    """
    # The AzCopy command should use the SAS URL as the destination
    # and ask the user to replace <local_folder_path> with their folder path
    azcopy_command = f'azcopy copy "<local_folder_path>/*" "{sas_url}" --recursive=true'
    return azcopy_command


def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    Azure Function HTTP trigger to create a new image processing job.
    
    Args:
        req: The HTTP request object
        
    Returns:
        An HTTP response with job details
    """
    logging.info('Python HTTP trigger function processed a create-job request.')
    
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
        
        # Validate required fields
        if 'num_images' not in req_body or not isinstance(req_body['num_images'], int):
            return func.HttpResponse(
                json.dumps({"error": "num_images is required and must be an integer"}),
                status_code=400,
                mimetype="application/json"
            )
        
        # Generate a unique job ID
        job_id = uuid.uuid4().hex
        
        # Create job status entry in Cosmos DB
        status = {
            'request_status': 'created',
            'message': 'Request received from React web. Pending upload images to Blob container'
        }
        
        # Store job information in Cosmos DB
        job_table = JobStatusTable()
        job_table.create_job_status(job_id, status, req_body)
        
        # Generate SAS URL for the job directory (for internal use)
        job_sas_url = generate_directory_sas_url(job_id)
        
        # Generate AzCopy command (only for internal use, to be passed back to the client)
        azcopy_command = f'azcopy copy "<local_folder_path>/*" "{job_sas_url}" --recursive=true'
        
        # Return response with only the job ID
        # But also include SAS URL and AzCopy command as custom headers for the client to use
        response = {
            "jobId": job_id
        }
        
        return func.HttpResponse(
            json.dumps(response),
            status_code=200,
            headers={
                "X-SAS-Token-URL": job_sas_url,
                "X-AzCopy-Command": azcopy_command,
                "Content-Type": "application/json",
                "Access-Control-Expose-Headers": "X-SAS-Token-URL, X-AzCopy-Command"
            },
            mimetype="application/json"
        )
        
    except Exception as e:
        logging.error(f"Error creating job: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            mimetype="application/json"
        )
