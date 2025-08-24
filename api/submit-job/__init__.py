import logging
import json
import azure.functions as func
import os
import datetime
import uuid

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a job submission request.')
    
    try:
        # Parse request body
        req_body = req.get_json()
        
        # Extract form data
        email = req_body.get('email', '')  # Email is optional
        detection_model = req_body.get('detectionModel')
        classify = req_body.get('classify') == 'True'
        hierarchical_classification_type = req_body.get('hierarchicalClassificationType') if classify else 'off'
        perform_smoothing = req_body.get('performSmoothing') == 'True' if classify else False
        
        # Generate unique job ID
        job_id = str(uuid.uuid4())
        
        # Timestamp for job creation
        timestamp = datetime.datetime.utcnow().isoformat()
        
        # Create job object (this would be stored in a database in production)
        job = {
            "job_id": job_id,
            "timestamp": timestamp,
            "status": "pending",
            "email": email,  # Can be empty
            "configuration": {
                "detection_model": detection_model,
                "classify": classify,
                "hierarchical_classification_type": hierarchical_classification_type,
                "perform_smoothing": perform_smoothing
            },
            "files_to_process": req_body.get('fileCount', 0)
        }
        
        # In a real implementation:
        # 1. We would save this job to a database
        # 2. We would handle file uploads and store them
        # 3. We would trigger the processing pipeline
        # 4. If email is provided, we'd send notifications
        
        # For development, just log the job and return a success response
        logging.info(f"Created new job: {job}")
        
        return func.HttpResponse(
            json.dumps({
                "success": True, 
                "job_id": job_id, 
                "message": "Job submitted successfully",
                "notification": "Email notification will be sent" if email else "No email provided for notifications"
            }),
            status_code=201,
            mimetype="application/json"
        )
            
    except Exception as e:
        logging.error(f"Error processing job submission: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            mimetype="application/json"
        )
