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

## 7. Situația plăților — FilterPills Grupa pe tabelul curent
`status/StatusPage.tsx`/`useStatus.ts`: adaugă `groupId`/`groupName` pe `StatusRowView` (join cu `records.children`/`records.groups`), `FilterPills` Grupa (Toate + grupe cu `groupTone` + Fără grupă) peste tabelul existent. **Fără** cele 4 carduri / modul „An școlar” / SMS — ecran nou aproape integral, notat separat, vezi `INTREBARI.md`.

## 8. Faza 4 — monedă EUR/BNM (după 1–3)
**Backend DONE (2026-09-26).** Cherry-pick-uite 13 commit-uri de domeniu/server/format din `.worktrees/feat-multi-currency-fees` (branch pornit din `master`, nu din `master-v2` — conflicte reale rezolvate în `record-schema.mjs` și `payment-allocations.test.mjs`). `create-application.mjs`/`main.mjs` deja aveau rutele de curs cablate din commit-urile cherry-pick-uite. Două fixup-uri necesare la consumatori neschimbați de branch-ul de monedă: `payment-name-matching.mjs` (indexul de plăți nu mai adună, ci grupează pe monedă+dată) și `useNotify.ts`/`useStatus.ts`/`StatusPage.tsx` din webapp (`obligation.paid` poate fi `null` acum). Tot verde: backend 518/520 (2 sărite cunoscute), webapp 358/358.

**UI-ul din `webapp/` NU e făcut — sesiune separată.** Rămâne de construit de la zero, după `docs/design/screens/16-planuri-eur.md`: selector de monedă în `PaymentFormDrawer` (`payments`), `ChildFormDrawer` (`children`), `FeeSetupPage`; afișare în moneda copilului în `status`/`notify`/fișa copilului; conversie pe `dashboard`; ecran nou „Curs valutar” (setări manuale + refresh BNM — rutele server (`GET/POST /api/exchange-rates`, vezi `exchange-rates.routes.mjs`) sunt deja live, doar UI-ul lipsește). Worktree-ul vechi (`.worktrees/feat-multi-currency-fees`) are ca referință commit-urile UI de pe stratul vanilla (`7e4ca98`, `e498fac`, `704309e`, `bf75ac1`, `f97cf33`, `983d492`, `a4456e2`, `dbf3f97`, `c193f51`, `8a08a5a`) — utile ca ghid de logică, dar scrise pe `web/*.mjs` (șters în Faza 1), deci rescrise, nu portate. Nu șterge worktree-ul până nu se termină și UI-ul.

## 9. Faza 5 — SMS (sms.md) — scrie spec înainte de cod
Scrie `docs/superpowers/specs/<data>-sms-notify-design.md` (provider `sms.md`/docs.sms.md, auth, format telefon, șablon după `src/features/telegram-notify/`). Nu scrie cod de feature înainte ca spec-ul să fie citit/aprobat — pune întrebarea în `INTREBARI.md` dacă e nevoie de o decizie a utilizatorului (cost/credit, retry).

## 10+ — curățenie mecanică rămasă
**R10 DONE (2026-09-26):** `ChildProfileView`/`ExpenseFormDrawer` extrase în fișiere proprii.
**R6 DONE (2026-09-26):** `ConfirmDeleteDialog` (`shared/ui`, „Scrie ȘTERGE”) în loc de `window.confirm` la cele 6 ștergeri definitive; toast „Anulează” adăugat la arhivarea din Achitări. Găsit în timpul lucrului, nerezolvat (notat, nu blocant): `VisitsPage.tsx`'s `toggleArchived` nu arată niciun toast la succes (nici cu, nici fără undo) — de adăugat separat dacă se dorește.

Rămân: R7 (comentarii/nume — `const data = useX()` → nume specifice, `item`/`r`/`parts` interzise), R9 (rute per feature, scoate `App.tsx` din fișierele fierbinți — arhitectural, nu doar mecanic, vezi nota din sesiune), Button/SearchInput unificate în `shared/ui`.
