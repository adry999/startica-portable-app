# startica-sync-server

Server mic de reconciliere pentru sincronizarea între calculatoarele aceleiași grădinițe
(spec `docs/design/screens/18-sincronizare.md`, plan `docs/superpowers/plans/2026-09-27-sincronizare.md`).
Node 22 + `node:sqlite`, zero dependențe, un singur proces, o singură bază SQLite
(`sync.db`, toate filialele, cheie `branch_id`). Nu importă nimic din `src/` — se
livrează separat, ca folder propriu.

## Rulare locală

```
node sync-server/src/main.mjs
```

Configurare exclusiv prin variabile de mediu (niciuna nu e obligatorie, în afară de
`SYNC_DATA_DIR` dacă nu convine implicita):

| Variabilă               | Implicit                                | Rol                                                                 |
| ------------------------ | ---------------------------------------- | -------------------------------------------------------------------- |
| `SYNC_PORT`               | `8790`                                    | Portul HTTP (fără TLS — vezi Caddy mai jos).                        |
| `SYNC_BIND`               | `127.0.0.1`                               | Adresa pe care ascultă (loopback sau rețea privată).                |
| `SYNC_DATA_DIR`           | `<rădăcina depozitului>/sync-server/data` | `sync.db`, `backups/`. Cale absolută dacă e setată explicit.        |
| `SYNC_SETUP_KEY`          | —                                         | Cheia primului calculator (fără ea, nimeni nu se poate conecta).    |
| `SYNC_SETUP_KEY_ALWAYS`   | `0`                                       | `1` = cheia funcționează mereu, nu doar când nu există dispozitive (recuperare). |
| `SYNC_BACKUP_HOUR`        | `3`                                       | Ora UTC la care rulează `VACUUM INTO` zilnic.                        |
| `SYNC_BACKUP_KEEP`        | `14`                                      | Câte fișiere de backup se păstrează.                                |
| `SYNC_HISTORY_DAYS`       | `365`                                     | Cât ține istoricul `changes`; mai vechi → 410 (resincronizare din snapshot). |
| `SYNC_TRUST_PROXY`        | `0`                                       | `1` = are încredere doar în **ultimul salt** al `X-Forwarded-For` — cel adăugat chiar de Caddy-ul propriu; primul salt (ales de client) nu e niciodată de încredere, ca să nu poată ocoli limitatorul de rată. |

Exemplu, pornire de dezvoltare cu prima cheie de instalare:

```
SYNC_DATA_DIR=C:\tmp\sync-data SYNC_PORT=8790 SYNC_SETUP_KEY=dev node sync-server/src/main.mjs
```

## Teste

```
npm test          # din sync-server/, sau
node --test "sync-server/src/**/*.test.mjs"   # din rădăcina depozitului
```

`npm run check` la rădăcina depozitului rulează și aceste teste (glob-ul
`sync-server/src/**/*.test.mjs` din `package.json#scripts.test`).

## Găzduire: VPS mic în UE (Docker Compose + Caddy)

Serverul ascultă doar HTTP, pe loopback sau pe o rețea privată — TLS îl termină
Caddy, cu certificat automat Let's Encrypt.

```
sync-server/
├── Dockerfile
├── docker-compose.yml
└── Caddyfile.example   # copiază-l ca Caddyfile și schimbă domeniul
```

Pași pe VPS:

1. `cp Caddyfile.example Caddyfile` și pune adresa reală (`sync.exemplul-tau.ro`).
2. `.env` alături de `docker-compose.yml`, cu `SYNC_SETUP_KEY` (o cheie generată o
   singură dată, pentru primul calculator) și restul variabilelor de mai sus, dacă
   diferă de implicite.
3. `docker compose up -d`.
4. Pe primul calculator conectat: „Backup și setări → Sincronizare → Primul calculator”,
   cu adresa `https://sync.exemplul-tau.ro` și cheia de instalare.
5. Backup: zilnic, în volumul `sync-data` (`backups/sync_<oră>.db`), păstrat
   `SYNC_BACKUP_KEEP` fișiere; pentru o copie și în altă parte (recomandat), sincronizează
   volumul (`rsync`/`rclone`) undeva în afara VPS-ului.
6. Restaurare: oprește serverul, înlocuiește `sync.db` cu unul din `backups/`, pornește
   din nou — dispozitivele existente rămân valabile (tokenurile sunt în bază).

## Rulare manuală de la un cap la altul (dezvoltare, un singur calculator)

Vezi Task 14 din planul de sincronizare pentru scenariul complet (server + două
instanțe ale aplicației, editare simultană, conflict, deconectare). Rezumat:

```
# 1. server (terminal 1)
SYNC_DATA_DIR=C:\tmp\sync-data SYNC_PORT=8790 SYNC_SETUP_KEY=dev node sync-server/src/main.mjs

# 2. teste (terminal 2), din rădăcina depozitului
node --test "sync-server/src/**/*.test.mjs"
```

## Contractul HTTP (Faza 1)

Toate rutele `/v1/*` (în afară de `POST /v1/devices/pair`) cer
`Authorization: Bearer <token>`; token-ul se ține hash-uit (`sha256`) pe server și în
clar doar în `sync.json` de pe calculator. Corpul e JSON, fără date în URL (id-urile din
cale sunt UUID-uri); limita e 20 MB, 64 MB pentru `snapshot`.

| Metodă & cale                                 | Auth      | Corp / query                                | Răspuns                                                                        |
| ---------------------------------------------- | --------- | -------------------------------------------- | -------------------------------------------------------------------------------- |
| `POST /v1/devices/pair`                        | — (limitat la 5/10 min per IP) | `{ code? , setupKey?, name, os }`            | `{ deviceId, token, createdBy }` — 400 cod greșit/expirat, 403 cheie neacceptată, 429 prea multe încercări |
| `POST /v1/pairing-codes`                       | dispozitiv | —                                             | `{ code, expiresAt }`                                                           |
| `GET /v1/devices`                              | dispozitiv | —                                             | `{ devices: [{ id, name, os, lastSeenAt, lastBranchId, revokedAt, me }] }`      |
| `POST /v1/devices/:id/revoke`                  | dispozitiv | —                                             | `{ ok }` — 400 pe sine însuși                                                   |
| `GET /v1/status`                               | dispozitiv | —                                             | `{ branches, devices, lastBackupAt, serverTime }` (numere, nu liste)            |
| `GET /v1/branches`                             | dispozitiv | —                                             | `{ branches: [{ id, name, color, address, createdAt, updatedAt }] }`           |
| `POST /v1/branches`                            | dispozitiv | `{ id, name, color, address, createdAt }`    | `{ branch, created }` — idempotent după id                                     |
| `POST /v1/branches/:id/changes`                | dispozitiv | `{ changes: [{ changeId, kind, recordId, baseRevision, payload, changedAt }] }` | `{ results: [{ changeId, status: 'applied'\|'superseded'\|'conflict', revision, head? }] }` |
| `GET /v1/branches/:id/changes?since=&limit=`   | dispozitiv | —                                             | `{ changes: [{ seq, changeId, kind, recordId, revision, payload, changedAt, device }], nextSince, headSeq }` — 410 dacă cursorul e mai vechi decât istoricul păstrat |
| `POST /v1/branches/:id/snapshot`               | dispozitiv | `{ entries: [{ kind, id, payload, updatedAt }] }` (64 MB) | `{ headSeq }` — 409 dacă filiala are deja înregistrări                         |
| `GET /v1/branches/:id/snapshot`                | dispozitiv | —                                             | `{ records: { <kind>: [{ id, revision, payload, updatedAt }] }, headSeq }`     |
| `GET /v1/branches/:id/events`                  | dispozitiv | —                                             | SSE: `event: change\ndata: {"seq":N}` după un push aplicat; heartbeat la 25 s   |

Politica de conflict (per `kind`): `children`, `groups`, `categories`, `visits` intră în
conflict la o revizie depășită (nimic scris, capul rămâne cel de pe server, clientul
parchează modificarea); restul (`payments`, `expenses`, `attendance`, `sms_templates`,
`settings`) sunt „ultima modificare câștigă” (`changedAt` mai mare), cealaltă devine
`superseded`. Un `changeId` reluat (retry de rețea) întoarce rezultatul memorat, fără să
scrie a doua oară — inclusiv pentru `superseded`, care întoarce și `head`.

Culoarea filialei e una dintre `orange`, `mint`, `yellow`, `pink` (paleta din
`src/shared/domain/branch.mjs`), nu un cod hex.

## Jurnal

Fiecare cerere HTTP e jurnalizată pe o linie: metodă, cale, status, id de dispozitiv
(dacă e autentificată). Niciodată corpul cererii sau token-ul — sunt date despre copii.
