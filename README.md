# Azure Image Processing Web Application

A comprehensive web application for AI-powered image processing with Azure integration, featuring job management, file uploads, and real-time status tracking.

## Features

- 🚀 **Job Creation & Management**: Create, monitor, and modify image processing jobs
- 📁 **Flexible File Upload**: Browser-based uploads for small datasets, AzCopy integration for large datasets  
- 🔐 **Azure AD Authentication**: Secure user authentication and authorization
- 📊 **Real-time Status Tracking**: Live job status updates with pagination and filtering
- 🎯 **Smart Upload Detection**: Automatically recommends upload method based on dataset size (20,000 image threshold)
- 🔄 **Job Modification**: Update processing parameters without re-uploading images
- 📱 **Responsive Design**: Works on desktop and mobile devices

## Quick Start

### Prerequisites
- Node.js (LTS)
- Python 3.10 or 3.11
- Azure subscription with required resources

### Local Development
1. Clone the repository
2. Copy `api/local.settings.json.template` to `api/local.settings.json` and configure
3. Install dependencies:
   ```bash
   cd app && npm install
   cd ../api && pip install -r requirements.txt
   ```
4. Start the application:
   ```bash
   # Option 1: Traditional
   start-dev.bat
   
   # Option 2: SWA CLI (recommended)
   start-swa.bat
   ```

## Architecture

- **Frontend**: React Single Page Application (SPA)
- **Backend**: Azure Functions with Python runtime
- **Database**: Azure Cosmos DB for job metadata
- **Storage**: Azure Blob Storage for image files
- **Authentication**: Azure Active Directory
- **AI Processing**: Integration with Flask-based AI server

## For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md)

## Recent Updates

### 2025-09-24: Major Refactoring & Production Readiness
- ✅ **Removed unused Azure Functions**: `get-user`, `submit-job`, `create-job-update-params`
- ✅ **Cleaned up unused files**: Removed utility files not being imported
- ✅ **Security improvements**: Fixed SAS token generation for AzCopy compatibility
- ✅ **Smart upload logic**: 20,000 image threshold with UI adaptations
- ✅ **Enhanced AzCopy UI**: Separate SAS URL copying and companion program integration
- ✅ **Production deployment guide**: Comprehensive DEPLOYMENT.md with troubleshooting
- ✅ **Environment cleanup**: Template files and .gitignore for security
