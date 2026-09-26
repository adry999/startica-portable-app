# Feedback după sync — 27.09.2026

Verificat pe `master-v2` față de design. Punctele sunt mici, de făcut înainte de a continua coada.

## Situația plăților (punctul 7) — ok
- Pastilele Grupa filtrează doar tabelul. Corect.
- Eticheta grupului de pastile: „Grupa” (ca în 7a și în Achitări), nu „Grupă”.
- Paragraful lung de sub antet („Taxă integrală pentru luna începută…”) se mută în subsolul tabelului, 12px `--muted`, ca în 16c. Antetul rămâne compact.
- „Se încarcă datele…” se înlocuiește cu scheletul din `screens/21-incarcare.md` (când se face punctul 12).

## Cheltuieli (6b) — ok
- Câmpul `method` și pastilele Metodă sunt făcute. Nimic de corectat.

## Curs valutar (12a) — ok, trei corecturi
- Cursul se afișează cu **4 zecimale** (1 € = 19,7400 lei), nu cu `formatMoney` (2 zecimale). La fel în „Ultimele 5 zile”. Funcție nouă `formatRate(n)` în `#shared/format/`.
- Câmpul „Corectează cursul de azi”: `step="0.0001"`, placeholder „ex. 19,7400”.
- „Se încarcă cursul valutar…” → schelet (punctul 12).

## Achitare, copil cu taxă în EUR (12b) — ok, o problemă de date
- **Lipsește sursa cursului pe achitare.** Când operatorul scrie un curs manual, se salvează doar `fxRate`. Adaugă `fxRateSource: 'bnm' | 'manual'` pe `Payment` (schemă + validare). Raportul contabil (`screens/20`) și confirmarea de plată marchează cursul manual cu portocaliu.
- Sub câmpul Curs: „BNM 24.09.2026 · 19,7400” sau „Curs manual pentru această plată”, cu 4 zecimale.
- Titlul panoului: „Achitare nouă” / „Editează achitarea” (ca 15b), nu „Adaugă: achitare”.

## De făcut în continuare
Coada din `RASPUNSURI.md`, în ordine: 8 (restul EUR), 9b (SMS P1, plan gata), 10 (Situația completă, plan gata), 11, apoi 12–15 și Bazin (`screens/23-bazin.md`, după aprobare).

**Golul de arhitectură găsit la punctul 10** (`status/` nu poate importa `@features/sms`): `SmsConfirmDialog` se mută în `shared/ui/sms/` ca o componentă fără stare, care primește destinatarii și un `onSend`. Logica de trimitere rămâne în `features/sms` și e injectată din `App.tsx`/rută. Așa `status/` și `notify/` o pot folosi fără import între feature-uri.
