# 30 — Stări goale pe ecrane

**Referință:** `Stari goale.dc.html#35a`, `#35b`. Componenta: `EmptyState` (15e), aleasă automat de liste (`DS Incarcare si stari.dc.html#29h`, regula R9). Ecranele dau doar `empty="<cheie>"`; textele de mai jos stau în `@shared/ui/empty-states.ts`.

## Variante
- **Prima folosire** (`variant="first"`): chenar `2px dashed --dashed-border-empty`, 3 puncte (orange/yellow/mint), titlu Baloo 22 (28 pe ecran întreg), text 14–15 `--muted`, un singur buton primar. Doar când modulul n-a avut niciodată date în filiala curentă.
- **Totul e rezolvat** (`variant="done"`): `--mint-soft`, text `--mint-ink`, fără buton. Pentru liste de sarcini golite (Situația, De notificat, De rezolvat).
- **Perioadă fără date** (`variant="period"`): card alb, fără puncte; butonul doar dacă acțiunea are sens pe perioada afișată.
- **Fără rezultate** (15e) are prioritate: dacă există căutare sau filtre active, se arată ea.

## 35a — Ecran întreg (Copii)
- KPI-urile rămân, cu „—” `--subtle`. Căutarea, filtrele, tabelul și paginarea nu se randează.
- Butoane: „+ Copil nou” (primar) · „Din vizitele programate” (secundar, doar dacă există vizite programate).

## 35b — Text pe ecran
| Ecran | Variantă | Titlu | Buton |
|---|---|---|---|
| Achitări | period | Nicio achitare în {luna} | + Achitare nouă |
| Prezența | period | {Zi}, {data} (weekend/sărbătoare) | — |
| Grupe | first | Nicio grupă încă | + Grupă nouă |
| Personal | first | Niciun angajat adăugat | + Angajat nou |
| Vizite | first | Nicio vizită programată | + Programează vizită |
| Bazin | first | Niciun copil la bazin | + Înscrie la bazin |
| Situația plăților | done | Toți au achitat {luna} | — |
| De notificat | done | Nimeni de notificat | — |
| Mesaje SMS | first | Niciun SMS trimis | + SMS nou |
| Cheltuieli | period | Nicio cheltuială în {luna} (15e) | + Cheltuială nouă |

Textele complete (titlu + text + buton) sunt în design; se copiază exact.

## 35c — Pagini, file și panouri (varianta mare)
| Cheie | Unde | Variantă | Titlu | Buton |
|---|---|---|---|---|
| copii.first | Copii (35a) | first | Încă nu e niciun copil în {filiala} | + Copil nou (+ „Din vizitele programate”) |
| derezolvat.done | De rezolvat | done | Nimic de rezolvat | — |
| asociere.done | Asociere achitări | done | Toate achitările sunt asociate | — |
| conflicte.done | Conflicte | done | Niciun conflict | — |
| taxe.first | Taxe și grupe | first | Niciun copil activ | + Copil nou |
| candidati.first | Personal · Candidați | first | Niciun candidat încă | + Candidat |
| istoric.first | Administrare · Istoric | first | Nicio modificare înregistrată | — |
| servicii.first | Setări · Servicii | first | Niciun serviciu încă | + Serviciu nou |
| planuri.first | Setări · Curs valutar | first | Niciun plan adăugat | + Plan |
| curs.period | Setări · Istoric curs | period | Niciun curs înregistrat | Descarcă acum |
| zilenastere.period | Zile de naștere | period | Nicio zi de naștere în {luna} | — |
| prezenta.nochildren | Prezența · Ziua | period | Niciun copil înscris pe {data} | — |
| situatia.year.period | Situația · An școlar | period | Niciun copil cu taxă în {an} | — |
| bazin.month.period | Bazin · Luna | period | Nicio programare în {luna} | — |
| raport.period | Raport contabil | period | Nicio mișcare în perioada aleasă | — |
| bonzi.period | Închiderea zilei | period | Nicio achitare pe {data} | — |

## 35d — Compact, în interiorul unui card
`EmptyState size="compact"`: un rând 13px `--muted`, fără chenar și fără puncte, padding 8px 0; acțiunea e link. Doar în cardurile care au deja titlu.
Chei: dashboard.attention.done, dashboard.birthdays, dashboard.visits, fisa.notes, fisa.pickup, fisa.payers, fisa.absences, grupe.members, grupe.pool.done, prezenta.month.group, vizite.day, vizite.month.rest, cheltuieli.categories, bazin.coach, raport.income, raport.expenses, asociere.suggestions. Textele exacte sunt în 35d.

## 35e — Nu intră în catalog
- Căutare/filtre fără rezultat → `variant="no-results"`, text generat („Niciun rezultat pentru „{căutare}”” / „…pentru filtrele alese”) + „Șterge filtrele”.
- „Niciun rezultat” din dropdown-uri → implicit în componentă.
- Valori de câmp („Niciun asistent”), erori/toast-uri, opțiuni de select („Niciodată”), indicii sub câmp.
→ Testul R9 le scoate din regulă după tipar (nu prin allowlist): texte aruncate cu `throw`/`toast`, props `label`/`hint`/`emptyLabel`.

## Criterii de acceptare
- [ ] Niciun ecran nu arată tabel gol cu antet și fără rânduri
- [ ] Cu filtre active apare „Fără rezultate”, nu „Prima folosire”
- [ ] Toate folosesc `EmptyState`; niciun ecran nu are HTML propriu pentru starea goală
- [ ] Fiecare cheie din 35b–35d există în `empty-states.ts`, cu titlul, textul și butonul exact
- [ ] Allowlist-ul R9 (text și import) e gol
