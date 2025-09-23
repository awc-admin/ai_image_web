import logging
import azure.functions as func
import os
import json
import base64
from azure.storage.blob import BlobServiceClient, BlobClient, ContentSettings

# Configuration constants - these would be loaded from environment variables in production
STORAGE_ACCOUNT_NAME = os.environ.get('STORAGE_ACCOUNT_NAME')
STORAGE_ACCOUNT_KEY = os.environ.get('STORAGE_ACCOUNT_KEY')
STORAGE_CONTAINER_UPLOAD = os.environ.get('STORAGE_CONTAINER_UPLOAD', 'test-centralised-upload')

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a file upload request.')
    
    # Check if the user is authenticated
    client_principal = req.headers.get('x-ms-client-principal')
    # Allow unauthenticated access when running locally (Development)
    if not client_principal and not os.environ.get('AZURE_FUNCTIONS_ENVIRONMENT') == 'Development':
        return func.HttpResponse(
            json.dumps({"error": "Authentication required"}),
            status_code=401,
            mimetype="application/json"
        )
    
    try:
        # Parse request body
        req_body = req.get_json()
        
        # Extract file information from request
        job_id = req_body.get('jobId')
        file_name = req_body.get('fileName')
        file_path = req_body.get('filePath', file_name)  # Use filePath if provided, otherwise just fileName
        file_content_b64 = req_body.get('fileContent')
        content_type = req_body.get('contentType', 'application/octet-stream')
        
        # Validate required fields
        if not job_id or not file_name or not file_content_b64:
            return func.HttpResponse(
                json.dumps({"error": "Missing required fields: jobId, fileName, fileContent"}),
                status_code=400,
                mimetype="application/json"
            )
        
        # Decode base64 file content
        try:
            # Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
            if ';base64,' in file_content_b64:
                file_content_b64 = file_content_b64.split(';base64,')[1]
            
            file_content = base64.b64decode(file_content_b64)
        except Exception as e:
            return func.HttpResponse(
                json.dumps({"error": f"Invalid base64 content: {str(e)}"}),
                status_code=400,
                mimetype="application/json"
            )
        
        # Create blob client and upload file
        blob_service_client = BlobServiceClient(
            account_url=f"https://{STORAGE_ACCOUNT_NAME}.blob.core.windows.net",
            credential=STORAGE_ACCOUNT_KEY
        )
        container_client = blob_service_client.get_container_client(STORAGE_CONTAINER_UPLOAD)
        
        # Create blob path with job ID as directory and preserve subfolder structure
        blob_path = f"{job_id}/{file_path}"
        
        # Upload the file to blob storage
        blob_client = container_client.get_blob_client(blob_path)
        content_settings = ContentSettings(content_type=content_type)
        
        blob_client.upload_blob(
            file_content,
            overwrite=True,
            content_settings=content_settings
        )
        
        return func.HttpResponse(
            json.dumps({
                "success": True,
                "message": "File uploaded successfully",
                "blobPath": blob_path
            }),
            status_code=200,
            mimetype="application/json"
        )
        
    except Exception as e:
        logging.error(f"Error uploading file: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            mimetype="application/json"
        )
