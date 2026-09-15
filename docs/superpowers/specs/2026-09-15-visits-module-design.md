# Modulul Vizite (înscrieri): calendar, statut, înscriere și notificări (1.5.0)

Stare la scriere: `feat/vizite` pornit din `master` @ `d2c7f1d` (v1.4.0 livrată); `npm test` = 296 de teste (294 trec, 2 sărite). La scrierea acestui document, folderul de lucru era pe `fix/1.4.1`, la același commit; specificația intră în `feat/vizite`. Deciziile privind copia din afara calculatorului rămân în vigoare: folder extern sincronizat de Google Drive, copii **necriptate**, fără cheie de recuperare, un operator, un calculator. Utilizatorul a aprobat răspunsurile la întrebările de produs; răspunsurile lui sunt marcate **(U)**, restul sunt hotărâri ale arhitectului, luate ca implicit.

## 1. Problema

Familiile care vin să vadă grădinița înainte de înscriere nu au azi nicio evidență în Startica: programările stau în agendă sau în telefon, iar când familia se decide, fișa copilului se scrie de la zero. Modulul ține vizitele într-un calendar, urmărește drumul programată → efectuată → înscris/renunțat, creează fișa copilului dintr-un clic și anunță operatorul de vizitele de azi și de mâine, în aplicație și printr-o notificare Windows cât timp fereastra e deschisă.

Fapte verificate în cod, care fixează designul:

- Un tip nou de înregistrare în `TYPES` nu cere nicio migrare: tabelul `records(kind, id, payload)` e generic, `emptyState()` primește lista nouă, iar `upgradeSnapshot` (`record-snapshot-upgrade.mjs:14-21`) tolerează atât un backup fără tipul nou (lista rămâne goală), cât și unul cu un tip necunoscut (notă, nu eroare). Restaurarea locală și cea din folderul extern (1.4.0) funcționează neschimbate.
- **Exportul Excel implicit conține tot**: fila `Startica_Date` scrie JSON-ul complet al fiecărei înregistrări din toate tipurile (`excel-workbook.mjs:285-289`). Fără o regulă explicită, datele medicale ale vizitelor ar intra automat în export.
- **Istoricul păstrează integral `before`/`after`** (`audit-log.repository.mjs:37`), inclusiv la restaurare și import (`replaceAllRecords`). Orice regulă de ștergere a datelor medicale ar fi anulată de istoric fără o redactare la scriere.
- `/api/diagnostic` întoarce doar versiune, căi, starea backupului, numele copiilor și jurnalul (`diagnostic.routes.mjs:43-57`); nu conține înregistrări.
- Dialogul generic de editare primește câmpurile per tip prin `fieldsByType` (`compose-screens.mjs:194`) și salvează mereu prin `/api/record` (`record-editor-dialog.mjs:87`); nu are precompletare și nici trimitere alternativă. Ambele sunt necesare la înscriere.
- Grila lunară există o singură dată, în `children/domain/birthdays.mjs:37-90`, cu randarea în `dashboard.view.mjs:16-41` și stilurile `.cal-*` în `dashboard.css`; nu are navigare între luni.
- Fereastra e Chrome/Edge `--app` pe `http://127.0.0.1:<port>` cu `--user-data-dir` propriu (`Startica.cs:476-477`): `127.0.0.1` e context sigur, deci `Notification` există, iar permisiunea acordată o dată rămâne în profilul lansatorului.

## 2. Decizii

| Decizie | Alegere | Motiv |
| --- | --- | --- |
| Entitate | Tip nou `visits` în `TYPES`, în tabelul `records`; separat de `children` | O vizită e a unei familii încă neînscrise; backup, restaurare, revizie, editor generic, arhivare și ștergere vin gratuit |
| Date medicale **(U)** | Text liber în câmpul dedicat `healthNotes`, în clar în bază, ca restul datelor; exclus mecanic din export și din istoric; șters automat | Utilizatorul a refuzat criptarea și orice cheie; un câmp separat poate fi exclus și șters, spre deosebire de `notes` |
| Copia externă | Datele medicale **ajung în clar în copia din Google Drive**, exact ca `notes`-urile copiilor de azi | Consecința directă a deciziei de mai sus; se spune explicit în GHID |
| Retenție **(U)** | `healthNotes` se golește la 12 luni de la ultima schimbare de statut a vizitei, indiferent de statut; vizita rămâne (pentru statistici) | O regulă, nu trei; termen rezonabil pentru o familie care revine |
| Retenție la copii | `children.healthNotes` se golește la 12 luni de la arhivarea fișei (`archivedAt`); cât fișa e activă, rămâne | Scopul (îngrijirea copilului) încetează la plecare; aceeași măturare, o condiție în plus |
| La înscriere | `healthNotes` se **mută** în noul câmp `children.healthNotes` și se golește pe vizită | Alergiile contează la copilul înscris; nimeni nu redeschide vizitele vechi |
| Reprogramare | Aceeași înregistrare: statutul revine la `Programată`, data/ora se schimbă, `history` primește o intrare | O familie e numărată o singură dată; o a doua înregistrare ar dubla statisticile și ar orfani notele |
| Ecrane | Ecran propriu „Vizite” (calendar, contoare, listă) + un card „Vizite azi / mâine” în Panou; fără ecran separat de înscrieri | Calendarul are nevoie de spațiu; pâlnia sunt patru numere |
| Statuturi | `Programată`, `Efectuată`, `Neprezentată`, `Înscris`, `Renunțat` (valori românești, ca `CHILD_STATUSES`); „reprogramată” e un eveniment în `history`, nu un statut | O vizită reprogramată e din nou programată |
| Înscriere | `POST /api/visits-enrol`, o singură tranzacție: fișa copilului + vizita marcată `Înscris` | Fără stări intermediare (copil creat, vizită neschimbată) |
| Calendar | Grila lunară extrasă în `#shared/domain/month-grid.mjs`, randarea în `#shared/ui/month-calendar.mjs`, stilurile `.cal-*` în `components.css` | Doi consumatori (zile de naștere, vizite) = shared kernel, conform convențiilor |
| Notificări | Web Notifications API din fereastra `--app`; permisiune cerută dintr-un buton; cardul din Panou e canalul principal | Chrome/Edge tratează cererile fără gest ca „liniștite”; fără service worker, deci doar cât fereastra e deschisă |
| Numele copilului | Câmpul se numește `name` (nu `childName`) | Căutarea și sortarea listelor din `#shared/ui` citesc `row.name`, `row.parent`, `row.phone`; nimic de adaptat |
| Versiune | 1.5.0, `Livrare\Startica_Setup_1.5.0.exe`, `NOTA-LIVRARE-1.5.0.md` | Funcționalitate nouă, contract de date extins |

Abordări respinse:

- **Criptare la nivel de câmp cu cheie legată de calculator (B1):** datele medicale ar fi singurul lucru pe care restaurarea din folderul extern (1.4.0) nu îl poate aduce înapoi pe un calculator nou, dacă cheia nu stă lângă date (inutil) sau nu e păstrată în altă parte (cheia de recuperare refuzată). Ar fi cerut și criptarea în istoric și în export, plus decriptare pe server, deci textul ar fi ajuns oricum în clar în `/api/state`. Cost ~1 zi-agent pentru protecție doar „pe disc”.
- **Doar o bifă „are nevoi speciale”, fără text (B2):** renunță la cerința declarată de utilizator.
- **Tabel SQLite propriu pentru vizite:** ar fi ieșit din backup-snapshot, `replaceAllRecords`, revizie și editorul generic; fiecare ar fi avut nevoie de cod special.

**Cadru legal, neverificat.** Datele despre sănătate sunt o categorie specială de date personale (GDPR, art. 9); temeiul rezonabil este consimțământul explicit al familiei, care le oferă pentru îngrijirea copilului; limitarea stocării (art. 5 alin. 1 lit. e) cere un termen și o ștergere reală. Legea română de aplicare este Legea 190/2018. Aceste trimiteri sunt ale arhitectului, nu ale unui jurist, și **nu sunt consultanță juridică verificată**: dacă în aplicație se vor introduce date medicale reale, grădinița trebuie să le verifice cu persoana care se ocupă de protecția datelor (consimțământ, informare, termen de păstrare). Textul GHID-ului spune același lucru.

## 3. Modelul de date

### 3.1 `visits` (`record-schema.mjs`, `record-types.d.mts`)

| Câmp | Tip | Obligatoriu | Validare / implicit |
| --- | --- | --- | --- |
| `id` | `VIZ-<uuid>` | da | regula comună de id |
| `name` | text | da | numele copilului, `trim`, ne-gol |
| `birthDate` | `YYYY-MM-DD` | nu | `dateOK`; vârsta se calculează cu `formatAge` |
| `parent`, `phone` | text | `parent` da | ca la copii |
| `parent2`, `phone2` | text | nu | |
| `date` | `YYYY-MM-DD` | da | `dateOK` |
| `time` | `HH:MM` | da | `/^([01]\d|2[0-3]):[0-5]\d$/` |
| `status` | `VISIT_STATUSES` | da | implicit `Programată`; `Înscris` cere `childId` |
| `statusChangedAt` | ISO | da | `Date.parse` valid; scris de client la schimbarea statutului, de server la înscriere și la expirare |
| `history` | `{ at, status, date, time }[]` | da | implicit `[]`, ≤ 1000, sortat după `at`; o intrare la creare și la fiecare schimbare de statut sau de dată/oră |
| `desiredStartDate` | `YYYY-MM-DD` | nu | `dateOK` |
| `desiredGroupId` | id grupă sau `null` | nu | implicit `null`; `validateState` și `assertRecordReferencesExist` cer grupa existentă |
| `source` | text | nu | cum a aflat de grădiniță |
| `healthNotes` | text | nu | **sensibil**; implicit `''` |
| `postVisitNotes` | text | nu | observații după vizită |
| `notes` | text | nu | adăugat de dialogul generic |
| `childId` | id copil sau `''` | doar la `Înscris` | implicit `''`; obligatoriu ne-gol când `status === 'Înscris'`, interzis altfel; `validateState` cere copilul existent |
| `archived`, `archivedAt` | | nu | ca la celelalte tipuri |

`VISIT_STATUSES = ['Programată', 'Efectuată', 'Neprezentată', 'Înscris', 'Renunțat']` exportat din `record-schema.mjs`. `RecordType`, `RecordsSnapshot`, `RecordByType`, `emptyState`, `FIELDS.visits` și `records-report.summary` (numărul de vizite) se extind. Ștergerea definitivă: `'visits'` intră în `DELETABLE_TYPES` (`record-editing.routes.mjs:13`) și în `EditableRecordType`; un copil referit de o vizită înscrisă nu se șterge definitiv (aceeași gardă ca pentru achitări, în `deleteRecord`).

### 3.2 `children.healthNotes`

Câmp nou, text, opțional, în `FIELDS.children` și în `Child`. Apare în editorul copilului (secțiune „Date medicale”, după „Părinți”) și în fișa copilului; nu apare în lista de copii, în CSV-ul de import și nici în fila „Copii” din export.

### 3.3 Câmpurile sensibile (`record-schema.mjs`)

```js
export const SENSITIVE_FIELDS = { visits: ['healthNotes'], children: ['healthNotes'] };
export function stripSensitiveFields(type, record)   // copie fără cheile sensibile — export
export function redactSensitiveFields(type, record)  // copie cu valorile ne-goale înlocuite de '[date medicale]' — istoric
```

- `exportWorkbook` scrie în `Startica_Date` doar `stripSensitiveFields(type, record)`; fila `Startica_Format` primește rândul „Datele medicale (vizite, copii) nu sunt exportate; un reimport le lasă goale.”
- `audit-log.repository.recordChange` aplică `redactSensitiveFields(recordType, before/after)` înainte de `INSERT`. Un singur punct, deci acoperă `/api/record`, înscrierea, expirarea, restaurarea și importul. `listChangedFields` arată „date medicale: [date medicale] → (gol)” la expirare și nu arată nimic când textul s-a schimbat fără să se golească; acceptat.
- Căutarea din liste (`matchesRecordListSearch`) nu citește `healthNotes`; câmpul nu apare în nicio coloană, badge sau card.

### 3.4 Regulile de statut (`visits/domain/visit-status.mjs`, pur)

- `allowedNextStatuses(status)`: `Programată → Efectuată | Neprezentată | Renunțat`; `Efectuată → Renunțat`; `Neprezentată → Renunțat`; `Renunțat → (nimic)`; `Înscris → (nimic)`. `Înscris` nu apare niciodată în editor: îl pune doar ruta de înscriere.
- `rescheduleVisit(visit, { date, time }, now)`: permis din orice statut în afară de `Înscris`; întoarce vizita cu `status: 'Programată'`, noua dată/oră, `statusChangedAt = now` și intrarea în `history`.
- `applyVisitStatus(visit, status, now)`: verifică tranziția, întoarce vizita cu statutul nou, `statusChangedAt` și intrarea în `history`. Folosit de `read()` din editor și de butoanele rapide din listă, ca istoricul să fie scris o singură dată, la fel.
- Serverul verifică doar invarianta `Înscris ⇔ childId` (în `normalizeRecord`) și existența referințelor; tranzițiile sunt aplicate de client, ca la statutul copiilor azi. Un operator, un calculator.

### 3.5 Statistici și memento-uri (pure)

- `summarizeVisitFunnel(visits, todayStr)`: `{ scheduled, done, enrolled, withdrew }` — `scheduled` = `Programată` cu `date >= azi`; celelalte = numărul vizitelor cu statutul respectiv și `statusChangedAt` în ultimele 12 luni; vizitele arhivate nu se numără.
- `countVisitsForDays(visits, todayStr)`: `{ today, tomorrow, items }` — vizite `Programată`, nearhivate, azi și mâine, sortate după oră. Folosit de badge-ul din navigare și de cardul din Panou (injectat în dashboard de `app/`, ca `listUpcomingBirthdays`).
- `selectDueReminders(visits, now, notifiedKeys)`: întoarce `{ key, title, body }[]`: cheia `zi:<YYYY-MM-DD>` o dată pe zi când există vizite azi („Vizite azi”, „3 vizite: 09:00 Popescu, 11:30 Ionescu, …”), și `vizita:<id>:<date>:<time>` când ora vizitei e în următoarele 30 de minute și nu a trecut („Vizită peste 20 min”, „10:00 · Popescu Ana · 0722…”). Cheile deja notificate se sar.
- `selectExpiredHealthNotes(snapshot, todayStr)`: vizitele cu `healthNotes` ne-gol și `daysBetween(statusChangedAt.slice(0, 10), azi) >= 365`, plus copiii arhivați cu `healthNotes` ne-gol și `archivedAt` mai vechi de 365 de zile.

## 4. Serverul (`src/features/visits/server/`)

### 4.1 `visits.service.mjs`

- `enrolChild({ visitId, child }, request)` → `runRevisionTransaction(request, { action: 'inscriere-vizita', backupBefore: false }, () => { … })`:
  1. `visit = recordRepository.find('visits', visitId)`; lipsă → `fail('Vizita nu mai există.', 409)`; `status === 'Înscris'` → `fail('Copilul a fost deja înscris din această vizită.', 409)`; arhivată → `fail('Reactivează vizita înainte de înscriere.')`.
  2. `record = normalizeRecord('children', child)`; `exists('children', record.id)` → `fail('ID deja folosit.', 409)`; `assertRecordReferencesExist('children', record, exists)`; `save('children', record)`; audit `{ action: 'adăugare', recordType: 'children', before: null, after: record }`.
  3. `updated = normalizeRecord('visits', { ...visit, status: 'Înscris', childId: record.id, healthNotes: '', statusChangedAt: now, history: [...visit.history, { at: now, status: 'Înscris', date: visit.date, time: visit.time }] })`; `save('visits', updated)`; audit `modificare` cu `before: visit, after: updated` (redactate de repository).
  4. Răspunsul e `RevisionEnvelope`-ul tranzacției, plus `childId`.
  Fișa copilului vine din editorul precompletat, deci operatorul o poate corecta înainte de salvare; `child.healthNotes` e ce a lăsat el în formular, nu o copie forțată a vizitei.
- `expireHealthNotes(todayStr = today())`: `selectExpiredHealthNotes(readSnapshot(), todayStr)`; dacă e gol, întoarce `{ expired: 0 }` fără scriere; altfel `runRevisionTransaction({ requestId: randomUUID(), revision: recordRepository.currentRevision() }, { action: 'expirare-date-medicale' }, () => …)`: fiecare înregistrare e salvată cu `healthNotes: ''` și consemnată cu `action: 'expirare date medicale'`. Cererea sintetică e legitimă: tranzacția cere doar `requestId` și `revision`, iar la pornire nu există altă filă.

### 4.2 Rute (`visits.routes.mjs`)

| Rută | Cerere | Răspuns 200 | Erori |
| --- | --- | --- | --- |
| `POST /api/visits-enrol` | `{ visitId, child, revision, requestId }` | `RevisionEnvelope & { childId }` | 400 din `normalizeRecord`/referințe; 409 cele din §4.1 |

Crearea, editarea, arhivarea și ștergerea vizitelor trec prin `/api/record` și `/api/record-delete`, ca la copii.

### 4.3 Pornirea (`create-application.mjs`, `main.mjs`)

`createApplication` compune `visitsService` din `recordWriteDependencies` și expune `app.expireHealthNotes`. `main.mjs` îl apelează în același `setTimeout` de după `listen`, **după** `app.backup('pornire')`, într-un `try/catch` propriu: o eroare ajunge în jurnal (`console.error('Expirare date medicale: …')`) și nu oprește pornirea. `startTestApplication` nu îl apelează (testele îl invocă explicit).

## 5. Interfața

### 5.1 Navigare și ecran (`web/index.html`)

Buton `<button class="nav" data-view="visits"><span class="dot"></span>Vizite<b id="visitsCount">0</b></button>` în primul grup, după „Grupe”; badge = vizite azi + mâine. Secțiunea:

```
<section class="view" id="visits">
  <h2>Vizite</h2>
  <div class="stats" id="visitsFunnel"></div>                       <!-- 4 carduri: Programate · Efectuate · Înscriși · Renunțat (12 luni) -->
  <div class="toolbar">
    <button class="btn btn-ghost" id="visitsPrevMonth">‹</button><strong id="visitsMonthLabel"></strong><button class="btn btn-ghost" id="visitsNextMonth">›</button>
    <button class="btn btn-ghost" id="visitsToday">Azi</button>
    <button class="btn btn-primary" data-create="visits">Adaugă vizită</button>
    <button class="btn btn-ghost" id="visitsNotifyButton" hidden>Activează notificările</button>
    <small id="visitsNotifyHint"></small>
  </div>
  <div class="month-calendar" id="visitsCalendar"></div>
  <div class="toolbar"><input id="visitsSearch" placeholder="Caută copil sau părinte"><select id="visitsStatus"></select><label><input type="checkbox" id="visitsAllMonths">Toate lunile</label><label><input type="checkbox" id="visitsArchive">Arhivate</label></div>
  <div class="table-wrap"><table><thead id="visitsHead"></thead><tbody id="visitsTable"></tbody></table></div>
  <p class="empty" id="visitsSummaryText"></p>
</section>
```

`web/styles/features/visits.css` intră în `STATIC_FILES` și în `<link>`-urile din `index.html` (alfabetic, după `review-center.css`); testul listei albe îl verifică. Regulile `.cal-*` se mută din `dashboard.css` în `components.css`, cu aceeași ordine relativă; `.birthdays-*` și `.upcoming-*` rămân.

### 5.2 Calendarul partajat

- `#shared/domain/month-grid.mjs`: `buildMonthGrid(monthKey, todayStr)` → săptămâni Luni–Duminică de `{ date, day, inMonth, isToday, isCurrentWeek }`, exact logica de azi din `buildBirthdayCalendar`, parametrizată pe lună. `birthdays.mjs` o folosește cu `todayStr.slice(0, 7)` și adaugă `names`; testele lui rămân neschimbate.
- `#shared/ui/month-calendar.mjs`: `monthCalendarMarkup(weeks, renderCellContent)` — antetul zilelor și celulele cu clasele `.cal-cell/.cal-outside/.cal-today/.cal-current-week`, conținutul celulei venind din callback. `dashboard.view.mjs` îl folosește cu cip-urile de zile de naștere (același HTML ca azi, verificat în `dashboard.view.test.mjs`).
- Vizite: cip `HH:MM Nume` cu clasa statutului (`cal-chip-programata` etc.); clic pe zi = `selectedDate` (lista se restrânge la ziua aceea; al doilea clic o eliberează). Sub 720 px celula arată doar numărul: „3 vizite”; detaliile sunt în listă.

### 5.3 Ecranul (`visits/web/visits.controller.mjs`, `visits-list.view.mjs`, `visits-calendar.view.mjs`)

- Starea controller-ului: `{ month, selectedDate, search, status, allMonths, showArchived, sort }`; `month` pornește pe luna curentă („Azi” revine la ea). Se randează prin `renderCycle.addScreen('visits', …)` la fiecare reîncărcare și la orice schimbare locală.
- Lista arată vizitele lunii afișate (sau toate, cu „Toate lunile”), filtrate după statut, arhivare, `selectedDate` și căutare (`matchesRecordListSearch('visits', …)`), sortate implicit crescător după `date` + `time`; antetul e generat de `listHeadMarkup` cu coloanele Data · Ora · Copil (vârstă) · Părinte / telefon · Statut · Grupa dorită · Acțiuni. Acțiuni: `recordActions('visits', visit)` + butoane rapide „Efectuată”, „Neprezentată”, „Renunțat” (doar cele permise de `allowedNextStatuses`) și „Înscrie copilul” (doar la `Efectuată`). Butoanele rapide trimit `submitMutation('/api/record', { type: 'visits', mode: 'update', record: applyVisitStatus(visit, status, now) })`.
- Contoarele: `summarizeVisitFunnel`, patru carduri `.stat` ca în Panou.
- `visit-editor-fields.mjs` (structural `RecordEditorFields`, `idPrefix: 'VIZ'`): secțiunile „Copil” (`name`, `birthDate` cu indiciul de vârstă ca la copii), „Părinți”, „Vizita” (`date`, `time`, `status` = statutul curent + `allowedNextStatuses`, la creare doar `Programată`; sub câmpuri, notița „Schimbarea datei sau orei reprogramează vizita.”), „Dorințe” (`desiredStartDate`, `desiredGroupId`, `source`), „Date medicale” (`healthNotes` + notița „Date sensibile: nu apar în export și în istoric; se șterg automat la 12 luni de la ultima schimbare de statut.”), „După vizită” (`postVisitNotes`). `read()` aplică `rescheduleVisit` când s-au schimbat data/ora și `applyVisitStatus` când s-a schimbat statutul, apoi `normalizeRecord('visits', …)`.

### 5.4 Înscrierea (`record-editing`, `visits`, `app`)

- `record-editor-dialog.openEditor(type, id, options?)`, `options = { prefill?: object, submit?: (record) => Promise<unknown>, title?: string }`. Cu `prefill`, fișa nouă e `{ id: nou, ...prefill }`; `title` înlocuiește `fields.title`; `submit` se păstrează în `sessionState.editor` și, la trimitere, înlocuiește apelul `/api/record`. `RecordEditorEntry` și `EditableRecordType` se actualizează. Nimic altceva nu se schimbă în dialog; garda de modificări nesalvate funcționează la fel.
- `visits.api.mjs`: `enrolChild(visitId, child)` → `submitMutation('/api/visits-enrol', { visitId, child })`.
- Fluxul, compus în `compose-screens.mjs`: clic „Înscrie copilul” → controller-ul calculează `prefill = buildChildPrefill(visit)` (domain: `name`, `birthDate`, `parent`, `phone`, `parent2`, `phone2`, `groupId: desiredGroupId`, `attendanceDate: desiredStartDate`, `healthNotes`, `notes` = „Sursă: …” și `postVisitNotes`, pe rânduri) → `recordEditor.openEditor('children', undefined, { prefill, title: 'Înscrie copilul: ' + name, submit: child => visitsApi.enrolChild(visit.id, child) })` → la succes, `showNotice('Copil înscris. Vizita a fost marcată „Înscris”.')` și `childProfile.open(childId)`.

### 5.5 Panou (`dashboard.view.mjs`)

Card nou în `attentionItems`, primit prin `summarizeUpcomingVisits: () => countVisitsForDays(...)` injectat de `app/`: `{ count: today + tomorrow, icon: '◷', title: 'Vizite programate', detail: '2 azi · 1 mâine' (sau 'Nicio vizită azi sau mâine.'), action: 'Vezi calendarul', view: 'visits', tone: 'visits', forceShow: false }`. Stilul `.alert-visits` în `dashboard.css`. Cu `count === 0` cardul apare ca rând „clar”, ca celelalte.

### 5.6 Notificări (`visits/web/visit-reminders.controller.mjs`)

- Dependențe injectate: `readRecords`, `readNow: () => Date`, `notifications: { permission: () => 'default' | 'granted' | 'denied' | 'unsupported', request: () => Promise<string>, show: (title, body, key) => void }`, `rememberedKeys: { read: () => string[], write: (keys) => void }` (peste `localStorage['startica.visitReminders']`, cu `try/catch`), `eventBus`, `elements: { button, hint }`, `goToVisits`.
- La pornire și la fiecare 60 s (`setInterval`), plus la `records.reloaded`: dacă permisiunea e `granted`, `selectDueReminders(...)` → `show` pentru fiecare, cheile se adaugă și se păstrează doar cele care încep cu `zi:azi`, `zi:mâine` sau `vizita:<id>:azi|mâine`. Notificarea are `tag = key` (Chrome nu o dublează), iar `onclick` → `window.focus(); goToVisits()`.
- Butonul „Activează notificările” apare doar când permisiunea e `default`; la clic, `request()`; `granted` → butonul dispare; `denied` → indiciul „Notificările sunt blocate în browser; vizitele apar în Panou.”; `unsupported` (fără `Notification`) → butonul rămâne ascuns, fără indiciu.
- Fără notificări când fereastra e închisă și fără duplicate între sesiuni ale aceleiași zile (cheile persistă în profilul lansatorului).

## 6. Riscuri

- **Expunerea datelor medicale:** singurele căi de ieșire sunt baza, backupurile (locale și externe, în clar) și ecranul de editare/fișa copilului. Export și istoric sunt acoperite de `SENSITIVE_FIELDS`, verificate prin teste; o intrare nouă în `TYPES` cu câmp sensibil trebuie adăugată în listă (comentariul de lângă listă spune asta).
- **Backupurile vechi** păstrează notele șterse până ies din retenție (locală și externă); acceptat, documentat în GHID.
- **Măturarea la pornire** scrie o tranzacție doar când există ceva expirat; o eroare ajunge în jurnal și pornirea continuă. Ceasul dat înapoi nu șterge nimic în plus (compararea e „mai vechi de 365 de zile”).
- **Permisiune refuzată, Focus Assist, notificări dezactivate pentru browser în Windows:** tăcere; cardul din Panou și badge-ul din navigare sunt canalul principal. Acceptat, documentat.
- **Calendar în fereastră mică:** sub 720 px celulele arată numărul de vizite, lista arată detaliile; verificat în capturi la 800 și 1024 px.
- **Reimport din Excel** lasă `healthNotes` goale; spus în fila `Startica_Format` și în GHID; importul face oricum backup înainte.
- **Editorul generic** lasă operatorul să pună orice statut în afară de `Înscris`; serverul impune doar `Înscris ⇔ childId`. Acceptat: aceeași încredere ca la statutul copiilor.
- **Ștergerea unui copil înscris dintr-o vizită** e refuzată cât vizita există; arhivarea rămâne permisă.

## 7. Teste

- **Unitare, `record-schema.test.mjs`:** `normalizeRecord('visits')` cu fiecare câmp invalid (oră, dată, statut, `Înscris` fără `childId`, `childId` cu alt statut, `history` nesortat/prea lung, `desiredGroupId` invalid); `validateState` refuză `childId`/`desiredGroupId` inexistente; `stripSensitiveFields`/`redactSensitiveFields` pe vizite și copii, inclusiv valoarea goală nemodificată.
- **Unitare, `visits/domain/*.test.mjs`:** tranzițiile permise și refuzate; `rescheduleVisit` din fiecare statut; `applyVisitStatus` scrie `history` și `statusChangedAt`; pâlnia pe 12 luni, cu arhivate excluse; `countVisitsForDays` la graniță de zi și de an; `selectDueReminders` (o dată pe zi, 30 de minute, vizite trecute ignorate, chei deja notificate); `selectExpiredHealthNotes` la 364/365 de zile, copii arhivați și activi; `buildChildPrefill`.
- **Unitare, `month-grid.test.mjs`:** grila pentru luni care încep luni/duminică, februarie bisect, `isCurrentWeek` la trecerea de lună; `birthdays.test.mjs` neschimbat și verde.
- **Unitare, `audit-log.repository.test.mjs`:** o modificare de vizită cu `healthNotes` e scrisă redactată; `excel-workbook.test.mjs`: `Startica_Date` nu conține `healthNotes` pentru vizite și copii, iar reimportul dă vizitele fără câmp.
- **Unitare, web:** `visits.controller.test.mjs` (filtre, lună, zi selectată, butoane rapide, deschiderea înscrierii cu `prefill` și `submit`), `visit-reminders.controller.test.mjs` cu porturi false (permisiune `default/granted/denied/unsupported`, chei persistate, fără duplicate), `dashboard.view.test.mjs` pentru card.
- **Integrare, `visits.routes.integration.test.mjs`:** înscriere reușită (copil creat, vizită `Înscris`, `healthNotes` mutate, două intrări în istoric, cea a vizitei redactată), 409 pentru vizită lipsă/deja înscrisă, 400 pentru grupă inexistentă, `requestId` reluat idempotent, revizie veche 409; `expireHealthNotes` pe o bază cu vizite vechi și noi (doar cele vechi golite, o singură revizie, audit `expirare date medicale`), pe o bază fără nimic expirat (revizie neschimbată); `/api/record-delete` refuză copilul referit; restaurarea unui backup fără `visits` dă lista goală.
- **Browser smoke:** adaugă o vizită din editor, o vede în calendar și în listă cu badge-ul 1 (dacă e azi/mâine), o marchează „Efectuată”, „Înscrie copilul” → editorul precompletat → salvare → numărul de copii +1, statutul vizitei „Înscris”; cardul din Panou; butonul de notificări ascuns când `Notification` lipsește în headless.
- **Regresii plantate:** `stripSensitiveFields` scos din export → testul de export pică; redactarea scoasă din repository → testul de audit pică; `'visits'` scos din `DELETABLE_TYPES` → integrarea pică. Fiecare se readuce imediat la loc.

## 8. Împărțirea implementării

| Sarcină | Conținut | Fișiere deținute | Model |
| --- | --- | --- | --- |
| S0 | Grila și calendarul partajate (§5.2), fără schimbare de comportament; `birthdays` și `dashboard.view` le folosesc; `.cal-*` mutate | `src/shared/domain/month-grid.mjs` (+test), `src/shared/ui/month-calendar.mjs`, `children/domain/birthdays.mjs`, `dashboard/web/dashboard.view.mjs`, `web/styles/components.css`, `web/styles/features/dashboard.css` | Sonnet |
| S1 | Schema: `visits` în `TYPES`, `FIELDS`, `normalizeRecord`, `validateState`, `record-integrity`, `records-report`, tipuri, `SENSITIVE_FIELDS` cu aplicarea în export și în istoric, `children.healthNotes`, `DELETABLE_TYPES` + garda de ștergere (§3) | `record-schema.mjs` (+test), `record-types.d.mts`, `record-integrity.mjs` (+test), `records-report.mjs`, `excel-workbook.mjs` (+test), `audit-log.repository.mjs` (+test), `record-editing.routes.mjs`, `record-editing.types.d.mts` | Sonnet |
| S2 | Domeniul vizitelor (§3.4, §3.5) cu teste | `src/features/visits/domain/*` | Sonnet |
| S3 | Serviciu, rute, pornire, teste de integrare (§4) | `src/features/visits/server/*`, `visits.types.d.mts`, `create-application.mjs`, `app/server/main.mjs` | Sonnet |
| S4 | Editor de vizite, listă, calendar, controller, extensia `openEditor`, compunerea în `app/` (§5.1–5.4) | `src/features/visits/web/*`, `index.web.mjs`, `record-editor-dialog.mjs`, `compose-screens.mjs`, `global-actions.mjs` (doar dacă `data-create` are nevoie de tipul nou) | Sonnet |
| S5 | Memento-uri, cardul din Panou, câmpul medical în editorul și fișa copilului (§5.5, §5.6, §3.2) | `visit-reminders.controller.mjs` (+test), `dashboard.view.mjs` (+test), `child-editor-fields.mjs`, `child-profile.view.mjs` | Sonnet |
| H1 | Scheletul: butonul de navigare, secțiunea `#visits`, `<link>` + `STATIC_FILES` + `visits.css` gol, `README.md` al feature-ului, `index.server.mjs`/`index.web.mjs` cu exporturile din contractele de mai sus | `web/index.html`, `static-assets.mjs`, `web/styles/features/visits.css`, `src/features/visits/README.md`, `index.*.mjs` | Haiku |
| H2 | Secțiunea de smoke pentru vizite (§7), după S4 | `tests/browser-smoke.mjs` | Haiku |
| H3 | GHID și CITESTE-MA: „Vizite” (calendar, statuturi, înscriere, notificări: butonul, ce se întâmplă când sunt blocate), „Date medicale” (unde apar, unde nu, copia din Drive e în clar, ștergerea la 12 luni, backupurile vechi, reimportul Excel, verificarea cu persoana de protecția datelor) | `scripts/pachet-client/GHID-LIVRARE.md`, `scripts/pachet-client/CITESTE-MA.txt` | Haiku |
| H4 | `npm run check`, `npm run test:e2e`, capturi la 800/1024/1280 px cu raportarea ieșirii; versiune 1.5.0 în `package.json`; `NOTA-LIVRARE-1.5.0.md` | `package.json`, `Livrare/*` | Haiku |

Ordine: S0 și S1 întâi, în paralel, pe fișiere disjuncte; S2 și H1 pornesc odată cu ele (S2 depinde doar de `VISIT_STATUSES`, al cărui nume e fixat aici). S3 după S1 + S2; S4 după S1 + S2 + H1 (și S0 pentru calendar); S5 după S2 + S4. H2 după S4, H3 oricând, H4 la final. Fable/Opus citește diff-urile S1 și S3 înainte de integrare (schema și tranzacția sunt părțile cu efect în tot proiectul); restul le citește Opus.

## 9. Porțile de verificare înainte de livrare

1. `npm run check` verde, apoi `npm run test:e2e` verde.
2. Regresiile plantate din §7 demonstrate și anulate, cu ieșirea comenzii în raport.
3. Capturi ale ecranului Vizite (calendar plin, zi selectată, listă filtrată, editor cu secțiunea medicală, editorul copilului precompletat la înscriere), Panou cu cardul și Copii cu fișa, la 800/1024/1280 px, pe o **copie** a `Startica_Date` într-un folder temporar.
4. Pe instalerul construit, cu `Startica.exe --home <folder temporar>`: butonul „Activează notificările” → permisiunea din fereastra `--app` → o vizită programată peste 10 minute → notificarea Windows apare; se închide și se redeschide aplicația → butonul nu mai apare, notificarea nu se repetă în aceeași zi. Un export Excel → fila `Startica_Date` nu conține `healthNotes`.
5. Versiune 1.5.0, pachetul construit, SHA-256 în `NOTA-LIVRARE-1.5.0.md`, GHID și CITESTE-MA actualizate înainte de construire.

## 10. În afara ariei

- Modulul Bazin (abonamente, antrenori, plată per lecție): specificație proprie, după Vizite.
- Fila „Vizite” lizibilă în exportul Excel (fără date medicale) și importul de vizite din CSV.
- Notificări cu fereastra închisă (service worker, push, tray din lansator) și memento-uri prin SMS/e-mail.
- Roluri, cine a introdus datele (`actor` în istoric), acces multi-PC.
- Criptarea datelor medicale sau a copiilor externe.
- Ștergerea automată a altor date personale (fișele copiilor retrași, achitările vechi).
- Un ecran separat de înscrieri; contoarele stau în ecranul Vizite.
