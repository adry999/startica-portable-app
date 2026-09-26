# Convenții vizuale Startica (redesign v1.7)

Aplică-le la orice modificare de UI în `webapp/`. Sursa de adevăr sunt fișierele din `docs/design/*.dc.html`.

## Culoare
- Cifrele mari (sume, contoare KPI) sunt mereu `var(--slate)`. Nu moșteni culoarea tonului cardului.
- Culoarea ink a unui ton (`--orange-ink`, `--mint-ink`, `--yellow-ink`, `--pink-ink`) se pune doar pe label, link sau badge, nu pe tot cardul.
- Roșul (`--pink-ink`) e doar pentru bani datorați, erori și acțiuni distructive.
- Valorile zero sunt gri (`--subtle`) și nu au CTA.

## Suprafețe
- Cardurile colorate sunt plate, fără umbră. Cardurile albe au `border: 1px solid var(--border)`, fără umbră.
- Umbra e doar pentru elementele care plutesc: drawer, modal, meniu ⋯, bara de selecție, toast, butonul primar.
- Raze: 22–24 carduri, 16 rânduri/casete, 12 inputuri, 999 pill-uri.

## Tipografie
- Label/eyebrow: 12 px, 800, uppercase, letter-spacing .08em.
- Capete de tabel: 11 px, 800, uppercase, .07em, `--subtle`.
- Titluri: Baloo 2 800. Pagină 30, card 18–20, KPI 36 (28 în ecranele secundare).
- Text: Nunito 14; meta 12–13.

## Interacțiuni
- Acțiunile de pe rând stau în meniul ⋯, nu ca link-uri înșirate pe rând.
- Filtrele stau în capul tabelului, nu într-un card separat.
- Arhivarea se confirmă cu toast „Anulează”, nu cu dialog. Ștergerea definitivă cere „Scrie ȘTERGE”. Nu folosi `window.confirm`.
- Creare/editare în Drawer; detaliu rapid în panou dreapta 380–400 px.

## Verificare
Înainte de commit, deschide ecranul la 1440 px lângă artboard-ul din `docs/design/` și compară: label-uri, culoarea cifrelor, umbre, raze, spațieri.

## Totul trebuie să încapă
- Butoanele, pastilele, badge-urile, tab-urile și filtrele au `white-space:nowrap`. Nu se rup niciodată pe două rânduri.
- Dacă o bară (filtre, antet, footer de modal) nu are loc pe un rând, **treci pe două rânduri** (tab-uri sus, căutare + filtre jos) sau scurtează etichetele („30 de zile ▾”, nu „Perioadă: Ultimele 30 de zile ▾”). Nu lăsa elementele să iasă din card.
- Câmpul de căutare e singurul element elastic: `flex:1; min-width:0`, cu text trunchiat (`text-overflow:ellipsis`).
- Coloanele de tabel: `minmax(0, …fr)` pentru text, lățimi fixe pentru badge-uri și sume. Textul lung dintr-o celulă se trunchiază pe un rând.
- Sumele mari (KPI) au `nowrap`; dacă nu încap, se micșorează fontul sau se scot zecimalele, nu se rup.
- Testează fiecare ecran la 1280 px și 1440 px.


## Bara de filtre (sub bara de căutare)
Rând separat sub căutare: padding 12px 16px, border-bottom #ede7dc, gap 8px, flex-wrap. Eticheta grupului de filtre: 13px/700 #6b7780. Pastile: padding 6px 14px, radius 999, 13px/800, în culoarea pastel a valorii (grupă, statut, categorie, metodă). Pastila activă: #3a4750 cu text alb. Între grupurile de filtre: separator vertical 1×22px #ede7dc. Contorul opțional în dreapta: 14px/800. Dropdown-urile rămân doar pentru perioadă și arhivare. Referință: Copii 2a (Zile de naștere).


## Antetul modulului (compact)
Înălțime ~60px: padding 12px 40px, border-bottom #ede7dc. Pe un singur rând: titlul (Baloo 2, 24px/800), apoi eticheta secțiunii (11px/800, uppercase, #9aa3a9) aliniată la baseline. Butoane din antet: primar padding 8px 18px, 15px, umbră 0 4px 10px rgba(239,138,29,.28); secundar padding 8px 16px.
