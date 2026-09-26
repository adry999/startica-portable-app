# 14 — SMS (mesaje trimise · șabloane și furnizor)

**Referință:** `Sms.dc.html#4a`, `#4b`; confirmarea mesajului: `Situatia.dc.html#2a`–`#2c` (spec 07). Backendul e descris în README, la „Notificare SMS”.

## 4a — Mesaje SMS (filă în Notificări)
- **Antet:** comutatorul `Canale · Mesaje SMS · Șabloane` pe „Mesaje SMS”; fără selector de lună.
- **Statistici inline:** trimise · eșuate (`--pink-ink`) · SMS consumate; în dreapta, bara limitei lunare (8px, `--orange` pe `#f1ece2`) + „61 / 500”.
- Grid `1fr 380px`.
  - **Tabel:** SegmentedControl `Toate · Livrate · În curs · Eșuate` + căutare + „Șablon ▾” + „Perioadă ▾” (implicit 30 de zile). Coloane: Trimis (zi + oră) · Destinatar (părinte + copil) · Mesaj (o linie) · Șablon (Badge neutral) · Stare (Badge cu punct: Livrat mint / În curs yellow / Eșuat pink).
  - **Panou detaliu:** header în culoarea stării, bula mesajului, datele (trimis, șablon, lungime, sursă), răspunsul furnizorului la eșec, „Retrimite” + „Corectează telefonul” (→ `/copii/:id`, secțiunea Părinți).
- **Date:** `sms_log`.

## 4b — Șabloane și furnizor
- Grid `320px 1fr`.
  - **Stânga:** lista șabloanelor (etichetă „Implicit” mint, „Nou” orange; rândul activ cu bară de 4px) + card „Furnizor SMS” (Serviciu ▾, Expeditor, Cheie API mascată + Schimbă, Limită lunară, „Trimite SMS de test”, badge Conectat / Neconectat).
  - **Dreapta, editor:** Nume, Text cu variabile ca pastile (`părinte`, `copil`, `luna`, `rest`, `achitat`, `zi`); comutatoarele „Fără diacritice la trimitere” și „Implicit pentru Notifică”; previzualizare cu datele primului restanțier + contor „N caractere · N SMS” (GSM-7 160/153, UCS-2 70/67).
  - **Footer:** „Folosit de N ori” · Renunță · Salvează șablonul.
- „Șterge șablonul” (text roșu) cere confirmare; șablonul implicit nu se poate șterge.
- **Date:** `sms_templates`.

## Criterii de acceptare
- [ ] Contorul de segmente e corect pentru GSM-7 și UCS-2 (există test)
- [ ] Cheia API nu ajunge niciodată în frontend (se afișează doar mascată)
- [ ] Șablonul implicit nu are „Șterge”
