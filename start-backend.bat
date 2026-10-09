@echo off
cd /d "%~dp0backend"
if not exist node_modules (
  echo Installing backend packages...
  call npm install
)
if not exist .env (
  echo.
  echo  .env not found. Copy backend\.env.example to backend\.env and fill in your SQL Server details, then run this again.
  pause
  exit /b 1
)
call npm start
pause
