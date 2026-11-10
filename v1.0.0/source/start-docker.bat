@echo off
echo ==============================================
echo Starting reader-flash in Docker...
echo ==============================================
docker compose up -d --build
if errorlevel 1 (
    echo [ERROR] Failed to start reader-flash with docker compose.
    pause
    exit /b %errorlevel%
)
echo ==============================================
echo reader-flash started successfully!
echo Access reader-flash at: http://localhost:8090
echo Default admin credentials: admin / admin
echo ==============================================
pause
