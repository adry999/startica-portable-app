# Ghid livrare Startica

Pentru cine pregătește și instalează pachetul la client, nu pentru client
(clientul primește `CITESTE-MA.txt`, livrat cu instalerul).

## Pregătire (pe calculatorul de dezvoltare)

- [ ] Arbore de lucru curat (`git status`); ramura conține tot ce trebuie livrat, la zi cu `master`.
- [ ] `npm run check:full` trece (format, `tsc`, teste unitare/integrare, smoke în browser, ciclul de viață al lansatorului).
- [ ] Smoke manual în browser: pornește aplicația, parcurge principalele ecrane (Copii, Achitări, Cheltuieli, Dashboard, Centrul de verificare, Backup și setări), verifică `#backupStatus`.
- [ ] Test de ciclu de viață: a doua pornire deschide a doua fereastră; închiderea ultimei ferestre oprește serverul și scrie un backup `*_inchidere_*`.
- [ ] `scripts\pachet-client\build-client-package.ps1` rulează fără erori și produce `Livrare\Startica_Setup_<versiune>.exe`.
- [ ] Instalerul instalat de probă pe acest calculator (sau într-o mașină virtuală / Windows Sandbox): pornește, deschide fereastra, scurtăturile apar, dezinstalarea lasă evidența pe loc.
- [ ] Actualizare de probă cu Startica pornită (fereastră deschisă): instalerul o închide, nu cere repornire, evidența rămâne; apoi dezinstalare cu Startica pornită: `{app}` dispare, `%LOCALAPPDATA%\Startica` rămâne.
- [ ] SHA-256 al instalerului calculat și notat (`Get-FileHash Livrare\Startica_Setup_<versiune>.exe -Algorithm SHA256`).

## La client

- [ ] Chrome sau Edge instalat pe calculatorul clientului.
- [ ] Dacă există o instalare veche din ZIP: nu se șterge nimic înainte — lansatorul o găsește singur și oferă preluarea evidenței la prima pornire.
- [ ] Instalerul rulat; la avertismentul SmartScreen ("Editor necunoscut"), "Mai multe informații" → "Rulează oricum".
- [ ] La prima pornire: dacă apare dialogul de preluare a evidenței vechi, se confirmă folderul găsit și data ultimei modificări înainte de a accepta.
- [ ] Datele sunt cele cunoscute (număr de copii, ultimele achitări și cheltuieli); versiunea afișată în bara laterală corespunde.
- [ ] **Backup și setări**: folderul extern (Google Drive sau similar) e configurat; **Salvează și testează copia** reușește. Copierea în folderul extern nu confirmă și încărcarea în cloud — asta se verifică separat, în aplicația Google Drive sau echivalent.
- [ ] Închiderea ferestrei oprește aplicația (apare un backup nou în `%LOCALAPPDATA%\Startica\Startica_Backup`).
- [ ] Dacă a fost o actualizare de pe ZIP: folderul vechi rămâne pe loc; se poate șterge după câteva zile de verificare, la decizia clientului.

## Notă despre backup extern

Aplicația copiază baza în folderul extern configurat (de exemplu un folder
sincronizat de Google Drive) și confirmă doar reușita acestei copieri
locale. Faptul că folderul e sincronizat mai departe în cloud nu este
verificat de aplicație — se confirmă separat, în clientul Google Drive
(sau echivalent) de pe calculatorul clientului.

## Integritate instaler

```powershell
Get-FileHash .\Startica_Setup_<versiune>.exe -Algorithm SHA256
```

Se compară cu SHA-256 notat la pregătire, înainte de a trimite sau
rula instalerul la client.
