@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Execute instalar_windows.ps1 primeiro.
  pause
  exit /b 1
)
".venv\Scripts\python.exe" app.py
pause
