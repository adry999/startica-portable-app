# Componente reutilizabile și design system — 29.09.2026

Designul final folosește un set mic de piese care se repetă pe toate ecranele. Codul are deja `webapp/src/shared/ui` (exportate din `@shared/ui`) și pagina `/design-system`. Acest fișier leagă fiecare tipar din design de componenta din cod, spune ce trebuie extins și ce componente noi trebuie extrase.

**Reguli**
1. Un tipar care apare în **≥ 2 module** devine componentă în `@shared/ui` (sau `@shared/<domeniu>`). Un tipar folosit într-un singur loc rămâne local modulului.
2. Componentele primesc **tonuri** (`PillTone`/`CardTone`/`BadgeTone`, 8 tonuri + neutral), nu culori. Hex-ul stă doar în `tokens.css` (vezi `TOKENS.md`).
3. Fiecare componentă nouă sau variantă nouă: test în `*.test.tsx` și o secțiune în `/design-system` cu toate stările (implicit, hover, activ, dezactivat, gol, eroare).
4. Nu dubla o componentă existentă cu CSS local; extinde-o cu o prop.

---

## 1. Componente existente → unde apar în design → ce lipsește

| Componentă | Tipar în design | Unde | De făcut |
|---|---|---|---|
| `Button` (primary/ghost/white/outline · md/lg/header) | Buton primar antet Baloo 15/700 `8px 18px`; secundar Nunito 14/800 `8px 16px` alb, border 1.5px | toate antetele | Varianta secundară de antet = `outline` + `size="header"` trebuie să dea exact `8px 16px` 14/800 (acum outline are alt padding). Variantă nouă `danger` (`--pink-ink` plin, alb) pentru „Șterge N copii” (15h). |
| `SegmentedControl` | Comutator mod (Tabel/Pe luni, Ziua/Luna), Metodă, Serviciu, Suma liberă/fixă | antete, 15b, 10d | Variantă `size="field"` (radius 12, opțiune `8px 0`, flex:1 — în formulare) vs. `pill` (antet, radius 999). |
| `FilterPills` | „Grupa · Toate · Mars…”, „Metodă”, „Serviciu” | Copii, Achitări, Cheltuieli, Prezența, Pontaj, Situația | Suportă deja 1–2 grupuri; Achitări are 3 (Metodă · Grupa · Serviciu) → scoate limita. |
| `Badge` | Pastile de stare, serviciu, cod pontaj | peste tot | Adaugă `size="sm"` (11px, `2px 8px`) pentru insigna „+1”, „implicit”, „editată”. |
| `Card` (tone, decorative) | Carduri albe radius 22 border; KPI soft radius 20 cu cerc | peste tot | Radius: design folosește **22** pentru cardurile mari de conținut și **20** pentru KPI — verifică `Card.module.css`. |
| `PersonCell` (md/lg) | Avatar + nume + sub | Copii, Personal, Candidați, Achitări (Pe luni), De notificat, fișe | Avatar 36–38 în listă (acum 30). Adaugă `size="sm"` 26 (Prezența Luna, Bazin Luna) și `size="md"` = 38. |
| `DataTable` (+groupBy) | Tabele cu antet 11/800 uppercase, rânduri `11–12px 20px` | Copii, Achitări, Cheltuieli, Personal, Vizite, Candidați | Selecție cu bifă stilizată (16px radius 5, portocaliu), sortare pe coloană (Serviciu), stare `archived` a rândului (opacity .75). |
| `ListToolbar` + `SearchInput` | Căutare pill 260–360px + acțiuni + contor | Copii, Personal, Candidați | Pe același rând cu FilterPills la Echipa (23a). |
| `SelectionBar` | Bara slate „N selectați · acțiuni · Anulează ×” | Copii, Achitări, Cheltuieli, Vizite | Slot `danger` (pastilă `--raspberry` plină) pentru „Șterge definitiv” (B2). Textul acțiunilor secundare `#b9c1c6` → token `--on-slate-muted`. |
| `ConfirmDeleteDialog` | „Scrie ȘTERGE” | peste tot | Props noi: `items: string[]` (max 5 + „și încă N”), `consequences: ReactNode`, `confirmLabel` (ex. „Șterge 3 copii”). |
| `Drawer` | Panou 480–560 | toate formularele | Aliniat (A1). Subsol cu text stânga (`footerHint`) + butoane dreapta. |
| `RowMenu` | Meniu ⋯ 32×32 radius 10 | tabele | Aliniat. |
| `Toast` (+action) | Toast slate cu „↶ Anulează” | arhivări, note | Opțiune `persistent` (fără auto-închidere) — rămâne pentru cazuri viitoare; momentan nefolosită (marcarea în masă a fost scoasă). |
| `MonthStepper` / `DayStepper` | „‹ Septembrie 2026 ›” | Dashboard, Situația, Salarii, Pontaj, Prezența | Salarii: blochează lunile neîncheiate (`max`). |
| `ProfileLayout` / `ProfileSection` / `StatCard` | Fișa copilului, fișa angajatului | 2b, 23j | Grila `minmax(0,1fr) minmax(0,1.35fr)` (A3); prop `columns` ca 23j să-și păstreze proporția. |
| `EmptyState` | 3 variante | liste | Aliniat. |
| `ScrollArea` | Bara subțire 15g | meniu, panouri, popover-e | Aliniat. |
| `BnmRateLink` | ↗ spre bnm.md | curs în 12a/12b | Folosit și de pastila nouă de curs (vezi 2). |
| `groupTone()` | Tonul grupei | peste tot | Să citească `group.tone` ales manual, nu doar poziția (inconsistență semnalată în COADA). |
| `AttendanceDot` (`@shared/attendance`) | Punct de stare 10/14/22 | Prezența, Bazin, fișa | Mărimi `sm` 10, `md` 14, `lg` 22; nemarcat = cerc gol. |

## 2. Componente noi de extras

| Componentă nouă | Ce face | Unde se folosește (≥2) | Detalii din design |
|---|---|---|---|
| `Kpi` (în `Card`) | Etichetă 12/800 uppercase în `-ink` + valoare Baloo + rând mic | Dashboard, Achitări, Cheltuieli, Situația, Salarii, Bazin, Set final | `size`: `xl` 36 (Încasări Dashboard), `lg` 30, `md` 28, `sm` 22–24; `sub` 13px `#5b666e`; `emphasis` = border 2px slate (Rămas de plătit). |
| `CurrencyRatePill` | Pastila „€ 19,92 lei · Curs BNM · azi ↗”, link spre bnm.md | Dashboard (1a), Planuri și curs (12f), Achitare nouă cu taxă € (12b) | Cerc 30 `--mint-soft` „€”, Baloo 15/800, sub 11/700 `--subtle`, padding `6px 12px 6px 6px`, pill, border `--border`, hover border `--border-hover`. Construită peste `BnmRateLink`. |
| `AmountInput` | Suma mare: Baloo 40 (36 în dialog) + monedă 18/700 `--subtle`, caset `14px 18px` radius 16 border 1.5px `--orange` fundal `--cream` | 15b, 15c, Avans (23g), Programare bazin | + slot `shortcuts` (pastile „1 lună · 9.600”). |
| `ChoiceCards` | Carduri selectabile (radius 12–14, border 1.5px; selectat 2px `--orange` + `--orange-soft`), titlu 14/800 + sub 12px | 15a (programe), 22b (ore cu locuri), 10d (tonuri, ca swatch) | `disabled` pentru ora plină; `columns`. |
| `ChipSelect` | Pastile de alegere unică/multiplă, `7–9px 14–16px` 13/800, selectat = ton plin sau slate | 15a (grupă cu „3 locuri”), 15c (categorie), 22b (zile), Pontaj tipărit | `tone` per opțiune, `sub` opțional. |
| `TonePicker` | 8 pătrate 32×32 radius 10, selectat border 2px `-ink` | 4c (Grupă nouă), 10d (Serviciu nou) | Valoare = `PillTone`. |
| `DragHandle` + `setDragGhost()` | Mânerul ⋮⋮ (opacity .55, hover fundal alb) și imaginea de tragere: copie rotită −2°, border 2px `--orange`, umbră `0 18px 36px rgba(58,71,80,.22)`; sursa = loc gol punctat, ținta = inel `0 0 0 3px var(--orange)` | Grupe (grupe + copii), 10d Servicii, categorii cheltuieli | Utilitar în `@shared/dnd`; tranziție 120ms. |
| `UndoHistory` + `useUndoStack()` | „↶ Anulează | N ▾” + popover „Modificări azi” (oră, etichetă, „Anulează” / „Anulează până aici”, „Anulează tot”), Ctrl+Z | Prezența Ziua, Prezența Luna, Pontaj | Stiva per zi și filială, persistată; anularea = mutație normală (sync + Istoric). |
| `SaveIndicator` (mutat în `@shared/ui`) | „● Salvat · 08:12 / Se salvează… / Nesalvat · 3 modificări + Încearcă din nou” | Prezența, Pontaj, Bazin (marcaj) | Există în `attendance/`; mută-l în shared. |
| `NoteList` | Note cu dată, oră, autor, „editată”, ⋯ Editează/Șterge, formular inline | fișa copilului (2b), fișa angajatului (23j) | Cea mai recentă pe `--yellow-soft`, restul `--neutral-softer`; radius 14, padding `12px 14px`, 14px/1.45. |
| `ServiceBadge` + `serviceTone()` | Pastila serviciului (Grădiniță, Bazin, …) | Achitări, fișa (istoric plăți), Raport contabil, bon de zi, Asociere | Peste `Badge`, tonul vine din `services[].tone`. |
| `SettingsList` | Lista editabilă cu mâner, pastilă, contor, stare Activ/Ascuns, „Editează” + „+ Element” în antet | 10d Servicii, categorii cheltuieli, Funcții (23e), Planuri (12a) | Grid `24px 1fr 150px 120px 90px`, rând `12px 20px`, nota de jos 12px. |
| `GroupSection` | Chenar în tonul grupei (fundal soft, border `-border`, radius 22) cu antet nume Baloo 19 + sumar | Prezența Ziua; candidat și pentru Bazin Săptămâna | Necesită tokenii `--<ton>-border` și `--<ton>-avatar` pentru toate 8 tonurile. |

## 3. Pagina `/design-system`
Adaugă (sau actualizează) câte o secțiune pentru fiecare rând din tabelul 2 și pentru variantele noi din tabelul 1: `Button danger`, `SegmentedControl field`, `Badge sm`, `PersonCell sm/md`, `SelectionBar` cu danger, `ConfirmDeleteDialog` cu listă, `AttendanceDot` pe 3 mărimi. Fiecare secțiune arată toate stările. Scara de tokeni (culori, tipografie pe roluri, raze, umbre) din `TOKENS.md` apare sus pe pagină.

## 4. Ordine
Extrage componentele **în punctul din ALINIERE care le folosește prima dată**, nu într-un pas separat înainte: `AmountInput` + `ChipSelect` + `ChoiceCards` în A2/A3b, `NoteList` în A3, `UndoHistory` + `SaveIndicator` + `GroupSection` în A3c, `DragHandle` în A8 (Grupe), `SelectionBar danger` + `ConfirmDeleteDialog items` în B2, `ServiceBadge` + `SettingsList` + `TonePicker` în B3, `Kpi` + `CurrencyRatePill` în A8 (Dashboard). La al doilea ecran care o folosește, doar o reutilizezi.
