# 16 — Planuri în EUR, plată în lei

**Referință:** `Planuri si curs.dc.html#7a`–`#7g`. Afectează: Backup și setări, Taxe și grupe, Achitare nouă, Situația plăților, fișa copilului, confirmarea de plată, Dashboard, SMS.

**Actualizat 2026-09-26** (`docs/design/RASPUNSURI.md`): modelul de date de mai jos înlocuiește versiunea inițială a acestui document (planuri fixe cu `plan_id`/`monthly_fee_eur`/tabelul `plans`). Ecranele 7a–7g rămân valabile ca aspect vizual — doar câmpurile din spate s-au schimbat. Motivul: backend-ul de monedă (`currency: 'MDL'|'EUR'` pe `feeHistory`/`Payment`, curs BNM) era deja construit pe `master-v2` când s-a scris varianta inițială a acestui spec, cu un model diferit; varianta de mai jos se construiește **peste** codul existent, nu îl înlocuiește.

## Reguli de calcul (sursa de adevăr)
1. **Nu există planuri fixe cu preț unic obligatoriu.** În Setări există o listă de **presetări de plan** (nume + preț EUR, per filială) — doar comoditate la completarea formularului copilului; taxa rămâne un câmp liber, editabil. Nu există `plan_id` pe copil și nu există `plan_price_history` în v1.
2. **Taxa lunară** a copilului e `feeHistory[].amount` + `feeHistory[].currency` (câmpurile existente deja pe `Child`, `src/shared/contracts/record-types.d.mts`). Un copil cu taxa în EUR are `currency: 'EUR'` pe intrarea curentă din `feeHistory`; copiii vechi rămân `'MDL'` până îi mută operatorul manual din Taxe și grupe — **fără migrare automată**.
3. Schimbarea taxei unui copil (sumă sau monedă) creează o nouă intrare `feeHistory`, valabilă de la luna aleasă — comportament deja existent, neschimbat.
4. **Datoria și restul** unui copil cu taxa în EUR se calculează în EUR (`obligation()`, deja face asta pentru `feeHistory.currency === 'EUR'`).
5. **Achitarea** se introduce în **lei** (suma exactă primită) — câmpul `Payment.amount` rămâne lei, neschimbat. La salvare, dacă taxa copilului (la data plății) e în EUR:
   `fxRate = cursul BNM pentru data plății` (din `exchange-rates`, deja în cod) → `amountEur = round2(amount / fxRate)`. Se salvează `Payment.fxRate` și `Payment.amountEur` (câmpuri noi), **îngheațate** — o schimbare ulterioară a cursului nu le modifică.
   Dacă taxa copilului e MDL, `fxRate`/`amountEur` rămân nesetate (`undefined`) — plata e pur MDL, ca azi.
6. Repartizarea pe luni a unei plăți cu taxă EUR se face în **EUR** (din `amountEur`), la fel cum `paymentIndex`/`obligation()` deja grupează pe monedă.
7. **Avansul** (surplusul peste datorie) rămâne în **lei**, neschimbat față de comportamentul actual.
8. **Rotunjire:** la ban (2 zecimale), `Math.round(x * 100) / 100`, doar la final — regulă deja aplicată de `exchange-rates.mjs`.
9. Afișarea „≈ lei azi” pentru un rest în € = `rest € × cursul de azi`. Doar informativă, nu se salvează.
10. **Dashboard:** totalurile rămân lei primiți efectiv (suma `Payment.amount`), neschimbat.

## Cursul
- **Sursa:** BNM, deja implementată (`src/app/server/bnm-exchange-rate.mjs`, `exchange-rates.routes.mjs`, `#shared/domain/exchange-rates.mjs`) — fetch automat la pornirea serverului dacă lipsește cursul de azi.
- **Weekend și sărbători:** ultimul curs publicat înaintea datei — deja gestionat de `exchange-rates.mjs`.
- **Fără internet sau BNM indisponibil:** ultimul curs salvat; pastila din Dashboard devine galbenă („Curs din 25.09”) — **de construit** (ecran nou, punctul 8 din coadă).
- **Corectare manuală (7a):** curs + motiv, doar pentru o zi — rutele server pentru citire/corectare manuală/refresh BNM există deja (`GET/POST /api/exchange-rates`); UI-ul de corectare (7a) e **de construit**.

## Ecrane
| Id | Ecran | Ce se schimbă |
|---|---|---|
| 7a | Backup și setări → filă nouă **Curs valutar** | cardul cursului de azi (mint = BNM, yellow = corectat) + „Corectează cursul de azi” + ultimele 5 zile. **Presetările de plan** (nume + preț €, per filială) — o listă simplă, nu un tabel `plans` cu `plan_price_history`. |
| 7g | Taxe și grupe (`fee-setup`) | coloanele **Monedă ▾** (MDL/EUR, nu „Plan ▾”) + **Taxă lunară** (în moneda aleasă) + **≈ lei azi** dacă e EUR. |
| 7b | Achitare nouă (`PaymentFormDrawer`) | cardul copilului arată taxa/datoria în moneda ei; dacă taxa e EUR: **Suma primită în lei** + „= X €” live (folosind cursul zilei), câmpul **Curs EUR** cu badge „BNM dd.mm” (editabil, atunci devine „manual” pentru acea plată — `fxRate` explicit), repartizarea în €, restul în € + ≈ lei. Dacă taxa e MDL: formularul rămâne exact cum e azi, fără niciun câmp de curs. |
| 7c | Situația plăților | pentru copiii cu taxă EUR: coloanele Taxă/Achitat/Rest arată € cu echivalentul lei dedesubt (Achitat = `amount` lei primit, Rest = ≈ lei azi). Pentru copiii MDL: neschimbat. |
| 7d | Fișa copilului | pentru taxă EUR: mini-card Rest de plată € (≈ lei) · istoricul plăților cu Plătit lei · Curs · Echivalent €. Pentru MDL: neschimbat. |
| 7e | Confirmarea de plată | doar pentru plăți cu taxă EUR: blocul Suma achitată lei · Curs EUR (BNM, data) · Echivalent €; restul în €; „Restul se achită în lei la cursul BNM din ziua plății.” |
| 7f | Dashboard | KPI-urile în lei (neschimbat); pastilă nouă în antet „● 1 € = 19,62 lei” lângă selectorul de lună, cu link spre 7a. |
| — | SMS (variabila `rest`) | `rest` = restul în lei la cursul zilei trimiterii (pentru copil EUR) + „ (la cursul BNM de azi)”; variabilă nouă `rest_eur`. |
| — | Copil nou (3a) | secțiunea „Contract și taxă”: selector Monedă (MDL/EUR) +, dacă EUR, listă de presetări de plan (din 7a) ca scurtătură pentru sumă — tot editabil manual. |

## Date (backend)
- **Nimic nou pe `Child`** — `feeHistory[].currency` există deja (`src/shared/contracts/record-types.d.mts`, tip `Currency = 'MDL'|'EUR'`).
- **`Payment`**: două câmpuri noi, opționale — `fxRate?: number`, `amountEur?: number`. Setate doar când taxa copilului la data plății e EUR; rămân `undefined` pentru plăți MDL. Validare în `record-schema.mjs` (rotunjire la ban, `fxRate > 0`).
- **Presetări de plan**: o listă simplă în `settings` (cheie nouă, format `{ id, name, priceEur }[]`), **nu** un tabel SQL nou — comoditate de completare, nu sursă de adevăr pentru taxa copilului.
- **`fx_rates`**: deja există (`exchange-rates.mjs` + tabelul din backend cherry-pick-uit) — nicio schimbare de formă.
- **Fără migrare** a taxelor/plăților existente. Copiii/plățile vechi rămân exact cum sunt (MDL, fără `fxRate`/`amountEur`).

## Teste
- `amount lei → amountEur` cu rotunjire la ban (3.000 / 19,62 = 152,91) — logică deja acoperită parțial de `exchange-rates.test.mjs`, de extins pentru `Payment`.
- o plată pe un copil cu taxă EUR scade corect din datoria în €;
- o plată pe un copil cu taxă MDL nu capătă `fxRate`/`amountEur`;
- surplusul devine avans în lei, indiferent de moneda taxei;
- cursul de weekend = cel de vineri (deja testat în `exchange-rates.test.mjs`);
- corectarea manuală a cursului se aplică doar zilei ei (deja testat);
- schimbarea unei presetări de plan (Setări) nu modifică retroactiv taxa copiilor care au ales-o anterior (taxa e copiată în `feeHistory`, nu ține o referință vie la presetare).

## Criterii de acceptare
- [ ] Niciun copil MDL nu capătă `fxRate`/`amountEur` pe plățile lui
- [ ] Presetările de plan sunt doar o comoditate de completare — nu există `plan_id` pe copil, nu blochează taxa liberă
- [ ] Peste tot unde apare o sumă în € pentru un copil, sub ea apare echivalentul în lei (primit sau ≈ azi), cu eticheta corectă
- [ ] Dashboard-ul rămâne în lei
- [ ] Un copil existent (MDL, fără nicio schimbare) arată identic cu azi, peste tot
