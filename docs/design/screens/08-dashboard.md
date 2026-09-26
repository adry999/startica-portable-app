# 08 — Dashboard

**Referință:** `Dashboard.dc.html#1a`. **Depinde de:** `00-comun.md` A, C. Detaliile vizuale sunt în `CORECTII-master-v2.md` (carduri KPI).

## 1. Fișiere
Se modifică: `dashboard/DashboardPage.tsx`, `DashboardPage.module.css`, `DashboardPage.test.tsx`. `useDashboard.ts` rămâne neschimbat.

## 2. Antet
`Rezumatul lunii  PRIVIRE DE ANSAMBLU` · căutare globală (pill 300px, „Ctrl K”) · MonthPicker. Doar pe Dashboard apar căutarea și selectorul de lună.

## 3. Arbore
```tsx
<div className={s.content}>                          {/* padding:28px 40px 40px; gap:18 */}
  <div className={s.kpis}>                            {/* grid 1.5fr 1fr 1fr 1fr; gap 16 */}
    <Card tone="orange" decorative="lg">Încasări · 36px · bară stivuită cash/card/transfer + legendă</Card>
    <Card tone="mint"   decorative>Cheltuieli · 30px · „+ Adaugă cheltuială”</Card>
    <Card tone="yellow" decorative>Diferență · 30px · „încasări − cheltuieli”</Card>
    <Card tone="dashed">Avansuri nerepartizate · 30px · pastila „Toate lunile, până azi” jos</Card>
  </div>
  <div className={s.row2}>                            {/* grid 1.45fr 1fr; gap 16 */}
    <Card>Evoluția încasărilor · 12 bare · SegmentedControl Încasări/Cheltuieli</Card>
    <Card>Necesită atenție · 4 rânduri; rândul cu 0 e neutru, fără CTA</Card>
  </div>
  <Card className={s.birthdays}>                      {/* grid 380px 1fr */}
    <div>Următoarele 5 zile: listUpcomingBirthdays(children, 5)</div>
    <div>
      <div className={s.monthHead}><strong>Toată luna {luna}</strong>
        <Link to={`/copii/zile-de-nastere?luna=${month}`}>Vezi calendarul →</Link></div>
      {/* grid 4 col de chip-uri: zi Baloo 18 + nume; zilele trecute opacity .7 */}
    </div>
  </Card>
</div>
```
- **KPI:** fără umbră; label 12/800 uppercase ink; valoare Baloo 800 `--slate`, `white-space:nowrap`, fără zecimale („236.886 lei”).
- **Necesită atenție:** rânduri radius 16, padding `10px 12px`; contor în pătrat alb 52×44 Baloo 20; CTA „Vezi lista →”.
- **Zile de naștere:** folosește exclusiv funcțiile existente `listUpcomingBirthdays` și `buildBirthdayCalendar`; nu le modifica. Singura schimbare e linkul „Vezi calendarul →” (13px/800 `--orange-ink`).

## 4. Criterii de acceptare
- [ ] Sumele KPI sunt fără zecimale și încap pe un rând
- [ ] Rândul „Necesită atenție” cu 0 e gri, fără CTA
- [ ] „Vezi calendarul →” duce la `/copii/zile-de-nastere?luna=<luna Dashboard-ului>`
- [ ] Testele `useDashboard.test.ts` trec neschimbate
