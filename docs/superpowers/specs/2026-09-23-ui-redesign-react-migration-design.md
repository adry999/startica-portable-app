# Redesign UI pe React+Vite — 23 septembrie 2026

## Context

Un design nou, complet, a fost primit din proiectul claude.ai/design (`48bf3ace-a7af-4f08-acd9-58b3091919a2`, pachet `design_handoff_startica_redesign`): shell nou (sidebar/topbar) + 14 ecrane + panouri laterale (formulare) + stări noi (toast, empty, confirmare de ștergere). Fișierele `.dc.html` sunt referințe vizuale, nu cod de copiat — ecranele se recreează în aplicație.

Motivul pentru care nu rămânem pe vanilla: problema recurentă semnalată e lipsa de componente reutilizabile — tabele reimplementate diferit de fiecare dată, sortare/filtrare adăugate manual de fiecare dată, design/UX inconsecvent între ecrane. Implementarea se face în sesiuni și agenți diferiți; o convenție scrisă ("folosește shared/ui") e ușor de ocolit sub presiune, o graniță de componente (import obligatoriu) nu. Decizie: **React + Vite**, doar pentru stratul `web/` — vezi actualizarea din `project-conventions` mai jos.

S-a respins explicit mutarea pe Supabase/cloud DB: proiectul anterior Nuxt+Supabase a fost abandonat deliberat (2026-09-22), grija reală era backup-ul, deja acoperit de `Startica_Backup/` + copie externă din Setări. Nu se schimbă baza de date.

Lucrul se face pe branch izolat `redesign/react-vite`; `master` nu se atinge fără cerere explicită.

## Scop

- Arhitectura frontend nouă (structură, componente `shared/ui`, tooling) pe care se construiesc cele 14 ecrane din design, într-un plan de migrare pas cu pas.
- Reutilizare completă a backendului existent: API JSON (`src/core/web/api-client.mjs`, rute per feature), logica de calcul (`src/shared/domain/*.mjs`).

## În afara scopului

- Orice schimbare de backend, bază de date sau calcule.
- Supabase, cloud DB, Electron.
- Cele 5 funcții noi semnalate explicit în README-ul design-ului ca „de confirmat cu proprietarul": buget pe categorii la Cheltuieli, „ține minte plătitorul" la Asociere achitări, „Anulează" pe rând de Istoric, rezumat săptămânal Telegram, atașare bon la Cheltuială nouă. Se decid pe rând, ecran cu ecran, nu în acest spec.
- Implementarea propriu-zisă (scaffold, cod) — acest document e arhitectura; planul de implementare e un pas separat, aprobat individual.

## Ce reutilizăm din codul existent (verificat, nu presupus)

- **API JSON**: `src/core/web/api-client.mjs` — fetch wrapper, header `X-Startica-Token`, `ApiError{kind: network|rejected|unexpected-response}`; rute per feature (`*.routes.mjs`, testate cu `*.routes.integration.test.mjs`). React vorbește cu backendul exact ca JS-ul vanilla azi — zero schimbare de backend.
- **Calcule**: `src/shared/domain/*.mjs` (`tuition-obligation.mjs`, `payment-allocations.mjs`, `record-schema.mjs`, `calendar-month.mjs`, `record-labels.mjs`, `record-integrity.mjs`, `money.mjs`, `notification-preferences.mjs` etc.) — module izomorfe, fără `node:*` și fără DOM. Se importă direct din React, nu se portează sau reimplementează — o singură sursă de adevăr pentru calcule.
- **Pattern de stare centrală**: `src/core/web/app-session-store.mjs`, `src/core/web/domain-event-bus.mjs`, `src/core/web/view-state.mjs`, `src/app/web/app-session.mjs`, `compose-screens.mjs` — azi orchestrează contoarele din sidebar (taxe, verificat, asociere, notificat, vizite) fără ca ecranele să se importe reciproc. Echivalentul React trebuie să acopere același rol.

## Ce se schimbă în convenție (excepție documentată)

`.claude/skills/project-conventions/SKILL.md` azi interzice framework/bundler și limitează devDependencies la `prettier`+`typescript`, dar permite schimbarea „doar prin decizie explicită". Această secțiune e exact acea decizie, aplicată o singură dată, doar stratului `web/`:

- `webapp/` (interfața web, nume nou ca să nu ciocnească cu `web/`-ul live până la cutover) poate folosi React, Vite, TypeScript real (`.tsx`/`.ts`), TanStack Query, Vitest, React Testing Library.
- Restul (`src/`, `server/`, `domain/`, testele backendului) rămâne neschimbat: Node ESM vanilla, JSDoc+`.d.mts`, zero build, zero dependențe runtime.
- Actualizarea concretă a fișierului de convenții e făcută separat de acest spec (adăugare, nu rescriere), cu trimitere înapoi la acest document.

## Arbore țintă

```
webapp/
├── index.html
├── vite.config.ts
├── tsconfig.json                 # propriu, moduleResolution "bundler" — separat de tsconfig-ul backendului
└── src/
    ├── main.tsx
    ├── app/                       # composition root: router simplu (state, nu librărie), layout, providers
    ├── shared/
    │   ├── ui/                    # DataTable, Badge, Card, Drawer, Toast, SegmentedControl, MonthPicker, Pill
    │   ├── api/                   # api-client.mjs REFOLOSIT ca atare (import direct) + hooks subțiri (TanStack Query)
    │   └── tokens/                # css vars din README design: culori, tipografie, raze, umbre, spațiere
    └── features/
        ├── dashboard/
        ├── children/              # listă (1c) + fișă (1e)
        ├── groups/
        ├── visits/
        ├── payments/
        ├── expenses/
        ├── payment-status/        # Situația plăților
        ├── fee-setup/             # Taxe și grupe
        ├── review-center/         # De verificat
        ├── payment-assignment/    # Asociere achitări
        ├── audit-log/             # Istoric
        ├── telegram-notify/       # Notificări
        └── backup/                # Backup și setări
```

Fiecare `features/<ecran>/` are:
- `index.ts` — public API, doar componenta de pagină (+ hook de contor, dacă sidebar are nevoie de el).
- `use<Ecran>.ts` — echivalentul controller-ului actual: orchestrare, `ViewStatus` (`loading | ready | empty | failed`).
- `<Ecran>Page.tsx` — echivalentul view-ului actual.

**Alias-uri**: `@app/`, `@shared/`, `@features/` (Vite `resolve.alias` + tsconfig `paths`) — prefix `@` distinct de `#` din backend, ca să nu se confunde runtime-ul căruia îi aparține un fișier. Separat, `@domain/` → cale relativă către `src/shared/domain` din backend (import direct al calculelor existente, nu copiere).

**Interzis** (aceeași regulă ca backend): un feature nu importă alt feature. Comunicare doar prin `shared/`, prin porturi din `app/`, sau prin selectori pe starea de sesiune.

## Componente `shared/ui`

| Componentă | Rezolvă | Note din design |
|---|---|---|
| `DataTable` | sortare+filtrare+paginare scrise o singură dată, API declarativ pe coloane — elimină duplicarea semnalată | coloane, celulă custom, bară de selecție flotantă (`#3a4750`), paginare cu numere |
| `Badge` / `Pill` | statusuri colorate consecvente (Achitat/Parțial/Neachitat/Scadent, categorii) | culori exacte din tokens |
| `Card` | radius 20–24, cerc decorativ opțional | KPI-uri, statistici compacte |
| `Drawer` | panou lateral (înlocuiește `dialog` pentru creare/editare) | 620px/560px, overlay, Esc + click-outside cu confirmare dacă e dirty |
| `Toast` | confirmări nedistructive cu Anulează | arhivare, 6s |
| `SegmentedControl` | comutatoare Tabel/Pe luni, Lună/An școlar etc., persistate în localStorage | |
| `MonthPicker` | pill cu „‹ Luna Anul ›", păstrează comportamentul `month-picker.mjs` actual | |

Toate stilizate din design tokens (secțiunea „Design tokens" a README-ului design-ului): culori (`#ef8a1d`, `#fcead3`, `#3a4750`, `#a8d8be`, `#f9d257`, `#f3a6be`, `#e9527c`, `#fffaf0`, `#ede7dc` + variantele -ink/-soft), tipografie (Baloo 2 titluri, Nunito text), raze 8–24/999, umbre din spec.

## Comunicare inter-feature

Fără import direct între feature-uri. Contoarele din sidebar (taxe, verificat, asociere, notificat, vizite) vin dintr-un singur snapshot central (`useSession()` — oglinda TanStack Query a lui `app-session-store.mjs`), citit prin selectori mici și puri, nu prin import de feature.

## Tooling

- Vite + `@vitejs/plugin-react`. TypeScript real doar în `webapp/`; backendul rămâne JSDoc+`.d.mts` neschimbat (fiecare runtime cu propriul punct de intrare și propria strategie de tipuri, per regula de arhitectură).
- TanStack Query pentru fetch/caching — mapează curat pe `ApiError.kind`/`ViewStatus` existent.
- Fără router extern (state local simplu, ca azi — de revizitat doar dacă apare nevoie reală de deep-link/URL).
- Vitest + React Testing Library, teste colocate `*.test.tsx`, separate de `node --test`-ul backendului, incluse în `npm run check`.

## CSP și servire statică (de verificat, nu de presupus)

`web/index.html` are azi CSP legat de hash-ul unui `<script type="importmap">` inline, iar serverul servește module doar dintr-o listă albă (`app/web`, `core/web`, `shared`, `features/*/{domain,web}`). Un build Vite produs implicit fără script inline ar permite un CSP mai simplu, iar servirea trece de la whitelist de module la fișiere statice din `webapp/dist`. Ambele se **verifică concret** la scaffold (pasul 1 din migrare), nu se presupun aici. Schimbarea propriu-zisă a `startica_server.mjs` e un pas separat, cu aprobare proprie — nu parte din implementarea inițială a ecranelor.

## Plan de migrare

1. Scaffold Vite+React în `webapp/`, build separat, zero atingere a `web/`-ului live — aditiv, risc minim.
2. `shared/ui` + tokens — izolat, testabil singur.
3. Integrare `api-client.mjs` (import direct) + TanStack Query.
4. Shell: Sidebar + Topbar.
5. Ecrane, în ordine: Dashboard → Copii/Grupe → Achitări/Cheltuieli/Situație → De rezolvat (Taxe și grupe, De verificat, Asociere achitări) → Administrare (Istoric, Notificări, Backup și setări) → Formulare/panouri laterale (ultimul — cel mai riscant, atinge toate fluxurile de creare/editare).
6. Cutover: serverul servește `webapp/dist`; `web/`-ul vechi (vanilla) eliminat în același commit ca schimbarea de servire, fără alt comportament amestecat în același commit.
7. Actualizare packaging (`Livrare/`, `scripts/pachet-client/`) cu pasul `vite build` înainte de împachetarea instalerului.

Fiecare pas e propriul lui plan de implementare, cu fișiere critice și verificare proprii — aprobat separat, nu dintr-o dată.

## Registru de verificare

1. **Baseline**: `npm run check` rulat pe codul neatins acum (23 septembrie 2026), stare înregistrată înainte de pasul 1.
2. **Diferența prototipului**: aceleași porți rulate pe scaffold-ul minim din pasul 1, raportate ca erori noi față de baseline.
3. **Colectare**: numărul de teste Vitest noi din `webapp/`, verificat că nu dispare silențios dintr-un `exclude`/`ignore` al runner-ului.
4. **Gărzi**: regula „un feature nu importă alt feature" plantată o dată cu o încălcare deliberată în `webapp/`, văzută eșuând la lint, apoi eliminată.
