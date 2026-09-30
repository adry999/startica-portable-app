# 12 — Administrare (Backup și setări) — val 2, pe design system

**Referință:** `docs/design/screens/12-administrare.md` (secțiunile 10c, 16a), `DS-IMPLEMENTARE.md` §3 —
rândul `Administrare 10a–10e, 11a–11d, 12a, 13c, 14b, 16a`. Scope-ul acestei treceri: folderul
`backup/` (fila „Backup și setări” cu sub-filele Backup, Import și export, Planuri și curs, Grădinița,
Filiale, Sincronizare, Bazin, Servicii).

## Stare la intrare în val 2

Modulul era deja aproape complet migrat: `SegmentedControl`, `Card`, `Button` (`primary`/`outline`/
`ghost`/`danger`), `Drawer`, `Field`, `TextInput`/`NumberInput`/`TimeInput`/`Select`/`TextArea`,
`Toggle`, `TonePicker`, `FileInput`, `ConfirmDeleteDialog`, `SettingsList`, `ServiceBadge`,
`LoadingState` — toate din `@shared/ui`, deja peste tot în locul elementelor brute. `formatDateTime`/
`formatFileSize`/`formatDate`/`formatMoney`/`formatRate` din `#shared/format/*.mjs`, fără
`toLocaleDateString`/`toFixed` brut. Niciun caracter-iconiță și niciun import `lucide-react` în afara
`Icon.tsx`. Rămăseseră de verificat/reparat doar cele patru excepții R9 deja marcate ca „de verificat”
în prompt (`ExchangeRateSettings.tsx`/`.test.tsx`, `PoolSettings.tsx`, `ServicesSettings.tsx`) și un
`border-radius` px izolat în `KindergartenSettings.module.css`.

## Ce s-a schimbat în această trecere

- **`ExchangeRateSettings.tsx`** — cele două texte de stare goală (lista de planuri, lista „Ultimele
  zile”) treceau direct prin `<p>{"Niciun plan adăugat încă."}</p>` / `"Niciun curs înregistrat încă."`.
  Catalogul `empty-states.ts` are deja cheile exacte pentru aceste două locuri (`planuri.first`,
  `curs.period` — 35c, adăugate probabil special pentru acest val, nefolosite până acum nicăieri în
  cod). Înlocuite cu `resolveEmptyStateTitle(EMPTY_STATES['planuri.first'])` / `[...]['curs.period']`
  (import nou `EMPTY_STATES`, `resolveEmptyStateTitle` din `@shared/ui`). Text afișat acum: „Niciun
  plan adăugat” / „Niciun curs înregistrat” (fără „încă.” final — canonicul din catalog).
- **`ExchangeRateSettings.test.tsx`** — cele două asersiuni `screen.findByText('Niciun plan adăugat
  încă.')` actualizate la `'Niciun plan adăugat'`, ca să reflecte textul nou din catalog.
- **`PoolSettings.tsx`** — textul inline „Niciun antrenor încă — adaugă-l în Personal.” (parte dintr-o
  propoziție cu numărul de antrenori disponibili) trecut pe cheia de catalog `bazin.coach`
  (`title: 'Niciun antrenor. Adaugă-l în'`, `actionLabel: 'Personal'`), combinate ca
  `` `${resolveEmptyStateTitle(...)} ${actionLabel}.` `` → „Niciun antrenor. Adaugă-l în Personal.”.
  Import nou `EMPTY_STATES`, `resolveEmptyStateTitle`. Nu s-a folosit `EmptyState` ca și componentă —
  textul stă inline într-un `<p>` cu numărul de antrenori disponibili, un `EmptyState` complet ar fi
  spart fraza/layout-ul existent.
- **`ServicesSettings.tsx`** — `emptyMessage="Niciun serviciu încă."` (prop pe `SettingsList`, randat
  ca `<p>`) trecut pe `resolveEmptyStateTitle(EMPTY_STATES['servicii.first'])` — potrivire aproape
  exactă cu catalogul (`title: 'Niciun serviciu încă'`, fără punct final). Import nou `EMPTY_STATES`,
  `resolveEmptyStateTitle`.
- **`KindergartenSettings.module.css`** — `.previewBody span { border-radius: 4px; }` (bara subțire de
  8px din previzualizarea antetului documentelor) trecut pe `border-radius: var(--radius-pill)`.
  Randare identică: pe o bară de 8px înălțime, un radius ≥ 4px se plafonează oricum la jumătate din
  înălțime (4px) — `--radius-pill` (999px) dă exact aceeași formă, fără niciun token nou și fără nicio
  schimbare vizuală.
- **`architecture.test.ts`** — vezi lista de mai jos.

## Alocarea excepțiilor din `architecture.test.ts`

- **R1 `ALLOWED`** — `backup/ExcelImportDialog.tsx` rămâne (justificat mai jos), acum cu comentariu
  explicativ propriu (nu avea unul dedicat înainte).
- **R2 `ALLOWED`** — `backup/KindergartenSettings.module.css` **scos din listă** (fișierul e acum curat
  — `border-radius: 4px` → `var(--radius-pill)`). `backup/BackupPage.module.css` rămâne (justificat mai
  jos, neschimbat).
- **R9 `TEXT_ALLOWED`** — `backup/ExchangeRateSettings.tsx`, `backup/PoolSettings.tsx`,
  `backup/ServicesSettings.tsx` **scoase din listă** (toate trei curate acum, text din catalog).
  `backup/ExchangeRateSettings.test.tsx` **rămâne**, dar cu motiv diferit de înainte: nu mai e text
  hardcodat de reparat în producție, ci inevitabilul `screen.findByText('Niciun plan adăugat')` dintr-un
  test care verifică exact textul din catalog — la fel ca celelalte `.test.tsx` deja din listă
  (`children/BirthdaysPage.error.test.tsx` etc.), un test care afirmă text real nu poate evita cuvântul
  „Niciun” dacă acela e textul corect.
- **R9 `IMPORT_ALLOWED`** — `backup/SyncSettings.tsx` verificat și confirmat: importă `EmptyState`
  direct pentru starea „Lista nu e disponibilă offline” (`variant="no-results"`), care e explicit în
  afara catalogului (header-ul `empty-states.ts`: „Fără rezultate” nu e o stare goală de catalog).
  Rămâne allowlisted, neschimbat.

## Ce a rămas neschimbat, cu motiv

- **R1 — `ExcelImportDialog.tsx`, `<input type="file" hidden>`**: dropzone/file-picker nativ din spatele
  butonului „Alege fișierul”, declanșat programatic prin `fileInputRef.current?.click()`. Niciun
  `@shared/ui` nu modelează un input de fișier ascuns — rămâne în R1 `ALLOWED`, acum documentat direct
  în `architecture.test.ts`.
- **R2 — `BackupPage.module.css`, `.statusCard { border-radius: 22px; }`**: valoare exactă din artboard
  (10c, cardurile ①②③), fără corespondent exact în scara de tokeni (`--radius-lg`=20,
  `--radius-xl`=24) — deja documentat în fișier cu un comentariu dedicat, precedent identic cu celelalte
  module (`assign/AssignPage.module.css`, `notify/NotifyPage.module.css`). Neatins.
- **R9 — `PoolSettings.tsx`, restul frazei „N antrenor(i) disponibil(i)”**: nu vine din catalog — e un
  număr dinamic cu acord de plural, fără cheie corespunzătoare (n-ar trebui să fie una, e conținut de
  date, nu stare goală). Nu conține „Niciun/Nicio”, deci nu intra oricum în R9.

Nimic din R3 (caractere-iconiță), R4 (`lucide-react` în afara `Icon.tsx`) sau R7
(`toLocaleDateString`/`toLocaleString`/`toFixed` brut) — verificate pe toate fișierele `backup/`, zero
încălcări, nimic de reparat.

## Fără conflict spec-vs-componentă

Nicio decizie tehnică nouă de consemnat în `INTREBARI.md` pentru acest val — toate cele patru
încălcări R9 identificate în prompt s-au dovedit genuin reparabile prin catalogul deja existent
(`planuri.first`, `curs.period`, `bazin.coach`, `servicii.first` — toate patru nefolosite până acum
altundeva în cod, exact pregătite pentru acest modul), fără să fie nevoie de o componentă nouă sau de
o abatere de la spec.

## Verificare

- `npx tsc --noEmit -p .` (webapp) — verde, 0 erori.
- `npx vitest run src/features/backup src/architecture.test.ts` — 14/14 fișiere, 74/74 teste.
- `npx vitest run` (webapp, complet) — 241–246/249 fișiere verzi în funcție de momentul rulării (alte
  sesiuni concurente modifică în paralel `app/`, `design-system/`, `attendance/`, `children/`,
  `notifications/`, `payments/`, `visits/` — niciuna dintre eșecurile observate nu atinge `backup/`;
  confirmat explicit prin rularea izolată de mai sus, curată 74/74). Nu am atins niciun fișier din afara
  `backup/`.
- `npm run check` (rădăcină) — verde: `format:check` (prettier) curat, `typecheck` (`tsc -p .`) curat,
  `npm test` (suita rădăcină, node:test) 1198/1200 (2 skipped, 0 fail).
- `architecture.test.ts`: 3 fișiere scoase complet din excepții (`backup/ExchangeRateSettings.tsx`,
  `backup/PoolSettings.tsx`, `backup/ServicesSettings.tsx` — R9 text), 1 fișier scos din excepții R2
  (`backup/KindergartenSettings.module.css`); 1 comentariu nou pe o excepție R1 existentă
  (`backup/ExcelImportDialog.tsx`, nu avea unul dedicat); `backup/ExchangeRateSettings.test.tsx` rămas
  în R9 `TEXT_ALLOWED`, cu motivul actualizat (test, nu producție).

**Captură 1440×900 vs. artboard:** neefectuată (motiv identic cu modulele anterioare — evită pornirea
backend-ului peste baza de date de producție, plus multiple sesiuni concurente pe același working
directory). Recomandare: spot-check manual la următorul push — singurele schimbări vizuale reale din
această trecere sunt textele de stare goală (acum din catalog, fără „încă.” final pe planuri/curs) și
bara de previzualizare din Grădinița (radius identic vizual, doar tokenizat).
