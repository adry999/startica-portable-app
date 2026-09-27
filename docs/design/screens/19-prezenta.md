# 19 — Prezența (ziua · luna)

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

## Criterii de acceptare
- [x] Un clic schimbă starea imediat; reîncărcarea paginii păstrează starea
- [x] „Toți nemarcații → prezenți” nu atinge copiii deja marcați absent sau motivat
- [x] Weekend-urile și sărbătorile nu intră în „zile lucrătoare”
- [x] Nicio legătură cu taxa sau cu Situația plăților
