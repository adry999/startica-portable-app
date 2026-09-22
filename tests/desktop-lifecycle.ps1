# Testeaza lansatorul nativ Startica.exe (vezi docs/superpowers/specs/2026-09-15-desktop-app-design.md).
# Ruleaza trei scenarii izolate, fiecare cu propriul %TEMP% ca --home, ca sa nu atinga
# instalarea reala a utilizatorului.
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$exitCode = 0

# --- Ajutoare ---

function Assert([bool]$Condition, [string]$Description) {
    if ($Condition) { Write-Output ('PASS: ' + $Description) }
    else { Write-Output ('FAIL: ' + $Description); throw ('Assertie esuata: ' + $Description) }
}

function Wait-Condition([scriptblock]$Condition, [double]$TimeoutSeconds = 25) {
    $timer = [Diagnostics.Stopwatch]::StartNew()
    while ($timer.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
        if (& $Condition) { return $true }
        Start-Sleep -Milliseconds 300
    }
    return $false
}

function Get-FreePort {
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
    $listener.Start(); $port = $listener.LocalEndpoint.Port; $listener.Stop()
    return $port
}

function Test-Health([string]$BaseUrl, [string]$ExpectedDatabase) {
    try {
        $h = Invoke-RestMethod ($BaseUrl + '/api/health') -TimeoutSec 2
        return [bool]($h.ok -and $h.database -and ($h.database -ieq $ExpectedDatabase))
    } catch { return $false }
}

function Get-PortInfo([string]$HomeDir) {
    $path = Join-Path $HomeDir 'startica.port'
    if (-not (Test-Path -LiteralPath $path)) { return $null }
    # -Encoding UTF8 explicit: fara el, Get-Content foloseste codepage-ul implicit cand
    # fisierul (scris de Node, fara BOM) are diacritice in calea bazei (Scenariul 3).
    try { return Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json } catch { return $null }
}

# CommandLine contine profilul: distinge ferestrele de test de restul ferestrelor
# de browser ale utilizatorului. Sortat dupa PID ca "prima fereastra" sa fie
# deterministic, nu in ordinea incidentala intoarsa de CIM.
function Get-MatchingBrowserProcesses([string]$ProfileDir) {
    Get-CimInstance Win32_Process -Filter "Name='chrome.exe' OR Name='msedge.exe'" |
        Where-Object { $_.CommandLine -and $_.CommandLine.Contains($ProfileDir) -and -not $_.CommandLine.Contains('--type=') } |
        Sort-Object ProcessId
}
function Get-OldestBrowserWindow([string]$ProfileDir) {
    Get-MatchingBrowserProcesses $ProfileDir | Select-Object -First 1
}

function Stop-TestBrowsers([string]$ProfileDir) {
    Get-MatchingBrowserProcesses $ProfileDir | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

function New-TestHome {
    $homeDir = Join-Path $env:TEMP ('startica-desktop-test-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $homeDir | Out-Null
    return $homeDir
}

function New-DiacriticsTestHome {
    # Coduri de caracter, nu literal in fisier: ramane corect indiferent de codepage-ul
    # cu care Windows PowerShell 5.1 citeste acest .ps1 (fara BOM, cf. .gitattributes).
    $diacriticsName = [string][char]0x0218 + 'erban ' + [string][char]0x00CE + 'onu' + [string][char]0x021B
    $homeDir = Join-Path $env:TEMP ('startica-desktop-test-' + $diacriticsName + '-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $homeDir | Out-Null
    return $homeDir
}

function Stop-ViaLauncher([string]$LauncherExe, [string]$HomeDir) {
    if (-not (Test-Path -LiteralPath $LauncherExe)) { return }
    try {
        $stopArgs = '--stop --quiet --home "' + $HomeDir + '"'
        Start-Process -FilePath $LauncherExe -ArgumentList $stopArgs -Wait -PassThru -ErrorAction SilentlyContinue | Out-Null
    } catch {}
}

# Acelasi calcul ca ComputeHomeIdentity din Startica.cs: SHA-256 pe calea normalizata
# (lowercase), primii 8 octeti in hex - folosit ca sa gasim numele sarcinii din Scenariul 4
# fara sa parsam jurnalul lansatorului.
function Get-HomeIdentityHash8([string]$HomeDir) {
    $normalized = [IO.Path]::GetFullPath($HomeDir).ToLowerInvariant()
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $hash = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($normalized)) }
    finally { $sha.Dispose() }
    return (($hash[0..7] | ForEach-Object { $_.ToString('x2') }) -join '').Substring(0, 8)
}

# --- Resurse urmarite pentru curatenie (populate pe masura ce testul avanseaza) ---
$launcherExe = $null
$testHomes = @()
$testProfiles = @()
$launcherProcesses = @()
$occupyingListener = $null
$telegramTaskPaths = @()

try {
    Write-Output '--- Se construieste lansatorul ---'
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repoRoot 'launcher\build-launcher.ps1')
    Assert ($LASTEXITCODE -eq 0) 'build-launcher.ps1 ruleaza cu succes'
    $launcherExe = Join-Path $repoRoot 'launcher\bin\Startica.exe'
    Assert (Test-Path -LiteralPath $launcherExe) 'Startica.exe a fost creat'

    # --- Scenariul 1: ciclul normal de viata pe un port liber ---
    Write-Output '--- Scenariul 1: ciclul normal de viata ---'
    $home1 = New-TestHome
    $testHomes += $home1
    $profile1 = Join-Path $home1 'Interfata'
    $testProfiles += $profile1
    $port1 = Get-FreePort
    $url1 = 'http://127.0.0.1:' + $port1
    $db1 = Join-Path $home1 'Startica_Date\startica.db'
    $args1 = '--home "' + $home1 + '" --app-dir "' + $repoRoot + '" --port ' + $port1 + ' --profile-dir "' + $profile1 + '" --no-migrate --quiet'

    # Proprietarul (prima pornire) ramane in executie cat supravegheaza ferestrele
    # (spec 2.4 pasul 10); nu se asteapta iesirea lui aici.
    $owner1 = Start-Process -FilePath $launcherExe -ArgumentList $args1 -PassThru
    $launcherProcesses += $owner1

    Assert (Wait-Condition { Test-Health $url1 $db1 } 20) 'Serverul raspunde la /api/health cu baza asteptata'
    Assert (Test-Path -LiteralPath (Join-Path $home1 'startica.port')) 'startica.port a fost creat'
    $portInfo1 = Get-PortInfo $home1
    Assert ($portInfo1 -and $portInfo1.port -eq $port1) 'startica.port contine portul folosit efectiv'

    Assert (Wait-Condition { $b = Get-OldestBrowserWindow $profile1; $b -and (Get-Process -Id $b.ProcessId).MainWindowHandle -ne 0 } 25) 'Prima fereastra a browserului a aparut'
    Start-Sleep -Milliseconds 800
    $firstHandle = (Get-Process -Id (Get-OldestBrowserWindow $profile1).ProcessId).MainWindowHandle

    # A doua pornire e non-proprietar: deschide o fereastra si iese repede (spec pasul 7).
    $second1 = Start-Process -FilePath $launcherExe -ArgumentList $args1 -PassThru
    $launcherProcesses += $second1
    Assert ($second1.WaitForExit(20000)) 'A doua pornire (non-proprietar) iese dupa deschiderea ferestrei'
    Assert ($second1.ExitCode -eq 0) 'A doua pornire iese cu codul 0'
    Assert (Wait-Condition { $b = Get-OldestBrowserWindow $profile1; $b -and (Get-Process -Id $b.ProcessId).MainWindowHandle -ne $firstHandle } 25) 'A doua fereastra a aparut (cea mai veche fereastra s-a schimbat sau s-a adaugat una noua)'

    # Inchiderea primei ferestre: serverul trebuie sa ramana pornit cat mai exista alta fereastra.
    $toClose = Get-Process -Id (Get-OldestBrowserWindow $profile1).ProcessId
    Assert $toClose.CloseMainWindow() 'Prima fereastra a primit comanda de inchidere'
    Start-Sleep -Milliseconds 1500
    Assert (Test-Health $url1 $db1) 'Serverul ramane pornit cat timp mai exista o fereastra'

    # Inchiderea ultimei ferestre: proprietarul trece la pasul 2 (oprire) si iese.
    $lastWindow = Get-Process -Id (Get-OldestBrowserWindow $profile1).ProcessId
    Assert (Wait-Condition { $lastWindow.Refresh(); $lastWindow.MainWindowHandle -ne 0 } 10) 'Fereastra ramasa este gasita'
    Assert $lastWindow.CloseMainWindow() 'Ultima fereastra a primit comanda de inchidere'
    Assert (Wait-Condition { -not (Test-Health $url1 $db1) } 20) 'Serverul se opreste dupa ultima fereastra'
    Assert ($owner1.WaitForExit(65000)) 'Procesul proprietar iese dupa oprirea serverului (spec: asteapta pana la 60s)'
    Assert ($owner1.ExitCode -eq 0) 'Procesul proprietar iese cu codul 0'

    Assert (-not (Test-Path -LiteralPath (Join-Path $home1 'startica.port'))) 'startica.port a fost sters dupa oprire'
    Assert (Test-Path -LiteralPath (Join-Path $home1 'Jurnale\startica.log')) 'Jurnale\startica.log exista'
    $closingBackup = Get-ChildItem -LiteralPath (Join-Path $home1 'Startica_Backup') -Filter '*_inchidere_*.db' -ErrorAction SilentlyContinue
    Assert ($closingBackup.Count -gt 0) 'A aparut un backup de inchidere (*_inchidere_*.db)'

    # --- Scenariul 2: portul preferat e ocupat de test ---
    Write-Output '--- Scenariul 2: portul preferat e ocupat ---'
    $home2 = New-TestHome
    $testHomes += $home2
    $profile2 = Join-Path $home2 'Interfata'
    $testProfiles += $profile2
    $db2 = Join-Path $home2 'Startica_Date\startica.db'

    # Ascultatorul ramane pornit (nu Stop() imediat) ca sa ocupe efectiv portul.
    $occupyingListener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
    $occupyingListener.Start()
    $occupiedPort = $occupyingListener.LocalEndpoint.Port
    $args2 = '--home "' + $home2 + '" --app-dir "' + $repoRoot + '" --port ' + $occupiedPort + ' --profile-dir "' + $profile2 + '" --no-migrate --quiet'

    $owner2 = Start-Process -FilePath $launcherExe -ArgumentList $args2 -PassThru
    $launcherProcesses += $owner2

    # Wait-Condition ruleaza scriptblock-ul intr-un scope propriu: o atribuire
    # in interior nu se propaga in variabila de la nivelul scriptului, deci
    # portInfo2 se citeste din nou, dupa ce asteptarea a reusit.
    Assert (Wait-Condition { (Get-PortInfo $home2) -ne $null } 20) 'startica.port a fost creat cu un port alternativ'
    $portInfo2 = Get-PortInfo $home2
    Assert ($portInfo2 -and $portInfo2.port -ne $occupiedPort) 'Serverul a pornit pe alt port decat cel ocupat de test'
    $url2 = 'http://127.0.0.1:' + $portInfo2.port
    Assert (Wait-Condition { Test-Health $url2 $db2 } 15) 'Serverul raspunde pe portul alternativ cu baza asteptata'
    Assert (Wait-Condition { $b = Get-OldestBrowserWindow $profile2; $b -and (Get-Process -Id $b.ProcessId).MainWindowHandle -ne 0 } 25) 'Fereastra Scenariului 2 a aparut'

    # --stop trebuie sa inchida totul pentru acest home: fereastra, serverul si procesul proprietar.
    $stopArgs2 = '--stop --quiet --home "' + $home2 + '"'
    $stop2 = Start-Process -FilePath $launcherExe -ArgumentList $stopArgs2 -Wait -PassThru
    $launcherProcesses += $stop2
    Assert ($stop2.ExitCode -eq 0) '--stop iese cu codul 0'
    Assert (Wait-Condition { -not (Test-Health $url2 $db2) } 20) 'Serverul s-a oprit dupa --stop'
    Assert (-not (Test-Path -LiteralPath (Join-Path $home2 'startica.port'))) 'startica.port a fost sters dupa --stop'
    Assert (Wait-Condition { -not (Get-OldestBrowserWindow $profile2) } 10) 'Fereastra Scenariului 2 a disparut dupa --stop'
    Assert ($owner2.WaitForExit(20000)) 'Procesul proprietar (Scenariul 2) a iesit in cel mult 20s dupa --stop'
    Assert ($owner2.ExitCode -eq 0) 'Procesul proprietar (Scenariul 2) a iesit cu codul 0'

    # --- Scenariul 3: home cu diacritice si spatii in cale (M7d) ---
    Write-Output '--- Scenariul 3: home cu diacritice si spatii in cale ---'
    $home3 = New-DiacriticsTestHome
    $testHomes += $home3
    $profile3 = Join-Path $home3 'Interfata'
    $testProfiles += $profile3
    $port3 = Get-FreePort
    $url3 = 'http://127.0.0.1:' + $port3
    $db3 = Join-Path $home3 'Startica_Date\startica.db'
    # Sir unic pre-citat, nu array de argumente: caile cu spatii trebuie sa ramana un
    # singur token dupa fiecare "--flag" in linia de comanda trimisa lui Start-Process.
    $args3 = '--home "' + $home3 + '" --app-dir "' + $repoRoot + '" --port ' + $port3 + ' --profile-dir "' + $profile3 + '" --no-migrate --quiet'

    $owner3 = Start-Process -FilePath $launcherExe -ArgumentList $args3 -PassThru
    $launcherProcesses += $owner3

    Assert (Wait-Condition { Test-Health $url3 $db3 } 20) 'Serverul porneste cu home cu diacritice si spatii in cale'
    Assert (Test-Path -LiteralPath (Join-Path $home3 'startica.port')) 'startica.port a fost creat (home cu diacritice)'
    $portInfo3 = Get-PortInfo $home3
    Assert ($portInfo3 -and ($portInfo3.database -ieq $db3)) 'startica.port contine calea bazei cu diacritice, corect codificata'
    Assert (Test-Path -LiteralPath (Join-Path $home3 'Jurnale\startica.log')) 'Jurnale\startica.log exista (home cu diacritice)'
    $starticaLogText = Get-Content -LiteralPath (Join-Path $home3 'Jurnale\startica.log') -Raw -Encoding UTF8
    Assert (-not $starticaLogText.Contains([char]0xFFFD)) 'startica.log nu are caractere de inlocuire (UTF-8 corect)'
    Assert (Test-Path -LiteralPath (Join-Path $home3 'Jurnale\lansator.log')) 'Jurnale\lansator.log exista (home cu diacritice)'
    $lansatorLogText = Get-Content -LiteralPath (Join-Path $home3 'Jurnale\lansator.log') -Raw -Encoding UTF8
    Assert ($lansatorLogText.Contains($home3)) 'lansator.log contine calea home cu diacritice, corect codificata UTF-8'

    Assert (Wait-Condition { $b = Get-OldestBrowserWindow $profile3; $b -and (Get-Process -Id $b.ProcessId).MainWindowHandle -ne 0 } 25) 'Fereastra Scenariului 3 a aparut'

    $lastWindow3 = Get-Process -Id (Get-OldestBrowserWindow $profile3).ProcessId
    Assert $lastWindow3.CloseMainWindow() 'Fereastra Scenariului 3 a primit comanda de inchidere'
    Assert (Wait-Condition { -not (Test-Health $url3 $db3) } 20) 'Serverul se opreste dupa inchiderea ferestrei (home cu diacritice)'
    Assert ($owner3.WaitForExit(65000)) 'Procesul proprietar (Scenariul 3) iese dupa oprirea serverului'
    Assert ($owner3.ExitCode -eq 0) 'Procesul proprietar (Scenariul 3) iese cu codul 0'

    # --- Scenariul 4: sarcina programata Telegram (T5) - trebuie sa coexiste cu Startica pornit ---
    Write-Output '--- Scenariul 4: sarcina programata Telegram ---'
    $home4 = New-TestHome
    $testHomes += $home4
    $profile4 = Join-Path $home4 'Interfata'
    $testProfiles += $profile4
    $port4 = Get-FreePort
    $url4 = 'http://127.0.0.1:' + $port4
    $db4 = Join-Path $home4 'Startica_Date\startica.db'
    $args4 = '--home "' + $home4 + '" --app-dir "' + $repoRoot + '" --port ' + $port4 + ' --profile-dir "' + $profile4 + '" --no-migrate --quiet'

    # Startica ramane pornit din acelasi home cat ruleaza tot scenariul: dovada ca
    # --register-task/--telegram/--unregister-task nu intra in conflict cu mutexul proprietarului.
    $owner4 = Start-Process -FilePath $launcherExe -ArgumentList $args4 -PassThru
    $launcherProcesses += $owner4
    Assert (Wait-Condition { Test-Health $url4 $db4 } 20) 'Scenariul 4: Startica porneste normal in home-ul comun'
    Assert (Wait-Condition { $b = Get-OldestBrowserWindow $profile4; $b -and (Get-Process -Id $b.ProcessId).MainWindowHandle -ne 0 } 25) 'Scenariul 4: fereastra a aparut'

    $hash4 = Get-HomeIdentityHash8 $home4
    $taskName4 = 'Rezumat Telegram ' + $hash4
    $taskPath4 = 'Startica\' + $taskName4
    $telegramTaskPaths += $taskPath4

    $register4 = Start-Process -FilePath $launcherExe -ArgumentList ('--register-task --quiet --home "' + $home4 + '" --app-dir "' + $repoRoot + '"') -Wait -PassThru
    $launcherProcesses += $register4
    Assert ($register4.ExitCode -eq 0) 'Scenariul 4: --register-task iese cu codul 0'

    # Fara "2>" pe schtasks: sub $ErrorActionPreference = 'Stop', o linie pe stderr redirectata
    # (asteptata la interogarea de mai jos, dupa stergere) devine exceptie terminanta chiar
    # daca e trimisa spre $null - stderr nu se redirecteaza deloc, doar se citeste $LASTEXITCODE.
    & schtasks.exe /Query /TN $taskPath4 /XML | Set-Variable -Name queryXml4Lines
    Assert ($LASTEXITCODE -eq 0) 'Scenariul 4: schtasks /Query gaseste sarcina inregistrata'
    $queryXml4 = ($queryXml4Lines -join "`n")
    Assert ($queryXml4 -match '--telegram') 'Scenariul 4: actiunea din XML contine --telegram'
    Assert ($queryXml4 -match 'T08:00:00') 'Scenariul 4: fara notify-schedule.json, ora ramane implicita 08:00'

    # Ora rezumatului e configurabila din ecranul "Notificari" (oglindita de server in
    # notify-schedule.json); --register-task o citeste la fiecare (re)inregistrare.
    $telegramDataDir4 = Join-Path $home4 'Startica_Date'
    New-Item -ItemType Directory -Path $telegramDataDir4 -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $telegramDataDir4 'notify-schedule.json') -Value '{"digestTime":"19:45"}' -Encoding UTF8
    $reregister4 = Start-Process -FilePath $launcherExe -ArgumentList ('--register-task --quiet --home "' + $home4 + '" --app-dir "' + $repoRoot + '"') -Wait -PassThru
    $launcherProcesses += $reregister4
    Assert ($reregister4.ExitCode -eq 0) 'Scenariul 4: reinregistrarea cu ora configurata iese cu codul 0'
    & schtasks.exe /Query /TN $taskPath4 /XML | Set-Variable -Name queryXml4bLines
    Assert ($LASTEXITCODE -eq 0) 'Scenariul 4: schtasks /Query gaseste sarcina dupa reinregistrare'
    $queryXml4b = ($queryXml4bLines -join "`n")
    Assert ($queryXml4b -match 'T19:45:00') 'Scenariul 4: ora din notify-schedule.json a fost aplicata la reinregistrare'

    $telegramArgs4 = '--telegram --quiet --home "' + $home4 + '" --app-dir "' + $repoRoot + '"'

    # startica_telegram.mjs e proprietatea T2/T3 (nu inca in acest worktree la data scrierii):
    # fara el, node.exe iese cu "module not found" si codul lansatorului nu mai e 0 - asteptat,
    # nu o eroare a lansatorului. Ramificatia de mai jos verifica doar ce nu depinde de T2/T3.
    $telegramEntryPoint = Join-Path $repoRoot 'startica_telegram.mjs'
    if (Test-Path -LiteralPath $telegramEntryPoint) {
        $telegramRun4 = Start-Process -FilePath $launcherExe -ArgumentList $telegramArgs4 -Wait -PassThru
        $launcherProcesses += $telegramRun4
        Assert ($telegramRun4.ExitCode -eq 0) 'Scenariul 4: --telegram iese cu codul 0 fara telegram.json'

        $telegramLogPath4 = Join-Path $home4 'Jurnale\telegram.log'
        Assert (Wait-Condition { Test-Path -LiteralPath $telegramLogPath4 } 5) 'Scenariul 4: telegram.log a fost creat'
        $telegramLogText4 = Get-Content -LiteralPath $telegramLogPath4 -Raw -Encoding UTF8
        Assert ($telegramLogText4 -match 'Neconfigurat') 'Scenariul 4: telegram.log arata "Neconfigurat" fara telegram.json'

        # Token de forma valida (regex-ul din §4.2), cheie inexistenta la Telegram: 401, clasificat
        # ca eroare permanenta => cod de iesire 0, fara apel real necesar pentru ca testul sa treaca.
        $telegramDataDir4 = Join-Path $home4 'Startica_Date'
        New-Item -ItemType Directory -Path $telegramDataDir4 -Force | Out-Null
        $fakeToken = '123456789:AAAA' + ('A' * 22)
        $fakeConfig = @{ token = $fakeToken; chatId = '987654321'; chatName = 'Test'; botUsername = 'test_bot' } | ConvertTo-Json
        Set-Content -LiteralPath (Join-Path $telegramDataDir4 'telegram.json') -Value $fakeConfig -Encoding UTF8

        $telegramRun4b = Start-Process -FilePath $launcherExe -ArgumentList $telegramArgs4 -Wait -PassThru
        $launcherProcesses += $telegramRun4b
        Assert ($telegramRun4b.ExitCode -eq 0) 'Scenariul 4: --telegram iese cu codul 0 cu token fals (eroare Telegram clasificata, fara reluare)'
    } else {
        Write-Output 'ASTEPTARE (T2/T3 neterminate): startica_telegram.mjs lipseste; pasii --telegram/telegram.log/telegram.json raman neverificati end-to-end.'
    }

    $unregister4 = Start-Process -FilePath $launcherExe -ArgumentList ('--unregister-task --quiet --home "' + $home4 + '" --app-dir "' + $repoRoot + '"') -Wait -PassThru
    $launcherProcesses += $unregister4
    Assert ($unregister4.ExitCode -eq 0) 'Scenariul 4: --unregister-task iese cu codul 0'

    & schtasks.exe /Query /TN $taskPath4 | Out-Null
    Assert ($LASTEXITCODE -ne 0) 'Scenariul 4: sarcina a disparut dupa --unregister-task'
    $telegramTaskPaths = $telegramTaskPaths | Where-Object { $_ -ne $taskPath4 }

    Assert (Test-Health $url4 $db4) 'Scenariul 4: Startica a ramas sanatos tot acest timp (fara conflict de mutex/lock cu sarcina)'

    $lastWindow4 = Get-Process -Id (Get-OldestBrowserWindow $profile4).ProcessId
    Assert $lastWindow4.CloseMainWindow() 'Scenariul 4: fereastra primeste comanda de inchidere'
    Assert (Wait-Condition { -not (Test-Health $url4 $db4) } 20) 'Scenariul 4: serverul se opreste dupa inchiderea ferestrei'
    Assert ($owner4.WaitForExit(65000)) 'Scenariul 4: procesul proprietar iese dupa oprirea serverului'
    Assert ($owner4.ExitCode -eq 0) 'Scenariul 4: procesul proprietar iese cu codul 0'

    Write-Output 'PASS: toate scenariile de ciclu de viata au trecut.'
} catch {
    Write-Output ('EROARE: ' + $_.Exception.Message)
    $exitCode = 1
} finally {
    Write-Output '--- Curatenie ---'
    # Doar daca Scenariul 4 a esuat inainte de --unregister-task: sarcina de test nu are voie
    # sa ramana in Task Scheduler-ul real dupa o rulare picata.
    foreach ($taskPath in $telegramTaskPaths) {
        try { & schtasks.exe /Delete /TN $taskPath /F 2>$null | Out-Null } catch {}
    }
    foreach ($homeDir in $testHomes) {
        try { Stop-ViaLauncher $launcherExe $homeDir } catch {}
    }
    foreach ($profileDir in $testProfiles) {
        try { Stop-TestBrowsers $profileDir } catch {}
    }
    foreach ($proc in $launcherProcesses) {
        try { if ($proc -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } } catch {}
    }
    if ($occupyingListener) { try { $occupyingListener.Stop() } catch {} }
    Start-Sleep -Milliseconds 1000
    foreach ($homeDir in $testHomes) {
        try {
            $resolved = (Resolve-Path -LiteralPath $homeDir).Path
            $expectedPrefix = [IO.Path]::GetFullPath($env:TEMP).TrimEnd('\') + '\startica-desktop-test-'
            if ($resolved.StartsWith($expectedPrefix)) { Remove-Item -LiteralPath $resolved -Recurse -Force -ErrorAction SilentlyContinue }
        } catch {}
    }
    exit $exitCode
}
