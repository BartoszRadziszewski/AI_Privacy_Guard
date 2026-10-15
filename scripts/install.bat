@echo off
:: AI Privacy Guard — Windows installer
:: Creates venv and installs dependencies. Hook registration: see README.md.

setlocal EnableDelayedExpansion

set "PROJECT_DIR=%~dp0.."
set "VENV_DIR=%PROJECT_DIR%\venv"

echo.
echo === AI Privacy Guard - Setup ===
echo Project: %PROJECT_DIR%
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found in PATH. Install Python 3.10+ and retry.
    exit /b 1
)

:: Check Node.js (backup hook, event log)
node --version >nul 2>&1
if errorlevel 1 (
    echo [WARN] Node.js not found in PATH. The backup hook and event log need Node.js 18+.
)

:: Create venv
if not exist "%VENV_DIR%\Scripts\python.exe" (
    echo [1/2] Creating virtual environment...
    python -m venv "%VENV_DIR%"
    if errorlevel 1 ( echo [ERROR] Failed to create venv. & exit /b 1 )
) else (
    echo [1/2] Virtual environment already exists, skipping.
)

:: Install dependencies
echo [2/2] Installing dependencies (transformers, torch)...
"%VENV_DIR%\Scripts\pip.exe" install -r "%PROJECT_DIR%\requirements.txt" --quiet
if errorlevel 1 ( echo [ERROR] pip install failed. & exit /b 1 )

echo.
echo === Setup complete ===
echo.
echo Next steps:
echo   1. Inside this repo the hooks run from .claude\settings.json (Claude Code)
echo      and .codex\hooks.json (Codex) with the venv interpreter.
echo   2. To protect all projects, register the hooks in %%USERPROFILE%%\.claude\settings.json
echo      - see "Hook registration" in README.md.
echo   3. Optional environment variables: BIELIK_GUARD_LOCAL_ALLOWLIST (your own
echo      addresses, file outside the repo), BIELIK_GUARD_PROJECTS_ROOT, EVENT_LOG_PATH.
echo   4. First prompt downloads the Bielik-Guard model (~500 MB) from HuggingFace.
echo      Set HUGGINGFACE_HUB_TOKEN if the model requires authentication.
echo.
pause
