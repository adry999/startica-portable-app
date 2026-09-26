# 01 — Copii → Zile de naștere

**Referință:** `Copii.dc.html#2a`. **Depinde de:** `00-comun.md` A (useTopbarTitle), B (FilterPills), C (groupTone).

## 1. Rută și fișiere
| Acțiune | Fișier |
|---|---|
| nou | `webapp/src/features/children/BirthdaysPage.tsx` |
| nou | `webapp/src/features/children/BirthdaysPage.module.css` |
| nou | `webapp/src/features/children/useBirthdays.ts` |
| nou | `webapp/src/features/children/BirthdaysPage.test.tsx`, `useBirthdays.test.ts` |
| nou | `src/features/children/domain/birthdays.test.mjs` (dacă nu există) |
| modificat | `src/features/children/domain/birthdays.mjs`: funcție nouă `buildBirthdayMonth` (vezi 3) |
| modificat | `webapp/src/features/children/index.ts`: `export { BirthdaysPage }` |
| modificat | `webapp/src/app/App.tsx`: rută nouă |
| modificat | `webapp/src/features/children/ChildrenPage.tsx`: buton în antet |
| modificat | `webapp/src/features/dashboard/DashboardPage.tsx`: link „Vezi calendarul →” |

**Ruta:** în `App.tsx`, adaugă **înainte** de `/copii/:childId`, altfel „zile-de-nastere” e tratat ca id de copil:
```tsx
<Route path="/copii/zile-de-nastere" element={<BirthdaysPage />} />
<Route path="/copii/:childId" ... />
```
`viewForPathname` întoarce deja `children`, deci sidebarul arată „Copii” activ fără altă modificare. Verifică și că niciun copil nu poate avea id-ul `zile-de-nastere` (id-urile sunt generate, deci e în regulă).

## 2. Intrări în pagină
- **Copii (1c):** în `useTopbarActions` din `ChildrenPage`, înainte de „+ Adaugă copil”, adaugă un buton secundar „Zile de naștere” care face `navigate('/copii/zile-de-nastere')`.
- **Dashboard (1a):** în cardul Zile de naștere, în capul coloanei „Toată luna …”, adaugă un link text „Vezi calendarul →” (13px/800, `var(--orange-ink)`) spre `/copii/zile-de-nastere?luna=<YYYY-MM al Dashboard-ului>`.

## 3. Date
`buildBirthdayCalendar` existentă arată doar luna de azi și nu știe de grupe. Nu o modifica, pentru că Dashboard-ul o folosește. Adaugă lângă ea:

```js
/**
 * @typedef {{ childId: string, name: string, firstName: string, lastInitial: string,
 *             turningAge: number, groupId: string | null }} BirthdayEntry
 * @typedef {MonthGridDay & { entries: BirthdayEntry[], isPast: boolean, isWeekend: boolean }} BirthdayMonthDay
 * @param {Array} children     copiii din records (nearhivații se filtrează aici)
 * @param {string} monthKey    'YYYY-MM'
 * @param {string} todayStr    'YYYY-MM-DD'
 * @returns {{ weeks: BirthdayMonthDay[][], list: (BirthdayEntry & { date: string, day: number })[] }}
 */
export function buildBirthdayMonth(children, monthKey, todayStr = today())
```
Reguli:
- Grila vine din `buildMonthGrid(monthKey, todayStr)`, cu săptămâni Luni–Duminică.
- Potrivirea se face ca în `isBirthdayOn`, inclusiv 29 februarie → 28 în anii nebisecți. Refolosește funcția, nu o copia.
- `turningAge = anul celulei − anul nașterii`.
- `isPast = cell.date < todayStr`. `isWeekend`: coloanele 6 și 7.
- Celulele cu `inMonth:false` au `entries: []`: pe zilele din lunile vecine nu apar nume.
- `list` conține doar zilele din lună, sortate după zi, apoi după nume (`localeCompare(…, 'ro')`).
- `firstName` / `lastInitial`: numele e salvat „Nume Prenume”, deci `firstName = ultimul cuvânt` și `lastInitial = prima literă a primului cuvânt + '.'`. Exemplu: „Cujba Ovidiu” → „Ovidiu C.”.
- `groupId`: câmpul grupei de pe copil. Verifică numele exact în `src/contracts/record-types.mjs`.

**Hook** `useBirthdays.ts`:
```ts
export function useBirthdays(initialMonth: string) {
  // state: month ('YYYY-MM'), group ('all' | groupId)
  // records din useAppSession().state.state → children, groups
  // const data = useMemo(() => buildBirthdayMonth(children, month, today()), [children, month]);
  // filtrarea pe grupă se face AICI, pe entries și pe list (nu în funcția de domeniu)
  return { month, setMonth, prevMonth, nextMonth, goToday, group, setGroup,
           weeks, list, count: list.length, groups /* [{id,name,tone}] */ };
}
```
`initialMonth` vine din `?luna=` dacă e valid, altfel `today().slice(0,7)`. Luna **nu** se sincronizează cu selectorul de lună global.

## 4. Arbore de componente
```tsx
// useTopbarTitle({ title: 'Zile de naștere', eyebrow: 'Evidență · Copii' })
// useTopbarActions(<>
//   <button className={s.btnSecondary} onClick={goToday}>Azi</button>
//   <MonthStepper value={month} onPrev={prevMonth} onNext={nextMonth} />   // vezi 5
// </>)
<div className={s.page}>
  <FilterPills
    groups={[{ label: 'Grupa', value: group, onChange: setGroup,
               options: [{ value:'all', label:'Toate', tone:'neutral' }, ...groups.map(g => ({ value:g.id, label:g.name, tone:g.tone }))] }]}
    trailing={pluralRo(count, 'zi de naștere', 'zile de naștere')} />
  <div className={s.body}>
    <section className={s.calendar} aria-label={`Calendar ${monthLabel}`}>
      <div className={s.weekdays}>{['Lu','Ma','Mi','Jo','Vi','Sâ','Du'].map(d => <span key={d}>{d}</span>)}</div>
      <div className={s.grid}>
        {weeks.flat().map(c => (
          <div key={c.date} className={cx(s.cell, !c.inMonth && s.outside, c.isWeekend && s.weekend,
                                         c.isPast && s.past, c.isToday && s.today)}>
            {c.inMonth && <span className={s.dayNum}>{c.day}</span>}
            {c.entries.slice(0, 2).map(e => (
              <Link key={e.childId} to={`/copii/${e.childId}`} className={cx(s.chip, s[tone(e.groupId)])}>
                <span className={s.chipName}>{e.firstName} {e.lastInitial}</span>
                <span className={s.chipAge}>{e.turningAge}</span>
              </Link>))}
            {c.entries.length > 2 && <span className={s.more}>+{c.entries.length - 2} copii</span>}
          </div>))}
      </div>
    </section>
    <aside className={s.side}>
      <h2 className={s.sideTitle}>Toată luna</h2>
      {list.length === 0
        ? <p className={s.empty}>Nicio zi de naștere pentru filtrul ales.</p>
        : list.map(e => (
          <Link key={e.childId} to={`/copii/${e.childId}`} className={cx(s.item, e.date < todayStr && s.past)}>
            <span className={cx(s.itemDay, s[tone(e.groupId)])}>{e.day}</span>
            <span className={s.itemText}>
              <strong>{e.name}</strong>
              <small>împlinește {e.turningAge} {e.turningAge === 1 ? 'an' : 'ani'} · {groupName(e.groupId)}</small>
            </span>
          </Link>))}
    </aside>
  </div>
</div>
```
**`MonthStepper`**: dacă `MonthPicker` existent poate primi `onPrev`/`onNext` fără meniu, folosește-l pe el. Altfel creează `shared/ui/MonthStepper.tsx`, cu același aspect ca selectorul de lună din Dashboard: pill `var(--yellow-soft)`, border `#f6e3a6`, padding 4; butoane albe rotunde de 32px „‹” „›”; text Baloo 700 16px, `min-width:150px`, centrat, „Septembrie 2026”.

## 5. CSS (`BirthdaysPage.module.css`)
```css
.page      { display:flex; flex-direction:column; }
.body      { display:grid; grid-template-columns:minmax(0,1fr) 300px; min-height:0; }
.calendar  { padding:18px 24px 28px 40px; display:flex; flex-direction:column; gap:6px; }
.weekdays  { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:6px; text-align:center;
             font-size:12px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:var(--subtle); }
.grid      { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:6px; }
.cell      { min-height:92px; padding:7px; border-radius:var(--radius-md); background:#fff; border:1px solid var(--border);
             display:flex; flex-direction:column; gap:4px; min-width:0; }
.weekend   { background:var(--neutral-softer); }
.outside   { background:transparent; border-color:transparent; }
.past      { opacity:.5; }
.today     { border:2px solid var(--orange); padding:6px; }       /* padding compensează border-ul */
.today .dayNum { color:var(--orange); }
.dayNum    { font-family:var(--font-heading); font-weight:800; font-size:16px; line-height:1; color:var(--slate); }
.chip      { display:flex; align-items:center; gap:4px; padding:3px 7px; border-radius:var(--radius-pill);
             font-size:11px; font-weight:700; color:var(--slate); text-decoration:none; min-width:0; }
.chipName  { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.chipAge   { font-weight:800; }                                   /* culoarea = ink-ul tonului */
.more      { font-size:11px; font-weight:800; color:var(--muted); padding-left:4px; }
.side      { border-left:1px solid var(--border); background:#fff; padding:18px 20px; display:flex; flex-direction:column; gap:8px; }
.sideTitle { margin:0 0 4px; font-family:var(--font-body); font-size:12px; font-weight:800; letter-spacing:.08em;
             text-transform:uppercase; color:var(--muted); }
.item      { display:flex; align-items:center; gap:12px; padding:8px 10px; border-radius:var(--radius-md);
             background:var(--cream); color:var(--slate); text-decoration:none; }
.item:hover{ background:var(--yellow-soft); }
.itemDay   { width:36px; height:36px; border-radius:var(--radius-sm); display:flex; align-items:center; justify-content:center;
             font-family:var(--font-heading); font-weight:800; font-size:17px; flex-shrink:0; }
.itemText  { display:flex; flex-direction:column; min-width:0; }
.itemText strong { font-size:14px; font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.itemText small  { font-size:12px; color:var(--muted); }
.empty     { font-size:14px; color:var(--muted); margin:0; }
/* tonuri: fundal soft + text ink, identic cu FilterPills */
.orange { background:var(--orange-soft); } .orange .chipAge, .itemDay.orange { color:var(--orange-ink); }
.mint   { background:var(--mint-soft); }   .mint .chipAge,   .itemDay.mint   { color:var(--mint-ink); }
.yellow { background:var(--yellow-soft); } .yellow .chipAge, .itemDay.yellow { color:var(--yellow-ink); }
.pink   { background:var(--pink-soft); }   .pink .chipAge,   .itemDay.pink   { color:var(--pink-ink); }
.neutral{ background:var(--neutral-soft); }.neutral .chipAge,.itemDay.neutral{ color:var(--muted); }
@media (max-width:1279px) { .body { grid-template-columns:1fr; } .side { border-left:0; border-top:1px solid var(--border); } }
```

## 6. Stări
| Stare | Comportament |
|---|---|
| Încărcare (records încă null) | grila cu celule goale; lista arată „Se încarcă…” (14px, muted) |
| Lună fără zile de naștere | grila goală; lista: „Nicio zi de naștere în luna aceasta.” |
| Filtru fără rezultate | lista: „Nicio zi de naștere pentru filtrul ales.” |
| Copil fără dată de naștere / arhivat | nu apare nicăieri |
| Mai mult de 2 copii într-o zi | 2 chip-uri + „+N copii”; lista din dreapta îi arată pe toți |
| Luna curentă | `.today` pe ziua de azi; zilele de dinainte au `.past` |
| Lună trecută | toate zilele au `.past`; lună viitoare: niciuna |
| Copil fără grupă | ton `neutral`, în listă „Fără grupă” |

## 7. Interacțiuni
- „‹” / „›” schimbă luna; trecerea decembrie → ianuarie schimbă și anul. „Azi” duce la luna curentă.
- Filtrul de grupă se păstrează la schimbarea lunii.
- Click pe un chip sau pe un rând din listă → `/copii/:childId`.
- Săgețile ← → de pe tastatură schimbă luna doar dacă focusul nu e într-un input.
- Luna aleasă se scrie în URL (`?luna=YYYY-MM`, cu `replace`), ca Înapoi din fișa copilului să revină la aceeași lună.

## 8. Teste
`birthdays.test.mjs` (domeniu):
- un copil născut pe 11.09.2023, vizualizat în 2026-09 → ziua 11, `turningAge 3`;
- 29.02.2020 în 2027-02 → apare pe 28; în 2028-02 → apare pe 29;
- copil arhivat sau fără `birthDate` → absent;
- celulele `inMonth:false` au `entries` goale;
- `list` e sortată după zi, apoi după nume.

`BirthdaysPage.test.tsx`:
- titlul „Zile de naștere” apare în antet;
- click pe „›” → „Octombrie 2026”; „Azi” revine la luna curentă;
- filtrul pe o grupă ascunde copiii din celelalte grupe, și în grilă, și în listă; contorul se actualizează;
- 3 copii în aceeași zi → 2 chip-uri + „+1 copii”;
- click pe un rând din listă navighează la `/copii/<id>`;
- `/copii/zile-de-nastere` nu deschide fișa unui copil (testul de rută).

## 9. Criterii de acceptare
- [ ] Ruta `/copii/zile-de-nastere` e declarată înaintea `/copii/:childId`
- [ ] Sidebarul are „Copii” activ; antetul arată „Zile de naștere” + „EVIDENȚĂ · COPII”
- [ ] Butonul „Zile de naștere” din Copii și linkul din Dashboard duc aici; din Dashboard se deschide luna Dashboard-ului
- [ ] Grila are 7 coloane Lu–Du, celule de minimum 92px, weekendul pe `--neutral-softer`
- [ ] Ziua de azi are contur 2px orange; zilele trecute au opacitate .5
- [ ] Maximum 2 chip-uri pe zi + „+N copii”
- [ ] Culorile grupelor vin din `groupTone`, identice cu badge-urile din Copii
- [ ] Lista din dreapta are 300px, e sortată și are starea goală
- [ ] `buildBirthdayCalendar` și Dashboard-ul funcționează neschimbat
- [ ] `npm run typecheck` și `npm test` trec
