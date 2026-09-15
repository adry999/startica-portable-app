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
| `--stop` | — | închide Startica pentru acest home: ferestrele profilului, apoi așteaptă proprietarul (mutex, max 15 s), apoi serverul |
| `--no-migrate` | — | sare peste detectarea instalării vechi (teste) |
| `--quiet` | — | fără ferestre de dialog; erorile doar în jurnal, cod de ieșire 1 (teste, instaler) |
| `--telegram` | — | rulează o singură dată rezumatul zilnic Telegram (`startica_telegram.mjs`, `node.exe` ascuns) și iese; fără fereastră, fără mutex, fără migrare; codul de ieșire devine codul lui `startica_telegram.mjs` (Task Scheduler reia la eșec) |
| `--register-task` | — | înregistrează/actualizează sarcina programată Telegram din Task Scheduler (`\Startica\Rezumat Telegram`, zilnic la 08:00); idempotent, rulat și de instaler și, pentru home-ul implicit, la fiecare pornire normală |
| `--unregister-task` | — | șterge sarcina programată Telegram; sarcina lipsă nu e eroare (cod 0) |

`--telegram`, `--register-task` și `--unregister-task` implică `--quiet` și se exclud reciproc între ele și cu `--stop`.

## Jurnal

`<home>\Jurnale\lansator.log`, cu prefix ISO pe fiecare linie, rotit la 1 MB într-o singură
generație anterioară (`lansator.1.log`).
