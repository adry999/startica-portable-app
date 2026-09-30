# Handoff final: Startica V2 — redesign complet (29.09.2026)

## Ce e
Designul final pentru aplicația de gestiune a grădiniței Startica (webapp React în `webapp/`, branch `master-v2` din `adry999/startica-portable-app`): 26 de pagini de design, 89 de artboard-uri, toate modulele din meniul lateral, formularele, stările, tipăriturile și bonul de 58 mm.

## Despre fișierele de design
Fișierele `.dc.html` sunt **referințe de design construite în HTML** — arată aspectul și comportamentul dorit, nu cod de producție de copiat. Sarcina e să **recreezi aceste ecrane în codul existent** (React + CSS Modules + `@shared/ui` + `tokens.css`), cu tiparele deja stabilite acolo. Toate stilurile sunt **inline** pe fiecare element, deci valorile exacte (padding, radius, font, culoare) se citesc direct din HTML. Se deschid cu `npx serve docs/design` (au nevoie de `support.js` și `web/assets/` lângă ele).

## Fidelitate
**Hi-fi.** Culori, tipografie, spațiere și interacțiuni sunt finale. Ecranele se recreează la pixel, la 1440px lățime (meniul lateral = 248px), folosind componentele și tokenii existenți. Unde un hex nu are token, vezi `TOKENS.md`.

## Ordinea de citire
| # | Fișier | Ce conține |
|---|---|---|
| 1 | `DECIZII.md` | Cele 23 de decizii de produs. **Au prioritate** față de orice altceva. |
| 2 | `ALINIERE-DESIGN.md` | Coada de lucru: A1–A9, B1–B3, fiecare cu fișierele din cod, valorile exacte, logica și criteriile de acceptare. |
| 3 | `PROMPT-CLAUDE-CODE.md` | Textul de pornire pentru sesiunea Claude Code. |
| 4 | `TOKENS.md` | Inventarul culorilor din design → tokenii din `tokens.css`, scara tipografică pe roluri, raze, umbre, tonurile grupelor, culorile de stare. |
| 5 | `ECRANE.md` | Toate artboard-urile, cu id, conținut și mărime. |
| 5b | `COMPONENTE.md` | Tiparele din design → componentele din `@shared/ui`: ce există, ce se extinde, ce componente noi se extrag și când; ce intră în Storybook. |
| 6 | `screens/NN-*.md` | Specurile detaliate pe ecran (rută, date, arbore de componente, CSS, stări, teste, criterii). Cele atinse de decizii au un bloc „Actualizat 29.09.2026” sus. |
| 7 | `VERIFICARE-DESIGN.md` | Comparația cod ↔ design făcută ecran cu ecran (b84d7df). |
| 8 | `Set final.dc.html` | Indexul vizual: stadiul fiecărui ecran în cod și punctul din ALINIERE. |

**La conflict:** `DECIZII.md` > `ALINIERE-DESIGN.md` > artboard-ul `.dc.html` > `screens/*.md`.

## Ordinea de lucru (din ALINIERE)
A1 Drawer comun → A2 Copil nou → A3 Fișa copilului → A3b Achitare nouă → A3c Prezența · Ziua (+Anulează, fără marcare în masă) → A3e Prezența · Luna → A3d Grupe · Carduri → A3f Personal → B1 plăți mixte / „Altele” → B2 ștergere din arhivă → B3 Serviciu + mutarea încasărilor de bazin → A4 Bazin → A5 De notificat → A6 Asociere achitări → A7 Backup și Notificări → A8 diferențe mici → A9 Documente.

Starea la 30.09: componentele din DS-IMPLEMENTARE §2 există în cod; urmează Storybook (PROMPT-5 §1b) și al doilea val de migrare (PROMPT-5 §2). Prompturile și auditurile vechi sunt în `arhiva/`.

## Sistemul vizual, pe scurt
- **Fonturi:** Baloo 2 (titluri, cifre, butoane primare) + Nunito (text). Locale, din `webapp/public/assets/fonts`.
- **Culori de bază:** portocaliu `#ef8a1d` (accent, borduri, puncte; **nu** poartă text), `--orange-strong` `#b85a00` (fundal pentru text alb: buton primar, checkbox bifat, pastila „azi”), `--orange-ink` `#a34f00` (text portocaliu), slate `#3a4750` (text), crem `#fffaf0` (fundal pagină), border `#ede7dc`; perechi soft/ink pe mint, galben, roz; 8 tonuri de grupă.
- **Antet de pagină:** padding `12px 40px`, border-bottom `1px solid #ede7dc`; titlu Baloo 24/800 + eyebrow 11/800 uppercase `#9aa3a9` pe același rând; la dreapta comutatorul de mod (pastilă `#f1ece2`, opțiunea activă albă cu `--shadow-pill-active`), stepper-ul de lună/zi, butoanele.
- **Conținut:** padding `24–32px 40px 40px`, gap 16–18 între blocuri. Carduri albe radius 22 cu border `#ede7dc`; carduri KPI radius 20 pe fundal soft cu cerc decorativ `rgba(255,255,255,.45)`.
- **Tabele:** antet 11/800 uppercase .07em `#9aa3a9`, rânduri `11–12px 20px` cu `border-bottom:1px solid #f3eee5`, bifă 16px radius 5, meniu ⋯ 32×32 radius 10.
- **Filtre:** `FilterPills` — etichetă 13/700 `--muted`, pastile `6px 14px` 13/800 în tonul valorii, selectat = slate plin, alb.
- **Panou lateral:** 480–560px, antet `24px 30px` cu linie, corp `22px 30px`, subsol `18px 30px` cu linie.
- **Stări:** Prezent/Achitat verde `#3f9a6b`, Absent/Neachitat roz `#e9527c`, Motivat/Parțial/CO galben `#e0b400`, Nemarcat = cerc gol.

## Interacțiuni cheie
- Clic pe copil în Prezența: Prezent → Absent → Motivat (popover cu motiv) → Nemarcat; salvare optimistă, indicator „Salvat · ora / Se salvează… / Nesalvat · N”; Anulează + istoricul zilei.
- Tragere în Grupe: copii între grupe și reordonarea grupelor (vezi DECIZII 13).
- Selecție multiplă în tabele → bara slate de selecție; în „Arhivate” → Șterge definitiv cu „Scrie ȘTERGE”.
- Toast slate cu „↶ Anulează” la arhivări și ștergeri de note.
- Formular nesalvat la schimbarea filialei → dialog 13b.

## Assets
- `web/assets/startica-logo.svg`, `web/assets/startica-icon.svg` — aceleași ca în repo. Fără alte imagini; placeholder-ele de document din fișă sunt icoane CSS.

## Fișiere în pachet
- Documentație: `README.md` (acesta), `DECIZII.md`, `COMPONENTE.md`, `ALINIERE-DESIGN.md`, `PROMPT-CLAUDE-CODE.md`, `TOKENS.md`, `ECRANE.md`, `VERIFICARE-DESIGN.md`, `CLAUDE-md-snippet.md`, `screens/` (00–29 + README).
- Design: toate `.dc.html` (Achitari, Administrare, Bazin, Bon 58mm, Cheltuieli, Copii, Dashboard, De notificat, De rezolvat, Filiale, Formulare, Grupe, Incarcare, Personal, Planuri si curs, Prezenta, Prima pornire, Raport contabil, Responsive, Set final, Sidebar, Sincronizare, Situatia, Sms, Tiparire, Vizite) + `support.js` + `web/assets/`.

## Cum se pune în repo
Copiază tot conținutul acestui folder în `docs/design/` (suprascrie). **Nu șterge** fișierele de lucru ale repo-ului care nu sunt în pachet: `COADA-DE-LUCRU.md`, `INTREBARI.md`, `RASPUNSURI.md`, `AUDIT-UI-2026-09-28.md`. Șterge `Personal v1.dc.html` dacă există. Lipește `CLAUDE-md-snippet.md` în `CLAUDE.md` din rădăcină. Apoi dă-i lui Claude Code textul din `PROMPT-CLAUDE-CODE.md`.
