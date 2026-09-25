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
; AppId + numele diferite de instalerul vanilla (1.6.x): cele doua trebuie sa coexiste pe acelasi
; PC ca doua aplicatii distincte, nu ca o actualizare in loc a aceleiasi instalari.
AppId={{6DC8B704-9D60-4381-BD7C-5FFAAD8F1335}
AppName=Startica V2
AppVersion={#AppVersion}
DefaultDirName={localappdata}\Programs\Startica V2
DisableProgramGroupPage=yes
DisableDirPage=auto
UsePreviousAppDir=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
SetupIconFile={#RepoRoot}webapp\public\assets\startica.ico
UninstallDisplayIcon={app}\Startica.exe
OutputBaseFilename=Startica_Setup_{#AppVersion}
OutputDir={#OutputDir}
WizardStyle=modern
Compression=lzma2/max
SolidCompression=yes

; Traducere neoficiala vendorizata (Inno 6.7.3 instalat aici nu are Romanian.isl in Languages\).
[Languages]
Name: "romanian"; MessagesFile: "{#SourcePath}Romanian.isl"

[Files]
Source: "{#StageDir}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

; La actualizare, module vechi din src/web/webapp care nu mai exista in noua versiune nu trebuie sa ramana amestecate
; (datele nu sunt in {app}); webapp\dist are fisiere cu hash in nume, deci s-ar acumula la nesfarsit fara asta.
[InstallDelete]
Type: filesandordirs; Name: "{app}\src"
Type: filesandordirs; Name: "{app}\web"
Type: filesandordirs; Name: "{app}\webapp"

[Tasks]
Name: "desktopicon"; Description: "Creează o scurtătură pe &desktop"; GroupDescription: "Scurtături suplimentare:"

; --home pe fiecare pornire: home-ul implicit al lansatorului e acelasi pentru orice instalare
; Startica.exe, indiferent de {app} sau AppName. Fara asta, V2 ar scrie in aceeasi evidenta si
; ar rescrie aceeasi sarcina programata Telegram ca instalarea vanilla existenta pe acelasi PC.
#define V2Home "{localappdata}\StarticaV2"

[Icons]
Name: "{autoprograms}\Startica V2"; Filename: "{app}\Startica.exe"; Parameters: "--home ""{#V2Home}"""; IconFilename: "{app}\Startica.exe"
Name: "{autodesktop}\Startica V2"; Filename: "{app}\Startica.exe"; Parameters: "--home ""{#V2Home}"""; IconFilename: "{app}\Startica.exe"; Tasks: desktopicon

[Run]
; Inregistreaza sarcina programata Telegram inaintea pasului postinstall - actualizarea o reinregistreaza oricum.
Filename: "{app}\Startica.exe"; Parameters: "--home ""{#V2Home}"" --register-task --quiet"; Flags: runhidden waituntilterminated
Filename: "{app}\Startica.exe"; Parameters: "--home ""{#V2Home}"""; Description: "Pornește Startica V2"; Flags: postinstall nowait skipifsilent

[UninstallRun]
Filename: "{app}\Startica.exe"; Parameters: "--home ""{#V2Home}"" --unregister-task --quiet"; Flags: runhidden waituntilterminated; RunOnceId: "UnregisterTelegramTask"; Check: StarticaExeExists
Filename: "{app}\Startica.exe"; Parameters: "--home ""{#V2Home}"" --stop --quiet"; Flags: runhidden waituntilterminated; RunOnceId: "StopStartica"; Check: StarticaExeExists

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
