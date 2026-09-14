; Instalerul Startica (Inno Setup 6), compilat de build-client-package.ps1 cu /DAppVersion, /DStageDir si /DOutputDir.
#ifndef AppVersion
  #define AppVersion "0.0.0-dev"
#endif
#ifndef StageDir
  #define StageDir SourcePath + "stage"
#endif
#ifndef OutputDir
  #define OutputDir SourcePath + "..\..\Livrare"
#endif
; Pictograma vine din repo, nu din stagiu: instalerul o foloseste inainte sa existe Startica.exe.
#define RepoRoot SourcePath + "..\..\"

[Setup]
AppId={{A7C3D6E1-5B2F-4E8A-9C41-3F0D2B7E6A15}
AppName=Startica
AppVersion={#AppVersion}
DefaultDirName={localappdata}\Programs\Startica
DisableProgramGroupPage=yes
DisableDirPage=auto
UsePreviousAppDir=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
SetupIconFile={#RepoRoot}web\assets\startica.ico
UninstallDisplayIcon={app}\Startica.exe
OutputBaseFilename=Startica_Setup_{#AppVersion}
OutputDir={#OutputDir}
WizardStyle=modern
Compression=lzma2/max
SolidCompression=yes

; Inno 6.7.3 instalat aici nu are Romanian.isl in Languages\.
[Languages]
Name: "default"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "{#StageDir}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Tasks]
Name: "desktopicon"; Description: "Creează o scurtătură pe &desktop"; GroupDescription: "Scurtături suplimentare:"

[Icons]
Name: "{autoprograms}\Startica"; Filename: "{app}\Startica.exe"; IconFilename: "{app}\Startica.exe"
Name: "{autodesktop}\Startica"; Filename: "{app}\Startica.exe"; IconFilename: "{app}\Startica.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\Startica.exe"; Description: "Pornește Startica"; Flags: postinstall nowait skipifsilent

[UninstallRun]
Filename: "{app}\Startica.exe"; Parameters: "--stop --quiet"; Flags: runhidden waituntilterminated; RunOnceId: "StopStartica"; Check: StarticaExeExists

[Code]
function StarticaExeExists(): Boolean;
begin
  Result := FileExists(ExpandConstant('{app}\Startica.exe'));
end;

// node.exe ar ramane blocat de procesul vechi cat timp instalarea ii suprascrie fisierele.
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
begin
  Result := '';
  if StarticaExeExists() then
    Exec(ExpandConstant('{app}\Startica.exe'), '--stop --quiet', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if (CurUninstallStep = usPostUninstall) and not UninstallSilent then
    MsgBox('Evidența rămâne în ' + ExpandConstant('{localappdata}') + '\Startica.', mbInformation, MB_OK);
end;
