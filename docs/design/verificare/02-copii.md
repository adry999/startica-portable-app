# 02 — Copii (listă, fișă, zile de naștere) — val 2, pe design system

**Referință:** `docs/design/screens/02-copii-lista.md`, `docs/design/screens/09-copii-fisa.md`, `docs/design/screens/01-copii-zile-de-nastere.md`, `Copii.dc.html#2a/#2b/#2c`.

## Stare la intrare în val 2

Listă (`ChildrenPage.tsx` + `ChildrenToolbar.tsx` + `ChildrenSelectionBar.tsx` + `childrenColumns.tsx`) era deja migrată pe `DataTable`, `ListToolbar`, `SegmentedControl`, `FilterPills`, `SelectionBar`, `RowMenu`, `PersonCell`, `Badge`, `Button`, `ConfirmDeleteDialog` — nu a fost nevoie de restructurare de layout, doar de curățarea regulilor mecanice R1–R9 rămase.

## Ce s-a schimbat în această trecere

- **R2** (`ChildrenPage.module.css`, `BirthdaysPage.module.css`): `border-radius` literale (20px/22px) → `var(--radius-lg)`/`var(--radius-xl)`; `#fff` → `var(--white)`; comentariul care explica alegerea `--coral-ink` reformulat ca să nu mai conțină șiruri hex literale (declanșa fals-pozitiv la regexul R2).
- **R7** (`childrenColumns.tsx`, `BirthdaysPage.tsx`): `new Date(...).toLocaleDateString(...)` local → funcție nouă `formatMonthOnly` în `#shared/format/date-format.mjs` (lună fără an, pentru antetul de coloană „Plată septembrie” și pentru interpolarea `{luna}` din catalogul de stări goale); `BirthdaysPage.tsx` folosește acum `formatMonthName` existent în loc de propriul apel `Intl`.
- **R9** (`BirthdaysPage.tsx`): starea goală a listei „Toată luna” (variantele „nicio zi în luna aceasta” / „nicio zi pentru filtrul ales”) → `EmptyState` pe cheia `zilenastere.period` din catalog — s-a pierdut nuanța „pentru filtrul ales” (catalogul are un singur text per cheie, ca la celelalte module).

## Ce a rămas neschimbat, cu motiv

- `ChildrenStatsRow.tsx` (cele 3 carduri „Copii activi / Grupe ocupate / Fișe de verificat”) rămâne pe `Card` + CSS local, nu pe `Kpi`/`StatCard`: niciuna din cele două nu randează layout-ul cerut de `02-copii-lista.md` (număr mare în stânga, text în dreapta, pe orizontală) — `Kpi` pune eticheta deasupra valorii, `StatCard` e vertical, gândit pentru coloana laterală a unei fișe. `DS-IMPLEMENTARE.md` §3 nu listează de altfel `Kpi`/`Stat` pentru Copii.
- `DS-IMPLEMENTARE.md` §3, rândul Copii: `DocumentCard` a fost scos din listă (componenta s-a șters, §1 punctul 5). `MultiSelect`, `FormSection`, `HoverCard`, `NoteList` rămân neadoptate — nu au un loc evident în ecranele curente fără o restructurare mai mare (ex. `NoteList` e doar afișare, fără editare/ștergere inline, iar notele din fișă chiar au nevoie de asta). Rândul rămâne nebifat în §3.
- Fișa copilului (CF-2/CF-7) a fost deja actualizată în §1 (Plătitori reținuți pe catalog, Documente eliminat) — neatinsă din nou aici.

## Verificare

- `npx tsc --noEmit -p .` — verde.
- `npx vitest run src/features/children` — 10/10 fișiere, 71/71 teste.
- `npx vitest run` (webapp, complet) — 249/249 fișiere, 1349/1349 teste.
- `npm run check` (root) — verde.
- `architecture.test.ts`: `ChildrenPage.module.css` și `BirthdaysPage.module.css` scoase din excepțiile R2; `BirthdaysPage.tsx` și `childrenColumns.tsx` scoase din excepțiile R7.

**Captură 1440×900 vs. artboard:** efectuată 01.10 — `02-copii.png` (stânga artboard, dreapta aplicația reală, pe copie izolată de date — §3). Diferențe vizuale: doar date de test (nume/grupe diferite față de artboard); structura, tokenii și componentele corespund.
