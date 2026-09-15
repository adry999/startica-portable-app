# Restaurare din folderul extern și corecțiile mici din punctul de control F (1.4.0)

Stare la scriere: `feat/1.4.0` pornit din `master` @ `9e8e24d` (v1.3.4), `npm test` = 282 de teste (280 trec, 2 sărite). Decizia din 15 septembrie 2026 privind copia în afara calculatorului rămâne în vigoare: folder extern sincronizat de Google Drive for desktop cu contul grădiniței, copii necriptate, fără sincronizare bidirecțională, multi-PC doar viziune. Utilizatorul a aprobat abordarea 1 (citire pe loc) și toate deciziile de mai jos; răspunsurile lui sunt marcate **(U)**.

## 1. Problema

Când calculatorul se pierde, pașii de azi din `CITESTE-MA.txt` cer copierea manuală a celui mai nou `startica_….db` din folderul Drive în `%LOCALAPPDATA%\Startica\Startica_Backup`, apoi restaurarea din lista locală și reconfigurarea folderului extern. Trei pași în Explorer pe care operatorul îi face o dată la câțiva ani, sub presiune. Ținta: RPO o zi, RTO ~30 de minute pe un calculator nou, fără copiere de fișiere.

Fapte verificate în cod, care fixează designul:

- Restaurarea nu atinge setările: `readRawSnapshot` citește doar `records`/`app_state` (`backup-snapshot.mjs:11-25`), iar `replaceAllRecords` șterge și rescrie doar `records` (`revision-transaction.mjs:86-103`). `externalDir`-ul vechiului calculator nu poate ajunge în baza nouă printr-o restaurare.
- `backupBefore` pe o bază goală funcționează (`VACUUM INTO` al schemei goale, ~30 KB, fișier `inainte-restaurare` permanent). După COMMIT, `autoBackup()` este sărit, pentru că `lastBackupAt` tocmai a fost resetat de copia dinaintea restaurării.
- Backupul de la pornire există (`main.mjs:85`), deci lista locală nu e goală nici pe un calculator nou; dialogul trebuie totuși să se deschidă și când este.
- `copyExternally` deschide deja fișiere din folderul Drive cu `readBackupSnapshot(copy)`: citirea pe loc a unei copii din acel folder nu e o premieră.
- Corpul cererii e limitat la 20 MB (`request-guards.mjs:3`); baza reală are 5,7 MB. Lansatorul ajunge la „Pornire cu evidență goală” când operatorul refuză migrarea (`Startica.cs:844-909`), exact starea din care începe restaurarea nouă.

## 2. Decizii

| Decizie | Alegere | Motiv |
| --- | --- | --- |
| Sursa copiei | Citire pe loc dintr-un folder absolut trimis de client; aceeași validare ca la folderul extern din Setări | Snapshot-ul e citit integral în memorie și fișierul e închis înainte de tranzacție; o singură cale de restaurare |
| Alegerea folderului **(U)** | Operatorul scrie/lipește calea în dialogul de restaurare; precompletată cu `health.externalDir` când există | Chrome `--app` nu poate da serverului calea unui folder ales nativ |
| Orice folder **(U)** | Se acceptă orice folder absolut (Drive, stick USB, NAS/UNC), cu validarea din Setări | Nicio muncă în plus; scenariul „stick de la contabilă” e real |
| Fișiere acceptate | Doar nume simple care respectă `BACKUP_NAME`, în folderul dat | Fără separatori în nume nu există traversare; `.tmp` rămân invizibile |
| Setarea de după restaurare **(U)** | Dacă `externalDir` e gol: se setează folderul folosit, cu auditul „configurare backup” și `safeBackup('configurare')`, strict DUPĂ tranzacție; dacă e alt folder: rămâne, cu avertisment | Calculatorul nou e protejat imediat; setarea înainte ar trimite în Drive copia goală dinaintea restaurării |
| Copia dinaintea restaurării | Rămâne și pe baza goală | Regula „restaurarea face mereu o copie înainte” nu are excepții de explicat |
| Audit | O intrare `restaurare` cu sursa, folderul și numele fișierului, în aceeași tranzacție, pentru ambele surse | Azi istoricul arată doar înregistrările schimbate, nu de unde au venit |
| Lansator **(U)** | `Startica.exe` nu se reconstruiește; pașii pentru calculator nou intră în `GHID-LIVRARE.md` și `CITESTE-MA.txt` | Cost zero, fără risc de regresie în lansator |
| Livrare | `Livrare\Startica_Setup_1.4.0.exe` construit de `scripts\pachet-client\build-client-package.ps1`, SHA-256 în `Livrare\NOTA-LIVRARE-1.4.0.md` | Același canal ca 1.3.x |
| Corecții F **(U)** | Punctele 1–5 intră în 1.4.0; coloana lipită „Copii” și scroll-ul orizontal la Achitări ≤1024 px → 1.4.1 | Bounded vs. proiect propriu de „tabele late” |

Abordări respinse: copierea fișierului în `Startica_Backup` înainte de restaurare (copiere la fiecare previzualizare, coliziuni de nume, copia intră în retenția locală, două căi de cod pentru ceva ce auditul consemnează oricum) și încărcarea fișierului din browser (nu poate precompleta folderul și nu poate lista copiile, contrar deciziei utilizatorului).

## 3. A. Serverul (`src/features/backup/server/`)

### 3.1 `backup.service.mjs`

- `assertBackupName(name)` extras din `resolveBackupFile`: `typeof name === 'string' && basename(name) === name && BACKUP_NAME.test(name)`, altfel `fail('Nume de backup invalid.')`.
- `listExternalBackups(dir)`: `assertUsableExternalFolder(dir, [dataDirectory, backupDirectory])`, apoi `fileList(dir)` cu câmpul în plus `bytes` (`statSync().size`), cele mai noi primele. `readdirSync` eșuat (EPERM, cale UNC indisponibilă) → `fail('Folderul nu poate fi citit.')`. Serviciul primește `dataDirectory` în dependențe (azi îl au doar rutele).
- `resolveExternalBackupFile(dir, name)`: aceeași validare a folderului, `assertBackupName`, `join(dir, name)`, `existsSync` altfel `fail('Backup inexistent.')`. Fără `realpath`, fără verificări de symlink: folderul Drive e un folder obișnuit sau o literă de unitate virtuală; UNC e permis. Fără limită de mărime: calea locală nu are niciuna, profilul de memorie e același.
- `fileList` primește și `bytes`; `BackupFileEntry` devine `{ name, modified, bytes }` (câmp nou, compatibil cu lista locală).

### 3.2 Rute (`backup.routes.mjs`)

| Rută | Cerere | Răspuns 200 | Erori 400 |
| --- | --- | --- | --- |
| `GET /api/external-backups?dir=` | `dir` = cale absolută, codificată URL | `{ folder, backups: BackupFileEntry[] }`, `folder` = calea normalizată | „Alege un folder existent, folosind calea completă.”, „Alege un folder diferit de baza de date și backupurile locale.”, „Folderul nu poate fi citit.” |
| `GET /api/backup-preview?name=&dir=` | `dir` opțional; cu `dir` → `resolveExternalBackupFile` | neschimbat: `{ …summary, errors, notes }` | cele de mai sus + „Nume de backup invalid.”, „Backup inexistent.”, „Backup corupt.”, mesajul de citire (§3.3) |
| `POST /api/restore` | `{ name, dir?, confirm: 'RESTAUREAZA', revision, requestId }` | `RevisionEnvelope` + `warning` | idem + „Confirmă restaurarea.” |

Helper în rute: `resolveRestoreFile({ name, dir })` → `dir ? backupService.resolveExternalBackupFile(dir, name) : backupService.resolveBackupFile(name)`. `dir` gol sau absent înseamnă lista locală.

### 3.3 Citirea unei copii externe

`readBackupSnapshotDetails` pe un fișier extern se împachetează: orice eroare care nu e deja `DomainError` devine `fail('Copia nu a putut fi citită. Dacă e în Google Drive, așteaptă să fie descărcată (bifa verde) și încearcă din nou.', 400)`, cu stiva originală în `console.error`. Motiv: fișierele „online-only” din Drive se descarcă sincron la deschidere; offline, deschiderea eșuează cu o eroare de sistem pe care operatorul nu o poate interpreta. Un fișier parțial sau corupt pică oricum la `PRAGMA integrity_check` → „Backup corupt.”.

### 3.4 Ordinea în `POST /api/restore`

1. Confirmare, rezolvarea fișierului, `readBackupSnapshotDetails`, `validateState` — fișierul e închis aici.
2. `runRevisionTransaction(body, { action: 'restaurare', backupBefore: true }, () => { auditTrail.recordChange({ action: 'restaurare', recordType: null, recordId: null, before: null, after: { sursa: dir ? 'extern' : 'local', folder, name } }); replaceAllRecords(state, 'restaurare'); })`. `folder` = `backupDirectory` pentru sursa locală. `recordType: null` e deja folosit de ruta de setări.
3. Doar pentru sursa externă, după ce tranzacția a întors rezultatul:
   - `!readSetting('externalDir')` (pe o bază nouă setarea lipsește și `readSetting` întoarce `undefined`, nu `''`) → `configureExternalDir(folder)`: `writeSetting('externalDir', folder)`, `lastExternal`/`externalError` golite, auditul `configurare backup` (`before: { externalDir: '' }`, `after: { externalDir: folder }`), apoi `backupService.safeBackup('configurare')`; avertismentul lui se concatenează la `warning`, iar `health` se recitește. `configureExternalDir` e extras din ruta `POST /api/settings`, care îl refolosește.
   - altfel, dacă folderul setat diferă de cel folosit: `warning += 'Folderul extern configurat rămâne ' + setat + '; schimbă-l în Setări dacă vrei copiile în folderul folosit la restaurare.'`.
   - dacă e același folder: nimic.

Rezultatul întors rămâne `RevisionEnvelope`-ul tranzacției, cu `warning` și `health` actualizate. `README.md` și `backup.types.d.mts` se actualizează (serviciu, rute, `BackupFileEntry.bytes`, `BackupControllerDependencies.elements`).

## 4. A. Interfața (`web/index.html`, `src/features/backup/web/`)

### 4.1 Dialogul `#restoreDialog`

```
<h2>Restaurare</h2>
<fieldset class="restore-source" id="restoreSource">
  <legend>Sursă</legend>
  <label><input type="radio" name="restoreSource" value="local" checked>Backupuri locale</label>
  <label><input type="radio" name="restoreSource" value="extern">Din folderul extern</label>
</fieldset>
<div id="restoreExternal" hidden>
  <label>Folderul extern (calea completă)<input id="restoreFolder" autocomplete="off" placeholder="ex. G:\My Drive\Startica-backup"></label>
  <button type="button" class="btn btn-ghost" id="restoreFolderLoad">Caută copii</button>
  <p class="notice">Startica nu poate confirma sincronizarea: verifică în Google Drive că fișierul are bifa verde (descărcat).</p>
</div>
<label>Backup<select id="backupSelect"></select></label>
<div id="restorePreview"></div>
<label>Scrie RESTAUREAZA<input id="restoreConfirm" autocomplete="off"></label>
<button class="btn btn-primary" id="commitRestore">Restaurează</button>
```

Stilul fieldset-ului stă în `web/styles/features/backup.css`. Fără elemente noi în `compose-screens.mjs` în afara celor patru id-uri (`restoreSource`, `restoreExternal`, `restoreFolder`, `restoreFolderLoad`).

### 4.2 Fluxul (`backup.controller.mjs`)

- `restoreData` devine `{ name, dir, revision } | null`; `dir = ''` pentru sursa locală.
- Deschidere: lista locală se încarcă ca azi, dar dialogul se deschide și fără backupuri: `#backupSelect` gol, `#restorePreview` = `<p class="notice">Nu există backupuri locale.</p>`, `#commitRestore` dezactivat. Sursa revine mereu pe „local” la deschidere. `#restoreFolder` se precompletează cu `sessionState.health.externalDir` (sau rămâne valoarea scrisă anterior în aceeași sesiune, dacă nu e goală).
- Comutarea sursei: golește `#backupSelect`, `#restorePreview`, `restoreData`, dezactivează `#commitRestore`; pe „local” reîncarcă `/api/backups`; pe „extern” arată `#restoreExternal` și, dacă `#restoreFolder` nu e gol, apasă automat „Caută copii”.
- „Caută copii”: `GET /api/external-backups?dir=` cu `encodeURIComponent(restoreFolder.value.trim())`. Opțiunile: `formatDateTime(modified) · name`, prima cu sufixul ` · cea mai recentă`. Listă goală → `<p class="danger">Nu există copii Startica în acest folder.</p>`. Eroare → mesajul serverului ca `<p class="danger">`. Dacă `modified` al primei copii e mai vechi de o zi (același prag ca `STALE_AFTER_MS`), sub listă apare `<p class="notice">Cea mai recentă copie e din <data>; verifică dacă Drive a terminat sincronizarea pe acest calculator.</p>`. Apoi `previewRestore()`.
- `previewRestore()`: interogarea primește `&dir=` când sursa e externă; răspunsul se ignoră dacă între timp s-a schimbat selecția sau folderul; erorile de previzualizare se randează în `#restorePreview` ca `<p class="danger">` (nu doar ca notiță), cu `#commitRestore` dezactivat.
- Confirmare: `submitMutation('/api/restore', { name, dir, confirm }, revision)`; la succes dialogul se închide și `showNotice('Datele au fost restaurate din folderul extern.')` (sursa locală păstrează comportamentul de azi); dacă `result.health.externalDir` era gol înainte și acum e folderul folosit, notița continuă cu ` Folderul a fost setat pentru copiile viitoare.`. `warning`-ul din răspuns îl afișează deja `acceptResult`.
- `#restoreFolder` nu intră în `settingsDirty`: e un câmp al dialogului, nu al formularului de setări.

## 5. B. Corecțiile din punctul de control F

| # | Ce | Fișiere | Corecția |
| --- | --- | --- | --- |
| 1 | Propoziția din starea goală a tabelului iese din ecran la ≤1024 px | `web/styles/components.css` | `.table-wrap { container-type: inline-size; }` și `.table-wrap td.empty { display: block; position: sticky; left: 0; width: 100cqw; box-sizing: border-box; }` — celula cu `colspan` are lățimea tabelului derulat, textul centrat ajungea în afara ferestrei |
| 2 | `td.amount` la dreapta, `th` la stânga | `web/styles/components.css`, `web/index.html` (`#notifyHead`, `#statusHead`), `web/styles/features/payments.css` | `th.amount { text-align: right; }` și `class="amount"` pe antetele statice cu sume din `#notifyHead`/`#statusHead` (Taxă, Achitat, Rest, Credit); antetul Achitări e generat de `listHeadMarkup` (`#shared/ui/record-list-sort.mjs`, fără clasă pe coloană), deci primește regula `#payments table th:nth-child(4) { text-align: right; }` în `payments.css`, ca la Cheltuieli (`expenses.css`), fără schimbarea API-ului partajat; `.table-sort` e `inline-flex`, deci `text-align` funcționează |
| 3 | Cardul „Achitări de urmărit” ascunde numărul real cât timp există copii fără taxă | `src/features/dashboard/web/dashboard.view.mjs:122-144`, `dashboard.view.test.mjs` | Un singur card: `count = toNotify`; cu `missingFeeCount > 0` detaliul devine `${toNotify} de notificat · ${missingFeeCount} fără taxă (nu se pot calcula)`, acțiunea „Completează” → `fees` când `toNotify === 0`, altfel „Vezi lista” → `notify`; fără copii fără taxă, textul de azi |
| 4 | „Categorie nouă” ignoră `canonicalCategoryName` | `src/features/expenses/web/expense-categories.controller.mjs:40-58` | `const name = canonicalCategoryName(nameInput.value, readRecords())`; dacă `records.categories` are deja acel nume → `showNotice('Categoria există deja.', true)` fără cerere. Fără unicitate pe server: categoriile sunt etichete text (vezi comentariul din `expense-categories.routes.mjs`), duplicatele sunt inofensive |
| 5 | `scripts/build-icon.mjs` fără diacritice | `scripts/build-icon.mjs` | Comentariile și mesajele rescrise cu diacritice (Regenerează, rasterizează, mărimea, fără, acoperă, scalările, găsit, căile știute, mașină, biți, octeți, „a ieșit”); niciun efect la rulare |

## 6. Teste

- **Unitare, `backup.service.test.mjs`**: `resolveExternalBackupFile` refuză folder relativ, folder inexistent, nume cu cale (`..\\x.db`), nume în afara `BACKUP_NAME`, fișier lipsă; `listExternalBackups` ignoră `.tmp` și fișierele străine, întoarce cele mai noi primele cu `bytes`.
- **Integrare, `backup.routes.integration.test.mjs`**, dovada „calculator nou”: aplicația A (`startTestApplication`) cu `externalDir = F` (folder temporar) salvează înregistrări → copiile ajung în F; aplicația B, pornită goală în alt folder temporar, listează F, previzualizează și restaurează → `/api/state` al lui B egal cu al lui A; istoricul lui B conține intrarea `restaurare` cu `sursa: 'extern'`, `folder`, `name`; `externalDir` al lui B a devenit F și F conține o copie `_configurare_` nouă. Variante: B configurat deja pe alt folder → setarea neschimbată și `warning` cu textul din §3.4; B configurat pe F → fără avertisment; fișier corupt în F → 400 „Backup corupt.”; `dir` = folderul de backupuri al lui B sau cale relativă → 400; nume cu cale → 400; `/api/external-backups` pe folder gol → `backups: []`.
- **Browser smoke, `tests/browser-smoke.mjs`**: testul creează `join(dir, 'extern')` și copiază acolo un backup local; deschide dialogul, alege „Din folderul extern”, scrie calea, „Caută copii”, verifică ≥1 opțiune cu sufixul „cea mai recentă” și totalurile în previzualizare, scrie RESTAUREAZA, restaurează; apoi `saveIndicator` = `saved`, numărul de copii neschimbat, `health.externalDir` = folderul. Pentru punctele B: la 1024 px, pe un tabel gol (`#assignTable .empty`), dreptunghiul textului stă în `innerWidth`; `th.amount` are `text-align: right` în `#statusHead`.
- **Regresii plantate** (înainte de a considera verificările valide): ruta de listare întoarce `[]` → smoke-ul pică; regula `td.empty` scoasă → smoke-ul pică; `class="amount"` scos din `#statusHead` → smoke-ul pică. Fiecare se readuce imediat la loc.

## 7. Împărțirea implementării

| Sarcină | Conținut | Fișiere deținute | Model |
| --- | --- | --- | --- |
| A1 | Serviciu, rute, tipuri, README, teste unitare și de integrare (§3, §6) | `src/features/backup/server/*`, `backup.types.d.mts`, `README.md` din backup, `create-application.mjs` (doar `dataDirectory` spre serviciu) | Sonnet |
| A2 | Dialog, controller, CSS, secțiunea din smoke (§4, §6) | `web/index.html` (doar `#restoreDialog`), `src/features/backup/web/*`, `web/styles/features/backup.css`, `compose-screens.mjs`, `tests/browser-smoke.mjs` (secțiunea de restaurare) | Sonnet |
| B1 | Punctele 1 și 2 + verificările lor din smoke | `web/styles/components.css`, `web/styles/features/payments.css`, `web/index.html` (doar `th` din `#notifyHead`/`#statusHead`), `tests/browser-smoke.mjs` (secțiunea de tabele) | Sonnet |
| B2 | Punctele 3 și 4 | `dashboard.view.mjs`, `dashboard.view.test.mjs`, `expense-categories.controller.mjs` | Sonnet |
| B3 | Punctul 5 | `scripts/build-icon.mjs` | Haiku |
| Docs | `GHID-LIVRARE.md` și `CITESTE-MA.txt`: secțiunea „Restaurare pe un PC nou” înlocuiește pașii 3–6 de azi din „Dacă se strică sau se pierde calculatorul” (evidență goală → Backup și setări → Restaurare → Din folderul extern → calea folderului Drive → cea mai recentă → previzualizare → RESTAUREAZA; folderul extern se setează singur), plus regula „închide/dezinstalează întâi Startica de pe calculatorul vechi: două calculatoare în același folder Drive și-ar șterge reciproc copiile prin retenție” | `scripts/pachet-client/GHID-LIVRARE.md`, `scripts/pachet-client/CITESTE-MA.txt` | Haiku |

A1, A2, B1, B2, B3 și Docs pornesc în paralel; A2 lucrează după contractele din §3 fără să aștepte A1. `web/index.html` și `tests/browser-smoke.mjs` sunt atinse de B1 și A2: se integrează **B1 întâi**, apoi A2 se rebazează și se integrează; A1 înaintea A2. Verificările (`npm run check`, `npm run test:e2e`, capturi) le rulează Haiku și raportează ieșirea; Opus citește fiecare diff înainte de integrare.

## 8. Porțile de verificare înainte de livrare

1. `npm run check` verde (format, typecheck, toate testele), apoi `npm run test:e2e` verde (smoke + `tests/desktop-lifecycle.ps1`).
2. Regresiile plantate din §6 demonstrate și anulate, fiecare cu ieșirea comenzii în raport.
3. Capturi la 800/1024/1280/1440 px (`STARTICA_UI_SCREENSHOTS=1` pentru fixture-ul smoke) și capturi manuale ale ecranelor Achitări, Situație, De notificat, Panou și ale dialogului de restaurare pe o **copie** a `Startica_Date` într-un folder temporar; folderul real nu se deschide niciodată din teste.
4. Proba „calculator nou” pe instalerul construit, fără să atingă `%LOCALAPPDATA%\Startica` (conține copia reală a datelor clientului): se rulează aplicația instalată cu `Startica.exe --home <folder temporar gol>` (lansatorul transmite calea serverului ca `STARTICA_HOME`; o variabilă `STARTICA_HOME` setată din afară e suprascrisă de lansator) sau în Windows Sandbox, cu un folder „Drive” temporar umplut din copii ale backupurilor reale; se refuză migrarea → Setări → Restaurare → Din folderul extern → cea mai recentă → RESTAUREAZA; se verifică datele, starea backupului (folderul setat, copie externă proaspătă), intrarea din istoric. Folderele temporare se șterg la final.
5. Versiune 1.4.0 în `package.json`; `build-client-package.ps1` produce `Livrare\Startica_Setup_1.4.0.exe`; SHA-256 și rezumatul schimbărilor în `Livrare\NOTA-LIVRARE-1.4.0.md`; `GHID-LIVRARE.md` și `CITESTE-MA.txt` actualizate înainte de construirea pachetului, ca instalerul să le conțină.

## 9. Riscuri

- Două calculatoare care scriu în același folder Drive își șterg reciproc copiile prin retenție și pot lăsa Drive să sincronizeze în ambele sensuri; tratat prin documentație („închide vechiul calculator”), nu prin cod (multi-PC rămâne viziune).
- Descărcarea unui fișier „online-only” blochează serverul câteva secunde la deschidere; acceptat pentru un singur operator. Offline, mesajul din §3.3.
- Calea precompletată poate fi diferită pe calculatorul nou (alt utilizator Windows, altă literă); operatorul o corectează în câmp, iar eroarea de folder e explicită.
- Foldere UNC sau fără drepturi: apar ca „Alege un folder existent…” sau „Folderul nu poate fi citit.”; nimic nu e scris în folderul sursă la previzualizare sau restaurare.
- `td.empty` cu `display: block` schimbă modelul de afișare al unei celule; se verifică vizual la 800/1024 pe toate tabelele goale, nu doar pe `#assignTable`.

## 10. În afara ariei

- Coloana lipită cu numele din „Copii” și umbra de derulare; scroll-ul orizontal din Achitări la 1024 px (numele se rup pe rânduri după ce sumele au devenit `nowrap` în 1.3.4) → proiectul „tabele late ≤1024 px”, 1.4.1.
- Alegător nativ de folder, WebView2, semnare de cod, reconstruirea lansatorului.
- Criptarea copiilor, sincronizare bidirecțională, lucru simultan pe două calculatoare.
- Unicitatea categoriilor pe server.
