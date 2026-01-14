@echo off
echo ==========================================
echo       INTERSWITCH PORTAL TEST AGENT
echo      Verifying Application Integrity...
echo ==========================================

echo.
echo [1/3] Running Backend Tests...
cd server
call npm test
if %errorlevel% neq 0 (
    echo [ERROR] Backend Tests Failed!
    cd ..
    exit /b %errorlevel%
)
cd ..
echo [SUCCESS] Backend Tests Passed.

echo.
echo [2/3] Running Frontend Tests...
cd client
call npm test
if %errorlevel% neq 0 (
    echo [ERROR] Frontend Tests Failed!
    cd ..
    exit /b %errorlevel%
)
cd ..
echo [SUCCESS] Frontend Tests Passed.

echo.
echo [3/3] Running End-to-End Tests...
echo (Ensuring client is built...)
call npm run build --prefix client > nul 2>&1
call npx playwright test
if %errorlevel% neq 0 (
    echo [ERROR] E2E Tests Failed!
    exit /b %errorlevel%
)
echo [SUCCESS] E2E Tests Passed.

echo.
echo ==========================================
echo      ALL TESTS PASSED: CERTIFIED
echo      The Testing Agent certifies this build.
echo ==========================================
pause
