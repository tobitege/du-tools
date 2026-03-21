@echo off
setlocal
cd /d "%~dp0"
node dist\server.js %*
exit /b %errorlevel%
