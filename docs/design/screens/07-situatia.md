# 07 — Situația plăților (Lună / An școlar)

**Referință:** `Situatia.dc.html#1m` (Lună), `#1n` (An școlar), SMS `#2a`, `#2b`, `#2c`. **Depinde de:** `00-comun.md` A, B, C, D, E.

## 1. Fișiere
Se modifică: `status/StatusPage.tsx`, `.module.css`, `.test.tsx`. Se creează: `status/SmsConfirmDialog.tsx` (vezi README, „Notificare SMS”).

## 2. Antet (identic în ambele moduri)
`Situația plăților  CONTABILITATE` · `[Lună | An școlar]` · în Lună: MonthPicker; în An școlar: `[Anul școlar 2025–2026 ▾]` · `[Tipărește]`.

## 3. Mod Lună (1m)
- **4 carduri:** De încasat · Încasat (cu bară) · Restanțe (pink) · Fără taxă setată (yellow + „Completează →”).
- **Card-tabel:** toolbar (segmented Toți · N / Restanțieri / Parțial / Achitat / Urmează + căutare) → `FilterPills` `Grupa` (Toate + grupe + Fără grupă).
- **Coloane:** Copil · Scadență · Taxă · Achitat · Rest (roșu dacă > 0) · Statut · CTA (Notifică / Vezi fișa). Grid `2fr 0.9fr 1fr 1fr 1fr 1.2fr 150px`.
- **Banner jos:** `--yellow-soft`, „N restanțieri — Notifică toți” (deschide #2b).

## 4. Mod An școlar (1n)
- 3 carduri (restanțe / rată de încasare / parțiale).
- **Hartă:** coloana copil de 230px + 12 coloane de lună + Sold de 130px; celule de 30px, radius 8: achitat `--mint`, parțial `--yellow`, neachitat `--raspberry`, urmează `#f1ece2`, înainte de contract `#faf7f1`; luna curentă cu outline de 2px `--orange-soft`. Legenda sus.

## 5. Criterii de acceptare
- [ ] Antetul An școlar e compact, identic cu Lună (nu H2 de 36px în conținut)
- [ ] Filtrul de grupă e cu pastile, nu cu dropdown
- [ ] „Notifică” pe un rând → #2a; „Notifică toți” → #2b
