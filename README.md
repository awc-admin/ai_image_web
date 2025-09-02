# AI Image Processing Web Application

This project is an Azure Static Web App using React (v19.1.1) for the frontend and Python for the backend API. It provides a web interface for submitting image processing jobs with resilient file upload capabilities.

## Recent Updates

- **2025-08-31**: Fixed issue with `api_instance` field in Cosmos DB being set to 'react_web' instead of 'web'. Now the value is hardcoded to 'web' in the `JobStatusTable` class to ensure consistency.
- **2025-09-01**: Refactored codebase to improve maintainability:
  - Reorganized backend code for better separation of concerns and error handling
  - Created utility files for frontend code organization
  - Eliminated duplicate code and improved function documentation
- **2025-09-02**: Modified Cosmos DB item structure:
  - Updated `image_path_prefix` to include the job ID (format: `{job_id}/{original_path}`)
  - Removed `input_container_sas` field from job items in Cosmos DB
  - Simplified API response structure
  - Added a hard-coded `caller` field with value "awc" to all jobs
- **2025-09-02**: API response improvements:
  - Streamlined API responses to return only the job ID in the response body
  - Moved SAS URL and AzCopy command to HTTP headers
  - Enhanced security by reducing exposed data in the response body
  - Maintained AzCopy command functionality in the UI

## Prerequisites

- [Node.js](https://nodejs.org/)
- [Anaconda](https://www.anaconda.com/products/distribution) or [Miniconda](https://docs.conda.io/en/latest/miniconda.html)
- [Azure Static Web Apps CLI](https://github.com/Azure/static-web-apps-cli)
- [AzCopy](https://docs.microsoft.com/en-us/azure/storage/common/storage-use-azcopy-v10) (optional, for large uploads)

## Project Structure

- `/app` - React frontend application
- `/api` - Python API functions
- `swa-cli.config.json` - Configuration for Azure Static Web Apps CLI

## Key Features

- **Job Submission Form**: Submit image processing jobs with configurable parameters
- **Multi-option File Uploads**: Choose between browser-based or AzCopy command-line uploads
- **Resilient Uploads**: Resume interrupted uploads with progress tracking
- **Authentication**: Secure access with Azure Active Directory (with mock auth for local development)

## Setting Up Python Environment

Since this project uses Python for the backend API, you need to set up a Python environment. The recommended approach is to use Anaconda:

1. Open Anaconda Prompt
2. Create a new environment for the project:
   ```
   conda create -n azure-func python=3.10
   ```
3. Activate the environment:
   ```
   conda activate azure-func
   ```
4. Navigate to your project directory:
   ```
   cd path\to\ai_image_web
   ```
5. Install the required packages:
   ```
   cd api
   pip install -r requirements.txt
   ```

## Running the Application Locally

We provide two scripts for local development:

### Option 1: Full-Stack Development (Frontend + API)

This script starts both the React frontend and the Azure Functions API:

1. Activate your Anaconda environment:
   ```
   conda activate azure-func
   ```

2. Run the development script:
   ```
   .\start-dev.bat
   ```

This will:
- Start the React development server at http://localhost:3000
- Start the Azure Functions API at http://localhost:7071
- Install any required Python packages

### Option 2: Frontend-Only Development

If you only want to work on the frontend:

1. Run the frontend script:
   ```
   .\start-frontend.bat
   ```

This will start only the React development server at http://localhost:3000

## Authentication

This application uses Azure Active Directory (AAD) for authentication. When running locally, a mock authentication system is used.

- Login: `/.auth/login/aad`
- Logout: `/.auth/logout`
- User Info: `/.auth/me`

## Job Submission Workflow

1. User selects a directory of image files
2. User configures job parameters and submits the form
3. A job is created with a unique ID
4. User chooses between browser upload or AzCopy command
5. For browser upload:
   - Files are uploaded one by one with progress tracking
   - Upload state is stored in localStorage for resume capability
6. For AzCopy:
   - User copies the command and runs it in their terminal
   - Files are uploaded directly to Azure Blob Storage

## API Endpoints

The application uses several Azure Functions endpoints:

- `/api/create-job`: Creates a new job and returns a job ID
- `/api/upload-file`: Handles file uploads to Azure Blob Storage
- `/api/get-sas-token`: Generates SAS tokens for direct uploads (when needed)

## Implementation Details

### Upload Workflow

The file upload system is resilient to browser refreshes and network interruptions:

1. File references are maintained after job creation
2. Upload progress is tracked in localStorage
3. Interrupted uploads can be resumed
4. Multiple upload options are provided for different use cases

### File Reference Persistence

File references are maintained using:
- React refs with a hidden file input
- File metadata storage in localStorage
- Multiple fallback mechanisms for file access recovery

## Deploying to Azure

To deploy to Azure, you can use the Azure Static Web Apps extension for VS Code or the Azure CLI.

### Using Azure CLI

```
az login
az staticwebapp create --name your-app-name --resource-group your-resource-group --source . --app-location app --api-location api --output-location app/build
```

### Using VS Code Extension

1. Install the Azure Static Web Apps extension for VS Code
2. Click on the Azure icon in the VS Code activity bar
3. Click on the "+" icon to create a new Static Web App
4. Follow the prompts to complete the deployment