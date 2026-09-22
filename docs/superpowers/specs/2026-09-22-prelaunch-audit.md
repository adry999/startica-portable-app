# Audit pre-lansare — Startica desktop, 22 septembrie 2026

Cerut ca audit complet de senior architect + code reviewer, pe șablonul standard (auth/RBAC, securitate, module, DB, performanță). Șablonul presupune o aplicație web multi-utilizator (login, JWT, cookies, CORS, CSP, rate limiting) — **Startica nu e asta**. E o aplicație desktop cu un singur operator, server HTTP pe `127.0.0.1` pornit de un lansator nativ, fără cont, fără parolă, fără rețea externă expusă. Secțiunile de mai jos traduc fiecare cerință din șablon pe ce chiar există în cod, cu dovezi concrete (fișier + linie), nu presupuneri.

Verificat pe `master` `1f56381` (v1.6.2, deja livrată la client) + branch `feat/notification-preferences` (`95257b1`, împins, neîmbinat). `npm run check`: 571 teste, 569 trec, 0 eșuate, 2 sărite.

---

## [CRITIC] Obligatorii de rezolvat

**Niciunul.** Nu am găsit blocker de securitate sau bug major în trecerea de azi. Motivul: suprafața de atac reală e mult mai mică decât presupune un audit web standard (vezi §Auth mai jos), iar ce există e deja acoperit corect. Singurul lucru cu adevărat critic găsit în sesiunea asta (colapsul ferestrei de reluare a rezumatului Telegram la o oră de seară) a fost deja identificat și reparat azi — vezi `docs/superpowers/specs/2026-09-22-code-audit.md` §3.

## [SECURITATE] — traducerea șablonului pe arhitectura reală

### Auth & RBAC → token de sesiune, nu login

Nu există cont, parolă, JWT sau cookie. La fiecare pornire a serverului se generează un token aleator (`randomUUID()`, `create-application.mjs:87`), ținut doar în memorie. Fiecare scriere (`POST`) trebuie să trimită acest token în antetul `X-Startica-Token`; fără el sau cu unul greșit, cererea e refuzată cu 403 (`request-guards.mjs:26`, `assertAuthorizedWrite`). Tab-ul de browser deschis de lansator primește tokenul o singură dată, la încărcare; o pagină din alt tab/altă origine nu-l are și nu poate scrie nimic.

„RBAC" nu există — un singur operator, fără roluri. Ce joacă rolul de control de acces:
- **Host + Origin allowlist** (`request-guards.mjs:16-19`): orice cerere cu alt `Host` decât `127.0.0.1:<port>` sau alt `Origin` e respinsă cu 403. Blochează DNS rebinding și cereri inițiate din altă filă de browser — echivalentul funcțional al CORS, dar mai strict (nimic nu e permis din altă origine, punct).
- **`allowShutdown`** (`diagnostic.routes.mjs`, `session.routes.mjs`): ruta de oprire/diagnostic există mereu, dar refuză cu 404 dacă flag-ul nu e pornit de lansator — o pagină web oarecare nu poate opri serverul chiar dacă ar ghici URL-ul.
- **Fișiere servite pe listă albă** (`static-assets.mjs:8-33`, `STATIC_FILES`): 28 de căi explicite, verificate azi că există toate pe disc. Fără rezolvare dinamică de cale → fără traversare de directoare posibilă.

**Nu lipsește nimic aici.** Modelul de amenințare real (o aplicație de familie pe un calculator, fără server public) e acoperit corect de ce există.

### CSRF/XSS/rate limiting/CORS/CSP

- **CSRF**: verificarea `Origin` + tokenul de sesiune (nu un cookie trimis automat de browser) elimină clasa asta de atac — un formular de pe alt site nu poate reproduce tokenul.
- **XSS**: `escapeHtml` folosit consecvent (35 de fișiere) pentru orice text venit din date (nume, telefoane, note). Verificat azi cu grep pe fiecare `innerHTML` din `src/features`+`src/shared`+`src/app`: cele 6 fișiere fără import direct de `escapeHtml` sunt toate controller-e care delegă randarea unor funcții `*.view.mjs`/`*-fields.mjs` care AU `escapeHtml` (confirmat pe fiecare). Testul de fum (`tests/browser-smoke.mjs:249,268`) creează un copil real cu numele `Copil <test>` prin formular și verifică: textul apare corect (`/Copil <test>/` pe `textContent`) ȘI nu apare niciun element `<test>` în DOM (`document.querySelector('test') !== null` → `false`) — dovadă că textul e randat ca dată, nu injectat ca markup.
- **CSP**: deja implementat, pe `Content-Security-Policy` calculat per răspuns (`json-response.mjs:2-6`): `default-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`, iar singurul script inline permis (import map-ul) e autorizat prin hash SHA-256 calculat din fișierul chiar servit (`static-assets.mjs:59-64`) — nu poate ieși din sincron cu conținutul lui.
- **Rate limiting**: nu există și nu e nevoie. Nu există parolă de ghicit; tokenul de sesiune e un UUID aleator generat per pornire, verificat exact, peste loopback. Un atacator care poate trimite cereri repetate la `127.0.0.1` de pe același calculator are deja acces local — rate limiting n-ar opri nimic relevant.

### Secrete

Singurul secret real e tokenul botului Telegram. Verificat azi: `buildStatus()` din `telegram.routes.mjs` (rута citită de client) nu întoarce niciodată câmpul `token`, doar `chatName`/`botUsername`/stare — confirmat prin citirea directă a codului rutei. Tokenul stă în `telegram.json`, în afara bazei de date, deliberat exclus din backup-uri (decizie documentată în `telegram-notify/README.md`). Nicio variabilă de mediu cu secrete — `#config/environment.mjs` citește doar profil/port/home, nimic sensibil.

### Injecție SQL

Toate interogările din cod folosesc `database.prepare(...).run/get/all(...)` cu parametri legați (`?`), niciodată concatenare de string cu date de la utilizator. Verificat prin citirea `record-repository.mjs`, `settings-repository.mjs`, `audit-log.repository.mjs` — fără excepție.

## [DATE ȘI PERFORMANȚĂ]

- **Schemă simplă, potrivită volumului real** (`schema.mjs`): `records(kind,id,payload)` cu cheie compusă (kind,id) — deja index natural pentru interogările tipice (filtrare pe tip). `audit_changes` paginează cu `ORDER BY id DESC LIMIT` pe cheia primară INTEGER (rowid SQLite, indexat automat) — verificat azi, eficient chiar și cu istoric mare.
- **`PRAGMA busy_timeout=5000` + `journal_mode=WAL`** — coexistență corectă server + proces Telegram citind concurent.
- Volumul real (o grădiniță: sute de copii, mii de plăți/cheltuieli) e mult sub pragul unde ar conta un index suplimentar. Nu recomand adăugarea uneia „ca să fie" — ar fi over-engineering pentru date care nu vor crește niciodată la acea scară.
- **Fișiere statice**: verificat azi programatic — toate cele 28 de rute din `STATIC_FILES` corespund unor fișiere reale pe disc, nimic „mort".
- **„Build checks"**: nu există build (convenție deliberată, Node vanilla ESM). Echivalentul e `npm run check` (format+typecheck+571 teste) + `npm run test:e2e` (smoke în browser real, 14 ecrane navigate, verificare explicită „fără erori noi în consolă" la fiecare — `browser-smoke.mjs:908-923`). Ambele verzi azi.

## [MODULE ȘI LOGICĂ DE BUSINESS]

Nu am găsit bug nou în afara celui deja documentat și reparat azi (fereastra de reluare Telegram). Pentru restul: cele două audituri anterioare (`docs/superpowers/specs/2026-09-18-code-audit.md`, `2026-09-22-code-audit.md`) au acoperit deja, cu tabele detaliate, corectitudinea pe modulele principale (copii, plăți, cheltuieli, grupe, taxe, vizite, backup, Telegram) — toate defectele găsite atunci au fost remediate și verificate. N-am mai găsit nimic nou azi în afara scanărilor de mai sus, care au fost specifice acestei cereri (securitate + naturalețe).

## [STIL & HUMAN TOUCH]

Scanare azi, pe eșantion din module neatinse de auditurile anterioare (copii, plăți, cheltuieli, grupe):
- **Zero** nume generice de tip `dataManager`/`processHandler`/`helperUtil` în tot codul (grep pe întregul `src/`).
- **Zero** comentarii robotice de tipul „// Sets the state" / „// Returns the value" (grep pe pattern-uri tipice de comentarii generate).
- Densitate de comentarii mică și consecventă: 0-4 comentarii pe fișiere de 40-170 linii, toate explică un DE CE neevident (regulă de business, caz limită), nu POVESTESC codul.

Concluzia celor două audituri anterioare rămâne validă și confirmată azi cu eșantion nou: codul nu are amprentă vizibilă de generare automată. AI-score estimat pe ansamblu: ~2/10 (scală din auditul din 18 septembrie), neschimbat.

## [CHECKLIST RAPID] — sanity check final

- [x] `npm run check` verde (571 teste, 0 eșuate)
- [x] `npm run test:e2e` verde (smoke browser 14 ecrane, fără erori consolă noi; 4 scenarii lansator)
- [x] Toate fișierele din `STATIC_FILES` există pe disc
- [x] Tokenul Telegram nu ajunge niciodată la client (verificat în `buildStatus()`)
- [x] `escapeHtml` acoperă toate punctele de randare cu date de utilizator (verificat pe fiecare `innerHTML`)
- [x] CSP activ, fără `unsafe-inline` pe scripturi (doar hash pentru import map)
- [x] Interogări SQL parametrizate peste tot, fără concatenare
- [ ] **Manual, înainte de livrare (nu s-a făcut azi)**: instalare de probă a versiunii finale peste instalarea reală, cu Startica pornită (deja parte din `GHID-LIVRARE.md`, făcut la fiecare livrare — nu specific acestui audit)
- [ ] **Manual**: verificare vizuală în browser a ecranului „Notificări" nou (nu doar prin smoke automatizat) — nu s-a cerut, dar recomand înainte de livrarea versiunii care-l conține

## Notă

Auditul ăsta nu repetă structura/naming/duplicare — sunt deja acoperite exhaustiv (cu tabele, câte un rând per problemă) în cele două audituri din același dosar. L-am scris separat, ca răspuns direct la cerința de azi (securitate + „arată scris de om"), ca să nu amestec un document nou cu concluzii deja scrise și verificate.
