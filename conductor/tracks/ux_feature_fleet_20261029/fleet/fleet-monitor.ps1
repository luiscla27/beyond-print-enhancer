<#
.SYNOPSIS
  Live console monitor for THIS fleet (self-contained; correct for up to 100 tracks).

.DESCRIPTION
  Two side-by-side tables (EACH 40% of the console width) + a two-column summary footer.
  Reads manifests (authoritative totals) and the runtime (heartbeats, progress, deferrals,
  locks, staged docs/workfiles, live processes) and renders per-track: ID, STATUS(icon), PENDING,
  DONE, DEFERRED, LOCKS, DOCS, WORKFILES, CPU%, BATCH.

  HYBRID renderer (user mandate 2026-08-18): IN-PLACE diff when the whole frame
  fits in the console window (smooth, no flicker); FULL REDRAW every tick only
  when the fleet exceeds the window height (scrolling would desync cursor-positioned
  diffs — the full redraw resets the view to the top, keeping the data correct).

  BOTH tables carry the column HEADER. Every numeric cell is colored per-value: ZERO = DarkGray,
  non-zero = ranked per column (Green top -> Yellow -> Blue -> Red lowest).

  READ-ONLY: never writes to the runtime, never kills, never touches the working tree.
  ASCII-only source; heartbeat icon emitted via [char]0x2665 / [char]0x2661.

.PARAMETER RefreshSeconds
  Poll interval in seconds (default 1).

.PARAMETER Snapshot
  Print one snapshot and exit.

.PARAMETER StallThresholdSeconds
  Heartbeat age that marks a track STALLED (default 360).
#>
[CmdletBinding()]
param(
    [double]$RefreshSeconds = 2.0,
    [switch]$Snapshot,
    [int]$StallThresholdSeconds = 360
)

$here      = Split-Path -Parent $MyInvocation.MyCommand.Path
$TrackRoot = Join-Path $here "tracks"
$Runtime   = Join-Path $here "runtime"

$HEART_ON  = [char]0x2665
$HEART_OFF = [char]0x2661

function Read-JsonFile([string]$path) {
    if (-not (Test-Path $path)) { return $null }
    try { return Get-Content -Raw -Encoding UTF8 $path | ConvertFrom-Json } catch { return $null }
}
function Count-Lines([string]$path) {
    if (-not (Test-Path $path)) { return 0 }
    return @(Get-Content $path -ErrorAction SilentlyContinue | Where-Object { $_.Trim() }).Count
}

$tracks = @()
foreach ($dir in @(Get-ChildItem -Path $TrackRoot -Directory -ErrorAction SilentlyContinue | Sort-Object Name)) {
    $m = Read-JsonFile (Join-Path $dir.FullName "manifest.json")
    if ($m) { $tracks += [pscustomobject]@{ Id = $dir.Name; Total = [int]$m.code_count } }
}
if ($tracks.Count -eq 0) {
    Write-Warning "No track manifests under '$TrackRoot'. Scaffold the fleet first."
    exit 1
}

$cpuState = @{}
$script:prevFrame = $null
$script:prevWidth = 0

try { [Console]::CursorVisible = $false } catch {}

try {
while ($true) {
    $nowUtc = [DateTime]::UtcNow
    $epochNow = [long][DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

    $locksByTrack = @{}
    if (Test-Path (Join-Path $Runtime "locks")) {
        foreach ($lf in @(Get-ChildItem (Join-Path $Runtime "locks\*.lock") -ErrorAction SilentlyContinue)) {
            $lk = Read-JsonFile $lf.FullName
            if ($lk -and $lk.owner_track) { $locksByTrack[$lk.owner_track] = 1 + ($locksByTrack[$lk.owner_track] -as [int]) }
        }
    }
    $docsByTrack = @{}; $workByTrack = @{}
    if (Test-Path (Join-Path $Runtime "out")) {
        foreach ($f in @(Get-ChildItem (Join-Path $Runtime "out") -Recurse -File -ErrorAction SilentlyContinue)) {
            if ($f.FullName -match '\\out\\(track-\d+)\\') {
                $tid = $matches[1]
                if ($f.Extension -eq '.md') { $docsByTrack[$tid] = 1 + ($docsByTrack[$tid] -as [int]) }
                else { $workByTrack[$tid] = 1 + ($workByTrack[$tid] -as [int]) }
            }
        }
    }
    $procByTrack = @{}
    foreach ($p in @(Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='reasonix.exe'" -ErrorAction SilentlyContinue)) {
        if ($p.CommandLine -and ($p.CommandLine -match 'track-(\d+)')) {
            $tid = "track-$($matches[1])"
            $procByTrack[$tid] = 1 + ($procByTrack[$tid] -as [int])
        }
    }

    $rows = @()
    $doneSum = 0; $totalSum = 0; $lockSum = 0; $docSum = 0; $workSum = 0; $deferredSum = 0

    foreach ($t in $tracks) {
        $hb = Read-JsonFile (Join-Path $Runtime "heartbeats\$($t.Id).json")
        $done = Count-Lines (Join-Path $Runtime "progress\$($t.Id).jsonl")
        $deferred = Count-Lines (Join-Path $Runtime "deferrals\$($t.Id).jsonl")
        $locks = ($locksByTrack[$t.Id] -as [int]); if (-not $locks) { $locks = 0 }
        $docs  = ($docsByTrack[$t.Id] -as [int]);  if (-not $docs)  { $docs = 0 }
        $workfiles = ($workByTrack[$t.Id] -as [int]); if (-not $workfiles) { $workfiles = 0 }
        $procs = ($procByTrack[$t.Id] -as [int]);  if (-not $procs) { $procs = 0 }

        $status = "NOT-START"
        $hbFresh = $false
        if ($hb -and $hb.last_seen_epoch) {
            $hbFresh = (($epochNow - [long]$hb.last_seen_epoch) -lt $StallThresholdSeconds)
        }
        if ($t.Total -gt 0 -and $done -ge $t.Total) { $status = "DONE" }
        elseif ($hbFresh) { $status = ([string]$hb.status).ToUpper() }
        elseif ($procs -gt 0) { $status = "ACTIVE" }
        elseif ($hb) { $status = "STALLED" }

        $icon = if ($hbFresh) { $HEART_ON } else { $HEART_OFF }

        $cpu = 0.0
        $ticks = 0.0
        foreach ($p in @(Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='reasonix.exe'" -ErrorAction SilentlyContinue)) {
            if ($p.CommandLine -and ($p.CommandLine -match [regex]::Escape($t.Id))) {
                $pr = Get-Process -Id $p.ProcessId -ErrorAction SilentlyContinue
                if ($pr) { $ticks += $pr.TotalProcessorTime.TotalSeconds }
            }
        }
        $key = $t.Id
        if ($cpuState.ContainsKey($key)) {
            $prev = $cpuState[$key]
            $dt = ($nowUtc - $prev[1]).TotalSeconds
            if ($dt -gt 0) { $cpu = [math]::Min(999, [math]::Round((($ticks - $prev[0]) / $dt) * 100, 1)) }
        }
        $cpuState[$key] = @($ticks, $nowUtc)

        $batch = ""
        if ($hb -and $hb.current_batch) {
            $b = [string]$hb.current_batch
            if ($b.Length -gt 20) { $b = $b.Substring(0, 20) }
            $batch = $b
        }

        $doneEff = [math]::Min($done, $t.Total)  # clamp: progress LINES can exceed the manifest unit count (pair fleet) -> would push % past 100
        $doneSum += $doneEff; $totalSum += $t.Total; $lockSum += $locks; $docSum += $docs; $workSum += $workfiles; $deferredSum += $deferred
        $rows += [pscustomobject]@{
            Id=$t.Id; Status=$status; Icon=$icon; Pending=[math]::Max(0,$t.Total-$doneEff); Done=$doneEff;
            Deferred=$deferred; Locks=$locks; Docs=$docs; Workfiles=$workfiles; Cpu=$cpu; Batch=$batch
        }
    }

    # ---- width + per-column color ranks ----
    $width = 160
    try { $width = [Console]::WindowWidth } catch {}
    if ($width -lt 100) { $width = 160 }
    $tableW = [int]($width * 0.40)
    if ($tableW -lt 50) { $tableW = 50 }

    $wId = 9; $wStatus = 11; $wN = 4; $wDef = 3; $wLck = 3; $wWork = 9
    $wBatch = $tableW - (9 + 11 + 4 + 4 + 3 + 3 + 4 + 9 + 4 + 9)
    if ($wBatch -lt 6) { $wBatch = 6 }
    $rowWidth = 9 + 11 + 4 + 4 + 3 + 3 + 4 + 9 + 4 + $wBatch + 9

    $numCols = @("Pending","Done","Deferred","Locks","Docs","Workfiles")
    $colRank = @{}
    foreach ($col in $numCols) {
        $vals = @($rows | ForEach-Object { $_.$col } | Where-Object { $_ -gt 0 } | Sort-Object -Descending -Unique)
        $rk = @{}
        for ($i = 0; $i -lt $vals.Count; $i++) {
            $c = switch ($i) { 0 { "Green" } 1 { "Yellow" } 2 { "Blue" } default { "Red" } }
            $rk[[string]$vals[$i]] = $c
        }
        $colRank[$col] = $rk
    }

    function Status-Color([string]$s) {
        switch -Regex ($s) {
            "^DONE"      { "Green" }
            "^WORKING"   { "Cyan" }
            "^ACTIVE"    { "Cyan" }
            "^REVIEW"    { "Magenta" }
            "^DEFERR"    { "Yellow" }
            "^BLOCK"     { "Red" }
            "^STALLED"   { "Red" }
            "^NOT-START" { "DarkGray" }
            "^BOOTING"   { "DarkYellow" }
            default      { "Gray" }
        }
    }
    function Summary-Color([string]$s) {
        # DISTINCT color per status classification (the summary must paint each differently)
        switch -Regex ($s) {
            "^DONE"      { "Green" }
            "^WORKING"   { "Cyan" }
            "^ACTIVE"    { "Blue" }
            "^REVIEW"    { "Magenta" }
            "^DEFERR"    { "Yellow" }
            "^BLOCK"     { "Red" }
            "^STALLED"   { "DarkRed" }
            "^NOT-START" { "DarkGray" }
            "^BOOTING"   { "DarkYellow" }
            default      { "Gray" }
        }
    }
    function Num-Color([string]$col, $val) {
        if ($val -le 0) { return "DarkGray" }
        $rk = $colRank[$col]
        $c = $rk[[string]$val]
        if ($c) { return $c }
        return "White"
    }
    function Pad([string]$text, [int]$w, [bool]$right) {
        $t = $text
        if ($t.Length -gt $w) { $t = $t.Substring(0, $w) }
        if ($right) { return $t.PadLeft($w) }
        return $t.PadRight($w)
    }
    function New-Seg([string]$t, $c) { @{ T = $t; C = $c } }

    # ---- build the frame (list of lines; each line = list of @{T;C} segments) ----
    $frame = [System.Collections.Generic.List[object]]::new()

    function Add-Row-Segs([System.Collections.Generic.List[object]]$line, $r) {
        $line.Add((New-Seg (Pad $r.Id $wId $false) "Cyan"))
        $line.Add((New-Seg " " $null))
        $line.Add((New-Seg (Pad ($r.Status + $r.Icon) $wStatus $false) (Status-Color $r.Status)))
        $line.Add((New-Seg " " $null))
        $line.Add((New-Seg (Pad $r.Pending $wN $true) (Num-Color "Pending" $r.Pending)))
        $line.Add((New-Seg " " $null))
        $line.Add((New-Seg (Pad $r.Done $wN $true) (Num-Color "Done" $r.Done)))
        $line.Add((New-Seg " " $null))
        $line.Add((New-Seg (Pad $r.Deferred $wDef $true) (Num-Color "Deferred" $r.Deferred)))
        $line.Add((New-Seg " " $null))
        $line.Add((New-Seg (Pad $r.Locks $wLck $true) (Num-Color "Locks" $r.Locks)))
        $line.Add((New-Seg " " $null))
        $line.Add((New-Seg (Pad $r.Docs $wN $true) (Num-Color "Docs" $r.Docs)))
        $line.Add((New-Seg " " $null))
        $line.Add((New-Seg (Pad $r.Workfiles $wWork $true) (Num-Color "Workfiles" $r.Workfiles)))
        $line.Add((New-Seg " " $null))
        $line.Add((New-Seg (Pad $r.Cpu $wN $true) $(if ($r.Cpu -le 0) { "DarkGray" } else { "White" })))
        $line.Add((New-Seg " " $null))
        $line.Add((New-Seg (Pad $r.Batch $wBatch $false) "DarkGray"))
    }
    function Add-Header-Segs([System.Collections.Generic.List[object]]$line) {
        $line.Add((New-Seg (Pad "Track" $wId $false) "Cyan"))
        $line.Add((New-Seg " " $null))
        $line.Add((New-Seg (Pad "Status" $wStatus $false) "Cyan"))
        $line.Add((New-Seg " " $null))
        $line.Add((New-Seg (Pad "PEND" $wN $true) "Cyan"))
        $line.Add((New-Seg " " $null))
        $line.Add((New-Seg (Pad "DONE" $wN $true) "Cyan"))
        $line.Add((New-Seg " " $null))
        $line.Add((New-Seg (Pad "DEF" $wDef $true) "Cyan"))
        $line.Add((New-Seg " " $null))
        $line.Add((New-Seg (Pad "LCK" $wLck $true) "Cyan"))
        $line.Add((New-Seg " " $null))
        $line.Add((New-Seg (Pad "DOCS" $wN $true) "Cyan"))
        $line.Add((New-Seg " " $null))
        $line.Add((New-Seg (Pad "WORKFILES" $wWork $true) "Cyan"))
        $line.Add((New-Seg " " $null))
        $line.Add((New-Seg (Pad "CPU%" $wN $true) "Cyan"))
        $line.Add((New-Seg " " $null))
        $line.Add((New-Seg (Pad "BATCH" $wBatch $false) "Cyan"))
    }

    $half = [math]::Ceiling($rows.Count / 2)
    $leftRows  = @($rows[0..([math]::Max(0, $half - 1))])
    $rightRows = @()
    if ($rows.Count -gt $half) { $rightRows = @($rows[$half..($rows.Count - 1)]) }

    # header
    $line = [System.Collections.Generic.List[object]]::new()
    Add-Header-Segs $line
    $line.Add((New-Seg "  |  " "DarkGray"))
    Add-Header-Segs $line
    $frame.Add($line)
    # separator
    $line = [System.Collections.Generic.List[object]]::new()
    $line.Add((New-Seg ("-" * $rowWidth) "DarkGray"))
    $line.Add((New-Seg "  |  " "DarkGray"))
    $line.Add((New-Seg ("-" * $rowWidth) "DarkGray"))
    $frame.Add($line)
    # data rows
    $n = [math]::Max($leftRows.Count, $rightRows.Count)
    for ($i = 0; $i -lt $n; $i++) {
        $line = [System.Collections.Generic.List[object]]::new()
        if ($i -lt $leftRows.Count) { Add-Row-Segs $line $leftRows[$i] } else { $line.Add((New-Seg (" " * $rowWidth) $null)) }
        $line.Add((New-Seg "  |  " "DarkGray"))
        if ($i -lt $rightRows.Count) { Add-Row-Segs $line $rightRows[$i] }
        $frame.Add($line)
    }
    # footer separator
    $line = [System.Collections.Generic.List[object]]::new()
    $line.Add((New-Seg ("-" * ($rowWidth * 2 + 5)) "DarkGray"))
    $frame.Add($line)
    # footer summary: per-status counts (each in a DISTINCT color) + progress %
    $statusCounts = @{}
    foreach ($r in $rows) { $statusCounts[$r.Status] = 1 + ($statusCounts[$r.Status] -as [int]) }
    $progress = 0.0
    if ($totalSum -gt 0) { $progress = [math]::Round([math]::Min(100.0, ($doneSum / $totalSum) * 100), 1) }  # never >100%
    $line = [System.Collections.Generic.List[object]]::new()
    $line.Add((New-Seg ("FLEET {0,-4}" -f $tracks.Count) "Cyan"))
    $line.Add((New-Seg " | " "DarkGray"))
    $order = @("DONE","WORKING","ACTIVE","STALLED","NOT-START")
    $seen = @{}
    foreach ($st in $order) {
        $cnt = $statusCounts[$st] -as [int]; if (-not $cnt) { $cnt = 0 }
        $line.Add((New-Seg ("{0} {1}" -f $st, $cnt) (Summary-Color $st)))
        $line.Add((New-Seg " | " "DarkGray"))
        $seen[$st] = $true
    }
    foreach ($k in $statusCounts.Keys) {
        if ($seen.ContainsKey($k)) { continue }
        $line.Add((New-Seg ("{0} {1}" -f $k, ([int]$statusCounts[$k])) (Summary-Color $k)))
        $line.Add((New-Seg " | " "DarkGray"))
    }
    $line.Add((New-Seg ("progress {0}%" -f $progress) "White"))
    $frame.Add($line)
    # footer legend
    $line = [System.Collections.Generic.List[object]]::new()
    $line.Add((New-Seg ("legend: {0} = heartbeat fresh, {1} = none" -f $HEART_ON, $HEART_OFF) "DarkGray"))
    $frame.Add($line)

    # ---- render the frame (HYBRID: in-place diff when it fits the window; full
    #      redraw only when the fleet exceeds the screen height) ----
    # User mandate 2026-08-18: prefer IN-PLACE (smooth, no flicker) whenever the
    # whole frame fits in the console window. When the fleet is taller than the
    # window, the user must scroll — in-place SetCursorPosition diffs would desync
    # (buffer row N is no longer the Nth visible row), so switch to a full
    # Clear-Host + redraw each tick (view resets to the top; data stays correct).
    $maxWidth = $rowWidth * 2 + 5

    function Line-Sig([System.Collections.Generic.List[object]]$line) {
        $parts = @()
        foreach ($seg in $line) { $parts += ($seg.T + '|' + [string]$seg.C) }
        return ($parts -join ';')
    }
    function Draw-Line([System.Collections.Generic.List[object]]$line, [int]$mw) {
        $len = 0
        foreach ($seg in $line) {
            if ($seg.C) { Write-Host $seg.T -NoNewline -ForegroundColor $seg.C }
            else { Write-Host $seg.T -NoNewline }
            $len += $seg.T.Length
        }
        if ($len -lt $mw) { Write-Host (" " * ($mw - $len)) -NoNewline }
    }
    function Get-MaxRow {
        try { return [Console]::BufferHeight - 1 } catch { return -1 }
    }
    function Set-CursorRow([int]$row) {
        if ($script:maxRow -lt 0) { return }
        if ($row -gt $script:maxRow) { return }
        try { [Console]::SetCursorPosition(0, [math]::Max(0, $row)) } catch {}
    }

    $script:maxRow = Get-MaxRow
    $winH = -1
    try { $winH = [Console]::WindowHeight } catch {}

    if ($winH -lt 0 -or $frame.Count -gt $winH) {
        # FLEET EXCEEDS THE SCREEN (or output is redirected): full redraw every tick.
        $script:prevFrame = $null   # a later in-place phase starts with a full draw
        try { Clear-Host } catch {}
        foreach ($ln in $frame) { Draw-Line $ln $maxWidth; Write-Host "" }
    }
    else {
        # FITS THE SCREEN: in-place diff (no flicker). First tick draws all; later
        # ticks rewrite only changed rows within the visible area.
        if ($null -eq $script:prevFrame) {
            try { Clear-Host } catch {}
            foreach ($ln in $frame) { Draw-Line $ln $maxWidth; Write-Host "" }
        }
        else {
            $maxLines = [math]::Max($frame.Count, $script:prevFrame.Count)
            for ($i = 0; $i -lt $maxLines; $i++) {
                $curr = if ($i -lt $frame.Count) { $frame[$i] } else { $null }
                $prev = if ($i -lt $script:prevFrame.Count) { $script:prevFrame[$i] } else { $null }
                $currSig = if ($curr) { Line-Sig $curr } else { "" }
                $prevSig = if ($prev) { Line-Sig $prev } else { "" }
                # always redraw the header (0) and separator (1); otherwise only changed lines
                if ($i -lt 2 -or $currSig -ne $prevSig) {
                    if ($script:maxRow -lt 0 -or $i -le $script:maxRow) {
                        Set-CursorRow $i
                        if ($curr) { Draw-Line $curr $maxWidth } else { Write-Host (" " * $maxWidth) -NoNewline }
                    }
                }
            }
            # park the cursor just below the frame so the shell prompt doesn't overwrite it
            if ($script:maxRow -ge 0) {
                Set-CursorRow ([math]::Min($maxLines, $script:maxRow))
            }
        }
        $script:prevFrame = $frame
    }

    if ($Snapshot) { break }
    Start-Sleep -Seconds $RefreshSeconds
}
}
finally {
    try { [Console]::CursorVisible = $true } catch {}
}
