# Prompt pentru Claude Code — 5 (30.09.2026, 12:30)

Înlocuiește `PROMPT-CLAUDE-CODE-4.md`. Fundamentele și componentele din pasul 3 sunt gata (verificat la 7aace22). Rămâne pasul 4, migrarea, plus câteva lucruri mici înainte. Toate întrebările deschise din `INTREBARI.md` au răspuns în `RASPUNSURI-30-09.md`.

## 0. Pachetul de design
Suprascrie `docs/design/` cu tot conținutul din `design_final_startica/`. Modificat față de ce e acum în repo:
- `Stari goale.dc.html` (35c, 35d, 35e noi) și `screens/30-stari-goale.md`
- `Copii.dc.html` (2b fără cardul Documente), `screens/09`, `screens/28`, `ALINIERE-DESIGN.md` (A9 scos), `COMPONENTE.md` (DocumentCard scos)
- `DS Fundamente 2.dc.html` (33f: contrastul e decis, nu mai e „De decis”)
- `DECIZII.md`, `RASPUNSURI-30-09.md`, `AUDIT-DS-30-09-v2.md`, acest fișier
Mută răspunsurile în `INTREBARI.md` (⏳ → ✅, cu trimitere la `RASPUNSURI-30-09.md`). Commit: `docs(design): pachet 30.09 12:30`.

## 1. Înainte de migrare (mici, un commit fiecare)
1. **`Spinner` 14.** Adaugă mărimea 14 (29b); `Button loading` folosește 14; scoate comentariul despre 12.
2. **`EmptyState size="compact"`** (35d): un rând 13px `--muted`, fără chenar, fără puncte, padding 8px 0, acțiunea ca `Button variant="link"`.
3. **`empty-states.ts`:**
   - adaugă câmpurile `text` (paragraful de sub titlu) și `size?: 'compact'`;
   - adaugă toate cheile din 35a–35d, cu textele exacte din `Stari goale.dc.html` (titlu, text, buton);
   - `DataTable`/`EmptyState` primesc `empty="<cheie>"` și `emptyParams`; ecranul nu mai scrie niciun text;
   - test: fiecare cheie are titlu nevid; cheile din `screens/30` §35b–35d există toate.
4. **R9 mai precis** (`architecture.test.ts`): nu număra textele din 35e (`throw new Error(…)`, `toast.show(…)`, props `label`/`hint`/`emptyLabel`, opțiuni de select). Allowlist-ul trebuie să conțină după asta doar stările goale reale.
5. **Documente scoase:** șterge cardul Documente din `ChildProfileView` și `DocumentCard` din `@shared/ui` și `/design-system`.
6. **CF-2 Plătitori reținuți:** cardul din 2b pe `payerAliases` existent: nume (majuscule, 800), „fără IBAN, doar numele”, `din dd.mm.yyyy · N achitări`, „×” care șterge aliasul (cu toast „Anulează”), textul cu link spre Asociere achitări. Starea goală: `fisa.payers` (compact). IBAN-ul nu se face acum.

## 2. Pasul 4: al doilea val de migrare, toate cele 15 module
Ordinea: **Dashboard → Copii (listă, fișă, zile de naștere) → Achitări → Prezența →** Grupe → Cheltuieli → Situația plăților → De notificat → De rezolvat (taxe, verificare, asociere) → Vizite → Personal → Bazin → Raport contabil → Mesaje SMS și Notificări → Administrare (Istoric, Backup și setări, Conflicte).

Pentru fiecare modul, în ordinea asta:
1. Citește lista de componente a modulului din `DS-IMPLEMENTARE.md` §3 și spec-ul din `screens/`.
2. Înlocuiește tot ce e local cu componenta din `@shared/ui`, inclusiv restructurarea layoutului unde §3 o cere (`MasterDetail`, `Board`, `Wizard`, `Tabs`, `PageHeader`). Logica de date (hook-urile `use*`) nu se schimbă; dacă o restructurare o cere, te oprești și scrii în `INTREBARI.md`.
3. Scoate fișierele modulului din **toate** allowlist-urile din `architecture.test.ts` (R1, R2, R3, R7, R9 text, R9 import). Nicio intrare nouă nu se adaugă, niciodată.
4. Fără `className` pe `Button`, `Card`, `Badge` pentru alt aspect. Dacă lipsește o variantă, se adaugă în componentă, cu test și secțiune în `/design-system`.
5. Culori doar prin tokeni. Tipar: `--print-ink`, `--print-muted`, `--print-rule`, `PrintTable`, `ThermalBlock`.
6. **Captură design lângă cod:** deschide artboard-ul din `docs/design/*.dc.html` și ecranul real la 1440×900 (plus 1024 dacă spec-ul are responsive). Salvează `docs/design/verificare/<NN>-<modul>.png` (stânga design, dreapta cod). Listează diferențele rămase în `docs/design/verificare/<NN>-<modul>.md`; ce e deviere acceptată se trece acolo cu motivul.
7. Bifează criteriile de acceptare din spec. `npm run check` + `cd webapp && npm run typecheck && npm test` verzi.
8. Commit `ui(<modul>): val 2, pe design system — docs/design/screens/<NN>`. Treci la următorul fără să aștepți.

Test pentru date financiare (Achitări, Cheltuieli, Situația, Raport, De rezolvat): înainte și după migrare, totalurile afișate pe o bază de test fixă sunt identice. Adaugă testul dacă nu există.

## 3. La final
- Toate allowlist-urile din `architecture.test.ts` sunt goale, iar regulile devin stricte (se șterge mecanismul de excepții).
- `DS-IMPLEMENTARE.md` §3: fiecare modul bifat.
- `docs/design/verificare/README.md`: tabel cu cele 15 module, link la captură, diferențe rămase.

## 4. După migrare, task separat
**21c „Lucrez fără legătură” + „Ultima sincronizare”:** persistă `lastSyncedAt` în `sync.json` din `sync-engine.service.mjs`, expune-l în `/api/session` (`syncSummary`), apoi construiește 21c după `Incarcare.dc.html`. Plan scurt în `docs/superpowers/plans/` înainte de cod.

## Nu se face
Documentele copilului (`child_documents`, `DocumentCard`). `child_notes` ca tabel separat (amânat până la multi-device). IBAN pe plătitori reținuți (plan tehnic separat, mai târziu). Plus tot ce era în „Nu se face” din `PROMPT-CLAUDE-CODE-3.md`.

## Te oprești doar dacă
- o restructurare de layout cere schimbarea logicii de date;
- un spec contrazice componenta din design system;
- `npm run check` rămâne roșu după 2 încercări.
Scrie întrebarea în `docs/design/INTREBARI.md` și treci la modulul următor.
