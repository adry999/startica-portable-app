# Roadmap modularizare + funcții noi — 26 septembrie 2026

Plan comun, combină auditul `docs/superpowers/specs/2026-09-26-code-audit.md` (fable, `master-v2` @ `d91ae83`) cu task-ul UI în lucru (`docs/design/URMATORUL-PAS.md`) și cele trei funcții mari cerute de utilizator: monedă EUR/BNM, SMS (sms.md), multi-grădiniță cu sincronizare.

Scop: proiect modular (nu monolit), fără erori (`npm run check` verde), teste per modul, ușor de adăugat module noi, pregătit pentru lucru cu 2 sesiuni concomitent pe module diferite.

## Ordinea fazelor

### Faza 0 — verde imediat (R1, mic)
- `.prettierignore`: adaugă `docs/design/`, scoate cele 3 intrări moarte pentru `web/`.
- `record-editing.routes.mjs:28`: restrânge tipul după `request.type` înainte de a citi `.status`.
- `compose-screens.mjs`/`main.mjs`: scoate cele 3 importuri către `payments`/`payment-assignment` (șterse în `a3cbfa3`).
- Rezultat: `npm run check` verde pe `master-v2` — azi nu e, nimeni n-are semnal de la care să plece.

### Faza 1 — termină ștergerea stratului vanilla (R2, mediu)
- Șterge `src/app/web/`, `src/features/*/web/`, `src/shared/ui/` (minus 3 fișiere folosite), `src/core/web/` (minus 3 fișiere folosite) — cod mort, servit de nimeni, 49% din `src/`, 135 teste moarte.
- Actualizează 14 README-uri de feature + `SKILL.md` (:26, :33, :58, :60, :84 — descriu stratul vechi ca fiind curent).
- **Trebuie înainte de Faza 4 (monedă)**, altfel UI-ul de monedă se scrie de două ori (o dată pe stratul mort, o dată pe React).

### Faza 2 — gardă de arhitectură webapp (R3+R4, mic)
- Test Vitest `webapp/src/architecture.test.ts`: feature nu importă feature, feature nu importă `app/`.
- Plantează eșecul pe încălcarea reală găsită (`ChildrenPage.tsx:23` → `payments` intern), apoi repară: `TopbarActions`/`ViewKey` mută în `shared/`; drawer-ul de achitare din fișa copilului trece prin ruta `/achitari/nou?copil=` care deja există, sau `payments/index.ts` exportă API public explicit.

### Faza 3 — componente reutilizabile + task-ul UI curent (R5, mediu) ← **ÎN LUCRU ACUM**
Task-ul original (`URMATORUL-PAS.md`) se extinde puțin față de plan, pentru că auditul a găsit deja 2-3 copii ale aceloraşi tipare — a adăuga o a treia copie (⋯ pe Vizite) ar contrazice recomandarea R5 „extrage înainte de a mai adăuga o copie”:
1. **`RowMenu` nou în `shared/ui`** — înlocuiește `<details className={styles.rowMenu}>` din `ChildrenPage.tsx` ȘI `ExpensesPage.tsx` (copiate identic azi), plus îl folosește `VisitsPage.tsx` (înlocuiește cele 5 linkuri de pe rând, per cerința inițială).
2. **`FilterPills`**: Copii (Grupă + Plată), Vizite (Statut + contor „N vizite”). *(Achitări/Cheltuieli/Situația rămân pentru o sesiune viitoare — nu le bag acum, ca să nu explodeze scopul.)*
3. **`groupTone` unificat**: `GroupsPage` (Carduri) + `GroupsBoard` (Tablă) + avatarele din `ChildrenPage` — azi sunt 3 algoritmi diferiți de culoare pentru aceeași grupă.
4. **`SelectionBar` nou în `shared/ui`** — înlocuiește cele 3 copii (`ChildrenPage`/`ExpensesPage`/`PaymentsPage`).

Ce rămâne pentru altă sesiune (notat, nu ignorat): `Button` unificat (14 fișiere CSS cu `.btnPrimary`), `SearchInput` unificat, R6 (confirmări `window.confirm` → drawer „Scrie ȘTERGE”), R7 (curățenie comentarii/nume), R9 (rute per feature, scoate `App.tsx` din fișierele fierbinți), R10 (împarte `ChildrenPage.tsx`/`ExpensesPage.tsx`).

### Faza 4 — monedă EUR/BNM (R8, mediu backend + mare UI)
- După Faza 1. Cherry-pick commit-urile de domeniu/server din `.worktrees/feat-multi-currency-fees` (branch pornit greșit din `master`, nu din `master-v2` — se rezolvă conflictele la cherry-pick).
- UI nou, de la zero, în `webapp/` după `docs/design/screens/16-planuri-eur.md` (nu există deloc azi pe React).
- Atinge fișiere fierbinți (`record-types.d.mts`) — de făcut într-o sesiune fără alt task concurent pe acelaşi fişier.

### Faza 5 — SMS via sms.md (greenfield, nou spec necesar)
- Provider: `sms.md` (https://docs.sms.md/), ales de utilizator.
- Șablon: `src/features/telegram-notify/` (service cu `fetch` injectat, `test-support/fake-*-api.mjs`, config repository, rute) → `src/features/sms-notify/` + `webapp/src/features/sms/`.
- Șabloanele de mesaj, dacă SMS le refolosește de la `billing/domain/reminder-message.mjs`, trec în `#shared/domain/`.
- **Are nevoie de un spec dedicat înainte de cod** (auth API sms.md, format telefon, cost/credit, retry) — nu e detaliat aici.

### Faza 6 — multi-grădiniță cu sincronizare (cea mai mare, spec dedicat necesar)
Diferă de cele 2 forme din audit (care erau doar „alege folder local la lansare” / „comută în aplicație”, ambele un singur calculator): utilizatorul vrea **sincronizare între 2 calculatoare separate**, printr-un **server mic de reconciliere** (nu SaaS multi-tenant complet — decizie explicită 2026-09-26, vezi memorie `project_roadmap_2026-09-26`).
- Cere spec nou: ce înseamnă „reconciliere” concret (conflict pe aceeaşi înregistrare editată în 2 locuri), transport, autentificare instalare↔server, cum interacţionează cu `runRevisionTransaction`/modelul de revizie din `#core/`.
- Se face **ultima** — cea mai riscantă, şi beneficiază de Faza 1-3 deja aplicate (structură curată înainte de a adăuga sincronizare distribuită).

## Ce NU facem acum
- Nu pornim Faza 4/5/6 fără spec scris + plan aprobat, per convenţia proprie a repo-ului (fiecare audit anterior a fost urmat de un plan separat înainte de cod).
- Nu ştergem worktree-ul `feat-multi-currency-fees` până nu se face cherry-pick-ul (Faza 4).

## Ordinea de execuţie propusă
Faza 0 → Faza 1 → Faza 2 → **Faza 3 (acum)** → Faza 4 → spec Faza 5 → cod Faza 5 → spec Faza 6 → cod Faza 6.
