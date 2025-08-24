import logging
import json
import azure.functions as func

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a request for user info.')
    
    # This function would normally get user data from the request headers
    # In a real Azure Static Web App, authentication info is injected by the platform
    
    # In local development, this will return mock data
    # In production, it will access the real user data injected by Azure
    
    return func.HttpResponse(
        json.dumps({
            "user_info": "This would be the user data from Azure AD"
        }),
        mimetype="application/json"
    )
