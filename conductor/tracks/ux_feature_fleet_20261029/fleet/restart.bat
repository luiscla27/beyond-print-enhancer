@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

REM =====================================================================
REM  FLEET RESTART - kill every running track, then resume-launch them.
REM  -------------------------------------------------------------------
REM  The sanctioned way to mass-stop a fleet and start it again. Each
REM  track's LAUNCH-PROMPT.md is resume-safe (re-reads progress + reconcile
REM  and skips done work), so relaunching continues where the kill left off.
REM  Run this from a USER console (double-click), NOT from an orchestrator
REM  session. This is a DELIBERATE restart, not the watchdog's stuck-track
REM  recovery, and not a blanket kill of unrelated processes.
REM =====================================================================

echo ============================================================
echo   FLEET RESTART - stopping all tracks, then relaunching
echo ============================================================
echo.

REM ---- 0. PER-PROJECT pattern: this fleet's own tracks path (never the global
REM         "LAUNCH-PROMPT.md" — a fleet in another project must not block/kill this one).
set "WAIT_PATTERN=%~dp0tracks\track-"

REM ---- 1. kill every running track (cmd + node + reasonix carrying THIS fleet's pattern) ----
echo [restart] killing running tracks...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*%WAIT_PATTERN%*' -and $_.Name -in @('cmd.exe','node.exe','reasonix.exe') } | ForEach-Object { taskkill /PID $_.ProcessId /T /F 2>&1 | Out-Null }"

REM ---- 2. wait until no live track remains (bounded ~30s) ----
set /a TRIES=0
:WAIT_DEAD
%SystemRoot%\System32\ping.exe -n 3 127.0.0.1 >nul
set "LIVE=0"
for /f %%c in ('powershell -NoProfile -ExecutionPolicy Bypass -File guard.ps1 -Pattern "%WAIT_PATTERN%"') do set "LIVE=%%c"
set /a TRIES+=1
if "!LIVE!" NEQ "0" (
    if !TRIES! GEQ 15 (
        echo [restart] WARNING: !LIVE! tracks still alive after ~30s - proceeding anyway
        goto :RELAUNCH
    )
    goto :WAIT_DEAD
)

:RELAUNCH
echo [restart] tracks stopped. Relaunching (resume-safe)...
echo.
call launch.bat

endlocal
exit /b 0
