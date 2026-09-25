# Corecții — implementarea `master-v2` față de design

Comparație între `webapp/src` (commit curent `master-v2`) și `Dashboard.dc.html#1a` / `Sidebar.dc.html` (varianta a). Valorile din dreapta sunt cele finale. Se aplică întâi acestea, apoi se verifică la 1440 px lângă referință.

## 1. `shared/ui/Card.module.css` — cauza principală

| Proprietate | Acum | Corect |
|---|---|---|
| `.orange/.mint/.yellow/.pink` `color` | `--*-ink` (colorează **tot** cardul, inclusiv suma) | **șterge** `color`; textul rămâne `var(--slate)`. Culoarea ink se aplică doar pe label și pe link-uri. |
| `border-radius` | `24px` | `22px` pe KPI (adaugă varianta sau suprascrie în `kpiCard`) |
| `padding` | `20px 24px` | `22px 24px` |
| `box-shadow` pe tonuri colorate | `--shadow-card` | **none** — cardurile KPI sunt plate |
| `display` | `block` | `flex; flex-direction: column; gap: 10px` |
| `.decorative::after` | sus-dreapta, `top:-30%; right:-20%; 60%×60%` | **jos-dreapta**: `right:-30px; bottom:-40px; width/height:130px` (Încasări) / `110px` (restul); `rgba(255,255,255,.45)` Încasări, `.5` restul |
| conținut peste cerc | — | `position: relative` pe copiii cardului (legenda, link-ul) |

Cardurile albe din rândul 2 (Evoluția încasărilor, Necesită atenție, Zile de naștere): `border: 1px solid var(--border)`, **fără umbră**, radius `22px`, padding `24px 26px`, gap intern `20px`.

## 2. `features/dashboard/DashboardPage.module.css` + `.tsx`

**Label KPI (`.kpiLabel`)**
- Acum: 13 px / 700, fără majuscule, culoare moștenită.
- Corect: `font-size:12px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; margin:0;`
- Culoare per card: Încasări `var(--orange-ink)`, Cheltuieli `var(--mint-ink)`, Diferență `var(--yellow-ink)`, Avansuri `var(--muted)`.

**Valoare (`.kpiValue`)**
- `font-size:36px; line-height:1; color:var(--slate); margin:0` (acum are `margin-bottom:8px` și e colorată).

**Bara pe metode**
- Fundal `#fff` (acum `rgba(255,255,255,.6)`), `margin-top:4px`.

**Legendă (`.methodLegend`)** — de refăcut markup-ul
- Acum: un singur `<small>` „Cash: 129.036,00 lei · Card: …".
- Corect: `display:flex; gap:14px; font-size:12px; color:#5b666e`; fiecare element = pătrat 8×8 radius 2 (culoarea metodei) + `gap:5px` + text **„Cash 129.036"** (sumă compactă fără zecimale și fără „lei", `formatCompactMoney`).

**Cheltuieli**
- „+ Adaugă cheltuială": 13 px / 700 `var(--mint-ink)`, `margin-top:auto`.

**Diferență**
- „încasări − cheltuieli": 13 px `var(--muted)`, `margin-top:auto` (acum moștenește galben).

**Avansuri nerepartizate**
- Label pe un rând, **fără** `advanceHead`; pastila „Toate lunile, până azi" se mută **jos**: `align-self:flex-start; margin-top:auto; font-size:12px; font-weight:700; padding:3px 10px; background:var(--neutral-soft); color:var(--muted)`.
- Border `1.5px dashed #e6d9c4`, radius 22, fundal alb (corect acum), fără umbră.

**Rând 2**
- Titluri panou (`.panelTitle`): **20 px** (acum 18).
- Comutatorul „Încasări / Cheltuieli" lipsește — adaugă `SegmentedControl` aliniat dreapta pe rândul titlului.

## 3. Sidebar (din README, secțiunea Shell global)

- Logo `startica-logo.svg` **înălțime 38 px**, versiunea (`v1.6.3`, 11 px, 700, `#9aa3a9`) **aliniată dreapta pe aceeași linie** — NU full-width cu versiunea dedesubt (contrazice fix-ul din commit `c7c01a4`, verificat cu utilizatorul înainte de aplicare).

## 4. Antet (Topbar)

- Titlul devine „Rezumatul lunii" (era alt text), căutarea și eticheta „Ctrl K" primesc fontul aplicației (nu monospace implicit).

## 5. Spațieri

- Marginile conținutului și titlurile de pe rândul al doilea: 20 px.
