# 11 — De rezolvat · 9a Taxe și grupe — val 2, pe design system

**Referință:** `docs/design/screens/11-de-rezolvat.md` §9a, `De rezolvat.dc.html#9a`.

## Stare la intrare în val 2

Modulul era deja pe `DataTable`, `SelectionBar`, `SegmentedControl`, `Select`, `NumberInput`, `Button`, `RowMenu`, `Badge`, `EmptyState` — nu exista niciun tag brut (`<input>/<select>/<button>/<table>`) în `FeeSetupPage.tsx`, deci fișierul nu era pe lista R1. Rămăseseră trei lucruri: `border-radius: 18px` pe caseta notei explicative (spec-ul 9a cere explicit „radius 16”), un titlu de `EmptyState` cu textul „Niciun copil” (R9, „no-results” pe căutare fără rezultate) și două intrări în `architecture.test.ts` (R2/R9) devenite inutile — verificat cu grep, fișierul n-a avut niciodată `.toFixed`/`.toLocaleString` în forma curentă, deci R7 nu avea nici el o intrare reală de scos.

## Ce s-a schimbat în această trecere

- **`FeeSetupPage.module.css`**: `.notice { border-radius: 18px }` → `var(--radius-md-lg)` (16px) — corectează atât R2 (px literal), cât și acuratețea față de spec (9a: „casetă `--yellow-soft`, radius 16”).
- **`FeeSetupPage.tsx`**: titlul `EmptyState variant="no-results"` de pe căutare fără rezultate, „Niciun copil” → „Nimeni nu se potrivește căutării.” — același text deja folosit în `personal/CandidatesTab.tsx` pentru exact același tip de stare (căutare fără rezultate, intenționat în afara catalogului `empty-states.ts`, cf. header-ul fișierului). Comportamentul (`activeFilters`, `onClearFilters`) rămâne neschimbat.
- **`architecture.test.ts`**: scos `fee-setup/FeeSetupPage.module.css` din R2 `ALLOWED` (fișierul e acum complet curat) și `fee-setup/FeeSetupPage.tsx` din R9 `TEXT_ALLOWED` (singura încălcare era „Niciun copil”, acum reparată). `fee-setup/FeeSetupPage.tsx` rămâne în R9 `IMPORT_ALLOWED` — importul direct al `EmptyState` e legitim (pagina nu folosește `empty` prop pe `DataTable`, are propriile două stări „done”/„no-results”) și nu s-a schimbat.

## Ce a rămas neschimbat, cu motiv

- Bara de selecție (`SelectionBar`) aplică în masă Grupă / Taxă / Monedă. Spec-ul 9a scrie „Aplică: Grupă ▾ · Taxă · Scadență · Aplică la N” (scadență, nu monedă), dar `useFeeSetup.ts` (`applyBulkToSelection`, în afara scope-ului acestei treceri) nu suportă azi scrierea în masă a scadenței — doar `fee`/`currency`/`groupId`. Schimbarea câmpurilor bulk ar însemna extinderea hook-ului interzis la atingere, nu doar rearanjare de prezentare — am lăsat comportamentul curent (deja testat) neatins.
- Textul „Totul e completat” / „Toți copiii nearhivați au taxă și grupă.” (starea „done” la filtrul „missing”) a rămas hardcodat, nu mutat pe cheia de catalog `derezolvat.done` — vezi `docs/design/INTREBARI.md` („Taxe și grupe / De verificat — cheia de catalog `derezolvat.done` rămasă nefolosită”) pentru motiv.
- `useFeeSetup.ts` — neatins (vezi mai jos).

## Testul de regresie financiară

Niciuna din schimbările de mai sus n-a atins `useFeeSetup.ts` (calculul `missingCount`/`totalCount`, `isRowChanged`, `applyBulkToSelection`, `save`) — doar `FeeSetupPage.tsx`/`FeeSetupPage.module.css` (prezentare). Confirmat cu `git status`/`git diff` pe `src/features/fee-setup/useFeeSetup.ts`: fără nicio modificare. `useFeeSetup.test.ts` (10 teste, inclusiv „save trimite doar rândurile schimbate” care fixează `fee: 1500` ca număr trimis la `/api/children-setup`) a rămas verde neschimbat — dovada că valorile taxelor și trimiterea lor la salvare sunt identice înainte/după migrare.

## Verificare

- `npx tsc --noEmit -p .` — verde.
- `npx vitest run src/features/fee-setup src/features/review src/architecture.test.ts` — 5/5 fișiere, 35/35 teste.
- `npx vitest run` (webapp, complet) — 249/249 fișiere, 1352/1352 teste, verde.
- `npm run check` (root) — verde (vezi raportul de subagent pentru numărul exact).

**Captură 1440×900 vs. artboard:** neefectuată (motiv identic cu modulele anterioare — evită pornirea backend-ului peste baza de date de producție). Recomandare: spot-check manual la următorul push, cu atenție la radius-ul casetei galbene (16 vs. 18px, diferență vizuală mică dar reală) și la textul „Nimeni nu se potrivește căutării.” când se caută un nume inexistent.
