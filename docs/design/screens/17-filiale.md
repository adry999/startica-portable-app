# 17 — Două filiale (selector în meniul lateral)

> **Actualizat 29.09.2026:** **Eyebrow-ul antetului NU mai conține filiala** (DECIZII 2). Linia „Eyebrow-ul antetului conține numele filialei” de mai jos e anulată. Unde textul de mai jos contrazice `DECIZII.md` sau `ALINIERE-DESIGN.md`, acelea au prioritate.

**Referință:** `Filiale.dc.html#13a`, `#13b`, `#13c`; `Sidebar.dc.html` (selectorul din capul meniului). **Depinde de:** `00-comun.md`.

## Regula
Două filiale ale aceleiași grădinițe folosesc aceeași aplicație, dar cu **date complet separate**: copii, grupe, planuri și prețuri, achitări, cheltuieli, vizite, SMS, setări și backup. Nimic nu se vede între filiale; ca să vezi cealaltă filială, treci la ea din selector.

## 13a — Selectorul
- **Poziție:** în `Sidebar`, imediat sub logo, pe toată lățimea meniului. Filialele: **Buiucani** (orange) și **Botanica** (mint).
- **Logo:** singur sus, centrat, 46px înălțime. Versiunea **nu** mai stă lângă logo: apare doar în dreapta rândului „Backup și setări” din meniu (11px/700 `--subtle`) și în antetul paginii Backup și setări.
- **Aspect:** radius 14, padding `8px 12px 8px 8px`, border 1.5px în tonul filialei. Conține pătratul de 30px cu inițialele „Bu” / „Bo” (fundal culoarea filialei, text alb, Baloo 15), eticheta „FILIALA” (10px/800 uppercase `--subtle`), numele (14/800) și săgeata ▾ / ▴.
- **Click:** deschide un dropdown de 300px sub selector (radius 18, `--shadow-panel`), cu titlul „Schimbă filiala”. Fiecare rând are pătrat de 34px, nume, „N copii · adresă” și ✓ la filiala curentă. Jos: „Administrează filialele →” (duce la 13c). Click în afara dropdown-ului sau Esc îl închide.
- **La alegere:** conținutul se estompează (opacity .35) cu mesajul „Se deschide <filiala>…”. Se încarcă datele celeilalte filiale; utilizatorul rămâne pe **același modul** (ex. Achitări), cu filtrele resetate; formularele deschise se închid.
- **După:** toast slate, 5s, „Acum lucrezi în **<filiala>** · Înapoi la <cealaltă>”.
- **Eyebrow-ul antetului** conține numele filialei, ex. „PRIVIRE DE ANSAMBLU · FILIALA BUIUCANI”.
- Ultima filială deschisă se ține minte și se deschide la pornire.

**Planuri și prețuri:** fiecare filială are cele 3 planuri cu prețurile ei, introduse din Backup și setări → Planuri și curs. Cursul BNM e același pentru ambele filiale; o corectare manuală a cursului se aplică doar filialei în care e făcută.

## 13b — Formular nesalvat
Dacă există un formular cu modificări, înainte de schimbare apare un dialog: „Ai o achitare nesalvată în <filiala>”, cu butoanele „Rămân aici” · „Renunț și schimb” (roșu) · „Salvează și schimbă” (primar).

## 13c — Backup și setări → fila Filiale
- O listă de carduri: pătrat de 44px, nume, badge „Deschisă acum”, adresă, „N copii · N grupe · salvat azi, ora”; butoane „Redenumește” și „Culoare” (paletă de 4 tonuri: orange, mint, yellow, pink).
- „+ Adaugă filială” creează o filială goală.
- O filială **nu se poate șterge** din aplicație.

## Date (de decis în planul tehnic)
- Fiecare filială are propriul set de înregistrări și propriul folder de date/backup. Toate id-urile și interogările sunt filtrate pe `branchId`, sau sunt folosite baze separate.
- `branches (id, name, color, address, created_at)` + `settings.lastBranchId`.
- Filialele lucrează pe calculatoare diferite, dar oricare calculator trebuie să poată deschide oricare filială: vezi `18-sincronizare.md`.

## Criterii de acceptare
- [ ] Selectorul apare pe toate ecranele, sub logo, în culoarea filialei curente
- [ ] Nicio dată a unei filiale nu apare în cealaltă (există test)
- [ ] La schimbare rămâi pe același modul, cu filtrele resetate
- [ ] Formularul nesalvat cere confirmare
- [ ] Eyebrow-ul antetului arată filiala
