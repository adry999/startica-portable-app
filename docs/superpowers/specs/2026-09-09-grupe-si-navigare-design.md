# Grupe ca entitate reală + reordonare navigare

## Context

Navigarea actuală grupează paginile în „Operațiuni / Rapoarte / Administrare”. Utilizatorul vrea ordinea: Dashboard, (Personal — amânat), Copii, Grupe, apoi o secțiune nouă „Contabilitate” cu tot ce ține de bani.

„Grupe” este azi doar un câmp text liber pe fiecare copil (`children.group`); pagina Grupe le derivă la afișare. Nu există entitate, capacitate sau atribuire dedicată. Utilizatorul vrea grupe reale: create, denumite, cu capacitate fixă (ex. 10 copii), atribuire copii atât din pagina Grupe cât și din fișa copilului, și un semnal vizual când o grupă depășește capacitatea (fără blocare).

Pagina „Personal” (staff) este cerută dar amânată explicit pentru altă etapă — nu face parte din acest spec.

## Decizii confirmate cu utilizatorul

- Capacitate: număr fix per grupă (opțional; dacă lipsește, nu se afișează limită).
- Depășire capacitate: permisă, doar avertizare vizuală (nu blocaj).
- Atribuire copil→grupă: posibilă din pagina Grupe (alegi copii pentru o grupă) ȘI din editorul de copil (alegi grupa copilului).
- Ștergere grupă cu copii atribuiți: **blocată** — trebuie mutați întâi toți copiii.
- Grupele existente (string-uri libere) se migrează automat în entități noi, păstrând numele.

## Model de date

`shared/domain.mjs`:
- `TYPES` devine `['children', 'payments', 'expenses', 'groups']`.
- `FIELDS.groups = new Set(['id', 'name', 'capacity', 'archived', 'archivedAt'])`.
- `normalizeRecord('groups', …)`: `name` text obligatoriu, unic (case-insensitive, trim) printre grupele nearhivate; `capacity` opțional, întreg 1–1000 dacă prezent.
- `FIELDS.children`: `group` (string) → `groupId` (string, referință opțională la `groups.id`, ca `payments.childId`).
- `normalizeRecord('children', …)`: dacă `groupId` prezent, nu se validează existența aici (validarea de existență rămâne la nivel de rută, ca la `payments.childId`).

## Migrare

`server/migrations.mjs`, versiunea următoare (2):
1. Colectează valorile distincte, nevide, din `children.group` (trim).
2. Pentru fiecare, creează o înregistrare `groups` cu acel nume (id generat).
3. Pentru fiecare copil, setează `groupId` = id-ul grupei corespunzătoare numelui său (dacă avea `group` nevid); șterge câmpul `group`.
4. Rulează o singură dată, cu backup automat înainte (mecanism existent).

## API

- `/api/record` (deja generic prin `normalizeRecord(b.type, …)`): acceptă `type:'groups'` fără modificări de rută. Validare nume unic se face în `normalizeRecord`.
- Când `b.type === 'children'` și `r.groupId` setat: rută validează `store.recordExists('groups', r.groupId)` (mesaj: „Grupa asociată nu există.”), după modelul existent pentru `payments.childId`.
- Rută nouă `/api/record-delete` (sau extensie `mode:'delete'` pe `/api/record`, de decis la implementare după convenția din `routes.mjs`): șterge o grupă doar dacă niciun copil nearhivat nu are acel `groupId`; altfel `fail('Mută mai întâi copiii din grupă.')`.

## UI

- **Pagina Grupe** (`web/ui/views.mjs` → `renderGroups`, plus markup în `index.html`): card per grupă cu nume, capacitate (dacă există), „X/Y copii” sau „X copii” fără limită; stil de avertizare (roșu/portocaliu) dacă X > Y. Formular creare grupă (nume + capacitate opțională). Din card: atribuire copii (listă bifabilă a copiilor nearhivați), redenumire, editare capacitate, ștergere (dezactivată/mesaj dacă are copii).
- **Editor copil** (`web/ui/editor.mjs`): câmpul grupă trece din input+datalist în `<select>` cu opțiunile grupelor existente + „fără grupă”.
- **Taxe și grupe** (`web/ui/fees.mjs`): coloana grupă din tabelul de completare în masă trece din input liber în `<select>`, aceeași sursă de opțiuni.
- **Rezumat Copii** (`renderChildrenSummary`): „Grupe ocupate” = grupe nearhivate cu cel puțin un copil nearhivat (calculat prin `groupId`, nu prin string).
- **Export/import**: `shared/excel.mjs` (coloana „Grupa”) și `server/children-csv.mjs` citesc/scriu numele grupei rezolvat prin `groupId → groups.find(...).name`, nu string brut.
- **Review center** (`shared/review-center.mjs`, linia „Grupă lipsă”): verifică `!c.groupId` în loc de `!c.group`.

## Navigare

`web/index.html`, `#primaryNav`, ordine nouă:

```
Dashboard, Copii, Grupe   (fără header de grup, sau header generic — de stabilit la implementare, non-critic)
Contabilitate: Achitări, Cheltuieli, Situația plăților, Asociere achitări, De notificat, Taxe și grupe
Administrare: De verificat, Istoric, Backup și setări
```

Pagina „Personal” nu se adaugă acum.

## Testare

Fără teste noi în această etapă (cost token/usage). Se ajustează doar testele existente care rup din cauza redenumirii `group`→`groupId` (children-csv, financial-import, fixes, review-center), ca suita curentă să treacă în continuare. Fără verificare browser dedicată.

## În afara scopului

- Pagina „Personal” (staff) — cerută, amânată explicit.
- Redenumirea etichetei „Achitări” în „Încasări” — nu a fost cerută explicit, se păstrează eticheta actuală.
- Orice schimbare de backend, bază de date sau publicare dincolo de ce e descris aici.
