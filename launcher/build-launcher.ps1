<#
    Compileaza launcher\Startica.cs cu csc.exe din .NET Framework (C# 5, fara SDK
    instalat). Genereaza launcher\obj\AssemblyInfo.cs din versiunea din package.json,
    apoi ruleaza compilarea exact ca in docs/superpowers/specs/2026-09-15-desktop-app-design.md §2.4.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$launcherDir = $PSScriptRoot
$repoRoot = Split-Path -Parent $launcherDir
$objDir = Join-Path $launcherDir 'obj'
$binDir = Join-Path $launcherDir 'bin'

$packageJsonPath = Join-Path $repoRoot 'package.json'
$package = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
$version = $package.version
if ($version -notmatch '^\d+\.\d+\.\d+') {
    throw ('Versiune invalida in package.json: ' + $version)
}
$versionParts = $version -split '\.'
$assemblyVersion = ($versionParts[0..2] -join '.') + '.0'

New-Item -ItemType Directory -Path $objDir -Force | Out-Null
New-Item -ItemType Directory -Path $binDir -Force | Out-Null

$assemblyInfoPath = Join-Path $objDir 'AssemblyInfo.cs'
$assemblyInfoContent = @"
using System.Reflection;

[assembly: AssemblyTitle("Startica")]
[assembly: AssemblyProduct("Startica")]
[assembly: AssemblyVersion("$assemblyVersion")]
[assembly: AssemblyFileVersion("$assemblyVersion")]
"@
Set-Content -LiteralPath $assemblyInfoPath -Value $assemblyInfoContent -Encoding UTF8

$cscPath = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $cscPath)) {
    throw ('Nu am gasit csc.exe la ' + $cscPath + '. Este nevoie de .NET Framework 4.x.')
}

# Argumentele sunt cele exacte din spec (§2.4), rulate cu radacina repo ca director curent.
$cscArguments = @(
    '/nologo'
    '/target:winexe'
    '/platform:anycpu'
    '/optimize+'
    '/langversion:5'
    '/win32icon:webapp\public\assets\startica.ico'
    '/win32manifest:launcher\Startica.manifest'
    '/r:System.Management.dll'
    '/r:System.Windows.Forms.dll'
    '/r:System.Web.Extensions.dll'
    '/r:Microsoft.CSharp.dll'
    '/out:launcher\bin\Startica.exe'
    'launcher\obj\AssemblyInfo.cs'
    'launcher\Startica.cs'
)

Push-Location -LiteralPath $repoRoot
try {
    & $cscPath @cscArguments
    $exitCode = $LASTEXITCODE
} finally {
    Pop-Location
}

if ($exitCode -ne 0) {
    Write-Error ('Compilarea Startica.exe a esuat (cod ' + $exitCode + ').')
    exit $exitCode
}

Write-Host ('Compilat: ' + (Join-Path $binDir 'Startica.exe') + ' (versiune ' + $assemblyVersion + ')')
