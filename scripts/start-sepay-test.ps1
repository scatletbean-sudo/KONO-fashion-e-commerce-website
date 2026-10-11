# Run from any directory. Never evaluates environment-file contents as code.
[CmdletBinding()]
param(
    [switch]$EnableAutoConfirm,
    [string]$ApprovedTestHost
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $projectRoot '.env.sepay-test.local'
$settings = @{}
$savedEnvironment = @{}
$environmentChanged = $false
$locationChanged = $false

try {
    if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
        throw 'Missing test configuration.'
    }

    $lineNumber = 0
    foreach ($line in [System.IO.File]::ReadAllLines($configPath)) {
        $lineNumber++
        $trimmed = $line.Trim()
        if ($trimmed.Length -eq 0 -or $trimmed.StartsWith('#')) { continue }

        # Ignore unrelated settings; load only DATABASE_URL and SEPAY_*.
        if ($trimmed -notmatch '^(?:export\s+)?(DATABASE_URL|SEPAY_[A-Z0-9_]+)\s*=\s*(.*)$') {
            if ($trimmed -match '^(?:export\s+)?(?:DATABASE_URL|SEPAY_)') {
                throw "Invalid test setting at line $lineNumber."
            }
            continue
        }
        $name = $Matches[1]
        $rawValue = $Matches[2].Trim()
        if ($settings.ContainsKey($name)) {
            throw "Duplicate test setting at line $lineNumber."
        }

        # Support one-line literal values and optional trailing comments.
        # Variable expansion, command substitution and multiline values are unsupported.
        if ($rawValue.StartsWith('"')) {
            if ($rawValue -notmatch '^"([^"\r\n]*)"\s*(?:#.*)?$') {
                throw "Invalid quoted test setting at line $lineNumber."
            }
            $value = $Matches[1]
        } elseif ($rawValue.StartsWith("'")) {
            if ($rawValue -notmatch "^'([^'\r\n]*)'\s*(?:#.*)?$") {
                throw "Invalid quoted test setting at line $lineNumber."
            }
            $value = $Matches[1]
        } else {
            $value = ($rawValue -replace '\s+#.*$', '').Trim()
        }
        $settings[$name] = $value
    }

    foreach ($required in @('DATABASE_URL', 'SEPAY_MODE', 'SEPAY_TEST_DATABASE_HOST', 'SEPAY_TEST_ACCOUNT_NUMBER', 'SEPAY_WEBHOOK_SECRET')) {
        if (-not $settings.ContainsKey($required) -or [string]::IsNullOrWhiteSpace($settings[$required])) {
            throw "Required test setting is missing: $required."
        }
    }
    if ($settings['SEPAY_MODE'] -cne 'test') {
        throw 'SEPAY_MODE must be test.'
    }

    $databaseUri = $null
    if (-not [System.Uri]::TryCreate($settings['DATABASE_URL'], [System.UriKind]::Absolute, [ref]$databaseUri)) {
        throw 'Invalid test database URL.'
    }
    if ($databaseUri.Scheme -notin @('postgres', 'postgresql') -or
        [string]::IsNullOrWhiteSpace($databaseUri.Host) -or
        $databaseUri.Host -ine $settings['SEPAY_TEST_DATABASE_HOST']) {
        throw 'Test database hostname does not match the approved test endpoint.'
    }

    # File/inherited values can never enable writes. Only the explicit switch can.
    $settings['SEPAY_AUTO_CONFIRM_ENABLED'] = 'false'
    $settings['SEPAY_TEST_ALLOWED_PAYMENT_CODES'] = 'KONO-SEPAYTEST-5FC7B6FC-D190-497F-88BC-E4148967390F'
    if ($EnableAutoConfirm) {
        if ([string]::IsNullOrWhiteSpace($ApprovedTestHost) -or
            $ApprovedTestHost -cnotmatch '^ep-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$' -or
            $databaseUri.Host -cne $ApprovedTestHost -or
            $settings['SEPAY_TEST_DATABASE_HOST'] -cne $ApprovedTestHost -or
            [string]::IsNullOrWhiteSpace($settings['SEPAY_TEST_GATEWAY'])) {
            throw 'Explicit approved test endpoint and gateway required before enabling.'
        }
        $settings['SEPAY_AUTO_CONFIRM_ENABLED'] = 'true'
    }
    $npmCommand = Get-Command npm.cmd -CommandType Application -ErrorAction Stop

    # Clear inherited SePay settings so an omitted setting cannot leak from another environment.
    foreach ($entry in Get-ChildItem Env:) {
        if ($entry.Name -eq 'DATABASE_URL' -or $entry.Name -like 'SEPAY_*') {
            $savedEnvironment[$entry.Name] = $entry.Value
        }
    }
    $environmentChanged = $true
    foreach ($name in $savedEnvironment.Keys) {
        [System.Environment]::SetEnvironmentVariable($name, $null, 'Process')
    }
    foreach ($name in $settings.Keys) {
        [System.Environment]::SetEnvironmentVariable($name, $settings[$name], 'Process')
    }

    Push-Location -LiteralPath $projectRoot
    $locationChanged = $true
    if ($EnableAutoConfirm) {
        Write-Host 'Starting Next.js in SePay Test Mode. Auto-confirm is enabled for the single approved phase-three fixture.'
    } else {
        Write-Host 'Starting Next.js in SePay Test Mode. Auto-confirm is disabled.'
    }
    & $npmCommand.Source run dev
    if ($LASTEXITCODE -ne 0) {
        throw 'Next.js exited unsuccessfully.'
    }
} catch {
    # Suppress underlying exceptions: URI, filesystem and process errors may contain secrets.
    Write-Error 'SePay test startup failed. Check required settings, test mode, matching database hostname and npm.cmd availability. No configuration values are logged.' -ErrorAction Continue
    exit 1
} finally {
    if ($locationChanged) { Pop-Location }
    if ($environmentChanged) {
        foreach ($name in $settings.Keys) {
            [System.Environment]::SetEnvironmentVariable($name, $null, 'Process')
        }
        foreach ($name in $savedEnvironment.Keys) {
            [System.Environment]::SetEnvironmentVariable($name, $savedEnvironment[$name], 'Process')
        }
    }
}
