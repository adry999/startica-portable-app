# 23 — Bazin (programări, prezență, încasări, salariu antrenor)

> **Actualizat 29.09.2026:** Încasările de bazin sunt achitări cu serviciul „Bazin” (B3). Prezentarea se reface după A4. Unde textul de mai jos contrazice `DECIZII.md` sau `ALINIERE-DESIGN.md`, acelea au prioritate.

**Referință:** `Bazin.dc.html#22a`–`#22d`. **Nou.** Per filială.

## Date
- `pool_settings` (per filială): `pricePerSession` (implicit 150 lei), `durationMin`, `hours` (interval), `seatsPerSlot`, `chargeUnexcusedAbsence` (bool, implicit true), `coachPayMode` 'per_child'|'per_session', `coachRate` (implicit 60 lei).
- `pool_bookings` (`childId`, `coachId` → staff, `weekday`, `time`, `startDate`, `endDate?`) = programarea recurentă.
- `pool_sessions` (`bookingId`, `date`, `status` 'present'|'absent'|'excused').
- **Valorile implicite sunt de confirmat cu administratorul; se țin în setări, nu în cod.**

## 22a — Săptămâna
- Grilă ore × zile, plăci copil în `groupTone`. Clic pe placă: Prezent → Lipsă → Motivat.
- 4 carduri: ședințe, prezenți, locuri libere, lipsă.

## 22b — Programare nouă
- Copil, antrenor, zi, oră (sloturi cu locuri rămase), se repetă săptămânal. Previzualizare preț/lună.

## 22c — Luna
- Tabel pe copii: programate, venit, lipsă, motivat, sumă, stare plată.
- Card antrenor: ședințe, copii veniți, tarif, salariu lună.
- **Închide luna:** (1) sumele de bazin se adaugă la obligația lunii copilului, ca rând separat „Bazin” în Situația plăților; (2) salariul antrenorului intră în Cheltuieli, categoria Salarii, și în Salarii (Personal 23d).
- Sumă copil = prezențe × preț (+ lipsă nemotivată dacă `chargeUnexcusedAbsence`). Motivat = 0.

## 22d — Setări bazin
- Formular pe `pool_settings`; antrenorii se aleg din Personal (funcția „Antrenor bazin”).

## Criterii de acceptare
- [ ] Nu se poate programa peste `seatsPerSlot`
- [ ] Închide luna e idempotent (a doua oară nu dublează)
- [ ] Salariul antrenorului = aceeași formulă ca pe card
- [ ] Botanica are setări proprii
