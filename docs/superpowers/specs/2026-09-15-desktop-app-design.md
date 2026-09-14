# Startica ca aplicație desktop: instalare, lansator, date în profilul utilizatorului

Stare la scriere: `master` @ `7b86a41` (v1.2.1), migrarea arhitecturală încheiată (pașii 0–12), `npm test` = 226 de teste (225 trec, 1 sărit). Auditul din 15 septembrie 2026 (produs + tehnic + „dublu click și gata”) a fost aprobat integral de utilizator. Acest spec ia deciziile; planul de implementare este `docs/superpowers/plans/2026-09-15-desktop-app.md`.

## 1. Problema

Azi clientul primește un ZIP, îl deblochează, îl extrage în „Documente”, rulează `Creeaza_Scurtatura.vbs`, apoi pornește prin `wscript.exe → Porneste_Startica.vbs → powershell.exe (ascuns) → startica_desktop.ps1 → runtime\node.exe → chrome/msedge --app`. Baza de date, backupurile și jurnalele stau în folderul programului, deci o actualizare înseamnă redenumirea folderului vechi și mutarea manuală a `Startica_Date` și `Startica_Backup` (9 pași, risc de pornire cu bază goală).

Constatări cu severitate mare din audit, toate rezolvate aici:

- **H1** datele în folderul programului, actualizare manuală;
- **H2** lanțul de pornire depinde de VBScript, pe care Microsoft îl elimină din Windows;
- **H3** ghidul trimite la „Documente”, care pe Windows 11 e frecvent sincronizat în OneDrive (SQLite într-un folder sincronizat).

Fapte verificate pe calculatorul de dezvoltare (Windows 11 Pro 26200), relevante pentru decizii:

- `%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe` există și compilează **C# 5** (fără interpolare de șiruri, fără `?.`, fără `nameof`, fără membri expression-bodied). `System.Management.dll`, `System.Windows.Forms.dll`, `System.Web.Extensions.dll` și `Microsoft.CSharp.dll` sunt în GAC.
- **Microsoft Edge este dezinstalat** pe acest PC (există doar `EdgeWebView` 152.x și `EdgeUpdate`); Chrome este instalat. „Edge e mereu prezent pe Windows 11” nu este o garanție.
- Inno Setup **nu** este instalat; `winget` 1.29 este disponibil.
- `web/assets/startica.ico` există (12 KB, include varianta 256 px, commit `457079f`).
- `Livrare/` este ignorat de git: documentele de livrare urmărite trebuie să stea în `scripts/pachet-client/`.

## 2. Decizii

### 2.1 Rezumat

| Decizie | Alegere | Motiv |
| --- | --- | --- |
| Rădăcina de date | `%LOCALAPPDATA%\Startica`, transmisă serverului prin `STARTICA_HOME` | În afara folderului programului și a OneDrive; actualizarea nu atinge datele |
| Lansator | `Startica.exe`, C# 5 pentru .NET Framework 4.8, compilat cu `csc.exe` din Windows | Fără VBS/PowerShell, fără SDK instalat, fereastră de eroare nativă, pictogramă proprie |
| Fereastra | Edge sau Chrome în modul `--app`, cu profil propriu în `<home>\Interfata` | Codul interfeței rămâne neschimbat; WebView2 amânat (§2.9) |
| Instalare | Inno Setup 6, per utilizator (`{localappdata}\Programs\Startica`), fără drepturi de administrator | Scurtături cu pictogramă, dezinstalare, actualizare peste instalarea existentă |
| Migrarea datelor clientului | În lansator, la prima pornire fără bază în `<home>`: detectează instalarea veche, întreabă, **copiază** | Un singur loc, testabil, funcționează și fără instaler |
| Port | 8765 preferat; dacă e ocupat de altceva, portul îl alege sistemul; serverul scrie `<home>\startica.port` | Adresa de depanare rămâne stabilă; nu mai există eroarea „portul e folosit” |
| Jurnale | `<home>\Jurnale\startica.log` (server) și `lansator.log` (lansator), cu timestamp, rotite la 1 MB | Fără 2 fișiere pe pornire, fără `ExperimentalWarning` |
| Versiune | 1.3.0; instalerul se numește `Startica_Setup_1.3.0.exe` | Schimbare vizibilă de instalare = minor |
| Semnare de cod | Nu acum | Cost și verificare de identitate; decizie a utilizatorului (§6) |

### 2.2 Structura `%LOCALAPPDATA%\Startica`

```
%LOCALAPPDATA%\Startica\
├── Startica_Date\startica.db (+ -wal, -shm)   baza activă
├── Startica_Backup\                            copiile locale (aceeași retenție ca azi)
├── Jurnale\
│   ├── startica.log, startica.1.log            serverul Node
│   └── lansator.log, lansator.1.log            Startica.exe
├── Interfata\                                  profilul browserului ferestrei (poate fi șters oricând)
├── startica.port                               scris de server cât rulează: {"port":8765,"pid":1234,"database":"…\\startica.db"}
└── migrat-din.txt                              calea instalării vechi și data preluării (doar după migrare)
```

Programul stă în `%LOCALAPPDATA%\Programs\Startica` (`Startica.exe`, `runtime\node.exe`, `startica_server.mjs`, `package.json`, `src\`, `web\`, `Licente\`, `CITESTE-MA.txt`). Dezinstalarea șterge doar programul.

Numele `Startica_Date`, `Startica_Backup`, `Jurnale` rămân cele de azi, ca documentația și mesajele existente să rămână valabile.

### 2.3 Serverul (`src/`)

- `#config/environment.mjs` citește o variabilă nouă, `STARTICA_HOME`: cale absolută sau absentă. Absentă înseamnă comportamentul de azi (folderul aplicației), folosit în dezvoltare. Valoarea relativă sau goală oprește pornirea, ca la `STARTICA_PORT`.
- `src/app/server/main.mjs`:
  - cu `home`, `createApplication` primește `dataDir = <home>\Startica_Date` și `backupDir = <home>\Startica_Backup`; fără `home`, nimic nu se schimbă;
  - cu `home`, `console.log/warn/error` scriu în `<home>\Jurnale\startica.log` cu prefix `AAAA-LL-ZZTHH:MM:SS.sssZ NIVEL `, rotit la 1 MB în `startica.1.log` (o singură generație); fără `home`, consola rămâne consola;
  - după `listen`, scrie `<home>\startica.port`; la `server.on('close')` îl șterge;
  - `uncaughtException`: scrie stiva în jurnal, încearcă `safeBackup('eroare')`, închide baza, `process.exit(1)`. Lansatorul afișează mesaj cu calea jurnalului.
- `GET /api/session` întoarce `{ token, version }`, cu `version` din `package.json` (citit o dată, la pornire, în `create-application.mjs`). Interfața afișează `Startica v1.3.0` în bara laterală.
- `GET /api/diagnostic` (rută în `src/app/server/diagnostic.routes.mjs`, doar când `allowShutdown` e activ, ca `/api/shutdown`): `{ version, node, platform, home, database, backupDirectory, schemaVersion, health, backups: ultimele 10 nume, log: ultimele 200 de linii din startica.log }`. În „Backup și setări” apare butonul „Raport de diagnostic”, care descarcă `startica-diagnostic-AAAA-LL-ZZ.json`. Fără date personale: nicio înregistrare nu intră în raport.
- `readJsonBody`: un corp care nu e JSON valid întoarce 400 cu „Cererea nu este JSON valid.” în loc de mesajul englezesc al lui `JSON.parse`.
- `npm start` și lansatorul pornesc Node cu `--disable-warning=ExperimentalWarning` (opțiune existentă în Node 22, verificată în documentație).

Ce nu se schimbă: schema SQLite, `revision-transaction`, formatul backupurilor, retenția, rutele existente (doar `/api/session` primește un câmp în plus).

### 2.4 Lansatorul `Startica.exe`

Sursă: `launcher/Startica.cs` (un singur fișier, C# 5), `launcher/Startica.manifest` (`asInvoker`, DPI aware per monitor), `launcher/build-launcher.ps1`, `launcher/README.md`. Rezultatul `launcher/bin/Startica.exe` **nu** se urmărește în git; se construiește la împachetare și în testul de ciclu de viață. Compilare:

```
csc.exe /nologo /target:winexe /platform:anycpu /optimize+ /langversion:5
  /win32icon:web\assets\startica.ico /win32manifest:launcher\Startica.manifest
  /r:System.Management.dll /r:System.Windows.Forms.dll /r:System.Web.Extensions.dll /r:Microsoft.CSharp.dll
  /out:launcher\bin\Startica.exe launcher\obj\AssemblyInfo.cs launcher\Startica.cs
```

`AssemblyInfo.cs` e generat de scriptul de build din versiunea din `package.json` (`AssemblyVersion`, `AssemblyFileVersion`, `AssemblyTitle "Startica"`, `AssemblyProduct "Startica"`).

**Argumente** (toate opționale):

| Argument | Implicit | Rol |
| --- | --- | --- |
| `--home <dir>` | `%LOCALAPPDATA%\Startica` | rădăcina de date |
| `--app-dir <dir>` | folderul exe-ului | unde sunt `startica_server.mjs` și `runtime\node.exe` (în dezvoltare: rădăcina repo-ului) |
| `--port <n>` | 8765 | portul preferat |
| `--profile-dir <dir>` | `<home>\Interfata` | profilul browserului |
| `--stop` | — | oprește serverul acestei rădăcini și iese |
| `--no-migrate` | — | sare peste detectarea instalării vechi (teste) |
| `--quiet` | — | fără ferestre de dialog; erorile doar în jurnal și cod de ieșire 1 (teste, instaler) |

**Fluxul de pornire:**

1. Creează `<home>`, `Jurnale`, deschide `lansator.log`.
2. `--stop`: găsește serverul (pasul 6), `POST /api/shutdown` cu tokenul din `/api/session`, așteaptă până la 60 s închiderea procesului, iese.
3. Migrare (§2.5), doar dacă `<home>\Startica_Date\startica.db` lipsește și nu s-a dat `--no-migrate`/`--quiet`.
4. Motorul: `<app-dir>\runtime\node.exe`; dacă lipsește, `node` din PATH (dezvoltare); altfel eroare „Lipsește motorul aplicației. Reinstalează Startica.”
5. Browserul, în ordine: Edge (`%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe`, `%ProgramFiles%\Microsoft\Edge\Application\msedge.exe`, App Paths din registru), apoi Chrome (`%ProgramFiles%\Google\Chrome\Application\chrome.exe`, `%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe`, App Paths). Niciunul: „Startica are nevoie de Microsoft Edge sau Google Chrome. Instalează unul dintre ele și pornește din nou.”
6. Serverul existent: citește `<home>\startica.port`; dacă portul ascultă, `GET /api/health` răspunde `ok` și `database` (cale completă, fără majuscule/minuscule) este `<home>\Startica_Date\startica.db`, serverul e al nostru. Un fișier `.port` fără server în spate e șters.
7. Mutex `Local\Startica_<SHA-256 al căii home, primele 16 hex>`. Cine îl obține e **proprietar**. Neproprietarul așteaptă până la 10 s serverul, deschide o fereastră și iese.
8. Proprietarul fără server: dacă portul preferat e ocupat (`GetActiveTcpListeners`), pornește cu `STARTICA_PORT=0`; altfel cu portul preferat. Proces: `node.exe --disable-warning=ExperimentalWarning "<app-dir>\startica_server.mjs"`, `WorkingDirectory = app-dir`, `CreateNoWindow`, fără redirecționare (serverul își scrie jurnalul), mediu: `STARTICA_PROFILE=production`, `STARTICA_NO_BROWSER=1`, `STARTICA_PORT`, `STARTICA_HOME=<home>`. Așteaptă până la 15 s apariția `startica.port` + health; dacă procesul a ieșit: „Serverul nu a pornit. Detalii în <home>\Jurnale\startica.log”.
9. Fereastra: `--app=http://127.0.0.1:<port> --user-data-dir="<profile>" --new-window --no-first-run --no-default-browser-check --disable-background-mode --disable-extensions`.
10. Proprietarul supraveghează: găsește procesul ferestrei prin WMI (`Win32_Process`, numele exe-ului browserului, `CommandLine` conține profilul și `--user-data-dir`, nu conține `--type=`), `WaitForExit`, recaută (altă fereastră deschisă între timp), iar când nu mai există niciuna rulează pasul 2. Neproprietarul nu supraveghează nimic (ca azi).
11. Orice eroare: în jurnal întotdeauna; `MessageBox` cu titlul „Startica” dacă nu e `--quiet`; cod de ieșire 1.

Curățenie la prima pornire cu `home` implicit: folderele `%LOCALAPPDATA%\Startica\Interfata_*` (profilurile pe hash de cale ale lansatorului vechi) se șterg; sunt doar cache.

### 2.5 Migrarea de la instalarea veche (ZIP)

Se face o singură dată, când `<home>\Startica_Date\startica.db` lipsește. Candidați, în ordine, primul care are `Startica_Date\startica.db`:

1. ținta scurtăturii `Startica.lnk` de pe Desktop (utilizator și public): argumentul conține `…\Porneste_Startica.vbs`; folderul acelui `.vbs` + `\Aplicatie` (sau folderul însuși, pentru instalările foarte vechi);
2. `<Documente>\Startica\Aplicatie`, `%USERPROFILE%\OneDrive\Documents\Startica\Aplicatie`, `%USERPROFILE%\OneDrive\Documente\Startica\Aplicatie`, `<Desktop>\Startica\Aplicatie`, `%USERPROFILE%\Downloads\Startica\Aplicatie`;
3. `<app-dir>` însuși (cineva a pus `Startica.exe` în folderul vechi).

Dialog: „Am găsit evidența Startica în: `<cale>` (modificată la `<data>`). O preiau în noua instalare? Folderul vechi rămâne neatins.” Da → copiere. Nu → „Pornesc cu o evidență goală?” Da → continuă; Nu → ieșire fără nicio scriere. Niciun candidat → dialog cu „Alege folderul…” (FolderBrowserDialog) sau „Evidență goală”.

Înainte de copiere: dacă pe portul 8765 răspunde un server a cărui `database` este baza veche, „Închide mai întâi Startica veche” și ieșire. Copiere: `startica.db`, `startica.db-wal`, `startica.db-shm` (dacă există; WAL-ul necheckpointat conține scrieri), apoi `Startica_Backup\startica_*.db`. Scrie `<home>\migrat-din.txt` și, best-effort, `<vechi>\EVIDENTA MUTATA - citeste.txt` („Evidența a fost preluată în %LOCALAPPDATA%\Startica la <data>. Acest folder poate fi șters după verificare.”). Datele vechi nu se șterg niciodată de lansator.

### 2.6 Instalerul

`scripts/pachet-client/Startica.iss`, compilat cu `ISCC.exe` de `scripts/pachet-client/build-client-package.ps1`.

| Setare | Valoare |
| --- | --- |
| `AppId` | `{A7C3D6E1-5B2F-4E8A-9C41-3F0D2B7E6A15}` (fix; nu se schimbă niciodată) |
| `AppName` / `AppVersion` | `Startica` / din `package.json` (`/DAppVersion=`) |
| `DefaultDirName` | `{localappdata}\Programs\Startica` |
| `PrivilegesRequired` | `lowest`; `PrivilegesRequiredOverridesAllowed` absent (nu se instalează pentru toți utilizatorii) |
| `ArchitecturesAllowed` / `ArchitecturesInstallIn64BitMode` | `x64compatible` |
| `MinVersion` | `10.0` |
| `SetupIconFile` / `UninstallDisplayIcon` | `web\assets\startica.ico` / `{app}\Startica.exe` |
| `OutputBaseFilename` | `Startica_Setup_{#AppVersion}` |
| `WizardStyle` | `modern`; `DisableProgramGroupPage=yes`; `DisableDirPage=auto`; `UsePreviousAppDir=yes` |
| `Compression` | `lzma2/max`, `SolidCompression=yes` |
| `[Languages]` | `Romanian.isl` din Inno dacă există, altfel `Default.isl` (**neverificat** dacă 6.x include româna) |
| `[Files]` | conținutul stagiului `{app}`: `Startica.exe`, `runtime\node.exe`, `startica_server.mjs`, `package.json`, `src\**` fără teste, `web\**`, `Licente\**`, `CITESTE-MA.txt` |
| `[Icons]` | `{autoprograms}\Startica`, `{autodesktop}\Startica` (task bifat implicit); scurtătura de pe Desktop poartă același nume ca cea veche, deci o înlocuiește |
| `[Run]` | `{app}\Startica.exe`, `postinstall nowait`, „Pornește Startica” |
| `[Code]` `PrepareToInstall` | dacă există `{app}\Startica.exe`, rulează `--stop --quiet` și așteaptă terminarea (max 60 s), ca `node.exe` să nu fie în uz |
| `[UninstallRun]` | `{app}\Startica.exe --stop --quiet`, `RunOnceId: StopStartica` |
| Dezinstalare | șterge doar `{app}`; mesaj final: „Evidența rămâne în %LOCALAPPDATA%\Startica.” |

Actualizarea la client = rulezi noul `Startica_Setup_x.y.z.exe`; instalarea existentă e recunoscută prin `AppId`, programul e înlocuit, datele nu sunt atinse. Instalarea din ZIP (1.1.x/1.2.x) e preluată la prima pornire (§2.5).

Inno Setup lipsește pe calculatorul de dezvoltare. Decizie: instalare per utilizator (`winget install --id JRSoftware.InnoSetup -e --scope user`; dacă `--scope user` nu e acceptat, instalerul oficial cu `/CURRENTUSER /SILENT`), după acordul utilizatorului. Scriptul de build caută `ISCC.exe` în PATH, `%LOCALAPPDATA%\Programs\Inno Setup 6` și `%ProgramFiles(x86)%\Inno Setup 6` și se oprește cu instrucțiuni dacă nu îl găsește.

### 2.7 Împachetarea

`build-client-package.ps1` rămâne construit din `HEAD` (arbore curat, `git archive`) și păstrează `-BaseZip` ca sursă pentru `runtime\node.exe` și `Licente\` (neurmărite în git). Pași: verifică `ISCC.exe`; construiește lansatorul; stagiu cu structura `{app}`; șterge `*.test.mjs` și `test-support/`; verifică `node.exe --version ≥ engines.node`; `ISCC /DAppVersion /DStageDir /DOutputDir`; afișează calea, mărimea și SHA-256 ale `Livrare\Startica_Setup_<v>.exe`. Nu mai produce ZIP. Poarta înainte de împachetare: `npm run check:full` (= `check` + `test:e2e`), rulat de operator, nu de script.

Documente livrate, urmărite în git: `scripts/pachet-client/CITESTE-MA.txt` (clientul: instalare, actualizare, unde sunt datele, ce să facă dacă nu pornește) și `scripts/pachet-client/GHID-LIVRARE.md` (cine livrează: checklist de pregătire și la client, SHA-256).

### 2.8 Ce se șterge

`Porneste_Startica.vbs`, `Opreste_Startica.vbs`, `startica_desktop.ps1`, `scripts/pachet-client/Creeaza_Scurtatura.vbs`, `Startica.lnk`; din `.gitignore` linia `Interfata/` (înlocuită de `launcher/bin/`, `launcher/obj/`); din `.gitattributes` liniile `*.cmd` și `*.lnk`; din `.prettierignore` `Interfata/`. Mesajul „Pornește aplicația din Porneste_Startica.vbs” din `src/app/web/main.mjs` devine „Pornește aplicația din scurtătura Startica.”

### 2.9 Faza 3, WebView2: amânată, cu criterii

Nu se face acum. Se reia dacă apare oricare: (a) un client fără Edge și fără Chrome (Edge poate fi dezinstalat, cum s-a văzut pe calculatorul de dezvoltare); (b) plângeri despre fereastra de browser (titlu, pictogramă, actualizări Edge în fundal); (c) nevoia unei ferestre cu meniu nativ. Premise deja verificate: WebView2 Runtime e prezent chiar și fără Edge; SDK-ul `Microsoft.Web.WebView2` funcționează cu .NET Framework 4.6.2+ și cu C# 5 (async/await). Lansatorul de acum e scris ca fereastra să fie un modul separat (o funcție `OpenWindow`), ca înlocuirea să fie locală.

## 3. Decizii pe fiecare constatare din audit

| ID | Constatare | Decizie |
| --- | --- | --- |
| H1 | date în folderul programului | **Da**: §2.2, §2.3, §2.5 |
| H2 | VBScript / PowerShell ascuns | **Da**: §2.4, §2.8 |
| H3 | „Documente” = OneDrive | **Da**: instalerul alege `{localappdata}`; ghidul nu mai recomandă niciun folder |
| M1 | copia externă neverificată în cloud | **Parțial**: starea e deja vizibilă pe toate ecranele (`#backupStatus`) și restaurarea are previzualizare; nu adăugăm UI nou. Ghidul spune explicit ce confirmă aplicația și ce nu |
| M2 | fără `uncaughtException` | **Da**: §2.3 |
| M3 | toată starea în fiecare răspuns | **Nu**: 5,7 MB de bază, răspuns sub 100 ms; se reia la ~10× volum |
| M4 | port fix | **Da**: 8765 preferat, altfel dinamic, fișier `.port` |
| M5 | teste de ecran, e2e în afara `check` | **Da**: smoke pe toate cele 12 ecrane; `check:full` cerut înainte de împachetare; `check` rămâne rapid |
| L1 | jurnale neroteite, `ExperimentalWarning` | **Da**: §2.3 |
| L2 | profiluri de browser acumulate | **Da**: un singur `Interfata`, cele vechi șterse |
| L3 | tokenul accesibil oricărui proces local | **Nu**: PC personal, un utilizator; documentat |
| L4 | `innerHTML` neverificat exhaustiv | **Da**: inventar al interpolărilor fără `escapeHtml`/`format*`/`recordActionButton`, corectate dacă există |
| L5 | mesaj `JSON.parse` în engleză | **Da**: §2.3 |
| L6 | `Startica.lnk` în git | **Da**: §2.8 |
| L7 | pasul 12 | deja făcut (`db3f3cd`) |
| — | `style-src 'unsafe-inline'` | **Nu**: markup-ul folosește stiluri inline pentru bare; câștig mic |

## 4. Decizii pe itemii de viziune

| # | Item | Decizie |
| --- | --- | --- |
| 1 | instalare și pornire ca program | **Da**: acest spec |
| 2 | mesaje pentru părinți din „De notificat” | **Da**: `billing/domain/reminder-message.mjs` (funcție pură, testată), buton pe rând „Copiază” și buton „Copiază toate mesajele”; text în clipboard. Șablon fix (fără setări): „Bună ziua{, Părinte}! Vă reamintim că taxa pentru {luna} pentru {copil} este de {taxă} lei, cu scadența la {zi.lună.an}. Rest de plată: {rest} lei. Vă mulțumim! Startica” |
| 3 | fișa copilului tipăribilă | **Da**: buton „Tipărește” în dialogul fișei, `printView('profile')`, reguli în `print.css`; verificat în smoke prin emularea mediului `print` |
| 4 | backup pe alt disc + test de restaurare | **Nu ca funcție nouă**: acoperit de `#backupStatus` (stare pe toate ecranele) și de previzualizarea din dialogul de restaurare. Doar text în ghid |
| 5 | robustețe server | **Da**: §2.3 |
| 6 | diagnostic dintr-un click | **Da**: `/api/diagnostic` + buton |
| 7 | smoke pe toate ecranele | **Da**: parcurge cele 12 `data-view`, verifică ecranul activ, fără excepții, fără overflow; plus emularea `print` pentru „De notificat” și fișă |

## 5. Versiune, ramură, verificare

- Ramură: `feat/desktop-app` din `master`. Un task = un commit Conventional Commits. Versiunea devine `1.3.0` în ultimul task, înainte de împachetare.
- `npm run check` rămâne poarta fiecărui task. `npm run check:full` (nou) adaugă `test:e2e` și e obligatoriu înainte de împachetare.
- `tests/desktop-lifecycle.ps1` se rescrie pentru `Startica.exe`: construiește lansatorul, pornește cu `--home <temp> --profile-dir <temp>\Interfata --app-dir <repo> --port <liber> --no-migrate --quiet`, verifică: serverul răspunde, `startica.port` există, a doua pornire deschide a doua fereastră, închiderea primei păstrează serverul, închiderea ultimei îl oprește, apare backupul `*_inchidere_*`, `startica.port` dispare, `Jurnale\startica.log` există; al doilea scenariu: `--port` ocupat de un `TcpListener` al testului → serverul pornește pe alt port, citit din `startica.port`.
- Persistență: nimic din acest spec nu schimbă schema. Verificarea before/after pe copii ale `Startica_Date/startica.db` în `%TEMP%` se face o dată, la punctul de control B: aceeași bază pornită prin `npm start` (fără `home`) și prin `Startica.exe --home <temp>` (cu baza copiată acolo) dă același `/api/state` (revizie, număr de înregistrări) și același `/api/health.database` relativ la rădăcina respectivă.
- Baza reală `Startica_Date/startica.db` din repo nu se modifică și nu se folosește ca `home`.

Puncte de control (revizuite de arhitect înainte de a continua): A după Faza 0 (server), B după lansator + test de ciclu de viață, C după instaler construit și instalat de probă, D înainte de bump și împachetarea finală.

## 6. Ce cere acordul utilizatorului

1. Instalarea Inno Setup 6 per utilizator pe calculatorul de dezvoltare (winget sau instalerul oficial cu `/CURRENTUSER`).
2. Schimbări vizibile pentru client: instalare prin `Startica_Setup_1.3.0.exe` în loc de ZIP; datele mutate în `%LOCALAPPDATA%\Startica` (copiate, cele vechi rămân); scurtătura de pe Desktop înlocuită; fereastra deschisă cu Edge dacă există, altfel Chrome (azi era invers); butoane noi: „Copiază mesaj(e)” în De notificat, „Tipărește” în fișa copilului, „Raport de diagnostic” în Backup și setări; versiunea afișată în bara laterală.
3. Fără certificat de semnare: la prima rulare a instalerului descărcat de pe internet, Windows SmartScreen afișează „Editor necunoscut” (o dată). Alternative, dacă devine o problemă: Azure Trusted Signing (~10 $/lună) sau certificat OV (~200–400 €/an); disponibilitatea pentru o firmă din Republica Moldova este **neverificată**.
4. Testul instalerului pe calculatorul de dezvoltare instalează Startica în `%LOCALAPPDATA%\Programs\Startica` și, la prima pornire, poate propune preluarea evidenței din repo (copie, nu mutare). Se poate refuza în dialog sau se poate testa într-o mașină virtuală / Windows Sandbox.
