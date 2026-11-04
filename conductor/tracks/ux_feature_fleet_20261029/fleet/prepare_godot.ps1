<#
.SYNOPSIS
  Build a per-track Godot SHADOW project: junctions to the real project tree (zero
  data duplication) + a PRIVATE .godot + a renamed project (private app_userdata).

.DESCRIPTION
  Fleet tracks must NOT run Godot against the shared project tree concurrently:
  workers race on GodotTest\.godot (uid_cache.bin, global_script_class_cache.cfg,
  imported/) and image-name taskkills (taskkill /F /IM Godot*) take out SIBLING
  tracks' captures (verified 2026-08-15 on the proc_* fleet). Each track therefore
  runs ALL Godot invocations (import, headless gates, windowed captures) against
  its OWN shadow project at <WsRoot>\<Track>\godot:

    - Every top-level dir of the real project is a JUNCTION (same files, no copy);
      every top-level file is a HARDLINK (same volume). Writes through the shadow
      land in the real tree — publishing semantics are unchanged.
    - project.godot is copied and its config/name is suffixed with the track id, so
      app_userdata + user:// logs are per-track.
    - .godot is PRIVATE per track. Default: COPY the shared .godot (5.3 GB, fast,
      no re-import; the shadow is immediately usable). Opt out with -FreshGodot
      (fresh import: ~4-5 min + ~5 GB CPU-bound per track — only when copying is
      impossible).

.PARAMETER Track
  Track id, e.g. "track-04". MUST be unique per track (it names the shadow dir and
  the project app_userdata).

.PARAMETER WsRoot
  External session root — the same root the launcher uses for worker --dirs
  (%USERPROFILE%\reasonix-fleet-workspaces\<fleet>). The shadow lands at
  <WsRoot>\<Track>\godot.

.PARAMETER GodotTest
  The real shared project (the dir containing project.godot).

.PARAMETER FreshGodot
  Opt into a fresh .godot + one-time import instead of copying the shared cache.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File prepare_godot.ps1 `
      -Track track-04 -WsRoot "$env:USERPROFILE\reasonix-fleet-workspaces\my_fleet" `
      -GodotTest C:\repo\GodotTest
  -> prints <user-profile>\reasonix-fleet-workspaces\my_fleet\track-04\godot
#>
param(
    [Parameter(Mandatory = $true)][string]$Track,
    [Parameter(Mandatory = $true)][string]$WsRoot,
    [Parameter(Mandatory = $true)][string]$GodotTest,
    [switch]$FreshGodot
)
$ErrorActionPreference = "Stop"

if (-not (Test-Path $GodotTest)) { Write-Error "GodotTest not found: $GodotTest"; exit 1 }
if (-not (Test-Path (Join-Path $GodotTest "project.godot"))) { Write-Error "No project.godot under $GodotTest"; exit 1 }

$shadow = Join-Path $WsRoot "$Track\godot"
if (Test-Path $shadow) { Remove-Item -Recurse -Force $shadow }
New-Item -ItemType Directory -Path $shadow | Out-Null

# 1) project.godot: copy + per-track config/name (isolates app_userdata + user:// logs)
$projPath = Join-Path $GodotTest "project.godot"
$proj = Get-Content $projPath -Raw -Encoding UTF8
$base = "GodotFleetProject"
if ($proj -match 'config/name\s*=\s*"([^"]+)"') { $base = $Matches[1] }
$proj = $proj -replace 'config/name\s*=\s*"[^"]*"', ('config/name="' + $base + ' ' + $Track + '"')
[System.IO.File]::WriteAllText((Join-Path $shadow "project.godot"), $proj)

# 2) junction every dir + hardlink every file except .godot / project.godot
Get-ChildItem $GodotTest | ForEach-Object {
    if ($_.Name -eq ".godot" -or $_.Name -eq "project.godot") { return }
    if ($_.PSIsContainer) {
        New-Item -ItemType Junction -Path (Join-Path $shadow $_.Name) -Value $_.FullName | Out-Null
    } else {
        New-Item -ItemType HardLink -Path (Join-Path $shadow $_.Name) -Target $_.FullName | Out-Null
    }
}

# 3) .godot: private per track (copy the shared cache by default; fresh otherwise)
$shadowGodot = Join-Path $shadow ".godot"
if ($FreshGodot) {
    New-Item -ItemType Directory -Path $shadowGodot | Out-Null
} else {
    $srcGodot = Join-Path $GodotTest ".godot"
    if (Test-Path $srcGodot) {
        Copy-Item $srcGodot $shadowGodot -Recurse -Force
    } else {
        New-Item -ItemType Directory -Path $shadowGodot | Out-Null
    }
}

Write-Output $shadow
