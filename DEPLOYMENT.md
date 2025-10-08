# Azure Image Processing Web Application - Deployment Guide

## Overview
This guide covers deploying the Azure Image Processing Web Application to Azure Static Web Apps with Azure Functions backend.

## Prerequisites

### Required Azure Resources
1. **Azure Static Web Apps** resource
2. **Azure Functions** app (Python runtime)
3. **Azure Cosmos DB** account with database named `camera-trap` and container named `batch_api_jobs`
4. **Azure Storage Account** with blob container for image uploads
5. **Azure Active Directory** app registration for authentication

### Required Tools
- Azure CLI
- Azure Functions Core Tools v4
- Node.js (LTS version)
- Python 3.10 or 3.11

## Local Development Setup

### 1. Clone and Setup
```bash
git clone <your-repository>
cd ai_image_web
```

### 2. Configure Environment Variables
Copy `api/local.settings.json.template` to `api/local.settings.json` and fill in your values:

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "python",
    "AzureWebJobsStorage": "",
    "PYTHON_ISOLATE_WORKER_DEPENDENCIES": "0",
    "COSMOS_ENDPOINT": "https://your-cosmos-db.documents.azure.com:443/",
    "COSMOS_WRITE_KEY": "your-cosmos-db-write-key",
    "STORAGE_ACCOUNT_NAME": "your-storage-account-name",
    "STORAGE_ACCOUNT_KEY": "your-storage-account-key",
    "STORAGE_CONTAINER_UPLOAD": "your-upload-container-name",
    "AI_SERVER_HOST": "your-ai-server-host",
    "AI_SERVER_PORT": "5000",
    "AI_SERVER_PATH": "/request_detections",
    "AI_SERVER_PROTOCOL": "http"
  },
  "Host": {
    "CORS": "*",
    "CORSCredentials": false
  }
}
```

### 3. Install Dependencies
```bash
# Frontend dependencies
cd app
npm install

# Backend dependencies  
cd ../api
pip install -r requirements.txt
```

### 4. Run Locally
Option A: Traditional way
```bash
# Terminal 1: Start Functions API
conda activate your-python-env
cd api
func start

# Terminal 2: Start React app
cd app
npm start
```

Option B: Using SWA CLI
```bash
# Install SWA CLI globally
npm install -g @azure/static-web-apps-cli

# Start with batch script
start-swa.bat
```

## Azure Deployment

### 1. Azure Functions Deployment

#### Method A: VS Code Extension
1. Install Azure Functions extension
2. Right-click on `api` folder → "Deploy to Function App"
3. Select your Azure Functions app
4. Configure application settings (see Environment Variables section)

#### Method B: Azure CLI
```bash
# If not created yet: Create function app with command
az functionapp create --resource-group <your-resource-group-name> --consumption-plan-location <your-location> --runtime python --runtime-version 3.11 --functions-version 4 --name <your-function-app-name> --storage-account <your-storage-account-name>

# Deploy the functions
cd api
func azure functionapp publish <your-function-app-name>
```

### 2. Azure Static Web Apps Deployment

#### Method A: GitHub Actions (Recommended)
1. Create a GitHub repository for your code
2. In Azure Portal, create a Static Web App resource
3. Connect to your GitHub repository
4. Configure build settings:
   - App location: `app`
   - API location: `api`
   - Output location: `app/build`

#### Method B: Azure CLI
```bash
# Build the React app
cd app
npm run build

# Deploy with SWA CLI
swa deploy ./build --api-location ../api
```

### 3. Environment Variables Configuration

#### Azure Functions App Settings
Configure these in Azure Portal → Function App → Configuration:

```
COSMOS_ENDPOINT=https://your-cosmos-db.documents.azure.com:443/
COSMOS_WRITE_KEY=your-cosmos-db-write-key
STORAGE_ACCOUNT_NAME=your-storage-account-name
STORAGE_ACCOUNT_KEY=your-storage-account-key
STORAGE_CONTAINER_UPLOAD=your-upload-container-name
AI_SERVER_HOST=your-ai-server-host
AI_SERVER_PORT=5000
AI_SERVER_PATH=/request_detections
AI_SERVER_PROTOCOL=http
PYTHON_ISOLATE_WORKER_DEPENDENCIES=0
FUNCTIONS_WORKER_RUNTIME=python
```

#### Static Web App Configuration
The `app/public/staticwebapp.config.json` file handles routing and authentication:

```json
{
  "routes": [
    {
      "route": "/api/*",
      "methods": ["GET", "POST", "PUT", "DELETE"],
      "allowedRoles": ["authenticated"]
    },
    {
      "route": "/api-proxy/*",
      "methods": ["GET", "POST", "PUT", "DELETE"],
      "rewrite": "http://your-ai-server:5000/{rest}",
      "allowedRoles": ["authenticated"]
    }
  ],
  "auth": {
    "identityProviders": {
      "azureActiveDirectory": {
        "registration": {
          "openIdIssuer": "https://login.microsoftonline.com/common/v2.0",
          "clientIdSettingName": "AZURE_CLIENT_ID",
          "clientSecretSettingName": "AZURE_CLIENT_SECRET"
        }
      }
    }
  }
}
```

### 4. Azure Active Directory Setup
1. Create an App Registration in Azure AD
2. Configure redirect URIs for your Static Web App domain
3. Add client ID and secret to Static Web App configuration
4. Grant necessary permissions for user authentication

## Production Considerations

### Security
- ✅ Container-level SAS tokens with write-only permissions and short expiry
- ✅ Azure AD authentication required for all API endpoints
- ✅ HTTPS-only protocol enforcement
- ⚠️ Consider IP restrictions for SAS tokens if needed
- ⚠️ Rotate storage account keys regularly

### Performance
- ✅ File upload resumption via localStorage
- ✅ Parallel upload processing with configurable concurrency
- ✅ 20,000 image threshold for browser vs AzCopy uploads
- ✅ Optimized React component rendering

### Monitoring
- Configure Application Insights for both Static Web App and Functions
- Set up alerts for failed function executions
- Monitor storage account usage and costs
- Track authentication failures

### Backup and Recovery
- Cosmos DB automatic backups are enabled by default
- Consider storage account geo-redundancy (GRS/RA-GRS)
- Document disaster recovery procedures

## Troubleshooting

### Common Issues

#### 1. Authentication Errors in Local Development
**Problem**: API calls return 401 Unauthorized
**Solution**: Ensure `AZURE_FUNCTIONS_ENVIRONMENT=Development` is set or use SWA CLI for auth emulation

#### 2. CORS Issues
**Problem**: Frontend can't call Functions API
**Solution**: Check CORS settings in `api/local.settings.json` and Azure Functions configuration

#### 3. File Upload Failures
**Problem**: Large files fail to upload via browser
**Solution**: Direct users to use AzCopy for datasets > 20,000 images

#### 4. SAS Token Errors
**Problem**: AzCopy authentication failures
**Solution**: Verify storage account key and ensure container exists

#### 5. Flask Server Connection Issues
**Problem**: Status updates and job cancellation fail
**Solution**: Verify AI server endpoint and network connectivity

### Log Locations
- **Local Functions**: Console output from `func start`
- **Azure Functions**: Azure Portal → Function App → Monitor → Logs
- **Static Web App**: Azure Portal → Static Web App → Functions → Monitor
- **Browser Console**: For frontend JavaScript errors

## Cost Optimization
- Use consumption plan for Azure Functions (pay-per-execution)
- Consider storage account access tiers for uploaded images
- Monitor Cosmos DB RU consumption and scale accordingly
- Implement image cleanup policies for completed jobs

## Security Checklist
- [ ] Azure AD authentication configured
- [ ] Storage account keys secured in Key Vault (optional)
- [ ] API endpoints require authentication
- [ ] HTTPS enforcement enabled
- [ ] SAS tokens have minimal required permissions
- [ ] Network security groups configured (if using VNets)
- [ ] Regular security reviews of access permissions

## Support
For deployment issues:
1. Check Azure Portal diagnostics
2. Review function logs in Azure Monitor
3. Verify all environment variables are set correctly
4. Test API endpoints individually using tools like Postman
