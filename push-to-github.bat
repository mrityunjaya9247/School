@echo off
setlocal
REM ── Commit all current changes and push to GitHub ────────────────
cd /d "%~dp0"

where git >nul 2>&1 || (
  echo Git is not installed or not on PATH.
  echo Install it from https://git-scm.com/download/win then re-run this file.
  pause
  exit /b 1
)

set "REPOURL=https://github.com/mrityunjaya9247/School.git"

REM Ensure repo + identity exist
git rev-parse --is-inside-work-tree >nul 2>&1 || git init
git config user.name  >nul 2>&1 || git config user.name  "GG"
git config user.email >nul 2>&1 || git config user.email "goyal.acc@gmail.com"

REM Ensure 'origin' points at the repo
git remote get-url origin >nul 2>&1 && (git remote set-url origin "%REPOURL%") || (git remote add origin "%REPOURL%")
git branch -M main

REM Stage everything
git add -A

REM Ask for a commit message (fallback to a default if left blank)
set "MSG="
set /p MSG="Commit message (press Enter for default): "
if "%MSG%"=="" set "MSG=Update NurturePass app"

REM Commit only if there is something staged
git diff --cached --quiet && (
  echo.
  echo No changes to commit - pushing whatever is already committed...
) || (
  git commit -m "%MSG%"
)

echo.
echo Pushing to %REPOURL% ...
echo (A browser sign-in may pop up the first time.)
git push -u origin main

echo.
echo ---- Result ----
git log --oneline -1
git status -s
pause
