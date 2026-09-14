# Startica.exe

Lansator nativ Windows pentru Startica: pornește serverul Node și deschide fereastra
aplicației în Edge sau Chrome (mod `--app`), fără VBScript sau consolă PowerShell vizibilă.
Înlocuiește `startica_desktop.ps1` + `Porneste_Startica.vbs` / `Opreste_Startica.vbs`.

## Compilare

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File launcher\build-launcher.ps1
```

Generează `launcher\obj\AssemblyInfo.cs` din versiunea din `package.json`, apoi compilează
cu `csc.exe` din `%WINDIR%\Microsoft.NET\Framework64\v4.0.30319` (C# 5, .NET Framework 4.x,
fără SDK instalat). Rezultatul e `launcher\bin\Startica.exe`; nici `bin\`, nici `obj\` nu se
urmăresc în git — se construiesc la împachetare sau la nevoie.

## Argumente

Toate sunt opționale.

| Argument | Implicit | Rol |
| --- | --- | --- |
| `--home <dir>` | `%LOCALAPPDATA%\Startica` | rădăcina de date (`Startica_Date`, `Startica_Backup`, `Jurnale`, `Interfata`) |
| `--app-dir <dir>` | folderul `Startica.exe` | unde sunt `startica_server.mjs` și `runtime\node.exe` (în dezvoltare: rădăcina repo-ului) |
| `--port <n>` | `8765` | portul preferat; dacă e ocupat, sistemul alege altul |
| `--profile-dir <dir>` | `<home>\Interfata` | profilul de browser al ferestrei aplicației |
| `--stop` | — | oprește serverul acestei rădăcini de date și iese |
| `--no-migrate` | — | sare peste detectarea instalării vechi (teste) |
| `--quiet` | — | fără ferestre de dialog; erorile doar în jurnal, cod de ieșire 1 (teste, instaler) |

## Jurnal

`<home>\Jurnale\lansator.log`, cu prefix ISO pe fiecare linie, rotit la 1 MB într-o singură
generație anterioară (`lansator.1.log`).
