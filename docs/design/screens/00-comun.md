# 00 — Componente comune

Se fac o singură dată, înainte de ecrane. Toate ecranele de mai jos le folosesc.

## A. Antet compact (Topbar)
**Fișiere:** `webapp/src/app/shell/Topbar.tsx`, `Topbar.module.css`, `TopbarActions.tsx`, `nav-items.ts`.

Înălțimea țintă e ~60 px, față de ~90 px acum. Titlul stă primul pe rând, eticheta secțiunii după el.

```tsx
<header className={styles.topbar}>
  <div className={styles.heading}>
    <h1 className={styles.title}>{titleOverride ?? title}</h1>
    <p className={styles.eyebrow}>{eyebrowOverride ?? eyebrow}</p>
  </div>
  <div className={styles.actions}>{/* căutare (Dashboard) · pageActions · MonthPicker */}</div>
</header>
```
```css
.topbar  { display:flex; align-items:center; justify-content:space-between; gap:var(--space-12);
           padding:12px 40px; border-bottom:1px solid var(--border); }
.heading { display:flex; align-items:baseline; gap:var(--space-12); min-width:0; }
.title   { margin:0; font-family:var(--font-heading); font-weight:800; font-size:24px; line-height:1.1; color:var(--slate); }
.eyebrow { margin:0; font-size:11px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:var(--subtle); }
```
- **Butoane în antet:** primar `padding:8px 18px; font-size:15px; box-shadow:0 4px 10px rgba(239,138,29,.28)`; secundar `padding:8px 16px; font-size:14px; border:1.5px solid var(--border); background:#fff`. Ambele sunt `border-radius:999px`.
- **Titlu propriu pe subpagini** (ex. Zile de naștere): adaugă în `TopbarActions.tsx` un al doilea slot, după același model ca `useTopbarActions`:
  ```ts
  export function useTopbarTitle(t: { title: string; eyebrow: string } | null): void
  ```
  Topbar folosește valoarea din slot dacă există, altfel `VIEW_TITLES[view]`. La demontare slotul se golește.
- Corectează `VIEW_TITLES`: `groups` și `visits` au eyebrow „Organizare” și „Înscrieri” (acum ambele sunt „Administrare”).

## B. Bara de filtre cu pastile — componentă nouă `FilterPills`
**Fișiere noi:** `webapp/src/shared/ui/FilterPills.tsx`, `FilterPills.module.css`. Se exportă din `shared/ui/index.ts`.

Se folosește sub bara de căutare în Copii, Vizite, Achitări, Cheltuieli, Situația și Zile de naștere.

```ts
export type PillTone = 'orange' | 'mint' | 'yellow' | 'pink' | 'neutral';
export interface FilterPillGroup<T extends string> {
  label: string;                       // „Grupa”, „Statut”, „Metodă”
  options: { value: T; label: string; tone: PillTone }[];
  value: T;
  onChange: (v: T) => void;
}
export interface FilterPillsProps {
  groups: FilterPillGroup<string>[];   // 1–2 grupuri, separate vizual
  trailing?: ReactNode;                // contor dreapta, ex. „12 zile de naștere”
}
```
```tsx
<div className={styles.bar} role="toolbar">
  {groups.map((g, i) => (<Fragment key={g.label}>
    {i > 0 && <span className={styles.sep} aria-hidden />}
    <span className={styles.label}>{g.label}</span>
    <div role="radiogroup" aria-label={g.label} className={styles.group}>
      {g.options.map(o => <button type="button" role="radio" aria-checked={o.value===g.value}
         className={`${styles.pill} ${styles[o.tone]} ${o.value===g.value ? styles.active : ''}`}
         onClick={() => g.onChange(o.value)}>{o.label}</button>)}
    </div>
  </Fragment>))}
  {trailing && <span className={styles.trailing}>{trailing}</span>}
</div>
```
```css
.bar      { display:flex; align-items:center; flex-wrap:wrap; gap:var(--space-8); padding:12px 16px; border-bottom:1px solid var(--border); }
.label    { font-size:13px; font-weight:700; color:var(--muted); margin-right:var(--space-4); }
.group    { display:flex; gap:var(--space-8); flex-wrap:wrap; }
.sep      { width:1px; height:22px; background:var(--border); margin:0 var(--space-8); }
.pill     { border:0; border-radius:var(--radius-pill); padding:6px 14px; font:800 13px var(--font-body); cursor:pointer; }
.orange   { background:var(--orange-soft);  color:var(--orange-ink); }
.mint     { background:var(--mint-soft);    color:var(--mint-ink); }
.yellow   { background:var(--yellow-soft);  color:var(--yellow-ink); }
.pink     { background:var(--pink-soft);    color:var(--pink-ink); }
.neutral  { background:var(--neutral-soft); color:var(--slate); }
.active   { background:var(--slate); color:#fff; }
.trailing { margin-left:auto; font-size:14px; font-weight:800; }
```
Opțiunea „Toate” are mereu `tone:'neutral'`. Dropdown-urile rămân doar pentru Perioadă și Arhivare.

## C. Culoarea unei grupe — helper nou
**Fișier nou:** `webapp/src/shared/ui/group-tone.ts`
```ts
const TONES: PillTone[] = ['orange', 'mint', 'yellow', 'pink'];
/** Grupele nu au culoare salvată. Culoarea vine din poziția grupei în lista sortată după nume, deci e stabilă. */
export function groupTone(groupId: string, groups: { id: string; name: string }[]): PillTone
// „Fără grupă” → 'neutral'
```
Folosește aceeași funcție peste tot unde apare o grupă: badge în tabele, pastile, carduri, calendar.

## D. Comutator de vizualizare
Folosește `SegmentedControl` existent, pus în antet prin `useTopbarActions`. Persistă alegerea cu `usePersistedState('view.<ecran>')`. Dimensiuni: track `padding:3px`, opțiune `padding:7px 14px; font-weight:800`. Singura schimbare în `SegmentedControl.module.css`: `padding` 4→3 și `font-weight` 700→800.

## E. Card-tabel (container comun)
```css
.tableCard { background:#fff; border:1px solid var(--border); border-radius:22px; overflow:hidden; display:flex; flex-direction:column; }
.toolbar   { display:flex; align-items:center; gap:var(--space-10); padding:14px 16px; border-bottom:1px solid var(--border); }
.search    { flex:1; display:flex; align-items:center; gap:8px; padding:10px 14px; border-radius:var(--radius-input);
             background:var(--cream); border:1px solid var(--border); font-size:14px; }
.headRow   { padding:10px 20px; font-size:11px; font-weight:800; letter-spacing:.07em; text-transform:uppercase; color:var(--subtle); border-bottom:1px solid var(--border); }
.row       { padding:12px 20px; border-bottom:1px solid var(--row-divider); }
.row:hover { background:#faf7ef; }
```
Ordinea de sus în jos: `.toolbar` (căutare + dropdown-uri) → `FilterPills` → `.headRow` → rânduri → paginare.

## F. Padding conținut
Conținutul sub antet are `padding:24px 40px 40px` (28px 40px 40px pe ecranele fără bară de filtre imediat sub antet) și `gap:18px`.
