# Feedback 01.10 (seara) — plan de design + cod

Sursă: testarea utilizatorului pe 2.1.0. Design: `Feedback 01-10.dc.html#38a…38g`. Cod: `PROMPT-CLAUDE-CODE-8.md`.

## Stare (sync 02.10, pachet i)
| # | Design | Cod |
|---|---|---|
| F1 Paginare | ✅ 38a | ✅ `9544360` |
| F2 Ocupare grupă | ✅ 38b | ✅ `f1deb4e` |
| F3 Alte date la Copil nou | ✅ 38b | ✅ `f1deb4e` |
| F4 Fără autocompletare | — | ✅ `38ef0c7` |
| F5 Editor grupă | — | ✅ `2cbd5f6` |
| F6 Backup complet | ✅ 38g | ⏳ parțial — creare arhivă gata (`971d906`,`b161008`,`fa78d4a`), restaurare+UI rămase (plan §6-10) |
| F7 Luni de la luna curentă | ✅ 38c | ✅ `7d8c64f` |
| F8 Funcții custom | ✅ 38f (exista deja în Personal 23e) | ✅ `c045b40` |
| F9 MDL/EUR | — | ⏳ `5ec6429` (verificat — un conflict găsit, în `INTREBARI.md`) |
| F10 Grafic Dashboard | — | ✅ `a2a80e8` |
| F11 Plată din fișă | ✅ 38c | ⏳ §3.4 |
| F12 Curs BNM istoric | ✅ 38e | ⏳ §3.3 |
| F13 Planuri view/edit | ✅ 38d | ⏳ §3.5 |
| F14 Scroll X în 15a | — | ✅ `b93224a` |
| C6–C13 (teme, conturi, prezență pe telefon, SMS automat, contracte, ajutor, burse, verificare backup) | ⏸ toate în pauză (02.10) | — nu intră în ciclul ăsta |
| Povești pentru bug-uri | — | ⏳ PROMPT-8 §6b |
| Îmbunătățiri zilnice (plată din Situație, Anulează, nesalvate) | ✅ 40a–40c | ✅ `217250b` (40c) · `01f6881` (40a) · `74f9317`+`fcbbc39` (40b — 2/6 acțiuni legate la UndoToast, restul în `INTREBARI.md`) |
| Fișă incompletă, pontaj săptămână, căutare (41a–41c) | ✅ 41a–41c | ✅ `4979a1d` (41a) · `ed33495` (41b) · `1e6eb75` (41c) |
| Mesaje de eroare (41d, `toUserError`) | ✅ 41d | ⏳ amânat deliberat — cross-cutting peste aproape toate feature-urile, pasă separată ulterioară |
| PeriodFilter cu presetări | ✅ 41e | ✅ `581535e` (§5.1/§9.2) |
| Rotunjire la achitare | ✅ 41f | ⏳ §9.1 |
| Telefon +373 / 069 | ✅ 25b | ✅ `18074a4` |
| Sincronizare pe ecrane, bon, restaurare | ✅ 42a–42d | ⏳ 42a/42b blocate pe §5.2 (neatins, vezi INTREBARI.md) · ✅ 42c `5017824` · ✅ 42d server `7610e5f`,`dc4bf5d`,`497cbf3`,`39c895a`,`5a0fdff`,`a2192ab`,`b427a71`,`4635ecc` (UI rămasă, vezi INTREBARI.md) |
| Pagina de start Educator (43a) | ⏸ în pauză (02.10) | — |
| Pagina de start Bazin (43b) | ✅ 43b | ⏳ §12 |
| Achitări rapide, frați, casa de azi, reguli formulare | ✅ 44a–44d | ✅ `54b5ee3` (44a) · `0f6e0a6` (44b — frați+receiptGroupId; anularea grupului amânată, vezi `INTREBARI.md`) · `7c9028b` (44c) · ⏳ 44d amânat deliberat — cross-cutting ca 41d, `INTREBARI.md` |
| Liste: cele mai noi primele; filtre păstrate | — | ✅ `ba8a80d`+`1e09940` (§13.1 — sortare descrescătoare, Achitări/Cheltuieli/Vizite/Avansuri) · `b1dfb88`+`fba3164` (§13.2 — filtre/căutare în URL, Copii/Achitări/Cheltuieli) |
| Storybook: 3 componente fără poveste + regulă R12 | — | ⏳ §6c |
| Istoric după copil, fișă → modificări, Necesită atenție | ✅ 45a–45c | ✅ `1629df0`+`6f0e8ad` (45a/45b) · `be02f74`+`8281546` (45c — înlocuiește sursele vechi ale cardului; gating „profil Complet", filtre calculator/perioadă și „cine" pe rând rămân neconstruite din lipsă de infrastructură, vezi `INTREBARI.md`) |
| Personal complet (salarii, avansuri, stat) | ⏸ de decis ce intră | — |

## F1. Paginare în toate tabelele
- **Design:** `DS Tabel si filtre.dc.html` — `Pagination`: „‹ 1 2 3 … 13 ›”, max. 7 poziții, pagina curentă plină portocaliu, săgețile dezactivate la capete, stânga „1–25 din 312”. Aplicată în Copii 2a, Achitări 5a, Cheltuieli, Vizite, Personal.
- **Cod:** `DataTable` paginează implicit (25/pagină) orice listă > 25 rânduri; `Pagination` cu săgeți ‹ › și elipsă. Pagina se resetează la 1 când se schimbă filtrul/căutarea. Test: 1, 7, 31 pagini; story în Storybook.

## F2. 15a — grupa arată ocuparea, nu locurile libere
- **Design:** pastila „Neptun · 8/12”. Grupă plină „12/12” cu text `--pink-ink`, rămâne selectabilă, sub pastile apare „Grupa e plină (12/12). Poți salva oricum.”. Grupă fără capacitate: „Neptun · 8”.
- **Cod:** `ChildFormDrawer.tsx:334` → `${group.name} · ${occupied}/${capacity}`; copilul editat nu se numără de două ori (testul existent rămâne, cu text nou).

## F3. „Alte date” și la „Copil nou”
Era intenționat (15a: formular scurt la adăugare). Decizie nouă: secțiunea „5 · Alte date” apare și la „Copil nou”, **pliată**, cu aceleași câmpuri ca la editare.
- **Design:** `Formulare.dc.html#15a` — rândul pliat sub Grupă.
- **Cod:** scoate condiția de editare; actualizează testul `ChildFormDrawer.test.tsx:40`.

## F4. Fără autocompletare de browser în toată aplicația
- **Cod:** `autoComplete="off"` implicit în toate input-urile din `@shared/ui` (`Input`, `Field`, `AmountInput`, `DateInput`, `TimeInput`, `PhoneInput`, `GlobalSearch`, etc.) și pe fiecare `<form>`. Pentru câmpurile de nume/telefon pe care Chrome le ignoră: `autoComplete="new-password"` sau un `name` unic. Regulă nouă în `architecture.test.ts`: niciun `<input>`/`<form>` brut în `features/**` fără `autoComplete`.

## F5. Grupe — editarea păstrează datele primei grupe (bug)
Când deschizi altă grupă, lista de copii se schimbă, dar numele și capacitatea rămân de la prima grupă. La fel la „Echipa grupei”.
- **Cod:** starea formularului e inițializată o singură dată (`useState(initial)`). Fix: `key={group.id}` pe drawer/formular (sau reset la schimbarea `group.id`), la fel pentru `GroupTeamPicker`. Test: deschide A → închide → deschide B → câmpurile arată B.

## F6. Backup incomplet — personalul, filialele și altele lipsesc
Backup-ul salvează doar baza filialei active (copii, grupe, …). Personalul, salariile, avansurile și pontajul stau în baza comună (`Comun/Startica_Date/startica.db`), iar lista filialelor e separată.
- **Cod:** backup-ul = arhivă cu **toate** bazele: fiecare filială + `Comun` + registrul de filiale + setările (planuri, curs BNM, bazin, notificări, profiluri). Fără `sync.json`/token. Manifest în arhivă: pentru fiecare bază, numărul de rânduri pe fiecare tip. Restaurarea reface tot din manifest. Test de arhitectură: orice tip nou din `record-schema.mjs` sau baza comună trebuie să apară în backup (listă derivată, nu scrisă de mână). Test de restaurare completă: backup → bază goală → restaurare → aceleași numere.
- **Design:** `Administrare.dc.html#10c` — cardul Backup arată ce conține ultimul backup („2 filiale · Comun · 1.243 înregistrări”) și „Vezi conținutul” cu numerele pe tipuri.

## F7. Lunile acoperite de o achitare: luna curentă și următoarele
O încasare acoperă implicit luna curentă și, dacă suma e mai mare, lunile următoare (avans). Lunile trecute nu se bifează automat.
- **Design:** `Formulare.dc.html` (achitare nouă) — rândul de luni pornește de la luna curentă; lunile trecute restante apar separat, nebifate: „Mai are restanță: Aug 2026 · Bifează ca să o acoperi”.
- **Cod:** algoritmul de alocare (`PaymentFormDrawer` + serviciul de plăți) pornește de la luna plății, nu de la prima lună neachitată. Restanțele vechi se acoperă doar dacă sunt bifate manual. Plățile deja salvate nu se recalculează.

## F8. Funcții personalizate la Personal
- **Design:** `Personal.dc.html#23e` — în drawer-ul „Funcții”: „+ Adaugă funcție” (nume + departament + ton), se poate redenumi, se poate șterge doar dacă nimeni nu o are.
- **Cod:** funcțiile devin înregistrări în baza comună (`staffRoles`), cu cele din spec ca valori inițiale; `Staff.roleId` în loc de text fix; migrare pentru angajații existenți. Funcțiile intră în backup (F6).

## F9. MDL/EUR — clarificare, fără model nou
Modelul ales pe 26.09 rămâne: planul grupei e în EUR, achitarea se face în lei. La salvare se stochează `amount` (lei), `fxRate` (cursul BNM al zilei plății) și `amountEur`, toate fixate în acel moment. Dashboard, Raport contabil, Situația și Cheltuieli afișează **doar MDL**. EUR apare doar în plan, în fișa copilului (obligația lunară) și în modalul de plată („≈ 25,38 €”).
- **Cod:** verifică dacă e implementat exact așa. Orice loc din Dashboard/rapoarte care arată EUR trece pe MDL. Plățile fără `fxRate` primesc cursul zilei lor din istoricul BNM (F12), o singură dată, cu backup înainte.

## F10. Dashboard — „Evoluția încasărilor” nu mai funcționează
Deja în PROMPT-7 §1. Dacă nu e închis până la sync, trece aici primul.

## F11. „Plată +” din fișa copilului
- **Design:** `Formulare.dc.html` — modalul de plată deschis din fișă: copilul deja selectat și blocat (cu „Schimbă”), cardul planului „Program mediu · 500 €/lună”, cursul zilei, „De încasat: 9.845,00 lei (500 € × 19,69)” plus restanța, dacă există. Suma e precompletată și se poate edita.
- **Cod:** `PaymentFormDrawer` primește `childId` din fișă; calculează din `feeHistory` curent × cursul BNM al zilei; folosește alocarea din F7.

## F12. Curs BNM — istoric, cursul de mâine, calendar
- **Design:** `Planuri si curs.dc.html` — cardul de curs: azi + mâine (când e publicat: „Mâine: 19,72 · publicat 16:05”), calendar pe lună cu cursul pe fiecare zi, „Vezi încă 10 zile” înapoi, zilele fără curs (weekend/sărbători) iau cursul ultimei zile lucrătoare, marcate ca atare.
- **Cod:** tip nou `exchangeRates` `{date, eur, source:'bnm', fetchedAt}` în baza comună. Descărcare automată: la pornire și din oră în oră după 13:00 până apare cursul de mâine; completează golurile din ultimele 30 de zile; „Vezi încă 10 zile” cere zilele lipsă de la BNM. Plata folosește cursul **datei plății** din istoric. Intră în backup (F6). Ora exactă de publicare BNM se verifică, nu se presupune.

## F13. Planuri — vizualizare, apoi editare
- **Design:** `Planuri si curs.dc.html` — implicit doar citire (lista planurilor), butoane „+ Adaugă plan” și „Editează planuri”. Ștergerea apare doar în modul de editare. „Salvează” e dezactivat până la prima modificare; „Anulează” iese din modul de editare fără să salveze.
- **Cod:** `ExchangeRateSettings`/planuri — mod `view|edit`, `isDirty` pe formular; ștergerea unui plan folosit de copii e blocată, cu numărul de copii.

## F14. Observat în captura de pe 15a
Formularul iese din drawer pe dreapta (Data nașterii, Scadență, „Program lung” tăiate) — e bug-ul cu scroll pe orizontală din PROMPT-7 §1.2.

## Ordinea propusă pentru Claude Code
F5 → F6 (backup, risc de date) → F4 → F1 → F2/F3 → F7 → F9 → F12 → F11 → F13 → F8.
