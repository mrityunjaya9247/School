@echo off
REM ── AARNA local server launcher ─────────────────────────────────
REM Serves the public\ folder at http://localhost:8000
REM
REM NOTE: this serves public\ only — the same files Firebase Hosting
REM deploys. It deliberately does NOT serve the repo root, so what you
REM test locally matches what goes live, and nothing under server\
REM (.env, service account keys) is ever reachable from a browser.

cd /d "%~dp0public"

echo Starting local server at http://localhost:8000 ...
echo Serving: %~dp0public
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
