# 18 — Sincronizare între calculatoare

**Referință:** `Sincronizare.dc.html#14a`, `#14b`, `#14c`. **Depinde de:** `17-filiale.md` (date separate pe filială).

## Regula
- Datele ambelor filiale stau pe un **server comun**. Orice calculator conectat poate deschide **oricare** filială din selector.
- Fiecare calculator păstrează o **copie locală** (local-first). Se poate lucra fără internet; modificările se trimit automat când revine conexiunea.
- Fiecare modificare ajunge pe server în câteva secunde și de acolo pe celelalte calculatoare.
- Dacă aceeași înregistrare e modificată pe două calculatoare înainte de sincronizare, apare un **conflict**, pe care îl rezolvă utilizatorul (14c). Nu se alege automat „ultimul câștigă” pentru fișe și grupe.
- **Achitările și cheltuielile nu intră niciodată în conflict:** sunt înregistrări noi, se păstrează toate. Posibilele dubluri (același copil, sumă, zi) intră în De verificat.
- Serverul face zilnic o copie de siguranță. Backup-ul local rămâne în continuare.

## 14a — Cardul din josul meniului (înlocuiește „Salvat · ora”)
| Stare | Aspect | Text |
|---|---|---|
| Sincronizat | cream, punct `--success-dot` | „Sincronizat · 12:06” / „Toate calculatoarele au aceleași date” |
| Se sincronizează | cream, punct `--yellow` | „Se trimit N modificări…” / „Poți lucra în continuare” |
| Fără internet | `--yellow-soft`, border `--yellow` | „Fără internet” / „N modificări salvate local. Se trimit automat când revine conexiunea.” |
| Conflict | `--pink-soft`, border `--pink` | „N conflicte” / „Aceleași date modificate pe alt calculator.” + link „Rezolvă” |

Click pe card deschide 14b. La conflict apare în meniu, sub De rezolvat, rândul **„Conflicte”** cu contor.

## 14b — Backup și setări → fila Sincronizare
- **Filele:** Backup · Import și export · Grădinița · Planuri și curs · Filiale · **Sincronizare**.
- **Cardul serverului** (mint; yellow dacă e offline): starea + ora; „Ambele filiale · N calculatoare · ultima copie de siguranță pe server: …”; buton „Sincronizează acum”.
- **Calculatoare conectate:** nume, sistem, filiala deschisă de obicei, stare cu punct (Sincronizat / Offline de N zile), „Deconectează” (roșu; nu apare pe rândul „Acest calculator”).
- **„+ Conectează un calculator”** generează un cod de 6 cifre, valabil 10 minute și folosibil o singură dată. Pe calculatorul nou: la prima pornire, „Am deja o grădiniță” → introdu codul → descarcă datele.
- **Deconectare:** revocă imediat accesul calculatorului (nu mai primește și nu mai trimite date).

## 14c — De rezolvat → Conflicte
- Grid `320px 1fr`: lista conflictelor (rândul activ cu bară orange de 4px) | detaliu.
- **Detaliu:** tipul + filiala, titlul (Baloo 24); tabel pe 3 coloane (Câmp · Pe acest calculator · Pe <calculator>, cu ora fiecărei modificări); rândurile diferite pe `--yellow-soft`, cu text 800.
- **Acțiuni:** „Păstrează varianta de pe acest calculator” (secundar) · „Păstrează varianta de pe <calculator>” (primar). Alegerea intră în Istoric.

## Tehnic (de decis în planul Fazei 6)
- Server mic de reconciliere (nu SaaS multi-tenant), cu autentificare pe calculator (token emis la conectarea prin cod).
- Fiecare înregistrare are `id` global (UUID), `branchId`, `revision`, `updatedAt`, `updatedByDevice`.
- Coada locală de modificări (outbox) se trimite în ordine; serverul respinge o modificare cu `revision` depășit → conflict.
- Transport: HTTPS; opțional push (SSE/WebSocket), cu polling ca rezervă.
- Migrare: datele existente ale fiecărei filiale se urcă o singură dată pe server, de pe calculatorul filialei.

## Criterii de acceptare
- [ ] De pe orice calculator conectat se deschide oricare filială
- [ ] Lucrul offline funcționează; la reconectare modificările ajung pe celelalte calculatoare
- [ ] Modificarea aceleiași fișe pe 2 calculatoare produce un conflict vizibil, fără pierdere de date
- [ ] Două achitări simultane se păstrează amândouă
- [ ] Un calculator deconectat nu mai primește date
- [ ] Cardul din meniu arată corect cele 4 stări
