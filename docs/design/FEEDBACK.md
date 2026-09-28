# Feedback după sync — 28.09.2026, 09:45

Am verificat `master-v2` după `7b1b753`: 129 de commituri, 300 de fișiere. Au intrat în cod filialele (Faza 6), sincronizarea (server + client), Personal (echipă, pontaj, salarii, avansuri, concedii, PIN), stickerele, bonul de 58 mm, Situația tipărită, `design-system.html` și auditul `AUDIT-UI-2026-09-28.md`. Auditul e bun și rămâne lista de referință pentru alinierea vizuală. Mai jos sunt doar lucrurile noi față de audit și ce vine din designul de azi.

## Stadiu la sync 28.09, 11:06 — niciun commit nou de la 10:25; tabelul de mai jos rămâne valabil
Pachetul e în `docs/design/` ✓. Cele 30 de commituri noi sunt din batch-urile auditului (Filiale, Personal, Situația, SMS, Review, Fee setup, Toggle nou). Din etapa A:
| | Stare | Ce lipsește |
|---|---|---|
| A1 bug „Toată grupa prezentă” | ✗ | `markGroupPresent` trimite încă `present` pentru toți copiii. Fix: `attendance.mark(changesToMarkUnmarkedPresent(children.map(c => c.id), entriesByChildId, date))` + test |
| A2 dropdown filială | ½ | `overflow` s-a mutat pe `.nav`, deci dropdown-ul nu mai e tăiat ✓. Dar `.sidebar` e tot `position: sticky` fără z-index, așa că elementele poziționate din `main` (antet sticky, `SelectionBar`) încă se pot desena peste el. **Minim:** `.sidebar { z-index: var(--z-sticky) }` cu scara `--z-*` în `tokens.css` (vezi 2a). Portalul rămâne opțional |
| A3 `ScrollArea` | ✗ | `.nav` are bara nativă. Componenta nu există în `shared/ui` |
| A4 texte Prezența | ✗ | „Toți nemarcații → prezenți” → „Nemarcații (N) → prezenți”; „Tipărește” → „Tipărește luna” |
| A5 indicator salvare | ✗ | Prezența are încă toastul cu `saveError` |
| A6 toast Vizite | ✗ | `toggleArchived` nu arată nimic la succes. Trebuie: `toast.show({ message: 'Vizită arhivată.', action: { label: 'Anulează', onClick: () => setArchived(visit, false) } })` |
| A7 monedă 12g + pastila curs | ✓ | făcute pe 27.09 (`fc25d06`, `5f94422`), confirmat în `COADA-DE-LUCRU.md` |

`COADA-DE-LUCRU.md` nu s-a schimbat: etapele A–D nu sunt trecute acolo. Adaugă-le și închide A înainte de orice alt batch din audit.

## 0. Pachetul în `docs/design/` (făcut)
În repo lipsesc designul și spec-urile de azi. Fără ele, punctele 2–5 nu au referință:
- `Grupe.dc.html` (4a/4b/4c; 3a/3b scoase) și `screens/03-grupe.md` (rescris)
- `Prezenta.dc.html` (18c/18d, anulare, indicator de salvare), `screens/19-prezenta.md` și `screens/26-foaie-saptamana.md` (nou)
- `Formulare.dc.html` (15g, scroll subțire) și `screens/13-formulare.md`
- `Set final.dc.html` și `screens/README.md`

Păstrează `COADA-DE-LUCRU.md`, `INTREBARI.md`, `RASPUNSURI.md` și `AUDIT-UI-2026-09-28.md` din repo.

## 1. Bug: „Toată grupa prezentă” șterge Absent și Motivat — prioritar
`useAttendanceDay.ts` → `markGroupPresent` trimite `status: 'present'` pentru **toți** copiii secțiunii, deci suprascrie absențele și motivele. Butonul din antet face corect (`changesToMarkUnmarkedPresent`).
- Fix: `markGroupPresent` folosește `changesToMarkUnmarkedPresent(childIds, entriesByChildId, date)` pe secțiune, iar butonul se dezactivează când `section.unmarked === 0`.
- Test: un copil Absent și unul Motivat în grupă → după clic rămân Absent și Motivat.

## 2. Meniul lateral (confirmă AB-1 din audit)
Rămâne valabil textul de mai jos (dropdown-ul de filială prin portal + `ScrollArea`). **Cauza reală:** `.sidebar` are `position: sticky` + `overflow-y: auto` (`Sidebar.module.css:10-13`), iar `.dropdown` are `position:absolute; width:300px; z-index:10` (`BranchSelector.module.css:70-84`). Z-index-ul contează doar în contextul sidebar-ului, deci `main` se desenează peste dropdown și 52px din el sunt tăiați.

### 2a. Dropdown prin portal
- `BranchSelector.tsx`: `createPortal(<div className={s.dropdown} style={{ top, left }}>…</div>, document.body)`. Poziția vine din `trigger.getBoundingClientRect()`: `top = rect.bottom + 8`, `left = rect.left`. Se recalculează la `resize` și la `scroll` pe sidebar. Dacă nu încape jos, se deschide deasupra butonului.
- `.dropdown`: `position: fixed; z-index: var(--z-popover);`. În `tokens.css`: `--z-sticky: 10; --z-drawer: 100; --z-popover: 200; --z-toast: 300; --z-dialog: 400;`. `RowMenu`, `Drawer`, `Toast` și dialogurile trec și ele pe aceste variabile.
- Esc și click în afară închid dropdown-ul; focusul revine pe buton.
- Test: cu sidebar-ul derulat și fereastra de 900px, `document.elementFromPoint` în centrul dropdown-ului întoarce un nod din dropdown.

### 2b. Scroll subțire — `ScrollArea` (design: `Formulare.dc.html#15g`, spec `13-formulare.md` 15g)
Bara are **3 px, iar la hover sau la tragere 5 px**. Pista e invizibilă și bara nu ocupă loc. Nu se folosește bara nativă: în Chrome are minimum ~6 px și ocupă loc, în Firefox ~8 px.
```tsx
<ScrollArea className={s.sidebar}>{children}</ScrollArea>
// root > viewport{children} + bar > thumb
```
```css
.root { position: relative; overflow: hidden; }
.viewport { height: 100%; overflow-y: auto; scrollbar-width: none; }
.viewport::-webkit-scrollbar { display: none; }
.bar { position: absolute; top: 6px; bottom: 6px; right: 2px; width: 7px; border-radius: 99px;
       opacity: 0; transition: opacity .2s .8s, background .15s; }
.root:hover .bar, .root:focus-within .bar, .bar.dragging { opacity: 1; transition-delay: 0s; }
.thumb { position: absolute; left: 50%; transform: translateX(-50%); width: 3px; min-height: 32px;
         border-radius: 99px; background: #e0d5c2; transition: width .15s, background .15s; }
.bar:hover { background: rgba(58,71,80,.04); }
.bar:hover .thumb { width: 5px; background: #c9c4ba; }
.bar.dragging { background: rgba(58,71,80,.06); }
.bar.dragging .thumb { width: 5px; background: #9aa3a9; }
```
- `thumbHeight = max(32, clientHeight² / scrollHeight)`, `thumbTop = scrollTop / (scrollHeight - clientHeight) * (barHeight - thumbHeight)`. Se actualizează pe `scroll` (cu rAF) și prin `ResizeObserver`. Fără overflow, bara nu se randează.
- Tragere cu `pointerdown` + `setPointerCapture`; click pe pistă sare cu o pagină. Bara are `aria-hidden`.
- Umbra de continuare: `.root::after`, gradient de 48px până la `var(--white)`, ascuns cu `.atEnd`.
- Meniul lateral: se derulează doar modulele; cardul de salvare sau sincronizare rămâne în afara viewport-ului, lipit jos.
- Se mai folosește la: dropdown-ul de filială, „Modificări azi”, `Drawer`, `RowMenu` lung, tabelele cu înălțime fixă.

## 3. Grupe → v2 (`03-grupe.md`, rescris)
Codul e încă pe 3a/3b (carduri de 4 coloane cu editor inline, cardul punctat, „+ Grupă nouă” doar în Tablă, coloane cu wrap). Punctele G-1…G-16 din audit **se înlocuiesc** cu spec-ul v2:
- Tabla e implicită; cheia devine `view.groups`, cu valoarea implicită `'board'`.
- Tabla are pool-ul „Fără grupă” fixat la stânga și tile-urile pe 2 coloane, cu maximum 9 pastile + „+N”.
- Cardurile sunt compacte, pe 4 coloane, cu editorul dedesubt și copiii pe 4 coloane.
- „+ Grupă nouă” e în antet în ambele moduri și deschide `Drawer`-ul 4c (previzualizare, culoare din 8 tonuri, capacitate, vârstă, educator principal + asistent din Personal). Grupa nouă se pune **prima**.
- **Reordonare:** butoanele ‹ › din `GroupsBoard.tsx` (G-16) se înlocuiesc cu tragerea de mânerul „⋮⋮”, plus Alt+↑/↓. Câmpul `order` se salvează și se folosește peste tot (și în `useAttendanceDay`, care acum sortează alfabetic).
- `GroupTeamCard` (echipa pe grupă) e bun și rămâne: în editorul din Carduri și sursă pentru „Educator principal / Asistent” pe tile și pe foaia săptămânii.

## 4. Prezența → anulare, indicator de salvare, foaia săptămânii
- **Anulare** (`19-prezenta.md` → „Anulare și istoric”): stiva de acțiuni per zi și filială, persistată. Butonul dublu „↶ Anulează | N ▾” (Ctrl+Z) și popover-ul „Modificări azi” cu „Anulează până aici”. Toastul de după acțiunea în masă nu dispare singur. Butonul din antet devine „Nemarcații (N) → prezenți”.
- **Indicator de salvare** lângă titlu: Salvat · ora / Se salvează… / Nesalvat · N modificări + „Încearcă din nou”. Cu modificări nesalvate, plecarea de pe pagină cere confirmare. Înlocuiește toastul actual cu `saveError`.
- **Foaia săptămânii** (`26-foaie-saptamana.md`): butonul „Foi pe săptămână” (în Ziua stă în bara de filtre, în Luna în antet), fereastra 18c și ruta `/prezenta/foi`, cu 16 rânduri pe foaie și fără date de contact. „Tipărește” din Luna devine „Tipărește luna”.

## 5. Bazin
În webapp nu există încă un ecran Bazin (doar `PoolReceiptLabel` și planul `2026-09-27-personal-bazin.md`). Urmează după punctele 1–4, după `23-bazin.md`.

## Ordinea
1 → 2 → 3 → 4 → 5, apoi batch-urile din `AUDIT-UI-2026-09-28.md` (T-1…T-6 întâi, pentru că schimbă antetul pe toate ecranele). `npm run check` + webapp typecheck + test după fiecare.

## 6. Aspect: aplicația pare mai mare decât designul (28.09)
**Ce am verificat:** măsurile din cod sunt aceleeași ca în design (meniul 248px, itemul de meniu 14px cu padding 8/12, butonul de antet 15px cu padding 8/18, antetul 12px 40px, fonturile Nunito + Baloo 2 incluse local). Diferența vine din cum se vede: designul e privit pe pânză micșorat (~60–70%), iar aplicația rulează la 100%, de obicei pe un laptop cu scalarea Windows la 125% (un ecran 1920px devine 1536px CSS). Totul iese cu ~25% mai mare decât în captură.

**Fix: „Mărimea interfeței”, per calculator**
- Administrare → Backup și setări → Grădinița → rând nou „Mărimea interfeței”: `SegmentedControl` **Compact 90% · Normal 100% · Mare 110%**. Implicit e **Compact**, apropiat de cum arată designul.
- Se salvează în `localStorage` (`ui.scale`), nu în bază: e o preferință a calculatorului, nu a grădiniței, și nu se sincronizează.
- Implementare: `document.documentElement.style.zoom = scale` la pornire (înainte de primul render, în `main.tsx`) și la schimbare. `zoom` e suportat în Chrome/Edge, unde rulează aplicația. `@media print` resetează la `zoom: 1`, ca tipăriturile A4 să nu se schimbe.
- Ctrl+− / Ctrl+0 din browser rămân și ele; setarea doar alege un implicit bun.
- Verificare: la 90%, pe 1536px CSS, meniul are ~223px vizibili și conținutul are 1290px. Grupe v2 (tabla în 2 coloane) și tabelele trebuie să încapă fără scroll orizontal.
- **Pentru comparație:** deschide `.dc.html`-ul la 100% (butonul de zoom al pânzei → 100%), nu „potrivit în ecran”.

## 7. Umbra pe butoane (28.09)
Umbra portocalie (`--shadow-button-primary`) se pune **doar pe butonul principal din antet** („+ Adaugă copil”, „+ Plată”, „+ Grupă nouă”…), ca să iasă în evidență acțiunea paginii.
- `Button.module.css`: `.primary { box-shadow: none; }`; umbra rămâne doar pe `.primary.header` (`--shadow-button-header`).
- Fără umbră: „Salvează”, „Creează”, „Tipărește”, „Trimite” și „Confirmă” din `Drawer`, dialoguri, editoare inline și carduri de setări.
- Verifică cu `grep -rn "shadow-button-primary" webapp/src`: trebuie să rămână doar în `Button.module.css`.

---
_Istoric: feedback-ul din 27.09 (Prezența, Raport contabil) e marcat DONE în `COADA-DE-LUCRU.md`._
