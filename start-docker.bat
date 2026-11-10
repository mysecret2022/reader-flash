@echo off
cd /d "%~dp0"
echo ==============================================
echo Starting reader-flash in Docker...
echo ==============================================
docker compose pull
docker compose up -d
if errorlevel 1 (
    echo [ERROR] Failed to start reader-flash with docker compose.
    pause
    exit /b %errorlevel%
)
echo ==============================================
echo reader-flash started successfully!
echo Access reader-flash at: http://localhost:8080
echo Default admin credentials: admin / admin
echo ==============================================
pause
