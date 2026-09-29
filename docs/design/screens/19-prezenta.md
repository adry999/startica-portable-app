# 19 — Prezența (ziua · luna)

> **Actualizat 29.09.2026:** **Marcarea în masă e scoasă** (DECIZII 14): nu există „Toți nemarcații → prezenți” și nici „Toată grupa prezentă”; secțiunile și criteriul despre ele de mai jos sunt anulate. Sus: bandă compactă; grupe în chenar colorat; Luna după A3e. Unde textul de mai jos contrazice `DECIZII.md` sau `ALINIERE-DESIGN.md`, acelea au prioritate.

**Referință:** `Prezenta.dc.html#18a`, `#18b`. **Nou.** Prezența e doar evidență și nu modifică taxa.

## Date
- Tabel nou `attendance` (`childId`, `date` 'YYYY-MM-DD', `status` 'present'|'absent'|'excused', `reason` text, `updatedAt`). Cheie unică (childId, date). Lipsa rândului = nemarcat.
- Per filială, ca restul datelor. Se sincronizează ca orice altă fișă. La conflict pe aceeași zi câștigă ultima modificare, fără dialog.
- Rute server: `GET /api/attendance?date=` · `GET /api/attendance?month=&groupId=` · `POST /api/attendance` (listă de { childId, date, status, reason }).

## Meniu
- `nav-items.ts`: `{ view: 'attendance', label: 'Prezența' }` după Grupe. Ruta `/prezenta`. Topbar: eyebrow „Evidență”, titlu „Prezența”.

## 18a — Ziua
- Antet: comutator Ziua | Luna, `DayStepper` (‹ Joi, 24 septembrie ›, fără zile viitoare), buton principal „Toți nemarcații → prezenți”.
- 4 carduri: Prezenți (mint), Absenți, Motivați, Nemarcați. Numără pe toate grupele, indiferent de filtru.
- `FilterPills` Grupa (`groupTone`) + legenda culorilor în dreapta.
- Pe fiecare grupă: eticheta grupei, „N din M prezenți · K nemarcați”, link „Toată grupa prezentă”. Grilă de 5 coloane cu plăci de copil: avatar în `groupTone`, nume, starea scrisă, cerc cu ✓ / × / M.
- Clic pe placă: Prezent → Absent → Motivat → nemarcat. Salvare optimistă cu debounce de 400 ms. „Motivat” deschide un popover mic cu motivul (opțional; sugestii Boală, Concediu).
- Copiii arhivați sau înscriși după această dată nu apar.

## 18b — Luna
- `MonthStepper`, `FilterPills` Grupa (o singură grupă selectată), „Tipărește” (A4 orizontal, `@media print`), „Exportă” (.xlsx).
- Grilă: rând per copil, coloană per zi. Punct verde / roz / galben, weekend și sărbători cu fundal `#f6f4f0`, zile viitoare cu cerc punctat. Coloana „Zile” = prezent/lucrătoare. Rândul de jos = prezenți pe zi.
- Clic pe celulă = aceeași alegere ca în 18a, pentru acea zi.
- Sărbătorile legale se țin într-o listă în `#shared/domain/holidays-md.mjs`.

## Fișa copilului
- Secțiune nouă „Prezența”: luna curentă pe o linie de puncte + lista absențelor motivate cu motivul.

## Anulare și istoric (toate acțiunile)
- **Orice** modificare de prezență intră într-o stivă de anulare: clic pe copil, motivul la Motivat, „Toți prezenți” pe grupă, „Toți nemarcații → prezenți”. O intrare = o acțiune a utilizatorului (cea în masă e o singură intrare). Se ține `{ id, time, label, changes: [{ childId, date, before, after }] }`.
- Stiva e **per zi și per filială**, se păstrează în baza locală (nu doar în memorie), deci supraviețuiește reîncărcării. Se golește la miezul nopții zilei respective; după aceea, revenirea se face din Administrare → Istoric.
- **Antet:** buton dublu „↶ Anulează | N ▾” înaintea butonului principal. „↶ Anulează” (și Ctrl+Z) anulează ultima acțiune. „N ▾” deschide popover-ul „Modificări azi” (420px): lista, cea mai nouă sus, cu oră · text („Conea Timur: Absent → Motivat”; acțiunile în masă îngroșate) · „Anulează” / „Anulează până aici”. Sus e „Anulează tot” (roșu). Jos: „Fiecare modificare e salvată și în Administrare → Istoric.” Fără istoric, ambele părți sunt gri și inactive.
- „Anulează până aici” anulează acțiunea respectivă și toate cele de după ea, în ordine inversă.
- Anularea restaurează exact starea de dinainte (inclusiv „nemarcat” = ștergerea rândului din `attendance` și motivul vechi). Anularea însăși se scrie în Istoric, dar nu intră în stivă.
- **Acțiunile în masă** („Toți nemarcații → prezenți”, „Toți prezenți” pe grupă):
  - ating **doar** copiii nemarcați; nu schimbă niciodată un Absent sau un Motivat;
  - butonul arată câți sunt: „Nemarcații (5) → prezenți”; la 0 devine gri, „Toți sunt marcați”;
  - după acțiune apare toastul „✓ 5 copii marcați prezenți · toate grupele [↶ Anulează] ×”, care **nu dispare singur** — doar la ×, la următoarea acțiune sau la schimbarea zilei.
- Sincronizare: o anulare e o modificare normală, cu `updatedAt` nou. Dacă între timp alt calculator a schimbat același copil în aceeași zi, anularea pentru acel copil se sare, iar toastul spune „1 copil nu a fost anulat: modificat de pe alt calculator”.

## Starea salvării (în antet)
Clicurile sunt rapide și multe, așa că Prezența are propriul indicator, imediat după titlu (titlul are `flex:0 0 auto`, iar pastila `margin-right:auto`). Folosește aceeași sursă ca și cardul de salvare din meniu (13 · 15f), deci cele două arată mereu la fel.
| Stare | Aspect | Când |
|---|---|---|
| Salvat | punct `#3f9a6b`, text `#2e6b4c`: „Salvat · 10:42” (ora ultimei scrieri reușite) | toate modificările sunt în baza locală |
| Se salvează… | punct `#e0b400`, text `#7a5d00` | imediat după un clic, până la confirmarea scrierii; sub 300 ms nu se afișează (rămâne „Salvat”) |
| Nesalvat · N modificări | fundal `#fce9ef`, border `#f3a6be`, text `#b0284f` + buton „Încearcă din nou” | scrierea a eșuat; modificările stau într-o coadă locală și se reîncearcă automat la 5 s, 15 s, 60 s |
- Starea „Nesalvat” nu blochează lucrul: clicurile se adaugă în coadă, iar N crește.
- Cu modificări nesalvate, schimbarea zilei, a paginii sau închiderea ferestrei cere confirmare („Ai 3 modificări nesalvate. Rămâi pe pagină?”, via `beforeunload`).
- Cu sincronizarea (18), „Salvat” înseamnă salvat pe acest calculator; trimiterea la server se vede în cardul din meniu, nu aici.
- Anulările trec prin aceeași stare.

## Criterii de acceptare
- [ ] Orice acțiune se poate anula (buton, Ctrl+Z, lista); „Anulează până aici” merge corect cu 5+ acțiuni
- [ ] Stiva supraviețuiește reîncărcării și e separată pe zi
- [ ] Acțiunea în masă nu schimbă Absent/Motivat și se anulează dintr-un singur clic
- [ ] Indicatorul trece Salvat → Se salvează… → Salvat · ora; la eroare arată numărul de modificări și „Încearcă din nou”; plecarea de pe pagină cu modificări nesalvate cere confirmare
- [ ] Un clic schimbă starea imediat; reîncărcarea paginii păstrează starea
- [ ] „Toți nemarcații → prezenți” nu atinge copiii deja marcați absent sau motivat
- [ ] Weekend-urile și sărbătorile nu intră în „zile lucrătoare”
- [ ] Nicio legătură cu taxa sau cu Situația plăților
