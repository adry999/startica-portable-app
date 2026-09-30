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

Textele complete sunt în design; se copiază exact.

## Criterii de acceptare
- [ ] Niciun ecran nu arată tabel gol cu antet și fără rânduri
- [ ] Cu filtre active apare „Fără rezultate”, nu „Prima folosire”
- [ ] Toate folosesc `EmptyState`; niciun ecran nu are HTML propriu pentru starea goală
