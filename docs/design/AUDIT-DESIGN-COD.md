# Audit design ↔ cod — actualizat 30.09.2026, 01:00 (master-v2 @7063a98)

Legendă:
- **OK**: există în cod și a fost aliniat.
- **DIF**: există, dar diferă de design (lista e mai jos).
- **LIPSĂ**: nu există în cod.
- **VIZ**: aliniat de Claude Code doar pe baza specului scris, fără captură comparată cu artboard-ul. Trebuie comparat vizual o dată.

Stările vin din codul de pe `master-v2` (fișiere, CSS, componente). Nu vin doar din `COADA-DE-LUCRU.md`.

## 1. Pe ecrane

| Ecran | Id | Stare | Ce trebuie |
|---|---|---|---|
| Dashboard | 1a, 12f | OK · VIZ | A8 a refăcut graficul și pastila de curs. Comparație vizuală. |
| Copii · listă | 2a | OK · VIZ | — |
| Copii · fișă | 2b, 12d | DIF | Documente = placeholder (A9). Plătitori reținuți fără IBAN. Nume/prenume = un câmp. Maximum 2 părinți. |
| Zile de naștere | 2c | OK | — |
| Grupe | 4b, 4a, 4c | OK · VIZ | `groupTone()` ignoră `group.tone` ales manual, deci culoarea diferă între Grupe și celelalte ecrane. |
| Vizite | 4a (Vizite) | OK · VIZ | — |
| Achitări | 5a, 5b | DIF | Export = CSV simplu, nu panoul de export. „Bon zi” rămas ghost. Perioadă/Nearhivate rămân `input month` + segmented. |
| Cheltuieli | 6a | OK · VIZ | — |
| Cheltuieli · Pe zile | 6b | DIF | **Coloana/blocul de buget lipsește** (comentariu în `DailyExpensesView.tsx`: „funcție amânată”). |
| Situația · Lună / An | 7a, 7b, 12c | OK · VIZ | — |
| Notifică un părinte | 7c | DIF | Textul nu se poate edita și nu există alegere de șablon (`SmsConfirmDialog` single = doar bulă). |
| Mesaj personalizat | 7e | LIPSĂ | Același dialog, cu „Personalizat” și textarea goală. |
| Notifică toți | 7d | OK | — |
| De notificat | 8a | OK | Decis: SMS. Designul a fost actualizat („SMS conectat”). |
| Taxe și grupe | 9a, 12g | OK | — |
| De verificat | 9b | OK | Tasta S există (`ReviewPage` keydown). |
| Asociere achitări | 9c | OK | Pragul „Posibil” ≥ 2 e provizoriu. |
| Istoric | 10a | OK · VIZ | — |
| Notificări | 10b, 10e | OK | Designul a fost adus la cod pe 29.09 (file, „Detalii”). „Probleme la backup” = LIPSĂ. |
| Backup și setări | 10c | OK | Import CSV, „Probleme la backup” și „Zonă periculoasă”: decis să nu se facă (29.09). Coloana dreaptă = Import și export (divergență acceptată). |
| Servicii | 10d | OK · DIF DS | Construit 30.09 + migrarea B3 executată (143 → Achitări, retroactiv iun–iul). `ServicesSettings` încalcă regulile DS (input brut, ⋮⋮, „Se încarcă…” text) → se rezolvă la migrarea DS. |
| Mesaje SMS | 11a | OK | Designul a fost adus la cod pe 29.09 (carduri, Sursă/Telefon). Lipsește butonul „+ SMS nou”. |
| Șabloane + furnizor | 11b | OK | — |
| **SMS nou** | **11c, 11d** | **LIPSĂ** | Design nou, 29.09. |
| Planuri și curs | 12a, 12b, 12e | OK | — |
| Filiale | 13a, 13b, 13c | OK · VIZ | — |
| Sincronizare | 14a, 14b, 14c | OK | E2E 6/6 PASS. |
| Adaugă copil | 15a | OK · VIZ | Construit din `29-copil-nou-diferente.md`, fără artboard-ul final. |
| Achitare nouă | 15b | DIF | + Serviciu (B3) OK. Câmpurile de repartizare manuală se rezolvă la migrarea DS. Bifa „Trimite confirmare părintelui prin SMS” LIPSĂ (canalul e decis: SMS). |
| Cheltuială nouă | 15c | OK | — |
| Confirmări, liste goale, salvare | 15d, 15e, 15f | OK | — |
| Bara de derulare | 15g | OK | `DataTable` fără ScrollArea (intenționat). |
| Arhivate + ștergere | 15h | OK | B2. |
| Confirmare de plată | 16b, 16d–16g | OK | A5 + A4 1/3+2/3. 16d/16e/16f sunt variante de explorare. Codul are doar 16g, ceea ce e corect. |
| Setări grădiniță | 16a | OK | — |
| Situația tipărită | 16c | OK | Fără „Pagina N din M” (limită Chrome). |
| **Ecrane mici** | **17a, 17b, 17c** | **LIPSĂ** | Nu există niciun `@media` de lățime în shell. Meniul nu se strânge la 1024, Situația nu are layout la 768. |
| Prezența · Ziua | 18a | OK · VIZ | Rezolvat 30.09 (pink-ink, #5b666e, `:nth-last-child(2)`). |
| Prezența · Luna | 18b | OK · VIZ | Rezolvat 30.09 (padding mutat în celule). |
| Foi pe săptămână | 18c, 18d | OK · VIZ | — |
| Raport contabil | 19a, 19b | OK · VIZ | — |
| **Prima pornire** | **20a, 20b, 20c** | **LIPSĂ** | Există doar conectarea cu cod. Asistentul (Grădinița → … → Import Excel → Gata) lipsește. |
| Încărcare | 21a, 21b, 21c | DIF | 2 cercuri. „…”/„Gata”. Bara sare în trepte. Lipsește „v”. **21b bara de sus LIPSĂ**. 21c are încă textul provizoriu, fără „Lucrez fără legătură”. |
| Bazin | 22a–22d, 24c | OK | „Antrenor:” cu mai mulți = virgulă (de confirmat). |
| Personal | 23a–23l | OK | 23c/23h/23g/23e/23i există. Codul „I” (învoire) nu se poate pune din pontaj. Candidații nu se contopesc la sincronizare. |
| Salariul pe fișă | 23m | RESPINS | Decizie 29.09, 23:19: rămâne linkul spre Salarii. Nu se construiește. |
| Bonuri 58 mm | 24a, 24b, 24d | OK | Stickere cu text liber + mărimi. |

## 2. Unde se lucrează, în ordine

**0. Design system: câmpuri de formular (primul)**
0. `Componente formular.dc.html` 25a–25f → componentele din COMPONENTE.md §0. Apoi migrarea celor ~200 de câmpuri brute. Remedierile de câmpuri de mai jos (15b etc.) se rezolvă singure prin migrare.

**A. Remedieri pe ce există (fără decizii)**
1. 18b weekend continuu. 18a culori și bordură (PROMPT §2–3).
2. 15b câmpurile de repartizare manuală (§4).
3. 21a/21b/21c Încărcare (§4b).
4. `groupTone()` citește întâi `group.tone`.
5. Comparație vizuală la 1440px pentru tot ce e marcat **VIZ**, după ce pachetul final e în `docs/design/`.

**B. Funcții noi cu design gata**
6. 7c/7e text editabil + șablon la „Notifică” (§4c).
7. 11c/11d „+ SMS nou” (§4c).
8. 23m salariul pe fișă după PIN (§4d).
9. 17a–17c ecrane mici: meniul strâns la ≤1280/1024 (iconițe + drawer 17b) și Situația pe 768.
10. 20a–20c Prima pornire: asistent la instalarea nouă, înainte de Dashboard.
11. 6b bugetul pe categorii în Pe zile.
12. Achitări: exportul prin panou (ca 19b), în loc de CSV simplu.

**C. Funcții noi care așteaptă decizia ta (PROMPT §5)**
13. 10d Servicii + B3 (migrarea celor 143 de încasări de bazin).
14. 15b „Trimite confirmare părintelui” + 8a canalul: SMS sau Telegram.
15. 10b „Probleme la backup”, Import CSV.

**D. Amânate (plan tehnic înainte de cod)**
16. A9 Documente pe fișă.
17. Plătitori reținuți cu IBAN (`payer_aliases.iban`/`nameKey`).
18. Nume/prenume separate + părinți dinamici (schimbare de schemă).
19. Codul „I” în pontaj. Contopirea candidaților la sincronizare.
