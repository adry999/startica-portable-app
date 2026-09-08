$ErrorActionPreference = 'Stop'
$source = Split-Path $PSScriptRoot -Parent
$testDirectory = Join-Path $env:TEMP ('startica-desktop-test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testDirectory | Out-Null
$profile = Join-Path $testDirectory 'Interfata'
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
$listener.Start(); $port = $listener.LocalEndpoint.Port; $listener.Stop()
$url = 'http://127.0.0.1:' + $port
$controllers = @()
function Test-Health {
    try { $h = Invoke-RestMethod ($url + '/api/health') -TimeoutSec 2; return $h.database -eq (Join-Path $testDirectory 'Startica_Date\startica.db') } catch { return $false }
}
function Get-TestBrowser {
    Get-CimInstance Win32_Process -Filter "Name='chrome.exe' OR Name='msedge.exe'" | Where-Object {
        $_.CommandLine -and $_.CommandLine.Contains($profile) -and -not $_.CommandLine.Contains('--type=')
    } | Select-Object -First 1
}
function Wait-Condition([scriptblock]$Condition, [string]$Message) {
    $timer = [Diagnostics.Stopwatch]::StartNew()
    while ($timer.Elapsed.TotalSeconds -lt 25) { if (& $Condition) { return }; Start-Sleep -Milliseconds 300 }
    throw $Message
}
try {
    $files = Get-ChildItem -LiteralPath $source -File | Where-Object { $_.Extension -in @('.mjs','.js','.html','.css','.cmd') -or $_.Name -eq 'startica_desktop.ps1' }
    foreach ($file in $files) { Copy-Item -LiteralPath $file.FullName -Destination $testDirectory }
    # Modulele serverului si ale interfetei stau in subdirectoare; fara ele
    # startica_server.mjs nu porneste.
    foreach ($folder in @('assets','server','ui')) {
        Copy-Item -LiteralPath (Join-Path $source $folder) -Destination (Join-Path $testDirectory $folder) -Recurse
    }
    # Profilul se trece explicit: altfel testul ar scrie in profilul real din
    # %LOCALAPPDATA% si ar inchide ferestrele Startica ale utilizatorului.
    $arguments = '/d /c ""' + (Join-Path $testDirectory 'Porneste_Startica.cmd') + '" -Port ' + $port +
        ' -ProfileDirectory "' + $profile + '""'
    $controllers += Start-Process -FilePath 'cmd.exe' -ArgumentList $arguments -WindowStyle Hidden -PassThru
    if (-not $controllers[-1].WaitForExit(5000)) { throw 'Terminalul lansatorului a ramas blocat.' }
    if ($controllers[-1].ExitCode -ne 0) { throw 'Lansatorul CMD a esuat.' }
    Wait-Condition { Test-Health } 'Serverul de test nu a pornit.'
    Wait-Condition { $b = Get-TestBrowser; $b -and (Get-Process -Id $b.ProcessId).MainWindowHandle -ne 0 } 'Prima fereastra nu a aparut.'
    Start-Sleep -Milliseconds 800
    $firstHandle = (Get-Process -Id (Get-TestBrowser).ProcessId).MainWindowHandle
    $controllers += Start-Process -FilePath 'cmd.exe' -ArgumentList $arguments -WindowStyle Hidden -PassThru
    if (-not $controllers[-1].WaitForExit(5000)) { throw 'Al doilea terminal a ramas blocat.' }
    Wait-Condition { (Get-Process -Id (Get-TestBrowser).ProcessId).MainWindowHandle -ne $firstHandle } 'A doua fereastra nu a aparut.'
    $process = Get-Process -Id (Get-TestBrowser).ProcessId
    if (-not $process.CloseMainWindow()) { throw 'Nu am putut inchide prima fereastra de test.' }
    Start-Sleep -Milliseconds 1500
    if (-not (Test-Health)) { throw 'Serverul s-a oprit cu o fereastra ramasa deschisa.' }
    $process = Get-Process -Id (Get-TestBrowser).ProcessId
    Wait-Condition { $process.Refresh(); $process.MainWindowHandle -ne 0 } 'Fereastra ramasa nu a fost gasita.'
    if (-not $process.CloseMainWindow()) { throw 'Nu am putut inchide ultima fereastra de test.' }
    Wait-Condition { -not (Test-Health) } 'Serverul nu s-a oprit dupa ultima fereastra.'
    if (-not (Get-ChildItem -LiteralPath (Join-Path $testDirectory 'Startica_Backup') -Filter '*inchidere*.db')) { throw 'Lipseste backupul final.' }
    Write-Output 'PASS: lansatorul CMD se inchide imediat; doua ferestre, inchiderea primei pastreaza serverul, ultima il opreste si creeaza backup final.'
} finally {
    if (Test-Health) {
        $session = Invoke-RestMethod ($url + '/api/session')
        Invoke-RestMethod ($url + '/api/shutdown') -Method Post -ContentType 'application/json' -Headers @{ 'X-Startica-Token' = $session.token } -Body '{}' | Out-Null
    }
    $b = Get-TestBrowser
    if ($b) { Stop-Process -Id $b.ProcessId -Force -ErrorAction SilentlyContinue }
    foreach ($controller in $controllers) { if (-not $controller.HasExited) { Stop-Process -Id $controller.Id -Force -ErrorAction SilentlyContinue } }
    Start-Sleep -Milliseconds 1200
    $resolved = (Resolve-Path -LiteralPath $testDirectory).Path
    if ($resolved -eq $testDirectory -and $resolved.StartsWith([IO.Path]::GetFullPath($env:TEMP).TrimEnd('\') + '\startica-desktop-test-')) {
        Remove-Item -LiteralPath $resolved -Recurse -Force
    }
}
