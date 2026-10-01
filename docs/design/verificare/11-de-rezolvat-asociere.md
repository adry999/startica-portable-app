# 11 — De rezolvat — 9c Asociere achitări (`assign/AssignPage.tsx`) — val 2, pe design system

**Referință:** `docs/design/screens/11-de-rezolvat.md` §9c, `De rezolvat.dc.html#9c`.

## Stare la intrare în val 2

Modulul era deja substanțial construit pe design system: `Card`, `Checkbox`, `EmptyState`, `Icon`, `LoadingState`, `ScrollArea`, `SearchInput`, `SearchSelect`, `Button` (`variant="primary"`/`"outline"`/`"ghost"`), grid `1fr 1fr` (listă | detaliu) exact ca în spec. Nu exista niciun `<input>/<select>/<textarea>/<table>/<dialog>` brut — singurul `<button>` brut e rândul din coada de achitări neasociate (dată + text sursă + sumă), un hit-area pe tot rândul, ca `ChildTile`/`GroupTile`/`NotifyPage`. Niciun `.toLocaleDateString/toLocaleString/toFixed` (R7 curat de la intrare — folosește deja `formatMoney`/`formatMonthLabel`). Rămăseseră: o stare „coadă golită” cu titlu hardcodat în loc de cheia de catalog deja existentă (`asociere.done`), o stare „nicio sugestie” cu text literal necatalogat (`asociere.suggestions`, definită dar neconectată nicăieri) și un `font-family: monospace` fără token corespunzător (R2 — genuin, spec-mandated).

## Ce s-a schimbat în această trecere

- **`AssignPage.tsx`** — starea „coadă golită” (`assignData.rows.length === 0`): titlul hardcodat `"Nu există achitări neasociate."` → `EmptyState` cu `variant`/`title`/`description` din `EMPTY_STATES['asociere.done']` (`resolveEmptyStateTitle`/`resolveEmptyStateText`) — cheia exista deja în `empty-states.ts` (35c), doar neconectată.
- **`AssignPage.tsx`** — starea „nicio sugestie” din panoul de detaliu (`matchedOptions.length === 0`): paragraful hardcodat `<p className={styles.noSuggestions}>Nicio sugestie — caută mai jos.</p>` → `EmptyState size="compact"` cu `variant`/`title` din `EMPTY_STATES['asociere.suggestions']` (aceeași situație — cheia exista în catalog, neconectată).
- **`AssignPage.module.css`** — clasa `.noSuggestions`, rămasă fără consumator după schimbarea de mai sus, ștearsă.
- **`AssignPage.module.css`** — comentariu adăugat lângă `.bankBox { font-family: monospace; }` documentând că e cerută explicit de spec (11-de-rezolvat.md §9c: „monospace 13px”) și că nu există un token de font monospace în `tokens.css` (doar `--font-heading`/`--font-body`) — literalul rămâne, e o excepție documentată, nu o scăpare.
- **`AssignPage.test.tsx`**: asertarea pe textul stării goale actualizată de la `'Nu există achitări neasociate.'` (vechiul text hardcodat) la `'Toate achitările sunt asociate'` (titlul exact din `EMPTY_STATES['asociere.done']`) — schimbare directă și corectă, cerută de fix-ul de mai sus.

## Ce a rămas neschimbat, cu motiv

- **Rândul din coada de achitări neasociate** (`<button>` brut, `PaymentRow`) — hit-area pe tot rândul (dată + text sursă din bancă + sumă), exact tiparul deja acceptat pentru `ChildTile`/`GroupTile`/`NotifyPage`/`ReviewPage`: un `Button` ar impune propriul fundal/padding și ar sparge layout-ul de rând din §9c. Rămas în `architecture.test.ts` R1 `ALLOWED`, cu comentariu nou explicând motivul (nu exista înainte).
- **`.queueCard { border-radius: 22px; }` / `.suggestionCard { border-radius: 18px; }`** — valori exacte din artboard, fără corespondent exact în scara de tokeni (`--radius-lg`=20/`--radius-xl`=24`, resp. `--radius-md-lg`=16/`--radius-lg`=20), exact același caz deja acceptat în `notify/NotifyPage.module.css` (22px, „fără token exact”). Rămas în R2 `ALLOWED`, cu comentariu nou.
- **`.bankBox { font-family: monospace; }`** — vezi mai sus; nu există niciun token de font monospace în `tokens.css`, iar spec-ul cere explicit monospace pentru textul de bancă. Rămas în R2 `ALLOWED`, documentat.
- **„Niciun rezultat pentru căutare”** (coada, la căutare fără rezultate) — text de căutare fără rezultate, intenționat în afara catalogului (header-ul `empty-states.ts`: „«Fără rezultate» ... NU e în acest catalog”), exact ca `GroupsBoard.tsx`/`AuditLogPage.tsx`. Rămas în R9 `TEXT_ALLOWED`, cu comentariu nou.
- **Importul direct al `EmptyState`** din `@shared/ui` — coada nu e un `DataTable` (listă custom + panou de detaliu cu sugestii pe tonuri), deci `EmptyState` se randează direct, ca în `NotifyPage.tsx`/`ReviewPage.tsx`. Rămas în R9 `IMPORT_ALLOWED`, cu comentariu nou (acum folosit de două ori: `asociere.done` și `asociere.suggestions`).
- **`useAssign.ts`** — neatins, conform interdicției explicite din task (hook-ul de matching/sugestii + scrierea în `payer_aliases`).

Niciun conflict spec-vs-componentă genuin nu a apărut (nu a fost nevoie de nicio intrare nouă în `INTREBARI.md`) — cele două literale CSS rămase (radius, font monospace) sunt cazuri deja precedente în modulele anterioare (`NotifyPage`), tratate identic: comentariu explicativ + păstrare în allowlist.

## Testul de regresie financiară

Acest ecran nu calculează totaluri, dar scrie date financiare reale (asocierea plată↔copil + `payer_aliases` la „Ține minte plătitorul”) — logica respectivă trăiește integral în `useAssign.ts`, explicit în afara scope-ului acestei treceri. Verificat:

- `git status`/`git diff` pe `webapp/src/features/assign/useAssign.ts` — **fără nicio modificare** (fișierul nu apare deloc în `git status`).
- `npx vitest run src/features/assign/useAssign.test.ts` — **12/12 teste verzi, neschimbate** (algoritmul de potrivire/sugestii, scrierea în `payer_aliases`, `fillSuggested`, `save`, `toggleRemember` — toate acoperite acolo, nu în `AssignPage.test.tsx`).

Singurele fișiere atinse sunt de prezentare: `AssignPage.tsx`, `AssignPage.module.css`, `AssignPage.test.tsx`.

## Verificare

- `npx tsc --noEmit -p .` (webapp) — verde.
- `npx vitest run src/features/assign src/architecture.test.ts` — 3/3 fișiere, 32/32 teste.
- `npx vitest run` (webapp, complet) — 249/249 fișiere, 1352/1352 teste; 3 eșecuri tranzitorii la prima rulare (`design-system.test.tsx`, `VisitsPage.test.tsx` ×2 — timeout la 5000ms, alte sesiuni concurente rulează în același repo), confirmate flaky prin rerulare izolată: `npx vitest run src/design-system/design-system.test.tsx src/features/visits/VisitsPage.test.tsx` — 2/2 fișiere, 11/11 teste, verde; niciun fișier atins de această trecere.
- `npm run check` (rădăcină) — verde, 1198 teste, 1196 pass, 2 skip (preexistente, nelegate de Asociere achitări), 0 fail.
- `architecture.test.ts`: nicio intrare scoasă din excepții (modulul avea deja violări genuine — radius fără token exact, font monospace fără token, hit-area pe rând, căutare fără rezultate — toate documentate acum cu comentarii, niciuna eliminabilă fără a încălca spec-ul sau a forța o componentă nepotrivită). R9 `TEXT_ALLOWED`/`IMPORT_ALLOWED`/R1 `ALLOWED`/R2 `ALLOWED` — toate cele patru intrări `assign/*` rămân, fiecare cu comentariu explicativ nou.

**Captură 1440×900 vs. artboard:** efectuată 01.10 — `11-de-rezolvat-asociere.png` (stânga artboard, dreapta aplicația reală, pe copie izolată de date — §3). Diferențe vizuale: doar date de test; cele două stări goale (coadă golită, „nicio sugestie”) și caseta monospace a textului de bancă corespund artboard-ului.
