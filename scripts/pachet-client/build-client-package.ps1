# Construieste instalerul de livrare pentru client din HEAD (nu din copia de
# lucru), ca instalerul sa corespunda exact unui commit verificabil.
param(
    [string]$BaseZip,
    [string]$OutputDirectory = 'Livrare'
)
$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

function Resolve-RepoPath([string]$path) {
    if ([System.IO.Path]::IsPathRooted($path)) { return $path }
    return Join-Path $repo $path
}

function Find-Iscc {
    $fromPath = Get-Command 'ISCC.exe' -ErrorAction SilentlyContinue
    if ($fromPath) { return $fromPath.Source }
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA 'Programs\Inno Setup 6\ISCC.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 6\ISCC.exe')
    )
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) { return $candidate }
    }
    return $null
}

$resolvedOutputDirectory = Resolve-RepoPath $OutputDirectory

# Instalerul trebuie sa corespunda exact unui commit; o copie de lucru
# modificata ar livra fisiere care nu sunt in istoric.
$statusOutput = & git -C $repo status --porcelain --untracked-files=no
if ($LASTEXITCODE -ne 0) { throw 'git status a esuat.' }
if ($statusOutput) { throw 'Exista fisiere urmarite modificate fata de HEAD. Fa commit sau stash inainte de a construi pachetul.' }

$isccPath = Find-Iscc
if (-not $isccPath) {
    throw 'ISCC.exe (Inno Setup 6) nu a fost gasit in PATH, %LOCALAPPDATA%\Programs\Inno Setup 6 sau %ProgramFiles(x86)%\Inno Setup 6. Instaleaza-l cu: winget install --id JRSoftware.InnoSetup -e --scope user'
}

if ($BaseZip) {
    $resolvedBaseZip = Resolve-RepoPath $BaseZip
} else {
    # runtime\node.exe si Licente\ nu sunt urmarite in git; vin dintr-un pachet anterior.
    $candidateZips = Get-ChildItem -LiteralPath (Resolve-RepoPath 'Livrare') -Filter 'Startica_v*.zip' -File -ErrorAction SilentlyContinue |
        Sort-Object { [version]($_.BaseName -replace '^Startica_v', '') } -Descending
    if (-not $candidateZips) { throw 'Nicio arhiva Startica_v*.zip gasita in Livrare pentru -BaseZip (sursa runtime\node.exe si Licente\).' }
    $resolvedBaseZip = $candidateZips[0].FullName
}
if (-not (Test-Path -LiteralPath $resolvedBaseZip -PathType Leaf)) {
    throw ('Arhiva de baza nu a fost gasita: ' + $resolvedBaseZip)
}
Write-Output ('Arhiva de baza: ' + $resolvedBaseZip)

$packageJson = Get-Content -Raw -LiteralPath (Join-Path $repo 'package.json') | ConvertFrom-Json
$version = $packageJson.version
$enginesNode = $packageJson.engines.node
if ($enginesNode -notmatch '^>=\s*(\d+\.\d+\.\d+)\s*$') {
    throw ('Format neasteptat pentru engines.node: ' + $enginesNode)
}
$requiredNodeVersion = [version]$Matches[1]

New-Item -ItemType Directory -Path $resolvedOutputDirectory -Force | Out-Null
$setupExePath = Join-Path $resolvedOutputDirectory ('Startica_Setup_' + $version + '.exe')
if (Test-Path -LiteralPath $setupExePath) {
    throw ('Instalerul exista deja: ' + $setupExePath + '. Sterge-l sau alege alt -OutputDirectory.')
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

# Cale scurta sub TEMP: caile din src\app\... ale proiectului sunt deja
# adanci, iar MAX_PATH loveste usor daca radacina de stagiu e lunga.
$guid = [guid]::NewGuid().ToString('N').Substring(0, 8)
# $appStage este continutul {app}: Startica.exe, runtime\node.exe, src\, webapp\dist\ etc, direct la radacina.
$appStage = Join-Path $env:TEMP ('startica-package-' + $guid)
# Extragerea intermediara a git archive sta separat: fisierele nefolosite din
# arhiva git (ex. scripts\pachet-client\) nu trebuie sa ajunga in {app}.
$workRoot = Join-Path $env:TEMP ('startica-work-' + $guid)
$extractRoot = Join-Path $workRoot 'extract'
$archivePath = Join-Path $workRoot 'head.tar'

try {
    New-Item -ItemType Directory -Path $appStage -Force | Out-Null
    New-Item -ItemType Directory -Path $extractRoot -Force | Out-Null

    $headPaths = @(
        'src', 'package.json', 'startica_server.mjs', 'startica_telegram.mjs', 'scripts/pachet-client/CITESTE-MA.txt'
    )
    & git -C $repo archive --format=tar --output $archivePath HEAD -- $headPaths
    if ($LASTEXITCODE -ne 0) { throw 'git archive de la HEAD a esuat (lipseste un fisier necesar in commit?).' }
    & "$env:SystemRoot\System32\tar.exe" -x -f $archivePath -C $extractRoot
    if ($LASTEXITCODE -ne 0) { throw 'Extragerea arhivei git a esuat.' }

    Move-Item -LiteralPath (Join-Path $extractRoot 'src') -Destination (Join-Path $appStage 'src')
    Move-Item -LiteralPath (Join-Path $extractRoot 'package.json') -Destination (Join-Path $appStage 'package.json')
    Move-Item -LiteralPath (Join-Path $extractRoot 'startica_server.mjs') -Destination (Join-Path $appStage 'startica_server.mjs')
    Move-Item -LiteralPath (Join-Path $extractRoot 'startica_telegram.mjs') -Destination (Join-Path $appStage 'startica_telegram.mjs')
    Move-Item -LiteralPath (Join-Path $extractRoot 'scripts\pachet-client\CITESTE-MA.txt') -Destination (Join-Path $appStage 'CITESTE-MA.txt')

    # Testele nu au ce cauta in pachetul livrat clientului.
    Get-ChildItem -LiteralPath (Join-Path $appStage 'src') -Recurse -Filter '*.test.mjs' -File |
        Remove-Item -Force
    Get-ChildItem -LiteralPath (Join-Path $appStage 'src') -Recurse -Directory -Filter 'test-support' |
        Remove-Item -Recurse -Force

    # webapp/dist nu e urmarit in git (e build output); se construieste acum, din webapp/ al arborelui
    # de lucru curat (verificarea git status de mai sus garanteaza ca fisierele urmarite corespund HEAD).
    # Server-ul citeste front-end-ul din <radacina-aplicatiei>/webapp/dist (static-assets.mjs), deci
    # sub-calea webapp\dist trebuie pastrata neschimbata in stagiu, nu aplatizata.
    $webappDir = Join-Path $repo 'webapp'
    Push-Location $webappDir
    try {
        & npm ci
        if ($LASTEXITCODE -ne 0) { throw 'npm ci in webapp/ a esuat.' }
        & npm run build
        if ($LASTEXITCODE -ne 0) { throw 'npm run build in webapp/ a esuat.' }
    } finally {
        Pop-Location
    }
    $webappDistSource = Join-Path $webappDir 'dist'
    if (-not (Test-Path -LiteralPath (Join-Path $webappDistSource 'index.html') -PathType Leaf)) {
        throw ('Build-ul webapp nu a produs webapp\dist\index.html: ' + $webappDistSource)
    }
    $webappDistStage = Join-Path $appStage 'webapp\dist'
    New-Item -ItemType Directory -Path $webappDistStage -Force | Out-Null
    Copy-Item -Path (Join-Path $webappDistSource '*') -Destination $webappDistStage -Recurse

    # Lansatorul nu e urmarit in git; se construieste acum, din arborele de lucru curat.
    $buildLauncherScript = Join-Path $repo 'launcher\build-launcher.ps1'
    if (-not (Test-Path -LiteralPath $buildLauncherScript -PathType Leaf)) {
        throw ('Lipseste scriptul lansatorului: ' + $buildLauncherScript)
    }
    & $buildLauncherScript
    if ($LASTEXITCODE -ne 0) { throw 'Construirea lansatorului (Startica.exe) a esuat.' }
    $launcherExePath = Join-Path $repo 'launcher\bin\Startica.exe'
    if (-not (Test-Path -LiteralPath $launcherExePath -PathType Leaf)) {
        throw ('Lansatorul nu a fost construit: ' + $launcherExePath)
    }
    Copy-Item -LiteralPath $launcherExePath -Destination (Join-Path $appStage 'Startica.exe')

    # Motorul Node si licentele nu sunt urmarite in git; vin din arhiva anterioara.
    $baseArchive = [System.IO.Compression.ZipFile]::OpenRead($resolvedBaseZip)
    try {
        $nodeEntry = $baseArchive.Entries | Where-Object { $_.FullName -eq 'Startica/Aplicatie/runtime/node.exe' }
        if (-not $nodeEntry) { throw ('Arhiva de baza nu contine Startica/Aplicatie/runtime/node.exe: ' + $resolvedBaseZip) }
        $runtimeDir = Join-Path $appStage 'runtime'
        New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
        [System.IO.Compression.ZipFileExtensions]::ExtractToFile($nodeEntry, (Join-Path $runtimeDir 'node.exe'), $true)

        $licenseEntries = $baseArchive.Entries | Where-Object { $_.FullName -like 'Startica/Aplicatie/Licente/*' -and -not $_.FullName.EndsWith('/') }
        if ($licenseEntries.Count -eq 0) { throw ('Arhiva de baza nu contine fisiere in Startica/Aplicatie/Licente: ' + $resolvedBaseZip) }
        $licenseDir = Join-Path $appStage 'Licente'
        New-Item -ItemType Directory -Path $licenseDir -Force | Out-Null
        foreach ($entry in $licenseEntries) {
            $targetPath = Join-Path $licenseDir ([System.IO.Path]::GetFileName($entry.FullName))
            [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $targetPath, $true)
        }
    } finally {
        $baseArchive.Dispose()
    }

    # Actualizarea pastreaza baza clientului; un pachet cu date ar putea
    # suprascrie evidenta mai noua de la client.
    foreach ($dataFolderName in @('Startica_Date', 'Startica_Backup', 'Jurnale')) {
        if (Test-Path -LiteralPath (Join-Path $appStage $dataFolderName)) {
            throw ('Pachetul contine ' + $dataFolderName + ', desi pachetul de client nu trebuie sa includa date.')
        }
    }

    $nodeExePath = Join-Path $appStage 'runtime\node.exe'
    $nodeVersionOutput = & $nodeExePath '--version'
    if ($LASTEXITCODE -ne 0) { throw 'Motorul Node din pachet nu a putut fi rulat.' }
    $actualNodeVersion = [version]($nodeVersionOutput.Trim().TrimStart('v'))
    Write-Output ('Node din arhiva de baza: ' + $actualNodeVersion + ' (necesar ' + $enginesNode + ')')
    if ($actualNodeVersion -lt $requiredNodeVersion) {
        throw ('Motorul Node din arhiva de baza (' + $actualNodeVersion + ') este mai vechi decat cerinta din package.json (' + $enginesNode + ').')
    }

    if (-not (Test-Path -LiteralPath (Join-Path $appStage 'src\app\server\create-application.mjs') -PathType Leaf)) {
        throw 'Lipseste src\app\server\create-application.mjs din pachetul construit.'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $appStage 'webapp\dist\index.html') -PathType Leaf)) {
        throw 'Lipseste webapp\dist\index.html din pachetul construit.'
    }

    $issPath = Join-Path $repo 'scripts\pachet-client\Startica.iss'
    & $isccPath ('/DAppVersion=' + $version) ('/DStageDir=' + $appStage) ('/DOutputDir=' + $resolvedOutputDirectory) $issPath
    if ($LASTEXITCODE -ne 0) { throw 'ISCC (Inno Setup) a esuat la compilare.' }
    if (-not (Test-Path -LiteralPath $setupExePath -PathType Leaf)) {
        throw ('ISCC a raportat succes, dar instalerul asteptat lipseste: ' + $setupExePath)
    }

    $sizeMB = (Get-Item -LiteralPath $setupExePath).Length / 1MB
    $hash = Get-FileHash -LiteralPath $setupExePath -Algorithm SHA256

    Write-Output ('Instaler: ' + $setupExePath)
    Write-Output ('Dimensiune: ' + $sizeMB.ToString('0.00') + ' MB')
    Write-Output ('SHA-256: ' + $hash.Hash)
} finally {
    if (Test-Path -LiteralPath $appStage) { Remove-Item -LiteralPath $appStage -Recurse -Force -ErrorAction SilentlyContinue }
    if (Test-Path -LiteralPath $workRoot) { Remove-Item -LiteralPath $workRoot -Recurse -Force -ErrorAction SilentlyContinue }
}
