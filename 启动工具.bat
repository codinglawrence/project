@echo off
chcp 65001

REM B站UP主视频核心观点提取工具启动脚本

cd /d "%~dp0"

echo Starting backend service...
start "Bilibili UP Core Views Tool - Backend" cmd /k "python web\app.py"

echo Waiting for service to start...
timeout /t 3 /nobreak >nul

echo Opening browser...
start http://localhost:5000/

echo.
echo Startup complete! The tool is now running in your browser.
echo Note: To stop the service, close the backend window.
echo.
pause
