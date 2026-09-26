# 02 — Copii → listă

**Referință:** `Copii.dc.html#1c`. **Depinde de:** `00-comun.md` A, B, C, E.

## 1. Fișiere
Se modifică: `webapp/src/features/children/ChildrenPage.tsx`, `ChildrenPage.module.css`, `ChildrenPage.test.tsx`. Hook-ul `useChildren.ts` rămâne neschimbat, cu excepția filtrelor din secțiunea 3.

## 2. Antet (prin `useTopbarActions`)
`[Zile de naștere]` (secundar, navighează la `/copii/zile-de-nastere`) · `[+ Adaugă copil]` (primar, deschide `ChildFormDrawer`).
**Nu** există butonul „Import CSV”. Importul se face din Backup și setări.

## 3. Arbore
```tsx
<div className={s.content}>                         {/* padding:28px 40px 40px; gap:18px */}
  <div className={s.stats}>                          {/* grid 3 col, gap 14 */}
    <Stat tone="orange" value={activeCount} label="Copii activi" />
    <Stat tone="mint"   value={groupsUsed}  label="Grupe ocupate" />
    <Stat tone="yellow" value={toReview}    label="Fișe de verificat" action={<Link to="/de-verificat">Verifică →</Link>} />
  </div>
  <div className={s.tableCard}>
    <div className={s.toolbar}>
      <Search placeholder="Caută copil, părinte sau telefon" />
      <SegmentedControl options={[Activi · N, Arhivați · N, Toți]} />
    </div>
    <FilterPills groups={[
      { label:'Grupa', options:[Toate(neutral), ...grupe(groupTone), Fără grupă(neutral)] },
      { label:'Plată', options:[Toate(neutral), Achitat(mint), Parțial(yellow), Neachitat(pink)] },
    ]} />
    {selected.length > 0 && <SelectionBar />}         {/* fundal slate: „N selectați | Mută în grupă · Exportă · Arhivează … Anulează ×” */}
    <div className={s.headRow}>☐ · Copil · Părinte · telefon · Grupă · Scadență · Plată luna curentă · ⋯</div>
    {rows.map(r => <ChildRow … onClick={() => onOpenChild(r.id)} />)}
    <Pagination text="Afișez 1–8 din 99" />
  </div>
</div>
```
- **Grid rând:** `grid-template-columns:44px 2.4fr 2fr 1fr 1fr 1.3fr 48px`.
- **Celula Copil:** avatar de 38px cu inițiale (fundal/ink după `groupTone`) + nume 14/800 + „Contract #3 · 4 ani” 12px `--subtle`.
- **Grupă:** `Badge` cu tonul din `groupTone`. **Plată:** `Badge` cu punct de 6px în culoarea ink.
- **⋯:** `RowMenu` cu Editează · Arhivează/Reactivează · separator · Șterge definitiv (roșu). Click pe ⋯ nu deschide fișa (`stopPropagation`).

## 4. Stări
Fără rezultate → 3e „Fără rezultate”, cu filtrele active listate și butonul „Șterge filtrele”. Orice schimbare de filtru resetează paginarea la pagina 1.

## 5. Criterii de acceptare
- [ ] Fără dropdown-urile „Grupă ▾” și „Plată ▾”; în locul lor, `FilterPills` cu 2 grupuri separate de linia verticală
- [ ] Butoanele din antet: Zile de naștere + Adaugă copil; fără Import CSV
- [ ] Culorile grupelor sunt identice cu cele din Grupe și din Zile de naștere
- [ ] Click pe rând → `/copii/:id`; click pe ⋯ nu navighează
