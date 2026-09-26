# 12 — Administrare (Istoric · Notificări · Backup și setări · Grădinița)

**Referință:** `Administrare.dc.html#2f`, `#2g`, `#2h`; `Tiparire.dc.html#6a`. **Depinde de:** `00-comun.md` A, D.

## 2f — Istoric (`audit-log/AuditLogPage.tsx`)
- **Sub antet:** SegmentedControl `Tot · Copii · Achitări · Grupe`.
- **Grupat pe zile:** titlu Baloo 18 (ex. „Azi · 26 septembrie”) + card alb cu rânduri.
- **Rând:** oră 13px `--subtle` (56px) · Badge acțiune (Creat mint / Modificat yellow / Arhivat neutral / Asociat orange / Șters pink) · descriere 14px + diff „~~vechi~~ → **nou** · câmp” 12px.
- **Fără butonul „Anulează”** (amânat).

## 2g — Notificări (`notifications/NotificationsPage.tsx`)
- **Antet:** `Notificări  ADMINISTRARE` · comutator `Canale · Mesaje SMS · Șabloane` (ultimele două: spec 14).
- **Canale:** card Telegram mint (cont, ultimul mesaj, Schimbă contul / Deconectează) + listă de comutatoare (activ `--orange`): Restanțe, Zile de naștere, Vizite, Probleme la backup, fiecare cu descriere 13px și programare. **Fără** „Rezumat săptămânal”.

## 2h — Backup și setări (`backup/BackupPage.tsx`)
- **Antet:** `Backup și setări  ADMINISTRARE` · comutator `Backup · Import și export · Grădinița` · „Startica v2.0.0” 13px `--subtle`.
- **Backup:** 3 carduri pas ①②③ (Date salvate mint · Backup local mint · Copie externă: avertizare yellow cu border 2px `--yellow` + CTA „Alege un stick sau un folder”); lista copiilor de siguranță (dată, mărime, automat/manual, Restaurează) + „Fă un backup acum”; „Zonă periculoasă” cu border `--pink`.
- **Import și export:** **singurul loc** cu „Importă copii din CSV” (`ChildrenCsvDialog`) + import/export Excel.
- **Butonul „Reîncarcă”** se mută aici, din antetul global.

## 6a — Grădinița (filă în Backup și setări)
- Grid `1fr 400px`.
  - **Stânga, 3 carduri numerotate:** 1 Identitate (logo 96px dashed + Schimbă; Denumire, Nume afișat, IDNO, Administrator) · 2 Contact și plăți (Adresă, Telefon, Email, Site, IBAN, Banca) · 3 Confirmări de plată (Următorul număr, Semnătură, Mențiune în subsol).
  - **Dreapta (sticky):** previzualizarea antetului documentelor + Renunță / Salvează datele.
- **Date:** obiectul `kindergarten` în setările locale.

## Criterii de acceptare
- [ ] Versiunea afișată e v2.0.0 (sidebar + Backup)
- [ ] Import CSV există doar în Backup și setări → Import și export
- [ ] Fără „Anulează” în Istoric și fără „Rezumat săptămânal” în Notificări
