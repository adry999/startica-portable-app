# 03 — Grupe (Tablă / Carduri) · v2, 28.09.2026

> **Actualizat 29.09.2026:** Tragerea grupelor: copie rotită, loc gol punctat, inel portocaliu (DECIZII 13, ALINIERE A8). Carduri 4a: mânerul lângă nume (A3d). Unde textul de mai jos contrazice `DECIZII.md` sau `ALINIERE-DESIGN.md`, acelea au prioritate.

**Referință:** `Grupe.dc.html#4b` (Tablă, implicit) și `#4a` (Carduri). Înlocuiește varianta veche 3a/3b (scoasă din design). **Depinde de:** `00-comun.md` A, C, D.

De ce v2: cu 6–8 grupe, coloanele din 3b nu mai încap, iar cardurile mari din 3a ocupă 3 rânduri. v2 e gândit pentru 7 grupe și ~100 de copii.

## 1. Fișiere
Se modifică: `groups/GroupsPage.tsx`, `GroupsBoard.tsx`, fișierele `.module.css` și testele lor.
Se creează: `groups/GroupTile.tsx` (tile-ul din Tablă) și `groups/GroupCardCompact.tsx` (cardul din Carduri).

## 2. Antet (identic în ambele moduri)
```
Grupe  ORGANIZARE    „7 grupe · 77 copii în grupe · 22 fără grupă”    [Tablă | Carduri]    [+ Grupă nouă]
```
- „22 fără grupă” e îngroșat, în `--orange-ink` (#a34f00).
- Comutatorul are **Tablă prima**. Valoarea implicită e `'board'`: `usePersistedState('view.groups', 'board')`. Cheia veche `'cards'` se citește în continuare, dar dacă utilizatorul n-a ales nimic, se deschide Tabla.
- **„+ Grupă nouă” e în antet în ambele moduri.** Cardul punctat „Grupă nouă” din grilă dispare. Butonul deschide panoul lateral din §5b (4c).

## 3. Stările unei grupe (comune ambelor moduri)
| Stare | Condiție | Pastilă |
|---|---|---|
| Peste capacitate | `count > capacity` | „Peste cu N”, fundal `#b0284f`, text alb; bara de ocupare devine `#b0284f` |
| Plină | `count === capacity` | „Plină”, fundal alb, text în culoarea grupei |
| Goală | `count === 0` | „Goală”, fundal alb, text în culoarea grupei |
| Fără educator | `!educator` | textul „Fără educator” în `#b0284f`, în locul numelui educatorului |

Intervalul de vârstă e cel real al copiilor („5–6 ani”); pentru o grupă goală se afișează „—”.
Culorile vin din `groupTone(g.id)`. Pentru 7+ grupe, `groupTone` are nevoie de 7 tonuri distincte:
galben `#fdf3d2/#7a5d00/#d9a400` · roz `#fce9ef/#b0284f/#d9577c` · turcoaz `#dff1f0/#1f6464/#3a9c9c` · verde `#e7f4ec/#2e6b4c/#3f9a6b` · albastru `#e4eef6/#2c5a80/#4a86b8` · portocaliu `#fcead3/#a34f00/#ef8a1d` · lila `#eee8f6/#5b3f86/#8a6bc0` (fundal / text / bară).

## 3b. Ordinea grupelor (reordonare)
- Grupele au ordinea aleasă de utilizator. În tabelul grupelor se adaugă câmpul `order` (int). La migrare, `order` primește ordinea alfabetică de acum. Grupele noi se pun primele.
- **Tablă:** mânerul „⋮⋮” din stânga numelui (culoarea grupei, opacitate .55, iar la hover 1 cu fundal alb) e singurul punct din care se trage grupa, ca să nu se încurce cu tragerea copiilor. **Carduri:** se trage de tot cardul, cu același „⋮⋮” ca indiciu.
- În timpul tragerării, grupa trasă are opacitate .4, iar ținta primește `box-shadow: 0 0 0 3px #3a4750`. La drop, grupa se mută înaintea țintei (sau după ea, dacă vine de mai sus).
- Pentru tastatură: cu focus pe mâner, Alt+↑/↓ mută grupa cu o poziție.
- Se salvează imediat (`PATCH /api/groups/order` cu lista de id-uri), per filială, și intră în Istoric ca o singură modificare.
- **Aceeași ordine peste tot:** pastilele `FilterPills` Grupă (Copii, Achitări, Situația, Prezența), grupele din Prezența → Ziua, foile săptămânii (26), rapoartele. „Fără grupă” rămâne mereu prima în Tablă.

## 4. Tablă (4b) — implicit
```tsx
<div className={s.board}>                        {/* padding:20px 40px 36px; grid 300px minmax(0,1fr); gap 20; align-items:start */}
  <aside className={s.pool}>                     {/* Fără grupă: radius 22, fundal #f4f1ea, padding 14, gap 8 */}
    <h3>Fără grupă <b>22</b></h3>
    <SearchInput placeholder="Caută copil" />
    <p className={s.hint}>Ordonați după vârstă · trage pe o grupă</p>
    {unassigned.map(k => <PoolRow draggable />)}  {/* alb, radius 12, padding 6px 10px 6px 6px; ⋮⋮, avatar 26, nume, vârstă */}
  </aside>
  <div className={s.tiles}>                       {/* grid repeat(2,minmax(0,1fr)); gap 14 */}
    {groups.map(g => <GroupTile />)}
  </div>
</div>
```
- **Fără grupă** e fixat la stânga (`position:sticky; top:0`), ordonat după data nașterii, cei mai mici primii.
- **GroupTile:** radius 20, padding `14px 16px`, gap 10, fundalul tonului. Sus: nume (Baloo 19), pastila de stare, apoi „14/16” (Baloo 19; „/16” la opacitate .6). Dedesubt: bară de 5px, apoi „Educator · 5–6 ani” (12px).
- **Copiii din tile** sunt pastile: fundal alb, radius 999, padding `2px 9px 2px 2px`, avatar de 20px și text „Prenume N.” (12px, 700). Se arată **primii 9**, apoi pastila „+N”.
- **Editare din Tablă → Carduri:** Tabla nu are editor propriu. Pe tile, pastila „Editează” (după nume; fundal `rgba(255,255,255,.75)`, text în tonul grupei), un clic pe numele grupei sau pe „+N” fac `setView('cards')` + `setSelId(g.id)` și derulează sus. Editorul se deschide cu grupa aleasă, iar alegerea modului se salvează ca de obicei. În URL: `/grupe?mod=carduri&grupa=<id>`, ca înapoi în browser să revină în Tablă.
- **Grupa goală** are zona „Plasează aici”: înălțime 62px, fundal `rgba(255,255,255,.55)`, radius 14.
- **Drag & drop:** din pool pe tile, sau dintr-o pastilă pe alt tile. Tile-ul peste care se trage primește `border:2px dashed <bara tonului>`. Pe drop se apelează funcția existentă de mutare din `useGroups`. Pe o grupă plină sau peste capacitate, drop-ul e permis, iar pastila de stare se actualizează.
- Butoanele „Restrânge / Deschide tot” și coloanele restrânse din 3b **se scot**.

## 5. Carduri (4a)
```tsx
<div className={s.content}>                        {/* padding:24px 40px 40px; gap 20 */}
  <div className={s.cards}>                         {/* grid repeat(4,minmax(0,1fr)); gap 12 */}
    {groups.map(g => <GroupCardCompact selected={g.id===selId} onClick={() => setSelId(g.id)} />)}
  </div>
  <GroupEditor group={selected} />
</div>
```
- **GroupCardCompact:** radius 18, padding `14px 16px`, gap 8, fundalul tonului. Border 2px `transparent`; cardul selectat are border în culoarea barei. Conținut: nume (Baloo 20) + „14/16” (Baloo 22), bară de 6px, „Educator · vârste” (13px) + pastila de stare. Fără stivă de avatare și fără cerc decorativ.
- **Editorul** e mereu deschis pentru grupa selectată (implicit prima). Titlul „Editează grupa X” are „Vârste: …” în dreapta. Câmpurile sunt pe un rând: Nume, Educator, Capacitate, [Salvează].
- „Copii în grupă · N” are în dreapta `SearchInput` „Adaugă copil fără grupă…” (320px, cu sugestii).
- Copiii sunt pe un grid de **4 coloane**: rând de 40px, fundal `#fffaf0`, avatar 28, nume cu ellipsis, vârstă și × pentru scoatere.
- Grupa goală: chenar punctat „Niciun copil în grupă. Caută mai sus sau trage-i din Tablă.”
- Jos, aliniat la dreapta: „Șterge grupa X” (`ConfirmDeleteDialog`).

## 5b. Grupă nouă (4c) — `Drawer` 520px
Același `Drawer` ca la „Copil nou” (15a): antet „Grupă nouă” + ×, conținut cu padding `22px 30px` și gap 22, subsol cu border-top.
1. **Previzualizare:** un `GroupTile` gol, actualizat pe loc (nume sau „Grupă nouă” gri, pastila „Goală”, „0/N”, educator · vârste).
2. **Nume grupă** (obligatoriu; focus automat; placeholder „ex. Ursuleți”). Un nume care există deja în filială dă eroarea „Există deja o grupă X”.
3. **Culoare:** 8 pătrate de 34px (cele 7 tonuri din §3 + coral `#fbe6dc/#9a3f1c/#e0714a`). Implicit e primul ton nefolosit; tooltipul arată „folosită de Mars” sau „liberă”. Se salvează ca `group.tone`, iar `groupTone` îl folosește înainte de calculul din id.
4. **Capacitate** (stepper, implicit 14) și **Vârstă** min–max în ani (opțional; folosită pentru sugestiile de copii și în Formulare 15a, „se potrivește în grupele”).
5. **Echipa grupei** (principal · asistenți · înlocuitori) — aceeași componentă ca în Carduri (§5), fără zile. Vezi §5c.
6. **Fără alegerea locului:** grupa nouă primește automat `order` = prima poziție (celelalte coboară cu 1), ca să fie lângă „Fără grupă” și copiii să se poată trage direct în ea. În panou apare doar nota: „Grupa nouă apare prima, lângă „Fără grupă”, ca să tragi copiii direct în ea. Apoi o muți unde vrei cu „⋮⋮”.”
- **Subsol:** „N copii fără grupă au X–Y ani · îi poți adăuga după salvare.” · [Anulează] · [Creează grupa]. Butonul e gri până se completează numele. Enter salvează, Esc închide.
- **După salvare:** panoul se închide, iar grupa apare **prima**, cu „Plasează aici”; în Carduri devine grupa selectată. Toast „Grupa X a fost creată · Anulează” (6 s).

## 5c. Echipa grupei — `GroupTeamPicker` (în 4a și 4c)
Înlocuiește câmpul text „Educator” și refolosește `group.team` (`GroupTeamMember[]`) din `GroupTeamCard`. `GroupTeamCard` devine `GroupTeamPicker`, cu aceeași logică și un aspect nou:
- **Trei blocuri, câte unul pe rol:** Principal (pastilă portocalie, „unul singur”) · Asistent (mint) · Înlocuitor (neutru, „când lipsește cineva”). În 4a stau pe 3 coloane, în panoul 4c unul sub altul.
- **Membru:** avatar 26px în tonul rolului, nume, funcția (din Personal), pastila galbenă de concediu dacă e cazul („Concediu până pe 3 oct”, din `leaves`) și × (scoate). În 4a mai are un rând de zile L Ma Mi J V; implicit toate sunt active, iar un clic comută o zi.
- **Gol:** „Fără educator principal” (roșu `#b0284f`) · „Niciun asistent” / „Niciun înlocuitor” (gri).
- **Adăugare:** „+ Alege” / „+ Asistent” / „+ Înlocuitor” deschide, în același bloc, un panou cu `SearchInput` „Caută în Personal…” și lista angajaților activi care nu sunt deja în echipă.
  - Ordinea: întâi educatorii și asistenții, apoi cei liberi, apoi alfabetic.
  - Fiecare rând arată în dreapta unde lucrează deja: „Liberă” (verde) sau „Mars · principal” (portocaliu dacă e principal în altă parte, altfel gri). E permis, doar vizibil.
  - Jos: link „Lipsește cineva? Personal → + Angajat”.
- **Principal:** când e completat, butonul devine „Schimbă”, iar persoana aleasă îl înlocuiește pe cel vechi (nu mai există eroarea „are deja un principal”).
- **Salvare:** în 4a, cu butonul „Salvează” al editorului (`useDirtyForm` rămâne); în 4c, odată cu „Creează grupa”. Tile-ul și cardul arată numele principalului sau, dacă lipsește, „Fără educator”.
- **Migrare:** `group.educator` (text) se potrivește după nume cu `staff`. Dacă nu se găsește, rămâne afișat gri „(din fișa veche) Nume” până se alege cineva.

## 6. Criterii de acceptare
- [ ] Echipa se alege din Personal în 4a și 4c; principalul e unic și „Schimbă” îl înlocuiește; lista arată unde lucrează deja fiecare
- [ ] „+ Grupă nouă” deschide panoul 4c; doar numele e obligatoriu; previzualizarea se actualizează pe loc
- [ ] La prima deschidere apare Tabla; alegerea se păstrează după reîncărcare
- [ ] „+ Grupă nouă” e în antet în ambele moduri; nu mai există cardul punctat
- [ ] 7 grupe încap fără scroll orizontal la 1440px (Tablă 2 coloane, Carduri 4 coloane)
- [ ] Pastilele Plină / Peste cu N / Goală și „Fără educator” apar corect
- [ ] Tile-ul arată maximum 9 copii + „+N”
- [ ] „Editează”, numele sau „+N” din Tablă deschid Carduri cu grupa selectată; înapoi în browser revine în Tablă
- [ ] Drag & drop din „Fără grupă” pe un tile mută copilul și actualizează numerele din antet
- [ ] `groupTone` dă 7 tonuri distincte
- [ ] Ordinea grupelor se schimbă prin tragere (mânerul din Tablă, cardul din Carduri), se păstrează după reîncărcare și se vede la fel în filtre, Prezența și foile tipărite
- [ ] Tragerea unui copil nu mută grupa și nici invers
