# 11 — De rezolvat (Taxe și grupe · De verificat · Asociere achitări)

**Referință:** `De rezolvat.dc.html#2c`, `#2d`, `#2e`. **Depinde de:** `00-comun.md` A, E.

## 2c — Taxe și grupe (`fee-setup/FeeSetupPage.tsx`)
- **Antet:** `Taxe și grupe  DE REZOLVAT` · progres „6 din 109 completate” + bară de 8px (120px, `--orange` pe `#f1ece2`).
- Nota explicativă e o casetă `--yellow-soft`, radius 16, 14px.
- **Bara de selecție** (slate): „N selectați | Aplică: Grupă ▾ · Taxă · Scadență · Aplică la N”.
- **Tabel editabil inline:** câmpurile lipsă au `border:1.5px solid var(--pink)` și placeholder gri; butonul „Salvează” de pe rând e secundar și devine primar când rândul e modificat.
- **Criteriu:** după salvare, rândul completat dispare din listă și contorul din sidebar scade.

## 2d — De verificat (`review/ReviewPage.tsx`)
- **Sub antet:** SegmentedControl `Toate · Fișe · Achitări` + progres „1 din 284”.
- Grid `360px 1fr`, gap 18.
  - **Coada:** rânduri cu punct de severitate de 8px (roșu `--raspberry` / galben `--yellow` / mint `--mint`) + nume 14/800 + problema 12px; rândul activ are bara stângă de 4px.
  - **Cazul curent:** identitate + „Deschide fișa →”; caseta problemei `--pink-soft`; tabel comparativ cu diferențele pe `--yellow-soft`; acțiuni: principală (ex. „Unește fișele”) · „Nu e … · marchează verificat” · „Sari peste” (tasta **S**).
- **Criteriu:** tasta S trece la cazul următor; progresul se actualizează.

## 2e — Asociere achitări (`assign/AssignPage.tsx`) — singurul loc de asociere
- Grid `1fr 1fr`: lista neasociatelor | detaliu.
- **Detaliu:** sumă Baloo 38, textul băncii (caseta `--neutral-softer`, monospace 13px), **sugestii ordonate**:
  - Potrivire mare (mint + buton primar „Asociază”) / Posibil (yellow) / Slab (neutral);
  - motivul sub nume („potrivire sumă”, „Plătitor reținut”);
  - căutare „Alt copil…”;
  - checkbox **„Ține minte plătitorul”** → scrie în `payer_aliases`.
- Linkurile „Neasociată →” din Achitări duc aici, cu `?id=<paymentId>` pentru preselecție.
- **Criteriu:** plătitorul reținut apare primul la următoarea achitare de la același plătitor, cu motivul „Plătitor reținut”.
