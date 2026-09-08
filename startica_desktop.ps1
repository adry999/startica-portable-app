param([switch]$Stop, [switch]$CheckOnly, [ValidateRange(1,65535)][int]$Port = 8765, [string]$ProfileDirectory)
$ErrorActionPreference = 'Stop'
$appDirectory = $PSScriptRoot
$address = 'http://127.0.0.1:' + $Port
$expectedDatabase = [IO.Path]::GetFullPath((Join-Path $appDirectory 'Startica_Date\startica.db'))
# Profilul de browser al ferestrei aplicatiei contine cookies, istoric si date
# de autentificare. Nu are ce cauta langa cod: folderul aplicatiei este copiat,
# arhivat si trimis mai departe. Amprenta caii pastreaza copiile separate, ca
# doua instalari sa nu foloseasca acelasi profil.
# SHA256::HashData exista doar in .NET 5+; Porneste_Startica.cmd ruleaza
# powershell.exe (5.1, .NET Framework), deci se foloseste instanta.
$sha = [Security.Cryptography.SHA256]::Create()
try {
    $appIdentity = [BitConverter]::ToString(
        $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($appDirectory.ToLowerInvariant()))
    ).Replace('-','').Substring(0, 16)
} finally { $sha.Dispose() }
if ($ProfileDirectory) { $profileDirectory = $ProfileDirectory }
else { $profileDirectory = Join-Path $env:LOCALAPPDATA ('Startica\Interfata_' + $appIdentity) }
$ownsMutex = $false
$mutex = $null
function Get-StarticaHealth {
    try { $result = Invoke-RestMethod -Uri ($address + '/api/health') -TimeoutSec 2 }
    catch { return $null }
    if (-not $result.ok -or -not $result.database -or [IO.Path]::GetFullPath($result.database) -ne $expectedDatabase) {
        throw ('Portul ' + $Port + ' este folosit de alta aplicatie sau de alta copie Startica.')
    }
    return $result
}
function Stop-StarticaServer {
    if (Get-StarticaHealth) {
        $session = Invoke-RestMethod -Uri ($address + '/api/session') -TimeoutSec 5
        $result = Invoke-RestMethod -Uri ($address + '/api/shutdown') -Method Post -ContentType 'application/json' -Headers @{ 'X-Startica-Token' = $session.token } -Body '{}' -TimeoutSec 60
        if ($result.warning) { throw $result.warning }
    }
}
function Find-StarticaWindowProcess {
    $browserName = [IO.Path]::GetFileName($browserPath)
    return Get-CimInstance Win32_Process -Filter ("Name='" + $browserName + "'") |
        Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf($profileDirectory, [StringComparison]::OrdinalIgnoreCase) -ge 0 -and $_.CommandLine.Contains('--user-data-dir') -and -not $_.CommandLine.Contains('--type=') } |
        Select-Object -First 1
}
try {
    if ($Stop) { Stop-StarticaServer; exit 0 }
    $nodePath = (Get-Command node -ErrorAction Stop).Source
    $browserCandidates = @(
        (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
        (Join-Path ([Environment]::GetEnvironmentVariable('ProgramFiles(x86)')) 'Microsoft\Edge\Application\msedge.exe'),
        (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'),
        (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
    )
    $browserPath = $browserCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
    if (-not $browserPath) { throw 'Pentru fereastra aplicatiei este necesar Google Chrome sau Microsoft Edge.' }
    if ($CheckOnly) {
        [pscustomobject]@{ Node = $nodePath; Browser = $browserPath; Application = $appDirectory; URL = $address; AutoStop = $true; InterfaceProfile = $profileDirectory } | ConvertTo-Json -Compress | Write-Output
        exit 0
    }
    $mutex = New-Object Threading.Mutex($false, ('Local\Startica_' + $appIdentity))
    try { $ownsMutex = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $ownsMutex = $true }
    if (-not $ownsMutex) {
        $available = $false
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            if (Get-StarticaHealth) { $available = $true; break }
            Start-Sleep -Milliseconds 300
        }
        if (-not $available) { throw 'O alta pornire Startica este in curs. Reincearca dupa cateva secunde.' }
    }
    if (-not (Get-StarticaHealth)) {
        $logDirectory = Join-Path $appDirectory 'Jurnale'
        New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
        $logName = 'pornire_' + (Get-Date -Format 'yyyyMMdd_HHmmss_fff')
        $env:STARTICA_NO_BROWSER = '1'
        $env:STARTICA_PORT = [string]$Port
        $serverPath = Join-Path $appDirectory 'startica_server.mjs'
        $serverProcess = Start-Process -FilePath $nodePath -ArgumentList ('"' + $serverPath + '"') -WorkingDirectory $appDirectory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDirectory ($logName + '.log')) -RedirectStandardError (Join-Path $logDirectory ($logName + '.error.log'))
        $available = $false
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            if (Get-StarticaHealth) { $available = $true; break }
            if ($serverProcess.HasExited) { throw ('Serverul nu a pornit. Detalii in ' + $logDirectory) }
            Start-Sleep -Milliseconds 300
        }
        if (-not $available) { throw ('Pornirea dureaza prea mult. Verifica jurnalele din ' + $logDirectory) }
    }
    New-Item -ItemType Directory -Path $profileDirectory -Force | Out-Null
    # Profil separat pentru fereastra aplicatiei; evidenta ramane in SQLite.
    $browserArguments = @(
        ('--app=' + $address), ('--user-data-dir="' + $profileDirectory + '"'),
        '--new-window', '--no-first-run', '--no-default-browser-check',
        '--disable-background-mode', '--disable-extensions'
    )
    Start-Process -FilePath $browserPath -ArgumentList $browserArguments -WindowStyle Normal
    if ($ownsMutex) {
        $windowProcess = $null
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            $windowProcess = Find-StarticaWindowProcess
            if ($windowProcess) { break }
            Start-Sleep -Milliseconds 300
        }
        if (-not $windowProcess) { throw 'Nu am putut urmari fereastra Startica. Serverul ramane pornit; foloseste Opreste_Startica.cmd la final.' }
        while (Find-StarticaWindowProcess) { Start-Sleep -Milliseconds 700 }
        Stop-StarticaServer
    }
} catch {
    if ($CheckOnly) { Write-Error $_; exit 1 }
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Startica', 'OK', 'Error') | Out-Null
    exit 1
} finally {
    if ($ownsMutex -and $mutex) { $mutex.ReleaseMutex() }
    if ($mutex) { $mutex.Dispose() }
}
