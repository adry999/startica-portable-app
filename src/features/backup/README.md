# backup

Copiile locale și externe ale bazei, previzualizarea și restaurarea unui backup, configurarea folderului extern. Ecranul „Stare” arată sănătatea backupului (`renderBackupHealth`); dialogul de restaurare și formularul de setări stau tot aici.

Modul **independent**: nu depinde de alt feature, nu publică și nu consumă evenimente. Scrierea în istoric folosește portul `AuditTrail`, injectat de `app/`.

## Public API

### `index.server.mjs`

| Export | Rol |
| --- | --- |
| `createBackupService({ database, databaseFile, backupDirectory, readSetting, writeSetting, autoBackupIntervalMs })` | `backup`, `safeBackup`, `autoBackup`, `health`, `listBackups`, `resolveBackupFile`, `cancelScheduledBackup` |
| `createBackupRoutes({ backupService, readSetting, writeSetting, auditTrail, runRevisionTransaction, replaceAllRecords, dataDirectory, backupDirectory })` | `GET /api/health`, `GET /api/backups`, `GET /api/backup-preview`, `POST /api/backup`, `POST /api/restore`, `POST /api/settings` |
| `readBackupSnapshot(file)` | citește un fișier `.db` și verifică integritatea lui înainte de a-l accepta ca stare |
| `selectBackupsToKeep(files)` | regula de retenție, pură |

### `index.web.mjs`

| Export | Rol |
| --- | --- |
| `createBackupHealthView({ elements, isExternalDirLocked })` | întoarce `renderBackupHealth(health)` |
| `createBackupController({ elements, sessionState, requestJson, submitMutation, acceptResult, showNotice, renderSaveStatus })` | leagă butoanele de backup, dialogul de restaurare și formularul de setări; întoarce `{}` (ascultătorii se atașează o singură dată, la creare) |

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

Composition root-ul serverului creează serviciul cu conexiunea reală la bază și îl injectează în rute, alături de `auditTrail` (implementat de `audit-log`) și `runRevisionTransaction`/`replaceAllRecords` din `core`. Composition root-ul de web creează view-ul și controller-ul cu elementele DOM ale ecranului „Stare” și `sessionState`-ul comun al aplicației.

## Structură

```
backup/
├── README.md
├── backup.types.d.mts             # BackupHealth, BackupFileEntry, BackupService, dependențele rutelor și ale controller-ului
├── index.server.mjs
├── index.web.mjs
├── domain/
│   ├── backup-retention.mjs       # ★ ce se păstrează la curățare (pur)
│   └── backup-retention.test.mjs
├── server/
│   ├── backup-snapshot.mjs        # citește și validează un fișier .db
│   ├── backup.service.mjs         # ★ backup local, copie externă, retenție, sănătate
│   ├── backup.service.test.mjs
│   ├── external-backup-folder.mjs # validează folderul extern față de baza și backupurile locale
│   ├── backup.routes.mjs
│   └── backup.routes.integration.test.mjs
└── web/
    ├── backup-health.view.mjs     # randează starea backupului
    └── backup.controller.mjs      # ★ backup manual, previzualizare și confirmare restaurare, formular de setări
```

## Decizii

- **Copie verificată înainte de redenumire.** `VACUUM INTO` scrie într-un `.tmp`; abia după `readBackupSnapshot` (integritate + parsare) fișierul e redenumit la numele final. Un fișier cu numele final e întotdeauna o copie validă.
- **Copiile dinaintea unei operațiuni ireversibile nu expiră.** `selectBackupsToKeep` le păstrează pe cele cu `inainte-` sau `migrare` în nume, indiferent de vechime; restul retenției e ultimele 20 de copii, câte una pentru fiecare din ultimele 30 de zile și 12 luni cu backup.
- **Numele backupului validat ca nume de fișier, nu ca cale.** `resolveBackupFile` refuză orice ar putea ieși din folderul de backup (`../`, cale absolută).
- **Copia externă se verifică prin hash**, nu doar prin dimensiune: `sha256Hex` pe fișierul local și pe copie trebuie să coincidă înainte de redenumire.
- **Backupul automat rărit, dar cu reîncercare imediată** dacă ultima copie (locală sau externă) a eșuat — altfel utilizatorul ar afla abia după expirarea intervalului.
- **`/api/backup-preview` reconstruiește raportul de import** (`summary` + `errors`) direct din regulile de validare.

## Teste

```
node --test "src/features/backup/**/*.test.mjs"
```

- Retenție: funcție pură.
- Serviciu: `DatabaseSync` reală într-un folder temporar, cu `applySchema`; setări memorate într-o hartă în memorie.
- Rute: `startTestApplication`, capătul la capăt HTTP (backup manual, previzualizare, restaurare, setări).
