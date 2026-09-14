# Construieste arhiva de livrare pentru client din HEAD (nu din copia de
# lucru), ca zip-ul sa corespunda exact unui commit verificabil.
param(
    [string]$BaseZip = 'Livrare\Startica_v1.1.1.zip',
    [string]$OutputDirectory = 'Livrare'
)
$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

function Resolve-RepoPath([string]$path) {
    if ([System.IO.Path]::IsPathRooted($path)) { return $path }
    return Join-Path $repo $path
}

$resolvedBaseZip = Resolve-RepoPath $BaseZip
$resolvedOutputDirectory = Resolve-RepoPath $OutputDirectory

# Arhiva trebuie sa corespunda exact unui commit; o copie de lucru modificata
# ar livra fisiere care nu sunt in istoric.
$statusOutput = & git -C $repo status --porcelain --untracked-files=no
if ($LASTEXITCODE -ne 0) { throw 'git status a esuat.' }
if ($statusOutput) { throw 'Exista fisiere urmarite modificate fata de HEAD. Fa commit sau stash inainte de a construi pachetul.' }

if (-not (Test-Path -LiteralPath $resolvedBaseZip -PathType Leaf)) {
    throw ('Arhiva de baza nu a fost gasita: ' + $resolvedBaseZip)
}

$packageJson = Get-Content -Raw -LiteralPath (Join-Path $repo 'package.json') | ConvertFrom-Json
$version = $packageJson.version
$enginesNode = $packageJson.engines.node
if ($enginesNode -notmatch '^>=\s*(\d+\.\d+\.\d+)\s*$') {
    throw ('Format neasteptat pentru engines.node: ' + $enginesNode)
}
$requiredNodeVersion = [version]$Matches[1]

New-Item -ItemType Directory -Path $resolvedOutputDirectory -Force | Out-Null
$zipPath = Join-Path $resolvedOutputDirectory ('Startica_v' + $version + '.zip')
if (Test-Path -LiteralPath $zipPath) {
    throw ('Arhiva exista deja: ' + $zipPath + '. Sterge-o sau alege alt -OutputDirectory.')
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

# Cale scurta sub TEMP: caile din src\app\... ale proiectului sunt deja
# adanci, iar MAX_PATH loveste usor daca radacina de stagiu e lunga.
$guid = [guid]::NewGuid().ToString('N').Substring(0, 8)
$stageRoot = Join-Path $env:TEMP ('startica-package-' + $guid)
$starticaStage = Join-Path $stageRoot 'Startica'
$appStage = Join-Path $starticaStage 'Aplicatie'
# Extragerea intermediara a git archive sta in afara $stageRoot: $stageRoot
# devine radacina zip-ului, iar orice ramane acolo la final ajunge in arhiva.
$workRoot = Join-Path $env:TEMP ('startica-work-' + $guid)
$extractRoot = Join-Path $workRoot 'extract'
$archivePath = Join-Path $workRoot 'head.tar'

try {
    New-Item -ItemType Directory -Path $appStage -Force | Out-Null
    New-Item -ItemType Directory -Path $extractRoot -Force | Out-Null

    # Un singur archive+tar pentru tot ce vine din HEAD: programul si
    # lansatorii impreuna, apoi mutati fiecare in locul lui in stagiu.
    $headPaths = @(
        'src', 'web', 'package.json', 'startica_server.mjs', 'startica_desktop.ps1',
        'Porneste_Startica.vbs', 'Opreste_Startica.vbs',
        'scripts/pachet-client/Creeaza_Scurtatura.vbs', 'scripts/pachet-client/CITESTE-MA.txt'
    )
    & git -C $repo archive --format=tar --output $archivePath HEAD -- $headPaths
    if ($LASTEXITCODE -ne 0) { throw 'git archive de la HEAD a esuat (lipseste un fisier necesar in commit?).' }
    & "$env:SystemRoot\System32\tar.exe" -x -f $archivePath -C $extractRoot
    if ($LASTEXITCODE -ne 0) { throw 'Extragerea arhivei git a esuat.' }

    Move-Item -LiteralPath (Join-Path $extractRoot 'src') -Destination (Join-Path $appStage 'src')
    Move-Item -LiteralPath (Join-Path $extractRoot 'web') -Destination (Join-Path $appStage 'web')
    Move-Item -LiteralPath (Join-Path $extractRoot 'package.json') -Destination (Join-Path $appStage 'package.json')
    Move-Item -LiteralPath (Join-Path $extractRoot 'startica_server.mjs') -Destination (Join-Path $appStage 'startica_server.mjs')
    Move-Item -LiteralPath (Join-Path $extractRoot 'startica_desktop.ps1') -Destination (Join-Path $appStage 'startica_desktop.ps1')
    Move-Item -LiteralPath (Join-Path $extractRoot 'Porneste_Startica.vbs') -Destination (Join-Path $starticaStage 'Porneste_Startica.vbs')
    Move-Item -LiteralPath (Join-Path $extractRoot 'Opreste_Startica.vbs') -Destination (Join-Path $starticaStage 'Opreste_Startica.vbs')
    Move-Item -LiteralPath (Join-Path $extractRoot 'scripts\pachet-client\Creeaza_Scurtatura.vbs') -Destination (Join-Path $starticaStage 'Creeaza_Scurtatura.vbs')
    Move-Item -LiteralPath (Join-Path $extractRoot 'scripts\pachet-client\CITESTE-MA.txt') -Destination (Join-Path $starticaStage 'CITESTE-MA.txt')

    # Testele nu au ce cauta in pachetul livrat clientului.
    Get-ChildItem -LiteralPath (Join-Path $appStage 'src') -Recurse -Filter '*.test.mjs' -File |
        Remove-Item -Force
    Get-ChildItem -LiteralPath (Join-Path $appStage 'src') -Recurse -Directory -Filter 'test-support' |
        Remove-Item -Recurse -Force

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
    if ($actualNodeVersion -lt $requiredNodeVersion) {
        throw ('Motorul Node din arhiva de baza (' + $actualNodeVersion + ') este mai vechi decat cerinta din package.json (' + $enginesNode + ').')
    }

    if (-not (Test-Path -LiteralPath (Join-Path $appStage 'src\app\server\create-application.mjs') -PathType Leaf)) {
        throw 'Lipseste Aplicatie\src\app\server\create-application.mjs din pachetul construit.'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $appStage 'web\index.html') -PathType Leaf)) {
        throw 'Lipseste Aplicatie\web\index.html din pachetul construit.'
    }

    # ZipFile.CreateFromDirectory din .NET Framework scrie caile cu "\", pe care
    # unele programe de dezarhivare nu le recunosc ca foldere; intrarile se scriu una cate una, cu "/".
    $stageFiles = Get-ChildItem -LiteralPath $stageRoot -Recurse -File
    $zipStream = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::CreateNew)
    try {
        $zipArchive = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create)
        try {
            foreach ($file in $stageFiles) {
                $entryName = $file.FullName.Substring($stageRoot.Length + 1).Replace('\', '/')
                [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zipArchive, $file.FullName, $entryName, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
            }
        } finally { $zipArchive.Dispose() }
    } finally { $zipStream.Dispose() }

    $entryCount = $stageFiles.Count
    $sizeMB = (Get-Item -LiteralPath $zipPath).Length / 1MB
    $hash = Get-FileHash -LiteralPath $zipPath -Algorithm SHA256

    Write-Output ('Arhiva: ' + $zipPath)
    Write-Output ('Fisiere: ' + $entryCount)
    Write-Output ('Dimensiune: ' + $sizeMB.ToString('0.00') + ' MB')
    Write-Output ('SHA-256: ' + $hash.Hash)
} finally {
    if (Test-Path -LiteralPath $stageRoot) { Remove-Item -LiteralPath $stageRoot -Recurse -Force -ErrorAction SilentlyContinue }
    if (Test-Path -LiteralPath $workRoot) { Remove-Item -LiteralPath $workRoot -Recurse -Force -ErrorAction SilentlyContinue }
}
