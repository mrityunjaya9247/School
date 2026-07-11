@echo off
REM ── NurturePass local server launcher ───────────────────────────
REM Serves this folder at http://localhost:8000 and opens index.html

cd /d "%~dp0"

echo Starting local server at http://localhost:8000 ...
echo Press Ctrl+C in this window to stop the server.
echo.

REM Open the app in the default browser after a short delay
start "" cmd /c "timeout /t 2 >nul & start http://localhost:8000/index.html"

REM Try Python 3 first, then the 'py' launcher, then Node.
where python >nul 2>&1 && (python -m http.server 8000 & goto :eof)
where py     >nul 2>&1 && (py -m http.server 8000 & goto :eof)
where npx    >nul 2>&1 && (npx --yes serve -l 8000 & goto :eof)

echo.
echo Could not find Python or Node on your PATH.
echo Install Python from https://python.org (check "Add to PATH") and re-run this file.
pause
