# 06 — Cheltuieli (Tabel / Pe zile) — val 2, pe design system

**Referință:** `docs/design/screens/06-cheltuieli.md`, `Cheltuieli.dc.html#6a/#6b`.

## Stare la intrare în val 2

Modulul era deja pe `DataTable`, `FilterPills` (Categorie/Metodă), `SelectionBar`, `MonthStepper`, `SegmentedControl`, `ConfirmDeleteDialog` — criteriile de acceptare din spec (fără dropdown Categorie, fără segmented de metodă, FilterPills în loc) erau deja îndeplinite. Rămăseseră: un dropdown „Nearhivate ▾” construit manual (`<details>`/`<summary>` + `<button role="menuitemradio">`), un grup de pastile de categorie cu `<button>` brut + un hack CSS var (`--chip-color`) în formular, un chip-select la fel brut în „Adaugă rapid” (Pe zile), un text de stare goală hardcodat pentru „Nicio categorie” și câteva `border-radius` px.

## Ce s-a schimbat în această trecere

- **`ExpensesFilters.tsx` — dropdown-ul „Nearhivate ▾”**: `<details>`/`<summary>` + `<button role="menuitemradio">` brute → `Button variant="outline"` (declanșator) + `Popover` (panou, cu închidere la clic-în-afară/Escape „gratis”, pe care implementarea veche nu o avea) + `Button variant="ghost"` per opțiune, păstrând `role="menuitemradio"`/`aria-checked`. Poziția/lățimea panoului (ancorat dreapta, 160px) suprascrie implicitul din `Popover` cu selector dublat (`.archiveDropdownPanel.archiveDropdownPanel`), convenția deja folosită în același fișier (`.btnGhostSmall.btnGhostSmall`) pentru specificitate deterministă între module CSS diferite.
- **`ExpenseFormDrawer.tsx` — pastilele de categorie din formular**: grup de `<button role="radio">` brute + `style={{'--chip-color': color}}` → `FilterPills` (un singur grup, fără etichetă vizibilă, opțiuni cu `tone` din `categoryStyleFor`) — exact componenta deja folosită pentru același câmp „Categorie” în toolbar-ul paginii, acum reutilizată și în formular. Bara `FilterPills` își pierde bordura/padding-ul implicit (`.categoryChips`), ca la `TeamView`/`PaymentDetailPanel`.
- **`DailyExpensesView.tsx` — chip-urile de categorie din „Adaugă rapid”**: `<button>` brut (o singură culoare, fără tonuri) → `ChipSelect` (grup de alegere unică, deja existent în `@shared/ui`, fără nicio schimbare de API).
- **`ExpensesCategoryManager.tsx`**: textul „Nicio categorie adăugată încă — se folosesc doar sugestiile implicite.” → `EmptyState size="compact"` cu cheia de catalog `cheltuieli.categories` (fără `action` — formularul „+ Adaugă” de dedesubt e deja mereu vizibil, un al doilea CTA ar fi dublură).
- **`ExpensesPage.module.css`**: `border-radius` px (3, 2, 24, 12) → tokeni (`--radius-5` ×2, `--radius-xl`, `--radius-input`); CSS mort șters (`.categoryChip`, `.categoryChip[data-selected]`, `.quickAddChips`, `.quickAddChip`, `.quickAddChipActive`, vechiul `.archiveDropdown summary`/`.archiveDropdownPanel button`).
- **`ExpensesPage.test.tsx`**: cele două clicuri pe `screen.getByText('Nearhivate', {selector:'summary'})` → `screen.getByRole('button', {name: /Nearhivate/})` (elementul nu mai e un `<summary>`).

## Ce a rămas neschimbat, cu motiv

Nimic — nu a fost nevoie de nicio excepție nouă în `architecture.test.ts` pentru acest modul; toate fișierele `expenses/*` au ieșit complet curate din R1/R2/R7/R9.

## Testul de regresie financiară (cerut de PROMPT-CLAUDE-CODE-5.md §2)

Nicio schimbare din această trecere nu a atins `useExpenses.ts` (calculul `monthTotal`/`categorySummary`/filtrele) — doar `ExpensesFilters.tsx`/`ExpenseFormDrawer.tsx`/`DailyExpensesView.tsx`/`ExpensesCategoryManager.tsx` (prezentare). `useExpenses.test.ts` fixează deja `monthTotal` (`toBe(4450)`, `3000 + 450 + 1000`) și `categorySummary` pe o fixtură fixă, rămas verde neschimbat — dovada că totalurile sunt identice înainte/după migrare.

## Verificare

- `npx tsc --noEmit -p .` — verde.
- `npx vitest run src/features/expenses src/architecture.test.ts` — 3/3 fișiere, 50/50 teste.
- `npx vitest run` (webapp, complet) — verde.
- `npm run check` (root) — verde, 1196/1198 (2 skip preexistente, nelegate de Cheltuieli).
- `architecture.test.ts`: scoase din excepții — R1 `expenses/DailyExpensesView.tsx`, `expenses/ExpenseFormDrawer.tsx`, `expenses/ExpensesFilters.tsx` (toate trei complet curate acum); R2 `expenses/ExpensesPage.module.css`. R9 `expenses/ExpensesCategoryManager.tsx` mutat din `TEXT_ALLOWED` în `IMPORT_ALLOWED` (import nou, legitim, al `EmptyState`).

**Captură 1440×900 vs. artboard:** efectuată 01.10 — `06-cheltuieli.png` (stânga artboard, dreapta aplicația reală, pe copie izolată de date — §3). Diferențe vizuale: doar date de test; dropdown-ul „Nearhivate” și pastilele de categorie colorate din formular corespund artboard-ului.
