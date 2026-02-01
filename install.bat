@echo off
echo Installing Video Downloader Pro...
echo.

echo Creating virtual environment...
python -m venv venv
call venv\Scripts\activate.bat

echo Installing dependencies...
pip install -r requirements.txt

echo.
echo Installation complete!
echo.
echo To run the application:
echo 1. Run: start_server.bat
echo 2. Open browser to: http://localhost:5000
echo.
pause