# §17 (F29) — Scrii doar în filiala deschisă — Plan scurt

**Sursă:** `docs/design/PROMPT-CLAUDE-CODE-11.md` §17, `docs/design/DECIZII.md` („02.10 — Scrii doar în filiala deschisă”).

**Regulă:** o acțiune dintr-o filială deschisă nu scrie date ale altei filiale. Comun (personal, funcții, curs BNM) rămâne citibil de oriunde; **legătura cu o filială** (angajat↔filială, salariu, avans, echipă de grupă) se scrie doar din filiala deschisă.

## Stare curentă (de verificat în cod, nu presupus)
- `StaffFormDrawer.tsx:127–140` — pastile de filiale la „+ Angajat”, `branchIds` ales liber din formular.
- `GroupTeamPicker` — candidații posibil listați din tot Comun-ul, nu filtrați pe filiala deschisă.
- `AdvanceFormDrawer`, `LeaveFormDrawer`, salarii — de verificat dacă alegerea angajatului e deja limitată la filiala deschisă.
- Server (`src/features/personal/server/*`) — de verificat dacă vreo rută de scriere acceptă `branchId` din corpul cererii fără să-l ignore/valideze contra sesiunii.

## Pași
1. `StaffFormDrawer.tsx`: angajat nou → `branchIds: [filialaDeschisă]` fix, fără pastile; rând informativ „Se adaugă în Filiala {nume}”. Editare: `branchIds` needitabil din formular. Scoate validarea „Alege cel puțin o filială” + testul ei.
2. „Angajat existent” (comutator în „+ Angajat”): caută în Comun angajații fără filiala deschisă, „Adaugă la {filiala}” → `branchIds.push`. Pe fișă: „Nu mai lucrează la {filiala deschisă}” scoate doar filiala curentă (confirmare + 40b); ultima filială → arhivare (comportament existent).
3. Audit țintit (fiecare punct → notă în `INTREBARI.md` dacă nu se închide acum):
   - `GroupTeamPicker`: candidați = `isStaffInBranch(filialaDeschisă)`.
   - `AdvanceFormDrawer`/`LeaveFormDrawer`/salarii: confirmă alegerea angajatului limitată la filiala deschisă (fix dacă nu).
   - `BranchesSettings.tsx`: confirmă că redenumirea/culoarea altei filiale nu scrie date (doar registrul).
   - Raport „Ambele” + `/api/branches/records`: confirmă GET-only, fără pereche de scriere.
   - Rutele server din `personal/server/*`: ignoră/validează `branchId` din body contra sesiunii; test cu `branchId` diferit → 400 sau ignorat.
4. Test de arhitectură (`architecture.test.ts`): niciun `features/**` (în afara `BranchSelector`/`BranchesSettings`) nu randează `session.state.branches.map` pentru alegerea filialei de scriere.
5. Test: `StaffFormDrawer.test.tsx` actualizat (fără pastile, mesaj informativ, comutator „existent”); teste pe rutele server corectate/adăugate.

## Verificare
`npm run check` (rădăcină) + `cd webapp && npx tsc --noEmit -p . && npx vitest run`.

## Constrângeri
Un commit pe pas logic; fără atribuire AI; ce nu se închide → `INTREBARI.md`, nu blochează coada.
