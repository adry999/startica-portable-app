# 04 — Vizite

**Referință:** `Vizite.dc.html#2a`. **Depinde de:** `00-comun.md` A, B, E.

## 1. Fișiere
Se modifică: `visits/VisitsPage.tsx`, `VisitsPage.module.css`, `VisitsPage.test.tsx`. `VisitFormDrawer`, `EnrollDrawer` și `useVisits` rămân.

## 2. Antet
`Vizite  ÎNSCRIERI` · `[+ Programează vizită]` (primar). **Nu** există „Activează notificările”.

## 3. Arbore
```tsx
<div className={s.content}>                          {/* padding:28px 40px 40px; gap:18 */}
  <div className={s.stats}>{/* pastile inline: număr Baloo 22 + etichetă 13px */}</div>
  <div className={s.top}>                             {/* grid 1.6fr 1fr; gap 18 */}
    <MonthCalendar cellHeight={72} selected={day} onSelect={setDay} />
    <DayPanel visit={selectedVisit}>
      {/* oră, copil + vârstă, părinte, grupă dorită, notă */}
      <h3>Cum a decurs vizita?</h3>
      <Outcome tone="mint">Efectuată</Outcome><Outcome tone="orange">S-a înscris</Outcome>
      <Outcome tone="neutral">Neprezentată</Outcome><Outcome tone="pink">A renunțat</Outcome>
      {/* Editează · Reprogramează · Arhivează */}
    </DayPanel>
  </div>
  <div className={s.tableCard}>
    <div className={s.toolbar}>
      <h2 className={s.tableTitle}>Toate vizitele</h2>  {/* Baloo 18/800 */}
      <Search placeholder="Caută după copil, părinte sau telefon" />
      <SegmentedControl options={[Toate · N, Programate · N, Arhivate]} />
      <Dropdown>Perioadă: 12 luni ▾</Dropdown>
    </div>
    <FilterPills groups={[{ label:'Statut', options:[
      Toate(neutral), Programată(yellow), Efectuată(mint), S-a înscris(orange), Neprezentată(neutral), A renunțat(pink) ] }]}
      trailing={`${n} vizite`} />
    <div className={s.headRow}>Data ↓ · Copil · vârstă · Părinte · telefon · Grupă dorită · Notă · Statut · ⋯</div>
    {rows.map(v => <VisitRow onClick={() => { setMonth(v.month); setDay(v.date); }} />)}
    <Pagination pageSize={20} />
  </div>
</div>
```
- **Grid rând:** `1.1fr 2fr 2fr 1fr 1.3fr 1.2fr 48px`.
- **Data:** zi 14/800 + oră 12px `--subtle`. **Notă:** o linie trunchiată, „—” dacă lipsește.
- **Statut:** `Badge` cu punct, în tonurile de mai sus.
- **⋯:** Editează · Reprogramează · Arhivează.
- Sortare implicită: data descrescătoare. Rândul vizitei selectate în calendar are fundal `--cream`.

## 4. Criterii de acceptare
- [ ] Tabelul „Toate vizitele” e sub calendar, cu toolbar + FilterPills pe statut
- [ ] Click pe rând selectează ziua în calendar și deschide panoul
- [ ] Culorile statutului sunt aceleași în butoanele „Cum a decurs vizita?”, în pastile și în badge-uri
- [ ] Fără „Activează notificările”
