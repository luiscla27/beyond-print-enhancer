param(
    [string]$Pattern = ""
)
# Count live reasonix/node processes whose command line contains the launch pattern.
# Used by launch.bat's double-launch guard (prevents starting a second fleet over one runtime).
#
# PER-PROJECT SCOPING (user-mandated 2026-08-15): the default pattern is THIS fleet's
# own tracks path (<fleet>\tracks\track-), derived from this script's location — never
# the global "LAUNCH-PROMPT.md". A fleet in another project therefore does NOT block
# (or get counted by) this fleet, and vice versa. Callers may pass -Pattern explicitly
# (launch.bat/restart.bat pass the same per-fleet path).
if (-not $Pattern) { $Pattern = Join-Path $PSScriptRoot "tracks\track-" }
$count = @(
    Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='reasonix.exe'" |
        Where-Object { $_.CommandLine -and ($_.CommandLine -like "*$Pattern*") }
).Count
Write-Output $count
