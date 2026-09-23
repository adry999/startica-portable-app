# Taxă lunară și achitări în EUR sau MDL — 23 septembrie 2026

## Context

Azi taxa lunară (`Child.fee` / `Child.feeHistory`) și achitările (`Payment.amount`) sunt numere simple, fără monedă — totul e implicit MDL. Unele familii au taxa fixată într-o sumă în EUR (ex. 500 €), iar cursul EUR→MDL variază zilnic. Achitările pentru aceste familii pot veni tot în EUR sau, alteori, în MDL (echivalentul zilei). Aplicația trebuie să știe în ce monedă e fiecare sumă și să le compare corect.

## Scop

- Monedă (EUR sau MDL) pe fiecare intrare din `feeHistory` a unui copil.
- Monedă (EUR sau MDL) pe fiecare achitare.
- Curs de schimb EUR↔MDL, o valoare pe zi calendaristică, alimentat automat de la BNM + editabil manual.
- `obligation()` (taxă așteptată, achitat, rest, credit) convertește corect când taxa și achitarea sunt în monede diferite.
- Fișa fiecărui copil arată suma în moneda lui; agregatele (Dashboard) convertesc totul în MDL înainte de adunare.

## În afara scopului

- Alte valute în afară de EUR/MDL (USD, RON etc.) — nu acum.
- Cheltuielile (`expenses`) — rămân doar MDL, neatinse.
- Conversie automată retroactivă a datelor existente — tot ce există azi rămâne MDL, fără nicio schimbare vizibilă pentru fișele actuale.

## Model de date

### `feeHistory`

Fiecare intrare capătă `currency`:

```
{ from: '2026-09', amount: 500, currency: 'EUR' }
```

Migrare: orice intrare fără `currency` (tot ce există azi) se citește implicit ca `'MDL'`. Nu e nevoie de o migrație activă care rescrie fișele — `currency: row.currency ?? 'MDL'` la citire e suficient, în același stil cu alte câmpuri opționale din schemă (ex. `groupId`).

Câmpul simplu `Child.fee` (folosit doar ca valoare implicită la completarea din Taxe și grupe, per `defaultSetupMonth`/`hasMissingFee`) rămâne fără monedă proprie — el nu e niciodată sursa de adevăr pentru un calcul, doar o comoditate de completare; moneda lui e cea aleasă în formularul de completare, la fel ca azi suma.

### `Payment`

Capătă `currency` (`'EUR' | 'MDL'`), implicit `'MDL'` — ales explicit la înregistrarea/editarea unei achitări, exact ca `method` (Cash/Card/Transfer) azi. Achitările existente, fără câmp, se citesc implicit `'MDL'`.

### Curs de schimb

O intrare nouă, per zi calendaristică (`YYYY-MM-DD`), cu o singură valoare: câte MDL fac 1 EUR. Nu trece prin mecanismul de revizie/audit folosit pentru fișele de business (copii, achitări, grupe) — nu are sens un istoric „cine a schimbat cursul și de ce", e date de referință, nu o fișă a cuiva. Se citește/scrie similar cu `notificationPreferences` (store simplu, fără revizie), dar ca listă cheiată pe dată, nu un singur obiect.

Sursă:
- **Automat**: la pornirea serverului, dacă nu există deja un curs salvat pentru ziua curentă, se cere de la BNM: `GET https://www.bnm.md/ro/official_exchange_rates?get_xml=1&date=DD.MM.YYYY` (atenție: format dată `DD.MM.YYYY`, diferit de convenția internă `YYYY-MM-DD`). Răspunsul e XML; valoarea EUR e în `<Valute><CharCode>EUR</CharCode><Value>20.1352</Value></Valute>` (verificat live pe 23.09.2026). Eșec (fără internet, BNM indisponibil) → nu blochează pornirea serverului, doar nu se salvează un curs nou pentru azi.
- **Manual**: ecran nou (sub Backup și setări) cu un tabel simplu „dată → curs" și un formular de adăugare/corecție, plus un buton „Reîmprospătează cursul" care repetă fetch-ul automat la cerere.

Lipsă curs pentru o zi (nici automat, nici manual) → se folosește cel mai recent curs anterior cunoscut; ecranele care afișează o sumă convertită cu un curs vechi arată o mențiune vizibilă (ex. „curs din 20.09, nu de azi").

## Calculul obligației

`obligation()` (`shared/domain/tuition-obligation.mjs`) capătă acces la cursul de schimb (parametru nou, similar cu `asOf`/`index` — citit o dată per randare, nu per apel). Pentru fiecare achitare alocată unei luni:

- Dacă `payment.currency === feeHistory-ul aplicabil lunii .currency` → scade direct, ca azi (fără nicio conversie, fără zgomot de rotunjire).
- Dacă diferă → suma achitării se convertește în moneda taxei, cu cursul zilei **achitării** (`payment.date`), nu cursul de azi. E „fixat istoric" în sensul că folosește cursul de atunci, dar rămâne derivat, nu stocat: dacă tu corectezi mai târziu cursul acelei zile din ecranul manual, obligația recalculată (la următoarea randare) reflectă corecția — consecvent cu restul lui `obligation()`, care nu memorează nimic, recalculează mereu din sursă.

`expected`, `paid`, `rest`, `credit` rămân în moneda taxei copilului (nu MDL universal) — un copil cu taxa în EUR are „Rest: 50,00 €", nu un echivalent MDL.

## Afișare

- `formatMoney` (`shared/format/money-format.mjs`), azi cu sufixul „ lei" fix, capătă un al doilea parametru opțional pentru monedă (`'MDL' | 'EUR'`), implicit `'MDL'` — apelurile existente (fără al doilea argument) nu se schimbă.
- Fișa unui copil (Taxe și grupe, Situația plăților, De notificat, rezumatul din profil) arată suma cu moneda taxei lui.
- La completarea taxei (Taxe și grupe) și la editarea unui copil (Copii → Editează), câmpul de taxă capătă un selector de monedă lângă el (EUR/MDL), implicit MDL.
- La înregistrarea/editarea unei achitări, un selector similar de monedă (EUR/MDL), implicit MDL, lângă câmpul de sumă.
- Dashboard (Încasări, Cheltuieli, Diferență, graficul „Evoluția încasărilor") — toate sumele agregate se convertesc în MDL, cu cursul zilei fiecărei achitări, înainte de adunare. Cheltuielile rămân MDL pur (fără conversie, sunt deja MDL).

## Testare

- Domeniu: `obligation()` cu taxă EUR + achitare EUR (fără conversie), taxă EUR + achitare MDL (cu conversie, curs cunoscut), curs lipsă (cade pe ultimul cunoscut), taxă/achitare aceeași monedă indiferent care.
- `formatMoney` cu al doilea parametru EUR vs omis (MDL implicit).
- Repository-ul cursului: citire cu fallback pe ultima dată cunoscută, scriere/suprascriere pentru o dată.
- Fetch BNM: parsare XML cu un răspuns real salvat ca fixture; eșec de rețea nu blochează pornirea.
- Migrare: o intrare `feeHistory`/`Payment` fără `currency` se citește `'MDL'`.

## Decizii deschise (de confirmat în timpul implementării, nu blochează planul)

Niciuna — toate deciziile de design au fost confirmate în sesiunea de brainstorming din 23.09.2026.
