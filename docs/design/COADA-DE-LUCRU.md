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

## Verificare finală, definitivă — audit-A-core-filiale-sync.md, toate seriile A-E

**Nu mai există nimic nereparat din acest audit.** Verificat de 3 ori independent (grep direct pe cod + `node --test`, nu doar rapoarte de agent), inclusiv o rundă de re-verificare cerută explicit după ce s-a suspectat regresie — regresie confirmată INEXISTENTĂ:

- **A-1, A-2, A-3, A-5:** reparate — comentarii explicite în `create-application.mjs` (linia cu „A-2” = SSE închis înainte de `server.close`; „A-3” = ordinea `setLastBranchId`/`try-catch`). Commit-uri `113b1d0`, `d19a390`, `ddc2439`, `9099214`.
- **B-1, B-2:** reparate — `ec8d643` (semințe prin depozitul brut, id determinist).
- **C-1…C-9:** reparate — `sync-outbox.repository.mjs` (gardă pe `change_id`, comentariu „C-1”), `sync-engine.service.mjs` (comentarii C-3…C-9 la fiecare punct din audit). Commit `6935d75`.
- **C-2:** reparat — `create-branch-context.mjs:190`, `createRevisionTransaction` primește `rawRecordRepository`.
- **D-1…D-10:** reparate — comentarii „D-1”/„D-2” în `sync-server/src/change-policy.mjs`/`changes.service.mjs`. Commit-uri `dbd6602`, `b0863f2`, `b85609e`, `66eb502`, `190c57e`, `ee19597`, `5ace28c`, `ee1cab7`.
- **E-1:** reparat — `create-common-context.mjs:44`, backup automat pe Comun. Commit `a5cb724`.
- **E-2:** reparat — `salaries.service.mjs`, `pay()` grupează scrierile din Comun într-un singur `kinds.transaction()` ca ultim pas, validare/normalizare completă înainte de orice scriere. Test dedicat `salaries.service.test.mjs:224` („E-2 (audit Comun): lotul e validat integral înainte de a marca vreun avans ca scăzut”), verificat că trece.
- Suita completă de sincronizare (165 teste) + `npm run check` rădăcină — verzi, rulate independent de mine, nu doar din raportul vreunui agent.

**De reținut pentru orice sesiune viitoare:** dacă cineva (uman sau agent) raportează că seria C/D „nu s-a făcut încă” sau „e neatinsă de la un anumit commit”, verifică ÎNTÂI cu `grep -rn "C-1\|C-2\|...".` pe codul curent înainte de a re-porni lucrul — au fost cel puțin 2 rânduri de confuzie pe acest subiect în aceeași sesiune, ambele rezolvate prin verificare directă pe disc, nu prin presupuneri.

## Verificare end-to-end LIVE — 18-sincronizare.md, toate cele 6 criterii PASS

Server real (`sync-server`) + 2 instanțe reale de aplicație (homes separate), nu teste unitare/mock-uri — Task 9-12 nu fuseseră niciodată testate integrat, împreună, live, până acum:

1. **Conectare, primul calculator (cheie de instalare):** PASS — `POST /api/sync/connect` 200, filiala urcată.
2. **Cod de asociere + al doilea calculator:** PASS — B a adoptat filiala serverului (calculator nou cu filială goală, decizia 9 din plan), nu a dublat-o.
3. **Editare pe A → apare pe B:** PASS — confirmat prin `/api/state` pe B după `sync/now`.
4. **Offline → resincronizare:** PASS — server oprit → `connection:"offline"`, pending crescut; repornit → `"online"` pe ambele.
5. **Conflict vizibil, rezolvabil:** PASS — editare simultană pe `children` (CONFLICT_KIND) → `GET /api/sync/conflicts` arată ambele variante, câmpul diferit marcat corect; `resolve` funcționează, lista se golește.
6. **Deconectare:** PASS — `devices/revoke` de pe A → B primește `connection:"revoked"` imediat.

Sincronizarea end-to-end (motor + server + UI 14b/14c) e confirmată funcțională complet, nu doar pe bucăți testate separat.

## Etapa S — sincronizare (cerută direct, nu din URMATORUL-PAS.md)

- **S.1 (serie C, C-1…C-9) și S.2 (serie D, D-1/D-2 majore):** DEJA REPARATE — de sesiuni concurente (teammates ale acestei echipe: vezi module1-dashboard…fix-B1-category-seeding), între momentul auditului și acest pas. Corectează secțiunea „Verificare sincronizare” de mai jos, care spunea „nu s-a lucrat la ele azi” — era adevărat atunci, nu mai e. Verificat direct pe cod (nu doar din mesajele de commit) de mine, independent de rapoartele agenților: `sync-outbox.repository.mjs` (C-1, gardă pe `change_id`), `create-branch-context.mjs:189` (C-2, `rawRecordRepository`), plus comentarii explicite C-3…C-9/D-1/D-2 în `sync-engine.service.mjs`/`change-applier.mjs`/`sync-server/src/*`. Commit-uri (deja în istoric, dinainte de acest pas): `dbd6602` (D-1), `b0863f2` (D-2), `b85609e` (D-3/D-4), `66eb502` (D-5/D-6/D-10), `190c57e` (D-7), `ee19597` (D-8), `5ace28c` (D-9), `6935d75` (C-1, C-3…C-9, D-2), `9099214` (A-3 rezidual). `node --test` pe toată suita de sincronizare (165 teste) + `npm run check` rădăcină — verzi, rulate independent. **Niciun commit nou** — nimic de schimbat.
- **S.5 Culori grupe, 8 tonuri peste tot:** DONE — `@shared/ui/group-tone.ts` extins de la 4 la 8 tonuri (paleta din `groupBoardTone.ts`: yellow/pink/teal/mint/blue/orange/purple/coral), propagat în `PillTone` (`FilterPills`), `CardTone` (`Card`/hero-ul din `ProfileLayout`), `BadgeTone` (`Badge`) — toate pe tokens.css existente. Fix colateral: 2 mapări exhaustive `Record<PillTone,…>` neacoperite găsite de typecheck (`ChildProfileView.tsx`, `FeeSetupPage.tsx`), completate. `groupBoardTone.ts` rămas fișier separat (are logică proprie: `group.tone` ales manual, nu doar poziție) — consumă acum aceeași paletă, nu s-a contopit într-un singur fișier (ar cere refactor în Grupe, în afara scopului). **Semnalat, nerezolvat:** `groupTone()` e strict pozițional, nu verifică `group.tone` manual ca `boardTone()` — o grupă cu ton ales manual în Drawer arată diferit în Tablă față de Copii/Achitări/etc.; inconsistență preexistentă, nu introdusă acum. `npm run check` (1049/1051) + webapp typecheck/test (142 fișiere, 780 teste) verzi. Commit `2526a9c`, merge `a20928d`.
- **S.3a (Task 9, rute rezolvare conflicte):** DONE — `sync-conflicts.routes.mjs` nou (`GET/POST /api/sync/conflicts(/resolve)`), `conflict-diff.mjs` (diferențe pe câmpuri, notele medicale redactate), legate în `create-branch-context.mjs` ca fișier/spread separat (nu în `sync.routes.mjs`, deliberat, ca să nu se ciocnească cu Task 11 rulat în paralel). TDD real (5 teste, picate înainte, verzi după). `npm run check` (1054/1056→1056 după fix prettier) + webapp typecheck/test (142/142, 780/780) verzi. Commit-uri `c431aa6`, `e9b0988`, `35c9df0`, merge `39e314d`.
- **S.3b (Task 11, connect/reconciliere filiale):** DONE — `branch-registry.mjs` capătă `adopt()`/`replaceEmpty()`, `snapshot-io.mjs` nou (citire/scriere în masă), `sync-connect.service.mjs` (`connect()`/`disconnect()`: urcare filiale cu date, adoptare filială goală, descărcare restul), rute noi la nivel de aplicație (`sync-connect.routes.mjs`: connect/disconnect/pairing-codes/devices/revoke/server) — deliberat NU în `sync.routes.mjs` (per-filială), ca să nu se ciocnească cu Task 9. Conflict real doar în `index.server.mjs` (export dublu adăugat de ambele crew-uri simultan), rezolvat manual, o linie. Test „redenumire filială ajunge în registrul celuilalt calculator” rămâne nefăcut — ține de reconcilierea periodică din motor (decizia 9, al 5-lea ciclu), nu de `connect()` însuși; de reluat separat. `npm run check` (1064/1066) + webapp typecheck/test (780/780) verzi. Commit-uri `2386eac`, `119c141`, `b7108bd`, `4eebef0`, merge `bab23b7`.
- **S.4a (Task 10, pagina `/conflicte`):** DONE — construită contra contractului API fixat pentru Task 9 (fără să aștepte backend-ul, în paralel), integrare confirmată curată la merge (fără mismatch de contract). `useConflicts.ts`+`field-labels.ts`, `ConflictsPage.tsx`+`ConflictDetail.tsx` (grid 320/1fr, rândul activ cu bară portocalie, tabel 3 coloane cu rândurile diferite pe galben), rând „Conflicte” în De rezolvat ascuns complet la 0 conflicte. Deviație notată: eyebrow-ul detaliului nu arată numele filialei (contractul Task 9 nu-l expune, nu era necesar — ecranul arată doar conflictele filialei active). Raport inițial semnala un test flake (`VisitsPage.test.tsx`, timeout) — nereprodus la verificarea mea (785/785 verde). `npm run check` (1064/1066) + webapp typecheck/test (144/144, 785/785) verzi. Commit-uri `e9b80b5`, `8d6efbb`, `64832ad`, merge `f4062b5`.
- **S.4b (Task 12, fila Sincronizare):** DONE — construit contra contractului fixat pentru Task 11, `goToSyncTab()` confirmat funcțional (doar a lipsit `'sync'` din `ViewMode`). Fix colateral necesar: `/api/session` acum expune `suggestedName`/`deviceName` (uniune discriminată pe `configured`), verificat compatibil cu singurul consumator existent (`useSyncStatus`, doar `?.configured`). **Reparat de mine, după merge:** 3 violări de graniță între module (`architecture.test.ts`) — `SyncSettings`/`ConnectServerForm` importau `BackupPage.module.css` direct din alt feature, `BackupPage` importa `SyncSettings` direct din `features/sync`. Fix: mutat toate fișierele UI ale Task 12 (`SyncSettings`, `ConnectServerForm`, `PairingCodeCard`, `DevicesList`, `useSyncSettings` + teste) din `features/sync/` în `features/backup/` (consecvent cu unde trăiesc deja `BranchesSettings`/`KindergartenSettings`), și promovat `useSyncStatus` (Task 8, folosit și de `app/shell` și acum de Backup) din `features/sync/` în `shared/api/useSyncStatus.ts`. `npm run check` (1064/1066) + webapp typecheck/test (146 fișiere, 793 teste) verzi, verificat de mine după fix, nu doar din raportul agentului. Commit-uri `50c3aae`, `64d68b2`, `bd0cd59`, merge `da9aa39` + commit separat de fix arhitectură.
- **S.3, S.4:** verificate ca lipsă reală (nu doar presupuse) — nicio rută de conflicte, `/conflicte` neînregistrată, nicio filă „Sincronizare” în `BackupPage`, `goToSyncTab()` tot scrie într-un `localStorage` pe care nimeni nu-l citește. În lucru.

## Audit acoperire design → cod (toate ecranele din screens/README.md)

Verificat prin semnale (prezența modulului/rutei/componentei), nu calitate cod linie cu linie. 24 din 27 ecrane OK. Ce lipsește cu adevărat, în ordinea impactului:

1. **23-bazin.md — LIPSĂ COMPLETĂ, cel mai mare gol găsit azi.** Zero cod pentru `pool_bookings`/`pool_sessions`/`pool_settings`. 4 ecrane (Săptămâna/Programare nouă/Luna/Setări). Singurele urme: `salaries.service.mjs` are deja `mode:'bazin'`+`readCoachPayForMonth` (pregătit să primească date), `PoolReceiptLabel.tsx` (doar eticheta). În lucru.
2. **26-foaie-saptamana.md:** DONE — `WeeklySheet.tsx` (foaia A4, 16 rânduri fixe, ordinea ca la Ziua, fără date de contact) + `WeeklySheetDialog.tsx` (fereastra 480px, opțiuni persistate) + ruta `/prezenta/foi` cu `window.print()` automat; buton „Foi pe săptămână” principal lunea/secundar altfel, în Ziua (lângă legendă) și Luna (antet). Toate cele 4 teste cerute explicit (14→14+2/0→16/20→2 foi, fără Alergii→coloană lipsă, fără telefon în DOM, N foi din buton = randate) PASS. Fără tokens noi (toate cele 5 culori din spec existau deja). **Nebifat, notat de agent:** comparație vizuală pixel-cu-pixel cu artboard-ul `#18d` în browser — implementat strict din text, nu verificat vizual. `npm run check` (1064/1066) + webapp typecheck/test (147 fișiere, 807 teste) verzi. Commit-uri `dc3c9cb`, `b7c90c4`, `a622d0c`, merge `78cacbf`.
3. **FM-3 (`PaymentFormDrawer.tsx` vs spec 15b) — PARȚIAL, confirmat (nu doar presupus ca în auditul inițial).** Logica de fond (alocări, EUR, curs) e solidă; lipsește complet structura UI: card copil+„Schimbă”, sumă mare Baloo 40 cu scurtături 1/2/3 luni, `SegmentedControl` pe Metodă, comutator automat/manual explicit. În lucru.
4. **22-prima-pornire.md — LIPSĂ, dar marcat opțional în index.** Doar partea „conectare cu cod” a fost reținută (în sincronizare), restul neconstruit intenționat.

**FM-3 (`PaymentFormDrawer` pe spec 15b):** DONE — card copil (`PersonCell` cu ton din grupă) + „Schimbă” (`SearchSelect`), sumă mare cu scurtături 1/2/3 luni (× taxa, doar pt. MDL — EUR ar cere conversie nouă în UI, în afara scopului „nu rescrie logica”), Metodă ca `SegmentedControl` (mută suma pe metoda activă, modelul `tenders` neschimbat), comutator automat/manual pe alocare (implicit automat la un singur rând), footer „Salvează · suma”. Referința vizuală corectă era `Formulare.dc.html#15b`, nu `Achitari.dc.html` cum presupunea directiva inițială. `npm run check` (1064/1066) + webapp typecheck/test (146 fișiere, 800 teste) verzi. Commit-uri `b07ef83`, `c21ed2e`, merge `eabe208`.

## FM-1, FM-2 — formulare (Lot 15, AUDIT-UI-2026-09-28.md)

- **FM-2 (`ExpenseFormDrawer` pe spec 15c):** DONE — sumă mare (Baloo 40/800), chip-uri categorie (`role="radio"`, border 2px în culoarea categoriei), „Salvează și adaugă alta" (doar la cheltuieli noi, cablat pe `quickAddExpense` existent) + „Salvează". **Reparat de mine, după raport:** agentul crease inițial un `category-tone.ts` nou, l-a șters pe disc după ce a găsit `categoryStyleFor()` deja existent în `useExpenses.ts` (sursă unică documentată pentru culoarea categoriilor) — dar ștergerea nu ajunsese în commit (`git status` arăta ` D` necomis). Am comis eu ștergerea lipsă înainte de merge. `npm run check` (1064/1066) + webapp typecheck/test (146 fișiere, 795 teste) verzi, verificat de mine după fix. Commit-uri `290ba4b` + fix-ul meu, merge `b5685d1`.
- **FM-1 (`ChildFormDrawer` pe 4 secțiuni):** DONE — 1·Copil (Nume, Data nașterii+vârstă, grupe compatibile din `Group.ageMinYears/ageMaxYears`, Statut), 2·Părinți (2 carduri Nume+Telefon, pe modelul fix existent `parent/phone/parent2/phone2` — nu dinamic), 3·Contract și taxă (carduri de program din `usePlanPresets` EUR existente, nu dropdown), 4·Grupă opțional (chip-uri cu „N locuri libere”, calculat din capacitate minus copii nearhivați, exclude copilul editat). **Gap-uri de model semnalate, nerezolvate, pe cont propriu nu s-a extins schema:** Nume/Prenume separate (`Child.name` e un singur câmp), relație pe părinte + listă dinamică „+ Adaugă încă un părinte” (schema are exact 2 sloturi fixe). `npm run check` (1064/1066) + webapp typecheck/test (146 fișiere, 798 teste) verzi. Commit-uri `f0b28d6`, `7884a65`, merge `abc5d02`.

**FM-1 și FM-2 închise. Toată coada cerută azi (0.5–0.9, S.1–S.5, FM-1–2) e integrată pe `master-v2`, comisă local, nepushată.**

## 23-bazin.md — modulul Bazin

- **Backend + frontend de bază (Task 8-10, plan `2026-09-27-personal-bazin.md`):** DONE — `pool_settings`/`pool_bookings`/`pool_sessions`/`pool_closings` (tabele proprii per filială, decizia 11), `charges` ca record kind nou peste `obligation()` (decizia 4 — cei 7 apelanți actualizați). Rutele `/api/pool/*` (settings, week, bookings cu verificare `seatsPerSlot`, sessions, month, close-month idempotent — decizia 5). Antrenorii vin din Personal prin porturi (`listCoaches`/`payCoach`), fără ca `pool` să importe `#features/personal` (regula de graniță). Webapp: `PoolPage` (22a săptămâna/luna), `BookingDrawer` (22b), tab Bazin în Backup și setări (22d), Sidebar/nav/rute (ascuns cât timp `poolSettings.enabled` e fals), liniile Bazin în Situația plăților și fișa copilului. Toate cele 4 criterii de acceptare din spec au test dedicat și trec (capacitate, idempotență, formula antrenorului identică pe card/închidere, setări per filială).
- **3 bug-uri reale găsite la verificare, în afara a ce raportase crew-ul (comis niciodată — 41 fișiere needitate, verificate de mine diff cu diff înainte de commit):**
  1. `validateState()` respingea orice `/api/import`/restaurare/export Excel fără `charges` — spărgea real fluxul de import Excel din Backup, nu doar teste vechi. Fix: lipsă = listă goală, ca la orice tip anterior.
  2. `sync-server/src/change-policy.mjs` (`RECORD_KINDS`) nu primise `charges` — desincronizat de `#shared/domain/record-schema.mjs`, prins de `tests/sync-shared-constants.test.mjs`.
  3. `create-branch-context.mjs` importa direct fișiere private din `pool/domain/*` (în loc de `index.server.mjs`); `pool-closing.service.test.mjs` importa `#features/personal` direct — mutat în `src/app/server/pool-closing.integration.test.mjs` (compunerea reală pool+personal aparține rădăcinii de compunere, nicio feature nu importă altă feature).
  4. (colateral, nelegat de Bazin) `useChildren.test.ts` calcula scadențele față de `today()` real cu un comentariu „azi 2026-09-23" ca presupunere — a picat exact azi când data reală a trecut de scadența c2. Fixat cu `vi.setSystemTime`.
- `npm run check` (root, 1085 teste) + webapp typecheck/test (149 fișiere, 812 teste) verzi, verificate de mine după merge pe `master-v2`, nu doar din raportul crew-ului. Commit `15fb0f1`, merge `d381e68`, fix ceas `597bef0`.
- **Rămas, nefăcut (nu blochează criteriile de acceptare):**
  - Task 11 rest: bonul de 58 mm al Bazinului (`PoolReceiptPage`, mutarea `PoolReceiptLabel` din `payments/` în `pool/`) — liniile Bazin în Situația/fișă/confirmare SUNT gata, doar bonul separat lipsește.
  - Foaia „Bazin" din exportul Excel (sheet-ul citibil childName/month/label/amount) — datele brute chiar apar deja în sheet-ul generic de tip/id/JSON, doar varianta lizibilă lipsește.
  - Task 12 din plan (sincronizarea propriu-zisă a `pool_bookings`/`pool_sessions`/`pool_closings`/`charges`/kind-urile Personal către `sync-server`) — nefăcut, e o bucată separată, nu mică.
  - README.md al feature-ului `pool` — adăugat de mine (lipsea din commit-ul crew-ului).

## 23-bazin.md — cele 3 bucăți rămase (Task 8/11/12), închise separat, în worktree izolat

- **Task 12 — sincronizarea `pool_bookings`/`pool_sessions`/`pool_closings`.** Aceleași porturi ca la `attendance`: `createPoolRepository` primește `onChange`, scrie outbox-ul la fiecare programare/marcaj/închidere; `createSyncPoolWriter` (writer brut, fără tranzacție proprie — motorul de sync o deschide deja) aplică modificările trase de pe alte calculatoare; `applySnapshotEntry`/`change-applier` extinse cu cele 3 kind-uri noi; `sync-server/src/change-policy.mjs` (`KINDS`) sincronizat manual, verificat de `tests/sync-shared-constants.test.mjs`. **Nu** include setul „comun"/Personal — explicit în afara scopului acestei bucăți. Bug prins înainte să ruleze: `saveClosing` nu-și deschide propria tranzacție (ar fi dat „cannot start a transaction within a transaction", fiindcă e apelat din tranzacția deja deschisă a închiderii lunii). Commit `7db2543`.
- **Task 8 — foaia „Bazin" lizibilă din exportul Excel.** `exportWorkbook()` adaugă un sheet nou (ID, ID_copil, Copil, Luna, Descriere, Sumă, Data) peste `charges` — pur informativ, la reimport nu se citește după nume de sheet, deci nu dublează nimic. Commit `1c5b3cc`.
- **Task 11 — bonul de 58 mm al Bazinului.** `GET /api/pool/month` întoarce acum `bookings`+`sessions` per copil; `PoolSettings` capătă `itemsNote` (ce aduce copilul, afișat pe bon; formular în Backup și setări → Bazin); `MonthView` are un meniu ⋯ cu „Bon 58 mm" → `/bazin/bon/:childId?month=`; `PoolReceiptLabel` (componentă pură, pregătită de mai demult) mutat din `features/payments` în `features/pool`, unde aparține de fapt; `PoolReceiptPage` e ruta reală (`usePoolMonth`+`usePoolSettings`+`useAppSession`, calculează zilele lunii cu `expandBooking` și punctează ședințele anulate), cu același toolbar de tipar 58 mm ca la achitări. Commit `f0d40af`.
- Toate 3: `npm run check` (root) + `cd webapp && npm run typecheck && npm test` verzi (1102 teste root, 819 teste webapp), verificate după fiecare bucată în parte, nu doar la final.
- Cu asta, tot ce era listat ca „rămas, nefăcut" la Bazin (Task 8/11/12) e închis. Rămân doar: Fișa copilului (CF-1…10, model de date nou) și build+hash-ul instalatorului final — în afara scopului acestei bucăți.

## Fișa copilului (CF-1...CF-10, spec 09-copii-fisa.md, audit AUDIT-UI-2026-09-28.md)

- **CF-4 (notes → listă datată):** DONE, cu schimbare de model de date, nu doar UI. `Child.notes` a trecut din `string` în `ChildNote[]` (`{id, text, date}`). Migrare SQL nouă (`003-child-notes-list.mjs`, la pornirea aplicației) convertește notele existente string→listă; `upgradeSnapshot()` face aceeași conversie pe calea separată de import/restaurare backup (pentru instalări care n-au trecut încă prin migrare, la citirea unui export vechi). `record-schema.mjs` validează lista (id unic, text nevid, dată validă, sortare recentă-întâi). Fișa copilului: secțiunea Note arată lista cu dată, cu formular inline de adăugare; textarea „Observații” din formularul de adăugare/editare copil (`ChildFormDrawer`) a fost eliminată — notele nu se mai editează la creare, doar din fișă.
- **CF-7 (Documente):** DONE ca placeholder — card „Documente” cu 3 sloturi goale + buton „+ Încarcă” dezactivat, exact cât cere spec-ul. Upload real neimplementat (nu era cerut).
- **CF-10 (ton insignă):** DONE — insigna de grupă din hero foloseşte `heroTone` (tone-ul real al grupei), nu `'orange'` fix.
- **CF-2 (Date personale, Plătitori reținuți):** neconstruit, intenționat — decizie deja consemnată în `docs/design/INTREBARI.md` (⏳, cu default interimar „se închide fără ele”). Nu e de competența acestei sesiuni să o deblocheze.
- **Consumatori din backend adaptați la noul format** (nu erau parte din UI, dar spargeau fără fix): `children-csv-import.mjs` (nota de provenanță CSV devine `[{id, text, date}]`, nu string), `excel-workbook.mjs` (exportul Excel „Observații” concatenează `data: text` din listă), `review-center.mjs` (căutarea/filtrarea din Centrul de verificare trata `record.notes` ca text pe Payment/Expense/Child deopotrivă — Child dă acum listă, tratată separat).
- **Bug propriu găsit și reparat înainte de commit, nu doar raportat:** funcția adăugată în `record-snapshot-upgrade.mjs` folosea `new Date()` direct — interzis în `src/shared/domain/**` (regula `clock-in-domain` din `tests/architecture/import-boundaries.test.mjs`, singurul loc scutit fiind `calendar-month.mjs`). Fix: `today()` din `calendar-month.mjs`, nu construcție manuală a datei. Un test propriu ('...primește o listă cu o singură notă datată azi') compara cu `new Date().toISOString().slice(0,10)` (UTC) în loc de `today()` (local) — flake real lângă miezul nopții, nu doar teoretic; fixat să compare cu `today()`.
- Criteriile de acceptare din spec: 3 din 4 bifate (pagină proprie, culoare header din `groupTone`, „+ Plată" precompletat — deja adevărate în cod, verificate, nu presupuse); a 4-a („Plătitorii reținuți se pot șterge") rămâne nebifată, corelată cu CF-2 amânat.
- `npm run check` (root, 1096 teste) + webapp typecheck/test (151 fișiere, 821 teste) verzi. Commit-uri `24b1584` (schemă+migrare), `816af1d` (consumatori backend), `608135e` (UI fișă copil) — pe `worktree-agent-a435ed848cd2db48d`, nepushate, neintegrate încă pe `master-v2`.
- **Nebifat, rămas pentru altă sesiune:** Nume/Prenume separate pe Child și număr variabil de părinți (semnalate în directivă, dar sunt schimbări de model separate de CF-4, nu incluse aici ca să nu extindă scopul unei singure sesiuni).
- **CF-1, CF-3, CF-5, CF-6, CF-8, CF-9 — verificate din nou la cererea coordonatorului, confirmate deja rezolvate, fără cod nou.** Tabelul CF din `AUDIT-UI-2026-09-28.md` era scris înainte de introducerea `ProfileLayout`/`StatCard`/`RowMenu` (`@shared/ui`) și de unificarea tonurilor (S.5); codul curent (verificat linie cu linie, cu `git log`/`git blame` care arată commit-uri anterioare acestei sesiuni, nu munca de azi) le are deja pe toate: hero cu `heroTone`+`neutral→white` (CF-1), pătrat 48px+`SearchSelect` (CF-3), al treilea rând `sub` pe toate cele 3 mini-carduri (CF-5), `RowMenu` cu „Tipărește confirmarea” (CF-6), titlu secțiune Baloo 18px din `ProfileLayout.module.css` (CF-8), zero hex hardcodat / `--muted` peste tot (CF-9). Detaliile exacte (fișier:linie pentru fiecare) sunt adăugate direct în `AUDIT-UI-2026-09-28.md`, secțiunea 2.3, ca să nu se piardă la următoarea citire a auditului. Niciun commit nou de cod — doar `docs(design)` pentru actualizarea auditului. Rulat din nou webapp typecheck (curat) ca să confirm că nimic nu s-a stricat între timp.
- **Concluzie:** din cele 10 puncte CF, 9 sunt închise (CF-1, CF-3, CF-4, CF-5, CF-6, CF-7, CF-8, CF-9, CF-10); singurul rămas e CF-2, amânat intenționat.

## Build + hash instalator final

- **DONE** — `npm run check:full` (format+tsc+teste+smoke browser+ciclu de viață lansator) verde, apoi `scripts\pachet-client\build-client-package.ps1` din HEAD `feabc05` (Bazin complet + Fișa copilului CF-1..10 minus CF-2, merged).
- `Livrare\Startica_Setup_2.0.0.exe` — 22.73 MB.
- **SHA-256:** `53CDFF0CC590BBE8FE12C4B261C4B7458FD22BF927493F1493746F0F11F0A47D`
- Instalerele vechi (build-uri anterioare de azi) mutate, nu șterse: `Startica_Setup_2.0.0.exe.stale-20260928`, `Startica_Setup_2.0.0.exe.prev-4a9633d`.
- Rămân doar pașii manuali de la client din `GHID-LIVRARE.md` (instalare de probă, Google Drive, Telegram) — necesită prezență fizică, în afara a ce se poate automatiza.

## 2026-09-29 — Task 12 (plan `2026-09-27-personal-bazin.md`): sincronizarea setului „comun"

- **DONE, în worktree izolat.** Ultima bucată rămasă din Bazin/Personal: sincronizarea celor 8 kind-uri din `comun` (`staff`, `departments`, `roles`, `timesheet`, `leaves`, `salaries`, `advances`, `salary_payments`) între calculatoare — `pool_bookings`/`pool_sessions`/`pool_closings` erau deja sincronizate dinainte (secțiunea de mai sus, commit `7db2543`), nu s-au atins din nou.
- **Cum:** `comun` e un dataset cu id fix (`COMMON_DATASET_ID = 'comun'`), nu o filială — `sync-server/src/change-policy.mjs`/`changes.routes.mjs` îl acceptă fără rând în `branches.json`. `create-common-context.mjs` capătă propriile `sync_state`/`sync_outbox`/`sync_conflicts` și o a doua instanță `createSyncEngine` (aceeași funcție, dataset-agnostică — `branch.id: 'comun'` e singura diferență), pornită o dată la boot și **niciodată** oprită la schimbarea filialei active (spre deosebire de motorul unei filiale). `sync-connect.service.mjs`: la `connect()`, dacă serverul are deja rânduri „comun" ȘI calculatorul local are și el — nu 409 ca la o filială, ci rândurile locale se urcă ca modificări obișnuite (`baseRevision: 0`); status/conflicte (`GET /api/sync/status`/`/conflicts`) însumează cele două motoare, fiecare conflict poartă `dataset: 'branch'|'comun'`. SSE `records-changed` poartă `dataset`; `usePersonal`/`usePool` reîncarcă doar pe dataset-ul lor.
- **Bug real prins înainte de commit, nu doar raportat:** scriitorul brut al motorului „comun" folosea inițial `createKindRepository` (care își deschide singur `BEGIN IMMEDIATE` la fiecare `save`/`remove`) — motorul de sync înfășoară deja tot lotul într-o tranzacție proprie, deci al doilea `BEGIN` arunca „cannot start a transaction within a transaction" la primul kind sincronizat. Fix: `createRecordRepository` (fără tranzacție proprie, exact tiparul deja folosit de motorul unei filiale) ca `rawRecordRepository`; aceeași corecție în `writeCommonSnapshot` (`snapshot-io.mjs`), trecută pe `kinds.transaction(...)` în loc de un `BEGIN` manual din jur.
- Cele 3 teste cerute explicit (integrare reală, 2 instanțe de aplicație + `sync-server` real, fără mock-uri) — toate PASS: `'setul comun se urcă de pe primul calculator și se contopește de pe al doilea fără 409'`, `'motorul setului comun rulează în paralel cu cel al filialei și supraviețuiește schimbării filialei'`, `'o modificare de personal făcută dincolo reîncarcă echipa aici'` (`src/features/sync/server/common-dataset.integration.test.mjs`).
- **Lăsat deliberat în afara scopului, semnalat, nerezolvat:**
  - `candidates` (al 9-lea kind din `personal-schema.mjs`) **nu** e în cele 8 sincronizate — orchestratorul a limitat explicit scopul la cele 8 din „Changes to the sync plan”. `24-personal.md` (linia despre `candidates`) spune totuși „sincronizat ca restul” — listele „aceeași pe ambele filiale” ale unui singur calculator tot funcționează (`comun` e un singur fișier, indiferent de filiala activă), dar între **calculatoare** diferite, candidații nu se contopesc încă. De reluat separat, dacă e cerut.
  - Reconcilierea de filiale (`sync-connect.service.mjs`, deja existentă dinainte de Task 12) înlocuiește id-ul unei filiale locale GOALE (fără copii/grupe) cu cel al unei filiale de pe server, dar **nu** remapează `staff.branchIds`/`timesheet`/etc. din `comun` care încă țin minte id-ul vechi — un angajat creat pe o filială goală, înainte de primul connect, ar rămâne „orfan" (branchId inexistent) după adopție. Nu e cauzat de Task 12 (id-urile de filială sunt gestionate în altă parte), dar Task 12 e primul loc unde `comun` și reconcilierea de filiale se ating direct — semnalat, nu reparat (schimbare de comportament al reconcilierii, risc de regresie prea mare ca să fie ghicit în această bucată).
  - `docs/arhitectura/README.md` — verificat, nu are nicio secțiune despre `Filiale\`/`Comun\`/sincronizare (document de dinainte de Faza 6, despre granițele de import); n-am adăugat un paragraf izolat, inconsistent cu restul documentului. `scripts/pachet-client/GHID-LIVRARE.md` — verificat, descrie încă exclusiv `%LOCALAPPDATA%\Startica\Startica_Date` (dinainte de `Filiale\`/`Comun\`, nu doar dinainte de sync); actualizarea lui corectă e o bucată separată, mai mare, nu un adaos de Task 12.
  - `docs/design/screens/24-personal.md`/`23-bazin.md`: niciun criteriu din „Criterii de acceptare" nu e despre sincronizare între calculatoare (sunt despre filtrare pe filială, PIN, tipărire, capacitate) — nimic de bifat acolo pentru Task 12; nebifate rămân neverificate de mine (nu fac parte din această bucată).
- `npm run check` (root, 1115 teste, 1113 pass + 2 skip) + `sync-server` (`npm test`, 69/69) + webapp typecheck/test (152 fișiere, 824 teste) verzi.

## 2026-09-29 — „fă tot ce a mai rămas” + audit final + build instalator

Sesiune lungă, autonomă, la cererea directă a utilizatorului. Rezumat, în ordine:

- **Model Copil — Nume/Prenume separate + Date personale (IDNP, adresă).** Aditiv, pe tiparul `ChildNote`: `name` rămâne sursa unică (recalculat doar când ambele `firstName`+`lastName` sunt completate), IDNP validat 13 cifre, opțional. Commit `0782190`.
- **Audit complet** (`docs/superpowers/specs/2026-09-29-code-audit.md`, model fable): 2 critice + 8 majore + 10 minore în Bazin, sincronizare (Task 9-12) și migrarea `Child.notes`. Toate reparate în loturi disjuncte, fiecare verificat personal (diff + `npm run check` + webapp typecheck/test) înainte de merge: C-1 (înscrierea din vizită eșua mereu — `3e916fc`), Lot 5 Bazin server (sărbători/oprire programare/reînchidere salariu/capacitate/filtrare lună — `1383bff`), Lot 6 Bazin webapp (bon 58mm cu total corect, `formatMoney`, cusături — `f39782b`), Lot 7 mărunțișuri (căutare note, ceas migrație, hex rezidual — `462385d`).
- **Sincronizarea setului „comun"** (Task 12, vezi secțiunea de mai sus) — `9241ac1`.
- **Plătitori reținuți** (`payer_aliases`, decizia 25 sept.): kind nou, potrivire cu scor dominant + motivul „Plătitor reținut”, card cu ștergere în fișa copilului, checkbox „Ține minte plătitorul” în Asociere. Commit `0793598` + parity fix sync-server `3986402`.
- **Audit final** (`docs/superpowers/specs/2026-09-29-final-audit.md`, model fable) — a doua verificare, pe tot ce a intrat mai sus, fără recitire umană până atunci: **2 bug-uri critice noi**, ambele în conectarea la sincronizare, niciunul prins de testele existente (niciun test nu edita o fișă existentă *după* connect pe calculatorul care a urcat-o):
  - **S-1**: calculatorul care își urcă evidența nu primea `sync_state` local — prima editare a oricărei fișe/grupe/categorii/vizite **existente** devenea conflict cu el însuși. Pre-existent din Task 11 (28.09), scăpase ambelor audituri anterioare.
  - **S-2**: la conectarea celui de-al doilea calculator, setul comun **diverge** în loc să se contopească — semințele deterministe (`departments`/`roles`, reseminate la fiecare pornire) fac ca acest drum să fie **mereu** luat pe o instalare reală, nu un caz-limită. Reprodus cu date reale: A redenumește un departament, B (instalare nouă) se conectează → server/A/B ajung cu trei valori diferite, fără niciun conflict afișat, fără auto-reparare.
  - Plus 3 majore reale: **S-3** (reparația de azi a reconectării, B-4, se anula singură — deconectarea ștergea exact dovada de care reconectarea la același server avea nevoie, → 409 definitiv), **S-4** (`candidates` lipsea din setul sincronizat și era șters de o resincronizare 410), **S-5** (adoptarea unei filiale goale nu remapa `staff.branchIds`/`salary_payments.branchId` din comun — angajați orfani).
  - Toate 5 reparate, fiecare cu test de integrare pe server real reproducând scenariul exact din audit, verificate personal linie cu linie înainte de merge. Commit-uri `57c7ad2` (S-1+S-7), `3addd33` (S-2/S-3/S-5), `286ab6b` (S-4).
  - 3 bug-uri minore la plătitori reținuți (potrivire/deduplicare cu normalizări diferite, ștergere cu id invalid → 500) reparate direct, fără crew — `2bba3dd`.
  - S-6 (ordine de livrare sync-server vs. instalator) — nu e bug de cod, e disciplină de desfășurare: notă adăugată în `GHID-LIVRARE.md` — `c4ac445`.
- **Verificare finală, pe `master-v2` integrat** (nu doar pe worktree-uri separate): `npm run check` (root) 1163/1165 pass, `sync-server` 69/69, webapp typecheck curat + 848/848 teste, `npm run test:e2e` (browser smoke + ciclu de viață lansator) exit 0.
- **Rămas neadresat, semnalat explicit, nu blocant pentru livrare locală** (fără sincronizare activă): `candidates` tot nu se contopește între calculatoare (doar sincronizat acum ca kind, per S-4 — merge-ul lui la connect urmează aceeași regulă ca restul comun-ului, nu e un gol separat); S-8 (scrierile din Personal/Bazin-salarii ajung la sincronizare abia la polling-ul de 15s, nu imediat ca la o filială); S-9 (rezolvarea unui conflict `staff` cu „varianta de pe alt calculator” nu notifică ecranul Personal deschis, cere reîncărcare manuală).

## 2026-09-29 — Build final + hash instalator (după audit + push)

- `npm run check:full` echivalent (root + webapp + `npm run test:e2e`, toate rulate separat mai sus, toate verzi) apoi `scripts\pachet-client\build-client-package.ps1` din HEAD `b84d7df` (tot ce e în secțiunea de mai sus, integrat, pushat).
- `Livrare\Startica_Setup_2.0.0.exe` — 22.73 MB.
- **SHA-256:** `9CE14082A31C43EC7C3062B549750452C8F15B3252199429C21F97906A05B6CE` (verificat independent cu `certutil -hashfile`, identic cu ce a raportat scriptul de build).
- Instalerele vechi mutate, nu șterse: `Startica_Setup_2.0.0.exe.prev-feabc05` (build-ul de dinainte de sesiunea de azi), `.prev-4a9633d`, `.stale-20260928`.
- `master-v2` pushat pe `origin` (`e94c7e3..b84d7df`, 20 commit-uri).

## 2026-09-29 — ALINIERE-DESIGN.md — B1 (bug „Altele” la plățile mixte) — DONE

- **Blocaj inițial:** pachetul `Startica V2/actualizare-docs-design/` (menționat în ALINIERE-DESIGN.md, secțiunea „Înainte de început”) e gol pe disc. `Copii.dc.html` și `Grupe.dc.html` erau deja actualizate (verificat conținut, nu doar dată); `Dashboard.dc.html`, `Formulare.dc.html`, `Prezenta.dc.html` **nu** au primit actualizarea descrisă (verificat: Prezenta.dc.html #18a încă are cele 4 carduri mari, nu contoarele compacte cerute). Nu pot compara vizual A2/A3b/A3c/A3e/A8-Dashboard cu artboard-ul corect până nu apar fișierele reale — semnalat mai jos ca blocaj separat pentru acele puncte. B1 nu depinde de ele (e logică, nu UI), așa că a putut fi lucrat imediat, ca în plan.
- **Pasul 1 — diagnostic (doar citire):** `scripts/diagnostic/b1-payment-methods.mjs`, rulat pe `Startica_Date/startica.db`. Rezultat: 811 plăți, **7** cu tender în afara Cash/Card/Transfer (3× „Mixtă”, 4× „De verificat”), niciuna cu câmpuri brute de sumă-pe-metodă. Pus în `INTREBARI.md` cu tabelul complet, înainte de orice altă modificare.
- **Pasul 2 — `normalizeTenderMethod()`** în `src/shared/domain/payment-allocations.mjs`: alias-uri fără diacritice/case (numerar→Cash, card bancar/pos→Card, virament/transfer bancar→Transfer), aplicată automat în `paymentTenders()` — toți consumatorii (Achitări, Dashboard, Raport contabil, bonul zilei) văd metoda deja curățată, fără să-i ating pe cei nenumiți explicit în plan.
- **Pasul 3 — cele 7 plăți vechi:** nicio migrare automată posibilă (fără sursă de adevăr pe metodă) — intră în „De rezolvat” (`record-issues.mjs`) cu motivul „Plată mixtă: împarte suma pe Cash / Card / Transfer”, rezolvabile manual din formularul achitării (pasul 7).
- **Pasul 4 — „Altele” scos complet:** `record-list-summary.mjs`, `usePayments.ts`/`PaymentsTable.tsx`, `DayClosingReceipt.tsx` + `useDayClosingReceipt.ts`. O metodă necunoscută nu mai intră în niciun total afișat (nu dispare din „Total filtrat”, care se calculează separat, direct din sumele plăților — vezi discuția cu utilizatorul).
- **Pasul 4b — validare la salvare** (`record-schema.mjs`): un `tender.method` care nu normalizează la Cash/Card/Transfer e acum respins cu eroare explicită — nu se mai poate crea o nouă plată cu metodă necunoscută.
- **Pasul 5** — `tenderMethodsFor()` (`payment-form.ts`) nu mai oferă în SegmentedControl o metodă din afara celor 3.
- **Pasul 6** — `findDuplicatePayment` compară acum semnătura tenders-urilor normalizate (metodă+sumă, fără ordine), nu textul brut `method` (fragil la „Cash + Card” vs. „Card + Cash”).
- **Pasul 7** — `PaymentFormDrawer.tsx`: link „Împarte pe metode” sub Sumă deschide 3 rânduri Cash/Card/Transfer editabile simultan (cu total afișat), pentru o plată chiar mixtă; SegmentedControl-ul „Metodă” dispare cât timp e deschis (nu mai are sens cu mai multe metode active deodată); la editarea unei plăți deja mixte pornește direct despărțit.
- **Teste:** actualizate 4 teste care încă așteptau „Altele” (`record-list-summary.test.mjs`, `usePayments.test.ts`, `payment-form.test.ts` ×2) + adăugate 6 teste noi (normalizare, validare la salvare, duplicat independent de ordine, split UI în `PaymentsPage.test.tsx`). `npm run check` (root, 1166/1168, 2 skip) + webapp typecheck + 850/850 teste + build — toate verzi.
- **Neatins intenționat** (nu era în lista explicită a lui B1): `cash-summary.mjs` (Dashboard) și `accounting-report.mjs` (Raport contabil) mai au propriul fallback „Altele” — beneficiază deja de normalizare (pasul 2) fără nicio schimbare de cod, iar singurele 7 plăți care ar mai putea ajunge acolo sunt exact cele semnalate în De rezolvat.

## 2026-09-29 — ALINIERE-DESIGN.md — A1 (Drawer comun) — DONE

- Verificat întâi codul: padding-urile (`.header` 24/30, `.body` 22/30, `.footer` 18/30) și liniile (`border-bottom`/`border-top`) erau deja corecte (din commit-urile de dinainte de b84d7df). Singurul lucru care lipsea: `.footer` nu avea `display:flex; align-items:center; gap:10px` — consumatorii cu 2+ butoane (`BookingDrawer`) le pasează ca fragment direct în footer, fără propriul wrapper flex, deci se bazau pe layout-ul implicit al `<button>` (inline-block), fără gap controlat.
- Fix: adăugat `display:flex; align-items:center; gap:10px` pe `.footer` în `Drawer.module.css`. Fără alte schimbări — restul era deja aliniat.
- `npm run check` (root) neafectat (CSS pur webapp); webapp typecheck + 850/850 teste verzi.

## 2026-09-29 — screens/28-fisa-copilului-date.md — fundația de schemă pentru A2/A3 — parțial (vezi INTREBARI.md)

- Citit spec 28 complet: cere kind-uri separate `child_notes`/`child_documents` + `payer_aliases.iban`/`nameKey`, cu plan tehnic propriu în `docs/superpowers/plans/` înainte de cod (ca la EUR/BNM, filiale) — prea mare pentru acest punct din coadă (blob storage server + sync propriu + migrare testată pe 2 calculatoare).
- Implementat direct, pe `Child` (fără kind nou, fără plan separat — schimbare aditivă, mică, ca `idnp`/`address` mai devreme): `parentRelation`, `parent2Relation`, `pickupPersons` (`PickupPerson[]`, ≤10). `ChildNote` extins cu `author`/`updatedAt`/`deletedAt` — simplificare deliberată fără kind separat, risc de conflict pe fișă acceptat (detaliat în `INTREBARI.md`).
- `record-schema.mjs`: validare completă (nume obligatoriu la persoana autorizată, ≤10, id unic; notă acceptă autor/dată editare/ștergere soft). Teste noi (6) + `npm run check` (root, 1169/1171 + 2 skip) verde.
- **Amânat, are nevoie de plan tehnic propriu:** `child_documents` (A9 rămâne placeholder), `payer_aliases.iban`/`nameKey` (cardul „Plătitori reținuți” din A3 nu poate arăta IBAN mascat până atunci).
- Următorul pas: A2 (`ChildFormDrawer.tsx`) și A3 (`ChildProfileView.tsx`) pot folosi acum `parentRelation`/`pickupPersons`/notele extinse.

## 2026-09-29 — ALINIERE-DESIGN.md — A3c (Prezența · Ziua) — DONE

- Referință vizuală (`Prezenta.dc.html#18a`) e stale (pachetul sursă gol pe disc, vezi blocajul de la B1) — lucrat direct din prosa detaliată din ALINIERE-DESIGN.md.
- **Bandă compactă:** cele 4 carduri mari (`Prezenți`/`Absenți`/`Motivați`/`Nemarcați`) devin un singur card alb cu 4 contoare pe un rând (punct+cifră+etichetă, separate prin `border-right`) + `% prezenți azi` în dreapta + bară de progres proporțională pe rândul 2.
- **Chenar colorat per grupă:** fiecare secțiune de grupă (`.section`) primește fundal `-soft` și bordură `-frame` în tonul grupei — 8 tonuri noi în `tokens.css` (`--orange-frame` … `--coral-frame`, galbenul refolosește `--yellow-border` existent). Numele grupei și butonul „Nemarcații → prezenți” trec în `-ink`-ul tonului.
- **Bug latent găsit și reparat pe drum:** `DayView.module.css`/`ChildTile.tsx` aveau clase de avatar doar pentru 4 din cele 8 tonuri posibile (`orange/mint/yellow/pink/neutral`) — copiii din grupe `teal/blue/purple/coral` primeau avatar necolorat. Adăugate cele 4 clase lipsă.
- **Anulare/istoric (cerut explicit, nu era în cod deloc):** `useAttendanceDay.ts` ține acum un istoric de acțiuni (fiecare cu starea *anterioară* per copil, capturată înainte de mutație) — control „↶ Anulează | N ▾” în antet (`AttendanceUndoControl.tsx`), Ctrl+Z/Cmd+Z, popover cu istoricul complet + „anulează până aici” (anulare cascadată), toast cu buton de anulare pentru acțiunile de grup (`markGroupPresent`/`markAllUnmarcați`). Anularea e o mutație normală prin `attendance.mark()` (vizibilă în sincronizare/Istoric), nu un revert local.
- **Bug de closure învechit găsit în timpul lucrului:** toast-ul de anulare pentru acțiuni de grup captura inițial `() => undoUntil(id)`, care citea un `history` închis la randare — nu conținea încă intrarea proaspăt creată (stare async). Efectul: butonul de anulare din toast nu făcea nimic vizibil. Fix: capturarea directă a obiectului `HistoryEntry` + `applyRestore([entry])` + `setHistory` funcțional, imun la timing.
- Verificare: `npm run check` (root) + webapp typecheck + 855/855 teste (28 în attendance, 5 noi pentru A3c) — toate verzi.

## 2026-09-29 — ALINIERE-DESIGN.md — A3e (Prezența · Luna) — DONE (parțial: fără anulare/istoric)

- **Restructurare grid pe rânduri:** `MonthView.tsx`/`.module.css` foloseau un singur CSS Grid plat cu padding pe fiecare din cele 30+ celule individuale (antet, nume, zi, total, subsol) — exact anti-patternul semnalat în spec, care strică lățimile coloanelor. Rescris ca un `div` grid separat per rând (`.headRow`/`.dataRow`/`.footRow`), toate cu același `gridTemplateColumns`, cu padding și `border-bottom` o singură dată per rând.
- **Detalii vizuale din spec:** antet zile fără uppercase/letter-spacing (doar „COPIL”/„ZILE” rămân uppercase 11px); ziua curentă are o pastilă portocalie doar pe număr (`.todayPill`), nu pe toată celula; puncte de stare 14px (deja mărimea implicită din `AttendanceDot`); card cu `border-radius:22px`; gap 18px între bara de filtre și card; notă lipsă adăugată sub card („Zilele de weekend… Zilele viitoare rămân goale.”).
- **Culoare „motivat” ajustată:** spec cere `#e0b400` pentru punctul de motivat din grilă — `AttendanceDot.module.css` folosea `--yellow` (`#f9d257`, prea deschis pe alb); schimbat la `--yellow-bar` (`#d9a400`, token existent, deja folosit pentru aceeași stare în bara de progres din 18a). Afectează și linia de puncte din fișa copilului (același component), intenționat — aceeași stare, aceeași culoare peste tot.
- **Neimplementat, notat explicit:** „Anulare/istoric: ca în A3c” pentru grila lunii. `useAttendanceMonth.ts` nu are deloc mecanismul de istoric al lui A3c, iar clic-urile de-a lungul unei luni întregi (copil × zi, nu doar ziua curentă) ar cere o adaptare non-trivială a structurii `HistoryEntry`/`applyRestore` (state per dată, nu doar per copil). Dat volumul mare rămas în coadă (A3d/A3f/A4-A9), am tratat asta ca punct separat de urmărit, nu ca blocaj pentru restul restilizării A3e — semnalat aici pentru decizie/prioritizare ulterioară.
- Verificare: `npm run check` (root, 1169/1171 + 2 skip) + webapp typecheck + 855/855 teste — toate verzi.

## 2026-09-29 — ALINIERE-DESIGN.md — A2 (Copil nou) — DONE

- Lucrat de un subagent (Sonnet) pe `ChildFormDrawer.tsx`/`.module.css`/`child-form.ts` din `screens/29-copil-nou-diferente.md`, verificat personal (diff citit integral, typecheck + teste rulate de mine, nu doar raportul agentului).
- Găsit și reparat la verificare: „Începe la” nu seta automat și `contractDate` pentru copil nou (câmpul e ascuns în „Copil nou”, dar decizia 29.09 cerea completare automată alături de `feeFrom`/`statusFrom`) — adăugat în `setAttendanceDate()`.
- Restul (4 secțiuni fără chenar, relația părintelui, persoane autorizate, nr. contract, carduri de program mereu vizibile, chip-uri de grupă colorate, secțiunile 5-6 pliate doar la editare) — deja corect din prima, verificat rând cu rând față de spec.
- `npm run check` (root) + webapp typecheck + 855/855 teste — toate verzi.

## 2026-09-29 — ALINIERE-DESIGN.md — A3 (Fișa copilului) — DONE (2 note, vezi mai jos)

- Lucrat de un subagent (Sonnet) pe `ChildProfileView.tsx` + `ChildrenPage.module.css` + `ProfileLayout.module.css` din `ALINIERE-DESIGN.md` A3 + `screens/28-fisa-copilului-date.md §6`, verificat personal.
- Găsit și reparat la verificare: editorul de notă (adăugare și editare) nu avea Ctrl+Enter/Esc cerut explicit în spec (§6) — adăugat `onKeyDown` pe ambele textarea-uri.
- Restul (grid 1fr/1.35fr, cardul unic „Date personale” cu alergii/părinți-cu-relație/persoane-autorizate, note cu autor+editare+ștergere+toast, pătratul de grupă 48/14/20) — corect din prima.
- **Efect secundar asumat, nu o greșeală:** padding-ul nou al `.section` din `ProfileLayout.module.css` (20px 22px, cerut de spec doar pentru cardul „Date personale”) se aplică global tuturor cardurilor cu acest layout — inclusiv fișa angajatului din Personal (A3f, neatins încă altfel). Testele întregului webapp rămân verzi; nu recomand un CSS separat doar pentru un card, dar semnalez aici pentru cazul în care A3f arată diferit de așteptat.
- **Limitare de model de date, nu bug:** rândul „Educator Ala · vârste 2c 5l – 6a 9l” din spec cere ani+luni; `Group` are doar `ageMinYears`/`ageMaxYears` (ani întregi) — rămâne „vârste 2–6 ani”. Ar cere schimbare de schemă, nu doar UI.
- `npm run check` (root) + webapp typecheck + 855/855 teste — toate verzi.

## 2026-09-29 — ALINIERE-DESIGN.md — A3d (Grupe · Carduri) — DONE

- `GroupCardCompact.tsx`/`.module.css`: mâner ⋮⋮ mutat în flux (în `.headRow`, stânga numelui, opacitate .55, era absolut dreapta-sus cu `padding-right` pe nume); meniul ⋯ „Stickere pentru grupă” mutat lângă numărul de ocupare, 24×24 (era absolut, se putea suprapune cu mânerul); bara de ocupare fundal alb plin + radius pill pe umplere (era translucid, umplere fără radius propriu); inelul de drop `--orange` (era `--slate`).
- Fără test dedicat pe componentă — acoperit indirect prin `GroupsPage.test.tsx` (48/48 verzi).
- `npm run check` (root, 1169/1171 + 2 skip) + webapp typecheck + 855/855 teste — toate verzi.

## 2026-09-29 — ALINIERE-DESIGN.md — A3f Personal (23a/23b/23f) — DONE; 23c/23l rămân

- Lucrat de 3 subagenți (Sonnet) în paralel pe fișiere fără suprapunere — Echipa (`TeamView.tsx`/`staffColumns.tsx`), Pontaj (`TimesheetView.tsx`/`timesheet-rules.ts`), Concedii (`LeavesView.tsx`/`LeaveFormDrawer.tsx`/`leave-days.ts`) — verificat personal, rând cu rând față de spec, înainte de commit (nu doar raportul lor).
- **23a Echipa:** căutare+pastile pe același rând, „N angajați · K în concediu azi”, avatar 36px pe tonul departamentului, „Grupa și rolul” devine pastilă în tonul grupei, coloana Azi mutată după Telefon. Limitare cunoscută, nefixabilă fără a schimba `DataTable` (shared, folosit peste tot): randează `<table>`, nu poate reproduce exact lățimile de coloană px/fr din spec.
- **23b Pontaj:** legendă deasupra tabelului, celule-pastilă unificate (nu mai e celulă colorată + pastilă suprapusă), coloană CM la totaluri (lipsea), zilele viitoare acceptă acum concediu planificat (ciclu gol→CO→CM→gol, fără A) — o zi viitoare marcată intră în totalul lunii.
- **23f Concedii:** bare pe zile (nu pe luni) — funcție nouă `leaveYearBar()` cu poziționare proporțională pe ziua din an, gestionează anul bisect și un concediu peste 31 decembrie (teste dedicate pentru ambele). Clic pe bară deschide acum editare + Șterge (`ConfirmDeleteDialog`) — lipsea complet.
- Token nou `--leave-planned`/`--leave-planned-border` (`#f0d77a`/`#b89a00`, exact ca în spec) pentru bara „Planificat”; restul culorilor refolosesc tokeni existenți (`--sand`/`--sand-soft` pentru benzile alternante — se potrivesc exact cu hex-urile din spec; `--yellow-bar` pentru CO, ca la A3c/A3e).
- `npm run check` (root, 1169/1171 + 2 skip) + webapp typecheck + 870/870 teste — toate verzi.
- **Rămân din A3f:** 23c Salarii (antet cu stepper/Blochează/Plătește, carduri, tabel, cele 5 verificări de logică — verificările sunt deja făcute și în `INTREBARI.md`, mai rămâne restilizarea UI) și 23l Candidați (verificări mici).

## 2026-09-29 — ALINIERE-DESIGN.md — A3f Personal (23c Salarii) — DONE; 23l rămâne

- **23c Salarii:** carduri `Card` cu `tone`/`decorative` (Total salarii roz-decorativ, Avansuri date neutru, Plătit mint, Rămas de plătit alb cu bordură groasă); tabel cu coloane Cum se calculează (pastilă Fix/Pe zile/Bazin) / Baza lunii / Stare; clic pe rând deschide istoricul angajatului (înainte doar din meniul ⋯); „Plătește” deschide un dialog de confirmare cu totalul selectat înainte să trimită plata (înainte plătea direct); luna urcă în `PersonalPage` cu `MonthStepper` în antet, plafonat la luna trecută (o lună neîncheiată nu se poate plăti).
- **Gol real găsit la una din cele 5 verificări de logică (checked #5, deja în `INTREBARI.md`):** un angajat fără salariu setat dispărea complet din listă (`rowForStaff` întorcea `null`, filtrat în `listMonth`). Fixat: rândul apare oricum, cu `mode: null`, „Baza lunii” arată „+ Setează salariul” (nebifabil) — test nou pe backend (`salaries.service.test.mjs`, 19/19) + pe UI (`SalariesView.test.tsx`).
- **Decizie de scop, notată aici ca simplificare deliberată:** „Blochează” și „Plătește N selectați” rămân în corpul paginii, nu migrate în antetul comun. `PinGate` are deja propriul buton „Blochează” inline; mutarea „Plătește” în antet ar cere fie duplicarea stării de selecție în `PersonalPage`, fie un pattern nou de ref/callback către `useTopbarActions` — codul actual are o regulă tare de un singur punct de apel per filă (ordinea efectelor copil→părinte), fără niciun precedent de al doilea pattern. Cost/beneficiu nu a meritat riscul pentru un buton.
- `npm run check` (root, 1171/1173 + 2 skip) + webapp typecheck + 873/873 teste — toate verzi. Commit `a4927ec`.
- **Rămâne din A3f:** 23l Candidați (verificări mici — căutare 360px, avatar 30px cu inițiale, telefon bold tabular-nums, notițe pe un rând cu ellipsis/„—", drawer 480px).

## 2026-09-29 — ALINIERE-DESIGN.md — A3f Personal (23l Candidați) — A3f COMPLET

- **23l Candidați:** restul filei era deja corect din 0.8 (avatar 30 cu inițiale, telefon bold tabular-nums, notițe ellipsis + „—", drawer 480px cu Poziție+Vârstă / Unde locuiește+Telefon pe rânduri). Singura diferență: căutarea era `flex:1` (ca la Copii), spec cere 360px fix — `ListToolbarSearch` capătă un `className` opțional, forwardat la `SearchInput` (componentă shared, rămâne generică).
- `npm run check` (root, 1171/1173 + 2 skip) + webapp typecheck + 873/873 teste — toate verzi. Commit `b80b8d9`.
- **A3f Personal — COMPLET** (23a, 23b, 23c, 23f, 23l — toate restilizate/verificate față de spec). Urmează A4 Bazin.

## 2026-09-29 — ALINIERE-DESIGN.md — A4 Bazin — DONE

- Codul Bazin (`WeekView`/`BookingDrawer`/`MonthView`/`PoolPage`) era deja foarte aproape de spec — carduri, legendă, sloturile de oră din „Programare nouă”, grid-ul Lunii, cardul antrenorului: toate deja identice cu `Bazin.dc.html`. Doar 2 goluri reale, ambele mici:
- **22a:** lipsea rândul „Antrenor: <nume>” de sub carduri (stânga, legenda dreapta) — `WeekView` primește acum `coaches` de la `PoolPage`. Decizie provizorie pentru mai mulți antrenori (spec arată un singur nume în mockup): uniți prin virgulă, notat în `INTREBARI.md`.
- **22c:** cardurile de statistici din Luna aveau padding 16/20 + radius implicit 24; spec cere 14/18 + radius 18 — corectat.
- 22b (Programare nouă) și restul lui 22c erau deja identice cu spec-ul, neschimbate.
- `npm run check` (root, 1171/1173 + 2 skip) + webapp typecheck + 874/874 teste — toate verzi. Commit `7c3246e`.
- Urmează A5 (De notificat).

## 2026-09-29 — ALINIERE-DESIGN.md — A5 De notificat — DONE

- Layout pe 2 coloane (coadă + previzualizare mesaj) era deja construit — nu tabelul vechi cu 11 coloane/4 carduri descris ca „de dispărut” în spec, deci acea parte era deja făcută.
- Fixat: avatar părinte 40px în ton (era 30, `PersonCell` nu are variantă de 40 — celulă proprie în rând, ca la Echipa 23a); gap conținut 16px (era 18); radius carduri 22 (era 24, implicit din `Card`).
- Neschimbat, deliberat: pastilele „SMS conectat” / „Trimite tuturor” rămân așa, nu „Telegram conectat” / „Trimite toate” din spec — pivotul de arhitectură (sms.md în loc de Telegram) e deja făcut și documentat (roadmap 2026-09-26), nu o abatere de restilizat.
- `npm run check` (root, 1171/1173 + 2 skip) + webapp typecheck + 874/874 teste — toate verzi. Commit `630b993`.
- Urmează A6 (Asociere achitări).

## 2026-09-29 — ALINIERE-DESIGN.md rescris de utilizator (sync 17:13) — reordonare coadă

Coada rămasă s-a schimbat: `A3c-fix → A3e-undo → B1-rest → A3b → B3 → B2 → A6 → A7 → A8 → A9` (A6 nu mai e următorul). Semnalat conflict: o altă sesiune/echipă (worktree separat) redă în paralel muncă deja făcută și împinsă aici (23a/23b/23f Personal, A2/A3 Copii) — nu am atins acea sesiune, doar am confirmat cu `git status` că nu-mi afectează directorul de lucru.

## 2026-09-29 — B1-rest — DONE

Ultimele 2 locuri cu fallback „Altele" pe metodă de plată (Dashboard `cash-summary.mjs`, Raport contabil `accounting-report.mjs`) — o metodă nerezolvată nu mai intră în niciun total, rămâne doar în De rezolvat. `npm run check` (1170/1172 + 2 skip) verde. Commit `a8549de`.

## 2026-09-29 — A3c-fix — DONE

Scos complet marcarea în masă din Prezența · Ziua: `markGroupPresent`/`markAllUnmarkedPresent`, butoanele „Nemarcații (N) → prezenți" (antet + per-secțiune), toastul de acțiune în masă, `changesToMarkUnmarkedPresent` (domain) + cele 4 teste ale lor. Undo/istoric rămâne (era deja implementat complet — `AttendanceUndoControl`, Ctrl+Z, stivă de `HistoryEntry`); corectat un bug latent găsit pe drum: eticheta „Anulează” vs „Anulează până aici” pe rândurile din istoric era legată de flag-ul `bulk` (mereu fals acum) în loc de poziția rândului — orice rând care nu e cel mai recent desface și tot ce a venit după el, indiferent dacă acțiunea a fost vreodată „bulk”. `npm run check` (1170/1172 + 2 skip) + webapp 871/871 — verzi. Commit `6740fa4`.

Urmează A3e-undo (Anulează/istoric în Prezența · Luna).

## 2026-09-29 — A3e-undo — DONE

Prezența · Luna nu avea deloc mecanismul anulabil din Ziua. Adăugat în `useAttendanceMonth.ts`: `HistoryEntry` ține `(childId, date)` per celulă (nu doar `childId`, ca în Ziua — aceeași grilă schimbă mai multe zile deodată), restul (undoLast/undoUntil/undoAll, reset la schimbarea lunii) identic ca mecanică cu Ziua. `AttendanceUndoControl` (deja generic) refolosit neschimbat în antetul modului Luna; Ctrl+Z merge acum pe fila activă (Ziua sau Luna). Nota de sub grilă („Zilele de weekend...") era deja în cod, nimic de schimbat acolo. `npm run check` (1170/1172 + 2 skip) + webapp 873/873 — verzi. Commit `f853909`.

Urmează A3b (Achitare nouă, 15b).

## De discutat cu utilizatorul
- **Sincronizare 14b/14c** — rezolvat: motorul a fost reparat (auditul final de mai sus, S-1..S-5), UI-ul (Task 9-12) era deja construit peste el; nu mai e o alegere de făcut.
