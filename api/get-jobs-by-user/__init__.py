import logging
import json
import os
from datetime import datetime

import azure.functions as func
from azure.cosmos.cosmos_client import CosmosClient

# Configuration constants
COSMOS_ENDPOINT = os.environ.get('COSMOS_ENDPOINT')
COSMOS_READ_KEY = os.environ.get('COSMOS_READ_KEY') or os.environ.get('COSMOS_WRITE_KEY')
COSMOS_DB_NAME = 'camera-trap'
COSMOS_CONTAINER_NAME = 'batch_api_jobs'

def format_datetime(dt_string):
    """
    Format datetime string for better display
    """
    try:
        dt = datetime.fromisoformat(dt_string.replace('Z', '+00:00'))
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    except Exception:
        return dt_string

def extract_folder_name(path_prefix):
    """
    Extract folder name from image_path_prefix
    Format is typically: jobId/folder_name
    """
    if not path_prefix:
        return ""
    
    parts = path_prefix.split('/')
    if len(parts) > 1:
        return parts[1]  # Return second element
    return path_prefix   # Return as is if no slash

def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    Azure Function HTTP trigger to get jobs by user ID.
    
    Args:
        req: The HTTP request object
        
    Returns:
        An HTTP response with jobs data
    """
    logging.info('Python HTTP trigger function processed a get-jobs-by-user request.')
    
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
        # Get the user ID from the route parameter or query string
        user_id = req.params.get('userId')
        
        if not user_id:
            return func.HttpResponse(
                json.dumps({"error": "User ID is required"}),
                status_code=400,
                mimetype="application/json"
            )
        
        # Sanitize the user ID to match the sanitization used when creating jobs
        import re
        invalid_chars_pattern = r'[^a-zA-Z0-9._-]'
        sanitized_user_id = re.sub(invalid_chars_pattern, '_', user_id)
        logging.info(f"Sanitized user ID '{user_id}' to '{sanitized_user_id}'")
        
        # Connect to Cosmos DB
        cosmos_client = CosmosClient(COSMOS_ENDPOINT, credential=COSMOS_READ_KEY)
        db_client = cosmos_client.get_database_client(COSMOS_DB_NAME)
        container_client = db_client.get_container_client(COSMOS_CONTAINER_NAME)
        
        # Define the query
        query = """
        SELECT 
            c.id, 
            c.status.request_status, 
            c.status.message,
            c.call_params.num_images,
            c.job_submission_time,
            c.last_updated,
            c.call_params.image_path_prefix
        FROM c 
        WHERE c.call_params.request_name = @userId
        ORDER BY c.job_submission_time DESC
        """
        
        # Define the parameters - use the sanitized user ID for the query
        parameters = [
            {"name": "@userId", "value": sanitized_user_id}
        ]
        
        # Execute the query
        items = list(container_client.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        # Process the results
        processed_items = []
        for item in items:
            # Format the datetime fields for better display
            if 'job_submission_time' in item:
                item['job_submission_time'] = format_datetime(item['job_submission_time'])
            if 'last_updated' in item:
                item['last_updated'] = format_datetime(item['last_updated'])
            
            # Extract folder name from image_path_prefix
            if 'image_path_prefix' in item:
                item['folder_name'] = extract_folder_name(item['image_path_prefix'])
            
            # Handle complex message objects
            if 'message' in item:
                # If message is a dictionary
                if isinstance(item['message'], dict):
                    # If it contains the 'detections' key directly, extract the URL
                    if 'detections' in item['message'] and isinstance(item['message']['detections'], str):
                        item['message'] = {
                            'text': 'View Detections',
                            'url': item['message']['detections']
                        }
                    # If it contains 'output_file_urls' key, extract from there
                    elif 'output_file_urls' in item['message']:
                        # If output_file_urls is itself a dictionary with 'detections'
                        if isinstance(item['message']['output_file_urls'], dict) and 'detections' in item['message']['output_file_urls']:
                            item['message'] = {
                                'text': 'View Detections',
                                'url': item['message']['output_file_urls']['detections']
                            }
                        # If output_file_urls is a string
                        elif isinstance(item['message']['output_file_urls'], str):
                            item['message'] = {
                                'text': 'View Output Files',
                                'url': item['message']['output_file_urls']
                            }
                        # Otherwise, convert the whole thing to a string for safety
                        else:
                            item['message'] = {
                                'text': 'View Results',
                                'url': '#'
                            }
                    # For any other dictionary, look for any URL-like string values
                    else:
                        url_found = False
                        for key, value in item['message'].items():
                            if isinstance(value, str) and ('http://' in value or 'https://' in value):
                                item['message'] = {
                                    'text': f'View {key.replace("_", " ").title()}',
                                    'url': value
                                }
                                url_found = True
                                break
                        
                        if not url_found:
                            # If no URL found, make it a simple message
                            item['message'] = "Results available"
                
                # Ensure message is always a string or a proper link object
                if not isinstance(item['message'], (str, dict)):
                    item['message'] = str(item['message'])
            
            processed_items.append(item)
        
        return func.HttpResponse(
            json.dumps(processed_items),
            status_code=200,
            mimetype="application/json"
        )
        
    except Exception as e:
        logging.error(f"Error retrieving jobs: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": f"Error retrieving jobs: {str(e)}"}),
            status_code=500,
            mimetype="application/json"
        )
