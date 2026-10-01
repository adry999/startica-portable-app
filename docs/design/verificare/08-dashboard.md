# 08 — Dashboard — val 2, pe design system

**Referință:** `docs/design/screens/08-dashboard.md`, `Dashboard.dc.html#1a`.

## Ce s-a schimbat față de val 1

- Bara + legenda „Cash/Card/Transfer” de pe KPI-ul Încasări: cod local → `ProgressBar(variant="segmented")` + `Legend`.
- Legenda „Încasări/Cheltuieli” de pe graficul „Evoluția încasărilor”: pătrate custom → `Legend` (puncte, nu pătrate — singura diferență vizuală, decor minor).
- `+ Adaugă cheltuială`, „Vezi calendarul →”: `<button>` brut → `Button variant="link"`.
- Starea goală „Necesită atenție” (toate rezolvate) și „Nicio zi de naștere”: text local → `EmptyState size="compact"` pe cheile `dashboard.attention.done`/`dashboard.birthdays` din `empty-states.ts` (35d) — s-a pierdut nuanța „nu sunt copii/achitări încă” vs „nimic de verificat”, catalogul are un singur text per cheie.
- Balonul cu diferența la hover pe o lună din grafic: div custom → `Tooltip` din `@shared/ui` (fără bold, conținut simplu).
- Starea de hover/activ pe bara lunii: `useState` + clase JS → `:hover`/`:focus-visible` în CSS.
- `#5fb58a` (verde curent la Cheltuieli) → `var(--mint-bar-current)`, deja tokenizat în `BarChart` — nu mai e literal.
- Restul radiusurilor/z-index literale din R2 → tokeni (`--radius-5`, `--radius-input`, sau eliminate odată cu markup-ul custom pe care-l acopereau).

## Ce a rămas cu excepție documentată (`architecture.test.ts` R1)

Rândul lună-cu-lună din „Evoluția încasărilor” (`barPair`) și „Vezi lista →” din „Necesită atenție” (`attentionAction`) rămân `<button>` brut — motivul tehnic complet e în `docs/design/INTREBARI.md` (secțiunea „Dashboard — graficul...”). Pe scurt: `BarChart` din `@shared/ui` nu are un mod „o singură țintă interactivă pe lună, cu tooltip combinat pe diferență”, iar acesta e exact comportamentul cerut de `08-dashboard.md` + testat în `DashboardPage.test.tsx` (A8).

## Verificare

- `npx tsc --noEmit -p .` — verde.
- `npx vitest run` (webapp) — 249/249 fișiere, 1349/1349 teste, inclusiv cele 12 din `DashboardPage.test.tsx` (KPI, A8 legendă/tooltip, rândul fără CTA, chip-uri zile de naștere).
- `npm run check` (root) — format + typecheck + `node --test` — verde.
- Fără clase CSS moarte în `DashboardPage.module.css` după curățare (verificat script-uit).

**Captură 1440×900 vs. artboard:** efectuată 01.10 — `08-dashboard.png` (stânga `Dashboard.dc.html#1a`, dreapta aplicația reală, server pornit pe o copie izolată a datelor — §3, niciodată pe `Startica_Date/` reală). Diferențe vizuale: doar date — luna curentă (octombrie 2026) e goală în copia de date folosită pentru captură, față de luna septembrie cu date din artboard; structura, tokenii și componentele corespund.
