# Coada de lucru pentru Claude Code

Se lucrează pe rând, în ordinea de mai jos. După fiecare punct:
- rulează `npm run check`;
- bifează criteriile de acceptare din spec;
- fă commit cu mesajul `ui(<ecran>): aliniat la docs/design/screens/<NN>`;
- treci la punctul următor fără să aștepți confirmare.

Te oprești doar dacă:
- un spec contrazice codul existent într-un mod pe care nu-l poți rezolva singur;
- ai nevoie de o decizie de business;
- `npm run check` rămâne roșu după 2 încercări.

În aceste cazuri, scrie întrebarea în `docs/design/INTREBARI.md` și treci la următorul punct care nu depinde de ea.

## Coada
1. **Antet compact:** `00-comun.md` A (Topbar 60px, titlu + eyebrow pe un rând, butoane mai mici). Verifică toate ecranele.
2. **Dashboard:** `08-dashboard.md` (KPI fără zecimale, „Necesită atenție” cu 0 gri, „Vezi calendarul →”).
3. **Fișa copilului:** `09-copii-fisa.md` (header în culoarea grupei, „+ Plată” precompletat, plătitori reținuți).
4. **De notificat:** `10-de-notificat.md`.
5. **De rezolvat:** `11-de-rezolvat.md` (Taxe și grupe, De verificat cu tasta S, Asociere achitări cu „Ține minte plătitorul”).
6. **Formulare și stări:** `13-formulare.md` (Drawer comun, ConfirmDeleteDialog „Scrie ȘTERGE” în locul `window.confirm`, liste goale, cardul de salvare).
7. **Administrare:** `12-administrare.md` (Istoric, Notificări, Backup și setări cu filele Import și export + Grădinița; Import CSV doar aici).
8. **Tipărire:** `15-tiparire.md` (confirmare de plată A5, situația A4; ruta confirmării înainte de `/achitari/:paymentId`).
9. **Curățenie R5–R7 din roadmap:** `Button` și `SearchInput` comune, comentarii și nume.
10. **Faza 4, moneda EUR/BNM:** scrie întâi planul după `16-planuri-eur.md` în `docs/superpowers/plans/`, apoi implementează.
11. **Faza 5, SMS:** scrie întâi spec-ul (sms.md, după `14-sms.md` și README „Notificare SMS”), apoi planul, apoi codul.

12. **Faza 6, două filiale:** scrie întâi planul tehnic după `17-filiale.md` (date separate pe filială, selector în Sidebar). 
13. **Faza 16b, sincronizare:** după 12, scrie spec-ul tehnic și planul după `18-sincronizare.md` (server de reconciliere, local-first, conflicte), apoi implementează.

## Stadiu — coada fină din RASPUNSURI.md „Coada, continuare”

- **8 (EUR/BNM UI):** DONE 2026-09-27 — fila Curs valutar (12a), selector în `PaymentFormDrawer` (12b), monedă în Taxe și grupe (12g) + Copil nou (3a), € pe fișa copilului (12d), pastilă curs pe Dashboard (12f). Commit-uri `fc25d06`, `5f94422`. Rămân **12c** (Situația plăților €, în punctul 10) și **12e** (Confirmarea de plată €, în punctul 15) — se fac odată cu ecranele lor, nu separat.
- **9b (SMS P1):** DONE 2026-09-27 — toate cele 21 de taskuri din plan implementate (shared domain, storage, client sms.md, orchestrare trimitere, rute, webapp: hooks + dialog + Notificări + De notificat). `npm run check` + `webapp` typecheck/test + `npm run test:e2e` verde. P3 (jurnalul „Mesaje SMS”, „Retrimite”) și P2 (dialogul din Situația plăților) rămân neimplementate, cum era planificat.
- **10 (Situația plăților completă):** DONE 2026-09-27 — toate cele 10 taskuri din plan implementate (obligation().currency, evaluare an școlar, cardurile lunii, harta 12 luni, antet compact Lună/An școlar). `npm run check` + webapp typecheck/test verde. „Notifică”/„Notifică toți” rămân vizibile, dezactivate — SMS P2, plan separat.
- **11 (curățenie):** DONE 2026-09-27 — R6 (ștergerile folosesc „Scrie ȘTERGE”; confirmarea de plată duplicată rămâne `window.confirm`, nu e ștergere), R7 (nume generice eliminate), R10 (ChildrenPage/ExpensesPage împărțite), `Button`/`SearchInput` comune (20 + 4 fișiere). **R9 (rute per feature) NEFĂCUT** — schimbare de arhitectură, nu mecanică; de decis separat.
- **12 (Încărcare):** DONE 2026-09-27 — StartupScreen, Skeleton/LoadingState peste tot, ecranul de 15 s (fără „Lucrez fără legătură”, vezi INTREBARI.md).
- **13 (Prezența):** DONE 2026-09-27 — plan `docs/superpowers/plans/2026-09-27-prezenta.md`; tabel `attendance` separat, vederi Zi/Lună, secțiunea din fișă; nu atinge taxele.
- **14 (Raport contabil):** DONE 2026-09-27 — `/raport`, export Excel/PDF; fără selector de filială (INTREBARI.md).
- **15 (Confirmarea de plată):** DONE 2026-09-27 — fila Grădinița (16a), A5 și A4 1/3+2/3 (16b, 16g), numerotare, sumă în litere, Situația tipărită (16c; fără „Pagina N din M”, Chrome nu știe numărul total de pagini).
- **Extra (cerut 2026-09-27):** istoricul cursului BNM se completează retroactiv la pornire; iconiță ↗ spre pagina BNM a zilei lângă fiecare curs afișat.
- **FEEDBACK 27.09 (Prezența, Raport contabil):** DONE 2026-09-27.
- **Design system:** DONE 2026-09-27 — `/design-system` (doar dev) + build static pentru Vercel (`npm run build:design-system`, rădăcina `webapp`); nepublicat încă.
- **Faza 6 — filialele:** DONE 2026-09-27 — plan `docs/superpowers/plans/2026-09-27-filiale.md`; câte o bază + folder de backup pe filială, registru `filiale.json`, instalarea existentă = filiala 1 (fără mutări), selector în meniu, dialog pentru formular nesalvat, fila Filiale, „Ambele” în exportul Raportului contabil, Telegram pe filiale.
- **După 12–15:** Faza 6 — filialele (`17-filiale.md`), apoi sincronizarea (`18-sincronizare.md`), confirmat de utilizator 2026-09-27. La filiale se revin deciziile provizorii din `INTREBARI.md` (selectorul de filială din exportul Raportului contabil, pasul „Sincronizez” de la pornire).

## Etapa 0 — baza comună (URMATORUL-PAS.md, sync 28.09 11:06) — DONE 2026-09-28

Toate cele 4 puncte închise, `npm run check` + webapp typecheck/test verzi (137 fișiere, 727 teste) după fiecare:

- **0.1 Shell/z-index:** DONE — scara `--z-sticky/--z-drawer/--z-popover/--z-toast/--z-dialog` în `tokens.css`; `.sidebar` (sticky) + `BranchSelector` (portal), `Drawer`, `Toast`, `RowMenu`, `ConfirmDeleteDialog`, `SmsConfirmDialog`, `MonthPicker`, `SearchSelect` migrate pe variabile, înlocuind valorile ad-hoc (900/1000/1/20/500). Commit-uri `e9d3647`, `757c7f9`.
- **0.2 ScrollArea:** DONE — componentă nouă `shared/ui/ScrollArea` (bară 3px/5px hover, pistă invizibilă, tragere, umbră de continuare), pusă în `.nav` din meniul lateral. Doar sidebar-ul acum — dropdown filială/Drawer/RowMenu/tabele rămân cu scroll nativ, adoptare separată la nevoie. Commit `f772742`.
- **0.3 Antet comun T-1…T-6:** verificat — deja aliniat la `00-comun.md` A (Topbar.tsx/css, nav-items.ts, AppShell.module.css au deja valorile din spec; auditul descria o stare de cod mai veche). Niciun commit necesar.
- **0.4 Bug Prezența:** DONE — `markGroupPresent` folosește `changesToMarkUnmarkedPresent` (doar nemarcații), buton dezactivat la 0 nemarcați, text „Nemarcații (N) → prezenți”. Commit `c7cab97`.

Extra rezolvat din FEEDBACK 28.09 în aceeași trecere (nu erau în Etapa 0, dar mecanice și mici): A5 indicator de salvare Prezența (`e2dc022`), A6 toast „Anulează” la arhivarea unei vizite (`072edb9`). A7 (monedă + pastilă curs) era deja DONE din 27.09, confirmat.

## Modulul 1 — Dashboard (URMATORUL-PAS.md) — DONE 2026-09-28

Delegat unui subagent Sonnet (spec complet: 08-dashboard.md + AUDIT-UI 2.1 D-1…D-4), verificat pe disc (diff + tsc + vitest, nu doar raportul agentului) înainte de commit `8b248d1`.

- **D-1:** DONE — CTA-ul „Necesită atenție” ascuns când `count===0 && !forceShow`.
- **D-2:** DONE — un chip per copil la zilele de naștere (`flatMap`, nu grupat pe zi cu virgulă).
- **D-3:** DONE — hex literali → tokeni (`--muted`, `--orange-bar-past`, `--sand`, `--neutral-softer`); primii 3 tokeni noi existau deja în `tokens.css` (altă sesiune concurentă); `--muted` (#6b7780) nu e o potrivire exactă pt. #5b666e original, dar e cea mai apropiată din scară — diferență imperceptibilă.
- **D-4:** DONE — „+ Adaugă cheltuială” deschide direct formularul (`onNavigate('expenses', {nou:'1'})` + `useSearchParams` în `ExpensesPage`, curăță parametrul după deschidere).
- **Extra (criteriul „KPI fără zecimale”):** `formatKpiMoney` local în `DashboardPage.tsx`, nu schimbă `formatMoney` global (folosit în ~30 de fișiere cu semnătură diferită).
- Cele 4 criterii de acceptare din `08-dashboard.md` — toate bifate. `useDashboard.ts`/`useDashboard.test.ts` neatinse.
- `npm run typecheck` + `vitest run` (137 fișiere, 730 teste) + `prettier --check` — toate verzi, verificat independent.

## Modulul 2 — Copii, listă + fișă (URMATORUL-PAS.md) — DONE 2026-09-28

Delegat unui subagent Sonnet (spec: 02/09-copii*.md + AUDIT-UI 2.2/2.3). Verificat pe disc — rulat concurent cu Modulul 3, izolat prin `git add` doar pe fișierele proprii (fără `git stash`, blocat de sandbox pe fișiere active ale altei sesiuni); scop de teste `children/` + `RowMenu` (53/53 verde) în loc de tsc pe tot arborele, ca să nu prind erorile tranzitorii ale Modulului 3 încă în lucru. Commit `fd6a128`.

- **C-1…C-3, C-5…C-10:** DONE — bordură toolbar, căutare pe părinte/telefon, „Toți” fără număr, badge „Fără grupă”, „ziua N”, antet „Plată <lună>”, `EmptyState` + filtre active, „Mută în grupă” ca `RowMenu` (prop nou `trigger`, backward-compatible), reset paginare pe `key`.
- **C-4, C-11:** SKIP — [decizie], neschimbate.
- **CF-1, CF-3, CF-5, CF-6, CF-8, CF-9, CF-10:** DONE — hero în tonul grupei, card Grupă cu `SearchSelect` inline, sold/taxă cu al treilea rând, „Tipărește confirmarea” ca `RowMenu`, titlu 18px, `--muted`, „Născut”.
- **CF-2 (Date personale, Plătitori reținuți), CF-7 (Documente):** BLOCAT/SKIP — lipsesc din modelul de date, întrebare în `INTREBARI.md`.
- **CF-4 (Note):** PARȚIAL — buton „+ Notă” adăugat; lista cu dată per notă rămâne blocată (`Child.notes` e un singur string, nu o listă) — aceeași categorie ca CF-2, de reluat cu decizia de schemă.

## Modulul 3 — Grupe v2 (`03-grupe.md`, înlocuiește G-1…G-16 din audit) — DONE 2026-09-28

Rulat concurent cu Modulul 2 (fișiere disjuncte `features/groups/*` vs `features/children/*`); arhitectura deciso de mine înainte de delegare (câmpuri `order`/`tone`/`ageMinYears`/`ageMaxYears` pe `Group`, fără endpoint nou — `/api/record` existent, DnD nativ extins din `GroupsBoard.tsx`). Verificat pe disc (diff pe fișierele cheie: `useAttendanceDay.ts`, `record-schema.mjs`, `record-types.d.mts`, `group-order.ts`) + `tsc`/`vitest run` (137/744 verde) + `node --test record-schema.test.mjs` (41/41) + `npm test` rădăcină (1048/1050, 2 skip) + `prettier --check`, toate independent de raportul agentului. Commit `97c1017` (+ fixup formatare `ba95ab2` pt. fișiere din Modulul 2 prinse abia la verificarea comună).

- **Tablă implicit, „+ Grupă nouă” în antet ambele moduri, fără card punctat:** DONE.
- **`GroupTile`/`GroupCardCompact` (noi):** DONE — pastile de stare, max 9 copii+„+N”, editor mereu deschis.
- **Panoul „Fără grupă”:** DONE — sticky, ordonat după data nașterii.
- **Reordonare (DnD):** DONE — tip nou `application/x-group-id` distinct de copii, persistă prin `/api/record` (nu mai localStorage).
- **Drawer 4c „Grupă nouă”:** DONE — preview live, 8 tonuri, capacitate, vârstă opțională, unicitate nume, `order=0` la creare.
- **`useAttendanceDay`:** sortare după `group.order` (nu atinge `markGroupPresent`).
- **Backend:** `Group.order/tone/ageMinYears/ageMaxYears` validate în `record-schema.mjs`.
- **De revizuit — decizie de arhitectură a agentului:** `groupBoardTone.ts` e un sistem de 8 tonuri LOCAL modulului groups, nu extinde `@shared/ui/group-tone.ts` (4-5 tonuri, folosit în children/attendance/payments/status/fee-setup). Funcționează, dar cele două sisteme de culori coexistă — de unificat quando se atinge și restul ecranelor cu >4 grupe.
- **Neatins (best-effort, cum s-a indicat):** ordinea grupelor nu s-a propagat în `FilterPills` din Copii/Achitări/Situația plăților — rămân pe ordinea veche (alfabetică/id) acolo.

## Modulul 4 — Personal (`Personal.dc.html`, `24-personal.md`) — DONE 2026-09-28

Personal a intrat în cod după ce s-a scris auditul, deci fără o listă gata de puncte — agentul a comparat 11 ecrane (23a…23k) direct cu spec-ul. Codul era deja foarte solid; doar 2 lipsuri reale. Verificat pe disc + tsc/vitest (137/744 verde) + prettier, commit `ffd5463`.

- **23b Pontaj:** FĂCUT — grupare pe departamente (lipsea, era doar filtrabil).
- **23k Pontaj tipărit:** FĂCUT — toggle „Cum arăt zilele" (Ore „8” / Prezență „P”), lipsea complet, codul tipărea mereu „8”.
- **23a, 23j, 23c/d+PIN, 23f, 23g, 23h, 23i:** OK-DEJA, verificate ecran cu ecran, neschimbate.
- **Toate cele 5 criterii de acceptare:** confirmate (filială activă, concediu→pontaj+zile rămase, avans scăzut o singură dată, A4 fără tăiere, PIN pe salarii).
- **De clarificat (neblocant):** `annualLeaveDays`/`deductOnlyUnexcused` au valorile implicite corecte dar niciun ecran de editare (doar rută API) — spec zice „de confirmat”, nu cere explicit un ecran; lăsat așa.

## Fixuri găsite la testare locală (nu erau în nicio listă) — DONE 2026-09-28

- **Font pe butoane:** `<button>/<input>/<select>/<textarea>` nu moștenesc `font-family` din browser implicit; `Button.module.css` nu-l seta explicit → butoane cu fontul de sistem (Segoe UI), nu Nunito/Baloo. Fix global în `tokens.css`. Commit `6203eb1`.
- **Bara de selecție „sare”:** apare inline (conform `02-copii-lista.md`) și împinge tabelul instant. Adăugată animație de intrare 160ms (max-height+opacity) — rămâne inline (spec), doar tranziția e nouă. Commit `6203eb1`.
- **Pagina „sare” la lățime când apare/dispare scroll-ul:** `scrollbar-gutter: stable` pe `html`, global — gutter-ul rezervat mereu. Commit în lucru (mixat cu tokens.css al Modulului 5, se comite la închiderea lui).
- Server local rebuildat + repornit de mai multe ori în timpul sesiunii — `webapp/dist` nu se reconstruiește automat la `npm start`, orice testare live cere `npm run build` înainte.
- **Cerut, neînceput încă:** scroll custom (`ScrollArea`) peste tot, inclusiv `DataTable` — task mare, pus pe coadă după Modulele 5/6/7 (risc de coliziune cu `DataTable.tsx`, atins de mai multe module acum).

## Modulul 6 — Cheltuieli (`06-cheltuieli.md`) — DONE 2026-09-28

Rulat concurent cu Modulul 5 (fișiere disjuncte `features/expenses/*` vs `features/payments/*`). Verificat pe disc, scop de teste `expenses/` (37/37 verde, evitat tree complet cât Modulul 5 încă scria fișiere noi). Commit `e9559b9`.

- **E-1 (cea mai mare):** DONE — lună locală + `MonthStepper` în antet, independentă de `MonthPicker`-ul global; tabelul urmărea greșit toate lunile înainte de fix.
- **E-2, E-4…E-9, E-11, E-12:** DONE — `DataTable bare`, scos input-uri de lună + segmented, dropdown „Nearhivate”, subsol sub tabel, etichetă cu contor, legendă pe grid, „Sumă”, Metodă text simplu, bloc „Adaugă rapid” la Pe zile.
- **E-3, E-10 [decizie]:** aplicate — categorii mutate în Drawer din RowMenu; descriere pe 2 rânduri cu `notes`.
- **Toate criteriile de acceptare:** confirmate. Integrarea `?nou=1` din Modulul 1 — verificată, funcțională.

## Modulul 5 — Achitări, Tabel + ecran nou Pe luni (`05-achitari.md`) — DONE 2026-09-28

Rulat concurent cu Modulul 6 (fișiere disjuncte). Verificat pe disc + tsc/vitest pe tot arborele (137/751 verde, +7 teste noi) + prettier. Commit `7b11f1a` (+ `0fa75fa` fix separat scrollbar-gutter, prins la aceeași verificare).

- **P-1:** deja corect, neatins. **P-3…P-10, P-13:** DONE — `Button` peste tot, carduri de sumă cu contoare independente de filtru, toolbar+`FilterPills` în card, „Neasociată →” link, `RowMenu` reordonat, `SelectionBar` plutitoare (prop nou `floating`, backward-compatible), `EmptyState`.
- **P-11:** SKIP — decizie anterioară (27.09), `window.confirm` la dublură rămâne (nu e ștergere).
- **P-12 (ecran nou „Pe luni”):** DONE — `PaymentsByMonth.tsx` + `PaymentDetailPanel.tsx`, stare partajată cu Tabel prin `usePayments`; panoul deschide `PaymentFormDrawer` la Salvează (nu editare inline, ca să nu dubleze logica de alocare); asocierea rămâne doar în `/asociere-achitari`.
- **Toate criteriile de acceptare:** confirmate.
- **De revizuit — decizii ale agentului:** „Bon zi” rămas ghost lângă Exportă (nu era în spec); Perioadă/Nearhivate rămân `<input type=month>`+`SegmentedControl` în toolbar, nu dropdown-uri noi (nu există o componentă `Dropdown` în `shared/ui`); Export = CSV simplu, nu `ReportExportDrawer`.

## Modulul 7 — Situația plăților (`07-situatia.md`) — DONE 2026-09-28

**Deja rezolvat** — o sesiune paralelă a comis `fcce50d` („aliniază Situația plăților la spec: CTA, căutare, spațiere") exact între momentul în care s-a scris auditul și cel în care a ajuns agentul meu la el. S-2 (`Button variant="outline"`) și S-3 (`SearchInput`) — confirmate deja în cod, working tree curat, niciun commit nou necesar.

- Toate cele 3 criterii de acceptare din `07-situatia.md` — confirmate (antet compact identic, `FilterPills` pt. grupă, Notifică/Notifică toți → dialogurile SMS #7c/#7d, deja implementate de o sesiune anterioară, nu doar butoane goale).
- „12c" (sume în valută pe coloane, `formatMoney(row.expected, row.currency)` etc.) — confirmat funcțional.
- S-1, S-4, S-5, S-6 — neatinse, [decizie] fără răspuns clar.

**Toate cele 7 module din URMATORUL-PAS.md sunt acum închise.**

## ScrollArea peste tot — DONE 2026-09-28

7 din cele 8 fișiere identificate migrate la `ScrollArea` (Topbar dropdown căutare, `/design-system` nav, GroupsBoard, ReviewPage, `Drawer`, `SearchSelect`, `SmsConfirmDialog`); `PaymentDetailPanel` nu avea scroll nativ de migrat. `DataTable.tsx` neatins (nu are scroll intern azi, neschimbat intenționat). tsc + vitest (137/137 fișiere, 753/753 teste) + prettier verzi. Commit `8861d3d`.

## Bug-uri critice/majore din audit-ul de azi (A-1, B-1, E-1, E-2) — verificate 2026-09-28

Toate 4 dispecerate cu cavecrew/sonnet în paralel; toate 4 găsite **deja reparate** de sesiuni concurente, între momentul auditului și dispecerizare:
- **A-1** (token de sesiune stale peste filiale): deja în `113b1d0`. 16/16 teste verzi.
- **B-1** (seed categorii implicite fără tranzacție): deja în `ec8d643`.
- **E-1** (backup Comun\ lipsă la shutdown): deja în `a5cb724`.
- **E-2** (avans marcat scăzut înainte de validarea completă a lotului): fix deja în `1c7e46b`; lipsea doar o asertare explicită în test — adăugată, commit `4995590`.

Niciun cod de producție nou. Rămân nereparate din audit-ul separat (`docs/superpowers/specs/2026-09-28-audit-A-core-filiale-sync.md`): restul seriei C/D (inclusiv C-1/C-2, critice, în motorul de sincronizare) — vezi secțiunea de mai jos, nu s-a lucrat la ele azi.

## Verificare sincronizare (18-sincronizare.md) — DONE 2026-09-28, cu o descoperire importantă

**14a (cardul din sidebar):** DONE — există, cele 4 stări corecte. Bug real găsit și reparat: click pe card nu deschidea fila Sincronizare decât la Conflict/Revoked (celelalte 3 stări n-aveau handler deloc), contrar spec-ului („Click pe card deschide 14b”, necondiționat). Commit `038d512`.

**14b (fila Sincronizare) și 14c (Conflicte) — LIPSESC COMPLET**, nu doar vizual incomplete:
- `BackupPage.tsx` n-are filă „Sincronizare”; `goToSyncTab()` din `AppShell.tsx` scrie în `localStorage` o valoare pe care pagina o ignoră.
- Ruta `/conflicte` nu-i înregistrată în `App.tsx` — click pe „Rezolvă” la un conflict te trimite silențios la Dashboard.
- Backend-ul (`sync-server/` + `src/features/sync/`) e mult mai avansat decât UI-ul: Fazele 1-3 din planul de sincronizare (pairing, outbox, politică de conflict, backup zilnic) sunt construite. Lipsesc Task 9 (rute rezolvare conflicte), 11 (connect/reconciliere filiale — fără el, `sync.json` nu se scrie niciodată, motorul nu pornește în producție) și 12 (UI conectare).
- **Important:** un audit separat, de azi (`docs/superpowers/specs/2026-09-28-audit-A-core-filiale-sync.md`), găsește 3 bug-uri critice + 11 majore în motorul deja scris (Fazele 1-3) — inclusiv **pierdere silențioasă de date** la un push în zbor (C-1) și coada de sincronizare inundată la restaurare (C-2). Astea ar trebui reparate înainte sau odată cu 14b/14c, altfel ecranele noi se construiesc pe un motor cu bug-uri de corupere documentate.
- Estimare: **14c mediu**, **14b mare** — ambele depind de reparațiile din audit făcute întâi.
- Criterii de acceptare din `18-sincronizare.md`: doar „cardul arată cele 4 stări” e verificabil azi; restul (conectare, offline→sync, conflict vizibil, deconectare) sunt netestabile end-to-end fără 14b.

**Nu am construit 14b/14c** — e task mare, separat, cu bug-uri de reparat întâi; aștept decizia ta.

## Etapa 0.5–0.9 (URMATORUL-PAS.md, sync 28.09 13:46)

Rulate cu crew multiple în paralel (worktree-uri izolate), fiecare verificat pe disc (diff + `npm run check` + webapp typecheck/test) înainte de merge în `master-v2`.

- **0.5 Componente comune:** DONE — cele 6 pași din `27-componente-comune.md`, fiecare propriul commit: `initials()` unic (era deja re-export, acum sursă unică în `@shared/format/initials`), `PersonCell` (avatar 30px/`size="lg"` 64px conform spec, tone `PillTone|'neutral'`), `DataTable.groupBy` + `TeamView` migrat de pe tabelul scris de mână, `ListToolbar` (Copii + Personal), `ProfileLayout`/`ProfileSection`/`StatCard`/`ProfileNotFound` + migrarea `ChildProfileView`/`StaffProfilePage`, CSS dublat șters (`profileHeader`/`profileAvatar`/`nameCell` — `grep -r` confirmă zero potriviri rămase în afara ecranelor Prezența/Pontaj, în afara scopului). Personal folosește acum `tone=neutral` pe avatar, cum cere spec-ul explicit (nu e regresie — normalizare spre valoarea canonică). Toate cele 6 componente adăugate în `/design-system`. `npm run check` (1048/1050) + webapp typecheck/test (141 fișiere, 776 teste) verzi. Commit-uri `be73305`, `d210cba`, `6a150b6`, `60bf995`, `aa573b3`, merge `45b3fd8`.
- **0.6 Mărimea interfeței + umbra butonului:** DONE — `ui.scale` nou (`shared/state/ui-scale.ts`), persistat în `localStorage` (per calculator, nu sincronizat), aplicat via `document.documentElement.style.zoom` în `main.tsx` înainte de primul render; `SegmentedControl` Compact 90% (implicit)/Normal 100%/Mare 110% în Administrare → Backup și setări → Grădinița, card nou „5 · Interfață”; `@media print { zoom: 1 }` în `tokens.css` ca printurile A4 să nu fie afectate. Umbra `--shadow-button-primary` scoasă din regula de bază `.primary` din `Button.module.css` (rămâne doar pe varianta specifică de antet cu `--shadow-button-header`). `npm run check` (1048/1050) + webapp typecheck/test (759/759) verzi. Commit-uri `c708b84`, `4ad19f4`, merge `183ecd6`.
- **0.7 Grupe — GroupTeamPicker:** DONE — `GroupTeamCard` (select-uri brute, eroare blocantă la al doilea principal) înlocuit cu `GroupTeamPicker.tsx` (03-grupe.md §5c): 3 blocuri pe rol (Principal/Asistent/Înlocuitor), panou căutare cu „unde lucrează deja”, badge concediu (din `leaves`, mutat `useLeaves.ts` din `features/personal/` în `shared/personal/` ca să nu încalce granița de module dintre features), „Schimbă” înlocuiește principalul fără eroare, toggle zile L–V doar în 4a. Randat acum și în 4c (`GroupFormDrawer`, care nu avea deloc echipă înainte). Numele de pe tile/tablă vine din principalul echipei, cu fallback pe `group.educator` legacy marcat „(din fișa veche)”. „Editează” din 4b deschide 4a (pilă + nume clickabil pe tile, înainte mergea doar „+N”). `npm run check` (1048/1050) + webapp typecheck/test (759/759) verzi. Commit-uri `c2a1752`, `8cca780`, merge `70a14b0`.
- **0.8 Personal — fila Candidați (23l):** DONE — tabel nou `candidates` în backend (`personal-schema.mjs`: kind + prefix `CAN-` + FIELDS + validare, `personal.repository.mjs`, rute `/api/personal/candidates`), pe `common.kinds` (ca `departments`/`staff` — verificat direct în cod, comun real ambelor filiale, nu doar aparent). Frontend: a cincea filă în Personal, construită din piesele de la 0.5 (`PersonCell` avatar 30px/neutral, `ListToolbar` cu căutare+contor, `DataTable`, `EmptyState`, `ConfirmDeleteDialog`), `CandidatesTab` + `CandidateFormDrawer` (480px, nume obligatoriu, fără PIN, fără flux de angajare). `npm run check` (1049/1051) + webapp typecheck/test (142 fișiere, 780 teste) verzi. Commit-uri `2e55cf6`, `e3ad309`, merge `29bd239`.

**Toate cele 5 puncte din Etapa 0.5–0.9 (URMATORUL-PAS.md) sunt acum închise.**
- **0.9 Culori grupe:** DONE — `groupTone()` din `group-tone.ts` trecut de pe sortare alfabetică pe `sortByGroupOrder` (`group.order`, reutilizat din `@shared/format/group-order`). Cauza reală era mai mare decât fișierul indicat în URMATORUL-PAS: 8 hook-uri de date (`useAttendanceDay/Month`, `useBirthdays`, `useChildProfile`, `useChildren`, `useFeeSetup`, `usePayments`, `useStatus`) sortau independent lista de grupe alfabetic înainte s-o dea filtrelor — toate trecute pe `sortByGroupOrder`. Cele două sisteme de tonuri (`PillTone` 4 valori vs `BoardTone` 8 valori din `groupBoardTone.ts`, folosit doar în modulul Grupe) **rămân separate**, intenționat — nu s-au contopit, motivul e documentat în cod (Grupe v2 cere 7+ tonuri distincte, PillTone e plafonat la 4 și folosit în alte ecrane; contopirea ar risca regresie vizuală acolo). `npm run check` (1048/1050, 2 skip) + webapp typecheck/test (753/753) verzi. Commit `be1d961`.

## Etapa S — sincronizare (cerută direct, nu din URMATORUL-PAS.md)

- **S.1 (serie C, C-1…C-9) și S.2 (serie D, D-1/D-2 majore):** DEJA REPARATE — de sesiuni concurente (teammates ale acestei echipe: vezi module1-dashboard…fix-B1-category-seeding), între momentul auditului și acest pas. Corectează secțiunea „Verificare sincronizare” de mai jos, care spunea „nu s-a lucrat la ele azi” — era adevărat atunci, nu mai e. Verificat direct pe cod (nu doar din mesajele de commit) de mine, independent de rapoartele agenților: `sync-outbox.repository.mjs` (C-1, gardă pe `change_id`), `create-branch-context.mjs:189` (C-2, `rawRecordRepository`), plus comentarii explicite C-3…C-9/D-1/D-2 în `sync-engine.service.mjs`/`change-applier.mjs`/`sync-server/src/*`. Commit-uri (deja în istoric, dinainte de acest pas): `dbd6602` (D-1), `b0863f2` (D-2), `b85609e` (D-3/D-4), `66eb502` (D-5/D-6/D-10), `190c57e` (D-7), `ee19597` (D-8), `5ace28c` (D-9), `6935d75` (C-1, C-3…C-9, D-2), `9099214` (A-3 rezidual). `node --test` pe toată suita de sincronizare (165 teste) + `npm run check` rădăcină — verzi, rulate independent. **Niciun commit nou** — nimic de schimbat.
- **S.5 Culori grupe, 8 tonuri peste tot:** DONE — `@shared/ui/group-tone.ts` extins de la 4 la 8 tonuri (paleta din `groupBoardTone.ts`: yellow/pink/teal/mint/blue/orange/purple/coral), propagat în `PillTone` (`FilterPills`), `CardTone` (`Card`/hero-ul din `ProfileLayout`), `BadgeTone` (`Badge`) — toate pe tokens.css existente. Fix colateral: 2 mapări exhaustive `Record<PillTone,…>` neacoperite găsite de typecheck (`ChildProfileView.tsx`, `FeeSetupPage.tsx`), completate. `groupBoardTone.ts` rămas fișier separat (are logică proprie: `group.tone` ales manual, nu doar poziție) — consumă acum aceeași paletă, nu s-a contopit într-un singur fișier (ar cere refactor în Grupe, în afara scopului). **Semnalat, nerezolvat:** `groupTone()` e strict pozițional, nu verifică `group.tone` manual ca `boardTone()` — o grupă cu ton ales manual în Drawer arată diferit în Tablă față de Copii/Achitări/etc.; inconsistență preexistentă, nu introdusă acum. `npm run check` (1049/1051) + webapp typecheck/test (142 fișiere, 780 teste) verzi. Commit `2526a9c`, merge `a20928d`.
- **S.3a (Task 9, rute rezolvare conflicte):** DONE — `sync-conflicts.routes.mjs` nou (`GET/POST /api/sync/conflicts(/resolve)`), `conflict-diff.mjs` (diferențe pe câmpuri, notele medicale redactate), legate în `create-branch-context.mjs` ca fișier/spread separat (nu în `sync.routes.mjs`, deliberat, ca să nu se ciocnească cu Task 11 rulat în paralel). TDD real (5 teste, picate înainte, verzi după). `npm run check` (1054/1056→1056 după fix prettier) + webapp typecheck/test (142/142, 780/780) verzi. Commit-uri `c431aa6`, `e9b0988`, `35c9df0`, merge `39e314d`.
- **S.3b (Task 11, connect/reconciliere filiale):** DONE — `branch-registry.mjs` capătă `adopt()`/`replaceEmpty()`, `snapshot-io.mjs` nou (citire/scriere în masă), `sync-connect.service.mjs` (`connect()`/`disconnect()`: urcare filiale cu date, adoptare filială goală, descărcare restul), rute noi la nivel de aplicație (`sync-connect.routes.mjs`: connect/disconnect/pairing-codes/devices/revoke/server) — deliberat NU în `sync.routes.mjs` (per-filială), ca să nu se ciocnească cu Task 9. Conflict real doar în `index.server.mjs` (export dublu adăugat de ambele crew-uri simultan), rezolvat manual, o linie. Test „redenumire filială ajunge în registrul celuilalt calculator” rămâne nefăcut — ține de reconcilierea periodică din motor (decizia 9, al 5-lea ciclu), nu de `connect()` însuși; de reluat separat. `npm run check` (1064/1066) + webapp typecheck/test (780/780) verzi. Commit-uri `2386eac`, `119c141`, `b7108bd`, `4eebef0`, merge `bab23b7`.
- **S.4a (Task 10, pagina `/conflicte`):** DONE — construită contra contractului API fixat pentru Task 9 (fără să aștepte backend-ul, în paralel), integrare confirmată curată la merge (fără mismatch de contract). `useConflicts.ts`+`field-labels.ts`, `ConflictsPage.tsx`+`ConflictDetail.tsx` (grid 320/1fr, rândul activ cu bară portocalie, tabel 3 coloane cu rândurile diferite pe galben), rând „Conflicte” în De rezolvat ascuns complet la 0 conflicte. Deviație notată: eyebrow-ul detaliului nu arată numele filialei (contractul Task 9 nu-l expune, nu era necesar — ecranul arată doar conflictele filialei active). Raport inițial semnala un test flake (`VisitsPage.test.tsx`, timeout) — nereprodus la verificarea mea (785/785 verde). `npm run check` (1064/1066) + webapp typecheck/test (144/144, 785/785) verzi. Commit-uri `e9b80b5`, `8d6efbb`, `64832ad`, merge `f4062b5`.
- **S.4b (Task 12, fila Sincronizare):** DONE — construit contra contractului fixat pentru Task 11, `goToSyncTab()` confirmat funcțional (doar a lipsit `'sync'` din `ViewMode`). Fix colateral necesar: `/api/session` acum expune `suggestedName`/`deviceName` (uniune discriminată pe `configured`), verificat compatibil cu singurul consumator existent (`useSyncStatus`, doar `?.configured`). **Reparat de mine, după merge:** 3 violări de graniță între module (`architecture.test.ts`) — `SyncSettings`/`ConnectServerForm` importau `BackupPage.module.css` direct din alt feature, `BackupPage` importa `SyncSettings` direct din `features/sync`. Fix: mutat toate fișierele UI ale Task 12 (`SyncSettings`, `ConnectServerForm`, `PairingCodeCard`, `DevicesList`, `useSyncSettings` + teste) din `features/sync/` în `features/backup/` (consecvent cu unde trăiesc deja `BranchesSettings`/`KindergartenSettings`), și promovat `useSyncStatus` (Task 8, folosit și de `app/shell` și acum de Backup) din `features/sync/` în `shared/api/useSyncStatus.ts`. `npm run check` (1064/1066) + webapp typecheck/test (146 fișiere, 793 teste) verzi, verificat de mine după fix, nu doar din raportul agentului. Commit-uri `50c3aae`, `64d68b2`, `bd0cd59`, merge `da9aa39` + commit separat de fix arhitectură.
- **S.3, S.4:** verificate ca lipsă reală (nu doar presupuse) — nicio rută de conflicte, `/conflicte` neînregistrată, nicio filă „Sincronizare” în `BackupPage`, `goToSyncTab()` tot scrie într-un `localStorage` pe care nimeni nu-l citește. În lucru.

## De discutat cu utilizatorul
- **Sincronizare 14b/14c** (de mai sus) — reparăm motorul întâi (auditul separat) sau construim UI-ul peste el așa cum e?
- Build + hash instaler final, după ce confirmi că merge tot testat local.
