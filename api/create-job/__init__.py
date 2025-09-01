import logging
import json
import os
import uuid
from datetime import datetime, timezone, timedelta

import azure.functions as func
from azure.cosmos.cosmos_client import CosmosClient
from azure.storage.blob import BlobServiceClient, generate_blob_sas, BlobSasPermissions

# Configuration constants - these would be loaded from environment variables in production
COSMOS_ENDPOINT = os.environ.get('COSMOS_ENDPOINT')
COSMOS_WRITE_KEY = os.environ.get('COSMOS_WRITE_KEY')
STORAGE_ACCOUNT_NAME = os.environ.get('STORAGE_ACCOUNT_NAME')
STORAGE_ACCOUNT_KEY = os.environ.get('STORAGE_ACCOUNT_KEY')
STORAGE_CONTAINER_UPLOAD = os.environ.get('STORAGE_CONTAINER_UPLOAD', 'test-centralised-upload')
API_INSTANCE_NAME = os.environ.get('API_INSTANCE_NAME', 'web')

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

class JobStatusTable:
    """
    A wrapper around the Cosmos DB client to manage job status.
    """
    allowed_statuses = [
        'created', 'submitting_job', 'running', 'failed', 'problem', 'completed', 'canceled'
    ]
    
    def __init__(self, api_instance=None):
        # Always use 'web' for api_instance regardless of environment variable
        self.api_instance = 'web'
        cosmos_client = CosmosClient(COSMOS_ENDPOINT, credential=COSMOS_WRITE_KEY)
        db_client = cosmos_client.get_database_client('camera-trap')
        self.db_jobs_client = db_client.get_container_client('batch_api_jobs')
    
    def create_job_status(self, job_id: str, status: dict, call_params: dict) -> dict:
        """
        Create a new job status entry in Cosmos DB.
        """
        assert 'request_status' in status and 'message' in status
        assert status['request_status'] in JobStatusTable.allowed_statuses
        
        cur_time = get_utc_time()
        item = {
            'id': job_id,
            'api_instance': self.api_instance,
            'status': status,
            'job_submission_time': cur_time,
            'last_updated': cur_time,
            'call_params': call_params
        }
        created_item = self.db_jobs_client.create_item(item)
        return created_item

def generate_directory_sas_token(job_id):
    """
    Generate a SAS token for a specific directory in blob storage.
    """
    blob_service_client = BlobServiceClient(
        account_url=f"https://{STORAGE_ACCOUNT_NAME}.blob.core.windows.net",
        credential=STORAGE_ACCOUNT_KEY
    )
    
    # Directory path within the container
    directory_path = f"{job_id}/"
    
    # Set permissions for the SAS token (create, write, list)
    permissions = BlobSasPermissions(
        read=False,
        add=True,
        create=True,
        write=True,
        delete=False,
        delete_previous_version=False,
        tag=False,
        list=True,
        move=False,
        execute=False,
        ownership=False,
        permissions=False
    )
    
    # Set expiry time (60 minutes from now)
    expiry = datetime.now(timezone.utc) + timedelta(minutes=60)
    
    # Generate SAS token
    sas_token = generate_blob_sas(
        account_name=STORAGE_ACCOUNT_NAME,
        container_name=STORAGE_CONTAINER_UPLOAD,
        blob_name=directory_path,
        account_key=STORAGE_ACCOUNT_KEY,
        permission=permissions,
        expiry=expiry
    )
    
    # Build the full SAS URL
    sas_url = build_azure_storage_uri(
        account=STORAGE_ACCOUNT_NAME,
        container=STORAGE_CONTAINER_UPLOAD,
        path=directory_path,
        sas_token=sas_token
    )
    
    return sas_url

def generate_container_sas_token():
    """
    Generate a SAS token for the entire container in blob storage.
    """
    try:
        # Create a BlobServiceClient to ensure the connection is valid
        blob_service_client = BlobServiceClient(
            account_url=f"https://{STORAGE_ACCOUNT_NAME}.blob.core.windows.net",
            credential=STORAGE_ACCOUNT_KEY
        )
        
        # Set permissions for the SAS token (create, write, list)
        permissions = BlobSasPermissions(
            read=True,
            add=True,
            create=True,
            write=True,
            delete=False,
            delete_previous_version=False,
            tag=False,
            list=True,
            move=False,
            execute=False,
            ownership=False,
            permissions=False
        )
        
        # Set expiry time (60 minutes from now)
        expiry = datetime.now(timezone.utc) + timedelta(minutes=60)
        
        # Generate SAS token for the container
        sas_token = generate_blob_sas(
            account_name=STORAGE_ACCOUNT_NAME,
            container_name=STORAGE_CONTAINER_UPLOAD,
            blob_name="",  # Empty string for container-level access
            account_key=STORAGE_ACCOUNT_KEY,
            permission=permissions,
            expiry=expiry
        )
        
        # Build the full SAS URL for the container
        sas_url = build_azure_storage_uri(
            account=STORAGE_ACCOUNT_NAME,
            container=STORAGE_CONTAINER_UPLOAD,
            sas_token=sas_token
        )
        
        logging.info(f"Container SAS URL generated successfully: {sas_url[:50]}...")
        return sas_url
    except Exception as e:
        logging.error(f"Error generating container SAS token: {str(e)}")
        # Return a placeholder URL so the application doesn't crash
        return f"https://{STORAGE_ACCOUNT_NAME}.blob.core.windows.net/{STORAGE_CONTAINER_UPLOAD}"
    
    return sas_url

def generate_azcopy_command(sas_url):
    """
    Generate an AzCopy command for uploading local files to the SAS URL.
    """
    # The AzCopy command should use the SAS URL as the destination
    # and ask the user to replace <local_folder_path> with their folder path
    azcopy_command = f'azcopy copy "<local_folder_path>/*" "{sas_url}" --recursive=true'
    return azcopy_command

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a create-job request.')
    
    # Check if the user is authenticated
    client_principal = req.headers.get('x-ms-client-principal')
    if not client_principal:
        return func.HttpResponse(
            json.dumps({"error": "Authentication required"}),
            status_code=401,
            mimetype="application/json"
        )
    
    try:
        # Parse request body
        req_body = req.get_json() if req.get_body() else {}
        
        # Generate a unique job ID
        job_id = uuid.uuid4().hex
        
        # Create job status entry in Cosmos DB
        status = {
            'request_status': 'created',
            'message': 'Request received from React web. Pending upload images to Blob container'
        }
        
        # Initialize JobStatusTable
        job_table = JobStatusTable()
        
        # Store job information in Cosmos DB
        job_table.create_job_status(job_id, status, req_body)
        
        # Generate SAS token for the specific job directory
        job_sas_url = generate_directory_sas_token(job_id)
        
        # Generate SAS token for the entire container
        container_sas_url = generate_container_sas_token()
        
        # Generate AzCopy command using the job-specific SAS URL
        azcopy_command = generate_azcopy_command(job_sas_url)
        
        # Return response with job ID, SAS URLs, and AzCopy command
        response = {
            "jobId": job_id,
            "sasTokenUrl": job_sas_url,
            "containerSasUrl": container_sas_url,
            "azCopyCommand": azcopy_command
        }
        
        return func.HttpResponse(
            json.dumps(response),
            status_code=200,
            mimetype="application/json"
        )
        
    except Exception as e:
        logging.error(f"Error creating job: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            mimetype="application/json"
        )
