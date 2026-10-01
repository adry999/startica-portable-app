# 10 — De notificat — val 2, pe design system

**Referință:** `docs/design/screens/10-de-notificat.md`, `De notificat.dc.html#8a`.

## Stare la intrare în val 2

Modulul era deja aproape complet migrat: `SegmentedControl` real din `@shared/ui` (De trimis/Trimise/Eșuate), `Card` pentru cele două coloane, `Badge` pentru pastilele de etichetă/„Notificat azi”/„plată neasociată?”, `Button` (`primary`/`ghost`/`outline`/`link`/`danger`) peste tot în locul butoanelor brute, `formatMoney` din `#shared/format/money-format.mjs` (fără `toFixed` brut), și rândul activ cu bara stângă orange de 4px cerută de spec. Rămăseseră doar de verificat/documentat trei lucruri deja marginale: rândul din coadă rămas `<button>` brut (hit-area pe tot rândul), umbra `inset 4px 0 0 var(--orange)` și cele trei valori `border-radius` px din artboard (22 pe carduri, 18/18/18/6 pe bula de mesaj) — și un text de stare goală care nu trecea prin catalogul `empty-states.ts`.

## Ce s-a schimbat în această trecere

- **`NotifyPage.tsx` — starea „coadă golită”**: `<p className={styles.empty}>{notifyData.emptyMessage}</p>` → `<EmptyState variant="done" title={notifyData.emptyMessage} />` (import nou din `@shared/ui`). Textul rămâne cel calculat dinamic în `useNotify.ts` (depinde și de fișele „De verificat”, nu doar de `rows.length`) — nu am putut trece pe cheia de catalog `denotificat.done` fără să pierd nuanța de business sau să ating `useNotify.ts` (în afara scope-ului, „rămâne”). Am păstrat însă decorul `EmptyState` „coadă golită”, consecvent cu `situatia.done`/`derezolvat.done` din celelalte module. Detaliu complet în `docs/design/INTREBARI.md` („De notificat — starea «coadă golită»…”).
- **`NotifyPage.module.css`**: adăugat un comentariu explicativ deasupra `.bubble` pentru colțul asimetric `18px 18px 18px 6px` (coada bulei din artboard), ca să fie clar de ce rămâne px literal, la fel ca radius-ul de 22 de pe `.queue`/`.preview` (deja documentat printr-un comentariu existent).
- **`architecture.test.ts`**: comentarii adăugate pe cele trei excepții deja existente (`notify/NotifyPage.tsx` în R1, `notify/NotifyPage.module.css` în R2) ca să explice exact ce rămâne și de ce; `notify/NotifyPage.tsx` adăugat în R9 `IMPORT_ALLOWED` (import nou, legitim, al `EmptyState`).

## Ce a rămas neschimbat, cu motiv

- **R1 — rândul din coadă (`<button>` brut)**: hit-area pe tot rândul (avatar + nume + sumă + badge-uri + bara activă), exact tiparul `ChildTile.tsx`/`GroupTile.tsx` — un `Button` ar impune propriul fundal/padding și ar sparge layout-ul cerut de `10-de-notificat.md` §3. Rămâne în R1 `ALLOWED`.
- **R2 — `box-shadow: inset 4px 0 0 var(--orange)`** (bara activă): exact shorthand-ul deja acceptat în `payments/PaymentsByMonth.module.css` pentru aceeași afordanță „rând activ” — regexul cere ca valoarea să *înceapă* cu `var(...)`, ceea ce acest shorthand pe patru valori nu poate face. Rămâne în R2 `ALLOWED`.
- **R2 — `border-radius: 22px`** (`.queue`, `.preview`) și **`border-radius: 18px 18px 18px 6px`** (`.bubble`): valori exacte din artboard (`De notificat.dc.html#8a`), fără corespondent în scara de tokeni (`--radius-lg`=20, `--radius-xl`=24, `--radius-md-lg`=16) — forțarea la cel mai apropiat token ar depărta de spec fără niciun beneficiu. Rămân în R2 `ALLOWED`, acum cu comentarii care explică exact de ce.
- **R9 — textul stării goale**: vezi mai sus și `INTREBARI.md` — rămâne dinamic, sursă `useNotify.ts` (neatins), doar decorul a trecut pe `EmptyState`.

Nimic altceva de reparat: fișierul nu avea nicio încălcare R3 (caractere-iconiță), R4 (`lucide-react` doar în `Icon.tsx`) sau R7 (`toLocaleDateString`/`toFixed` brut — `formatMoney` era deja folosit corect).

## Verificare

- `npx tsc --noEmit -p .` — verde.
- `npx vitest run src/features/notify src/architecture.test.ts` — 3/3 fișiere, 27/27 teste.
- `npx vitest run` (webapp, complet) — verde, 249/249 fișiere, 1352/1352 teste.
- `npm run check` (root) — verde (vezi rulare finală în raport).
- `architecture.test.ts`: nimic scos din excepții (fișierele nu au ieșit complet curate — rămân cele trei excepții R1/R2 deja documentate mai sus); adăugat `notify/NotifyPage.tsx` în R9 `IMPORT_ALLOWED` (import nou, legitim, al `EmptyState`); comentarii adăugate (nu entries noi) pe excepțiile R1/R2 existente.

**Captură 1440×900 vs. artboard:** efectuată 01.10 — `10-de-notificat.png` (stânga artboard, dreapta aplicația reală, pe copie izolată de date — §3). Diferențe vizuale: doar date de test; decorul stării „coadă golită” (titlu bold) corespunde celorlalte module.
