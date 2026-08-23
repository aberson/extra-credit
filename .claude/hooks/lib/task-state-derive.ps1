# task-state-derive.ps1 -- shared library for per-session task-state files + the
# DERIVED current.md rollup (the current.md write-race fix, CMR plan).
# Dot-source it:  . "$PSScriptRoot/lib/task-state-derive.ps1"
#
# ASCII-only on purpose: PS 5.1 reads a no-BOM .ps1 as ANSI and mangles non-ASCII
# (keep every string/comment ASCII, use '--' not an em-dash). No ternary and no
# Set-StrictMode -- match the existing hooks' style and dodge PS 5.1 surprises.
#
# Model (see .claude/references/task-state-schema.md, the contract owner):
#   Each session writes ONLY sessions/<session-id>.md (sole owner -> zero
#   contention). current.md becomes a DERIVED rollup = the freshest session's
#   content WHOLESALE + a one-line listing of the other active sessions. No
#   cross-task history union (concurrent windows are different tasks). current.md
#   is a pure function of the session files, so a lost/raced write to it loses
#   nothing -- the next Write-DerivedRollup reproduces it.

# One source of truth for the schema's section headings (ASCII prefixes). The
# schema template's "Dead Ends -- Do Not Retry" heading is matched by the
# "Dead Ends" prefix so this file stays ASCII-only. task-state-derive.tests.ps1
# asserts this set covers every "## <heading>" in the schema doc's File-format
# template (the one-source-of-truth guard: re-duplication fails the test).
$script:TaskStateSectionPrefixes = @(
    'Completed',
    'WIP',
    'Dead Ends',
    'Critical Gotchas',
    'Key Files',
    'Parked',
    'Next Action',
    'Compaction Marker'
)

function Get-TaskStateSectionPrefixes {
    return $script:TaskStateSectionPrefixes
}

function Get-TaskStateSessionsDir {
    param([Parameter(Mandatory = $true)][string]$GitRoot)
    return (Join-Path $GitRoot '.claude/task-state/sessions')
}

function Get-SessionStatePath {
    param(
        [Parameter(Mandatory = $true)][string]$SessionId,
        [Parameter(Mandatory = $true)][string]$GitRoot
    )
    return (Join-Path (Get-TaskStateSessionsDir $GitRoot) ('{0}.md' -f $SessionId))
}

function Get-TaskStateField {
    # Return the value of a "**<Name>:** <value>" line, or $null if absent.
    param([string[]]$Lines, [string]$Name)
    $rx = '^\*\*' + [regex]::Escape($Name) + ':\*\*\s*(.+?)\s*$'
    foreach ($l in $Lines) {
        $m = [regex]::Match($l, $rx)
        if ($m.Success) { return $m.Groups[1].Value.Trim() }
    }
    return $null
}

function Read-SessionState {
    # Parse a task-state markdown file into a PSCustomObject, or return $null
    # when the file is missing/unreadable/empty or lacks the minimal required
    # fields (Task + Last written). FAIL-CLOSED: any parse ambiguity -> $null.
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    try {
        $raw = [System.IO.File]::ReadAllText($Path)
    } catch {
        return $null
    }
    if ([string]::IsNullOrWhiteSpace($raw)) { return $null }

    # Split on LF; trailing CR on CRLF files is absorbed by the regex \s* anchors.
    $lines = $raw -split "`n"

    $task    = Get-TaskStateField $lines 'Task'
    $status  = Get-TaskStateField $lines 'Status'
    $sha     = Get-TaskStateField $lines 'Session SHA'
    $written = Get-TaskStateField $lines 'Last written'

    # Minimal required fields for a valid session state.
    if ([string]::IsNullOrWhiteSpace($task) -or [string]::IsNullOrWhiteSpace($written)) {
        return $null
    }

    try {
        $mtimeUtc = (Get-Item -LiteralPath $Path).LastWriteTimeUtc
    } catch {
        $mtimeUtc = [System.DateTime]::MinValue
    }

    # Parse Last written as UTC ISO-8601. Unparseable -> fall back to file mtime
    # so a malformed timestamp never crashes ranking; flag that it was a fallback.
    $writtenUtc = [System.DateTime]::MinValue
    $tsFallback = $false
    $styles = [System.Globalization.DateTimeStyles]::AssumeUniversal -bor `
              [System.Globalization.DateTimeStyles]::AdjustToUniversal
    if (-not [System.DateTime]::TryParse($written,
            [System.Globalization.CultureInfo]::InvariantCulture, $styles, [ref]$writtenUtc)) {
        $writtenUtc = $mtimeUtc
        $tsFallback = $true
    }

    return [pscustomobject]@{
        Path              = $Path
        Task              = $task
        Status            = $status
        SessionSHA        = $sha
        LastWritten       = $written
        LastWrittenUtc    = $writtenUtc
        TimestampFallback = $tsFallback
        MTimeUtc          = $mtimeUtc
        Raw               = $raw
    }
}

function Get-SessionStates {
    # All parseable session states under sessions/ (non-recursive, so the
    # archive/ subdir is excluded), newest-first: LastWrittenUtc desc, with file
    # mtime as the tiebreak on equal timestamps.
    param([Parameter(Mandatory = $true)][string]$GitRoot)
    $dir = Get-TaskStateSessionsDir $GitRoot
    if (-not (Test-Path -LiteralPath $dir -PathType Container)) { return @() }
    $states = @()
    foreach ($f in (Get-ChildItem -LiteralPath $dir -Filter '*.md' -File -ErrorAction SilentlyContinue)) {
        $s = Read-SessionState $f.FullName
        if ($null -ne $s) { $states += $s }
    }
    return @($states | Sort-Object -Property `
        @{ Expression = 'LastWrittenUtc'; Descending = $true }, `
        @{ Expression = 'MTimeUtc';       Descending = $true })
}

function Get-HookSessionId {
    # Resolve the current session UUID from a Claude Code hook's stdin JSON
    # payload: the `session_id` field, or the basename of `transcript_path`
    # (which is `<session_id>.jsonl`). Returns $null when unresolvable.
    param([string]$StdinJson)
    if ([string]::IsNullOrWhiteSpace($StdinJson)) { return $null }
    try { $p = $StdinJson | ConvertFrom-Json } catch { return $null }
    if ($null -eq $p) { return $null }
    if ($p.PSObject.Properties['session_id'] -and $p.session_id) {
        return ([string]$p.session_id).Trim()
    }
    if ($p.PSObject.Properties['transcript_path'] -and $p.transcript_path) {
        return [System.IO.Path]::GetFileNameWithoutExtension([string]$p.transcript_path)
    }
    return $null
}

function Resolve-ActiveSessionStatePath {
    # The PATH a hook should READ for THIS session's orientation:
    #   this session's own sessions/<id>.md if present -> else the freshest
    #   session file -> else the current.md rollup -> else $null. Reading the
    #   session's OWN file (not the shared rollup) means a concurrent window's
    #   checkpoint never surfaces as this session's state.
    param(
        [Parameter(Mandatory = $true)][string]$GitRoot,
        [string]$SessionId
    )
    if (-not [string]::IsNullOrWhiteSpace($SessionId)) {
        $own = Get-SessionStatePath $SessionId $GitRoot
        if (Test-Path -LiteralPath $own -PathType Leaf) { return $own }
    }
    $states = @(Get-SessionStates $GitRoot)
    if ($states.Count -gt 0) { return $states[0].Path }
    $cur = Join-Path $GitRoot '.claude/task-state/current.md'
    if (Test-Path -LiteralPath $cur -PathType Leaf) { return $cur }
    return $null
}

function Get-DerivedRollup {
    # Render the current.md rollup text: a DERIVED header + the freshest session's
    # content WHOLESALE + a one-line listing of the other active sessions. Returns
    # $null when no parseable session file exists (caller decides whether to leave
    # current.md untouched).
    param([Parameter(Mandatory = $true)][string]$GitRoot)

    $states = @(Get-SessionStates $GitRoot)
    if ($states.Count -eq 0) { return $null }

    $freshest = $states[0]
    $others   = @($states | Select-Object -Skip 1)

    $freshId = [System.IO.Path]::GetFileNameWithoutExtension($freshest.Path)
    $header  = @(
        '<!-- DERIVED by task-state-derive.ps1 from .claude/task-state/sessions/*.md -- DO NOT EDIT BY HAND. -->',
        ('<!-- Freshest session: {0} (Last written {1}). {2} other active session(s). -->' -f `
            $freshId, $freshest.LastWritten, $others.Count)
    ) -join "`n"

    $body = $freshest.Raw.TrimEnd()

    $listing = ''
    if ($others.Count -gt 0) {
        $rows = @()
        foreach ($o in $others) {
            $id = [System.IO.Path]::GetFileNameWithoutExtension($o.Path)
            if ([string]::IsNullOrWhiteSpace($o.Status)) { $st = 'unknown' } else { $st = $o.Status }
            $rows += ('- `{0}` | {1} | {2} (last written {3})' -f $id, $o.Task, $st, $o.LastWritten)
        }
        $listing = "`n`n## Other active sessions (derived; not merged)`n" + ($rows -join "`n")
    }

    return ($header + "`n`n" + $body + $listing + "`n")
}

function Write-DerivedRollup {
    # Regenerate current.md from the session files. Idempotent + regenerable: a
    # lost/raced write here loses nothing (the next call reproduces it). Returns
    # the path written, or $null when there were no session files.
    param([Parameter(Mandatory = $true)][string]$GitRoot)
    $text = Get-DerivedRollup $GitRoot
    if ($null -eq $text) { return $null }
    $target = Join-Path $GitRoot '.claude/task-state/current.md'
    $enc = New-Object System.Text.UTF8Encoding($false)
    # Write to a temp sibling, then atomically move over current.md: a reader
    # never sees a half-written file, and a concurrent writer at most makes this
    # call a harmless no-op (current.md is regenerable -- a lost/raced write
    # loses nothing). NEVER throw: the hooks that call this are fail-open.
    $tmp = $target + '.tmp-' + [Guid]::NewGuid().ToString('N')
    try {
        [System.IO.File]::WriteAllText($tmp, $text, $enc)
        Move-Item -LiteralPath $tmp -Destination $target -Force -ErrorAction Stop
        return $target
    } catch {
        Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
        return $null
    }
}
