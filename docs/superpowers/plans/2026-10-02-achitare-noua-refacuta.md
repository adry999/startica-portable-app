# §5 (F18) — Achitare nouă refăcută după 15b — Plan scurt

**Sursă:** `docs/design/PROMPT-CLAUDE-CODE-11.md` §5, design `Formulare.dc.html#15b` (+`#38c`,`#41f`,`#15j`).

**Scop:** aceeași logică (alocare, frați, SMS, editare, gardă nesalvate), altă ordine/elemente în `PaymentFormDrawer.tsx`.

## Ordinea nouă (de sus în jos)
1. Cardul copilului (cremă, avatar pe tonul grupei, „Grupă · contract N · scadență Z”, „Schimbă”) — există (`PersonCell`), păstrează.
2. **Nou:** două carduri alăturate — Plan (`--orange-soft`) + Curs BNM (`--mint-soft`, link „Curs manual”). Copil MDL: doar cardul Plan cu taxa în lei. Fără plan/taxă: card galben „Copilul nu are plan sau taxă · Completează” → link spre fișă, secțiunea 3.
3. Serviciu (Grădiniță/Bazin) — neschimbat.
4. **Nou ca pastile** (`ChipSelect` multi): luni acoperite (curentă + următoarele 2) + bandă restanță roz + link „Repartizează manual” (→ MonthInput din §3, dependență ulterioară — rămâne pe UI-ul curent de alocare manuală până §3 e gata).
5. Suma: rândul „500 € × 19,6873 = 9.843,65 lei” deasupra câmpului; câmpul cu suma exactă (depinde de §2, implementat înaintea lui §5 în ordinea de lucru); pastilele de rotunjire (§2); bandă de stare (mint/galben) în loc de „= X €”.
6. Data + Metodă pe un rând; „Împarte pe metode” ca link sub Metodă.
7. „+ Adaugă fratele” + rândurile de frați — neschimbat.
8. Plătitor + „+ Adaugă observație” — neschimbat.
9. Subsol (după §6 — rămâne cu `footer=` curent până §6 unifică API-ul).

## Prefill
Rulează la prima alegere a copilului într-o plată nouă (nu doar din fișă/`defaultChildId`) — scoate condiția `!defaultChildId` din efectul existent (~liniile 205–219), cât timp suma n-a fost atinsă manual.

## Pași
1. Implementează §2 (rotunjire la alegere) întâi — acest plan presupune suma exactă deja disponibilă.
2. Reordonează JSX-ul formularului ca mai sus, păstrând toată logica existentă (allocationMode, SMS, frați, gardă nesalvate) — fără rescriere de hooks, doar randare.
3. Cardurile Plan/Curs BNM — componente noi mici în `features/payments/` (sau extrase în `@shared/ui` dacă se repetă); fără hex nou, tokens existente.
4. Card galben „fără plan/taxă” — link spre fișa copilului, secțiunea 3 (deschide `ChildFormDrawer` pe copilul curent, sau navighează la `/copii/:id`, de verificat ruta reală).
5. Teste: captură lângă 15b pentru EUR/MDL/fără taxă/fără curs BNM; `PaymentFormDrawer.test.tsx` pentru ordinea secțiunilor (roluri/etichete) și prefill din Achitări (fără `defaultChildId`).

## Verificare
`cd webapp && npx tsc --noEmit -p . && npx vitest run src/features/payments`.

## Constrângeri
Un commit pe pas; fără atribuire AI; ce nu se închide → `INTREBARI.md`.
