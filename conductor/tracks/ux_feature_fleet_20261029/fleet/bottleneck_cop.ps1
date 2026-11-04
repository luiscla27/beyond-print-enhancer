<#
.SYNOPSIS
  Bottlenecks cop scheduler — runs alongside the fleet (started by launch.bat).
  Every CycleMinutes, spawns a fresh reasonix audit session (bottleneck-cop-prompt.md);
  exits shortly after the fleet drains. Read-only supervisor: never kills, never writes
  into runtime/ (except runtime\cop\state.json).

.DESCRIPTION
  - Started once by launch.bat (outside the rolling pool): the cop is the 9th agent.
  - First cycle after FirstCheckMinutes (baseline/tooling check, NO notify), then every
    CycleMinutes. Each cycle = one `reasonix run` session executing the cop prompt with
    the SAME per-agent layout as the tracks: unique external --dir, both add-dirs, the
    fleet-wide worker model, --permission-mode yolo.
  - The cop session's command line contains "bottleneck-cop-prompt.md", NOT
    LAUNCH-PROMPT.md, so guard.ps1 / wait-recover.ps1 never count or recover it.
  - Liveness poll every 60 s: when no LAUNCH-PROMPT.md instance has been alive for
    GonePolls consecutive polls, the fleet is done -> final sweep cycle + exit.
  - Never run from an orchestrator session; launch.bat starts it minimized.
.PARAMETER FleetDir
  Defaults to this script's dir (the fleet dir).
.PARAMETER FirstCheckMinutes
  Minutes until the first (baseline) audit cycle. Default 5.
.PARAMETER CycleMinutes
  Minutes between audit cycles. Default 60 (USER MANDATE: once per hour).
.PARAMETER MaxSteps
  Per-cycle session step budget. Default 200.
#>
param(
    [string]$FleetDir = "",
    [double]$FirstCheckMinutes = 5,
    [double]$CycleMinutes = 60,
    [int]$MaxSteps = 200
)
$ErrorActionPreference = "Continue"
if (-not $FleetDir) { $FleetDir = $PSScriptRoot }
# MEASURED DEFECT (2026-09-17, cop-cycle-2.log): launch.bat starts this script with
# `-FleetDir %~dp0`, and `%~dp0` ALWAYS ends with a backslash. The raw value was therefore
# interpolated into the cycle command as `--add-dir "C:\...\fleet\"` — the trailing `\"`
# escapes the closing quote, the whole rest of the command line collapses into ONE argument
# and the cop's session dies with:
#   error: resolve additional directory "C:\...\fleet\" --add-dir C:\... --model ... :
#   The filename, directory name, or volume label syntax is incorrect.
# (Join-Path tolerated the trailing separator, which is why only the raw interpolation broke.)
# Trim it here so the script is correct whatever the caller passes.
$FleetDir = $FleetDir.TrimEnd('\', '/')

$RepoRoot     = 'C:\luiscla27\projects\dndbeyond-printenhance'
$PrimaryModel  = 'anthropic-api-meta-ai/muse-spark-1.2-contributor'
$FallbackModel = 'deepseek-flash/deepseek-v4-flash'
$PoolSize     = 6
$Prompt       = Join-Path $FleetDir "bottleneck-cop-prompt.md"
$LogDir       = Join-Path $FleetDir "logs"
$CopStateDir  = Join-Path $FleetDir "runtime\cop"
# PER-PROJECT SCOPING (user-mandated 2026-08-15): only THIS fleet's tracks count as
# "the fleet" — other projects' fleets are invisible (guard/watchdog semantics).
$Pattern      = Join-Path $FleetDir "tracks\track-"
$GonePolls    = 3          # consecutive 60s polls with zero tracks => fleet done
$PollSeconds  = 60

# External per-track session root (same layout launch.bat uses for tracks).
$fleetName = Split-Path -Leaf $FleetDir
$wsRoot = Join-Path $env:USERPROFILE ("reasonix-fleet-workspaces\" + $fleetName)
$sessionDir = Join-Path $wsRoot "cop"
if (-not (Test-Path $sessionDir)) { New-Item -ItemType Directory -Path $sessionDir -Force | Out-Null }
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
if (-not (Test-Path $CopStateDir)) { New-Item -ItemType Directory -Path $CopStateDir -Force | Out-Null }

$CopFbMarker = Join-Path $CopStateDir "model_fallback.json"
$modelArg = $(if ($PrimaryModel) { "--model $PrimaryModel" } else { "" })

function Get-TrackCount {
    @(Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='reasonix.exe'" |
        Where-Object { $_.CommandLine -and ($_.CommandLine -like "*$Pattern*") }).Count
}

function Run-Cycle([int]$cycle, [string]$kind) {
    $task = "Execute the file $Prompt as your complete task. This is cycle $cycle ($kind). Read it fully and follow every instruction exactly, including the audit, Muse-challenge, no-interference, and Telegram-notify rules."
    $log = Join-Path $LogDir "cop-cycle-$cycle.log"
    # MODEL FALLBACK (user mandate 2026-08-16): re-resolve the model EVERY cycle so a
    # marker written by a previous cop session takes effect without a cop-script restart.
    $cycleModel = $(if ((Test-Path $CopFbMarker) -and $FallbackModel) { $FallbackModel } else { $PrimaryModel })
    $cycleModelArg = $(if ($cycleModel) { "--model $cycleModel" } else { "" })
    $cmd = "reasonix run --dir `"$sessionDir`" --add-dir `"$FleetDir`" --add-dir `"$RepoRoot`" $cycleModelArg --permission-mode yolo --max-steps $MaxSteps `"$task`" 1>$log 2>&1"
    Write-Host ("[cop] {0} starting cycle {1} ({2}) on model {3}" -f (Get-Date -Format o), $cycle, $kind, $(if ($cycleModel) { $cycleModel } else { "(default)" }))
    Start-Process -FilePath "cmd.exe" -ArgumentList '/c', $cmd -WindowStyle Minimized -Wait | Out-Null
    Write-Host ("[cop] {0} cycle {1} finished (log: {2})" -f (Get-Date -Format o), $cycle, $log)
}

# ---------- main loop ----------
Write-Host ("[cop] bottlenecks cop up. Fleet: {0} | model: {1} | fallback: {2} | cycle: every {3} min | first check: {4} min" -f $FleetDir, $(if ($PrimaryModel) { $PrimaryModel } else { "(default)" }), $(if ($FallbackModel) { $FallbackModel } else { "(none)" }), $CycleMinutes, $FirstCheckMinutes)

$cycle = 0
# First cycle fires at FirstCheckMinutes: lastCycle is set so that
# (now - lastCycle) reaches CycleMinutes exactly FirstCheckMinutes after boot.
$lastCycle = [DateTime]::UtcNow.AddMinutes($FirstCheckMinutes - $CycleMinutes)
$gone = 0

while ($true) {
    Start-Sleep -Seconds $PollSeconds
    $tracks = Get-TrackCount

    if ($tracks -eq 0) {
        $gone++
        if ($gone -ge $GonePolls) {
            Write-Host ("[cop] {0} fleet drained (no tracks for {1} polls). Final cycle + exit." -f (Get-Date -Format o), $gone)
            $cycle++
            Run-Cycle $cycle "final"
            exit 0
        }
    } else {
        $gone = 0
        if (([DateTime]::UtcNow - $lastCycle).TotalMinutes -ge $CycleMinutes) {
            $cycle++
            Run-Cycle $cycle "hourly"
            $lastCycle = [DateTime]::UtcNow
        }
    }
}
