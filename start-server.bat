@echo off
echo.
echo ===================================
echo  Sai Manikanta Constructions
echo  Server Startup Script
echo ===================================
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo [1/2] Installing dependencies...
    echo.
    call npm install
    echo.
    echo Dependencies installed successfully!
    echo.
) else (
    echo [INFO] Dependencies already installed.
    echo.
)

echo [2/2] Starting server...
echo.
echo Server will be available at: http://localhost:3000
echo Press Ctrl+C to stop the server
echo.

npm start
