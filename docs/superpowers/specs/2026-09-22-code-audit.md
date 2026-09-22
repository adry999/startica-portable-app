# Audit Startica — 22 septembrie 2026

Făcut pe branch-ul `feat/notification-preferences` (`6da13f7`, peste `1a91e08` — fix de iconiță taskbar — peste `master` `1f56381` = v1.6.2), din trei unghiuri: arhitect, dezvoltator, tester. Nu repetă auditul din 18 septembrie (`docs/superpowers/specs/2026-09-18-code-audit.md`, remediat integral) — pornește de la el și acoperă ce s-a schimbat de atunci: fix-ul de iconiță și modulul nou de preferințe de notificare (ecran „Notificări”, 26 fișiere, +1013/-87 linii).

Baseline: `npm run check` — 568 teste, 566 trec, 0 eșuate, 2 sărite (CSV real lipsă, Chrome — cunoscut). `npm run test:e2e` verde (smoke browser, 4 scenarii lansator inclusiv sarcina cu ora configurabilă).

## 1. Arhitectură

**Bine:**
- Granițele țin. `notification-settings.routes.mjs` (nou) urmează exact modelul `session.routes.mjs`/`diagnostic.routes.mjs`: rută cross-feature care nu aparține unui singur modul, trăiește în `app/server/`, nu într-un `src/features/` inventat pentru ocazie. La fel, `notification-preferences.controller.mjs` + `-store.mjs` în `app/web/`, lângă `global-actions.mjs`/`month-picker.mjs`. Nicio încălcare a regulilor din `import-boundaries.test.mjs`.
- `#shared/domain/notification-preferences.mjs` e plasat corect: regulă pură, folosită de două feature-uri reale (`telegram-notify` prin compositor, `visits` prin `visit-reminders.mjs`), nu de unul singur „ca să fie gata".
- Sarcina programată citește ora dintr-un fișier separat (`notify-schedule.json`), nu din `telegram.json` — decizie corectă: nu strică semantica „`telegram.json` există = conectat" verificată în altă parte a codului (`isConfigFileStale`, `buildStatus`).

**De discutat — o abatere reală de la convenție:**
`settings.notificationPreferences` e primul rând din tabela `settings` care ține un blob JSON. Toate celelalte 9 chei existente (`externalDir`, `lastLocal`, `schemaVersion`, ...) sunt scalari simpli — un string, o dată ISO, un mesaj. Tabela a fost gândită ca listă de perechi cheie-valoare plate, nu ca depozit de obiecte. Nu e o greșeală (JSON.stringify/parse e ieftin, salvarea rămâne atomică, un singur round-trip), dar e un precedent: următorul set de preferințe complexe va alege probabil aceeași formă, iar tabela `settings` ajunge treptat un ONE-BIG-ROW per feature. Merită o decizie explicită: rămâne așa (acceptabil, 11 câmpuri nu-s multe) sau se stabilește o regulă („sub N câmpuri → chei separate, peste → JSON").

**Neschimbat, semnalat și în auditul trecut, tot valabil:**
`compose-screens.mjs` a crescut la 465 de linii (S1/M1 din auditul din 14 septembrie, încă deschis). Cablarea ecranului Notificări a mai adăugat 33 de linii. Nu e o regresie nouă — e continuarea aceleiași tendințe, fără plan de oprire.

## 2. Dezvoltare / calitate cod

**Bine:**
- Zero cod mort în ce-i nou: toate exporturile din cele 8 fișiere noi sunt consumate (verificat cu grep, nu doar presupus).
- Valorile implicite (`DEFAULT_NOTIFICATION_PREFERENCES`) reproduc exact comportamentul vechi (2 zile înainte pentru zile de naștere, azi+mâine pentru vizite, cadență luni pentru restanțe, 30 min pentru memento — toate identice cu constantele hardcodate șterse). Migrarea e neagresivă: o bază fără rândul `notificationPreferences` se comportă identic cu înainte.
- Validarea (`clampNotificationPreferences`) nu aruncă niciodată — plafonează sau revine la implicit. Corect pentru un formular de setări, unde un fișier stricat sau un input în afara intervalului nu are voie să oprească rezumatul zilnic.
- Regexul orei (`^([01]\d|2[0-3]):([0-5]\d)$`) e duplicat identic în JS și C# (nu se putea altfel, dar merită un comentariu de sincronizare în ambele — momentan doar în C# există nota „server writes here, this parses").

**Inconsecvență mică:**
`parseNotificationPreferences` revine tăcut la implicite pe JSON corupt, fără să scrie nimic în jurnal — spre deosebire de `readJsonFile` din `#core/server/files/json-file.mjs`, care face `console.error` pe exact același caz (fișier corupt). Diferență: aici sursa e coloana `settings.value` din SQLite, nu un fișier — dar rezultatul practic e identic (o valoare stricată dispare fără urmă). Un operator cu preferințe resetate misterios n-are niciun indiciu în `startica.log`.

## 3. Bug găsit și reparat: fereastra de reluare se prăbușea pentru o oră de rezumat târzie

**Reparat pe același branch, imediat după audit.** `lateRunHourFor(digestTime)` (ora, plafonată la 23) a devenit `isDigestRunTooLate(now, digestTime)` (comparație de `Date` completă, fără plafon — `setHours` trece firesc peste miezul nopții). 3 teste noi (00:30 după miezul nopții, ora de rezumat 23:00/20:00/13:00 lângă graniță). `npm run check` verde după reparare (vezi §Stare).

`lateRunHourFor(digestTime)` calculează ora de tăiere ca `digestTime + 10h`, plafonată la 23 — corect pentru 08:00 (implicit) → 18:00, cum era înainte. Dar plafonul de 23 înghite din grație pe măsură ce ora crește:

| Ora rezumatului | Ora de tăiere | Grație reală |
|---|---|---|
| 08:00 (implicit) | 18:00 | 10 h |
| 13:00 | 23:00 | 10 h |
| 14:00 | 23:00 | **9 h** |
| 20:00 | 23:00 | **3 h** |
| 23:00 | 23:00 | **0 h** |

La 23:00 configurat, orice pornire din aceeași zi de la sau după ora 23 e considerată „prea târziu", inclusiv una la 23:05 — practic mecanismul de reluare e mort pentru cine alege o oră de seară. Verificat direct, nu doar dedus:

```
$ node --input-type=module -e "import {lateRunHourFor} from './src/shared/domain/notification-preferences.mjs'; for (const t of ['08:00','13:00','14:00','20:00','23:00']) console.log(t,'->',lateRunHourFor(t))"
08:00 -> 18
13:00 -> 23
14:00 -> 23
20:00 -> 23
23:00 -> 23
```

**Impact real:** mic — rezumatul e gândit ca sumar de dimineață; un operator care alege 20:00+ e un caz marginal. Dar interfața (`<input type="time">`) permite orice oră, fără avertisment, iar bug-ul e tăcut (nu apare nicio eroare, doar rezumate care nu mai pleacă niciodată la ore târzii). Nu era testat: testele mele acoperă 08:00 (implicit) și 20:00→cutoff 23 (dar doar verificând că 19:00 NU e prea târziu, nu că grația s-a micșorat).

**Cauza:** plafonarea la 23 tratează „ora de tăiere" ca pe un ceas de o singură zi calendaristică, dar `+10h` de la o oră târzie trece logic în ziua următoare. Fix corect: calculul trebuie să compare un moment absolut (`digestTime` de azi + 10h, ca `Date`), nu doar `.getHours()` — dacă tăierea cade după miezul nopții, verificarea trebuie să știe că un `now` de la 00:30 e tot „înainte de tăiere", nu „o zi nouă". E o schimbare mică (o funcție, `#shared/domain/notification-preferences.mjs`, plus un test cu ora peste miezul nopții) dar atinge și `runTelegramDigest`, unde `now.getHours() >= lateRunHourFor(...)` ar deveni o comparație de `Date` completă.

**Recomandare:** repar acum, pe același branch, înainte de merge — e cod nou, neexpus încă niciunui utilizator, iar fix-ul e mic și testabil. Alternativ: dacă vrei să limitezi scope-ul livrării curente, las-o cu o notă în README și o repar separat.

## 4. Testare

**Bine:**
- Fiecare funcție de domeniu nouă are teste dedicate: 8 pentru `notification-preferences.mjs`, 5 noi pentru `daily-digest.mjs` (17 total, toate cele 12 vechi trec neschimbate — dovadă că valorile implicite chiar reproduc comportamentul vechi), 3 pentru `countVisitsForDays` cu orizont, 3 pentru `selectDueReminders` cu preferințe.
- Testul de integrare pentru rută (`notification-settings.routes.integration.test.mjs`) verifică round-trip-ul real prin server (GET implicit → POST cu plafonare → GET reflectă salvarea → fișierul `notify-schedule.json` conține exact ce trebuie), nu doar funcțiile izolat.
- Testul din `telegram-digest.integration.test.mjs` dovedește că preferințele salvate în `settings` chiar ajung să influențeze mesajul trimis prin server real + bază SQLite reală — nu un mock al lanțului.
- Scenariul 4 din `desktop-lifecycle.ps1` a prins efectiv o eroare reală în timpul scrierii (C# citea `notify-schedule.json` din locul greșit) — testul și-a făcut treaba, nu a fost doar bifat.

**Lipsă — exact bug-ul de la §3:** nicio combinație de teste (unitare, integrare, e2e) nu acoperă o oră de rezumat după-amiaza târziu/seara. E genul de gaură pe care „am testat implicitul + un exemplu random" o lasă mereu deschisă — limitele intervalului (23:xx, trecerea peste miezul nopții) nu au fost gândite explicit ca set de cazuri.

**De adăugat, independent de bug:**
- Niciun test nu verifică ce se întâmplă dacă `notify-schedule.json` conține o oră cu formă greșită (`"25:99"`, un obiect fără `digestTime`, text nevalid) direct pe partea C# — există echivalentul JS (`clampNotificationPreferences`, testat), dar `ReadDigestTime()` din `Startica.cs` n-are test dedicat (nici nu exista infrastructură de test unitar C# în proiect — `desktop-lifecycle.ps1` e singurul instrument, la nivel de integrare completă, scump de rulat des).

## 5. Rezumat acționabil

**Bun, de păstrat:**
- Separarea domeniu pur / compositor / rută / UI, respectată consecvent și în codul nou.
- Valori implicite care nu schimbă nimic pentru instalările existente.
- Testele de integrare care verifică prin server real, nu prin mock-uri optimiste.

**Nu era bine, reparat în sesiune:**
- Bug-ul de la §3 (colapsul ferestrei de reluare la ore târzii) — reparat, testat.

**Nu e bine, rămâne de reparat:**
- `parseNotificationPreferences` nu jurnalizează pe date corupte, spre deosebire de restul codului cu același rol.

**De îmbunătățit (fără urgență):**
- Un test C# (sau măcar un scenariu suplimentar în `desktop-lifecycle.ps1`) pentru `ReadDigestTime()` cu fișier stricat — la fel de ieftin ca cel adăugat pentru ora validă.
- `compose-screens.mjs` continuă să crească fără un plan de împărțire (S1/M1, vechi, tot deschis).

**De schimbat, decizie de discutat:**
- Convenția pentru `settings`: rânduri scalare vs. blob JSON. `notificationPreferences` e primul precedent al doilea fel — merită o regulă explicită înainte să devină implicit „modul de a face lucrurile" pentru orice set nou de preferințe.

## Stare

Branch `feat/notification-preferences`, neîmpins. Commit-ul de fix pentru iconiță (`1a91e08`) e pe același branch, de la utilizator, în timpul sesiunii — nesigur dacă intenționat aici sau de mutat separat (semnalat separat, nu parte din audit).
