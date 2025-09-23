@echo off
echo ====================================================
echo Azure Static Web App CLI - Full Stack Dev
echo ====================================================

echo.
echo Prerequisites:
echo - Node.js LTS installed (node -v)
echo - Azure Functions Core Tools v4 installed (func --version)
echo - SWA CLI installed globally: npm i -g @azure/static-web-apps-cli
echo.

REM Check for SWA CLI
where swa >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo ERROR: SWA CLI not found. Install with: npm i -g @azure/static-web-apps-cli
  exit /b 1
)

REM Start Azure Functions in a new window
echo Starting Azure Functions API...
start cmd /c "cd /d %~dp0api && func start"

REM Start SWA CLI which will also run the React dev server
echo Starting SWA CLI...
cd /d %~dp0
npm run start:swa

exit /b 0


