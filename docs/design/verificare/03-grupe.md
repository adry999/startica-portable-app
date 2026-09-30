# 03 — Grupe (Tablă / Carduri) — val 2, pe design system

**Referință:** `docs/design/screens/03-grupe.md`, `Grupe.dc.html#4a/#4b/#4c`.

## Stare la intrare în val 2

Modulul era deja construit substanțial pe design final: `GroupTile.tsx` (Tablă), `GroupCardCompact.tsx`
(Carduri), `GroupTeamPicker.tsx` (Echipa grupei, §5c) și `GroupFormDrawer.tsx` (Grupă nouă, §5b) existau
deja, cu drag & drop pentru copii și pentru reordonarea grupelor (mâner „⋮⋮”, copie rotită la tragere, inel
portocaliu pe țintă — A8). Datoria rămasă era stilistică: literali hex/rgba/border-radius în CSS, un
`toLocaleDateString` local și trei texte de stare goală scrise direct în JSX, în loc de catalog.

## Ce s-a schimbat în această trecere

- **`GroupTile.module.css`**: cinci `rgba(255, 255, 255, 0.55–0.75)` (mâner la hover, pastila „Editează”,
  pastila de stare, bara de ocupare, „Plasează aici”) → `var(--white-a60)` — tokenul a fost adăugat chiar
  pentru aceste suprafețe „de sticlă” din Grupe (vezi commitul `4b4d5b2f`, comentariul din `tokens.css`).
  `border-radius: 6px` (halou-ul de hover al mânerului) → `var(--radius-5)`.
- **`GroupCardCompact.module.css`**: pastila de stare (`rgba(255, 255, 255, 0.7)`) → `var(--white-a60)`.
- **`GroupTeamPicker.module.css`**: trei `background/color: #fff` → `var(--white)`; `border-radius: 6px`
  (togglurile de zi L-V) → `var(--radius-5)`; `border-radius: 999px` (avatar) → `var(--radius-pill)`.
- **`GroupsPage.module.css`**: `.memberRow` avea `border: 1px solid #f1e8d6` cu un comentariu care spunea
  explicit „niciun token exact” — între timp tokenul a fost adăugat (`--row-divider-warm`, același commit de
  mai sus, cu comentariul „Grupe — GroupsPage”); acum folosește `var(--row-divider-warm)`, iar
  `border-radius: 12px` → `var(--radius-input)`. Comentariul, acum inutil, a fost scos.
- **R7 — `GroupTeamPicker.tsx`**: `shortDate()` local (`.toLocaleDateString('ro-RO', {day:'numeric',
  month:'short'})`, pentru pastila „Concediu până pe 3 oct”) → `formatShortDayMonth` nou, în
  `src/shared/format/date-format.mjs` (+ test în `date-format.test.mjs`).
- **R9 — `GroupsPage.tsx`**: „Niciun copil în grupă. Caută mai sus sau trage-i din Tablă.” (text literal,
  identic cuvânt cu cuvânt cu spec §5) → `EmptyState` `size="compact"` cu cheia de catalog
  `grupe.members`. CSS-ul mort al vechiului paragraf (`.emptyMembers`, chenar punctat) a fost scos —
  varianta `compact` a `EmptyState` e intenționat fără decor propriu (trăiește deja în interiorul
  `<Card className={styles.editor}>`, care are cadrul ei).
- **R9 — `GroupsBoard.tsx`**: „Niciun copil fără grupă.” trata la fel două cazuri diferite — panoul „Fără
  grupă” chiar gol (toți copiii au grupă) și căutarea fără rezultate. Acum sunt despărțite: primul caz →
  `EmptyState` `size="compact"` cu cheia `grupe.pool.done` („Toți copiii au grupă.”); al doilea rămâne text
  literal „Niciun rezultat pentru căutare.” — „Fără rezultate” e explicit în afara catalogului
  (`empty-states.ts`, antetul fișierului), la fel ca în `AssignPage.tsx`/`AuditLogPage.tsx`.

## Ce a rămas neschimbat, cu motiv

- **`GroupTile.tsx` / `GroupTeamPicker.tsx` rămân în excepția R1.** `GroupTile` are patru roluri de buton
  într-un tile compact cu `currentColor` moștenit din tonul dinamic al grupei (mâner de tragere, numele ca
  buton de editare, pastila „Editează”, „+N”) — un `Button`/`IconButton` ar impune propriul fundal/padding
  fix și ar sparge nuanțarea pe ton, exact motivul pentru care `ChildTile.tsx` (attendance) e deja
  excepție. `GroupTeamPicker` are rândul candidatului din căutare (hit-area pe tot rândul, ca un tile) și
  togglurile de zi L-V (22×22, comutare multiplă/independentă — nu un grup radio, deci nici `ChipSelect` nu
  se potrivește). Nu există o variantă `Button`/`ChipSelect` care să acopere aceste tipare fără să
  restructureze componentele.
- **`GroupCardCompact.module.css` / `GroupTile.module.css` rămân în excepția R2** pentru o singură linie
  fiecare: `.dragOver { box-shadow: 0 0 0 3px var(--orange); }` — inelul de tragere. Regexul R2 cere ca
  valoarea de după `box-shadow:` să *înceapă* cu `var(...)`, dar acesta e un shorthand (offset-uri + rază +
  culoare), nu poate începe cu un singur `var()`. Exact aceeași formă apare, netocken­izată, în tot
  `shared/ui` (`Board.module.css`, `DateInput.module.css`, `NumberInput.module.css`, `Select.module.css`
  ș.a. — nescanate de R2), deci nu e un literal uitat, e tiparul stabilit peste tot codul pentru acest
  inel. N-am inventat un token nou doar ca să păcălesc regexul — ar fi divergat de convenția deja folosită
  peste tot altundeva.
- **`GroupTeamPicker.tsx` / `GroupTeamPicker.test.tsx` rămân în excepția R9 (text).** „Niciun asistent” /
  „Niciun înlocuitor” (§5c, „Gol”) sunt indicii scurte pe rolul unui bloc din Echipa grupei — nu o stare
  goală de listă/pagină (fără ilustrație, fără acțiune, fără variantă de catalog cu acest sens exact). Nicio
  cheie din `empty-states.ts` nu se potrivește; textul rămâne literal, identic cu spec-ul.

Nu a fost nevoie de o intrare nouă în `INTREBARI.md` — spec-ul dăduse deja cheile de catalog exacte pentru
cele două stări goale reale (`grupe.members`, `grupe.pool.done`), iar excepțiile R1/R2 de mai sus urmează
un precedent deja documentat explicit în alte module (`ChildTile.tsx`, umbrele din `shared/ui`), nu un
conflict nou spec-vs-componentă.

## Verificare

- `npx tsc --noEmit -p .` — verde.
- `npx vitest run src/features/groups src/architecture.test.ts` — 6/6 fișiere, 58/58 teste.
- `npx vitest run` (webapp, complet) — 249/249 fișiere, 1351/1351 teste.
- `npm run check` (root: `prettier --check` + `tsc -p .` + `npm test`) — verde, 1196/1198 teste (2 skip
  preexistente, nelegate de Grupe).
- `architecture.test.ts`: scoase din excepții — R2 `groups/GroupsPage.module.css`,
  `groups/GroupTeamPicker.module.css` (ambele complet curate acum); R7 `groups/GroupTeamPicker.tsx`
  (`formatShortDayMonth` nou). R9 `groups/GroupsPage.tsx` scos din `TEXT_ALLOWED` (textul literal a
  dispărut). Adăugate în R9 `IMPORT_ALLOWED` — `groups/GroupsPage.tsx`, `groups/GroupsBoard.tsx` (import
  nou, legitim, al `EmptyState`/`EMPTY_STATES`/`resolveEmptyStateTitle`). Rămase, documentate mai sus: R1
  `groups/GroupTile.tsx`, `groups/GroupTeamPicker.tsx`; R2 `groups/GroupCardCompact.module.css`,
  `groups/GroupTile.module.css`; R9 (text) `groups/GroupsBoard.tsx`, `groups/GroupTeamPicker.tsx`,
  `groups/GroupTeamPicker.test.tsx`.

**Captură 1440×900 vs. artboard:** neefectuată (motiv identic cu Dashboard/Copii/Achitări/Prezența — evită
pornirea backend-ului peste baza de date de producție). Recomandare: spot-check manual la următorul push,
cu atenție specială la cele 7 tonuri din Tablă/Carduri (`groupTone`) și la pastila de concediu din Echipa
grupei (`formatShortDayMonth`).
