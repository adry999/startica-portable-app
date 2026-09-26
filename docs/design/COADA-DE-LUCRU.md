# Coada de lucru — 26 septembrie 2026

Consolidează `docs/superpowers/specs/2026-09-26-code-audit.md` (audit fable) + `docs/superpowers/plans/2026-09-26-roadmap-modularizare.md` + `docs/design/URMATORUL-PAS.md` (deja făcut, Faza 3 inițială). Un punct = o unitate de lucru: după fiecare, `npm run check` (+ `cd webapp && npm run typecheck && npm test`), bifează criteriile de acceptare relevante, commit, treci la următorul. Decizie blocată → scrie în `docs/design/INTREBARI.md`, treci la următorul punct care nu depinde de ea.

**Faza 6 (mai multe grădinițe) NU se începe — exclus explicit.**

**Stare 2026-09-26, sfârșit de sesiune:** punctele 1–6 și 9 DONE, comise și pushate pe `master-v2` (`6fbd652`, `2323101`, `9e788ca`, `b434d67`, `05e6367`..`01ce3a4`). Punctul 7 sărit (vezi `INTREBARI.md`). Punctul 8 parțial: backend (domeniu+server) cherry-pick-uit și verde; UI-ul din `webapp/` NU e făcut — vezi nota din §8.

## 1. Faza 1a — șterge feature-urile backend complet moarte
`src/features/{audit-log,backup,dashboard,data-transfer,expenses,groups,record-editing,telegram-notify}/`: șterge `index.web.mjs` + `web/` întreg (nimic din ele e servit sau importat de `webapp/`, verificat). Actualizează `README.md` din fiecare feature (scoate referința la `web/*.controller.mjs`/`*.view.mjs`).

## 2. Faza 1b — curăță index.web.mjs mixte
`src/features/{children,billing,review-center,visits,fee-setup}/index.web.mjs`: șterge exporturile din `web/` (DOM controllers/views), ține doar exporturile de domeniu (astea sunt singurele importate real de `webapp/`). Șterge `web/` din fiecare. Actualizează README-urile.

## 3. Faza 1c — top-level: src/app/web, src/core/web, src/shared/ui, SKILL.md
- Șterge tot `src/app/web/` (15 fișiere rămase după Faza 0) — nimic nu-l importă (`#app/*` nu apare nicăieri în `webapp/src`).
- `src/core/web/`: ține `api-client.mjs`, `app-session-store.mjs`, `domain-event-bus.mjs` (+ testele lor); șterge `api-error.mjs`, `notice-banner.mjs(+.test)`, `view-state.mjs`.
- `src/shared/ui/*.mjs`: ține `copy-to-clipboard.mjs`, `record-list-search.mjs`, `record-list-summary.mjs` (+ testele lor); șterge restul (`bulk-selection`, `chart-tooltip`, `child-picker`, `confirm-twice-button`, `element-lookup`, `form-fields`, `month-calendar`, `nav-count-badge`, `pagination`, `record-actions`, `record-list-sort`, `records-summary`, `table-sort` + testele lor).
- `.claude/skills/project-conventions/SKILL.md`: repară `:26` (branch `redesign/react-vite` → `master-v2`), `:33` (stilurile nu mai sunt în `web/styles/`), `:58` (import map-ul nu mai e din `web/index.html`), `:60` (serverul servește `webapp/dist`, nu whitelist-ul vechi), `:84` (`npm run test:browser` → verifică ce comandă e reală azi).

## 4. Faza 2 — gardă de arhitectură webapp + repară cuplajul găsit
- `webapp/src/architecture.test.ts` nou: un feature nu importă alt feature, un feature nu importă `app/`.
- Mută `useTopbarActions`/`useTopbarTitle` (din `app/shell/TopbarActions.tsx`) și `ViewKey` (din `app/shell/nav-items.ts`) în `shared/` — 9 fișiere de feature le importă azi din `app/shell`, invers față de regulă.
- `ChildrenPage.tsx:23-24` importă direct internele lui `payments` (`PaymentFormDrawer`, `payment-form`) — schimbă la ruta existentă `/achitari/nou?copil=<id>` (deja funcțională, verificat în `App.tsx`).

## 5. Achitări — FilterPills + coloana Plătitor
`payments/PaymentsPage.tsx`: `FilterPills` Metodă (Toate/Cash/Card/Transfer) + Grupă (Toate + grupe cu `groupTone` + Fără grupă), în loc de `SegmentedControl` metodă; adaugă filtrare pe grupă în `usePayments.ts` (child→groupId); coloana **Plătitor** (`payment.sourceName`, fallback `childLabel`); confirmă cardurile Cash/Card/Transfer arată suma reală independent de filtrul activ (deja par corecte în `usePayments.ts`, verifică); șterge filtrul „Copil ▾” (căutarea îl acoperă). **Fără** „Tipărește chitanța” — vezi `INTREBARI.md`.

## 6. Cheltuieli — FilterPills Categorie
`expenses/ExpensesPage.tsx`: `FilterPills` Categorie (Toate + cele 5 din `categoryStyleFor`) în loc de `<select>`; antetul modului „Pe zile” la fel de compact ca „Tabel” (nu H2 mare, dacă există o diferență — verifică). **Fără** filtrul Metodă — vezi `INTREBARI.md` (`Expense` nu are câmp `method`).

## 7. Situația plăților — FilterPills Grupa pe tabelul curent — DONE (2026-09-27)
`status/StatusPage.tsx`/`useStatus.ts`: `groupId`/`groupName` pe `StatusRowView`, `FilterPills` Grupa peste tabel, filtrul restrânge doar tabelul (comentariul vechi „fără filtre" era depășit, rescris). Cele 4 carduri / modul „An școlar” / SMS — planificate acum ca punctul 10 (plan scris, cod neînceput).

## 6b. Cheltuieli — câmpul `method` + FilterPills Metodă — DONE (2026-09-27)
`Expense.method?: 'cash'|'card'|'transfer'`, fără implicit la nivel de schemă (cheltuielile vechi rămân fără metodă la re-salvare), implicit Cash doar în formularul de creare. FilterPills + coloană Metodă.

## 8. Faza 4 — monedă EUR/BNM (după 1–3)
**Backend DONE (2026-09-26).** Cherry-pick-uite 13 commit-uri de domeniu/server/format din `.worktrees/feat-multi-currency-fees` (branch pornit din `master`, nu din `master-v2` — conflicte reale rezolvate în `record-schema.mjs` și `payment-allocations.test.mjs`). `create-application.mjs`/`main.mjs` deja aveau rutele de curs cablate din commit-urile cherry-pick-uite. Două fixup-uri necesare la consumatori neschimbați de branch-ul de monedă: `payment-name-matching.mjs` (indexul de plăți nu mai adună, ci grupează pe monedă+dată) și `useNotify.ts`/`useStatus.ts`/`StatusPage.tsx` din webapp (`obligation.paid` poate fi `null` acum). Tot verde: backend 518/520 (2 sărite cunoscute), webapp 358/358.

**2026-09-27, model final ales** (`docs/design/RASPUNSURI.md`): `feeHistory.currency` rămâne (fără migrare), `Payment.fxRate`/`amountEur` noi (validare, fără calcul la nivel de schemă — calculul se face în webapp). `GET/POST /api/exchange-rates` întorc `{rates, sources}` (mint=BNM/galben=manual); `GET/POST /api/plan-presets` (listă simplă, fără tabel SQL). **Ecranul „Curs valutar" (12a) DONE, verificat live** — fila nouă în Backup și setări, curs azi + corectare + „Revino la BNM" + ultimele 5 zile + presetări de plan.

**Selectorul din `PaymentFormDrawer` (12b) DONE, verificat** — când taxa copilului e EUR: „= X €" live, câmp Curs EUR (BNM/manual per-plată), repartizare în €, submit blocat fără curs. Copiii MDL neschimbați (verificat).

Rămas de construit, în ordinea din spec: `ChildFormDrawer`/`FeeSetupPage` (selector monedă pe taxă, 7g), afișare în € în fișa copilului/Situația/confirmarea de plată (7c-7e), pastila de curs pe Dashboard (7f), variabila SMS `rest_eur`. Worktree-ul vechi (`.worktrees/feat-multi-currency-fees`) are ca referință commit-urile UI de pe stratul vanilla — utile ca ghid de logică, dar scrise pe `web/*.mjs` (șters în Faza 1), deci rescrise, nu portate. Nu șterge worktree-ul până nu se termină tot UI-ul.

## 9. Faza 5 — SMS (sms.md) — spec DONE
`docs/superpowers/specs/2026-09-26-sms-notify-design.md`, aprobat (`RASPUNSURI.md`).

## 9b. SMS P1 — plan DONE (2026-09-27)
`docs/superpowers/plans/2026-09-27-sms-notify-p1.md`, 21 taskuri/6 faze. Cod neînceput — următorul pas e execuția planului (task cu task, TDD, per `superpowers:subagent-driven-development`).

## 10. Situația plăților, ecranul complet — plan DONE (2026-09-27)
`docs/superpowers/plans/2026-09-27-situatia-platilor-complet.md`, 10 taskuri/5 faze (Lună: 4 carduri + toolbar + coloane spec; An școlar: 3 carduri + hartă 12 luni). SMS (Notifică/Notifică toți) rămâne P2, butoane dezactivate — găsit un gol real de arhitectură: `status/` nu poate importa `@features/sms` direct (`architecture.test.ts`), notat în handoff. Cod neînceput.

## 10+ — curățenie mecanică rămasă
**R10 DONE (2026-09-26):** `ChildProfileView`/`ExpenseFormDrawer` extrase în fișiere proprii.
**R6 DONE (2026-09-26):** `ConfirmDeleteDialog` (`shared/ui`, „Scrie ȘTERGE”) în loc de `window.confirm` la cele 6 ștergeri definitive; toast „Anulează” adăugat la arhivarea din Achitări. Găsit în timpul lucrului, nerezolvat (notat, nu blocant): `VisitsPage.tsx`'s `toggleArchived` nu arată niciun toast la succes (nici cu, nici fără undo) — de adăugat separat dacă se dorește.

**R7 DONE (2026-09-27):** `const data = useX()` → `<feature>Data` în 15 ecrane; `any` scos din `useChildren.ts`; 24 fișiere curățate de comentarii care descriau stratul vanilla deja șters; comentariul fals din `static-assets.mjs` reparat. Nu atins: `item`/`r` ca nume de parametru în lambda-uri scurte (`.map(item => ...)`) — sarcină de valoare mică, cost mare (10+ fișiere), lăsată deliberat neatinsă.

Rămân: R9 (rute per feature, scoate `App.tsx` din fișierele fierbinți — arhitectural, nu doar mecanic, vezi nota din sesiune), Button/SearchInput unificate în `shared/ui`.
