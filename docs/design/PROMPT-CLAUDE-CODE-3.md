# Pentru Claude Code — sync 30.09, 01:00 (master-v2 @7063a98)

Din runda trecută, următoarele sunt verificate în cod: B3 complet (Servicii 10d, `Payment.service`, migrarea celor 143 de rânduri, executată), 18a/18b remediate, `TonePicker`, `ServiceBadge`, decizii consemnate în `RASPUNSURI.md` (23:19). Rămâne lista de mai jos. Lucrează în ordine. După fiecare punct: `npm run check` + webapp typecheck/test, apoi commit.

## 0. Pachetul de design nu e complet în repo
În `docs/design/` lipsesc fișierele create după 29.09, 19:56. Copiază-le din `design_final_startica/` (suprascrie):
- `DS Fundamente.dc.html`, `DS Fundamente 2.dc.html`, `DS Componente.dc.html`, `DS Componente 2.dc.html`, `DS Tabel si filtre.dc.html`, `Componente formular.dc.html`, `DS Incarcare si stari.dc.html`, `DS Date si grafice.dc.html`, `DS Tipare de pagina.dc.html`, `DS Diverse.dc.html`
- `DS-IMPLEMENTARE.md`, `AUDIT-DESIGN-COD.md`, `COMPONENTE.md` (§0–§0i), `ECRANE.md`, `CLAUDE-md-snippet.md` (secțiunea „Design system” → în `CLAUDE.md` din rădăcină)
- `Sms.dc.html` (11c/11d), `Administrare.dc.html` (10e, fără „Zonă periculoasă”), `Personal.dc.html` (23m marcat respins), `De notificat.dc.html` („SMS conectat”), `Formulare.dc.html` (15b „…prin SMS”)

Commit separat: `docs(design): design system 25–34 + DS-IMPLEMENTARE`.

## 1. B1: confirmă migrarea
`scripts/migrate/b1-fix-mixed-payments.mjs` există, dar `COADA-DE-LUCRU.md` nu spune dacă a fost rulat cu `--execute`. Rulează-l după backup (decizia (b): toate 7 pe Cash), apoi notează rezultatul în coadă, ca la B3.

## 2. Încărcare 21a/21b/21c — `StartupScreen.tsx` (neatins de la runda trecută)
- 21a: cele 2 cercuri lipsă (`--pink` 60px `right:260 top:90`, `--mint` 40px `left:220 bottom:120`). Pasul curent se termină cu „…”, iar la 100% scrie „Gata”. Bara avansează în interiorul pasului (maximum 90% din interval), nu în trepte. „v” înainte de versiune.
- 21b: `LoadingBar` de 3px în zona de conținut, la navigare peste 300 ms.
- 21c: cu sincronizarea configurată și serverul care nu răspunde, apare textul din design + „Lucrez fără legătură” + „Ultima sincronizare: …”. Fără sincronizare configurată rămâne textul actual. Actualizează `INTREBARI.md` punctul 12.

## 3. SMS (canalul e decis: SMS peste tot)
- **7c/7e:** `SmsConfirmDialog` în modul single primește segmented „Șablon” (șabloane + „Personalizat”) și `textarea` editabil + „Fără diacritice” + contor. Textul modificat se trimite cu `templateId: null`.
- **11c/11d „+ SMS nou”** în Notificări → Mesaje SMS: „Din aplicație” (părinți + angajați) sau „Alt număr” (`normalizeMoldovanPhone`), text liber sau șablon, „Salvează ca șablon nou”. Backend: `SmsSource='manual'`, `childId: null` + `recipientName`.
- **15b „Trimite confirmare părintelui prin SMS”:** bifa din subsolul Achitării noi (18px radius 5, bifată = `--orange`). Trimite un SMS cu șablonul „Confirmare plată” după salvare. Dezactivată cu textul „SMS neconectat” dacă sms.md nu e configurat. Implicit bifată doar dacă părintele are telefon valid.

## 4. Design system: faza mare, după 0–3
Tot planul, regulile R1–R8 și evidența pe module sunt în `docs/design/DS-IMPLEMENTARE.md`. Specul e în `COMPONENTE.md` §0–§0i. Regula: ecranele se construiesc doar din componente din `@shared/ui`.
- `TonePicker` există deja, dar diferă de 32c: fundalul pătratului = `-soft`, selectat = border 2px `-ink` + ✓, `aria-label` cu numele românesc („Portocaliu”, „Mentă”…). Aliniază-l.
- `ServicesSettings` (nou) are deja 2 `<input>` brute, caracterul ⋮⋮, „Se încarcă…” ca text și eroare ca `<p>`. Intră în migrare odată cu Administrare.
- Nu începe migrarea ecranelor (pasul 9) înainte ca pașii 1–8 să fie gata pentru componentele de care are nevoie modulul.

## 5. O singură decizie deschisă
- **Contrast buton primar** (alb pe `--orange` = 2,4, sub WCAG): `--orange-strong` / text slate / excepție de brand. Până la decizie, nu adăuga alte texte albe pe `--orange`.

## Nu se face (decis 29.09, 23:19)
23m (salariul pe fișă), numele în cheltuiala de salariu, „Probleme la backup”, „Zonă periculoasă”, Import CSV copii, Telegram pentru părinți. A9 (documente) rămâne amânat.
