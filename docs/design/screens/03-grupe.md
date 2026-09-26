# 03 — Grupe (Carduri / Tablă)

**Referință:** `Grupe.dc.html#1g` (Carduri) și `#1h` (Tablă). **Depinde de:** `00-comun.md` A, C, D.

## 1. Fișiere
Se modifică: `groups/GroupsPage.tsx`, `GroupsPage.module.css`, `GroupsPage.test.tsx`.
Se creează: `groups/GroupCards.tsx`, `groups/GroupBoard.tsx` (câte un `.module.css` pentru fiecare).

## 2. Antet (identic în ambele moduri)
```
Grupe  ORGANIZARE          „7 copii în grupe · 92 fără grupă”  [Carduri | Tablă]  [+ Grupă nouă]*
```
`*` Butonul „+ Grupă nouă” apare **doar** în modul Tablă. În Carduri, grupa nouă se creează din cardul dashed din grilă.
Comutatorul folosește `SegmentedControl`, persistat cu `usePersistedState('view.groups', 'cards')`.

## 3. Mod Carduri (1g)
```tsx
<div className={s.content}>                          {/* padding:28px 40px 44px; gap:20px */}
  <div className={s.cards}>                           {/* grid repeat(3,minmax(0,1fr)); gap 16 */}
    {groups.map(g => <GroupCard tone={groupTone(g.id)} open={openId===g.id} onToggle=… />)}
    <NewGroupCard />                                  {/* border 2px dashed #e0d5c2 */}
  </div>
  {openGroup && <GroupEditor group={openGroup} />}    {/* card alb radius 24, padding 24px 26px */}
</div>
```
- **GroupCard:** radius 24, padding `22px 24px`, fundalul tonului, cerc decorativ de 110px sus-dreapta, border 2px `transparent`; când e deschis, border 2px în culoarea tonului.
- **Conținutul cardului:** nume (Baloo 24) + ocupare „7/10” (Baloo 28 ink, „/10” 18px) → bară de 8px pe fond alb → educator + interval de vârstă (13px) + pastila „▾ Deschide / ▴ Restrânge” → stivă de avatare de 32px (`margin-right:-8px`, maximum 5, plus „+N”).
- Un singur editor e deschis la un moment dat (`openGroupId`).

## 4. Mod Tablă (1h)
```tsx
<>
  <div className={s.toolbar}>                         {/* padding:12px 40px; border-bottom; gap 8 */}
    <Search width={280} placeholder="Caută copil" />
    <Pill active>Doar activi</Pill>
    <span className={s.hint}>„−” restrânge o grupă, „⤢” o deschide</span>
    <Pill onClick={collapseAll} style="margin-left:auto">Restrânge tot</Pill>
    <Pill onClick={expandAll}>Deschide tot</Pill>
  </div>
  <div className={s.board}>                           {/* padding:24px 40px 32px; display:flex; gap:16 */}
    <Column key="none" name="Fără grupă" tone="neutral" />
    {groups.map(g => <Column tone={groupTone(g.id)} collapsed={…} />)}
  </div>
</>
```
- **Coloana deschisă:** `flex:1`, radius 22, padding 16. Antet: nume Baloo 20 + „7/10” + buton „−” de 28px; bară de capacitate de 6px; educator 12px.
- **Coloana restrânsă:** lățime 84px, verticală (⤢, număr, bară verticală de 80px, nume `writing-mode:vertical-rl`, 4 avatare).
- **Card copil:** alb, radius 14, padding `10px 12px`, mâner „⋮⋮”, avatar de 32px, nume, vârstă.
- **Drag & drop:** HTML5 DnD sau pointer events. Zona goală arată „Plasează aici” cu border 2px dashed `#7fc19c`. La drop se apelează funcția existentă de mutare în grupă din `useGroups`.
- Starea de restrângere se persistă cu `usePersistedState('groups.collapsed', {})`.

## 5. Criterii de acceptare
- [ ] Antetul e identic ca structură în ambele moduri (titlu, statistică, comutator)
- [ ] Toolbarul Tablei e sub antet, nu în antet
- [ ] Alegerea modului se păstrează după reîncărcare
- [ ] Culorile grupelor vin din `groupTone`
