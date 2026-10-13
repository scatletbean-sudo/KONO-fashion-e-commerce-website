$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
node scripts/reset-media-dev-admin.mjs --check
if ($LASTEXITCODE -ne 0) { throw 'Development verification failed; no password requested.' }
Write-Host 'Choose a password of at least 12 characters and at most 72 UTF-8 bytes. Input is hidden.'
$newSecret = Read-Host 'New password' -AsSecureString
$confirmSecret = Read-Host 'Confirm password' -AsSecureString
$firstPointer = [IntPtr]::Zero
$secondPointer = [IntPtr]::Zero
try {
    $firstPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($newSecret)
    $secondPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($confirmSecret)
    $payload = @{ password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($firstPointer); confirm = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secondPointer) } | ConvertTo-Json -Compress
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = (Get-Command node.exe).Source
    $startInfo.Arguments = 'scripts/reset-media-dev-admin.mjs --reset'
    $startInfo.WorkingDirectory = (Get-Location).Path
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardInput = $true
    $startInfo.StandardInputEncoding = New-Object System.Text.UTF8Encoding($false)
    $child = [System.Diagnostics.Process]::Start($startInfo)
    $child.StandardInput.Write($payload)
    $child.StandardInput.Close()
    $child.WaitForExit()
    if ($child.ExitCode -ne 0) { throw 'Reset did not complete successfully.' }
} finally {
    if ($firstPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($firstPointer) }
    if ($secondPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secondPointer) }
    $payload = $null
    $newSecret.Dispose()
    $confirmSecret.Dispose()
}
