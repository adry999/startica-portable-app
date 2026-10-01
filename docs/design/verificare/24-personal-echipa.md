# 24 — Personal (Echipa/Candidați/Concedii/Fișa angajatului) — val 2, pe design system

**Referință:** `docs/design/screens/24-personal.md`, `Personal.dc.html#23a`–`#23l`.

**Scop:** doar partea STAFF/TEAM/CANDIDATES/LEAVES a modulului Personal — `PersonalPage.tsx`,
`TeamView.tsx`, `RolesDrawer.tsx`, `CandidatesTab.tsx`, `CandidateFormDrawer.tsx`, `LeavesView.tsx`,
`LeaveFormDrawer.tsx`, `StaffFormDrawer.tsx`, `StaffProfilePage.tsx`, `staffColumns.tsx`,
`candidateColumns.tsx` (+ testele lor). Partea Salarii/Pontaj (PIN, calcul financiar) e scop separat,
migrat concurent de alt agent — nu e atinsă aici.

## Stare la intrare în val 2

Fișierele erau deja aproape complet migrate: `DataTable` (cu `groupBy` pe departamente în Echipa),
`Drawer`/`Field`/`TextInput`/`Select`/`NumberInput`/`Checkbox`/`DateInput`/`PhoneInput`/`TextArea`
din `@shared/ui`, `Button` (`primary`/`outline`/`ghost`/`white`) în aproape toate formularele,
`ProfileLayout`/`ProfileSection`/`ProfileNotFound`/`StatCard` pe fișa angajatului,
`ConfirmDeleteDialog` pe ștergeri, `ListToolbar`/`SearchInput`/`FilterPills` pe liste. Rămâneau
câteva puncte marginale: două butoane „Șterge" brute în `RolesDrawer.tsx` (formă identică cu
`Button variant="danger"`, dar reimplementată local), hex `#fff` literal în două foi de stil,
trei `border-radius` în px fără token (unul avea deja token apropiat nefolosit), și o stare goală
„Niciun candidat încă" scrisă direct în `CandidatesTab.tsx` în loc să vină din catalogul
`empty-states.ts` (deși cheia `candidati.first` exista deja, nefolosită).

## Ce s-a schimbat în această trecere

- **`RolesDrawer.tsx`** (R1): cele două `<button className={styles.removeButton}>` („Șterge"
  departament/funcție) → `<Button variant="danger">`, care are exact aceeași formă (fără
  chenar/fundal, `--pink-ink`, `--subtle` la disabled) — vezi precedentul din
  `payments/PaymentDetailPanel.tsx`. `.removeButton`/`.removeButton:disabled` șterse din
  `RolesDrawer.module.css` (deveniseră neutilizate). Fișierul a ieșit curat din R1 `ALLOWED`.
- **`StaffFormDrawer.module.css`** (R2): `background: #fff` → `var(--white)`,
  `color: #fff` → `var(--white)` (pastilele de filială). Fișierul a ieșit curat din R2 `ALLOWED`.
- **`StaffProfilePage.module.css`** (R2): `background: #fff` (celula „viitor" din grila zilnică) →
  `var(--white)`; `color: #fff` (celula „A") → `var(--white)`; `border-radius: 6px` (`.dot`) →
  `var(--radius-5)` (5px — cea mai apropiată valoare din scară, diferență imperceptibilă pe un
  cerc de 20px). Fișierul a ieșit curat din R2 `ALLOWED`.
- **`TeamView.module.css`** (R2): `border-radius: 4px` (`.departmentSquare`, un pătrat de 12px) →
  `var(--radius-5)`; comentariul de deasupra `.roleCell` conținea valori hex literale în text
  explicativ (`#5b666e`/`#6b7780`) care declanșau regexul R2 ca fals-pozitiv — reformulat fără hex.
  Fișierul a ieșit curat din R2 `ALLOWED`.
- **`LeavesView.module.css`** (R2): `border-radius: 4px !important` (`.leaveBar`) →
  `var(--radius-5) !important` (fix real). `.card` (22px) și `.legendBar` (2px) rămân px literal —
  vezi mai jos — dar acum cu comentarii explicative, ca la `notify/NotifyPage.module.css`.
- **`CandidatesTab.tsx`** (R9): branch-ul manual `sorted.length === 0 ? <EmptyState variant="first"
  title="Niciun candidat încă" .../> : <DataTable emptyState={<EmptyState variant="no-results"
  title="Nimeni nu se potrivește căutării." />} />` → un singur `<DataTable empty="candidati.first"
  onEmptyAction={onNew} emptyState={searching ? <EmptyState variant="no-results" .../> : undefined}>`.
  Cheia de catalog `candidati.first` (titlu identic „Niciun candidat încă" + acțiunea „+ Candidat")
  exista deja în `empty-states.ts`, nefolosită — acum aduce și paragraful de sub titlu („Ține aici
  persoanele cu care ai vorbit pentru un post."), care lipsea complet din UI înainte. Textul de
  căutare fără rezultate rămâne propriu (spec cere explicit „Nimeni nu se potrivește căutării.",
  diferit de „Fără rezultate" generic al `DataTable`), deci importul direct `EmptyState` rămâne —
  dar acum justificat doar de acel caz, nu de întreaga stare goală.
- **`architecture.test.ts`**: comentarii adăugate pe excepțiile R1 rămase (`LeavesView.tsx` — bară
  poziționată pe zile, `StaffFormDrawer.tsx` — comutare multiplă filiale) și pe R2 (`LeavesView.module.css`
  — 22px/2px documentate); `personal/RolesDrawer.tsx` scos din R1 `ALLOWED`; `personal/StaffFormDrawer.module.css`,
  `personal/StaffProfilePage.module.css`, `personal/TeamView.module.css` scoase din R2 `ALLOWED`;
  comentariu actualizat pe `personal/CandidatesTab.tsx` în R9 `IMPORT_ALLOWED` (import rămas, dar cu
  scop redus la textul de căutare).

## Ce a rămas neschimbat, cu motiv

- **R1 — `LeavesView.tsx`, bara de concediu (`<button>` brut)**: poziționată absolut pe zilele
  concediului (stânga/lățime calculate din `leaveYearBar`, culoare dinamică din `leaveBarStyle`) —
  hit-area pe formă custom, exact tiparul `ChildTile.tsx`/`GroupTile.tsx`; un `Button`/`IconButton`
  ar impune fundal/padding/dimensiune fixă incompatibile cu poziționarea pe pistă. Rămâne în R1
  `ALLOWED`, acum cu comentariu în cod și în `architecture.test.ts`.
- **R1 — `StaffFormDrawer.tsx`, pastilele de filială (`<button>` brut)**: comutare multiplă
  independentă („una sau ambele filiale", `24-personal.md` §Date) — pereche fixă de pastile mereu
  vizibile. Nici `ChipSelect` (radiogroup, alegere unică), nici `MultiSelect` (declanșator +
  `Popover` cu căutare, gândit pentru liste lungi) nu reproduc corect acest tipar fără să schimbe
  interacțiunea din spec. Rămâne în R1 `ALLOWED`, acum documentat.
- **R2 — `LeavesView.module.css`, `.card { border-radius: 22px }`**: valoare exactă din artboard,
  fără corespondent în scara de tokeni (`--radius-lg`=20, `--radius-xl`=24) — același caz deja
  acceptat în `assign/AssignPage.module.css`/`backup/BackupPage.module.css`.
- **R2 — `LeavesView.module.css`, `.legendBar { border-radius: 2px }`**: bară de legendă de 8px
  înălțime; cel mai mic token din scară (`--radius-5`=5px) ar rotunji-o vizibil spre formă de
  pilulă, schimbând forma din artboard fără beneficiu.
- **R9 — `CandidatesTab.tsx`, textul „Nimeni nu se potrivește căutării."`**: text de căutare fără
  rezultate, intenționat în afara catalogului (header-ul `empty-states.ts`: „Fără rezultate" are
  mereu prioritate și e generic, generat de consumator) — același tratament ca
  `assign/AssignPage.tsx`/`groups/GroupsBoard.tsx`.
- **R9 — `TeamView.tsx`, `<p>Niciun angajat găsit.</p>`**: text de filtrare fără rezultate (pastile
  de departament/căutare), aceeași convenție ca `AssignPage.tsx`/`AuditLogPage.tsx`/`GroupsBoard.tsx`
  — rămâne literal, în afara catalogului, fără `EmptyState` (așa arată toate precedentele
  echivalente din repo). Rămâne în R9 `TEXT_ALLOWED`, neschimbat.
- **R9 — `CandidatesTab.test.tsx`**: menționează literal „Niciun candidat încă" doar ca asserțiune
  de test pe titlul din catalog — nu text nou. Rămâne în R9 `TEXT_ALLOWED`, ca toate `*.test.tsx`
  din listă.

Nimic altceva de reparat: niciun fișier din scop nu avea încălcări R3 (caractere-iconiță), R4
(`lucide-react` în afara `Icon.tsx`) sau R7 (`toLocaleDateString`/`toLocaleString`/`toFixed` brut) —
toate formatările de dată treceau deja prin `#shared/format/date-format.mjs`
(`formatDate`), fără nevoie de export nou.

## Conflict spec-vs-componentă

Niciunul genuin. `PersonalPage.tsx` folosește `SegmentedControl` (nu un component numit „Tabs")
pentru comutatorul de file Echipa/Pontaj/Concedii/Salarii/Candidați — funcțional identic cu ce cere
spec-ul (comutare de filă în antet) și deja testat; `DS-IMPLEMENTARE.md` §3 menționează „Tabs" ca
etichetă generică de tipar, nu ca nume obligatoriu de component, iar restructurarea nu era cerută
de nicio regulă R1–R9. Nu s-a scris nimic în `INTREBARI.md` pentru acest modul.

## Verificare

- `npx tsc --noEmit -p .` — verde.
- `npx vitest run src/features/personal src/architecture.test.ts` — 15/15 fișiere, 49/49 teste
  (două eșecuri de timeout tranzitorii la prima rulare, cauzate de alți agenți concurenți pe aceeași
  mașină — confirmate ca false-pozitive prin re-rulare izolată, verde).
- `npm run check` (root) — vezi rezultatul final raportat separat.
- `architecture.test.ts`: `personal/RolesDrawer.tsx` scos din R1 `ALLOWED`; `personal/StaffFormDrawer.module.css`,
  `personal/StaffProfilePage.module.css`, `personal/TeamView.module.css` scoase din R2 `ALLOWED`;
  niciun entry nou adăugat (doar comentarii pe excepțiile rămase, deja existente).

**Captură 1440×900 vs. artboard:** efectuată 01.10, regenerată după corecție — `24-personal-echipa.png`
(stânga artboard, dreapta aplicația reală, pe copie izolată de date — §3). Un revizor extern a găsit un
bug real ratat de prima trecere: coloana „Azi" arăta „Lucrează" în loc de „La lucru" (text implicit
hardcodat în `staffColumns.tsx`, fără cheie de catalog) — reparat și reconfirmat în captura curentă.

Verificate cu codul, nu doar presupuse: avatarul cu o singură literă (Valeria/Ala — nume de un singur
cuvânt în copia de date, `initials()` e corect; nu e bug de componentă) și anteturile de departament
(deja stilizate cu `departmentSquare`/badge de ton, identic cu artboard-ul — diferența vizuală bănuită
inițial nu există în cod). Restul diferențelor sunt doar date de test (paragraful de sub „Niciun candidat
încă”, rotunjimile ≤1px corespund artboard-ului).
