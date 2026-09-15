# Notificări Telegram: rezumatul zilnic cu aplicația închisă (1.6.0)

Stare la scriere: `feat/telegram-notify` pornit din `master` @ `4254b2e` (v1.4.1 livrată); `npm test` = 350 de teste (348 trec, 2 sărite). Modulul Vizite (1.5.0) e în lucru pe `feat/vizite` și se livrează primul; acest modul se livrează ca 1.6.0, după el, și folosește `visits` ca dat. Deciziile privind copia din afara calculatorului rămân în vigoare (folder extern Google Drive, copii necriptate, un operator, un calculator). Utilizatorul a aprobat răspunsurile la întrebările de produs; răspunsurile lui sunt marcate **(U)**, restul sunt hotărâri ale arhitectului, luate ca implicit.

## 1. Problema

Operatorul vrea să afle pe telefon, fără să deschidă Startica, ce urmează: zilele de naștere ale copiilor, vizitele de azi și de mâine (cu nume, oră și telefon) și copiii cu rest de plată din „De notificat”. Canalul trebuie să funcționeze și când fereastra Startica e închisă, cu calculatorul pornit. Azi, singurul lucru asemănător sunt memento-urile Windows din Vizite (§5.6 din specificația 1.5.0), care trăiesc doar cât fereastra e deschisă.

Fapte verificate în cod, care fixează designul:

- Serverul trăiește exact cât lansatorul: `Supervise()` așteaptă închiderea ferestrei și apelează `Stop()` (`Startica.cs:487-511`). Orice canal „cu aplicația închisă” înseamnă un proces separat, pornit de Windows.
- `openDatabase` scrie la deschidere: `PRAGMA journal_mode=WAL`, `applySchema`, `runMigrations` (`sqlite-connection.mjs:12-15`). Un al doilea proces nu poate folosi această funcție fără să concureze cu serverul la scriere; are nevoie de o deschidere strict de citire.
- Verificat pe Node 22.17.0 din pachet: `new DatabaseSync(fișier, { readOnly: true })` deschide baza în WAL, citește un instantaneu consistent în timp ce serverul ține deschisă o tranzacție `BEGIN IMMEDIATE`, nu blochează scrierile serverului, iar `INSERT` pe această conexiune e refuzat cu „attempt to write a readonly database”. Fișierul `-shm` se creează cu drepturile aceluiași utilizator Windows.
- Toată evidența e în `records(kind, id, payload)`; `createRecordRepository(db).readSnapshot()` face doar `SELECT` (`record-repository.mjs:5-13`). Regulile de domeniu sunt funcții pure peste acest instantaneu: `listUpcomingBirthdays(children, days, todayStr)` (`children/domain/birthdays.mjs:67`), `countVisitsForDays(visits, todayStr)` (`visits/domain/visit-statistics.mjs:28`, pe `feat/vizite`), `evaluateChildrenForMonth(records, month, asOf)` cu `obligation.notify` (`billing/domain/month-evaluation.mjs:19`, `tuition-obligation.mjs:50`).
- Node 22 are `fetch` global: apelul la Bot API nu cere nicio dependență de runtime.
- Pachetul livrat conține doar `src`, `web`, `package.json`, `startica_server.mjs` și `CITESTE-MA.txt` (`build-client-package.ps1:88-90`); `scripts/` nu ajunge în `{app}`. Punctul de intrare al noului proces trebuie să stea la rădăcină, ca `startica_server.mjs`.
- Task Scheduler pornește executabilele de consolă cu fereastră vizibilă când utilizatorul e autentificat: `node.exe` direct din sarcină ar deschide o fereastră neagră la 08:00. `Startica.exe` e aplicație WinForms fără consolă și pornește deja `node.exe` ascuns, cu mediul setat (`StartServer`, `Startica.cs:450-469`).
- Lansatorul folosește deja COM legat târziu prin `dynamic` (`WScript.Shell`, `Startica.cs:974-987`); `Schedule.Service` se poate folosi la fel, fără assembly de interop.
- Backupurile copiază baza întreagă, inclusiv tabelul `settings` (`backup-snapshot.mjs`); un secret pus în `settings` ar ajunge în folderul Google Drive.
- `evaluateChildrenForMonth` e exportat azi doar din `billing/index.web.mjs`; `children/index.server.mjs` exportă doar rutele. Compunerea de pe server are nevoie de exporturi noi, nu de importuri în interiorul feature-urilor.

## 2. Decizii

| Decizie | Alegere | Motiv |
| --- | --- | --- |
| Conținut **(U)** | Zile de naștere (azi, mâine, poimâine), vizitele de azi și de mâine cu nume, oră, telefon și părinte, copiii din „De notificat” | Cererea utilizatorului; aceleași date pe care le vede în Panou și în liste |
| Canal cu aplicația închisă **(U)** | Sarcină programată Windows per utilizator, care rulează `Startica.exe --telegram --quiet`; lansatorul pornește `node.exe` ascuns pe `startica_telegram.mjs`; procesul citește baza în mod strict de citire și trimite prin Bot API | Singurul mod „calculator pornit, fereastră închisă” fără să contrazică „închid fereastra = se oprește tot” |
| Confidențialitate **(U)** | Numele copiilor, orele vizitelor, telefoanele părinților și sumele restante pleacă prin serverele Telegram, în clar pentru Telegram | Acceptat explicit, la fel ca backupul necriptat din Google Drive; se spune în GHID |
| Un mesaj pe zi | Un singur rezumat la 08:00, ora fixă, fără setare | Un operator, un program; o setare ar cere UI, validare și reînregistrarea sarcinii |
| Zi fără nimic **(U)** | Rezumatul se trimite și când nu e nimic de semnalat („Nimic de semnalat azi.”) | Mesajul zilnic e dovada că sarcina și botul funcționează; tăcerea ar fi identică cu o sarcină moartă |
| Cadența restanțelor **(U)** | Un copil apare cu detalii în ziua în care intră prima dată în „De notificat” pe luna respectivă și în fiecare luni; în celelalte zile, doar rândul cu numărul total | Lista completă zilnic ar repeta aceiași copii săptămâni întregi |
| Fără „peste 30 de minute” | Nicio a doua sarcină la 15 minute pentru memento-ul dinaintea vizitei | Ar însemna 96 de procese pe zi; memento-ul din §5.6 (1.5.0) acoperă cazul cât fereastra e deschisă |
| Token-ul | `Startica_Date\telegram.json` `{ token, chatId, chatName, botUsername }`, scris doar de server; **nu** în tabelul `settings` | Secretul nu intră în backupuri (locale sau Drive); după restaurare pe alt calculator, token-ul se lipește din nou (2 minute), spus în GHID |
| Starea trimiterilor | `Startica_Date\telegram-stare.json` `{ lastRun, lastSuccess, lastError, sentKeys }`, scris doar de proces; serverul îl citește pentru afișare | Două fișiere cu câte un singur scriitor: nicio cursă între server și proces |
| Descoperirea conversației | Serverul apelează `getMe` și `getUpdates` și reține cea mai recentă conversație privată; operatorul nu vede niciodată un „chat id” | Operatorul apasă Start în Telegram și „Conectează” în Startica; nimic de copiat |
| Unde stă | Feature nou `src/features/telegram-notify/`; compunerea multi-feature în `src/app/server/telegram-digest.mjs`; punct de intrare `startica_telegram.mjs` la rădăcină | Convenția „un feature nu importă alt feature”; `app/` e singurul compositor |
| Deschidere de citire | `openDatabaseReadOnly({ dataDir })` nou în `core/server/database/sqlite-connection.mjs` | `openDatabase` scrie (schemă, migrări); procesul nu are voie să scrie niciodată în bază |
| Înregistrarea sarcinii | Instalerul rulează `Startica.exe --register-task --quiet`; lansatorul o reînregistrează la fiecare pornire normală dacă lipsește (doar pentru home-ul implicit); dezinstalarea rulează `--unregister-task` | Actualizarea nu are nimic de făcut; o sarcină ștearsă de un „optimizator” revine la prima pornire |
| Sarcină fără configurare | Sarcina există și când Telegram nu e configurat; procesul iese imediat („Neconfigurat”) | O singură cale de instalare; costul e un proces de ~300 ms pe zi |
| Format | HTML (`parse_mode: 'HTML'`), titluri cu `<b>`, nume trecute prin `escapeHtml`, fără emoji | Lizibil pe telefon; același ton ca aplicația |
| Versiune | 1.6.0, `Livrare\Startica_Setup_1.6.0.exe`, `NOTA-LIVRARE-1.6.0.md` | Funcționalitate nouă, cu lansator și instaler schimbate |

Abordări respinse:

- **Lansatorul rămâne în fundal după închiderea ferestrei (tray):** contrazice designul `--stop`/mutex/`startica.port` și „dublu clic și gata”; oricum cere calculatorul pornit, deci nu aduce nimic în plus față de sarcina programată.
- **Doar `setInterval` în server:** mort cât aplicația e închisă; exact ce a refuzat utilizatorul.
- **Releu în cloud (webhook, funcție serverless):** infrastructură de întreținut, datele ar trece printr-un al treilea serviciu.
- **`cmd /c set STARTICA_HOME=… && node …` ca acțiune a sarcinii:** fereastră de consolă vizibilă, Task Scheduler nu setează variabile de mediu, iar învelișurile VBScript au fost scoase deliberat în 1.3.
- **`schtasks /Create /SC DAILY` din instaler:** linia de comandă nu poate seta `StartWhenAvailable` (rularea la trezire/pornire când ora a trecut) și nici `RestartOnFailure`; fișierul XML pentru `schtasks /XML` are probleme de codificare când e scris din Inno. COM din lansator le setează pe toate și e testabil în `desktop-lifecycle.ps1`.
- **Token-ul în `settings`:** ar ajunge în fiecare copie de siguranță, inclusiv în Google Drive.
- **Un al doilea trigger la 15 minute pentru memento-ul dinaintea vizitei:** vezi decizia de mai sus.

## 3. Arhitectura

### 3.1 Lanțul de execuție

```
Task Scheduler (08:00, per utilizator)
  └─ Startica.exe --telegram --quiet            (WinForms, fără consolă; setează STARTICA_HOME, STARTICA_PROFILE)
       └─ runtime\node.exe startica_telegram.mjs (ascuns; citire strictă din startica.db; fetch spre api.telegram.org)
            ├─ Startica_Date\telegram.json       (citit)
            ├─ Startica_Date\telegram-stare.json (citit + scris atomic)
            └─ Jurnale\telegram.log              (jurnal rotit, ca startica.log)
```

Procesul nu ia mutexul proprietarului, nu deschide fereastră, nu vorbește cu serverul și nu-i pasă dacă Startica e pornită sau nu.

### 3.2 `openDatabaseReadOnly({ dataDir })` (`core/server/database/sqlite-connection.mjs`)

Întoarce `null` dacă `startica.db` lipsește; altfel `{ db: new DatabaseSync(dbFile, { readOnly: true }), dbFile }` după `PRAGMA busy_timeout=5000` (singura pragmă: `journal_mode` e deja proprietatea fișierului, `foreign_keys`/`synchronous` nu au sens la citire). Fără `applySchema`, fără migrări. O bază dintr-o versiune fără tabelul `records` (nemigrată încă) face `readSnapshot()` să arunce; procesul o tratează ca eroare permanentă (§6) și serverul o migrează la următoarea pornire a Startica.

### 3.3 `runTelegramDigest({ home, now, fetch, log })` (`src/app/server/telegram-digest.mjs`)

Întoarce codul de ieșire; `startica_telegram.mjs` îl pune în `process.exitCode`.

1. Căile: `home` din `loadEnvironment().home`, altfel folderul aplicației (aceeași regulă ca `createApplication`). `dataDir = <home>\Startica_Date`, jurnalul `<home>\Jurnale\telegram.log` prin `createRotatingLogFile` (fără `home`, în consolă).
2. `readTelegramConfig(dataDir)`: fișier lipsă → `INFO Neconfigurat`, ieșire 0. Fără `chatId` → `INFO Neconectat`, ieșire 0.
3. `readTelegramState(dataDir)`; `sentKeys['zi:<azi>']` prezent → `INFO Trimis deja azi`, ieșire 0.
4. `openDatabaseReadOnly` → `null` → `INFO Baza lipsește`, ieșire 0; altfel `readSnapshot()` și `db.close()` imediat, înainte de orice apel de rețea.
5. Intrările: `listUpcomingBirthdays(records.children, 2, azi)`, `countVisitsForDays(records.visits, azi).items`, `evaluateChildrenForMonth(records, azi.slice(0, 7), azi).filter(e => e.obligation.notify)`.
6. `buildDailyDigest({ todayStr, birthdays, visits, overdue, sentKeys })` → `{ text, keys }` (§5).
7. `sendDigest(config, text, fetch)`: bucăți de cel mult 4096 de caractere, tăiate la limită de linie, trimise în ordine.
8. Succes: `sentKeys` primește fiecare cheie din `keys` cu data de azi, cheile mai vechi de 60 de zile se șterg, `lastSuccess = lastRun = now`, `lastError = ''`; scriere atomică (`.tmp` + `renameSync`, ca `startica.port`). Ieșire 0.
9. Eșec tranzitoriu (§6): `lastRun`, `lastError`, nicio cheie; ieșire 1 (Task Scheduler reia). Eșec permanent: la fel, dar ieșire 0 (fără reluări).

`now` și `fetch` vin ca parametri, ca testele să le controleze; `startica_telegram.mjs` dă `new Date()` și `globalThis.fetch`.

### 3.4 Sarcina programată

Folderul `\Startica`, numele `Rezumat Telegram` pentru home-ul implicit, `Rezumat Telegram <hash8>` (`ComputeHomeIdentity`) pentru `--home` explicit, ca testele să nu atingă sarcina reală. Definiția: principal = utilizatorul curent, `TASK_LOGON_INTERACTIVE_TOKEN`, `RunLevel` LUA; trigger zilnic la 08:00; acțiune `"<AppDir>\Startica.exe" --telegram --quiet` (+ `--home "<dir>"` când nu e implicit); `StartWhenAvailable = true`, `DisallowStartIfOnBatteries = false`, `StopIfGoingOnBatteries = false`, `WakeToRun = false`, `ExecutionTimeLimit = PT10M`, `MultipleInstances = IgnoreNew`, `Hidden = true`, `RestartCount = 6`, `RestartInterval = PT30M`. `RegisterTaskDefinition` cu `TASK_CREATE_OR_UPDATE`.

Consecințe documentate în GHID: rezumatul vine doar dacă utilizatorul Windows e autentificat (ecranul blocat e în regulă; „rulează și fără autentificare” ar cere parola Windows salvată în sarcină, refuzat); calculator adormit sau oprit la 08:00 → mesajul vine la trezire/pornire, în aceeași zi; calculator oprit toată ziua → nimic pentru ziua aceea.

## 4. Token-ul și conectarea

### 4.1 Fișiere (`src/features/telegram-notify/server/`)

- `telegram-config.repository.mjs`: `readTelegramConfig(dataDir)` → `{ token, chatId, chatName, botUsername } | null` (JSON invalid = `null` + `console.error`), `writeTelegramConfig(dataDir, config)` atomic, `removeTelegramConfig(dataDir)`.
- `telegram-state.repository.mjs`: `readTelegramState(dataDir)` → `{ lastRun: '', lastSuccess: '', lastError: '', sentKeys: {} }` când lipsește sau e corupt, `writeTelegramState(dataDir, state)` atomic.

### 4.2 Rute (`telegram.routes.mjs`)

| Rută | Cerere | Răspuns 200 | Erori 400 |
| --- | --- | --- | --- |
| `GET /api/telegram-status` | — | `{ configured, connected, chatName, botUsername, lastRun, lastSuccess, lastError, stale }` | — |
| `POST /api/telegram-connect` | `{ token }` | `{ ok: true, status }` | „Token invalid. Copiază-l din nou din @BotFather.” (format sau `getMe` 401); „Deschide botul @<username> în Telegram, apasă Start, apoi apasă din nou „Conectează”.” (`getUpdates` fără conversație privată); „Botul are un webhook setat; creează un bot nou pentru Startica.” (`getUpdates` 409); „Fără internet sau Telegram indisponibil. Încearcă din nou.” (rețea) |
| `POST /api/telegram-test` | `{}` | `{ ok: true, status }` | mesajul clasificat din §6; „Conectează întâi botul.” fără configurare |
| `POST /api/telegram-disconnect` | `{}` | `{ ok: true, status }` | — |

- Formatul token-ului: `/^\d+:[\w-]{20,}$/`, verificat înainte de orice apel de rețea (testele smoke pot verifica eroarea fără internet).
- `connect`: `getMe` → `botUsername`; `getUpdates?limit=100` → ultima intrare cu `message.chat.type === 'private'`; `chatId = chat.id`, `chatName = chat.first_name (+ last_name)`; `writeTelegramConfig`; `sendMessage('Startica: notificările funcționează. Rezumatul zilnic vine la 08:00.')`; auditul `configurare telegram` cu `before: { chatId: vechi }`, `after: { chatId, chatName, botUsername }` — **niciodată token-ul**. Eșecul mesajului de probă după scrierea fișierului lasă configurarea și întoarce eroarea clasificată.
- `disconnect`: `removeTelegramConfig` + fișierul de stare, audit `configurare telegram` cu `after: { chatId: '' }`.
- `stale` = conectat și (`lastSuccess` mai vechi de 48 h sau gol, iar fișierul de configurare mai vechi de 48 h). Serverul nu interoghează Task Scheduler; `stale` e semnalul vizibil pentru o sarcină lipsă.
- Toate rutele trec prin gărzile existente (Host, Origin, token de sesiune) ca oricare `/api/*`.

### 4.3 Interfața (`web/index.html`, `telegram-settings.controller.mjs`, `telegram-settings.view.mjs`)

Un al treilea `article.panel` în `#settings`, între „Copii de siguranță” și „Excel”:

```
<article class="panel"><h3>Notificări Telegram</h3>
  <div id="telegramStatus"></div>
  <form id="telegramForm">
    <label>Token-ul botului<input id="telegramToken" type="password" autocomplete="off" placeholder="123456789:AAH…"></label>
    <p>În Telegram, deschide @BotFather, trimite /newbot și copiază token-ul aici. Apoi deschide botul creat, apasă Start și apasă „Conectează”. Rezumatul vine zilnic la 08:00, cât calculatorul e pornit și ești autentificat în Windows; numele copiilor, orele vizitelor și telefoanele trec prin serverele Telegram.</p>
    <button class="btn btn-primary">Conectează</button>
  </form>
  <div class="toolbar"><button class="btn btn-ghost" id="telegramTest">Mesaj de probă</button><button class="btn btn-ghost" id="telegramDisconnect">Deconectează</button></div>
</article>
```

- `#telegramStatus`: „Neconfigurat.” (butoanele din toolbar ascunse); „Conectat cu <chatName> prin @<botUsername> · ultimul rezumat: <formatDateTime(lastSuccess)>”; `lastError` ca `<p class="danger">`; `stale` ca `<p class="danger">Rezumatul nu a mai fost trimis din <data>. Verifică Jurnale\telegram.log; sarcina programată se reînregistrează la pornirea Startica.</p>`.
- Controller: la deschiderea ecranului `settings` (evenimentul de navigare deja folosit de backup) și după fiecare acțiune, `GET /api/telegram-status` → view. Acțiunile folosesc `requestJson` ca `/api/settings`; succes → `showNotice('Bot conectat. Ai primit un mesaj de probă în Telegram.')`, `showNotice('Mesaj de probă trimis.')`, `showNotice('Telegram deconectat.')`; câmpul de token se golește după conectare. `ViewStatus`/`failure` ca la celelalte controllere.
- Compunerea în `compose-screens.mjs` cu cele cinci id-uri. Fără CSS nou (`.panel`, `.toolbar`, `.danger` există).

## 5. Mesajul și registrul de trimiteri (`domain/daily-digest.mjs`, pur)

`buildDailyDigest({ todayStr, birthdays, visits, overdue, sentKeys })` → `{ text, keys }`. `birthdays` = rezultatul `listUpcomingBirthdays` (`{ child, daysUntil, turningAge }`), `visits` = `Visit[]` de azi și mâine, `overdue` = `ChildMonthEvaluation[]` cu `notify`, `sentKeys` = `Record<string, string>` (cheie → data scrierii).

Reguli:

- Titlul: `<b>Startica · ${formatLongDate(todayStr)}</b>`, cu `formatLongDate` nou în `#shared/format/date-format.mjs` (`toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })` → „marți, 15 septembrie 2026”; verificat pe Node din pachet).
- „Zile de naștere”: eticheta `Azi`, `Mâine`, `Poimâine, dd.MM`; vârsta `împlinește 1 an` / `împlinește N ani`. Secțiunea lipsește când lista e goală.
- „Vizite azi” / „Vizite mâine”: `HH:MM · nume · telefon · părinte`; câmpul lipsă se omite (fără `· ·`). Fiecare sub-secțiune apare doar când are vizite. Niciodată `healthNotes`, `notes` sau `postVisitNotes`.
- „De notificat · <formatMonthName(luna)>”: rând `nume · rest <formatMoney(rest)> · scadent <formatDate(due)>` pentru copiii cu detalii: toți când `todayStr` e luni, altfel doar cei fără cheia `plata:<childId>:<luna>` în `sentKeys`. Rândul de total apare mereu când există restanțe: `N copii cu rest de plată (<formatMoney(suma)> în total).`; când niciun copil nu are detalii în ziua aceea, continuă cu ` Lista completă vine luni; între timp, Startica › De notificat.` Un singur copil: „1 copil cu rest de plată”.
- Nimic în nicio secțiune → `Nimic de semnalat azi: nicio zi de naștere în următoarele 3 zile, nicio vizită azi sau mâine, niciun copil de notificat.`
- `keys` = `['zi:<todayStr>', ...'plata:<childId>:<luna>' pentru copiii cu detalii]`; procesul le scrie doar după trimitere reușită.
- Tot textul variabil trece prin `escapeHtml`; secțiunile sunt separate de o linie goală; `splitDigest(text)` taie la 4096 de caractere pe limită de linie.

Exemplu, marți 15 septembrie 2026, cu tot ce se poate:

```
<b>Startica · marți, 15 septembrie 2026</b>

<b>Zile de naștere</b>
• Azi: Popescu Ana (împlinește 4 ani)
• Poimâine, 17.09: Ionescu Mihai (împlinește 3 ani)

<b>Vizite azi</b>
• 10:00 · Georgescu Maria · 0722 123 456 · Elena Georgescu
• 12:30 · Dobre Vlad · 0733 111 222 · Andrei Dobre
<b>Vizite mâine</b>
• 09:30 · Marin Sofia · 0744 555 666 · Ioana Marin

<b>De notificat · septembrie 2026</b>
• Stan Tudor · rest 1.200,00 lei · scadent 05.09.2026
3 copii cu rest de plată (2.150,00 lei în total).
```

(Stan Tudor a intrat azi în listă; Popescu Ana și un al treilea copil au fost anunțați în zilele trecute, deci apar doar în total; luni 21 septembrie vor apărea toți trei cu detalii.)

Exemplu, miercuri 16 septembrie 2026, fără nimic:

```
<b>Startica · miercuri, 16 septembrie 2026</b>

Nimic de semnalat azi: nicio zi de naștere în următoarele 3 zile, nicio vizită azi sau mâine, niciun copil de notificat.
```

Registrul (`sentKeys`) e echivalentul persistent al `notifiedKeys` din `visit-reminders.mjs`: chei text, sărite când există, curățate după 60 de zile. Zilele de naștere și vizitele nu au chei proprii: dedublarea pe zi (`zi:`) ajunge, iar repetarea „poimâine → mâine → azi” e intenția (pregătire din timp).

## 6. Moduri de eșec

Clasificarea stă într-un singur loc, `telegram.service.mjs` → `classifyTelegramFailure(error | response)` → `{ kind: 'transient' | 'permanent', message }`:

| Situație | Clasă | În proces (`--telegram`) | În aplicație |
| --- | --- | --- | --- |
| Fără internet, DNS, `AbortSignal.timeout(15000)`, 5xx, 429 (`retry_after`) | tranzitoriu | `WARN` în `telegram.log`, `lastError = 'Fără internet sau Telegram indisponibil.'`, fără chei, ieșire 1 → Task Scheduler reia de 6 ori la 30 de minute; dacă toate pică, rezumatul zilei se pierde, cel de mâine acoperă starea nouă | `lastError` în `#telegramStatus`; la „Mesaj de probă”/„Conectează”, 400 cu același text |
| 401 (`getMe`/`sendMessage`) | permanent | `lastError = 'Token invalid sau revocat. Reconectează botul din Backup și setări.'`, ieșire 0 | `<p class="danger">` cu textul; formularul de token rămâne |
| 400 „chat not found”, 403 „bot was blocked by the user” | permanent | `lastError = 'Conversația cu botul nu mai există. Deschide botul, apasă Start și reconectează.'`, ieșire 0 | idem |
| `ok: false` cu alt `description` | permanent | `lastError = 'Telegram a refuzat mesajul: <description>'`, ieșire 0 | idem |
| Token fără `chatId` | — | `INFO Neconectat`, ieșire 0 | „Conectează” cere apăsarea Start |
| Fără `telegram.json` | — | `INFO Neconfigurat`, ieșire 0 | „Neconfigurat.” |
| `startica.db` lipsă (instalare nouă, nepornită) | — | `INFO`, ieșire 0 | — |
| Bază nemigrată / `readSnapshot` aruncă | permanent | `ERROR` cu stiva, `lastError = 'Baza nu a putut fi citită; pornește Startica.'`, ieșire 0 | `lastError` afișat |
| Sarcina lipsește sau e dezactivată | — | nu rulează nimic | `stale` după 48 h; lansatorul o reînregistrează la pornire |
| `telegram-stare.json` corupt | — | tratat ca gol (poate retrimite rezumatul de azi o dată) | — |

Ceasul dat înapoi retrimite rezumatul acelei zile o singură dată; acceptat. Ora locală a vizitelor e ora aceluiași calculator, ca în `visit-reminders.mjs`.

## 7. Structura și compunerea

```
src/features/telegram-notify/
├── README.md
├── telegram-notify.types.d.mts          # TelegramConfig, TelegramState, TelegramStatus, DigestInputs, TelegramFailure
├── index.server.mjs                     # createTelegramRoutes, createTelegramService, read/write config & state, buildDailyDigest
├── index.web.mjs                        # createTelegramSettingsController, createTelegramSettingsView
├── domain/
│   ├── daily-digest.mjs (+ .test.mjs)   # buildDailyDigest, splitDigest, pruneSentKeys
├── server/
│   ├── telegram-config.repository.mjs (+ .test.mjs)
│   ├── telegram-state.repository.mjs (+ .test.mjs)
│   ├── telegram.service.mjs (+ .test.mjs)             # getMe, findPrivateChat, sendMessage, classifyTelegramFailure; primește fetch
│   └── telegram.routes.mjs (+ .integration.test.mjs)
├── web/
│   ├── telegram-settings.controller.mjs (+ .test.mjs)
│   └── telegram-settings.view.mjs
└── test-support/
    └── fake-telegram-api.mjs            # fetch fals: răspunsuri getMe/getUpdates/sendMessage, jurnal al apelurilor
```

Cine importă ce:

- `domain/daily-digest.mjs` importă doar `#shared/format/*` (`escapeHtml`, `formatMoney`, `formatDate`, `formatMonthName`, `formatLongDate`). Primește listele gata calculate; nu știe de `children`, `visits` sau `billing`.
- `server/*` importă `#core/server/errors/domain-error.mjs`, `node:fs`, `node:path`. `telegram.service.mjs` primește `fetch` prin parametru (fără mock de module).
- `src/app/server/telegram-digest.mjs` (compositor, ca `main.mjs`) importă `#config/environment.mjs`, `#core/server/database/sqlite-connection.mjs`, `#core/server/persistence/record-repository.mjs`, `#core/server/files/rotating-log-file.mjs`, `#features/children/index.server.mjs` (`listUpcomingBirthdays`, export nou), `#features/visits/index.server.mjs` (`countVisitsForDays`, export nou, după Vizite), `#features/billing/index.server.mjs` (fișier nou, `evaluateChildrenForMonth`) și `#features/telegram-notify/index.server.mjs`.
- `startica_telegram.mjs` (rădăcină): `import { runTelegramDigest } from '#app/server/telegram-digest.mjs'; process.exitCode = await runTelegramDigest();`. Intră în `$headPaths` și în verificările de fișiere din `build-client-package.ps1`.
- `create-application.mjs`: `createTelegramRoutes({ dataDirectory, telegramService: createTelegramService({ fetch: options.fetch ?? globalThis.fetch }), auditTrail })`; `startTestApplication` primește `fetch` fals prin opțiuni.
- `compose-screens.mjs`: controller-ul de setări Telegram, cu elementele și `api`-ul existent.
- `tests/architecture/import-boundaries.test.mjs` primește cazul pozitiv `src/app/server/telegram-digest.mjs → #features/*/index.server.mjs` și negativ `src/features/telegram-notify/... → #features/children/...`.

## 8. Livrarea: lansator și instaler

### 8.1 `launcher/Startica.cs`

- `Options`: `--telegram`, `--register-task`, `--unregister-task` (exclusive între ele și cu `--stop`); toate trei implică `Quiet`.
- `--telegram`: `RunTelegramJob()`: `FindNode()`; `ProcessStartInfo(node, "--disable-warning=ExperimentalWarning \"<AppDir>\\startica_telegram.mjs\"")`, `WorkingDirectory = AppDir`, `CreateNoWindow = true`, `UseShellExecute = false`, `STARTICA_PROFILE=production`, `STARTICA_HOME=<Home>`; `WaitForExit(300000)`, la expirare `Kill()` și cod 1; codul de ieșire al lui node devine codul lansatorului (Task Scheduler îl folosește pentru `RestartOnFailure`). O linie în `lansator.log`: „Rezumat Telegram: cod N”. Fără migrare, fără mutex, fără fereastră.
- `--register-task` / `--unregister-task`: `TaskSchedulerRegistration` prin `Activator.CreateInstance(Type.GetTypeFromProgID("Schedule.Service"))`, `Connect()`, folderul `\Startica` (creat la nevoie), definiția din §3.4, `RegisterTaskDefinition(name, definition, 6 /* TASK_CREATE_OR_UPDATE */, null, null, 3 /* TASK_LOGON_INTERACTIVE_TOKEN */)`. Ștergerea: `DeleteTask(name, 0)`; sarcina lipsă nu e eroare. Ieșire 0/1, mesajele în `lansator.log`.
- `Run()` normal, după `OpenWindow` și înainte de `Supervise`: dacă `IsDefaultHome()`, `EnsureTaskRegistered()` cu `try/catch` → `Warn`, niciodată fatal. Registrarea e idempotentă (`CREATE_OR_UPDATE`), ~50 ms.
- `launcher/README.md`: cele trei argumente noi în tabel.

### 8.2 `scripts/pachet-client/Startica.iss`

```
[Run]
Filename: "{app}\Startica.exe"; Parameters: "--register-task --quiet"; Flags: runhidden waituntilterminated
Filename: "{app}\Startica.exe"; Description: "Pornește Startica"; Flags: postinstall nowait skipifsilent

[UninstallRun]
Filename: "{app}\Startica.exe"; Parameters: "--unregister-task --quiet"; Flags: runhidden waituntilterminated; RunOnceId: "UnregisterTelegramTask"; Check: StarticaExeExists
Filename: "{app}\Startica.exe"; Parameters: "--stop --quiet"; ...  (neschimbat)
```

Actualizarea: `{app}` rămâne (`UsePreviousAppDir=yes`), acțiunea sarcinii pointează la același `Startica.exe`; `--register-task` rulează oricum la fiecare instalare. Dezinstalarea lasă `Startica_Date` (deci și `telegram.json`) pe loc, ca baza; mesajul de la final rămâne. `PrepareToInstall` oprește serverul, nu și un rezumat aflat în execuție la 08:00 fix: fereastra e de sub o secundă, iar instalerul ar raporta „fișier în uz” pentru `node.exe`; se reia instalarea.

### 8.3 Documentație

`GHID-LIVRARE.md` și `CITESTE-MA.txt`: secțiunea „Notificări Telegram” (crearea botului cu @BotFather, Start, „Conectează”, ce conține rezumatul, 08:00, condițiile: calculator pornit și utilizator autentificat, calculator adormit → la trezire; datele trec prin Telegram; token-ul nu e în backup, se lipește din nou după restaurare pe alt calculator; nu da token-ul nimănui: cine îl are poate scrie ca botul; „Deconectează” șterge fișierul; unde e jurnalul). Pasul de dezinstalare menționează sarcina programată.

## 9. Efort și suprapunerea cu Vizite

Estimare: 4–4,5 zile-agent. Domeniu 0,5; server (repository-uri, serviciu, rute, teste) 1; compunere (`telegram-digest.mjs`, deschidere de citire, shim, pachet, exporturi) 0,5; interfață 0,5; lansator + instaler + `desktop-lifecycle.ps1` + instalare de probă 1–1,5; specificație, README, GHID, notă de livrare 0,5.

Fișiere pe care le ating și S3–S5 din Vizite: `web/index.html` (secțiunea `#settings` aici, `#visits` acolo), `src/app/server/create-application.mjs`, `src/app/web/compose-screens.mjs`, `src/features/visits/index.server.mjs`, `tests/browser-smoke.mjs`. Nu se suprapun: tot `src/features/telegram-notify/`, `sqlite-connection.mjs`, `date-format.mjs`, `startica_telegram.mjs`, `build-client-package.ps1`, `Startica.cs`, `Startica.iss`, `desktop-lifecycle.ps1`, `children/index.server.mjs`, `billing/index.server.mjs`. Regula: T0–T2, T5 și H1 pornesc acum din `master`; T3 și T4 se fac după ce `feat/vizite` a intrat în `master` și `feat/telegram-notify` s-a rebazat pe el, ca `records.visits` să existe în schemă și `countVisitsForDays` să fie exportabil.

## 10. Teste

- **Unitare, `daily-digest.test.mjs`:** rezumat complet (textul din §5, caracter cu caracter); zi fără nimic; luni = toți restanțierii cu detalii; marți = doar cei fără cheie, cu rândul de total și fraza „Lista completă vine luni”; `keys` conține `zi:` și `plata:` doar pentru cei cu detalii; `1 copil` / `N copii`, `1 an` / `N ani`; câmp `parent` gol fără `· ·`; nume cu `<` și `&` scăpate; `splitDigest` pe un text de 5000 de caractere taie la limită de linie, fără bucată goală; `pruneSentKeys` păstrează exact 60 de zile.
- **Unitare, `telegram.service.test.mjs`:** `classifyTelegramFailure` pentru `TypeError: fetch failed`, `AbortError`, 5xx, 429 → tranzitoriu; 401, 400 chat not found, 403, `ok: false` necunoscut → permanent cu textul din §6; `sendMessage` trimite `chat_id`, `text`, `parse_mode: 'HTML'` și bucățile în ordine, oprindu-se la prima eroare; `findPrivateChat` alege ultima conversație privată și ignoră grupurile.
- **Unitare, repository-uri:** fișier lipsă → `null`/stare goală; JSON corupt → la fel, cu `console.error`; scrierea lasă un singur fișier (fără `.tmp` rămas).
- **Unitare, `sqlite-connection.test.mjs`:** `openDatabaseReadOnly` întoarce `null` fără fișier; pe o bază deschisă de `openDatabase` citește înregistrările și refuză `INSERT`; `date-format.test.mjs`: `formatLongDate('2026-09-15')` = „marți, 15 septembrie 2026”.
- **Integrare, `telegram.routes.integration.test.mjs`** (cu `fake-telegram-api`): `connect` cu token de format greșit → 400 fără niciun apel; `getMe` 401 → 400 și niciun fișier; `getUpdates` gol → 400 cu textul de Start și niciun fișier; conversație privată → fișier scris, mesaj de probă trimis, audit fără token; `status` după conectare; `test` trimite; `disconnect` șterge ambele fișiere și scrie audit; `status.stale` pe un `lastSuccess` de 3 zile.
- **Integrare, `telegram-digest.integration.test.mjs`** (în `src/app/server/`): aplicația de test pornită într-un home temporar, cu copii, vizite și achitări create prin API, **rămâne pornită** și tocmai a salvat o înregistrare; `runTelegramDigest` cu `fetch` fals și `now` fix → mesajul conține numele așteptate, `telegram-stare.json` are `zi:` și cheile `plata:`, ieșire 0; a doua rulare în aceeași zi → niciun apel, ieșire 0; eșec tranzitoriu → ieșire 1, fără chei, `lastError`; eșec permanent → ieșire 0 cu `lastError`; fără `telegram.json` → ieșire 0 fără apel; baza serverului neschimbată (revizia identică) după toate rulările.
- **Lansator, `tests/desktop-lifecycle.ps1`, scenariul 4:** `Startica.exe --register-task --quiet --home <temp>` → `schtasks /Query /TN "Startica\Rezumat Telegram <hash>"` reușește și XML-ul conține `--telegram`; `Startica.exe --telegram --quiet --home <temp>` → cod 0 și „Neconfigurat” în `<temp>\Jurnale\telegram.log`; cu un `telegram.json` fals → cod 0 și `lastError` de rețea sau 401 în stare (fără internet real în test: token de formă validă, cheie inexistentă → 401 → permanent → 0); `--unregister-task` → interogarea eșuează. Se rulează cu Startica pornită din același home, ca dovadă a coexistenței.
- **Browser smoke:** ecranul Setări arată „Neconfigurat.”; un token „abc” → mesajul de eroare fără apel de rețea; butoanele din toolbar ascunse.
- **Regresii plantate:** `readOnly: true` scos din `openDatabaseReadOnly` → testul de refuz al `INSERT` pică; cheia `zi:` nescrisă → „a doua rulare nu retrimite” pică; `escapeHtml` scos din rezumat → testul cu `<` pică. Fiecare se readuce imediat la loc.

## 11. Împărțirea implementării

| Sarcină | Conținut | Fișiere deținute | Model |
| --- | --- | --- | --- |
| T0 | `openDatabaseReadOnly` și `formatLongDate`, cu teste (§3.2, §5) | `core/server/database/sqlite-connection.mjs` (+test), `shared/format/date-format.mjs` (+test) | Sonnet |
| T1 | Domeniul rezumatului și registrul (§5, §10) | `telegram-notify/domain/*`, `telegram-notify.types.d.mts` (partea de domeniu) | Sonnet |
| T2 | Repository-uri, serviciu, rute, fake API, teste unitare și de integrare ale rutelor (§4, §6); `startTestApplication` primește `fetch` | `telegram-notify/server/*`, `test-support/*`, `index.server.mjs`, tipuri, `tests/support/start-test-application.mjs` | Sonnet |
| T3 | Compunerea: `telegram-digest.mjs` + testul de integrare, `startica_telegram.mjs`, rutele în `create-application.mjs`, exporturile din `children`/`visits`/`billing`, `$headPaths` și verificările din pachet, cazurile de arhitectură (§7) | `app/server/telegram-digest.mjs` (+test), `startica_telegram.mjs`, `create-application.mjs`, `children/index.server.mjs`, `visits/index.server.mjs`, `billing/index.server.mjs` (nou), `build-client-package.ps1`, `import-boundaries.test.mjs` | Sonnet, după Vizite |
| T4 | Panoul din Setări: HTML, controller, view, teste, compunere, secțiunea de smoke (§4.3, §10) | `web/index.html` (doar panoul nou), `telegram-notify/web/*`, `index.web.mjs`, `compose-screens.mjs`, `tests/browser-smoke.mjs` (secțiunea Telegram) | Sonnet, după Vizite |
| T5 | Lansatorul: `--telegram`, `--register-task`, `--unregister-task`, reînregistrarea la pornire; Inno; scenariul 4 din lifecycle; README-ul lansatorului (§8) | `launcher/Startica.cs`, `launcher/README.md`, `Startica.iss`, `tests/desktop-lifecycle.ps1` | Sonnet |
| H1 | Scheletul: `README.md` al feature-ului cu contractele de mai sus, `index.*.mjs` goale cu comentariu (ca H1 din Vizite); GHID și CITESTE-MA (§8.3) | `telegram-notify/README.md`, `index.*.mjs`, `GHID-LIVRARE.md`, `CITESTE-MA.txt` | Haiku |
| H2 | `npm run check`, `npm run test:e2e`, capturi ale panoului la 800/1024/1280 px, versiunea 1.6.0, `NOTA-LIVRARE-1.6.0.md`, rularea instalării de probă după pașii din §12 și raportarea ieșirilor | `package.json`, `Livrare/*` | Haiku |

Ordine: T0, T1, T5 și H1 pornesc acum, în paralel, pe fișiere disjuncte; T2 după T1 (numele `buildDailyDigest` și tipurile) și T0 nu-i sunt necesare. T3 și T4 după intrarea Vizitelor în `master` și rebazarea ramurii; T3 după T0 + T2; T4 după T2 (contractele rutelor). H2 la final. Fable citește diff-urile T3 (compunere multi-feature și pachet) și T5 (lansator, instaler); Opus le citește pe celelalte.

## 12. Porțile de verificare înainte de livrare

1. `npm run check` verde, apoi `npm run test:e2e` verde (smoke + `desktop-lifecycle.ps1` cu scenariul 4).
2. Regresiile plantate din §10 demonstrate și anulate, cu ieșirea comenzii în raport.
3. Capturi ale panoului „Notificări Telegram” în cele trei stări (neconfigurat, conectat, eroare) la 800/1024/1280 px, pe o **copie** a `Startica_Date` într-un folder temporar.
4. Pe instalerul construit, cu `Startica.exe --home <folder temporar>` și un bot real al utilizatorului: „Conectează” → mesajul de probă ajunge pe telefon; `schtasks /Query /TN "Startica\Rezumat Telegram <hash>"` arată sarcina; `Startica.exe --telegram --quiet --home <temp>` → rezumatul ajunge pe telefon în timp ce Startica e deschisă din același home, iar `telegram-stare.json` are `zi:`; a doua rulare nu trimite nimic; sarcina reală (`Startica\Rezumat Telegram`, home-ul implicit) apare după instalare și dispare după dezinstalare (`schtasks /Query`). Folderele temporare și sarcina de test se șterg la final.
5. Versiune 1.6.0, pachetul construit, SHA-256 în `NOTA-LIVRARE-1.6.0.md`, GHID și CITESTE-MA actualizate înainte de construire.

## 13. Riscuri

- **Datele pleacă de pe calculator** (nume, telefoane, sume) prin Telegram; acceptat de utilizator, spus în GHID. Nimic medical nu intră vreodată în mesaj (`healthNotes` nu e citit de rezumat; testat).
- **Token-ul în fișier text**, în `%LOCALAPPDATA%` (ACL per utilizator). Cine îl are poate scrie ca botul și poate afla `chatId`-ul operatorului; nu ajunge în backupuri, iar „Deconectează” îl șterge. Un token compromis se revocă din @BotFather și se reconectează.
- **Oricine găsește botul** îi poate scrie; Startica nu citește mesajele decât la „Conectează” (ultima conversație privată). Dacă altcineva a apăsat Start ultimul, operatorul vede „Conectat cu <nume străin>” și reconectează după ce apasă el Start.
- **Task Scheduler dezactivat prin politică sau sarcina ștearsă:** rezumatul nu vine; `stale` după 48 h în Setări, reînregistrare la pornire.
- **Rulare doar cu utilizatorul autentificat;** calculator oprit la 08:00 → mesaj la pornire; oprit toată ziua → nimic. Documentat.
- **Numele zilelor și lunilor** depind de ICU-ul din Node; `formatDate` folosește deja `ro-RO`, iar `formatLongDate` e verificat pe Node din pachet.
- **Rezumat mai lung de 4096 de caractere** (grădiniță mare, luni): tăiat în bucăți, în ordine; un eșec la a doua bucată lasă prima trimisă și reia toată ziua la următoarea rulare (mesaj dublat parțial); acceptat.
- **Schimbări în Bot API:** se folosesc doar `getMe`, `getUpdates`, `sendMessage` cu câmpuri de bază.
- **Bază nemigrată** după o actualizare fără pornirea Startica: rezumatul pică permanent cu mesaj clar până la prima pornire.

## 14. În afara ariei

- Comenzi trimise botului (interogări din Telegram), răspunsuri automate.
- Mesaje către părinți (Telegram, SMS, e-mail) și trimiterea `reminderMessage` prin Telegram.
- Ora, conținutul sau destinatarii configurabili; grupuri Telegram; mai mulți operatori.
- Memento-ul „peste 30 de minute” prin Telegram; notificări Windows cu fereastra închisă; tray.
- Criptarea `telegram.json`; DPAPI.
- Cardul de stare Telegram în Panou; starea rămâne în Backup și setări.
- Modulul Bazin.
