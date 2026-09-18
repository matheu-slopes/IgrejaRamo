@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Execute instalar_windows.ps1 primeiro.
  pause
  exit /b 1
)
if /I "%~1"=="local" set "LOUVOR_STUDIO_SITE_URL=http://localhost:3000"
".venv\Scripts\python.exe" hq_worker.py
pause
