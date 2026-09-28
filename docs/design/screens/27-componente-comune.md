# 27 — Componente comune: liste de persoane și fișe

**De ce:** Copii și Personal arată la fel (listă → fișă), dar în cod sunt scrise de două ori. O schimbare de aspect trebuie acum făcută în două locuri și, cu Candidați (23l), ar fi în trei. **Regula:** tot ce apare în ambele se mută în `shared/ui`; paginile de modul doar compun piesele și dau datele.

**Depinde de:** `00-comun.md`, `13-formulare.md`. **Folosit de:** 02 Copii, 09 Fișa copilului, 24 Personal (23a, 23j, 23l) și, mai târziu, Vizite și Achitări (celula cu persoana).

## Ce e dublat acum (verificat pe master-v2, 28.09)
| Ce | Copii | Personal |
|---|---|---|
| Tabelul | `DataTable` + `childrenColumns.tsx` | tabel scris de mână în `TeamView.tsx` (`headRow`, `sortButton`, `row`) |
| Avatar + nume + rândul mic | `childCell` în `ChildrenPage.module.css` | `nameCell` + `avatar` în `TeamView.module.css` |
| `initials()` | `@shared/format/initials` | **copie** în `@shared/personal/staff-labels` |
| Căutare + filtre | `ChildrenToolbar` | `toolbar` + `FilterPills` în `TeamView` |
| Fișa: breadcrumb, banda de sus, grila stânga/dreapta, secțiuni, mini-carduri, „nu a fost găsită” | `ChildProfileView` + `ChildrenPage.module.css` | `StaffProfilePage` + `StaffProfilePage.module.css` (aceleași clase: `profileHeader`, `profileAvatar`, `profileGrid`, `profileSection`, `miniCards`…) |

## Componente noi în `shared/ui`

### 1. `PersonCell`
```tsx
<PersonCell name="Coceva Alisa" sub="Contract 214" tone="orange" />   // tone: PillTone | 'neutral'
```
Avatar 30px cu inițiale (fundal `--{tone}-soft`, text `--{tone}-ink`), numele bold, `sub` pe rândul 2 (12px, `--muted`), cu ellipsis. `size="lg"` (64px) e varianta pentru banda fișei.
- Copii: `tone = groupTone(row.groupId)`, `sub = contract`.
- Personal: `tone = neutral`, `sub = „ambele filiale · ziua de naștere 3 oct”`.
- Candidați: `tone = neutral`, `sub` gol.

### 2. `DataTable` — două opțiuni noi (nu o componentă nouă)
- `groupBy?: { key: (row) => string; label: (key) => ReactNode; order?: string[] }`: rânduri-titlu între grupuri (pătrat de 10px în tonul grupului, nume bold, număr gri), ca departamentele din 23a.
- Sortarea din antet există deja prin `sortValue`; `TeamView` o folosește în loc de butoanele proprii.
- După asta, `TeamView` trece pe `DataTable` + `staffColumns.tsx` (ca `childrenColumns.tsx`). Tabelul scris de mână și CSS-ul lui se șterg.

### 3. `ListToolbar`
```tsx
<ListToolbar search={{ value, onChange, placeholder }} trailing="8 persoane">
  {/* opțional: SegmentedControl Active/Arhivate, butonul „Funcții” */}
</ListToolbar>
<FilterPills … />   // rămâne separat, dedesubt
```
Pe un rând: `SearchInput` (360px), apoi `children`, apoi `trailing` la dreapta (gri). `ChildrenToolbar` devine un wrapper subțire peste ea, iar Personal și Candidați o folosesc direct.

### 4. `ProfileLayout` + `ProfileSection` + `StatCard`
```tsx
<ProfileLayout
  back={{ label: 'Copii', onClick: onBack }}               // breadcrumb „Copii / Nume”
  header={{ name, tone, meta: <>5a 2l · Contract 214</>, badges: [{label:'Activ', tone:'mint'}, {label:'Mars', tone:'orange'}],
            actions: <><Button variant="white">Editează fișa</Button><Button>+ Plată</Button></> }}
  left={<>
    <ProfileSection title="Părinți">…</ProfileSection>
    <ProfileSection title="Note" tone="yellow">…</ProfileSection>
  </>}
  stats={[ <StatCard label="Sold" value="0 lei" tone="mint" sub="≈ … azi" />, … ]}   // maximum 3, pe un rând
  right={<>
    <ProfileSection title="Istoric plăți" action={{ label: 'Toate achitările →', onClick }}>…</ProfileSection>
  </>}
/>
```
- Banda de sus e `Card decorative` în `tone` (copil: culoarea grupei, conform `09`; angajat: `orange`), cu `PersonCell size="lg"` în stânga și `actions` în dreapta.
- Grila: stânga 360px, dreapta `minmax(0,1fr)`, gap 20. Sub 1200px, o singură coloană.
- `ProfileSection`: `Card` cu titlu (Baloo 18) + `action` opțional (link portocaliu) în dreapta titlului.
- `StatCard`: eticheta sus (12px uppercase), valoarea (Baloo 24), `sub` opțional și un link opțional.
- `ProfileNotFound({ back })`: „← Copii” + „Fișa nu a putut fi găsită.”
- **Un singur** `ProfileLayout.module.css`. Clasele `profile*` se șterg din `ChildrenPage.module.css` și din `StaffProfilePage.module.css`.

### 5. `initials()`
O singură sursă: `@shared/format/initials`. Se șterge din `staff-labels.ts`; importurile se actualizează.

## Ce NU se unifică
- Coloanele tabelelor (`childrenColumns`, `staffColumns`, `candidateColumns`) rămân în modulul fiecăruia: datele sunt diferite.
- Formularele (`ChildFormDrawer`, `StaffFormDrawer`, `CandidateFormDrawer`) rămân separate, dar folosesc același `Drawer` și aceleași câmpuri din `shared/ui`.
- Nu se face o „pagină generică de entitate”. Piesele se compun, nu se configurează dintr-un obiect mare.

## Ordinea (fiecare pas = un commit, fără schimbare vizibilă)
1. `initials()` unic.
2. `PersonCell`, folosit în `childrenColumns` și `TeamView`.
3. `DataTable.groupBy`, apoi `TeamView` pe `DataTable` + `staffColumns.tsx`.
4. `ListToolbar`, folosit în Copii și Personal.
5. `ProfileLayout`/`ProfileSection`/`StatCard`/`ProfileNotFound`, apoi `ChildProfileView` și `StaffProfilePage` pe ele; CSS-ul dublat se șterge.
6. Candidați (23l) se construiește direct din aceste piese.

## Criterii de acceptare
- [ ] Capturile de ecran pentru Copii, Fișa copilului, Personal → Echipa și Fișa angajatului sunt identice înainte și după (fără schimbare vizuală)
- [ ] `grep -r "profileHeader\|profileAvatar\|nameCell" webapp/src/features` nu mai găsește nimic
- [ ] `TeamView.tsx` nu mai are tabel scris de mână
- [ ] O schimbare în `PersonCell` sau `ProfileLayout` se vede în ambele module
- [ ] Teste: `PersonCell` (inițiale, ton, ellipsis), `DataTable.groupBy` (titluri, număr, ordine), `ProfileLayout` (breadcrumb, acțiuni, o coloană sub 1200px)
