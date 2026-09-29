# 29 — „Copil nou” (15a): cod vs design

Verificat 29.09.2026 pe `master-v2` (b84d7df): `webapp/src/features/children/ChildFormDrawer.tsx` + `.module.css` + `shared/ui/Drawer.module.css`, comparat cu `Formulare.dc.html#15a`.
„Grupă nouă” (4c) e aliniat. „Copil nou” nu: e formularul vechi, cu titluri numerotate puse peste el.

## A. Panoul (`Drawer`) — afectează toate panourile, deci și 4c
| | Design 15a | Cod acum |
|---|---|---|
| Antet | padding `24px 30px`, `border-bottom: 1px solid var(--border)` | `24px 24px 16px`, fără linie |
| Corp | padding `22px 30px`, gap 22 între secțiuni | `0 24px 24px` |
| Subsol | padding `18px 30px`, border-top; text stânga + Anulează + Salvează | `16px 24px`, doar Salvează |

Fix în `Drawer.module.css` (header/body/footer). Verifică apoi că 4c arată la fel.

## B. Titlu și subsol
- Titlu: **„Copil nou”** / „Editează copilul” (acum „Adaugă: copil” / „Editează: copil”).
- Subsol, ca în 15a: stânga „Poți completa restul mai târziu din fișă.” (13px, `--muted`); dreapta `Button variant="outline"` „Anulează” + `Button` „Salvează copilul”. Model: `footer`/`footerNote`/`footerActions` din `GroupFormDrawer.module.css`, pe un singur rând.

## C. Secțiunile — fără chenar
- Scoate chenarul de pe `.section` (`border`, `border-radius`, padding) și de pe `.parentCard`. În 15a secțiunile sunt doar titlu + câmpuri, gap 12.
- Titlu secțiune: 12px/800, uppercase, `letter-spacing: .08em` (acum `.02em`), `--orange-ink`. Fără `<legend>` cu padding: folosește un `<span>` sau resetează stilul legend-ului.
- Câmpuri: input padding `11px 14px`, radius 12, font 15px/600 (acum `8px 12px`, 13px). Focus: `1.5px solid var(--orange)`.

## D. Conținut pe secțiuni
**1 · Copil** — grid `1fr 1fr 170px`, gap 10: Nume · Prenume · Data nașterii. Sub grid, un rând 12px `--muted`: „10 luni · se potrivește în grupele: **Mars, Soare**” (sau „**niciuna** — vezi grupele” cu link spre `/grupe`). Acum: câmpuri unul sub altul, IDNP, Adresă, Statut, grupele ca badge-uri separate.
- IDNP, Adresă, Statut **nu** apar în „Copil nou”. Statut implicit „Activ”. Toate trei rămân în „Editează copilul” (vezi E).

**2 · Părinți** — câte un rând per părinte, grid `1.4fr 1fr 110px`: Nume · Telefon · Relație (select: Mamă, Tată, Bunică, Bunic, Tutore, Altul). Sub rânduri, link 13px/800 `--orange-ink` „+ Adaugă încă un părinte” care arată al doilea rând (max. 2, modelul rămâne `parent/phone/parent2/phone2` + câmp nou `parentRelation`/`parent2Relation`, decizia 29.09). Fără carduri „Părinte 1 / Părinte 2”, fără „(opțional)” în etichetă.

**3 · Contract și taxă** — grid 3 coloane: Nr. contract · Începe la (`attendanceDate`) · Scadență („ziua N”, `dueDay`). Sub el, cele 3 carduri de program (`usePlanPresets`), **mereu vizibile**, nu doar la EUR: card radius 14, padding `12px 14px`, border 1.5px `--border`; selectat border 2px `--orange` + `--orange-soft`. Conținut: nume 14/800 + „8:00–13:00 · 190 €” 12px `--muted`. Alegerea cardului setează taxa și moneda.
- Scoase din „Copil nou”: Data contractului, Retragere, Statut din luna, Monedă (select), Taxa lunară (input), Taxa din luna. `statusFrom`/`feeFrom` = luna lui „Începe la”.
- „Nr. contract” nu există în model: câmp nou `contractNumber` (string, opțional). Dacă nu vrei câmp nou acum, pune „Data contractului” pe prima coloană.

**4 · Grupă (opțional)** — chip-uri pastilă 9px 16px, 13px/800, **pe un rând**, fără al doilea rând de text: „Fără grupă” (selectat = `--slate` plin, text alb), apoi „Mars · 3 locuri” în tonul grupei (`groupTone`, fundal `-soft`, text `-ink`). Selectat: fundal plin al tonului. Acum: chip-uri albe cu border gri, text pe 2 rânduri, toate portocalii la selectare.

## E. Ce se întâmplă cu câmpurile scoase
Nimic nu se pierde. În modul **editare** (`target` e un copil), după secțiunea 4 apar două secțiuni pliate (închise implicit, titlu cu ▸):
- **5 · Alte date:** IDNP, Adresă, Statut, Data contractului, Retragere, Date medicale / alergii (+ nota „nu apar în export”), Persoane autorizate să ridice copilul (spec 28).
- **6 · Istoric (avansat):** cele două textarea de istoric + nota.
În modul „Copil nou” nu apar deloc.

## Criterii
- [ ] Captură „Copil nou” la 1440 × 1100 suprapusă peste `Formulare.dc.html#15a`: aceleași 4 secțiuni, aceeași ordine, fără chenare
- [ ] Antet/corp/subsol ale `Drawer` identice cu 15a; 4c neschimbat vizual în afară de padding
- [ ] Cardurile de program vizibile și în MDL
- [ ] Chip-urile de grupă în culoarea grupei
- [ ] Editarea unui copil existent păstrează toate câmpurile (secțiunile 5–6)
- [ ] `npm run check` + webapp typecheck/test verzi
