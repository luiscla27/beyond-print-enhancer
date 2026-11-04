@echo off
REM Orchestrator: spawn one external reasonix session via Windows Task Scheduler, which survives
REM the orchestrator's job-object cleanup (the documented failure of launching from a tool session).
REM Usage: spawn_task.cmd <phase_tag> <prompt_file_absolute> [max_steps]
setlocal
set PHASE=%~1
set PROMPT=%~2
set STEPS=%~3
if "%STEPS%"=="" set STEPS=600

set REPO=C:\luiscla27\projects\dndbeyond-printenhance
set FLEET=%REPO%\conductor\tracks\orchestrator_backlog_sweep_20261101
set SESSDIR=%USERPROFILE%\reasonix-fleet-workspaces\orchestrator_backlog_sweep_20261101\%PHASE%
set LOG=%FLEET%\logs\%PHASE%.log

if not exist "%SESSDIR%" mkdir "%SESSDIR%"
if not exist "%FLEET%\logs" mkdir "%FLEET%\logs"
if not exist "%FLEET%\runtime" mkdir "%FLEET%\runtime"

set TASKNAME=OrchPhase_%PHASE%
schtasks /delete /tn "%TASKNAME%" /f >nul 2>&1

REM The task runs cmd.exe which runs reasonix run, with all output to the phase log.
set TLCMD=cmd.exe /c ""%REPO%\reasonix.exe" run --dir "%SESSDIR%" --add-dir "%FLEET%" --add-dir "%REPO%" --permission-mode yolo --max-steps %STEPS% "Execute the file %PROMPT% as your complete task. Read it FULLY and follow every instruction exactly." 1>>"%LOG%" 2>&1"
schtasks /create /tn "%TASKNAME%" /tr "%TLCMD%" /sc once /st 00:00 /f /rl highest
schtasks /run /tn "%TASKNAME%"
echo [orch] scheduled+ran task %TASKNAME%
echo [orch] log: %LOG%
echo [orch] session dir: %SESSDIR%
