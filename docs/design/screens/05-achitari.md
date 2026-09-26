# 05 — Achitări (Tabel / Pe luni)

**Referință:** `Achitari.dc.html#1i` (Tabel) și `#1j` (Pe luni). **Depinde de:** `00-comun.md` A, B, D, E.

## 1. Fișiere
Se modifică: `payments/PaymentsPage.tsx`, `.module.css`, `.test.tsx`.
Se creează: `payments/PaymentsTable.tsx`, `payments/PaymentsByMonth.tsx`, `payments/PaymentDetailPanel.tsx`.

## 2. Antet (identic în ambele moduri)
`Achitări  CONTABILITATE` · `[Tabel | Pe luni]` · `[Exportă]` (secundar) · `[+ Achitare nouă]` (primar).
Comutatorul folosește `usePersistedState('view.payments', 'table')`.

## 3. Mod Tabel (1i)
```tsx
<div className={s.content}>
  <div className={s.summary}>                         {/* grid 1.4fr 1fr 1fr 1fr; gap 14 */}
    <SumCard tone="orange" label={`Total filtrat · ${n} achitări`} value=… big />
    <SumCard label={`Cash · ${nCash}`}         value={sumCash}     active={method==='cash'} />
    <SumCard label={`Card · ${nCard}`}         value={sumCard}     active={method==='card'} />
    <SumCard tone="mint" label={`Transfer · ${nTr}`} value={sumTr} active={method==='transfer'} />
  </div>
  <div className={s.tableCard}>
    <div className={s.toolbar}>
      <Search placeholder="Caută copil, plătitor sau sumă" />
      <Dropdown>Perioadă: oricând ▾</Dropdown><Dropdown>Nearhivate ▾</Dropdown>
    </div>
    <FilterPills groups={[
      { label:'Metodă', options:[Toate(neutral), Cash(mint), Card(yellow), Transfer(orange)] },
      { label:'Grupa',  options:[Toate(neutral), ...grupe(groupTone)] } ]} />
    <ActiveFilters />                                  {/* chip-uri „Metodă: Transfer ×” + „Resetează” */}
    <div className={s.headRow}>☐ · Data ↓ · Copil · Plătitor · Metodă · Luni acoperite · Total · ⋯</div>
    {rows.map(p => <PaymentRow />)}
    {selected.length > 0 && <FloatingSelectionBar />}
  </div>
</div>
```
- **Cardurile pe metode** arată **mereu** suma reală pe metoda respectivă, independent de filtrul Metodă. Cardul metodei filtrate are `border:2px solid <ink>`, restul nu au contur. Total filtrat = suma rândurilor vizibile.
- **Grid rând:** `44px 0.9fr 1.7fr 1.5fr 0.9fr 1fr 1.1fr 48px`.
- **Copil:** numele copilului; dacă achitarea e neasociată: „—” + badge-link `Neasociată →` (pink) spre `/asociere-achitari`.
- **Plătitor:** numele din extras sau aliasul reținut („Ține minte plătitorul”); 14px `#5b666e`, pe o linie.
- **⋯ (`RowMenu`):** Editează · **Tipărește chitanța** (`/achitari/:id/confirmare`) · Schimbă copilul · Arhivează.
- **Bara de selecție:** „N selectate · suma | Asociază în De rezolvat → · Exportă · Arhivează … ×”.
- **Fără** filtrul „Copil ▾”: căutarea îl acoperă.

## 4. Mod Pe luni (1j)
- **Sub antet:** pastile `Toate · N` (activ slate) · `Neasociate · N` (pink) · `Arhivate` + căutare 240px + „Filtre · N”.
- **Grupuri pe lună:** titlu Baloo 18 + „N achitări” + subtotal dreapta; card alb radius 18 cu rânduri: zi Baloo 20 + lună 11px · copil (+ badge Neasociată) · „Plătitor · Metodă · Lună” 12px · sumă 110px dreapta.
- **Rândul activ:** `box-shadow: inset 4px 0 0 var(--orange)`, fundal `--cream`.
- **Panou dreapta (400px, `PaymentDetailPanel`):** header pink dacă e neasociată, altfel mint; sumă Baloo 38; caseta „Plătitor / Copil” + link „Asociază în De rezolvat →”; Luni acoperite; Data + Metodă. Footer: Arhivează (text roșu) · **Tipărește chitanța** (secundar) · Salvează (primar).
- Asocierea **nu** se face în panou. Singurul flux de asociere e `/asociere-achitari`.

## 5. Criterii de acceptare
- [ ] Antetul e identic în Tabel și în Pe luni (comutator + Exportă + Achitare nouă)
- [ ] Cardurile Cash/Card nu arată „0,00” doar pentru că filtrul e pe Transfer
- [ ] Coloana Plătitor există; neasociatele au Copil = „—”
- [ ] „Tipărește chitanța” apare în ⋯ și în panoul din 1j
- [ ] Niciun formular de asociere în afara paginii Asociere achitări
