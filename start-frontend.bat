@echo off
echo ====================================================
echo Azure Static Web App - Frontend Only Development
echo ====================================================

echo.
echo This script will start only the React frontend.
echo.

REM Start React development server
echo Starting React development server...
cd app
npm start

exit /b 0
