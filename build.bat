@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found.
  pause
  exit /b 1
)

where cargo >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Rust/cargo not found.
  pause
  exit /b 1
)

where spicetify >nul 2>nul
if errorlevel 1 (
  echo [WARN] spicetify CLI not found in PATH. The app will still build.
  echo.
)

echo [1/2] Installing dependencies...
call npm install
if errorlevel 1 (
  echo [ERROR] npm install failed.
  pause
  exit /b 1
)

echo.
echo [2/2] Building GUIFY ^(release bundle^)...
call npm run tauri build
if errorlevel 1 (
  echo.
  echo [ERROR] Build failed.
  pause
  exit /b 1
)

echo.
echo Done! Installers are in src-tauri\target\release\bundle\ (nsis\*.exe)
pause
endlocal
