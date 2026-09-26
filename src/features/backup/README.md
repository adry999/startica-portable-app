# backup

Copiile locale și externe ale bazei, previzualizarea și restaurarea unui backup (din lista locală sau citit pe loc dintr-un folder extern), configurarea folderului extern. Ecranul „Stare” arată sănătatea backupului (`renderBackupHealth`); dialogul de restaurare și formularul de setări stau tot aici.

Modul **independent**: nu depinde de alt feature, nu publică și nu consumă evenimente. Scrierea în istoric folosește portul `AuditTrail`, injectat de `app/`.

## Public API

### `index.server.mjs`

| Export | Rol |
| --- | --- |
| `createBackupService({ database, databaseFile, backupDirectory, dataDirectory, readSetting, writeSetting, autoBackupIntervalMs })` | `backup`, `safeBackup`, `autoBackup`, `health`, `listBackups`, `resolveBackupFile`, `listExternalBackups`, `resolveExternalBackupFile`, `cancelScheduledBackup` |
| `createBackupRoutes({ backupService, readSetting, writeSetting, auditTrail, runRevisionTransaction, replaceAllRecords, dataDirectory, backupDirectory })` | `GET /api/health`, `GET /api/backups`, `GET /api/external-backups`, `GET /api/backup-preview`, `POST /api/backup`, `POST /api/restore`, `POST /api/settings` |

## Dependențe

| Import | De ce |
| --- | --- |
| `#core/server/errors/domain-error.mjs` | `fail()` pentru nume invalid, confirmare lipsă, folder extern invalid |
| `#core/server/persistence/content-digest.mjs` | hash-ul care verifică o copie externă identică cu originalul |
| `#core/server/database/sql-string-literal.mjs` | citarea căii pentru `VACUUM INTO`, care nu acceptă parametri legați |
| `#core/server/files/file-timestamp.mjs`, `#core/server/files/remove-file-if-present.mjs` | numele fișierului de backup; curățarea fișierelor `.tmp` |
| `#shared/domain/record-schema.mjs` | `emptyState`, `validateState` |
| `#shared/domain/records-report.mjs` | `summary` pentru previzualizarea unei restaurări |
| `#shared/format/html-escape.mjs`, `#shared/format/date-format.mjs`, `#shared/format/file-size-format.mjs` | randare |
| `#shared/ui/records-summary.mjs` | markup-ul comun de rezumat (folosit și la import Excel/CSV) |
| `#shared/contracts/audit-trail.mjs`, `#shared/contracts/persistence.mjs`, `#shared/contracts/record-types.mjs` | tipuri |
| `node:sqlite` | citirea și verificarea integrității unei copii |

## Consumatori

Composition root-ul serverului creează serviciul cu conexiunea reală la bază, `backupDirectory` și `dataDirectory`, și îl injectează în rute, alături de `auditTrail` (implementat de `audit-log`) și `runRevisionTransaction`/`replaceAllRecords` din `core`.

## Structură

```
backup/
├── README.md
├── backup.types.d.mts             # BackupHealth, BackupFileEntry, BackupService, dependențele rutelor și ale controller-ului
├── index.server.mjs
├── domain/
│   ├── backup-retention.mjs       # ★ ce se păstrează la curățare (pur)
│   └── backup-retention.test.mjs
└── server/
    ├── backup-snapshot.mjs        # citește și validează un fișier .db
    ├── backup.service.mjs         # ★ backup local, copie externă, retenție, sănătate
    ├── backup.service.test.mjs
    ├── external-backup-folder.mjs # validează folderul extern față de baza și backupurile locale
    ├── backup.routes.mjs
    └── backup.routes.integration.test.mjs
```

## Decizii

- **Copie verificată înainte de redenumire.** `VACUUM INTO` scrie într-un `.tmp`; abia după `readBackupSnapshot` (integritate + parsare) fișierul e redenumit la numele final. Un fișier cu numele final e întotdeauna o copie validă.
- **Copiile dinaintea unei operațiuni ireversibile nu expiră.** `selectBackupsToKeep` le păstrează pe cele cu `inainte-` sau `migrare` în nume, indiferent de vechime; restul retenției e ultimele 20 de copii, câte una pentru fiecare din ultimele 30 de zile și 12 luni cu backup.
- **Folderul extern urmează aceeași retenție ca cel local.** Fără ea, fiecare copie automată rămânea în Drive pentru totdeauna; o curățare externă eșuată devine un avertisment pe `warning`, nu un backup ratat.
- **Numele backupului validat ca nume de fișier, nu ca cale.** `resolveBackupFile` refuză orice ar putea ieși din folderul de backup (`../`, cale absolută).
- **Copia externă se verifică prin hash**, nu doar prin dimensiune: `sha256Hex` pe fișierul local și pe copie trebuie să coincidă înainte de redenumire.
- **Backupul automat rărit, dar cu reîncercare imediată** dacă ultima copie (locală sau externă) a eșuat — altfel utilizatorul ar afla abia după expirarea intervalului.
- **`/api/backup-preview` reconstruiește raportul de import** (`summary` + `errors`) direct din regulile de validare.
- **Restaurarea dintr-un folder extern citește fișierul pe loc**, cu aceeași validare de folder ca la Setări (`assertUsableExternalFolder`); nu se copiază nimic în `Startica_Backup` înainte de restaurare. `GET /api/external-backups?dir=` listează copiile din acel folder (cu `bytes`), `dir` opțional pe `GET /api/backup-preview` și `POST /api/restore` alege între lista locală și folderul extern, prin helper-ul comun `resolveRestoreFile`.
- **O eroare de citire a unui fișier extern care nu vine deja din `fail()`** (fișier „online-only” din Drive, neîncă descărcat) se împachetează într-un mesaj interpretabil de operator, cu stiva originală doar în jurnal — vezi `readRestoreSnapshot` din `backup.routes.mjs`.
- **Ordinea la `POST /api/restore` cu sursă externă**: tranzacția (backup de siguranță, audit `restaurare` cu sursa/folderul/numele, apoi înlocuirea înregistrărilor) se încheie înainte de orice atingere a setării `externalDir`. Abia după COMMIT: dacă `externalDir` era gol, se configurează folderul folosit (`configureExternalDir`, extras și refolosit de `POST /api/settings`) și se face o copie de configurare; dacă e alt folder, rămâne neschimbat, cu avertisment; dacă e același, nimic. Setarea înainte de tranzacție ar trimite în Drive copia goală dinaintea restaurării.

## Teste

```
node --test "src/features/backup/**/*.test.mjs"
```

- Retenție: funcție pură.
- Serviciu: `DatabaseSync` reală într-un folder temporar, cu `applySchema`; setări memorate într-o hartă în memorie; inclusiv `resolveExternalBackupFile`/`listExternalBackups`.
- Rute: `startTestApplication`, capătul la capăt HTTP (backup manual, previzualizare, restaurare, setări). Proba „calculator nou”: o aplicație A cu date reale și folder extern configurat, apoi o aplicație B pornită goală într-un alt folder temporar, care listează, previzualizează și restaurează din folderul lui A — starea, `externalDir` și istoricul lui B ajung identice, plus variantele din §6 al designului (folder deja configurat, aceeași sursă, copie deteriorată, folder rezervat sau relativ, nume invalid).
