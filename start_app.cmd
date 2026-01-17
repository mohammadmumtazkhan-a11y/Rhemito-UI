@echo off
echo Starting Mito Admin Portal...
start cmd /k "cd server && npm start"
start cmd /k "cd client && npm run dev"
echo Application started.
echo Backend: http://localhost:5000
echo Frontend: http://localhost:5173
pause
