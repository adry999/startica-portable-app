# PROMPT-CLAUDE-CODE-11 — 02.10 seara (după sync 17:15, `master-v2` după PROMPT-10)

## 0. Pachetul de design — copiere atentă (lecția din 02.10: COMPONENTE/DECIZII suprascrise)
Nu copia folderul peste `docs/design/`. Fă așa, fișier cu fișier:
1. **Copiază și suprascrie** (doar design, nimic din cod nu le modifică): `Achitari.dc.html`, `Actualizari.dc.html`, `Administrare.dc.html`, `Bazin.dc.html`, `Bon 58mm.dc.html`, `Copii.dc.html`, `Dashboard.dc.html`, `DS Incarcare si stari.dc.html`, `DS Tabel si filtre.dc.html`, `Formulare.dc.html`, `Personal.dc.html`, `Planuri si curs.dc.html`, `Profiluri calculator.dc.html`, `Situatia.dc.html`, `PROMPT-CLAUDE-CODE-11.md` (nou).
2. **Mută** `docs/design/Feedback 01-10.dc.html` → `docs/design/arhiva/Feedback 01-10.dc.html` (folosește copia din pachet: are căile `../` corectate). Artboard-urile 38–45 sunt acum în paginile de modul.
3. **Nu suprascrie — îmbină** (repo-ul are text mai nou de la PROMPT-10):
   - `FEEDBACK-01-10.md`: adaugă din pachet rândurile F15–F31 și „Secțiuni ascunse fără date” în tabel, linia de stare „Sync 02.10, 16:50…”, secțiunile „## F15/F16/F17” de la final și rândurile 41d/41f actualizate. Păstrează tot restul din repo.
   - `DECIZII.md`: adaugă doar secțiunea „## 02.10 — Scrii doar în filiala deschisă” de la final.
   - `COMPONENTE.md`: schimbă doar titlul „## 3b …” (fără trimitere la `Feedback 01-10.dc.html`).
   - `INTREBARI.md`: **nu copia**. Doar înlocuiește în repo trimiterile `Feedback 01-10.dc.html#NN` cu pagina de modul (lista: 38a,41e→DS Tabel si filtre; 38b,38c,41f,44b,40c,44d→Formulare; 38d,38e→Planuri si curs; 38f→Personal#23e; 38g,45a→Administrare; 40a→Situatia; 40b,41d→DS Incarcare si stari; 41a,45b→Copii; 41b→Personal; 41c,45c→Dashboard; 42a,42b→Actualizari; 42c→Bon 58mm; 42d→Prima pornire#46a; 43a→arhiva; 43b→Bazin; 44a,44c→Achitari).
4. Mută `PROMPT-CLAUDE-CODE-10.md` în `arhiva/` după §4 de mai jos.
5. Un singur commit „docs(design): pachet 02.10 seara” înainte de orice cod; `git diff --stat docs/design` în mesaj.

## Ordinea de lucru
Întâi ce strică datele sau blochează lucrul, apoi aspectul:
1. §17 (scrii doar în filiala deschisă) · §19 (editarea salariului) · §18 (plata salariilor) · §2 (rotunjire) · §5 (Achitare nouă) · §1 (plan la Copil) · §7 (secțiuni ascunse)
2. §6 (subsol unificat) · §3 (MonthInput) · §16 (Funcția) · §9 (sortare Copii) · §12 (Necesită atenție)
3. §10 · §11 · §13 · §8 · §14 · §15 · §4
Fiecare punct: test + captură lângă artboard; ce nu se închide intră în `INTREBARI.md`. Nicio `--execute` pe date reale. Plan scurt în `docs/superpowers/plans/` pentru §5, §6, §17 înainte de cod.

Surse: `FEEDBACK-01-10.md` F15–F31 · design în paginile de modul (Formulare 15a/15b/15i/15j/15k/41f, Dashboard 1a/1b, Copii 2a, Grupe 4a, Personal 23n/23o, Planuri si curs 12a). Commit pe pas.

## 1. F15 · Planul apare mereu în Copil nou / Editează (15a, 15i)
- `webapp/src/features/children/ChildFormDrawer.tsx:321` — scoate condiția `presets.length > 0 &&`. Secțiunea „Plan” se randează mereu în „3 · Contract și taxă”.
- Fără planuri (`presets.length === 0`): card gol (stil `EmptyState size="compact"`, cheie nouă `planuri.childForm` în `@shared/ui/empty-states.ts`): „Nu sunt planuri setate pentru {filiala}” + „Adaugă planurile o dată și apoi alegi planul aici. Până atunci, scrie taxa manual.” + buton „Setează planurile” → `/backup-si-setari?tab=curs` în tab nou (formularul rămâne deschis, fără pierdere de date).
- Câmpul „Taxa lunară” (€) + „Din luna” rămân vizibile sub card, pentru taxă manuală.
- Cu planuri: cardurile arată „{nume} · {orar} · {preț} €”; sub ele „Taxa lunară = prețul planului: X € (≈ Y lei azi)”.
- Test: `ChildFormDrawer.test.tsx` — fără planuri: secțiunea Plan + mesajul + butonul există; cu planuri: cardurile; la Editează, la fel.

## 2. F16 · Rotunjire la alegere, nu automată (15b, 41f)
- `webapp/src/features/payments/PaymentFormDrawer.tsx:215` — precompletarea pune suma **exactă** (`converted`, rotunjit doar la ban), nu `Math.round(converted)`.
- Sub „Sumă încasată”: pastile „Rotunjește:” — `Exact X,YY` (implicit, activă) · în jos la leu · în sus la leu · la 10 lei (doar dacă e diferită de celelalte și |diferență| ≤ `PAYMENT_ROUNDING_TOLERANCE`). Fără bani în sumă → pastilele nu apar. Clic = setează suma; editarea manuală dezactivează pastila activă.
- `roundingDiff` rămâne calculat ca acum (`paymentRoundingDiff`) din suma finală; la „Exact” = fără rotunjire.
- Actualizează testul `PaymentFormDrawer.test.tsx:307` (acum: precompletat exact 1.950,59) și adaugă: 650 € × 20,1068 → 13.069,42 precompletat; clic „13.070” → `roundingDiff` +0,58; clic „13.069” → −0,42.
- Setarea pe filială `paymentRounding.step` (dacă există) decide doar ordinea pastilelor, nu precompletarea.

## 3. F17 · MonthInput propriu în repartizarea manuală (15j)
- `@shared/ui/MonthInput` folosește azi `<input type="month">` nativ (popover-ul browserului, în engleză). Înlocuiește cu câmp + popover `MonthPicker` (30b, COMPONENTE §0e): an cu ‹ ›, grilă 4×3 „Ian…Dec”, punct de stare pe lună (`markers`: achitată / restanță / deja în listă), „Luna curentă”, Esc închide, săgeți pe grilă, `aria-label` pe fiecare lună.
- Props noi: `markers?: Record<'YYYY-MM', 'paid'|'debt'|'used'>`, `isDisabled?(month)`, `min?`/`max?`.
- `PaymentFormDrawer.tsx:782` (repartizare manuală): lunile deja alese pe alt rând sunt `isDisabled`; „+ Lună” adaugă luna următoare după ultima din listă, cu suma rămasă nerepartizată; banda „Nerepartizat: X € · rămâne avans”.
- Trece automat și în `ChildFormDrawer` (434, 442) și `SalaryFormDrawer` (folosesc deja `MonthInput`).
- Testele care caută `input[type="month"]` (`PaymentFormDrawer.test.tsx:185–281`) trec pe `getByRole('button', { name: /Luna/ })` + `getByRole('gridcell', { name: 'Noiembrie 2026' })`.
- Storybook: `MonthInput` cu markers, dezactivat, min/max.

## 4. Resturi din PROMPT-10 (din INTREBARI.md, 02.10)
1. **Numărătoarea PIN:** `PinGate`/`LockedContent` primesc `lockoutMs={15 * 60 * 1000}` (`webapp/src/shared/state/usePinLock.ts:44` rămâne cu implicit 60 s doar pentru alte folosiri). Numărătoarea afișată = blocajul serverului. Test.
2. **Toleranța de rotunjire:** rămâne constanta `PAYMENT_ROUNDING_TOLERANCE = 5` lei, aceeași pe toate filialele (implicit, fără setare pe filială). Cu §2 de mai sus, rotunjirea o alege omul, deci setarea pe filială nu mai e necesară. Actualizează `DECIZII.md` (rândul „Pasul și toleranța se setează pe filială” → „5 lei, fix; rotunjirea se alege la plată”).
3. **Descărcarea actualizării (37b):** **implicit: automată.** După un `checkForUpdate()` reușit, `main.mjs` cheamă serviciul de descărcare o singură dată pe versiune (sare dacă `pendingUpdate()` are deja aceeași versiune, verificată SHA-256). Fetch-ul rămâne injectat; în `test:e2e` și testele unitare descărcarea e dezactivată prin config (`STARTICA_UPDATE_AUTO_DOWNLOAD=0`). Banda 42b apare doar după verificarea SHA-256.
4. **37d „oprite primele”:** **implicit: nu se construiește acum.** Lista Calculatoare conectate arată deja coloana Versiune; un calculator sub `SYNC_MIN_CLIENT_VERSION` are pastila roz „Versiune veche · sincronizare oprită” pe rând. Fără oprire automată, fără banner separat.

## 5. F18 · Achitare nouă refăcută după 15b (`webapp/src/features/payments/PaymentFormDrawer.tsx`)
Azi formularul are aceleași funcții, dar altă ordine și alte elemente decât `Formulare.dc.html#15b` (+ `#38c`, `#41f`, `#15j`). Refă randarea, păstrând logica (alocare, frați, SMS, editare, gardă nesalvate). Ordinea de sus în jos:
1. **Cardul copilului** (cremă, avatar pe tonul grupei, „Grupă · contract N · scadență Z”, „Schimbă”). Azi: `PersonCell` cu „taxă X” în subtitlu.
2. **Două carduri alăturate** (nou): Plan (`--orange-soft`, „Program mediu · 500 €”, „pe lună”) + Curs BNM (`--mint-soft`, „Curs BNM · zz.ll.aaaa”, „1 € = 19,6873 lei”, „data plății”, link „Curs manual” care deschide câmpul de curs). Azi: câmpul „Curs EUR” e mereu vizibil sub sumă. Copil MDL: doar cardul Plan cu taxa în lei. Copil fără taxă: card galben „Copilul nu are plan sau taxă · Completează” → editarea fișei la secțiunea 3 (azi: nimic, tăcut).
3. **Serviciu** (Grădiniță / Bazin) — ca acum.
4. **Luni acoperite** (nou ca pastile, `ChipSelect` multi): luna curentă bifată + următoarele 2; restanța ca bandă roz „Are restanță: Sep 2026 · 500 € · Bifează ca s-o acoperi”; link „Repartizează manual” (→ 15j). Azi: lista „Se repartizează automat” + checkbox-uri de restanță.
5. **Suma**: rândul „500 € × 19,6873 = 9.843,65 lei” deasupra; câmpul mare cu suma exactă; pastilele „Rotunjește” (§2); banda de stare (mint „Oct 2026 achitat integral · = 500,00 €” / „rotunjire +0,35” / galben „Rămân X pe Oct” / „+X avans pentru Nov”). Azi: „= X €” ca notă gri și scurtături „1/2/3 luni” (scoase pentru EUR; rămân doar pentru MDL).
6. **Data + Metodă** pe un rând (Numerar · Card · Transfer); „Împarte pe metode” ca link sub Metodă.
7. **+ Adaugă fratele (Nume)** (44b) — link, apoi rândurile de frați, ca acum.
8. **Plătitor**, „+ Adaugă observație” — ca acum.
9. **Subsol** după §6.
- **Prefill și când copilul e ales în formular**, nu doar din fișă: azi efectul din `PaymentFormDrawer.tsx` (~liniile 205–219) iese dacă `!defaultChildId`. Precompletarea rulează la prima alegere a copilului într-o plată nouă (din Achitări, din 44a, din 40a), cât timp suma n-a fost atinsă.
- Test: captură lângă 15b pentru copil EUR, MDL, fără taxă, fără curs BNM; `PaymentFormDrawer.test.tsx` pentru ordinea secțiunilor (roluri/etichete), prefill din Achitări.

## 6. F19 · Subsolul formularelor, unificat (15k)
- `webapp/src/shared/ui/Drawer.tsx` (și `Dialog`): `footer` liber → props structurate: `primary: { label, loading?, disabled?, disabledReason? }`, `onCancel` (implicit = `requestClose`, eticheta „Anulează”), `footerStart?: ReactNode` (o bifă sau o notă). Ordinea fixă: [footerStart] … Anulează · Principal. „N erori” (`errorCountLabel`) se mută în `footerStart` (roz, clic = focus pe primul câmp invalid), nu bandă separată deasupra.
- `disabled` fără `disabledReason` = eroare de tip în TS (motivul apare în stânga). `loading` → „Salvez…” și ambele butoane inactive.
- Treci toate cele 24 de `footer={` din `features/**` (listă: `grep -rn "footer={" webapp/src/features`) pe API nou. Etichetele principale: „Salvează copilul”, „Salvează · {sumă}”, „Salvează cheltuiala”, „Salvează grupa”, etc. — fiecare spune ce salvează.
- Regulă nouă în `architecture.test.ts`: niciun `footer={` cu JSX liber în `features/**`.
- Captură: Copil nou, Achitare nouă, Cheltuială, Grupă, Concediu, Avans — subsolul identic.

## 7. Audit „secțiuni ascunse când lipsesc datele” (ca F15)
Regula: o secțiune care depinde de o setare (planuri, servicii, antrenori, SMS, curs) **nu dispare** când setarea lipsește — arată un rând gol cu motivul și linkul spre setare. Găsite în cod (02.10), de corectat:
| Fișier | Azi | Corect |
|---|---|---|
| `children/ChildFormDrawer.tsx:321` | Planul dispare fără planuri | §1 |
| `payments/PaymentFormDrawer.tsx` (feeEntry null) | Nicio informare când copilul n-are taxă | §5.2 |
| `payments/PaymentFormDrawer.tsx` prefill | Doar din fișă | §5 |
| `payments/PaymentFormDrawer.tsx:625` | Serviciul dispare dacă lista e goală | Rămâne vizibil, „Grădiniță” implicit; dacă lipsesc servicii: „Setează serviciile” |
| `backup/BackupPage.tsx:367` | Lista de backup-uri goală = nimic | `EmptyState` „Niciun backup încă · Fă primul backup” |
| `pool/WeekView.tsx:79` | Rândul de antrenori dispare | „Antrenor: nesetat · Setează” (`EMPTY_STATES['bazin.coach']` există deja) |
| `payments/PaymentFormDrawer.tsx` SMS | Bifa dezactivată + „SMS neconectat” | ok, adaugă link „Conectează” |
Apoi caută singur același tipar în modulele pe care această listă nu le acoperă (`status`, `visits`, `review`, `report`, `notify`, `dashboard`): `grep -rnE "\.length > 0 &&|\.length \?|return null" webapp/src/features`. Pentru fiecare: dacă ascunde o secțiune legată de o setare → regula de mai sus; dacă e conținut contextual (frați, restanțe, avertizări) → rămâne. Notează lista în `INTREBARI.md`.

## 8. F20 · Grupe → Carduri după 4a (`webapp/src/features/groups/GroupsPage.tsx`, `GroupCardCompact.*`, `GroupsPage.module.css`)
Comparat cod ↔ `Grupe.dc.html#4a` (02.10). Cardurile sunt aproape corecte; editorul de dedesubt diferă.

**Cardul compact (`GroupCardCompact`)**
1. Educatorul: `--text-secondary` (#5b666e), nu tonul grupei; „· vârste” în `--muted` 600. „Fără educator” rămâne `--pink-ink`.
2. Pastila de stare (Plină, Goală…): fundal `--white` (nu `--white-a60`), text pe tonul grupei; Peste capacitate: `--pink-ink` cu text alb (ca acum).
3. Rândul de jos `min-height: 24px`, ca înălțimea cardurilor să fie egală cu sau fără pastilă.
4. Meniul ⋯ „Stickere pentru grupă” nu e în design: mută-l în editor, lângă titlu (vezi mai jos), ca numele să nu se taie.

**Editorul (`GroupEditor`)**, ordinea din 4a, de sus în jos:
1. **Titlu:** pătrat 10×10 radius 3 pe `bar`-ul tonului + „Editează grupa {nume}” Baloo 800 **20px** (azi 18) + „Vârste: **{interval}**” în dreapta; ⋯ (Stickere) lângă.
2. **Rândul de formular:** grid `2fr 1fr auto`, aliniat jos: „Nume grupă” (azi eticheta e „Nume”), „Capacitate”, „Salvează” (azi flex cu wrap, lățimi inegale). „Salvează” inactiv până la prima modificare, cu „Nicio modificare” în `title` (regula 15k).
3. **Echipa grupei · N** (`GroupTeamPicker`) — **înaintea** copiilor. Azi e după lista de copii.
4. **Copii în grupă · N** + căutarea „⌕ Adaugă copil fără grupă…” 320px în dreapta titlului; **alegerea adaugă direct**, fără butonul separat „+ Adaugă” (azi: `SearchSelect` + `Button`). Toast cu „Anulează” (40b).
5. **Rândurile copiilor:** grilă 4 coloane, gap 6; rând `padding: 6px 8px 6px 6px`, fără `height: 40px` fix; avatar 28px cu **inițiale (2 litere)** pe tonul grupei (`soft`/`ink`), nu prima literă pe alb; nume 13px/700; vârsta 12px `--muted`; × `--subtle`.
6. **Grupă goală:** chenar `2px dashed #e0d5c2`, radius 16, padding 24: „**Niciun copil în grupă.** Caută mai sus sau trage-i din Tablă.” (azi `EmptyState compact` generic).
7. **Ștergere:** linie `border-top: 1px solid #f3eee5`, apoi link text „Șterge grupa {nume}” 13px/800 `--pink-ink`, aliniat dreapta (azi `Button variant="danger"` plin). Blocat: text `--subtle` + motivul sub el („Mută întâi cei N copii”), nu doar `title`.
8. **Containerul:** `Card` radius 24, padding `22px 24px`, gap 18 (azi `Card` implicit, gap 16).
**Echipa grupei (`GroupTeamPicker.module.css`), după 4a:**
9. Titlu „Echipa grupei · N” Baloo 800 **18px** (azi 15) + subtitlu 12px `--muted` „din Personal · zilele marcate = când lucrează în grupă”.
10. Blocurile de rol: fundal `--cream` (#fffaf0), bordură `1px solid #f1e8d6`, radius 14, padding `10px 12px`, gap 6 (azi alb, `--border`, radius-lg, padding 12). Antet bloc: pastila rolului (Principal/Ajutor/Înlocuitor) pe tonul ei + indiciu 12px `--subtle` + link „+ Adaugă”/„Schimbă” aliniat dreapta, 13/800 `--orange-ink` (azi `Button` separat sub listă).
11. Rândul de membru: card alb, bordură `--border`, radius 12, padding `8px 10px`; avatar 26 pe tonul rolului (azi `--cream`); nume 13/800 + funcția 11px `--muted`; × `--subtle`; sub ele pastila de concediu galbenă (dacă e); **zilele L–V pe toată lățimea** (`flex:1` fiecare, radius 7, padding `3px 0`), nu pătrățele fixe de 22px. Activ: `--slate` plin; inactiv: alb cu `--border`.
12. Căutarea din Personal se deschide **în blocul rolului** (chenar `1.5px --orange`, umbră), nu sub o linie despărțitoare.
13. Rol fără nimeni: „Fără educator principal” 13/700 `--pink-ink` (principal) / „Nimeni” `--subtle` (restul).
- Test: `GroupsPage.test.tsx` — ordinea secțiunilor (Echipa înaintea Copiilor), alegerea din căutare adaugă fără al doilea clic, Salvează inactiv fără modificări. Captură lângă 4a cu 7 grupe, una goală, una plină, una fără educator.

## 9. F21 · Copii: sortare pe toate coloanele, cu aspect corect (`webapp/src/features/children/childrenColumns.tsx`, `@shared/ui/DataTable`)
Decizie utilizator 02.10 (înlocuiește varianta „fără sortare”): toate coloanele cu date se pot sorta; azi doar Copil, Părinte, Grupă au `sortValue`, iar antetul sortabil nu arată bine.
- **Coloane:** Copil (nume, `localeCompare(…, 'ro')`), Părinte · telefon (numele părintelui), Grupă (**ordinea grupelor** din `sortByGroupOrder`, „Fără grupă” la final), Scadență (ziua din lună, fără scadență la final), Plată {lună} (ordinea stărilor: Restanță → Parțial → Neachitat → Achitat → Fără taxă). Coloana ⋯ nu se sortează.
- **Aspect antet** (`Copii.dc.html#2a`): eticheta 11px/800 uppercase `--subtle` + săgeată 12px imediat după ea. Inactiv: „↕” `#d6d0c4` (vizibil și fără hover, ca să se vadă că se poate sorta). Activ: eticheta `--slate` + „↑”/„↓” `--orange-ink`. Tot antetul coloanei e `<button>` fără fundal și fără bordură, hover: eticheta `--slate`; `aria-sort` pe `th`. Fără pastilă, fără subliniere, fără iconiță mare.
- **Clic:** prima dată crescător, a doua oară descrescător, a treia oară revine la implicit (Copil ↑). Implicit: Copil A→Z.
- Sortarea se aplică înainte de paginare; pagina revine la 1. Starea în URL: `?sort=grupa&dir=desc`, alături de `?q=&grupa=&pagina=`, păstrată la întoarcerea din fișă.
- Aceeași regulă de aspect în `DataTable` pentru toate tabelele sortabile (Achitări, Cheltuieli etc.) — o singură implementare a antetului.
- Test: `ChildrenPage.test.tsx` — fiecare coloană sortează în ambele direcții; Grupă urmează ordinea grupelor; „Fără grupă”/fără scadență la final; `aria-sort` corect; starea rămâne după întoarcerea din fișă.

## 10. F22 · `Button variant="link"` arată ca un buton cu fundal (ex. „Vezi calendarul →”, Dashboard)
- `webapp/src/shared/ui/Button.module.css`, varianta `link`: fără fundal, fără bordură, `padding: 0`, `min-height` auto, `font-weight: 800`, `color: var(--orange-ink)`; hover: `color: var(--orange)` + `text-decoration: underline`; focus doar `:focus-visible` (inel 2px), niciun fundal la apăsare. `tone="inherit"` păstrează culoarea părintelui.
- Verifică toate folosirile (`grep -rn 'variant="link"' webapp/src`) după schimbare: niciun `className` local care adaugă fundal/padding (ex. `styles.linkButton`, `birthdaysCalendarLink`, `mintLink`) — scoate ce dublează varianta.
- Story: Button link pe alb, pe cremă, pe card colorat (tone inherit). Captură Dashboard lângă 1a.

## 11. F23 · Grafic „Evoluția încasărilor” după 1a (`webapp/src/features/dashboard/DashboardPage.tsx`, `@shared/ui/BarChart`)
Azi: 12 luni fixe, lunile fără date apar ca liniuțe, etichete „06”, „07”, fără scară, luna curentă abia se vede.
1. **Interval:** din prima lună cu date (încasări sau cheltuieli > 0), maximum 12 luni, până la luna curentă inclusiv. Subtitlu: „Din iunie 2026” (sub 12 luni) / „Ultimele 12 luni”. Lunile goale de dinainte nu se desenează.
2. **Etichete lună:** „Iun”, „Iul” (`formatMonthShort`), nu „06”. Sub luna curentă: „în curs” 11px `--subtle`; eticheta curentă `--orange-ink` 800.
3. **Scară:** coloană stânga 44px cu 3 valori (0, jumătate, max rotunjit în sus la 100k/50k/10k), linii orizontale punctate `#efe8db`, axa de jos `#e3dccf`. Zona graficului 190px: bara maximă = 160px (linia max la 160px de jos), 30px rămân deasupra pentru valoare. O bară de valoare V se termină exact pe poziția V a scării. Valorile compacte: „800k”, „1,2M”.
4. **Bare:** 18px lățime fiecare, gap 4 în grup, gap 10 între luni; încasări `#f6c98f` (curentă `--orange`), cheltuieli `#7cc6a0` (curentă `--mint`) — mai vizibile decât acum. Lună cu 0 la o serie: bara lipsește (nu liniuță).
5. **Valoare deasupra** barei de încasări: compact, 11px/800 (`--text-secondary`; curentă `--orange-ink`).
6. **Tooltip** (rămâne pe grup, A8): „Iulie 2026 · încasări 787.385 lei · cheltuieli 45.120 lei · diferență 742.265 lei”.
7. Fără date deloc: EmptyState existent.
- Test: `DashboardPage.test.tsx` — date doar din iunie → 5 grupe, prima „Iun”; luna curentă are „în curs”; scara arată max rotunjit. Captură lângă 1a.

## 12. F24 · „Necesită atenție” după 1a/45c (`webapp/src/features/dashboard/useDashboard.ts`, `DashboardPage.tsx`)
Comparat cu captura din aplicație (02.10): sursele sunt aceleași, textele și regula pentru prezență diferă.
1. **Titlul cardului:** „{N} lucruri de rezolvat” (N = rândurile afișate; 1 → „1 lucru de rezolvat”), nu „Rezolvă pentru date corecte” (`DashboardPage.tsx`, `panelTitle`).
2. **Prezența — doar zilele încheiate.** Azi `lastWorkingDayOnOrBefore(today)` ia și ziua de azi, deci dimineața apare „84 copii nemarcați pe azi” (zgomot: ziua nu s-a terminat). Corect: ultima zi lucrătoare **înainte de azi**; azi intră doar după ora de închidere a grădiniței (setare existentă din Grădinița, implicit 18:00).
   - Rândul e **pe grupă**, nu pe copii: titlu „Prezența de ieri nemarcată” (sau „…din {zz.ll}” dacă nu e ieri), detaliu „Grupa Venus · 12 copii”; mai multe grupe → „3 grupe · 41 copii” și linkul fără `grupa`. Număr în pătrățel = numărul de grupe.
   - Ton `date` (galben), nu `prezenta` portocaliu — designul are 3 tonuri: roz (bani), galben (date și prezență), gri (sistem). Scoate `toneOrange` din `DashboardPage.module.css`.
3. **Date incomplete:** titlu „Copii cu date obligatorii lipsă”; detaliu = cele mai frecvente 2–3 câmpuri lipsă, în cuvinte („Telefon părinte, plan sau grupă”), calculat din `missingChildFields`, nu „84 fișe au câmpuri obligatorii lipsă.”
4. **Restanțe:** titlu „Restanțe peste scadență”, detaliu „{sumă} lei · cea mai veche din {lună}”, acțiune „Vezi situația” (azi „Vezi lista”, detaliu „N copii au plata restantă.”).
5. **Telefon invalid:** titlu „Telefoane invalide”, detaliu „Nu primesc SMS”, acțiune „Corectează”.
6. **Backup:** titlu „Backup-ul extern are {N} zile” (fără copie: „Niciun backup extern încă”), detaliu „Ultima copie pe stick: {zz.ll}”, acțiune „Fă backup”; pătrățelul arată „!”, nu numărul de zile. Ton `sistem` = gri (`--neutral-soft`/`--text-secondary`), nu roz ca acum (`ATTENTION_TONE_CLASS.sistem = styles.tonePink`).
7. Ordinea rămâne: bani → date → prezență → sistem; max 5.
- Test: `useDashboard.test.ts` — dimineața, ziua de azi nemarcată nu apare; ieri nemarcat la o grupă → „Prezența de ieri nemarcată · Grupa X · N copii”; titlurile noi. Captură lângă 1a.

## 13. F25 · Zile de naștere pe Dashboard, fără nimeni în 5 zile (1b; `DashboardPage.tsx`, `useDashboard.ts`)
Azi: `EmptyState compact` cu „Nicio zi de naștere în următoarele 5 zile.”: text mic, colorat, singur în coloana stângă.
- Când `upcomingBirthdays` e gol: chenar `1.5px dashed --border`, radius 16, padding `14px 16px`; rând „Nimeni în următoarele 5 zile.” 14/700 `--text-secondary`; dedesubt rândul **Următoarea**: avatar 40 (ton din listă), eticheta „URMĂTOAREA” 12/800 `--subtle`, nume 14/800, „{zi lună} · împlinește N ani”, pastilă gri „în N zile”.
- `useDashboard.ts`: `nextBirthday` = primul din `listUpcomingBirthdays(children, 366, today)` când lista pe 5 zile e goală. Fără copii cu dată de naștere: rămâne EmptyState-ul de acum.
- Luna fără zile de naștere: în locul grilei, „Nicio zi de naștere în {lună}” 13px `--muted`.
- Restul cardului e deja ca în design; „Vezi calendarul →” intră la §10 (link fără fundal).
- Test: fără zile de naștere în 5 zile → „Următoarea” cu cel mai apropiat copil și „în N zile”.

## 14. F26 · Meniul stâng, diferențe față de `Sidebar.dc.html` (varianta a)
Structura, culorile punctelor și spațierea sunt deja ca în design. Diferă (captură 02.10):
1. **Inițialele filialei:** „1 Buiucani” → pătratul arată „1”. `branchInitials` (`src/shared/domain/branch.mjs`) sare peste cifre, spații, puncte și prefixul „Filiala ”: primele 2 litere ale primului cuvânt cu litere („Bu”). Test: „1 Buiucani” → „Bu”, „Filiala Centru” → „Ce”, „2. Botanica” → „Bo”.
2. **Butonul filialei:** azi `.orange { border-color: var(--orange) }` (bordură portocalie plină, prea tare). Design: `border: 1.5px solid var(--orange-frame)` (#f6d9b5), fundal `var(--cream)` (#fffaf0); la fel pentru mint/yellow/pink cu `--{ton}-frame` (`BranchSelector.module.css`). Bordura plină `--orange` doar la hover/deschis.
3. **Versiunea** lângă „Backup și setări”: „v2.1.2”, nu „2.1.2”.
4. **Cardul de jos** (`SaveStatusCard`/`SyncStatusCard`): două rânduri, ca în design: „● Salvat · 20:02” 13/700 + sub el 12px `--muted`: „Doar pe acest calculator” (fără sincronizare) / „Toate calculatoarele au aceleași date” (sincronizat). Padding 12, radius 14, fundal `--cream`, bordură `--border`.
5. Numele filialei afișat fără cifra din față doar dacă așa e salvat? **Nu** — numele rămâne cum l-a scris utilizatorul; doar inițialele se calculează altfel.

## 15. F27 · Antetul modulelor mai înalt (`webapp/src/app/shell/Topbar.module.css`)
În design antetul are ~64px (padding 12 + butoane/comutatoare de 38–40px). În aplicație, pe ecranele fără acțiuni mari în antet, înălțimea scade la ~52px și antetul pare îngust.
- `.topbar { min-height: 64px; box-sizing: border-box; padding: 12px 40px; }` — înălțime constantă pe toate ecranele, cu sau fără butoane.
- Titlul rămâne Baloo 800 24px; eticheta (eyebrow) 11px după titlu, la baseline.
- Butoanele din antet: înălțime 38px (`Button size="md"`), comutatoarele (`SegmentedControl`) 36px — aceleași pe toate ecranele.
- Captură: Dashboard, Copii, Grupe, Backup și setări — linia de sub antet la aceeași înălțime.

## 16. F28 · + Angajat: Funcția ca listă proprie (`webapp/src/features/personal/StaffFormDrawer.tsx`, `Personal.dc.html#23n`)
Azi `<Select>` → lista nativă a browserului, fără departamente, fără culori.
- Înlocuiește cu `SearchSelect` (sau `Select` cu popover propriu, dacă `Select` din `@shared/ui` deschide azi lista nativă — atunci repară `Select` însuși: `appearance:none` nu ajunge, lista trebuie să fie popover-ul DS, la fel ca `MonthInput` din §3).
- Cutia: punctul departamentului (8×8, radius 3) + numele funcției + ▾. Lista: căutare sus; grupe pe departament (titlu 11px uppercase `--subtle`), ordinea din `personal.roles`/`order`, punctul pe tonul departamentului (aceeași funcție ca în `RolesDrawer`); aleasă = `--orange-soft` + ✓; jos „+ Funcție nouă” → deschide `RolesDrawer` peste (nu drawer în drawer: `RolesDrawer` ca dialog, sau închide/reia formularul păstrând valorile).
- Fără funcții: în listă „Nicio funcție încă · Adaugă în Personal → Funcții”; `roleId` gol → eroare la câmp „Alege funcția”.
- Titlul drawer-ului: „Angajat nou” / „Editează angajatul” (azi „Adaugă: angajat”); subsol după §6 („Salvează angajatul”).
- Același `SearchSelect` și în `LeaveFormDrawer`, `AdvanceFormDrawer` (alegerea angajatului), dacă folosesc `Select` nativ cu > 8 opțiuni.
- Test: `StaffFormDrawer.test.tsx` — lista arată departamentele; căutarea „log” găsește Logoped; Enter alege.
- Fără câmpul Filiala (vezi §17).

## 17. F29 · Scrii doar în filiala deschisă (regulă nouă, DECIZII 02.10)
Decizie utilizator: odată deschisă o filială, nicio acțiune nu adaugă sau modifică date ale altei filiale. Ce e în Comun (personal, funcții, curs BNM) se poate citi de oriunde, dar **legătura cu o filială** (angajatul lucrează aici, plata salariului, avansul, echipa grupei) se face doar din filiala respectivă.
1. **+ Angajat** (`StaffFormDrawer.tsx:127–140`): scoate pastilele de filiale. Angajat nou → `branchIds: [filiala deschisă]`. În locul câmpului: rând informativ „Se adaugă în Filiala {nume} (filiala deschisă).” (`Personal.dc.html#23n`). Scoate validarea „Alege cel puțin o filială.” și testul ei.
2. **Editează angajatul:** `branchIds` nu se mai editează din formular. Se păstrează exact cum e; formularul modifică doar datele personale și funcția.
3. **Angajat existent în altă filială** (`#23o`): în „+ Angajat”, comutator „Angajat nou | Angajat existent”; „Angajat existent” caută în Comun angajații care **nu** au filiala deschisă și „Adaugă la {filiala}” face `branchIds.push(filialaDeschisă)`. Pe fișa angajatului (23j): „Nu mai lucrează la {filiala deschisă}” scoate doar filiala deschisă (cu confirmare și 40b); ultima filială → arhivare, ca acum.
4. **Audit — caută și închide orice altă scriere în altă filială.** De verificat (și de notat rezultatul în `INTREBARI.md`):
   - `GroupTeamPicker`: candidații = doar angajații cu filiala deschisă (`isStaffInBranch`); azi listează tot Comun-ul?
   - `AdvanceFormDrawer`, `LeaveFormDrawer`, pontaj, salarii: alegerea angajatului doar din filiala deschisă; plata salariului doar din filiala deschisă (deja așa, păstrează).
   - `BranchesSettings.tsx`: redenumirea/culoarea **altei** filiale — permisă doar pentru registru (nume, culoare, adresă), fără date; confirmă că nu scrie în baza ei.
   - Raport contabil „Ambele (o foaie pe filială)” și `/api/branches/records`: doar citire — confirmă că ruta e GET și nu are pereche de scriere.
   - Server: fiecare rută de scriere din `src/features/personal/server/*` care primește `branchId` din corpul cererii → ignoră-l și folosește filiala sesiunii; test care trimite alt `branchId` și verifică respingerea (400) sau ignorarea.
   - Setările din Comun care afectează toate filialele (funcții, `annualLeaveDays`, `deductOnlyUnexcused`): rămân, dar eticheta spune clar „pentru toate filialele”.
5. Test de arhitectură: niciun formular din `features/**` nu randează `session.state.branches.map` pentru a alege unde se scrie (doar `BranchSelector` și `BranchesSettings` au voie).

## 18. F30 · Salarii: „nu pot face plata” (`webapp/src/features/personal/SalariesView.tsx`)
În cod, „Plătește” rămâne gri fără să spună de ce. Bifa unui rând e dezactivată tăcut când: salariul nu e setat (`mode === null`), e antrenor Bazin (`mode === 'bazin'`), e deja plătit, sau luna nu s-a încheiat (stepperul nu trece de luna trecută). Utilizatorul nu vede niciunul dintre motive.
1. **Motivul pe rând:** bifa dezactivată are `title` + text sub nume (12px `--muted`): „Setează salariul întâi” (cu linkul existent) · „Se plătește din Bazin” · „Plătit {zz.ll}” · „Luna nu s-a încheiat”.
2. **Bara de plată:** butonul inactiv are motivul lângă el (regula 15k): „Bifează angajații de plătit” / „Niciun salariu setat · Setează salariile” (când toți au `mode === null`) / „Toți sunt plătiți pentru {lună}”.
3. **Plată pe un rând:** în `RowMenu` „Plătește {sumă}” (același dialog, cu un singur angajat), ca să nu fie nevoie de bifă.
4. **„Bifează tot ce se poate plăti”** în antetul coloanei de bife (`Checkbox` cu stare parțială).
5. **Luna curentă:** **implicit** rămâne blocată (doar luni încheiate). Dacă utilizatorul răspunde altfel în RASPUNSURI, se deblochează cu avertisment „Luna nu s-a încheiat; pontajul se poate schimba.”
6. **După plată:** toast 40b cu „Anulează” (anulează cheltuielile create și marcajul avansurilor), rândurile trec în „Plătit {zz.ll}”.
7. Verifică cauza reală pe datele utilizatorului (copie `dev-data-copy.mjs`): câți angajați au `mode === null`, câți `bazin`; notează în `INTREBARI.md`. Dacă `/api/personal/salaries/pay` dă eroare, mesajul trece prin `toUserError` cu motivul concret.
- Test: `SalariesView.test.tsx` — fiecare motiv apare pe rând; butonul inactiv are text; plată dintr-un rând.

## 19. F31 · „Nu pot edita salariul” (`SalaryFormDrawer.tsx`, `useSalaries.ts`, `SalariesView.tsx`)
Cauze găsite în cod (02.10):
- `SalaryFormDrawer` pornește mereu gol: `mode='fix'`, `amount=''`, `validFrom=luna curentă`, indiferent de salariul existent. Editarea arată ca o setare nouă, fără suma de acum.
- `RowMenu` → „Setează salariul” e dezactivat pentru `mode === 'bazin'`, iar în formular „Salvează” e dezactivat când alegi „Bazin”: un antrenor nu poate fi trecut pe Fix, iar un angajat nu poate fi trecut pe Bazin.
- `saveSalary` creează mereu o înregistrare nouă (`SAL-${uuid}`); a doua salvare cu aceeași lună de început poate fi respinsă de server sau poate dubla rândul.
Corect:
1. **Precompletare:** formularul primește salariul valabil acum (din `SalaryRow`: `mode`, `amount`, `validFrom`) și îl arată. Titlu: „Salariul: {nume}”; sub câmpuri: „Acum: 6.500 lei/lună din sep 2026”.
2. **Schimbare de la o lună:** „Valabil din luna” implicit = luna următoare celei plătite ultima dată (nu luna curentă, dacă e deja plătită). Aceeași lună ca salariul existent → **înlocuiește** acea intrare (același `id`), nu adaugă una nouă. Lună plătită deja → blocat, cu motivul: „Septembrie e plătită; schimbarea se aplică din octombrie.”
3. **Toate modurile se pot alege și salva:** Fix, Pe zi, Bazin. La Bazin nu se cere sumă; se salvează `mode: 'bazin'` (azi butonul e inactiv). Scoate `disabled: row.mode === 'bazin'` din `RowMenu`.
4. **Istoric în formular:** ultimele 3 schimbări („6.000 → 6.500 din sep 2026”), linkul „Tot istoricul” deschide `SalaryHistoryDrawer` (23h).
5. **Din fișa angajatului (23m):** după PIN, „Schimbă salariul” deschide același formular (azi doar link spre fila Salarii).
6. Subsol după §6: „Salvează salariul”; erori prin `toUserError` cu motivul concret.
- Test: deschizi pentru un angajat cu salariu → câmpurile au suma și modul lui; schimbi suma pe aceeași lună → o singură intrare; treci un antrenor pe Fix și invers; luna plătită e blocată cu motiv.
