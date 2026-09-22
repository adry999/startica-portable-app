# telegram-notify

Rezumatul zilnic prin Telegram cu aplicația închisă (zile de naștere, vizite, copii de notificat), configurarea botului, conectarea și testul de funcționare. Procesul se pornește din sarcina programată Windows, la ora aleasă în ecranul „Notificări" (implicit 08:00), și trimite rezumatul pe telefon. Ecranul „Notificări" conține panoul de conectare, starea și butonul de test; procesul de fond citește doar baza de date și se sincronizează prin fișiere de stare. Ce apare în rezumat (secțiuni activabile, orizonturi, cadența restanțelor, ora) e o preferință cross-feature (`notificationPreferences` în `settings`), citită prin `#shared/domain/notification-preferences.mjs` — nu ține de acest modul.

Modulul **independent**: nu depinde de alt feature. Importurile multi-feature (copii, vizite, plăți) se fac în `src/app/server/telegram-digest.mjs` (compositor).

## Public API

### `index.server.mjs`

| Export | Rol |
| --- | --- |
| `createTelegramService({ fetch })` | `getMe`, `findPrivateChat`, `sendMessage`, `classifyTelegramFailure` |
| `createTelegramRoutes({ dataDirectory, telegramService, auditTrail })` | `GET /api/telegram-status`, `POST /api/telegram-connect`, `POST /api/telegram-test`, `POST /api/telegram-disconnect` |
| `readTelegramConfig(dataDirectory)` | fișier `telegram.json`: `{ token, chatId, chatName, botUsername } \| null` |
| `writeTelegramConfig(dataDirectory, config)` | scriere atomică |
| `removeTelegramConfig(dataDirectory)` | ștergere |
| `readTelegramState(dataDirectory)` | fișier `telegram-stare.json`: `{ lastRun, lastSuccess, lastError, sentKeys }` |
| `writeTelegramState(dataDirectory, state)` | scriere atomică |
| `buildDailyDigest({ todayStr, birthdays, visits, overdue, sentKeys, preferences? })` | `{ text, keys }` — rezumatul pentru ziua de azi; `text: ''` dacă ziua e goală și `nothingToReportEnabled` e oprit |
| `classifyTelegramFailure(error)` | `{ kind: 'transient' \| 'permanent', message }` |
| `pruneSentKeys(sentKeys, todayStr)` | elimină cheile mai vechi de 60 de zile |

### `index.web.mjs`

| Export | Rol |
| --- | --- |
| `createTelegramSettingsController({ elements: { status, form, tokenInput, testButton, disconnectButton }, requestJson, showNotice })` | leagă formularul de conectare, butoanele de test și deconectare; la navigare și după acțiune: `GET /api/telegram-status` → randare; întoarce `{ activate }` |

## Dependențe

| Import | De ce |
| --- | --- |
| `#core/server/errors/domain-error.mjs` | `fail()` pentru token invalid, erori de rețea clasificate, bază nemigrată |
| `#core/server/files/rotating-log-file.mjs` | jurnal rotit `telegram.log` în `Jurnale\` |
| `#core/server/files/json-file.mjs` | citire/scriere atomică pentru `telegram.json` și `telegram-stare.json` |
| `#shared/format/html-escape.mjs`, `#shared/format/date-format.mjs`, `#shared/format/money-format.mjs` | formatarea pentru mesajul Telegram (`formatDate`, `formatMonthName`, `formatLongDate` din `date-format.mjs`) |
| `#shared/contracts/audit-trail.mjs` | audit `configurare telegram` |
| `node:fs`, `node:path` | citire/scriere fișiere config și stare |
| `globalThis.fetch` (parametru) | apeluri Bot API |

## Consumatori

Composition root-ul serverului (`create-application.mjs`) creează serviciul cu `fetch` și îl injectează în rute, alături de `auditTrail` (implementat de `audit-log`). Composition root-ul de web creează controller-ul cu `requestJson` și `showNotice` comune aplicației și view-ul cu containerul din `#notifications` (ecranul „Notificări"). Compositor-ul `src/app/server/telegram-digest.mjs` agregă datele de la copii/vizite/plăți, citește `notificationPreferences` din `settings` (`#shared/domain/notification-preferences.mjs`) și apelează `buildDailyDigest` și `runTelegramDigest`. Ruta `POST /api/notification-settings` (`src/app/server/notification-settings.routes.mjs`, tot un compositor, nu un feature) salvează preferințele și oglindește ora rezumatului în `notify-schedule.json`, citit de lansator la (re)înregistrarea sarcinii programate.

## Structură

```
telegram-notify/
├── README.md
├── telegram-notify.types.d.mts         # TelegramConfig, TelegramState, TelegramStatus, DigestInputs, TelegramFailure
├── index.server.mjs                    # barrel-ul server-ului
├── index.web.mjs                       # barrel-ul web-ului
├── domain/
│   ├── daily-digest.mjs (+ .test.mjs)  # buildDailyDigest, splitDigest (intern), pruneSentKeys
├── server/
│   ├── telegram-config.repository.mjs (+ .test.mjs)  # pe #core/server/files/json-file.mjs
│   ├── telegram-state.repository.mjs (+ .test.mjs)   # pe #core/server/files/json-file.mjs
│   ├── telegram.service.mjs (+ .test.mjs)
│   └── telegram.routes.mjs (+ .integration.test.mjs)
├── web/
│   ├── telegram-settings.controller.mjs (+ .test.mjs)
│   └── telegram-settings.view.mjs
└── test-support/
    └── fake-telegram-api.mjs           # fetch fals: getMe, getUpdates, sendMessage
```

## Decizii

- **Proces separat, nu tray.** Task Scheduler pornește sarcina la ora aleasă (implicit 08:00) cu `Startica.exe --telegram --quiet`; lansatorul o ascunde și nu blochează serverul.
- **Deschidere strict de citire.** `openDatabaseReadOnly` deschide baza în WAL fără migrări, coexistând cu serverul care ține o tranzacție `BEGIN IMMEDIATE`.
- **Token în `telegram.json`, nu în setări.** Secretul nu intră în backupuri, iar restaurarea pe un calculator nou cere re-lipirea token-ului (2 minute).
- **Stare în `telegram-stare.json`.** Două fișiere cu câte un singur scriitor; nicio cursă între server și proces; procesul citește și scrie, serverul citește doar pentru afișare stării.
- **Descoperirea conversației prin `getUpdates`.** Operatorul apasă Start în bot, apoi „Conectează" în Startica; niciun „chat id" de copiat.
- **Un mesaj pe zi, la ora aleasă.** Fără interval; proces la trezire sau pornire calcul dacă ora a trecut. Ora e o preferință (`digestTime`, implicit 08:00), oglindită și în `notify-schedule.json` pentru lansator; schimbarea ei se aplică la următoarea (re)pornire a sarcinii programate, nu instant.
- **Rezumat cu bucăți sub 4096 caractere.** Tăiat la limită de linie; eșec la a doua bucată = reîncercare ziua următoare, mesaj dublat parțial (acceptat).
- **Nicio date medicale.** `healthNotes` nu e citit; formatul HTML, `parse_mode: 'HTML'`, e lizibil pe telefon și nu necesită emoji.
- **Registrul de trimiteri pentru deduplicare.** Zilele de naștere și vizitele se retrimit pe orizontul ales (implicit 3 zile: azi, mâine, poimâine); restanțierii apar cu detalii după cadența aleasă (implicit doar luni, sau la prima intrare în listă). Cheile se șterg după 60 de zile.
- **Rulare ratată, reluată seara.** Tăierea e relativă la ora rezumatului (implicit +10h, deci 18:00): peste ea, o rulare ratată nu mai trimite rezumatul de azi; a doua zi pleacă normal.
- **Secțiuni activabile și cadență a restanțelor, prin `#shared/domain/notification-preferences.mjs`.** Fiecare secțiune (zile de naștere, vizite, restanțe) se poate opri din ecranul „Notificări"; restanțele au trei cadențe (`daily`/`monday`/`never`). O zi goală poate fie trimite „Nimic de semnalat", fie nu trimite nimic (`nothingToReportEnabled`).

## Teste

```
node --test "src/features/telegram-notify/**/*.test.mjs"
```

- **Domeniu:** rezumat complet (text cu caracter per caracter), zi fără nimic, luni vs. alte zile, `keys` pentru deduplicare, formate de dată și bani, `splitDigest` la 4096 caractere, `pruneSentKeys` pe 60 de zile.
- **Serviciu:** `classifyTelegramFailure` pe timeout, 5xx, 429, 401, 400, 403, `ok: false`; `sendMessage` trimite în ordine și se oprește la prima eroare; `findPrivateChat` pe o listă de conversații, ignoră grupuri.
- **Repository-uri:** fișier lipsă → `null` / stare goală; JSON corupt → la fel, cu `console.error`; scriere atomică (fără `.tmp` rămas).
- **Rute:** integrare cu `fake-telegram-api`, token de formă greșit → 400 fără apel; `getMe` 401 → 400 și niciun fișier; `getUpdates` gol → 400 cu text de Start; conversație privată → fișier scris, mesaj de probă trimis, audit fără token; `status` după conectare; `test` trimite; `disconnect` șterge și scrie audit; `stale` pe `lastSuccess` de 3 zile.
- **Deschidere de citire:** `openDatabaseReadOnly` întoarce `null` fără fișier; citeste instantaneu consistent; refuză `INSERT`.
- **Ciclu complet:** aplicație de test pornită în home temporar cu copii, vizite și plăți; `runTelegramDigest` cu `fetch` și `now` fix → rezumatul conține date, stare are `zi:` și `plata:`, ieșire 0; a doua rulare în aceeași zi → niciun apel, ieșire 0; eșec tranzitoriu → ieșire 1, fără chei; eșec permanent → ieșire 0 cu `lastError`.
