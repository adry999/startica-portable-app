# Arhitectura Startica: analiză și plan de refactorizare incrementală

Stare, 14 septembrie 2026: **pașii 0–11 aplicați** (plasa de siguranță, aliasurile `#`, configurarea per mediu, shared kernel, infrastructura de server și de browser, toate feature-urile, inclusiv `billing` și `dashboard`, composition root-ul în `src/app` și împărțirea `web/app.css`, vezi §6). Pasul 12 este propus; tot codul aplicației este în `src/`. Folderul `referinta/` conține implementările de referință pentru cele două module, rulate și verificate într-un mediu izolat (vezi §7). Ambele au fost preluate de acolo; codul viu este cel din `src/features/`.

Pasul 10 a mutat ultimele ecrane și composition root-ul:
- `billing`: evaluarea lunii (`evaluateChildrenForMonth`), „Situația plăților” și „De notificat”;
- `dashboard`: sumarul de încasări, avansul nerepartizat, panoul de atenție, graficul pe 12 luni, zilele de naștere (injectate din `children`) și sumarul copiilor; formatarea contactelor părinților a intrat în `#shared/format`;
- server: `src/app/server/{create-application,session.routes,main}.mjs` compun direct core-ul și rutele feature-urilor; `startica_server.mjs` a rămas punctul de intrare (reexportă `createApplication`, pornește serverul doar când e rulat direct); `server/{routes,store,database,http,migrations}.mjs` au fost șterse;
- browser: `src/app/web/main.mjs` înlocuiește `web/app.js`, `app-session.mjs` înlocuiește `web/ui/session.mjs`, `navigation.mjs` preia `go`, iar `render-cycle.mjs` calculează o singură dată pe randare luna, evaluările, centrul de verificare și indiciile, apoi randează fiecare ecran prin `renderGuarded`, ascultând `records.reloaded` și `selected-month.changed`; `web/ui/` a fost șters, `index.html` încarcă `/src/app/web/main.mjs`.

Verificare: pe o copie a bazei reale, cele 30 de operații de la pasul 9 dau aceleași rezultate pe noul composition root; code-review independent a confirmat echivalența ecranelor mutate și ordinea randărilor.

Auditul din 14 septembrie a fost remediat după `docs/superpowers/plans/2026-09-14-audit-remediation.md`: scriptul V5 repară, documentația și comentariile fără istorie, confirmarea în doi pași, fieldset-ul și tipurile CSV unificate, exporturi și fațade moarte șterse, testele de la rădăcină mutate lângă module, `src/app/web/main.mjs` împărțit. Pașii 11–12 pornesc de aici.

Pasul 11 a împărțit `web/app.css` (2132 de linii) în `web/styles/{base,layout,components,print}.css` și câte un fișier per feature cu reguli proprii în `web/styles/features/`. `index.html` leagă un `<link>` per fișier, în ordinea bază → layout → componente → feature-uri (alfabetic) → print; `STATIC_FILES` are o intrare explicită per fișier, iar un test verifică că orice foaie de stil din `index.html` e în lista albă și există pe disc. Selectoarele duplicate au rămas reguli separate, în ordinea lor relativă. Unde noua ordine a fișierelor inversa câștigătorul între două reguli cu aceeași specificitate, declarația care pierdea mereu în original a fost ștearsă (`.cumulative-summary strong`/`p`/`small`, `.field input`, `.field.full` sub 720px, `.group-create`, `.filter-search input`), iar `.group-tile` a primit în `groups.css` înălțimea de 135px pe care o lua sub 720px de la `.card`. Rămâne o diferență: la tipărire, `print.css` anulează padding-ul lui `.attention-panel` și `.birthdays-panel` din Dashboard, un ecran pe care tipărirea îl ascunde oricum. Verificare: comparație `getComputedStyle` pentru fiecare element și pseudo-element, pe o copie a bazei reale, între `app.css` și fișierele noi — 87 de scenarii (12 ecrane × 5 lățimi, tipărire, 8 dialoguri și meniuri deschise), 144 048 de perechi, doar diferența de mai sus; aceeași comparație pe același cod dă 0 diferențe și prinde o modificare plantată. Stările `:hover`/`:focus` și dialogul de import Excel nu intră în comparație.

Pasul 9 a mutat feature-urile centrale:
- `record-editing`: `/api/record` și `/api/record-delete`, dialogul generic de editare, arhivarea, ștergerea definitivă și confirmarea din „De verificat”; integritatea referințelor și unicitatea numelor au intrat în `#shared/domain/record-integrity.mjs`. Câmpurile din editor sunt în feature-ul fiecărui tip (`children`, `payments` cu rândurile de repartizare, `expenses`) și sunt injectate în dialog de `web/app.js`, ca `record-editing` să nu importe alte feature-uri;
- `children`: importul CSV (server, rute, dialog), zilele de naștere, fișa copilului și lista de copii;
- `payments` și `expenses`: listele lor; mecanica comună a listelor (sortare pe antete generate, căutare, totaluri, selecție și arhivare în masă cu confirmare în doi pași) este în `#shared/ui/{record-list-*,bulk-selection}.mjs`;
- `data-transfer`: citirea și exportul Excel, raportul de import, importul istoricului V5, rutele de import și ecranul Excel; `findRecordIssues` din `review-center` este injectat, nu importat.

Au fost șterse `web/ui/{editor,transfers,profile-audit}.mjs`, `server/{children-csv,financial-import}.mjs` și `shared/excel.mjs`; `web/ui/views.mjs` păstrează doar navigația, sumarul copiilor și `render()` pentru Dashboard, Situația plăților și De notificat (pasul 10). Diferențe găsite la review și corectate înainte de integrare: opțiunile filtrului de copil din Achitări se refac doar la randarea completă, nu la fiecare tastare, iar mesajul arhivării în masă citește filtrul o singură dată. Verificare: pe o copie a bazei reale, înainte și după, 30 de operații (salvări și conflicte, referințe lipsă, nume duplicat, ștergeri, import Excel cu și fără confirmare, previzualizare, import CSV și reimport, import istoric) dau rezultate identice, inclusiv istoricul, cererile salvate și backupurile.

Pasul 8 a mutat modulele cu cuplaj mic:
- `review-center`: `issues` și `shared/review-center.mjs` → `domain/{record-issues,review-center}.mjs`, ecranul „De verificat” → `web/review-center.view.mjs`; `importReport` din `shared/domain.mjs` folosește `findRecordIssues`;
- `groups`: ruta `/api/group-delete` și ecranul Grupe; testul HTTP a plecat din `tests/groups.test.mjs` lângă rută;
- `expenses` (doar categoriile): `/api/category-delete`, lista de categorii și ecranul lor; lista de cheltuieli și câmpurile editorului rămân pentru pasul 9;
- `fee-setup`: `applyChildSetup` → `applyChildFeeSetup`, `/api/children-setup`, ecranul Taxe și grupe;
- `backup`: `server/backups.mjs` → `backup.service`, `backup-snapshot`, `backup-retention`; rutele `/api/health`, `/api/backups`, `/api/backup-preview`, `/api/backup`, `/api/restore`, `/api/settings`; starea backupului, restaurarea și setările din interfață. `server/backups.mjs` și `server/util.mjs` au fost șterse.

În `shared` au intrat `record-labels` (numele copilului și al grupei), `record-actions`, `pagination` și `records-summary`; `web/ui/parts.mjs` le re-exportă. `views.mjs` expune `onRender(listener)`, apelat la sfârșitul `render()` cu `{ month, review }`, ca ecranele mutate să folosească evaluarea calculată o singură dată. `web/app.js` compune toate controllerele. Testele `*.integration.test.mjs` pornesc serverul real și sunt excluse din `tsc`, altfel ar trage în verificare codul vechi fără tipuri. Mutările au fost făcute de patru agenți în paralel, pe fișiere disjuncte, după contracte de export fixate; integrarea și review-ul au fost făcute separat. Verificare: pe o copie a bazei reale, înainte și după, 23 de operații (ștergere grupă ocupată și goală, categorii, completare taxe validă și invalidă, backup manual, listă, previzualizare, restaurare, setări) dau aceleași statusuri, erori, revizii, stare, istoric, setări și backupuri. Singurul digest de cerere diferit este al restaurării, pentru că numele backupului conține un id aleator.

Pasul 7 a adus `payment-assignment` în `src/features/payment-assignment/`. `shared/payment-matching.mjs` a fost împărțit în `domain/` fără schimbări de logică, iar testele lui unitare au plecat din `tests/fixes.test.mjs` lângă cod. Service-ul, controller-ul și fake-urile din `tests/support/` vin din referință, iar view-ul e portat din `web/ui/assign.mjs`, care a fost șters. View-ul reconstruiește tabelul doar când se schimbă coada, deci completarea și golirea selecțiilor nu mai redesenează 200 de rânduri. `sortTable` s-a mutat în `#shared/ui/table-sort.mjs` (`web/ui/parts.mjs` îl re-exportă), iar contractul `persistence.d.mts` a intrat în `src/shared/contracts/`. `server/store.mjs` expune `recordRepository` și `runRevisionTransaction`, din care `server/routes.mjs` creează service-ul. `POST /api/payments-assign` are același contract. Diferența de ordine: dublurile și asocierile incomplete sunt refuzate cu 400 înaintea verificării reviziei. `web/app.js` compune controller-ul, publică `selected-month.changed` la schimbarea lunii și îl înregistrează cu `registerScreen('assign', …)`. „De notificat” folosește `findUnassignedPaymentHintsByChild` din feature până la mutarea `billing`. Browser smoke acoperă acum Asocierea: coadă, contor, completare unică, salvare. Verificare: pe o copie a bazei reale, înainte și după, răspunsurile pentru listă goală, dubluri, copil inexistent, achitare deja asociată, salvare, reluare, `requestId` refolosit și revizie veche coincid. La fel starea, istoricul și cererile salvate. Singura diferență e la backupuri: o cerere cu dubluri nu mai lasă un backup `inainte-asociere-achitari` inutil, pentru că e refuzată înainte de tranzacție.

Pasul 6 a adus `audit-log` în `src/features/audit-log/` și contractul `AuditTrail` în `src/shared/contracts/`. `/api/audit` primește `?beforeEntryId` și întoarce `{ entries, nextBeforeEntryId }`, cu intrările deja deserializate. `server/store.mjs` injectează repository-ul ca `auditTrail` în tranzacția cu revizie și păstrează `store.audit(...)` ca adaptor pentru rutele nemigrate. Istoricul a ieșit din `web/ui/profile-audit.mjs`, unde rămâne doar fișa copilului. `web/app.js` compune controller-ul și îl leagă de navigație prin `registerScreen('audit', …)` (numele din pasul 7; la pasul 6 era `onViewOpened`). Eroarea de încărcare apare acum în ecran, nu în banner, iar „Mai multe” se ascunde când nu mai sunt pagini. Verificare: pe o copie a bazei reale, înainte și după, starea, reviziile, cererile salvate, rândurile de istoric (adăugare, modificare, ștergere) și backupurile sunt identice.

Pasul 5 a mutat în `src/core/web/` clientul API (`ApiError`), store-ul sesiunii (publică `records.reloaded`), event bus-ul, starea ecranelor și bannerul de mesaje, cu teste colocate. În `src/app/web/` au ajuns indicatorul de salvare, selectorul de lună, navigația pe mobil și protecția la închidere cu modificări nesalvate. `web/ui/session.mjs` compune aceste module și exportă același obiect `session`. `web/app.js` rămâne punctul de intrare până la pasul 10, pentru că încă importă ecranele din `web/ui/`.

Pasul 4 a mutat în `src/core/server/` erorile, HTTP-ul (gărzi, fișiere statice, dispatcher de rute), baza de date (conexiune, schemă, migrări), setările, repository-ul de înregistrări și tranzacția cu revizie, cu teste colocate. `server/util.mjs`, `http.mjs`, `database.mjs` și `migrations.mjs` sunt re-exporturi. `server/store.mjs` compune modulele din core și păstrează istoricul până la pasul 6. `server/routes.mjs` își păstrează regulile, dar folosește dispatcher-ul. `createApplication` rămâne în `startica_server.mjs` până la pasul 10. Verificare: aplicația pornită înainte și după pe copii ale bazei reale (105 copii, 811 achitări, 1201 cheltuieli) dă rezultate identice pentru stare, revizie, reluarea cererii, conflictele 409, digest-ul salvat, istoric și backupuri.

Pasul 3 a mutat în `src/shared/`:
- `domain/`: `calendar-month`, `money`, `record-schema`, `records-report`, `payment-allocations`, `tuition-obligation`;
- `format/`: escape HTML, bani, date, mărimi de fișier și căutarea fără diacritice, unificată din cele două `normalizeSearch` identice;
- `ui/`: `element-lookup`, `nav-count-badge`, `child-picker`.

Căile vechi (`shared/domain.mjs`, `shared/text.mjs`, `web/ui/dom.mjs`, `web/ui/child-picker.mjs`) au rămas re-exporturi cu aceleași nume până la mutarea tuturor consumatorilor; au fost șterse la remedierea auditului.

Pasul 2 a adăugat `src/config/environment.mjs`, singurul cititor al variabilelor `STARTICA_PROFILE`, `STARTICA_PORT` și `STARTICA_NO_BROWSER`, cu validare la pornire. `startica_server.mjs` îl folosește, iar `startica_desktop.ps1` setează `STARTICA_PROFILE=production`.

**De la pasul 2, pachetul de livrare trebuie să conțină `package.json` și `src/`**, pentru că serverul importă `#config/environment.mjs`.

Pasul 1 a adăugat:
- `package.json#imports`;
- import map-ul din `web/index.html`, permis prin hash-ul CSP calculat la fiecare servire a paginii;
- lista albă `/src/**` doar pentru codul de browser, în `server/http.mjs`, cu teste în `tests/http-modules.test.mjs`;
- o probă de alias în browser smoke.

Tot la pasul 1, `tests/desktop-lifecycle.ps1` pornește acum lansatorul VBS. Testul era stricat de la ștergerea lansatoarelor `.cmd`. Pachetul de livrare trebuie să conțină de acum `package.json`.

Pasul 0 a adăugat:
- `tsconfig.json` și scripturile `typecheck`, `check`, `test:e2e`;
- `tests/architecture/`, testul de granițe (verifică și codul din `referinta/`);
- `tests/support/start-test-application.mjs`, în locul pornirilor copiate în 5 fișiere de test.

Tot la pasul 0, Prettier a fost aplicat pe sursele existente. Testul pe CSV-ul real se sare când `Fisiere_Excel/` lipsește.

Cuprins:

1. Rezumat
2. Starea actuală
3. Arhitectura țintă
4. Pattern-uri transversale
5. Module exemplu
6. Plan de migrare
7. Verificarea referinței

---

## 1. Rezumat

| Decizie | Alegere | Motiv |
| --- | --- | --- |
| Stack | Se păstrează: JavaScript ESM `.mjs`, Node 22.17 inclus în pachet, `node:sqlite`, UI vanilla, SheetJS vendorizat, zero dependențe runtime | Aplicația se livrează ca folder copiat la client și rulează offline. Un framework sau un bundler ar adăuga un pas de build la fiecare livrare, fără câștig funcțional. |
| Organizare | Pe feature-uri, în `src/features/*`, plus `src/shared`, `src/core`, `src/app` (composition root) și `src/config` | Azi codul e organizat pe straturi tehnice (`server/`, `shared/`, `web/ui/`), iar fișierele mari amestecă mai multe domenii. |
| Aliasuri | `#app/`, `#config/`, `#core/`, `#shared/`, `#features/`, `#test-support/` | Node rezolvă nativ, fără loader, doar specificatori `#` (`package.json#imports`). Același specificator merge în browser prin import map. Ambele variante au fost verificate (§4.1). |
| Tipuri | JSDoc și fișiere `*.d.mts`, verificate cu `tsc --noEmit`; `typescript` doar ca devDependency | Oferă siguranță de tip fără transpilare. Validarea la runtime rămâne în schema existentă (`normalizeRecord`), aceeași în browser și pe server. |
| Public API | `index.server.mjs` și `index.web.mjs` la rădăcina fiecărui feature | Fără bundler nu există tree-shaking, deci browserul nu trebuie să ajungă la importuri `node:*`. |
| Decuplare | Porturi injectate de `src/app`, evenimente de domeniu, shared kernel | Un feature nu importă niciodată alt feature. |
| Migrare | 13 pași (0–12), fiecare lăsând aplicația livrabilă | Primul feature migrat e `audit-log` (independent), apoi `payment-assignment` (dependent). |

---

## 2. Starea actuală

### 2.1 Stack și convenții în uz

| Aspect | Situație |
| --- | --- |
| Limbaj | JavaScript ESM (`.mjs`), fără TypeScript și fără JSDoc de tip |
| Server | `node:http`, rute într-un singur obiect (`server/routes.mjs`), SQLite prin `node:sqlite` cu WAL și `synchronous=FULL` |
| Persistență | Tabel generic `records(kind, id, payload JSON)`, `meta.revision`, `requests` (idempotență), `audit_changes`, `settings` |
| UI | HTML static (`web/index.html`), module `web/ui/*.mjs`, randare prin concatenare de șiruri și `innerHTML` cu `esc()` |
| State management | Un obiect global mutabil, `session` (`web/ui/session.mjs`), importat prin referință; `render()` complet după fiecare schimbare |
| Validare | `shared/domain.mjs`: `FIELDS` + `normalizeRecord` + `validateState`, rulate în browser și pe server |
| Securitate | CSP `script-src 'self'`, verificare Host/Origin, token de sesiune pe scrieri, listă albă de fișiere statice |
| Teste | `node:test` în `tests/*.test.mjs` (integrare cu server real în directoare temporare), `tests/browser-smoke.mjs` (Chrome headless), `tests/desktop-lifecycle.ps1` |
| Formatare | Prettier (`printWidth` 120, `singleQuote`, `arrowParens: avoid`) |
| Livrare | Folder `Startica/Aplicatie` cu `runtime/node.exe`, pornit prin `Porneste_Startica.vbs` → `startica_desktop.ps1` |

### 2.2 Tree actual

Fișiere urmărite de git; în paranteză, numărul de linii pentru codul sursă.

```
Aplicatie_Startica/
├── .gitattributes  .gitignore  .prettierignore  .prettierrc
├── package.json                         (19)
├── startica_server.mjs                  (106)  pornire server + createApplication
├── startica_desktop.ps1                 (135)  lansator: server ascuns + fereastră Chrome/Edge
├── Porneste_Startica.vbs  Opreste_Startica.vbs  Startica.lnk
├── server/
│   ├── backups.mjs                      (225)
│   ├── children-csv.mjs                 (248)
│   ├── database.mjs                     (59)
│   ├── financial-import.mjs             (106)
│   ├── http.mjs                         (84)
│   ├── migrations.mjs                   (44)
│   ├── routes.mjs                       (269)  toate cele 23 de rute
│   ├── store.mjs                        (108)
│   └── util.mjs                         (16)
├── shared/
│   ├── domain.mjs                       (517)  8 responsabilități (vezi 2.4)
│   ├── excel.mjs                        (266)
│   ├── payment-matching.mjs             (154)
│   ├── review-center.mjs                (93)
│   └── text.mjs                         (7)
├── web/
│   ├── index.html                       (24 de linii foarte lungi, ~21 KB: toate ecranele)
│   ├── app.css                          (2126)
│   ├── app.js                           (289)
│   ├── assets/  (fonts/, startica-icon.svg, startica-logo.svg, startica.ico, SURSE.md)
│   ├── vendor/xlsx.full.min.js
│   └── ui/
│       ├── assign.mjs                   (142)
│       ├── child-picker.mjs             (80)
│       ├── dom.mjs                      (46)
│       ├── editor.mjs                   (358)
│       ├── fees.mjs                     (114)
│       ├── groups-categories.mjs        (186)
│       ├── parts.mjs                    (119)
│       ├── profile-audit.mjs            (96)
│       ├── reports.mjs                  (227)
│       ├── review.mjs                   (46)
│       ├── session.mjs                  (221)
│       ├── transfers.mjs                (264)
│       ├── view-helpers.mjs             (7)
│       └── views.mjs                    (417)
├── tests/
│   ├── application.test.mjs             (317)
│   ├── birthdays.test.mjs               (76)
│   ├── browser-smoke.mjs                (468)
│   ├── children-csv.test.mjs            (180)
│   ├── desktop-lifecycle.ps1            (68)
│   ├── financial-import.test.mjs        (137)
│   ├── fixes.test.mjs                   (494)
│   ├── groups.test.mjs                  (92)
│   └── review-center.test.mjs           (71)
├── scripts/
│   ├── import-v5-history.mjs            (142)
│   └── pachet-client/Creeaza_Scurtatura.vbs
└── docs/
    ├── GHID.md  PLAN_UI_ASTRA.md
    └── superpowers/specs/2026-09-09-grupe-si-navigare-design.md

Ignorate de git, create la rulare: Startica_Date/, Startica_Backup/, Jurnale/, Livrare/
```

### 2.3 Ce respectă deja principiile

| Principiu | Unde |
| --- | --- |
| O singură sursă de validare, pe browser și pe server | `shared/domain.mjs` (`FIELDS`, `normalizeRecord`, `validateState`), servit browserului prin `server/http.mjs:57` |
| Model unic de eroare pe server | `fail(message, status)` (`server/util.mjs:5`), un singur `catch` în `server/routes.mjs:282` |
| Scrieri sigure | `store.commit()` (`server/store.mjs:56`): idempotență prin `requestId`, revizie verificată în tranzacție, backup înainte de operațiile ireversibile |
| Clientul distinge rețeaua de refuzul serverului | `api()` (`web/ui/session.mjs:105`), cu operația „pending” reluată cu același `requestId` |
| Fișiere server cu responsabilitate clară | `backups.mjs`, `http.mjs`, `database.mjs`, `migrations.mjs`, `children-csv.mjs`, `financial-import.mjs` |
| Dependență inversată deja folosită | `setRenderers()` (`web/ui/session.mjs:37`): `session` nu importă `views` |
| Securitate locală solidă | CSP, Host/Origin, token, listă albă statică (`server/http.mjs`) |
| Teste de integrare reale | server pornit pe port 0, cu SQLite în directoare temporare |
| Comentarii de tip DE CE, nu CE | majoritatea fișierelor |
| Zero dependențe runtime | `package.json` |

### 2.4 Ce nu respectă principiile

| Principiu | Situație actuală | Dovadă |
| --- | --- | --- |
| Feature-driven | Organizare pe straturi tehnice; un feature (de ex. „Asociere achitări”) e împrăștiat în `server/routes.mjs`, `shared/payment-matching.mjs`, `web/ui/assign.mjs` și `web/index.html` | tree-ul de mai sus |
| SRP | `shared/domain.mjs` are 517 linii și 8 responsabilități: tipuri, date calendaristice, zile de naștere (`monthCalendar` :19), schema (`FIELDS` :128, `normalizeRecord` :190), completare taxe (`applyChildSetup` :320), `validateState` :341, verificări (`issues` :372), obligații (`obligation` :443), `cashSummary` :510 | `shared/domain.mjs` |
| SRP | `web/ui/views.mjs` (417) combină navigare (`go` :27), stare backup (`renderHealth` :60), liste generice, sortare și selecție în masă (:93–401) și orchestrarea tuturor ecranelor (`render` :417) | `web/ui/views.mjs` |
| SRP | `web/ui/session.mjs` combină state global, client HTTP, indicatorul de salvare (DOM) și orchestrarea încărcării | `web/ui/session.mjs` |
| SRP | `server/routes.mjs`: toate cele 23 de rute, cu reguli de business inline | `server/routes.mjs:31–265` |
| SRP | `web/ui/profile-audit.mjs` amestecă fișa copilului cu Istoricul | `web/ui/profile-audit.mjs:7`, `:74` |
| Layer shared izolat | `shared/` conține domeniul unor feature-uri, nu cod transversal: `payment-matching.mjs` = Asociere, `review-center.mjs` = De verificat, `excel.mjs` = Import/Export | `shared/` |
| Modulele nu se importă între ele | `views.mjs` importă 7 ecrane (fees, assign, review, reports, groups-categories, profile-audit, view-helpers) | `web/ui/views.mjs:16–23` |
| Path aliases | 15 importuri `../../shared/…` în `web/ui`, `../shared/…` în `server/` și `tests/` | `grep "../../shared"` |
| Separare state/UI | Selecțiile din Asociere stau în `<input>` ascunse; timere atașate de butoane | `web/ui/assign.mjs:94,114`, `web/app.js:83`, `web/ui/views.mjs:314` |
| Pattern unic de stări | `render()` apelează 12 ecrane secvențial, iar o excepție într-unul le oprește pe cele de după. Stările goale sunt șiruri ad-hoc în fiecare ecran și nu există stare „se încarcă” per ecran | `web/ui/views.mjs:431–441` |
| Duplicare | `normalizeSearch` e definit de două ori; confirmarea „Sigur?” e implementată de două ori | `web/ui/views.mjs:157` / `web/ui/child-picker.mjs:8`; `web/app.js:79` / `web/ui/views.mjs:310` |
| Testare | Nicio colocare; pornirea serverului de test e copiată în 6 fișiere; fixture-urile sunt inline | `tests/groups.test.mjs:10`, `tests/fixes.test.mjs:68`, `tests/application.test.mjs:141` … |
| Environment | `process.env` citit direct, fără profil și fără validare unică | `startica_server.mjs:68,82` |
| Tipuri | Nicio verificare de tip | — |
| Denumiri | `b` (corpul cererii), `r`, `s`, `o`, `fn`, `$`, `esc`, `handle`, `parts.mjs`, `util.mjs`, `view-helpers.mjs`, `accept()`, `issues()`, `summary()` | `server/routes.mjs`, `web/ui/*` |
| Comentarii scurte | Multe comentarii DE CE au 3–6 linii | `server/store.mjs:50–55`, `server/http.mjs:80–83`, `web/ui/assign.mjs:101–105` |
| Git | Mesaje libere, `Fix:` folosit inconsecvent, trailer `Co-Authored-By` în `457079f` și `1564953` | `git log` |
| Texte învechite | Mesajul de eroare trimite la `Porneste_Startica.cmd`, care nu există; `package.json` are versiunea 1.0.0, iar pachetul livrat e 1.1.x | `web/app.js:308`, `package.json:3` |

---

## 3. Arhitectura țintă

### 3.1 Tree țintă

`★` = implementat în `referinta/`. `→` = de unde vine codul.

```
Aplicatie_Startica/
├── package.json                  # "imports": #app/* #config/* #core/* #shared/* #features/* #test-support/*
├── tsconfig.json                 # checkJs, nodenext, noEmit: doar verificare
├── startica_server.mjs           # rămâne ca shim → #app/server/main.mjs (lansatorul și testele îl apelează)
├── startica_desktop.ps1          # neschimbat (+ STARTICA_PROFILE=production)
├── Porneste_Startica.vbs  Opreste_Startica.vbs
│
├── src/
│   ├── app/                                        # composition root
│   │   ├── server/
│   │   │   ├── main.mjs                            → startica_server.mjs:67–113
│   │   │   ├── create-application.mjs              → startica_server.mjs:18–65 (leagă core + feature-uri)
│   │   │   └── create-application.integration.test.mjs → tests/application.test.mjs (ciclu de viață)
│   │   └── web/
│   │       ├── main.mjs                            → web/app.js (bootstrap)
│   │       ├── compose-features.mjs                # porturi, abonări, legarea ecranelor
│   │       ├── navigation.mjs                      → views.mjs go() + app.js nav mobil
│   │       ├── month-picker.mjs                    → app.js:122–229
│   │       ├── render-cycle.mjs                    → views.mjs render(), cu renderGuarded
│   │       ├── save-indicator.mjs                  → session.mjs renderSaveStatus()
│   │       └── unsaved-changes-guard.mjs           → app.js:264–302
│   │
│   ├── config/
│   │   ├── environment.mjs                         # singurul cititor de process.env
│   │   └── environment.test.mjs
│   │
│   ├── core/                                       # infrastructură fără domeniu
│   │   ├── server/
│   │   │   ├── database/
│   │   │   │   ├── sqlite-connection.mjs           → database.mjs openDatabase()
│   │   │   │   ├── schema.mjs                      → database.mjs SCHEMA + PRAGMAS
│   │   │   │   ├── migration-runner.mjs            → database.mjs runMigrations()
│   │   │   │   └── migrations/001-app-state-to-records.mjs, 002-groups-entity.mjs → migrations.mjs
│   │   │   ├── errors/domain-error.mjs             → util.mjs fail()
│   │   │   ├── http/
│   │   │   │   ├── json-response.mjs               → http.mjs send()
│   │   │   │   ├── request-guards.mjs              → http.mjs guardRequest/guardWrite/readJson
│   │   │   │   ├── static-assets.mjs (+test)       → http.mjs listă albă + import map + hash CSP
│   │   │   │   └── route-dispatcher.mjs (+test)    → routes.mjs handle()
│   │   │   ├── persistence/
│   │   │   │   ├── record-repository.mjs (+test)   → store.mjs readRecord/writeRecord/deleteRecord/readState
│   │   │   │   └── revision-transaction.mjs (+test)→ store.mjs commit(), replace()
│   │   │   ├── session/session-routes.mjs          → routes.mjs /api/session, /api/state, /api/shutdown
│   │   │   └── settings/settings-repository.mjs    → database.mjs createSettings()
│   │   └── web/
│   │       ├── api-client.mjs                      → session.mjs api()
│   │       ├── api-error.mjs                       ★
│   │       ├── app-session-store.mjs (+test)       → session.mjs state, load, mutate, pending
│   │       ├── domain-event-bus.mjs (+test)        ★
│   │       ├── notice-banner.mjs                   → session.mjs message()
│   │       └── view-state.mjs                      ★
│   │
│   ├── shared/                                     # izomorf, folosit de ≥2 feature-uri
│   │   ├── contracts/
│   │   │   ├── record-types.d.mts                  ★ Child, Payment, Expense, Group, RecordByType
│   │   │   ├── persistence.d.mts                   ★ RecordRepository, RunRevisionTransaction
│   │   │   ├── audit-trail.d.mts                   ★ port AuditTrail
│   │   │   ├── domain-events.mjs                   ★ numele evenimentelor
│   │   │   └── domain-event-payloads.d.mts         ★ payload-uri + DomainEventBus
│   │   ├── domain/                                 # shared kernel
│   │   │   ├── calendar-month.mjs (+test)          → domain.mjs today, monthOK, dateOK, shiftDays, daysBetween
│   │   │   ├── money.mjs (+test)                   → domain.mjs cents, total
│   │   │   ├── record-schema.mjs (+test)           → domain.mjs TYPES, FIELDS, normalizeRecord, validateState
│   │   │   ├── record-integrity.mjs (+test)        → routes.mjs: copil/grupă existente, nume unice
│   │   │   ├── records-report.mjs                  → domain.mjs summary, importReport
│   │   │   ├── record-labels.mjs                   → parts.mjs childName, view-helpers.mjs contractOf/groupName
│   │   │   ├── payment-allocations.mjs             → domain.mjs allocations, paymentTenders, paymentIndex
│   │   │   └── tuition-obligation.mjs (+test)      → domain.mjs obligation, dueDayFor, firstUnpaidMonth
│   │   ├── format/
│   │   │   ├── html-escape.mjs                     → dom.mjs esc
│   │   │   ├── money-format.mjs                    → dom.mjs money
│   │   │   ├── date-format.mjs                     → dom.mjs date, time, monthLabel, age
│   │   │   ├── file-size-format.mjs                → dom.mjs fileSize
│   │   │   └── text-search.mjs (+test)             → text.mjs + cele două normalizeSearch
│   │   └── ui/                                     # componente de bază, doar browser
│   │       ├── element-lookup.mjs                  → dom.mjs $
│   │       ├── nav-count-badge.mjs                 → dom.mjs setNavCount
│   │       ├── data-table-sort.mjs                 → parts.mjs sortTable + views.mjs listHead/sortRows
│   │       ├── pagination.mjs                      → parts.mjs pageRows
│   │       ├── bulk-selection.mjs                  → views.mjs bulkSelection/wireBulkSelection
│   │       ├── confirm-twice-button.mjs            → app.js:79–90 + views.mjs:310–319
│   │       ├── record-actions.mjs                  → parts.mjs button, actions
│   │       ├── form-fields.mjs                     → parts.mjs field, select, textarea
│   │       └── child-picker.mjs                    → web/ui/child-picker.mjs
│   │
│   └── features/
│       ├── audit-log/                              ★ independent, §5.1
│       ├── payment-assignment/                     ★ dependent, §5.2
│       ├── backup/
│       │   ├── README.md  index.server.mjs  index.web.mjs  backup.types.d.mts
│       │   ├── domain/backup-retention.mjs (+test) → backups.mjs retentionKeep
│       │   ├── server/backup.service.mjs (+integration test) → backups.mjs createBackups
│       │   ├── server/backup.routes.mjs            # /api/health /api/backups /api/backup /api/backup-preview /api/restore /api/settings
│       │   └── web/backup-settings.{api,controller,view}.mjs, restore-dialog.view.mjs → views.mjs renderHealth, transfers.mjs
│       ├── billing/                                # Situația plăților + De notificat
│       │   ├── README.md  index.web.mjs  billing.types.d.mts
│       │   ├── domain/month-evaluation.mjs (+test) # evaluarea comună pentru Status/Notify/Dashboard
│       │   └── web/payment-status.{controller,view}.mjs, notify-list.{controller,view}.mjs → reports.mjs
│       ├── children/
│       │   ├── README.md  index.server.mjs  index.web.mjs  children.types.d.mts
│       │   ├── domain/birthdays.mjs (+test)        → domain.mjs monthCalendar, upcomingBirthdays
│       │   ├── domain/children-list-filter.mjs (+test) → views.mjs matchesSearch/filtre
│       │   ├── server/children-csv-import.mjs (+test) → server/children-csv.mjs
│       │   ├── server/children.routes.mjs          # /api/children-csv-preview /api/children-csv
│       │   └── web/children-list.view.mjs, child-editor-fields.mjs, child-profile.view.mjs, children-csv-dialog.mjs
│       ├── dashboard/
│       │   ├── domain/cash-summary.mjs (+test)     → domain.mjs cashSummary
│       │   └── web/dashboard.controller.mjs, revenue-bars.view.mjs, attention-panel.view.mjs, birthdays-panel.view.mjs
│       ├── data-transfer/                          # Import/Export Excel, import istoric V5
│       │   ├── domain/excel-workbook.mjs (+test)   → shared/excel.mjs
│       │   ├── server/financial-history-import.mjs (+test) → server/financial-import.mjs
│       │   ├── server/data-transfer.routes.mjs     # /api/import-preview /api/import /api/financial-preview /api/financial-import
│       │   └── web/excel-import.controller.mjs, excel-export.mjs, import-dialog.view.mjs → transfers.mjs
│       ├── expenses/
│       │   ├── server/expense-categories.routes.mjs# /api/category-delete
│       │   └── web/expenses-list.view.mjs, expense-categories.{controller,view}.mjs, expense-editor-fields.mjs
│       ├── fee-setup/                              # Taxe și grupe
│       │   ├── domain/child-fee-setup.mjs (+test)  → domain.mjs applyChildSetup
│       │   ├── server/fee-setup.routes.mjs         # /api/children-setup
│       │   └── web/fee-setup.{api,controller,view}.mjs → fees.mjs
│       ├── groups/
│       │   ├── server/groups.routes.mjs (+integration test) # /api/group-delete ← tests/groups.test.mjs
│       │   └── web/groups.{controller,view}.mjs    → groups-categories.mjs
│       ├── payments/
│       │   └── web/payments-list.view.mjs, payment-editor-fields.mjs, allocation-rows.mjs → views.mjs, editor.mjs
│       ├── record-editing/                         # editorul generic și arhivarea
│       │   ├── server/record-editing.routes.mjs    # /api/record /api/record-delete, cu record-integrity din shared
│       │   └── web/record-editor-dialog.mjs, record-archive.controller.mjs → editor.mjs
│       └── review-center/                          # De verificat
│           ├── domain/record-issues.mjs (+test)    → domain.mjs issues
│           ├── domain/review-center.mjs (+test)    → shared/review-center.mjs
│           └── web/review-center.{controller,view}.mjs → review.mjs
│
├── web/                                            # doar resurse statice
│   ├── index.html                                  # + <script type="importmap">, intrare /src/app/web/main.mjs
│   ├── styles/base.css, layout.css, components.css, features/*.css → app.css (pasul 11)
│   ├── assets/                                     # neschimbat
│   └── vendor/xlsx.full.min.js                     # neschimbat
│
├── tests/
│   ├── architecture/import-boundaries.test.mjs     # impune regulile din §3.3
│   ├── e2e/browser-smoke.e2e.mjs                   → tests/browser-smoke.mjs
│   ├── e2e/desktop-lifecycle.ps1                   → tests/desktop-lifecycle.ps1
│   └── support/
│       ├── start-test-application.mjs              # înlocuiește cele 6 copii
│       ├── in-memory-record-repository.mjs         ★
│       ├── recording-audit-trail.mjs               ★
│       └── immediate-revision-transaction.mjs      ★
│
├── scripts/import-v5-history.mjs, pachet-client/
└── docs/
```

Un feature are, de regulă: `README.md`, `<feature>.types.d.mts`, `index.server.mjs` și/sau `index.web.mjs`, apoi `domain/`, `server/`, `web/` și `test-support/`, doar cele necesare.

### 3.2 Rolul folderelor principale

| Folder | Rol | Poate importa |
| --- | --- | --- |
| `src/app/` | Composition root. Creează infrastructura, instanțiază feature-urile, injectează porturile, leagă rutele, ecranele și abonările. Nu conține reguli de business. | orice |
| `src/config/` | Citește și validează mediul o singură dată și expune un obiect înghețat | nimic intern |
| `src/core/server/` | SQLite, migrări, HTTP (gărzi, dispatcher, fișiere statice), tranzacția cu revizie, sesiune | `#shared/`, `#config/` |
| `src/core/web/` | Client API, store-ul sesiunii, event bus, modelul de stare a ecranelor, bannerul de mesaje | `#shared/` |
| `src/shared/contracts/` | Tipuri și nume de evenimente comune; porturile dintre feature-uri | `#shared/contracts/` |
| `src/shared/domain/` | Shared kernel: reguli pure folosite de cel puțin două feature-uri (schema înregistrărilor, obligația lunară, bani, date calendaristice) | `#shared/` |
| `src/shared/format/` | Formatare pură (bani, date, escape HTML, căutare fără diacritice) | `#shared/` |
| `src/shared/ui/` | Componente UI fără domeniu (sortare, paginare, selecție, child picker) | `#shared/` |
| `src/features/<x>/domain/` | Regulile feature-ului, pure și testabile fără I/O | `#shared/`, fișierele feature-ului |
| `src/features/<x>/server/` | Repository, service (validare + tranzacție) și rute | `#core/server/`, `#shared/`, feature-ul |
| `src/features/<x>/web/` | `*.api` (HTTP), `*.controller` (stare + orchestrare), `*.view` (DOM) | `#core/web/`, `#shared/`, feature-ul |
| `src/features/<x>/test-support/` | Fixture-urile feature-ului | contracte |
| `web/` | Resurse statice: HTML, CSS, fonturi, vendor | — |
| `tests/architecture/` | Testul granițelor de import | — |
| `tests/e2e/` | Chrome headless și ciclul de viață al lansatorului | — |
| `tests/support/` | Fake-uri reutilizabile și pornirea serverului de test | contracte, `#core/` |

### 3.3 Reguli de dependență

```
            ┌───────────────┐
            │    src/app    │  composition root
            └───────┬───────┘
          importă   │   importă
        ┌───────────┴───────────┐
        ▼                       ▼
┌───────────────┐       ┌───────────────┐
│ src/features/*│ ────► │   src/core    │
│ (nu între ele)│       └───────┬───────┘
└───────┬───────┘               │
        └──────────► src/shared ◄┘      src/config ◄── app, core
```

1. Un feature nu importă alt feature. Dependențele dintre ele trec prin:
   - **porturi** declarate în contracte și injectate de `app/`;
   - **evenimente** (`#shared/contracts/domain-events.mjs`);
   - reguli mutate în **shared kernel**.
2. `server/` nu e importat din `web/` și invers. `shared/` e izomorf (fără `node:*`, fără DOM), cu excepția `shared/ui/`, care e doar pentru browser.
3. `shared/` nu importă `core/`, `features/` sau `app/`. `core/` nu importă `features/` sau `app/`.
4. Importurile relative sunt permise doar în același feature, cu cel mult un `../`.
5. Din afara unui feature se importă doar `index.server.mjs` sau `index.web.mjs`, și numai din `app/`.

Regulile sunt verificate automat de `tests/architecture/import-boundaries.test.mjs`. Testul parsează specificatorii din `src/**/*.mjs` și rulează în `npm test`. Până la pasul 12 îl ignoră doar pe cele marcate ca fațade.

---

## 4. Pattern-uri transversale

### 4.1 Aliasuri

`package.json` (Node, fără loader):

```json
"imports": {
  "#app/*": "./src/app/*",
  "#config/*": "./src/config/*",
  "#core/*": "./src/core/*",
  "#shared/*": "./src/shared/*",
  "#features/*": "./src/features/*",
  "#test-support/*": "./tests/support/*"
}
```

`web/index.html` (browser):

```html
<script type="importmap">{"imports":{"#app/":"/src/app/","#core/":"/src/core/","#shared/":"/src/shared/","#features/":"/src/features/"}}</script>
<script type="module" src="/src/app/web/main.mjs"></script>
```

- **CSP.** Import map-ul e un script inline. La pornire, serverul calculează `sha256` din conținutul lui și îl adaugă în `script-src`. Verificat în Chrome: fără hash, importul eșuează cu `Failed to resolve module specifier "#features/…"`; cu hash, modulul se încarcă.
- **Lista albă.** Regex-ul actual `^/(ui|shared)/[a-z0-9-]+\.mjs$` devine o listă de prefixe permise:
  - `/src/app/web/`, `/src/core/web/`, `/src/shared/`;
  - `/src/features/<feature>/{domain,web}/`, plus `/src/features/<feature>/index.web.mjs`;
  - segmentele se potrivesc cu `[a-z0-9-]+`, fișierele cu `[a-z0-9-]+(\.[a-z0-9-]+)*\.mjs`.
  
  Sunt refuzate: `server/`, `test-support/`, `*.test.mjs` și orice `..` sau `%2e`. Toate cazurile au teste în `static-assets.test.mjs`.
- `#config/`, `#test-support/` și `#app/server/` nu apar în import map.

### 4.2 Tipuri și validare

`tsconfig.json`, verificat în harness cu `tsc` 5.9.3:

```json
{
  "compilerOptions": {
    "allowJs": true, "checkJs": true, "noEmit": true,
    "module": "nodenext", "moduleResolution": "nodenext",
    "target": "es2023", "lib": ["es2024", "dom"], "types": ["node"],
    "strict": true, "noImplicitAny": false
  },
  "include": ["src/**/*.mjs", "src/**/*.d.mts", "tests/**/*.mjs"]
}
```

- Tipurile se declară în `*.d.mts` și se importă **cu extensia `.mjs`**: `/** @typedef {import('../audit-log.types.mjs').AuditEntry} AuditEntry */`. Fără extensie, `nodenext` nu rezolvă importul (eroare `TS2307`/`TS2834`, observată în harness).
- `fail()` e o declarație `function` cu `@returns {never}`, ca `tsc` să restrângă tipul după `if (!payment) fail(…)`.
- `RecordRepository.find(type, id)` e tipizat prin `RecordByType`: `find('payments', id)` întoarce `Payment | undefined`.
- `noImplicitAny` rămâne oprit la început. Se activează per folder după migrare.
- Validarea runtime rămâne în `#shared/domain/record-schema.mjs`. Tipurile nu înlocuiesc verificarea datelor venite din HTTP sau din fișiere.

### 4.3 Erori și stări

| Situație | Server | Client |
| --- | --- | --- |
| Input invalid | `fail(msg)` → 400 | `ApiError{kind:'rejected', status:400}` → `failure`, fără reluare |
| Gardă (Host, Origin, token) | 403 | la 403, tokenul se reîmprospătează (`app-session-store`) |
| Revizie veche sau înregistrare schimbată | `fail(msg, 409)` în tranzacție | mesaj „Reîncarcă datele”, pending anulat |
| Server inaccesibil sau timeout | — | `ApiError{kind:'network'}` → pending păstrat, `retryable: true`, indicator „Conexiune întreruptă” |
| Răspuns care nu e JSON | — | `ApiError{kind:'unexpected-response'}` |
| Ecran care se încarcă, e gol sau a eșuat | — | controllerul expune `ViewStatus` și `failure`; view-ul randează fiecare stare explicit |
| Excepție la randarea unui ecran | — | `renderGuarded(screen, render, report)`: celelalte ecrane se randează, iar eroarea ajunge în banner |
| Abonat al event bus-ului care eșuează | — | `onListenerError` → banner; ceilalți abonați primesc evenimentul |
| Răspuns întârziat după redeschiderea ecranului | — | ignorat prin identificatorul deschiderii (vezi `audit-log.controller.mjs`) |

Implementări: `referinta/src/core/web/api-error.mjs`, `view-state.mjs`, `domain-event-bus.mjs`.

### 4.4 Testare

| Tip | Loc și nume | Dependențe |
| --- | --- | --- |
| Unitar | `x.test.mjs` lângă `x.mjs` | fake-uri injectate, fără I/O |
| Integrare | `x.integration.test.mjs` lângă modul | SQLite `:memory:` sau server real pe port 0 (`#test-support/start-test-application.mjs`) |
| Arhitectură | `tests/architecture/*.test.mjs` | sistemul de fișiere |
| E2E | `tests/e2e/*.e2e.mjs`, `*.ps1` | Chrome/Edge, lansator |

- Scripturi după pasul 0:
  - `npm test` = `node --test "src/**/*.test.mjs" "tests/architecture/*.test.mjs"` (glob verificat în Node 22.17);
  - `npm run test:e2e`;
  - `npm run typecheck` = `tsc -p .`;
  - `npm run check` = `format:check` + `typecheck` + `test`.
- Fără mock de module. Dependențele vin ca parametri, iar fake-urile au nume explicite (`createInMemoryRecordRepository`, `createRecordingAuditTrail`, `createImmediateRevisionTransaction`).
- Fixture-urile sunt funcții care întorc date noi la fiecare apel (`createAssignmentRecords()`), ca testele să nu se influențeze între ele.
- Pentru cereri controlate în timp: `Promise.withResolvers()`.
- Fiecare garanție se testează în stratul care o oferă. Tranzacția falsă din feature-uri nu are rollback și nici idempotență, pentru că acelea se testează în `core/server/persistence/revision-transaction.test.mjs`.

### 4.5 Environment

Profiluri: `development` (`npm start`), `test` (testele automate) și `production` (lansatorul din pachet). **Nu există staging**: aplicația e offline și rulează la un singur client. Echivalentul verificării de dinainte de livrare este pachetul pornit dintr-o altă cale, cu scurtătură și ciclu complet pornire–închidere–backup.

```js
// src/config/environment.mjs (pasul 2)
const PROFILE_DEFAULTS = Object.freeze({
  development: { port: 8765, openBrowser: true, autoBackupIntervalMs: 300000 },
  test: { port: 0, openBrowser: false, autoBackupIntervalMs: 0 },
  production: { port: 8765, openBrowser: false, autoBackupIntervalMs: 300000 },
});

/** @typedef {keyof typeof PROFILE_DEFAULTS} EnvironmentProfile */
/** @typedef {{ profile: EnvironmentProfile, port: number, openBrowser: boolean, autoBackupIntervalMs: number }} StarticaEnvironment */

/**
 * @param {Record<string, string | undefined>} [variables]
 * @returns {Readonly<StarticaEnvironment>}
 */
export function loadEnvironment(variables = process.env) {
  const profile = variables.STARTICA_PROFILE ?? 'development';
  if (!Object.hasOwn(PROFILE_DEFAULTS, profile)) throw new Error(`STARTICA_PROFILE necunoscut: ${profile}`);
  const defaults = PROFILE_DEFAULTS[/** @type {EnvironmentProfile} */ (profile)];
  const port = variables.STARTICA_PORT === undefined ? defaults.port : Number(variables.STARTICA_PORT);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`STARTICA_PORT invalid: ${variables.STARTICA_PORT}`);
  return Object.freeze({
    profile: /** @type {EnvironmentProfile} */ (profile),
    port,
    openBrowser: variables.STARTICA_NO_BROWSER === '1' ? false : defaults.openBrowser,
    autoBackupIntervalMs: defaults.autoBackupIntervalMs,
  });
}
```

Căile `Startica_Date`, `Startica_Backup` și `Jurnale` rămân relative la folderul aplicației, cum le așteaptă lansatorul și clientul. Testele le primesc ca opțiuni.

### 4.6 Stil de cod

| Azi | Țintă |
| --- | --- |
| `write['/api/payments-assign'] = b => …` | `paymentAssignmentService.assignPaymentsToChildren(request)` |
| `r`, `s`, `o`, `b`, `fn` | `payment`, `records`, `evaluation`, `request`, `applyChanges` |
| `store.commit(body, action, fn, true)` | `runRevisionTransaction(request, { action, backupBefore: true }, applyChanges)` |
| `store.audit(action, type, id, before, after)` | `auditTrail.recordChange({ action, recordType, recordId, before, after })` |
| `unassignedPayments`, `assignmentRisk` | `listUnassignedPayments`, `measureAssignmentRisk` |
| `parts.mjs`, `views.mjs`, `util.mjs`, `view-helpers.mjs` | `<subiect>.<rol>.mjs` (`record-actions.mjs`, `payment-assignment.controller.mjs`) |
| `/api/audit?offset=` | `/api/audit?beforeEntryId=` |

- Comentariile explică doar un DE CE neevident, în 1–2 linii, în română. Cele existente, lungi dar corecte, se scurtează când fișierul e mutat, nu într-un pas separat.
- Public API: doar `index.server.mjs` și `index.web.mjs` la rădăcina feature-ului. Fără `index` în subfoldere și fără `export *` în lanț.
- Fișierele de tipuri se numesc `<feature>.types.d.mts`. Contractele comune stau în `#shared/contracts/`.

### 4.7 Git

- Format: `type(scope): subject`, la imperativ, scurt, în engleză.
- Tipuri: `feat`, `fix`, `refactor`, `test`, `docs`, `build`, `chore`, `perf`.
- Scope-uri: `audit-log`, `payment-assignment`, `backup`, `billing`, `children`, `dashboard`, `data-transfer`, `expenses`, `fee-setup`, `groups`, `payments`, `record-editing`, `review-center`, `core`, `shared`, `config`, `app`, `packaging`, `docs`.
- Mesajele nu menționează AI sau agenți și nu au trailer `Co-Authored-By`.
- Un pas din plan înseamnă un commit sau un PR, cu `npm run check` verde.
- Opțional la pasul 0: hook `commit-msg` în `.githooks/`, activat cu `git config core.hooksPath .githooks`, care verifică formatul.

Exemple pentru plan:

```
test(core): add import boundary and shared test application checks
build(core): resolve hash aliases in node and browser
refactor(shared): split domain module into shared kernel files
feat(audit-log): paginate history by entry id
refactor(payment-assignment): move matching and assignment into feature module
```

---

## 5. Module exemplu

### 5.1 `audit-log` (independent)

Codul și documentația sunt în `referinta/src/features/audit-log/` (vezi `README.md` din acel folder).

```
GET /api/audit?beforeEntryId=…
  audit-log.routes ──► audit-log.repository ──► SQLite audit_changes
                               ▲
      alte feature-uri ──(port AuditTrail, injectat de app)──┘

Ecranul Istoric:
  navigation ──► audit-log.controller.openFirstPage()
                   └─► audit-log.api.fetchAuditPage() ──► api-client
                   └─► renderAuditLog(state) ──► audit-log.view
```

| Fișier | Starea în `referinta/` |
| --- | --- |
| `server/audit-log.repository.mjs` | ★ scris, cu 5 teste pe SQLite `:memory:` |
| `web/audit-log.controller.mjs` | ★ scris, cu 6 teste (încărcare, gol, eșec, paginare, cursă de cereri, eșec la continuare) |
| `domain/audit-change-diff.mjs` | scris, cu 3 teste |
| `server/audit-log.routes.mjs`, `web/audit-log.api.mjs`, `web/audit-log.view.mjs`, `index.*.mjs`, `audit-log.types.d.mts` | scrise |

### 5.2 `payment-assignment` (dependent)

Codul și documentația sunt în `referinta/src/features/payment-assignment/` (vezi `README.md` din acel folder).

```
                       ┌────────────────────── src/app ──────────────────────┐
                       │ injectează: recordRepository, auditTrail (audit-log),│
                       │ runRevisionTransaction, readRecords, readSelectedMonth│
                       │ leagă: findUnassignedPaymentHintsByChild → billing   │
                       └──────────────┬──────────────────────────┬───────────┘
                                      ▼                          ▼
POST /api/payments-assign ─► payment-assignment.service   payment-assignment.controller
                              │ parseAssignments (400)       │ coadă (doar ecran vizibil)
                              │ runRevisionTransaction ─┐    │ selecții, completare unică
                              │   find/exists/save      │    │ saveSelections ─► api ─► mutate
                              │   auditTrail.record…    │    │
                              ▼                         │    ├─ publică payments.assigned ──► billing, dashboard
                     #shared/domain/record-schema       │    └─ ascultă records.reloaded, selected-month.changed
                                                        ▼
                                          #core/server/persistence/revision-transaction
                                          (idempotență, revizie, backup înainte)
```

Legare în composition root (fragmente; numele din `core` și `app` sunt cele din tree-ul țintă):

```js
// src/app/server/create-application.mjs
const recordRepository = createRecordRepository(database);
const auditLogRepository = createAuditLogRepository(database);
const runRevisionTransaction = createRevisionTransaction({ database, recordRepository, backups });
const paymentAssignmentService = createPaymentAssignmentService({
  recordRepository,
  auditTrail: auditLogRepository,
  runRevisionTransaction,
});
const dispatchRequest = createRouteDispatcher({
  guards,
  routes: [
    ...createSessionRoutes({ sessionToken, recordRepository, shutdown }),
    ...createAuditLogRoutes({ auditLogRepository }),
    ...createPaymentAssignmentRoutes({ paymentAssignmentService }),
  ],
});
```

```js
// src/app/web/compose-features.mjs
const eventBus = createDomainEventBus({
  eventNames: DOMAIN_EVENT_NAMES,
  onListenerError: error => noticeBanner.showError(describeFailure(error).message),
});
const sessionStore = createAppSessionStore({ apiClient, eventBus });

const paymentAssignment = createPaymentAssignmentController({
  readRecords: sessionStore.readRecords,
  readSelectedMonth: monthPicker.readSelectedMonth,
  readToday: today,
  submitAssignments: createPaymentAssignmentApi({ submitMutation: sessionStore.mutate }).submitAssignments,
  eventBus,
  renderAssignmentScreen: createPaymentAssignmentView({ root: byId('assign') }),
  renderUnassignedCount: count => setNavCount('assignCount', count),
});
navigation.registerScreen('assign', paymentAssignment);

const notifyList = createNotifyListController({
  readRecords: sessionStore.readRecords,
  readSelectedMonth: monthPicker.readSelectedMonth,
  findUnassignedPaymentHints: findUnassignedPaymentHintsByChild,
  eventBus,
  renderNotifyList: createNotifyListView({ root: byId('notify') }),
});
```

| Fișier | Starea în `referinta/` |
| --- | --- |
| `server/payment-assignment.service.mjs` | ★ scris, cu 5 teste (scriere și istoric, validare înainte de tranzacție, dubluri, deja asociată, ștearsă sau copil inexistent) |
| `web/payment-assignment.controller.mjs` | ★ scris, cu 10 teste (coadă și risc, completare unică, alegere manuală păstrată, salvare cu eveniment, fără selecții, dublu click, eșec de rețea, ecran inactiv, reîncărcare, dispose) |
| `server/payment-assignment.routes.mjs`, `web/payment-assignment.api.mjs`, `index.*.mjs`, `payment-assignment.types.d.mts`, `test-support/assignment-fixtures.mjs` | scrise |
| `domain/*.mjs` | se mută la pasul 7 din `shared/payment-matching.mjs`, fără schimbări de logică (în harness au fost re-exportate din fișierul actual) |
| `web/payment-assignment.view.mjs` | se portează la pasul 7 din `web/ui/assign.mjs` |

---

## 6. Plan de migrare

Reguli pentru fiecare pas:

- Aplicația rămâne livrabilă la finalul pasului.
- `npm test` și `npm run test:browser` trec (după pasul 0, `npm run check` și `npm run test:e2e`).
- Contractele HTTP și schema SQLite nu se schimbă. Excepția anunțată este `/api/audit`, la pasul 6.
- Căile vechi rămân ca fațade (`export { … } from '#…'`) până la pasul 12, ca pașii să fie mici.
- După fiecare pas care mută fișiere, pachetul de livrare se reconstruiește și se pornește dintr-o altă cale.

| # | Ce se mută | Ce rămâne neschimbat | Risc | Verificare |
| --- | --- | --- | --- | --- |
| 0 | Plasa de siguranță: `typescript` în devDependencies, `tsconfig.json`, scripturile `typecheck`/`check`/`test:e2e`, `tests/architecture/import-boundaries.test.mjs`, `tests/support/start-test-application.mjs` (înlocuiește cele 6 copii), hook opțional pentru mesajele de commit | Tot codul aplicației | **Mic** | Același număr de teste trecute; `tsc` rulează (inițial pe `src/`, încă gol) |
| 1 | Aliasuri: `package.json#imports`, import map în `index.html`, hash CSP calculat la pornire, listă albă `/src/**` în `http.mjs`, `src/` inclus în pachet | Rutele, UI-ul, datele; modulele încă în locurile vechi | **Mediu**: securitatea servirii (traversare, CSP) | Teste noi pentru lista albă (`..`, `%2e%2e`, `server/`, `.test.mjs`, `test-support/` refuzate); browser smoke; `desktop-lifecycle.ps1`; pachetul pornit din altă cale |
| 2 | `src/config/environment.mjs`; `startica_server.mjs` îl folosește; `startica_desktop.ps1` setează `STARTICA_PROFILE=production` | Porturile și comportamentul lansatorului | **Mic** | `environment.test.mjs`; `desktop-lifecycle.ps1` |
| 3 | Shared kernel: `shared/domain.mjs` se împarte în `src/shared/domain/*`; `dom.mjs` (formatare) ajunge în `src/shared/format/*`; `text.mjs` și cele două `normalizeSearch` devin `text-search.mjs`; `child-picker.mjs` ajunge în `src/shared/ui/`. Căile vechi devin fațade. | Semnăturile funcțiilor | **Mic**: funcții pure, bine acoperite | Toate testele; `tsc` pe `src/shared` |
| 4 | Core server: `util` → `errors`; `http` → `core/server/http` (dispatcher cu listă de rute); `database` + `migrations` → `core/server/database`; `store` → `record-repository` + `revision-transaction`; `createApplication` rămâne în `startica_server.mjs` până când `server/routes.mjs` și `server/backups.mjs` ajung în `src/` (testul de granițe interzice importuri din `src/` spre codul vechi) | Schema, migrările (conținut identic), idempotența, revizia, backupul înainte | **Mediu**: tranzacții și migrări pe baze reale | `application`, `fixes`, `groups`; test de pornire pe o copie a `startica_2026-09-10_livrare.db` într-un director temporar |
| 5 | Core web: `session.mjs` → `api-client`, `api-error`, `app-session-store`, `notice-banner`, `domain-event-bus`, `view-state`; `app.js` → `src/app/web/*`; `session.mjs` și `app.js` devin fațade | Mesajele, indicatorul de salvare, reluarea operației pending, `beforeunload` | **Mediu**: fluxul de salvare neconfirmată | Teste unitare pentru `app-session-store` cu API fals; browser smoke (inclusiv scenariile cu conexiune întreruptă) |
| 6 | **`audit-log`** din `referinta/`; Istoricul iese din `profile-audit.mjs` (fișa copilului rămâne temporar acolo) | Tabelul `audit_changes`; scrierea în istoric din rutele încă nemigrate, prin adaptorul `store.audit → auditTrail.recordChange` | **Mic**. Singura schimbare de contract din plan: `/api/audit?beforeEntryId`, cu client și server în același pachet | Testele din referință; browser smoke pe Istoric (paginare, detalii deschise păstrate) |
| 7 | **`payment-assignment`**: `shared/payment-matching.mjs` → `domain/`; service și controller din referință; view portat din `assign.mjs`; `app` injectează `AuditTrail` și leagă indiciile pentru Notify; `app-session-store` publică `records.reloaded` | `POST /api/payments-assign`; sugestiile și scorurile | **Mediu**: legătura cu „De notificat”, performanța lotului de 200 | Testele din referință; testele mutate din `fixes.test.mjs`; browser smoke pe Asociere și De notificat |
| 8 | Feature-uri cu cuplaj mic: `groups`, `expenses` (categorii), `fee-setup`, `review-center`, `backup` | Rutele lor; retenția backupurilor | **Mic–mediu**: restaurarea | `groups.test`, `review-center.test`, `application.test` (backup, restaurare); browser smoke |
| 9 | Feature-uri centrale: `record-editing` (`editor.mjs`, 358 de linii → dialog generic + câmpuri per feature), `children` (CSV, zile de naștere, fișa copilului), `payments`, `data-transfer` (Excel, import V5) | `/api/record`, `/api/record-delete`, formatul Excel | **Mediu–mare**: cel mai folosit flux (adăugare, editare, arhivare) | `children-csv.test`, `financial-import.test`, `birthdays.test`; browser smoke complet; test manual pe o copie a bazei reale |
| 10 | `billing` și `dashboard`; `render()` global → abonări la evenimente per ecran, fiecare prin `renderGuarded` | Calculul obligațiilor (o singură evaluare per randare), contoarele din navigație | **Mediu**: ordinea randărilor | Browser smoke; capturi înainte și după (`STARTICA_UI_SCREENSHOTS=1`) |
| 11 | `app.css` → `web/styles/*` (bază, layout, componente, feature-uri), servite prin lista albă | `index.html` rămâne un singur fișier (fără build nu există includeri) | **Mic**: regresii vizuale | Capturi înainte și după pe toate ecranele |
| 12 | Curățenie: se șterg fațadele din `server/`, `shared/`, `web/ui/`, `web/app.js`; testul de arhitectură devine strict pe tot repo-ul; se actualizează `scripts/import-v5-history.mjs`, `tests/e2e/*` și pachetul de livrare | — | **Mic**, dacă pașii anteriori sunt verzi | `npm run check`, e2e, pachet pornit din altă cale |

### 6.1 Maparea fișierelor actuale

| Actual | Țintă | Pas |
| --- | --- | --- |
| `startica_server.mjs` | shim → `src/app/server/main.mjs` + `create-application.mjs`, după ce rutele și backupurile sunt în `src/` | 10 |
| `startica_desktop.ps1`, `*.vbs`, `scripts/pachet-client/` | neschimbate (lansatorul primește doar `STARTICA_PROFILE`) | 2 |
| `server/util.mjs` | `core/server/errors/domain-error.mjs`; `hash`, `sqlString`, `stamp`, `discard` → `core/server/persistence` și `features/backup` | 4, 8 |
| `server/http.mjs` | `core/server/http/{json-response,request-guards,static-assets}.mjs` | 1, 4 |
| `server/routes.mjs` | `core/server/http/route-dispatcher.mjs` + `*.routes.mjs` în fiecare feature | 4–10 |
| `server/store.mjs` | `core/server/persistence/{record-repository,revision-transaction}.mjs`; `audit`/`auditPage` → `features/audit-log` | 4, 6 |
| `server/database.mjs`, `server/migrations.mjs` | `core/server/database/*`, `core/server/settings/settings-repository.mjs` | 4 |
| `server/backups.mjs` | `features/backup/{domain/backup-retention,server/backup.service}.mjs` | 8 |
| `server/children-csv.mjs` | `features/children/server/children-csv-import.mjs` | 9 |
| `server/financial-import.mjs` | `features/data-transfer/server/financial-history-import.mjs` | 9 |
| `shared/domain.mjs` | `shared/domain/{calendar-month,money,record-schema,records-report,payment-allocations,tuition-obligation}.mjs`; `monthCalendar`, `upcomingBirthdays` → `features/children/domain/birthdays.mjs`; `applyChildSetup` → `features/fee-setup/domain`; `issues` → `features/review-center/domain/record-issues.mjs`; `cashSummary` → `features/dashboard/domain` | 3, 8–10 |
| `shared/excel.mjs` | `features/data-transfer/domain/excel-workbook.mjs` | 9 |
| `shared/payment-matching.mjs` | `features/payment-assignment/domain/*` | 7 |
| `shared/review-center.mjs` | `features/review-center/domain/review-center.mjs` | 8 |
| `shared/text.mjs` | `shared/format/text-search.mjs` | 3 |
| `web/app.js` | `app/web/{main,navigation,month-picker,unsaved-changes-guard}.mjs`, `shared/ui/confirm-twice-button.mjs` | 5 |
| `web/ui/session.mjs` | `core/web/{api-client,app-session-store,notice-banner}.mjs`, `app/web/save-indicator.mjs` | 5 |
| `web/ui/dom.mjs` | `shared/format/*`, `shared/ui/{element-lookup,nav-count-badge}.mjs` | 3 |
| `web/ui/parts.mjs` | `shared/ui/{data-table-sort,pagination,record-actions,form-fields}.mjs`; `childName` → `shared/domain/record-labels.mjs`; `expenseCategories` → `features/expenses` | 3, 8 |
| `web/ui/view-helpers.mjs` | `selectedMonth` → `app/web/month-picker.mjs`; `contractOf`, `groupName` → `shared/domain/record-labels.mjs` | 3, 5 |
| `web/ui/views.mjs` | `app/web/{navigation,render-cycle}.mjs`, `shared/ui/{bulk-selection,data-table-sort}.mjs`, `features/{children,payments,expenses}/web/*-list.view.mjs`, `features/backup/web` | 5, 8–10 |
| `web/ui/editor.mjs` | `features/record-editing/web/*` + câmpuri în `children`, `payments`, `expenses` | 9 |
| `web/ui/assign.mjs` | `features/payment-assignment/web/*` | 7 |
| `web/ui/fees.mjs` | `features/fee-setup/web/*` | 8 |
| `web/ui/groups-categories.mjs` | `features/groups/web/*`, `features/expenses/web/expense-categories.*` | 8 |
| `web/ui/reports.mjs` | `features/dashboard/web/*`, `features/billing/web/*` | 10 |
| `web/ui/review.mjs` | `features/review-center/web/*` | 8 |
| `web/ui/profile-audit.mjs` | Istoric → `features/audit-log/web/*`; fișa → `features/children/web/child-profile.view.mjs` | 6, 9 |
| `web/ui/transfers.mjs` | `features/data-transfer/web/*`, `features/backup/web/restore-dialog.view.mjs`, `features/children/web/children-csv-dialog.mjs` | 8, 9 |
| `web/ui/child-picker.mjs` | `shared/ui/child-picker.mjs` | 3 |
| `web/index.html` | rămâne; + import map; intrare `/src/app/web/main.mjs` | 1, 5 |
| `web/app.css` | `web/styles/*` | 11 |
| `web/assets/`, `web/vendor/` | neschimbate | — |
| `tests/application.test.mjs` | `app/server/create-application.integration.test.mjs`, `core/server/persistence/*.test.mjs`, `features/backup/server/*.integration.test.mjs` | 4, 8 |
| `tests/fixes.test.mjs` | împărțit pe modulele testate (obligații, potrivire plăți, completare taxe, Excel) | 3–10 |
| `tests/groups.test.mjs` | `features/groups/server/groups.routes.integration.test.mjs` | 8 |
| `tests/children-csv.test.mjs` | `features/children/server/children-csv-import.test.mjs` | 9 |
| `tests/financial-import.test.mjs` | `features/data-transfer/server/financial-history-import.test.mjs` | 9 |
| `tests/review-center.test.mjs` | `features/review-center/domain/review-center.test.mjs` | 8 |
| `tests/birthdays.test.mjs` | `features/children/domain/birthdays.test.mjs` | 9 |
| `tests/browser-smoke.mjs` | `tests/e2e/browser-smoke.e2e.mjs` (importurile dinamice `/ui/*` actualizate) | 5, 12 |
| `tests/desktop-lifecycle.ps1` | `tests/e2e/desktop-lifecycle.ps1` | 12 |
| `scripts/import-v5-history.mjs` | rămâne pe loc; importuri prin aliasuri | 12 |

### 6.2 Ce nu se schimbă

- Stack-ul și lipsa dependențelor runtime; modul de livrare (`Startica/Aplicatie`, `runtime/node.exe`, lansatorul VBS și PowerShell).
- Schema SQLite și conținutul migrărilor; formatul backupurilor și retenția lor.
- Contractele HTTP, cu excepția `/api/audit` (pasul 6).
- Semantica scrierilor: idempotență prin `requestId`, revizie, backup înainte de operațiile ireversibile.
- Gărzile de securitate. CSP-ul primește doar hash-ul import map-ului.
- Textele din interfață, fonturile, logo-ul, vendorul SheetJS.

### 6.3 Riscuri transversale

| Risc | Mitigare |
| --- | --- |
| Baza reală a clientului | Planul nu conține migrări de schemă. Pașii 4, 9 și 12 se verifică pe o copie a bazei livrate, într-un director temporar. |
| Pachetul de livrare | După pașii 1, 4, 5, 7, 9 și 12, zip-ul se reconstruiește și se pornește dintr-o altă cale (scurtătură, pornire, închidere, backup). |
| Căi lungi pe Windows | `src/features/<feature>/web/<nume>.mjs` adaugă ~40 de caractere. Baza și backupurile rămân la aceeași adâncime, deci limita de 260 de caractere pentru SQLite nu e afectată. |
| Lucru în paralel pe feature-uri noi | Din pasul 6, orice feature nou se scrie direct în `src/features/`. |
| Fațade uitate | Testul de arhitectură le listează; pasul 12 le elimină și trece testul în mod strict. |

---

## 7. Verificarea referinței

Verificarea a rulat în scratchpad, pe o copie a `referinta/`, cu aceleași aliasuri `#` și cu stub-uri pentru codul care se mută neschimbat: `fail`, schema SQLite, `normalizeRecord`, funcțiile din `shared/payment-matching.mjs`.

| Verificare | Rezultat (13.09.2026) |
| --- | --- |
| `node --test "src/**/*.test.mjs"` (Node 22.17.0) | 34 teste, 34 trecute, 0 eșuate |
| `tsc -p .` (TypeScript 5.9.3, `tsconfig` din §4.2) | fără erori (exit 0) |
| Prettier (`.prettierrc` din repo) | toate fișierele `.mjs` și `.d.mts` sunt conforme |
| Importul punctelor de intrare publice prin aliasuri | `index.server.mjs` și `index.web.mjs` se încarcă în Node |
| Aliasuri `#` în Chrome, sub CSP | cu hash: modulul se încarcă; fără hash: `Failed to resolve module specifier` |
| Review independent față de `routes.mjs`, `store.mjs`, `assign.mjs`, `profile-audit.mjs` | comportamentul se păstrează. Singura observație: `domain/*.mjs` din `payment-assignment` nu există încă în `referinta/`; se mută la pasul 7 (în harness au fost re-exportate din `shared/payment-matching.mjs`). |
