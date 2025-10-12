@echo off
setlocal

cd /d "%~dp0"

echo Starting static web server...
echo Web root: %CD%\out
echo Port: 3000
echo ========================================

nodejs\node.exe nodejs/node_modules/serve/build/main.js -l 3000 out

echo.
echo Server stopped.
pause