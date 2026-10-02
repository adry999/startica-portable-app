# Feedback 01.10 (seara) — plan de design + cod

Sursă: testarea utilizatorului pe 2.1.0. Design: artboard-urile 38–45 sunt acum în paginile de modul (02.10, seara); `arhiva/Feedback 01-10.dc.html` rămâne doar istoric.dc.html#38a…38g`. Cod: `PROMPT-CLAUDE-CODE-8.md`, `-9.md` (arhivate) → `PROMPT-CLAUDE-CODE-10.md`.

## Stare (sync 02.10, 13:25) — PROMPT-9 §1–§9 închis (`c2c745e`) + AUDIT-COD-02-10 / -B

Sync 02.10, 16:50: PROMPT-10 aproape închis (§2–§4, §6–§8 în cod). Resturi → PROMPT-11 §4 (numărătoare PIN 15 min, descărcare automată, 37d). Nou → PROMPT-11 §1–§3 (F15–F17). Operațional (tu): repo `startica-releases`, redesfășurare `sync-server`, migrările §8/§9 pe o copie.

Legendă: ✅ închis · 🔁 parțial, restul în PROMPT-9 · 🧪 făcut, de testat manual (VERIFICARE-DUPA-PROMPT-8.md) · ⏸ pauză
| # | Design | Cod |
|---|---|---|
| F1 Paginare | ✅ 38a | ✅ `9544360` |
| F2 Ocupare grupă | ✅ 38b | ✅ `f1deb4e` |
| F3 Alte date la Copil nou | ✅ 38b | ✅ `f1deb4e` |
| F4 Fără autocompletare | — | 🧪 `off` peste tot (`38ef0c7`); test Chrome „Copil nou” nume/telefon nefăcut |
| F5 Editor grupă | — | ✅ `2cbd5f6` |
| F6 Backup complet | ✅ 38g | 🔁 arhivă completă + restaurare server ✅ (F6, `971d906`,`b161008`,`fa78d4a`; restaurare `7610e5f`…`4635ecc`); UI prima pornire + reîncărcare → PROMPT-9 §4 |
| F7 Luni de la luna curentă | ✅ 38c | ✅ `7d8c64f` |
| F8 Funcții custom | ✅ 38f (exista deja în Personal 23e) | ✅ `c045b40` |
| F9 MDL/EUR | — | ✅ verificat; secțiunea EUR din Raport contabil se păstrează (02.10). Plăți vechi fără `fxRate` → PROMPT-9 §9: script de migrare scris și testat (`446885a`), doar cu `startTestApplication` (date de test, temporare) — nicio filială reală n-a fost migrată încă în această sesiune (regula sesiunii: niciodată `--execute` împotriva datelor reale) |
| F10 Grafic Dashboard | — | ✅ `a2a80e8` |
| F11 Plată din fișă | ✅ 38c | ✅ `53653b7`; doar taxa lunii, restanța bifă manuală (02.10) |
| F12 Curs BNM istoric | ✅ 38e | ✅ polling + calendar + backfill ✅ (`81f979c`); mutare în baza comună (`b0393e4`) — script de migrare scris și testat doar cu `startTestApplication` (date de test, temporare); nicio filială reală n-a fost migrată încă în această sesiune |
| F13 Planuri view/edit | ✅ 38d | ✅ `c53533b` |
| F14 Scroll X în 15a | — | ✅ `b93224a` |
| F15 Plan mereu vizibil la Copil nou/Editează (gol = mesaj) | ✅ 15a, 15i | ✅ PROMPT-11 §1 (EmptyState `planuri.childForm`, fără gardă `presetsReady`) |
| F16 Rotunjire la alegere, precompletat exact | ✅ 15b, 41f | ✅ PROMPT-11 §2 (pastile Rotunjește: Exact/jos/sus/10 lei) |
| F17 MonthInput propriu (repartizare manuală) | ✅ 15j | ✅ PROMPT-11 §3 (popover propriu, markers, isDisabled) |
| F18 Achitare nouă ≠ design | ✅ 15b (completat: curs manual, împarte pe metode, frați) | ✅ PROMPT-11 §5 (carduri Plan/Curs BNM, bandă de stare; „Luni acoperite” pastile amânat, vezi INTREBARI.md) |
| F19 Subsoluri de formular diferite | ✅ 15k | ⏳ PROMPT-11 §6 |
| Secțiuni ascunse fără date (tipar F15) | — | ✅ PROMPT-11 §7 (audit + Serviciu/backup/antrenor/SMS corectate, restul contextual) |
| F20 Grupe → Carduri ≠ 4a (editor) | ✅ 4a | ✅ PROMPT-11 §8 |
| F21 Copii: sortare pe toate coloanele, antet corect | ✅ 2a | ✅ PROMPT-11 §9 |
| F22 Button link cu fundal („Vezi calendarul →”) | — | ✅ PROMPT-11 §10 |
| F23 Grafic Evoluția încasărilor | ✅ 1a refăcut | ✅ PROMPT-11 §11 |
| F24 Necesită atenție ≠ design (texte, prezența de azi) | ✅ 1a/45c | ✅ PROMPT-11 §12 |
| F25 Zile de naștere: gol fără „Următoarea” | ✅ 1b | ✅ PROMPT-11 §13 |
| F26 Meniul stâng (inițiale filială, bordură, card jos) | ✅ Sidebar a | ✅ PROMPT-11 §14 |
| F27 Antet module mai înalt (64px) | ✅ | ⏳ PROMPT-11 §15 |
| F28 + Angajat: Funcția ca listă nativă | ✅ 23n | ✅ PROMPT-11 §16 |
| F29 Scrii doar în filiala deschisă (angajat cu alegere de filiale) | ✅ 23n, 23o | ⏳ PROMPT-11 §17 + audit |
| F30 Salarii: nu se poate plăti, fără motiv | — | ⏳ PROMPT-11 §18 |
| F31 Salariul nu se poate edita (formular gol, Bazin blocat) | — | ⏳ PROMPT-11 §19 |
| C6–C13 (teme, conturi, prezență pe telefon, SMS automat, contracte, ajutor, burse, verificare backup) | ⏸ toate în pauză (02.10) | — nu intră în ciclul ăsta |
| Povești pentru bug-uri | — | ⏳ PROMPT-8 §6b |
| Îmbunătățiri zilnice (plată din Situație, Anulează, nesalvate) | ✅ 40a–40c | ✅ 40a/40c (`217250b`,`01f6881`); 40b complet — UndoToast cheltuială + arhivare 1 copil (`74f9317`+`fcbbc39`), apoi achitare/copil nou/mutare în grupă/avans + Grup frați 44b (`5112298`, PROMPT-9 §5; avans folosește `/api/personal/advances` remove, nu `/api/undo` generic — vezi INTREBARI.md) |
| Fișă incompletă, pontaj săptămână, căutare (41a–41c) | ✅ 41a–41c | ✅ `4979a1d` (41a) · `ed33495` (41b) · `1e6eb75` (41c) |
| Mesaje de eroare (41d, `toUserError`) | ✅ 41d | ✅ PROMPT-10 §3 (`to-user-error.ts`) |
| PeriodFilter cu presetări | ✅ 41e | ✅ `581535e` |
| Pontaj „Toți prezenți” (41b) | ✅ 41b | ✅ cod nou „P” (`ed33495`); distinct în grilă/legendă/tipar (PROMPT-9 §1.2) |
| Rotunjire la achitare | ✅ 41f | ✅ PROMPT-10 §2 (`roundingDiff`, toleranță 5 lei) → schimbat de F16: precompletat exact, rotunjire la alegere (PROMPT-11 §2) |
| Telefon +373 / 069 | ✅ 25b | ✅ `18074a4` |
| Sincronizare pe ecrane, bon, restaurare | ✅ 42a–42d, 46a–46d | ✅ 42a/42b/42c (`86c744d`,`5017824`); 42d server (`7610e5f`…`4635ecc`); 46a–46d UI prima pornire + reîncărcare (`fc42764`) |
| Actualizări (§5.2) | ✅ 37a–37d | 🔁 verificare versiune + `release.mjs` gata ✅ (`b0e5b8c`); repo = `adry999/startica-releases` ✅ cod (PROMPT-9 §1.1) — repo-ul însuși nu există încă pe GitHub, de creat manual; 426 + instalare automată rămân |
| Profiluri calculator (§5.3) | ✅ 36a–36h | ✅ server + sync (`be573f4`…`0969da7`); strat client 36a–36f ✅ PROMPT-9 §2 (`cc27549`…`1eda866`) — ModuleGuard + `profil.blocked` (36f), meniu filtrat (36d), card sincronizare „Profil X · acces limitat” (36d), fișă copil doar-citire (36e), pairing cu alegere profil + matrice Personalizat (36a/36b), listă calculatoare cu coloana Profil + „Schimbă” (36c); pașii 1+2 din 36a țin într-un singur dialog (simplificare V1), matricea 36b fără grupe de titlu, rândul Administrare informativ, nu interactiv; test de arhitectură client (R12, architecture.test.ts) verifică moduleId pe fiecare rută; 36g/36h ✅ PROMPT-9 §7 (`47b12d8`,`2ed0fc5`,`a172ae0`,`1466d69`) — istoric sincronizat între calculatoare + PIN generalizat pe module; fără ștergere locală (02.10, verificat — niciun cod nou nu șterge date la restrângere); `sync-server` de redesfășurat |
| Pagina de start Educator (43a) | ⏸ în pauză (02.10) | — |
| Pagina de start Bazin (43b) | ✅ 43b | ✅ `04d233e` |
| Achitări rapide, frați, casa de azi, reguli formulare | ✅ 44a–44d | ✅ 44a–44c (`54b5ee3`,`0f6e0a6`,`7c9028b`); 44d ✅ PROMPT-9 §3 (`fbdcf10`) — `usePanelController` nou (focus pe primul câmp, Ctrl+Enter=submit, Esc→40c prin overlay-stack, „N erori” fix în subsol), lățimi ca tokeni (`--drawer-form`/`--drawer-detail`/`--dialog`), R13 (fără drawer în drawer), trecere prin formularele existente; anularea grupului de frați → §5 |
| Liste: cele mai noi primele; filtre păstrate | — | ✅ `ba8a80d`+`1e09940` (sortare) · `b1dfb88`+`fba3164` (filtre URL) |
| Storybook | — | ✅ audit 02.10: lipsește doar `Toast` story → PROMPT-10 §6 (R12 e acum ModuleGuard) |
| Istoric după copil, fișă → modificări, Necesită atenție | ✅ 45a–45c | 🔁 ✅ cu devieri (`1629df0`,`6f0e8ad`,`be02f74`,`8281546`, INTREBARI §14); filtre modul/calculator/perioadă ✅ PROMPT-9 §6 (`db8a53e`) — calculator interim, doar local, până la `device_id`/`device_name` din §7 |
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

## F15. Planul dispare din Copil nou / Editează (02.10)
Secțiunea Plan era ascunsă când filiala nu are planuri. Decizie: apare mereu; fără planuri, mesaj „Nu sunt planuri setate” + „Setează planurile” + taxa manuală. Design `Formulare.dc.html#15i`. Cod: PROMPT-11 §1.

## F16. Rotunjire la alegere (02.10)
650 € × 20,1068 = 13.069,42 era precompletat 13.069. Decizie: se precompletează suma exactă; pastile „Exact / ↓ leu / ↑ leu / 10 lei” pentru rotunjire. Design `#41f`, `#15b`. Cod: PROMPT-11 §2.

## F17. Selector de lună al browserului în repartizarea manuală (02.10)
Decizie: `MonthInput` cu popover propriu (MonthPicker 30b), luni în română, stare pe lună. Design `#15j`. Cod: PROMPT-11 §3.
