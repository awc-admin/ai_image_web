@echo off
echo ====================================================
echo Azure Static Web App - Full-Stack Development
echo ====================================================

echo.
echo This script will start both the React frontend and Python API.
echo Make sure your Python environment is activated with required packages installed.
echo.

REM 1. Check if we're in a conda environment
where conda >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  echo Conda is available. Checking if we're in an active environment...
  conda info --envs | findstr "*" >nul
  if %ERRORLEVEL% NEQ 0 (
    echo WARNING: No active conda environment detected.
    echo Please activate your Python environment before continuing.
    echo Example: conda activate your-environment-name
    echo.
    pause
  )
) else (
  echo NOTE: Conda not found in PATH. Make sure your Python environment is activated.
  echo.
  pause
)

REM 2. Start React development server in the background
echo Starting React development server...
cd app
start cmd /c "npm start"

REM 3. Wait for the React development server to start
echo Waiting for React development server to start...
timeout /t 15

REM 4. Install Python packages if needed
echo Checking Python API requirements...
cd ..
cd api
pip install -r requirements.txt

REM 5. Start Functions API
echo.
echo Starting Azure Functions API...
start cmd /c "func start"

REM 6. Wait for the API to start
echo Waiting for API to start...
timeout /t 5

REM 7. Return to the project root
cd ..

echo.
echo ====================================================
echo Development servers started:
echo - React Frontend: http://localhost:3000
echo - Python API: http://localhost:7071
echo ====================================================
echo.

echo Press Ctrl+C in individual terminal windows to stop the servers when done.
cmd /k "echo Development environment is running."
