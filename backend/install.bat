@echo off
setlocal

echo ====================================
echo  Checking Python version
echo ====================================

for /f "tokens=2 delims= " %%v in ('python --version 2^>^&1') do set pyVersion=%%v

if not defined pyVersion (
echo Python is not installed or not in PATH.
pause
exit /b 1
)

echo Detected Python version: %pyVersion%

echo %pyVersion% | findstr /b "3.14" >nul
if errorlevel 1 (
echo WARNING: Python 3.14 is required.
echo Current version: %pyVersion%
pause
)

echo ====================================
echo  Checking virtual environment
echo ====================================

if exist venv (
echo Existing virtual environment detected.
) else (
echo Creating virtual environment...
python -m venv venv
)

echo ====================================
echo  Activating virtual environment
echo ====================================

call venv\Scripts\activate

echo ====================================
echo  Installing dependencies
echo ====================================

if exist requirements.txt (
pip install --upgrade pip
pip install -r requirements.txt
) else (
echo requirements.txt not found.
)

echo ====================================
echo  Installation finished
echo ====================================

pause
