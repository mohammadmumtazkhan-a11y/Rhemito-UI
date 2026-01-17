@echo off
setlocal
title Mito Admin Portal - Local Production

echo ===================================================
echo   Mito Admin Portal - Local Production Run
echo ===================================================
echo.
echo [1/3] Installing dependencies for Server and Client...
echo [2/3] Building React Client...
echo.
echo This may take a few minutes for the first run.
echo.

call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Build failed. Please check the logs above.
    pause
    exit /b %errorlevel%
)

echo.
echo [3/3] Build success! Starting Server...
echo.
echo App will be available at: http://localhost:5000
echo.

call npm start
pause
