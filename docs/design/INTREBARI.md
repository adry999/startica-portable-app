# Întrebări / decizii blocate

Punctele din `docs/design/COADA-DE-LUCRU.md` care au nevoie de o decizie a utilizatorului înainte de a fi terminate integral. Fiecare e scoping-ul minim ales pentru a nu bloca restul cozii — rezolvarea completă rămâne aici pentru o sesiune viitoare.

## Achitări — „Tipărește chitanța” (punctul 5)
Spec `docs/design/screens/05-achitari.md` cere un buton „Tipărește chitanța” în `RowMenu`, cu rută `/achitari/:id/confirmare`. Ecranul de tipărire (`docs/design/screens/15-tiparire.md`) nu e construit încă în `webapp/`. **Decis 2026-09-26: se sare peste acum**, restul punctului 5 se face fără el. De reluat când se face ecranul 15.

## Cheltuieli — filtrul Metodă (punctul 6)
`Expense` (`src/shared/contracts/record-types.d.mts`) nu are câmp `method` — spec-ul 06 cere `FilterPills` Metodă (Cash/Card/Transfer), dar nu există pe ce să filtreze. **Decis 2026-09-26: se sare peste acum**, doar Categorie. Adăugarea câmpului `method` la `Expense` (schemă + formular + normalizare) e un pas separat, cu cheltuielile vechi rămânând fără metodă (implicit „Toate”/necunoscut).

## Situația plăților — filtrul de grupă contrazice un comentariu de design existent (punctul 7)
`useStatus.ts:29-33` are exact comentariul: „aici nu există filtru — situația unei luni trebuie să rămână completă” (spre deosebire de Achitări/Cheltuieli). Adăugarea `FilterPills` Grupa ar contrazice o decizie de design deja documentată în cod, nu doar un gol de UI. **Sar peste punctul 7 complet pentru sesiunea asta** — nu pornesc niciun agent pe el — până se clarifică cu utilizatorul dacă acel comentariu mai e valabil sau se schimbă intenționat.

## Situația plăților — ecran nou aproape integral (punctul 7)
`StatusPage.tsx` de azi e un stub doar-citire, fără moduri Lună/An școlar, fără cele 4 carduri, fără filtru grupă, fără harta pe luni, fără SMS. Spec `07-situatia.md` descrie un ecran nou, comparabil ca mărime cu Vizite sau Achitări. **Decis 2026-09-26: se face doar `FilterPills` Grupa peste tabelul existent** (punctul 7 din coadă) — restul spec-ului (4 carduri, mod An școlar, hartă, SMS, CTA Notifică) rămâne un ecran separat, de planificat ca task propriu (posibil cu `superpowers:brainstorming`/`writing-plans` înainte de cod, la fel ca restul ecranelor mari din acest proiect).
