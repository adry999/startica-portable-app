# Tokeni de design — inventar din toate paginile finale (29.09.2026)

Generat automat din fișierele `.dc.html`. Coloana „Token” e numele din `webapp/src/shared/tokens/tokens.css`. **Regula:** în cod se folosește mereu tokenul; hex-ul din design e doar referința.

## Culori care au deja token (32)
| Hex | Token | Folosiri | Unde |
|---|---|---|---|
| `#6b7780` | `--muted` | 613 | Achitari, Administrare, Bazin, Bon 58mm, Cheltuieli, Copii… |
| `#ffffff` | `--white` | 563 | Achitari, Administrare, Bazin, Bon 58mm, Cheltuieli, Copii… |
| `#ede7dc` | `--border` | 412 | Achitari, Administrare, Bazin, Bon 58mm, Cheltuieli, Copii… |
| `#3a4750` | `--slate` | 299 | Achitari, Administrare, Bazin, Bon 58mm, Cheltuieli, Copii… |
| `#ef8a1d` | `--orange` | 220 | Achitari, Administrare, Bazin, Bon 58mm, Cheltuieli, Copii… |
| `#9aa3a9` | `--subtle` | 205 | Achitari, Administrare, Bazin, Cheltuieli, Copii, Dashboard… |
| `#a34f00` | `--orange-ink` | 134 | Achitari, Administrare, Bazin, Bon 58mm, Cheltuieli, Copii… |
| `#fffaf0` | `--cream` | 125 | Achitari, Administrare, Bazin, Bon 58mm, Cheltuieli, Copii… |
| `#f4f1ea` | `--neutral-soft` | 78 | Achitari, Administrare, Bazin, Cheltuieli, Copii, Dashboard… |
| `#f3eee5` | `--row-divider` | 69 | Achitari, Administrare, Bazin, Cheltuieli, Copii, De notificat… |
| `#b0284f` | `--pink-ink` | 66 | Achitari, Administrare, Bazin, Cheltuieli, Copii, De notificat… |
| `#2e6b4c` | `--mint-ink` | 58 | Achitari, Administrare, Bazin, Cheltuieli, Copii, Dashboard… |
| `#c9c4ba` | `--input-border` | 56 | Achitari, Bazin, Bon 58mm, Copii, Formulare, Grupe… |
| `#fdf3d2` | `--yellow-soft` | 51 | Achitari, Administrare, Bazin, Cheltuieli, Copii, Dashboard… |
| `#fcead3` | `--orange-soft` | 50 | Achitari, Administrare, Bazin, Cheltuieli, Copii, Dashboard… |
| `#e7f4ec` | `--mint-soft` | 47 | Achitari, Administrare, Bazin, Cheltuieli, Copii, Dashboard… |
| `#f1ece2` | `--sand` | 37 | Achitari, Bazin, Cheltuieli, De rezolvat, Grupe, Incarcare… |
| `#7a5d00` | `--yellow-ink` | 35 | Achitari, Administrare, Bazin, Cheltuieli, Copii, Dashboard… |
| `#fce9ef` | `--pink-soft` | 34 | Achitari, Bazin, Cheltuieli, Copii, De notificat, De rezolvat… |
| `#f9d257` | `--yellow` | 21 | Administrare, Dashboard, Filiale, Formulare, Incarcare, Personal… |
| `#3f9a6b` | `--success-dot`, `--mint-bar` | 18 | Bazin, De notificat, Filiale, Formulare, Planuri si curs, Prezenta… |
| `#e9527c` | `--raspberry` | 13 | Bazin, Dashboard, Formulare, Personal, Set final, Sidebar… |
| `#a8d8be` | `--mint` | 13 | Dashboard, Formulare, Incarcare, Prima pornire, Responsive, Sidebar… |
| `#f3a6be` | `--pink` | 10 | Achitari, Administrare, Copii, Incarcare, Prima pornire, Sincronizare… |
| `#f6e3a6` | `--yellow-border` | 8 | Cheltuieli, Copii, Dashboard, Filiale, Planuri si curs, Responsive… |
| `#faf7f1` | `--sand-soft` | 7 | De rezolvat, Personal, Sincronizare |
| `#f7f4ee` | `--neutral-softer` | 4 | Copii, Personal |
| `#e0d5c2` | `--dashed-border-empty` | 4 | Formulare, Grupe, Prima pornire, Tiparire |
| `#e6d9c4` | `--dashed-border` | 3 | Dashboard, Responsive |
| `#f6f4f0` | `--off-day` | 3 | Tiparire |
| `#e4eef6` | `--blue-soft` | 1 | Achitari |
| `#2c5a80` | `--blue-ink` | 1 | Achitari |

## Culori fără token (22)
Pentru fiecare: dacă apare pe un singur ecran și e decorativă, poate rămâne literal în CSS-ul modulului; dacă apare în ≥2 module sau e o stare, adaugă token în `tokens.css` (numele propus e în coloana a doua).

| Hex | Propunere | Folosiri | Unde |
|---|---|---|---|
| `#5b666e` | `--text-secondary` (text secundar mai închis decât --muted) | 60 | Achitari, Administrare, Cheltuieli, Copii, Dashboard, De rezolvat… |
| `#000000` | doar bon 58 mm (tipar termic) | 26 | Bon 58mm |
| `#efe9de` | doar fundalul pânzei de design, **nu** se folosește în aplicație | 24 | Achitari, Administrare, Bazin, Bon 58mm, Cheltuieli, Copii… |
| `#cccccc` | doar tipărire alb-negru | 11 | Filiale, Personal |
| `#222222` | doar tipărire alb-negru | 9 | Personal |
| `#b9c1c6` | `--on-slate-muted` (text stins pe bara slate de selecție) | 6 | Achitari, Copii, De rezolvat, Formulare, Sidebar |
| `#e0b400` | `--excused` (Motivat / CO / Concediu) | 5 | Bazin, Personal, Sincronizare, Tiparire |
| `#f1e8d6` | `--row-border-warm` (rând fișier/copil în casete crem) | 5 | Copii, Grupe, Prezenta |
| `#5c4a00` | doar tipărire (text pe galben) | 3 | Prima pornire, Tiparire |
| `#666666` | doar tipărire alb-negru | 2 | Personal |
| `#444444` | doar tipărire alb-negru | 2 | Personal |
| `#f0d77a` | `--yellow-border-strong` | 2 | Personal, Tiparire |
| `#bfe3cf` | `--mint-border` (placă Prezent) | 2 | Prima pornire, Tiparire |
| `#a3361f` | `--allergy-ink` (alergii pe fișă) | 1 | Copii |
| `#d9cfbf` | `--border-hover` | 1 | Dashboard |
| `#5fb58a` | `--mint-bar-current` (cheltuieli luna curentă, Dashboard) | 1 | Dashboard |
| `#e2e2e2` | doar tipărire alb-negru | 1 | Personal |
| `#b89a00` | `--yellow-dash` (concediu planificat) | 1 | Personal |
| `#d8cfbf` | = `--border-hover` (#d9cfbf) | 1 | Prezenta |
| `#e9e4da` | local Sidebar | 1 | Sidebar |
| `#8e999f` | local Sidebar | 1 | Sidebar |
| `#f6d9b5` | local Tipărire | 1 | Tiparire |

Culori definite în logica paginilor (nu apar în tabel, dar se folosesc): Prezența 18a chenar grupă `#f6d3ad` / `#c6e6d3` / `#f6e3a6` / `#f6c6d5`, avatar `#f8dcbc` / `#cfe9da` / `#f8e7b0` / `#f8d0dd`, placa Prezent `#f3faf6` + border `#bfe3cf`; Grupe cele 8 tonuri (deja în tokens.css).

## Tipografie
- **Titluri, cifre mari, butoane primare:** `'Baloo 2'` (`--font-heading`), 600–800.
- **Text:** `Nunito` (`--font-body`), 400–800.
- Mărimi folosite (frecvență): 13px ×473 · 12px ×396 · 14px ×338 · 11px ×160 · 18px ×134 · 15px ×112 · 16px ×111 · 24px ×62 · 10px ×58 · 17px ×38 · 22px ×35 · 9px ×33 · 48px ×29 · 26px ×27 · 20px ×25 · 28px ×23 · 30px ×13 · 32px ×8 · 36px ×7 · 40px ×7 · 19px ×6 · 34px ×6 · 44px ×4 · 38px ×3 · 8px ×1 · 46px ×1
- Greutăți: 800 ×1374 · 700 ×422 · 600 ×32 · 400 ×2

### Scara de roluri (de respectat)
| Rol | Font | Mărime / greutate | Alte |
|---|---|---|---|
| Titlu pagină (antet) | Baloo 2 | 24 / 800 | line-height 1.1 |
| Eyebrow antet | Nunito | 11 / 800 | uppercase, letter-spacing .1em, `--subtle`; = grupa din meniu (Evidență / Contabilitate / De rezolvat / Administrare) |
| Titlu card / secțiune | Baloo 2 | 18–20 / 800 | |
| Titlu panou lateral | Baloo 2 | 26 / 800 | |
| Cifră KPI principală | Baloo 2 | 36 / 800 | Dashboard Încasări |
| Cifră KPI | Baloo 2 | 28–30 / 800 | |
| Etichetă card KPI | Nunito | 12 / 800 | uppercase, .08em, în `-ink`-ul tonului |
| Antet coloană tabel | Nunito | 11 / 800 | uppercase, .07em, `--subtle` |
| Text rând tabel | Nunito | 14 / 400–800 | nume 800 |
| Text secundar | Nunito | 12–13 / 600–700 | `--muted` sau `#5b666e` |
| Pastilă / badge | Nunito | 11–12 / 800 | padding `3–4px 10px`, pill |
| Buton primar antet | Baloo 2 | 15 / 700 | `8px 18px`, pill, `--orange`, `--shadow-button-header` |
| Buton secundar antet | Nunito | 14 / 800 | `8px 16px`, pill, alb, border 1.5px `--border` |
| Input | Nunito | 15 / 600 | `11px 14px`, radius 12, border 1px `--input-border`; focus 1.5px `--orange` |

## Raze folosite
999px ×372 · 12px ×160 · 10px ×137 · 22px ×85 · 24px ×82 · 20px ×67 · 16px ×47 · 14px ×46 · 8px ×33 · 5px ×28 · 6px ×23 · 4px ×22 · 18px ×22 · 99px ×21 · 3px ×15 · 2px ×4 · 7px ×2 · 9px ×1

Corespondență: 5–6 celule pontaj/zile · 8–10 `--radius-xs/sm` · 12 `--radius-input` · 14 `--radius-md` · 16 `--radius-md-lg` · 18–20 `--radius-lg` · 22–24 `--radius-xl` (carduri mari = 22) · 999 `--radius-pill`.

## Umbre
- Artboard (doar în design, nu în app): `0 30px 80px rgba(58,71,80,.14)`.
- Panou lateral: `--shadow-panel`. Buton primar antet: `--shadow-button-header`. Pastila activă din SegmentedControl: `--shadow-pill-active`. Popover/meniu: `0 16px 32px rgba(58,71,80,.16)` sau `0 20px 50px rgba(58,71,80,.2)`. Copia trasă (Grupe): `0 18px 36px rgba(58,71,80,.22)`.

## Tonuri de grupă (8)
| Ton | soft | ink | bar |
|---|---|---|---|
| orange | `--orange-soft` | `--orange-ink` | `--orange` |
| mint | `--mint-soft` | `--mint-ink` | `--mint-bar` |
| yellow | `--yellow-soft` | `--yellow-ink` | `--yellow-bar` |
| pink | `--pink-soft` | `--pink-ink` | `--pink-bar` |
| teal | `--teal-soft` | `--teal-ink` | `--teal-bar` |
| blue | `--blue-soft` | `--blue-ink` | `--blue-bar` |
| purple | `--purple-soft` | `--purple-ink` | `--purple-bar` |
| coral | `--coral-soft` | `--coral-ink` | `--coral-bar` |

Pe Prezența (18a) chenarul și avatarul au nevoie de două nuanțe noi per ton (`-border`, `-avatar`) — vezi tabelul de mai sus; derivă-le pentru toate cele 8 tonuri, nu doar pentru cele 4 din artboard.

## Stări (culori semantice)
| Stare | Punct / pastilă plină | Fundal soft | Text |
|---|---|---|---|
| Prezent / Achitat / Lucrat | `#3f9a6b` | `--mint-soft` | `--mint-ink` |
| Absent / Neachitat / Restanță / CM | `#e9527c` | `--pink-soft` | `--pink-ink` |
| Motivat / Parțial / CO | `#e0b400` | `--yellow-soft` | `--yellow-ink` |
| Nemarcat / Neutru | cerc gol border 1.5px `--input-border` | alb / `--neutral-soft` | `--muted` |
| A (absență personal) | `--muted` | — | alb |
| Serviciu Grădiniță | — | `--neutral-soft` | `#5b666e` |
| Serviciu Bazin | — | `--blue-soft` | `--blue-ink` |


## `--orange-strong` (nou, 30.09)
`#b85a00` — fundal pentru text alb (buton primar, insigne pline, pastila „azi”). Contrast cu alb 4,7:1. Umbra buton: `rgba(184,90,0,.28)`. `--orange` nu mai poartă text alb.

Stări pentru fundal `--orange-strong`: hover `--orange-strong-hover` = `#a34f00` (= `--orange-ink`), apăsat `--orange-strong-pressed` = `#8a4300` (nou), dezactivat `--sand` cu text `--subtle`, loading opacitate .75. Text portocaliu pe alb/crem = mereu `--orange-ink`.

## Tokeni noi R2 (01.10, PROMPT-CLAUDE-CODE-6.md §2)
- `--shadow-row-active: inset 4px 0 0 var(--orange)` — bara activă de 4px a unui rând selectat dintr-o listă (Achitări, De notificat, De verificat, SMS). Înlocuiește `box-shadow: inset 4px 0 0 var(--orange)` literal din module.
- `--font-mono: ui-monospace, 'Cascadia Mono', Consolas, monospace` — coduri/sume aliniate pe coloane (bon termic, tabele de tipărit). Înlocuiește `font-family: monospace` literal din module.
- `--shadow-ring-drag: 0 0 0 3px var(--orange)` — inel de tragere peste un card/coloană (Board, Grupe). Înlocuiește `box-shadow: 0 0 0 3px var(--orange)` literal din module.
- `--print-paper: #fff` (nou) — alături de `--print-ink`/`--print-muted`/`--print-rule` deja existente, pentru tipar alb-negru real (bon termic, etichete, chitanțe). Înlocuiește `#fff`/`#000` literale din modulele de tipărire.
