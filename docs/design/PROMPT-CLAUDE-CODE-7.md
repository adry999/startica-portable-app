# Prompt pentru Claude Code — 7 (01.10.2026, rev. seara)

Înlocuiește `PROMPT-CLAUDE-CODE-6.md` (mutat în `arhiva/`). PROMPT-6 e închis integral: R2/R9 cu allowlist gol, capturile regenerate pe `dist` proaspăt, Achitări și Personal reparate, Storybook (`webapp/.storybook`, povești pe `@shared/ui`), 21c cu `lastSyncedAt` persistat. O singură sesiune.

## 0. Pachetul de design
Copiază `design_final_startica/` peste `docs/design/`, cu suprascriere. Nu șterge `verificare/`, `INTREBARI.md`, `COADA-DE-LUCRU.md`, `RASPUNSURI*.md`, `AUDIT-UI-*.md`. Mută `PROMPT-CLAUDE-CODE-6.md` în `arhiva/`.
Commit: `docs(design): pachet 01.10 b`.

## 1. Bug-urile din testarea `Startica_Setup_2.1.0.exe` (INTREBARI.md, primul punct)
Reprodu pe instalerul 2.1.0 sau pe `dist` proaspăt (`npm run build`), nu pe `npm run dev` — exact lecția din incidentul capturilor.
1. **Dashboard, „Evoluția încasărilor”.** Compară cu `Dashboard.dc.html#1a`. Verifică întâi ce s-a schimbat în jur, nu doar `DashboardPage.tsx`: `Card.module.css` (overflow, padding), `Tooltip`, tokenii folosiți de bare, `revenuePanel { overflow: visible !important }`. Captură înainte/după în `verificare/`.
2. **„Copil nou”, scroll orizontal.** `Drawer.module.css .body` nu are `overflow-x: hidden` și nici `min-width: 0` pe copii; `.pickupRow` (5 coloane) și `.parentRow` (110px fix) pot depăși 620px când `Field`/`Input` din `@shared/ui` au lățime minimă intrinsecă. Corecția corectă e în `Drawer` (corpul nu derulează niciodată pe X) plus `min-width: 0` pe celulele grilelor din formular, nu `overflow-x: hidden` doar pe formular. Test: niciun `scrollWidth > clientWidth` pe `.body` la 620px.
Commit per bug: `fix(<modul>): …`.

## 2. PeriodFilter cu presetări (Achitări 5a)
Rămâne deschis în INTREBARI.md. Spec: `Componente formular.dc.html` (PeriodFilter) + `Achitari.dc.html#5a`. Model: `period: { preset: 'luna' | 'luna-trecuta' | '30z' | 'an-scolar' | 'tot' | 'interval', from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }`; filtrele pe lună existente primesc `from`/`to` pe zi. „An școlar” = 1 sep – 31 aug, aceeași funcție ca Situația plăților (o singură sursă în `@shared/format`). Plan scurt în `docs/superpowers/plans/` înainte de cod, apoi Achitări, apoi Cheltuieli.

## 3. Versiuni compatibile și actualizare automată (înaintea profilurilor)
Spec: `screens/32-actualizari.md`, artboard `Actualizari.dc.html#37a…37d`. Ordinea: header de versiune + 426 pe server (cu teste) → starea „Sincronizare oprită” în client → coloana Versiune → verificarea `latest.json` + descărcarea + instalarea la închidere în lansator → bara 37b. Sursa de versiuni: **GitHub Releases** (32-actualizari.md, „Client”): `releases/latest/download/latest.json` dintr-un repo public de release, fără token, fără API; plus `scripts/release.mjs` pentru publicare. Dacă repo-ul de release nu există încă, folosește URL-ul din config și treci în INTREBARI.md numele lui. Commit pe pas.

## 4. Profiluri de calculator (după §3)
Spec: `screens/31-profiluri-calculator.md`, artboard `Profiluri calculator.dc.html#36a…36f`. Întâi serverul (filtrare pull/snapshot, respingere push, endpoint profil, teste), apoi clientul (sesiune, meniu, rute, fișa doar citire, `profil.blocked`), apoi ecranele 36a–36c, apoi istoricul pe calculatoare (36g, tipul `audit_log`) și verificările la intrare (36h: `ModuleGuard`, middleware `/api`, PIN pe modul, test de arhitectură). Plan scurt în `docs/superpowers/plans/` înainte. Redesfășoară `sync-server` înaintea instalerului.

## Ordinea
§0 → §1 → §2 → §3 → §4. `npm run check` și `cd webapp && npm run typecheck && npm test` verzi după fiecare commit. Capturile doar pe copie (`npm run dev:copy`), cu build proaspăt, niciodată pe `Startica_Date/`.

## Te oprești doar dacă
Aceleași condiții ca în PROMPT-6. Întrebarea merge în `INTREBARI.md`, apoi treci mai departe.
