# Azure Static Web App with React and Python API

This project is a Azure Static Web App using React for the frontend and Python for the backend API.

## Prerequisites

- [Node.js](https://nodejs.org/)
- [Anaconda](https://www.anaconda.com/products/distribution) or [Miniconda](https://docs.conda.io/en/latest/miniconda.html)
- [Azure Static Web Apps CLI](https://github.com/Azure/static-web-apps-cli)

## Project Structure

- `/app` - React frontend application
- `/api` - Python API functions
- `swa-cli.config.json` - Configuration for Azure Static Web Apps CLI

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