# Web App Deployment Summary for AI Agents

## 1. Core Deployment Architecture

- **Platform**: Azure Static Web Apps (SWA)
- **Frontend**: React Single Page Application (SPA), located in the `/app` directory.
- **Backend**: Python Serverless API, located in the `/api` directory and deployed as an Azure Function App linked to the SWA.
- **CI/CD**: GitHub Actions is the primary mechanism for building the React app and deploying both the frontend and backend API to the Static Web App resource. The workflow is defined in `.github/workflows/azure-static-web-apps-victorious-ocean-00f39c600.yml`.

---

## 2. Historical Deployment Issues & Resolutions

This log details the chronological debugging process for deploying the application and configuring its features in the Azure cloud environment.

### Issue 2.1: GitHub Actions Workflow Failures
- **Problem**: The CI/CD pipeline was failing, preventing deployments.
- **Investigation & Fixes**:
    1.  **Linting Errors**: The build step failed due to ESLint errors (`no-unused-vars`, `no-loop-func`, `react-hooks/exhaustive-deps`).
        - **Resolution**: Code was refactored to remove unused variables, extract functions from loops, and satisfy React hook dependency rules.
    2.  **Node.js Version Mismatch**: The Oryx build service used a Node.js version incompatible with the project's dependencies, causing an `EBADENGINE` error.
        - **Resolution**: An `engines` block was added to `app/package.json` to specify a compatible Node.js version (`>=20.0.0`).
    3.  **Incorrect Workflow Paths**: The deployment failed silently or with path errors because the `app_location` and `api_location` in the workflow YAML file had incorrect prefixes (`./app` and `/api`).
        - **Resolution**: The paths were corrected to `app` and `api` respectively, as required by the SWA build service.
    4.  **Deleted/Mismatched Workflow File**: At one point, the workflow file was accidentally deleted, and later recreated with a name that didn't match the one configured in Azure, causing triggers to be missed.
        - **Resolution**: The correct workflow file (`azure-static-web-apps-victorious-ocean-00f39c600.yml`) was restored and correctly configured.

### Issue 2.2: Post-Deployment Runtime Errors
- **Problem**: After a successful deployment, the application would not load correctly in the browser.
- **Investigation & Fixes**:
    1.  **Blank Page & MIME Type Errors**: The deployed site showed a blank white page, and browser console logs indicated that CSS/JS files were being served with an incorrect MIME type of `text/html`.
        - **Root Cause**: The `navigationFallback` rule in `staticwebapp.config.json` was rewriting all requests, including those for static assets (`.css`, `.js`), to `/index.html`.
        - **Resolution**: The `navigationFallback.exclude` array was updated to explicitly ignore paths for static assets (e.g., `/static/*`, `/*.js`, `/*.css`).

### Issue 2.3: Azure AD Authentication Loop
- **Problem**: The most persistent issue was an infinite redirect loop when a user attempted to log in with Azure AD. The application would repeatedly redirect between the SWA domain and `login.microsoftonline.com`.
- **Investigation & Fixes**:
    1.  **Mock Auth Interference**: The local development mock authentication (`/public/mockAuth.js`) was active in the deployed environment, interfering with the real SWA authentication flow.
        - **Resolution**: The script was modified to only initialize on `localhost`.
    2.  **SWA Auth Endpoint Debugging**: Fetching `/.auth/me` returned `{"clientPrincipal": null}`. Critically, fetching `/.auth/providers` returned an HTML page instead of the expected JSON object.
        - **Root Cause**: This indicated a fundamental misconfiguration of the authentication providers on the Azure SWA resource itself.
    3.  **"Simple" vs. "Custom" Auth Modes**: Research revealed two authentication modes in Azure SWA. The project was attempting a "Custom" setup (requiring a manual Azure AD App Registration, client secrets, and a custom roles function) which was incorrectly configured.
    4.  **Hardcoded Secrets**: During debugging, `AZURE_CLIENT_ID` and `AZURE_CLIENT_SECRET` were temporarily hardcoded in `staticwebapp.config.json`. This is a critical security vulnerability.
        - **Resolution**: These were removed. The correct approach is to store them as Application Settings in the Azure Portal.
    5.  **Git Merge Conflicts**: The `staticwebapp.config.json` file experienced a Git merge conflict during the debugging process.
        - **Resolution**: The conflict markers were manually removed to restore a valid JSON structure.

---

## 3. Current Project State (As of Reset)

- **Status**: The repository has been hard-reset to commit `2be2c72f321e96829948af20190e8ec9f7237a88`.
- **Implication**: This action has **undone** many of the fixes detailed above. The codebase is now in a state where the authentication loop is expected to occur, and the GitHub Actions workflow may contain the incorrect pathing.

## 4. Unresolved Issues & Recommended Path Forward

- **Primary Unresolved Issue**: The Azure AD authentication loop. While the root cause was identified as a misconfiguration of "Custom" authentication, the final solution was not implemented before the reset.

- **Recommended Steps**:
    1.  **Validate Workflow**: Ensure the GitHub Actions workflow file (`azure-static-web-apps-victorious-ocean-00f39c600.yml`) has the correct, prefix-less paths (`app_location: "app"`, `api_location: "api"`).
    2.  **Clean Configuration**: Verify that `staticwebapp.config.json` does **not** contain any hardcoded secrets or authentication provider configurations. It should only define routing and response overrides.
    3.  **Deploy**: Push the changes to trigger a fresh deployment.
    4.  **Configure "Simple" Authentication**: In the Azure Portal for the Static Web App, navigate to the "Authentication" blade and explicitly select the **"Simple"** management mode. This allows Azure to handle the App Registration and configuration automatically, which is the most direct path to resolving the authentication loop.
    5.  **Test**: After deployment, clear browser cache and test the login flow. The `/.auth/providers` endpoint should now correctly return JSON, and the login should complete successfully.
