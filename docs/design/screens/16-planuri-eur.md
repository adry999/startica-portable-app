# 16 — Planuri în EUR, plată în lei

**Referință:** `Planuri si curs.dc.html#7a`–`#7g`. Afectează: Backup și setări, Taxe și grupe, Achitare nouă, Situația plăților, fișa copilului, confirmarea de plată, Dashboard, SMS.

## Reguli de calcul (sursa de adevăr)
1. Există 3 planuri: **Program scurt**, **Program mediu**, **Program lung**. Prețul lunar e în **EUR** și se editează din Setări (7a). Nu scrie prețuri fixe în cod.
2. **Taxa lunară** a copilului e în EUR: implicit prețul planului, cu posibilitate de modificare manuală pentru reducere (7g). Se salvează pe copil (`planId`, `monthlyFeeEur`).
3. Schimbarea prețului unui plan se aplică **de la luna următoare**. Lunile deja facturate păstrează taxa din momentul facturării.
4. **Datoria și restul** se țin în EUR.
5. **Achitarea** se introduce în **lei** (suma exactă primită). La salvare:
   `rate = cursul EUR pentru data plății` → `eur = round2(lei / rate)`. Se salvează `amountMdl`, `rate`, `rateSource ('bnm'|'manual')`, `amountEur`.
6. Repartizarea pe luni se face în **EUR** (din `amountEur`).
7. **Avansul** (surplusul peste datorie) rămâne în **lei**. Când se repartizează pe o lună, se transformă la cursul din **ziua repartizării**.
8. **Rotunjire:** la ban (2 zecimale), `Math.round(x * 100) / 100`, doar la final.
9. Afișarea „≈ lei azi” = `rest € × cursul de azi`. E doar informativă și nu se salvează.
10. **Dashboard:** totalurile sunt lei primiți efectiv (suma `amountMdl`).

## Cursul
- **Sursa:** BNM, automat, o dată pe zi lucrătoare, după ora 13:00 (publicare). Endpoint backend nou `GET /api/rates/eur?date=YYYY-MM-DD`, cu cache în tabelul `fx_rates (date, rate, source, note, updated_at)`.
- **Weekend și sărbători:** se folosește ultimul curs publicat înaintea datei.
- **Fără internet sau BNM indisponibil:** se folosește ultimul curs salvat, iar pastila din Dashboard e galbenă („Curs din 25.09”).
- **Corectare manuală (7a):** curs + motiv, doar pentru o zi; se scrie `source='manual'` și intră în Istoric. „Revino la cursul BNM” șterge corectarea.

## Ecrane
| Id | Ecran | Ce se schimbă |
|---|---|---|
| 7a | Backup și setări → filă nouă **Planuri și curs** | 3 carduri de plan (nume, orar, descriere, preț €, „≈ lei azi”, nr. copii); cardul cursului de azi (mint = BNM, yellow = corectat) + „Corectează cursul de azi”; ultimele 5 zile |
| 7g | Taxe și grupe (`fee-setup`) | coloanele **Plan ▾** + **Taxă lunară €** (+ eticheta „reducere” și prețul planului tăiat) + **≈ lei azi**; bara de selecție: „Plan ▾” |
| 7b | Achitare nouă (`PaymentFormDrawer`) | cardul copilului arată planul și datoria în €; **Suma primită în lei** + „= X €” live; scurtăturile în lei la cursul de azi; câmpul **Curs EUR** cu badge „BNM dd.mm” (editabil, și atunci devine „manual”); repartizarea în €; restul în € + ≈ lei |
| 7c | Situația plăților | cardurile: De încasat € (≈ lei), Încasat € (lei primiți), Rest € (≈ lei), Curs azi; coloanele Plan · Taxă € · Achitat € (lei primiți dedesubt) · Rest € (≈ lei azi dedesubt) |
| 7d | Fișa copilului | mini-cardurile: Rest de plată € (≈ lei) · Plan · Avans în lei; istoricul plăților: Plătit lei · Curs · Echivalent € |
| 7e | Confirmarea de plată | blocul: Suma achitată lei · Curs EUR (BNM, data) · Echivalent €; repartizarea în €; restul în €; mențiunea „Restul se achită în lei la cursul BNM din ziua plății.” |
| 7f | Dashboard | KPI-urile în lei (neschimbat); pastilă nouă în antet „● 1 € = 19,62 lei” lângă selectorul de lună, cu link spre 7a |
| — | SMS (variabila `rest`) | `rest` = restul în lei la cursul zilei trimiterii + „ (la cursul BNM de azi)”; variabilă nouă `rest_eur` |
| — | Copil nou (3a) | cele 3 carduri de program din secțiunea „Contract și taxă” = cele 3 planuri, cu prețul în € din setări |

## Date (backend)
- `plans (id, name, hours, description, price_eur, sort)`: 3 rânduri, editabile.
- `plan_price_history (plan_id, price_eur, valid_from)`: pentru regula 3.
- `children`: câmpuri noi `plan_id`, `monthly_fee_eur` (înlocuiește taxa în lei).
- `payments`: câmpuri noi `amount_mdl`, `fx_rate`, `fx_source`, `amount_eur`.
- `fx_rates`: vezi „Cursul”.
- **Migrare:** taxele existente în lei → EUR la cursul din ziua migrării, rotunjit la ban, apoi verificate manual în Taxe și grupe. Plățile vechi primesc `fx_rate` după data plății (se cere istoricul BNM).

## Teste
- `lei → eur` cu rotunjire la ban (3.000 / 19,62 = 152,91);
- plata parțială scade corect din datoria în €;
- surplusul devine avans în lei;
- cursul de weekend = cel de vineri;
- corectarea manuală se aplică doar zilei ei;
- schimbarea prețului planului nu modifică luna curentă.

## Criterii de acceptare
- [ ] Nicio sumă de taxă nu e salvată în lei; nicio achitare nu e salvată fără `fx_rate`
- [ ] Prețurile planurilor se schimbă doar din Setări
- [ ] Peste tot unde apare o sumă în €, sub ea apare echivalentul în lei (primit sau ≈ azi), cu eticheta corectă
- [ ] Dashboard-ul rămâne în lei
