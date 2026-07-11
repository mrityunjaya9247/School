@echo off
REM ── Initialize a local git repo and make the first commit ────────
cd /d "%~dp0"

where git >nul 2>&1 || (
  echo Git is not installed or not on PATH.
  echo Install it from https://git-scm.com/download/win then re-run this file.
  pause
  exit /b 1
)

REM Set identity only if not already configured (local to this repo)
git rev-parse --is-inside-work-tree >nul 2>&1 || git init
git config user.name  >nul 2>&1 || git config user.name  "GG"
git config user.email >nul 2>&1 || git config user.email "goyal.acc@gmail.com"

git add -A
git commit -m "Initial commit: NurturePass school safety app"

echo.
echo Done. Current status:
git log --oneline -1
git status -s
pause
