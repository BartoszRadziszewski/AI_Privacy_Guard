@echo off
:: AI Privacy Guard — Windows installer
:: Creates venv, installs dependencies, and generates local Claude Code hook config.

setlocal EnableDelayedExpansion

set "PROJECT_DIR=%~dp0.."
set "VENV_DIR=%PROJECT_DIR%\venv"
set "PYTHON_EXE=%VENV_DIR%\Scripts\python.exe"
set "SETTINGS_LOCAL=%PROJECT_DIR%\.claude\settings.local.json"

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

:: Create venv
if not exist "%VENV_DIR%\Scripts\python.exe" (
    echo [1/3] Creating virtual environment...
    python -m venv "%VENV_DIR%"
    if errorlevel 1 ( echo [ERROR] Failed to create venv. & exit /b 1 )
) else (
    echo [1/3] Virtual environment already exists, skipping.
)

:: Install dependencies
echo [2/3] Installing dependencies (transformers, torch)...
"%VENV_DIR%\Scripts\pip.exe" install -r "%PROJECT_DIR%\requirements.txt" --quiet
if errorlevel 1 ( echo [ERROR] pip install failed. & exit /b 1 )

:: Generate .claude/settings.local.json with absolute venv paths
echo [3/3] Generating .claude\settings.local.json with local Python paths...

set "GUARD_PY=%PROJECT_DIR%\.claude\hooks\guard.py"
set "PRE_TOOL_PY=%PROJECT_DIR%\.claude\hooks\pre_tool_hook.py"

set "PYTHON_EXE_JSON=%PYTHON_EXE:\=\\%"
set "GUARD_PY_JSON=%GUARD_PY:\=\\%"
set "PRE_TOOL_PY_JSON=%PRE_TOOL_PY:\=\\%"

(
echo {
echo   "hooks": {
echo     "UserPromptSubmit": [
echo       {
echo         "matcher": "",
echo         "hooks": [
echo           {
echo             "type": "command",
echo             "command": "%PYTHON_EXE_JSON% %GUARD_PY_JSON%",
echo             "timeout": 30,
echo             "statusMessage": "Bielik-Guard: checking prompt..."
echo           }
echo         ]
echo       }
echo     ],
echo     "PreToolUse": [
echo       {
echo         "matcher": "Read",
echo         "hooks": [
echo           {
echo             "type": "command",
echo             "command": "%PYTHON_EXE_JSON% %PRE_TOOL_PY_JSON%",
echo             "timeout": 15,
echo             "statusMessage": "PII-Guard: checking file..."
echo           }
echo         ]
echo       },
echo       {
echo         "matcher": "Grep",
echo         "hooks": [
echo           {
echo             "type": "command",
echo             "command": "%PYTHON_EXE_JSON% %PRE_TOOL_PY_JSON%",
echo             "timeout": 10,
echo             "statusMessage": "PII-Guard: checking search path..."
echo           }
echo         ]
echo       }
echo     ]
echo   }
echo }
) > "%SETTINGS_LOCAL%"

echo.
echo === Setup complete ===
echo.
echo Next steps:
echo   1. Set PII_ANONYMIZER_PATH env var (path to your pii_anonymizer.py directory)
echo      Optional: anonymization is skipped if not set; classification still runs.
echo.
echo   2. Set HUGGINGFACE_HUB_TOKEN if the model requires authentication.
echo      First run downloads ~500 MB from HuggingFace automatically.
echo.
echo   3. Hooks are active for this project via .claude\settings.local.json
echo      Verify in Claude Code with /hooks
echo.
pause
