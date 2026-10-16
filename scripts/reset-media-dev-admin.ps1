$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
$newSecret = $null
$confirmSecret = $null
$firstPointer = [IntPtr]::Zero
$secondPointer = [IntPtr]::Zero
$child = $null
$payload = $null
$payloadBytes = $null
$passwordText = $null
$confirmText = $null
$stage = 'verification'
$resultCode = 1
try {
    node scripts/reset-media-dev-admin.mjs --check
    if ($LASTEXITCODE -ne 0) { throw 'Verification failed.' }
    $stage = 'input'
    Write-Host 'Choose a password of at least 12 characters and at most 72 UTF-8 bytes. Input is hidden.'
    $newSecret = Read-Host 'New password' -AsSecureString
    $confirmSecret = Read-Host 'Confirm password' -AsSecureString
    $firstPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($newSecret)
    $secondPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($confirmSecret)
    $passwordText = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($firstPointer)
    $confirmText = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secondPointer)
    $utf8 = New-Object System.Text.UTF8Encoding($false, $true)
    if (-not [string]::Equals($passwordText, $confirmText, [StringComparison]::Ordinal)) {
        throw 'Confirmation mismatch.'
    }
    if ($passwordText.Length -lt 12 -or $utf8.GetByteCount($passwordText) -gt 72) {
        throw 'Invalid password length.'
    }
    $payload = @{ password = $passwordText; confirm = $confirmText } | ConvertTo-Json -Compress
    $payloadBytes = $utf8.GetBytes($payload)
    $stage = 'reset'
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = (Get-Command node.exe -CommandType Application).Source
    $startInfo.Arguments = 'scripts/reset-media-dev-admin.mjs --reset'
    $startInfo.WorkingDirectory = (Get-Location).Path
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardInput = $true
    $child = [System.Diagnostics.Process]::Start($startInfo)
    # .NET Framework / Windows PowerShell 5.1 has no StandardInputEncoding.
    # Write BOM-free UTF-8 bytes directly, bypassing StreamWriter's encoding.
    try {
        $child.StandardInput.BaseStream.Write($payloadBytes, 0, $payloadBytes.Length)
        $child.StandardInput.BaseStream.Flush()
    } finally {
        $child.StandardInput.Close()
    }
    $child.WaitForExit()
    if ($child.ExitCode -ne 0) { throw 'Reset failed.' }
    $resultCode = 0
} catch {
    # Do not print exception objects: they may contain input or process details.
    $message = switch ($stage) {
        'verification' { 'Development verification failed; no password requested.' }
        'input' { 'Password input rejected. Confirm both entries match exactly, with at least 12 characters and at most 72 UTF-8 bytes. No reset was started.' }
        default { 'Reset did not complete successfully. Check the development runtime. If interrupted around COMMIT, check login before retrying.' }
    }
    [Console]::Error.WriteLine($message)
} finally {
    if ($firstPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($firstPointer) }
    if ($secondPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secondPointer) }
    if ($null -ne $payloadBytes) { [Array]::Clear($payloadBytes, 0, $payloadBytes.Length) }
    $payload = $null
    $passwordText = $null
    $confirmText = $null
    if ($null -ne $newSecret) { $newSecret.Dispose() }
    if ($null -ne $confirmSecret) { $confirmSecret.Dispose() }
    if ($null -ne $child) { $child.Dispose() }
}
exit $resultCode
