# 11 — De rezolvat · 9b De verificat — val 2, pe design system

**Referință:** `docs/design/screens/11-de-rezolvat.md` §9b, `De rezolvat.dc.html#9b`.

## Stare la intrare în val 2

Modulul era deja pe `SegmentedControl` (Toate/Fișe/Achitări), `Card`, `ScrollArea`, `SearchInput`, `Badge`, `EmptyState`, `Button` (`variant="link"`/`"outline"` pentru „Deschide fișa →”/„Nu e o problemă”/„Sari peste”) — grila `360px 1fr`, punctul de severitate de 8/10px și bara activă de 4px erau deja pe tokeni. Rândul din coada „De verificat” e un `<button>` brut (hit-area pe tot rândul, ca `ChildTile`/`GroupTile`/`NotifyPage.tsx`), deja pe lista R1 — nicio schimbare de layout necesară acolo. Rămăsese un `<kbd>S</kbd>` brut pentru scurtătura tastaturii, cu stilizare proprie în `.module.css` (`border-radius: 6px` literal, R2), în loc de componenta `Kbd` deja existentă în `@shared/ui`.

## Ce s-a schimbat în această trecere

- **`ReviewPage.tsx`**: `<kbd>S</kbd>` brut → `<Kbd>S</Kbd>` din `@shared/ui` (componentă existentă, `COMPONENTE.md` §32e — etichetă pentru scurtătură de tastatură). Logica tastei S (`onKeyDown`, `skip()`) rămâne complet neatinsă.
- **`ReviewPage.module.css`**: regula `.skipHint kbd { padding, border-radius: 6px, background, font-size, font-weight }` (stiliza tag-ul `<kbd>` brut) redusă la `.skipHint kbd { margin-left: var(--space-4); }` (doar spațierea față de text — restul stilului vine acum din `Kbd.module.css`, care folosește deja `--radius-5`). Elimină singura încălcare R2 rămasă în fișier în afara excepției documentate mai jos.
- **`architecture.test.ts`**: adăugat comentariu lângă `review/ReviewPage.module.css` (R2 `ALLOWED`) și `review/ReviewPage.tsx` (R1 `ALLOWED`) care explică exact ce excepție rămâne și de ce, în același stil ca restul fișierului — fișierele rămân pe listă (vezi mai jos), dar acum cu motivul documentat inline, nu doar implicit.

## Ce a rămas neschimbat, cu motiv

- **R1** — `<button>` brut pentru rândul din coadă (avatar-less, punct de severitate + nume + problemă, cu bara activă de 4px): hit-area pe tot rândul, exact tiparul deja acceptat pentru `notify/NotifyPage.tsx` — un `Button` din `@shared/ui` ar impune propriul fundal/padding și ar sparge layout-ul cerut de 9b. Rămâne în R1 `ALLOWED`, cu comentariu nou.
- **R2** — `.queueRowActive { box-shadow: inset 4px 0 0 var(--orange); }`: bara stângă de 4px cerută explicit de spec (9b: „rândul activ are bara stângă de 4px”), același shorthand deja acceptat în `notify/NotifyPage.module.css`/`payments/PaymentsByMonth.module.css` — nu poate începe cu `var(...)`, nu există un token pentru toată valoarea umbrei. Rămâne în R2 `ALLOWED`, cu comentariu nou.
- **R9** — `review/ReviewPage.tsx` rămâne în `IMPORT_ALLOWED` (import direct, legitim, al `EmptyState` — coada nu e `DataTable`, are propria stare „done” la `rows.length === 0`); textul „Totul e verificat” / „Nu mai sunt fișe sau achitări de corectat.” a rămas hardcodat, nemutat pe cheia `derezolvat.done` — vezi `docs/design/INTREBARI.md` pentru motiv (textul cheii ar sugera greșit că și taxele/asocierile sunt la zi, când pagina vede doar propria coadă).
- Tabelul comparativ cu diferențele pe `--yellow-soft`, cerut de spec 9b pentru cazul curent, nu există azi în `ReviewPage.tsx` (doar `problemBox`/`identity`/`actionsRow`) — lipsă preexistentă migrării, nu o încălcare R1/R2/R7/R9; adăugarea lui ar fi o extindere de funcționalitate/layout, în afara scope-ului acestei treceri („style/rule cleanup, nu rescriere” — vezi promptul de migrare).
- `useReview.ts` — neatins (vezi mai jos).

## Testul de regresie financiară

`useReview.ts` nu face niciun calcul monetar (nu însumează plăți, nu calculează totaluri) — `formatMoney` e apelat o singură dată, pe suma unei singure achitări afișate în `subtitle`/`details`, fără agregare. Migrarea n-a atins `useReview.ts` deloc (confirmat cu `git status`/`git diff`: fără modificări) — doar `ReviewPage.tsx`/`ReviewPage.module.css` (prezentare). `useReview.test.ts` (8 teste — categorizare fișă/achitare, filtrare pe tip, căutare, numărătoare, `confirmReview`) a rămas verde neschimbat.

## Verificare

- `npx tsc --noEmit -p .` — verde.
- `npx vitest run src/features/fee-setup src/features/review src/architecture.test.ts` — 5/5 fișiere, 35/35 teste.
- `npx vitest run` (webapp, complet) — 249/249 fișiere, 1352/1352 teste, verde.
- `npm run check` (root) — verde (vezi raportul de subagent pentru numărul exact).

**Captură 1440×900 vs. artboard:** neefectuată (motiv identic cu modulele anterioare — evită pornirea backend-ului peste baza de date de producție). Recomandare: spot-check manual la următorul push, cu atenție la aspectul `<kbd>S</kbd>` (acum cu fundal/font din componenta `Kbd`, ușor diferit de stilul custom anterior).
