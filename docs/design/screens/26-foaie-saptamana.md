# 26 — Foaia de prezență pe săptămână (A4 orizontal, câte una pe grupă)

**Referință:** `Prezenta.dc.html#18c` (fereastra) și `#18d` (foaia). **Nou. Depinde de:** `19-prezenta.md`, `15-tiparire.md` (antet tipărit, `@media print`).

Se tipărește lunea și se dă educatorilor. Educatorul notează pe hârtie toată săptămâna, iar prezența se introduce apoi în Prezența → Ziua, în aceeași ordine.

## 1. Fișiere
Se creează: `attendance/WeeklySheetDialog.tsx`, `attendance/WeeklySheet.tsx`, `WeeklySheet.module.css`, `WeeklySheet.test.tsx`.
Se modifică: `attendance/AttendancePage.tsx` (butonul din antet).
Ruta de tipărire: `/prezenta/foi?week=YYYY-MM-DD&groups=g1,g2&info=1&notes=1`. Aici se randează doar foile, apoi `window.print()`.

## 2. Date
- Copiii grupei activi în săptămâna aleasă (fără arhivați), sortați alfabetic, **ca în Ziua**. Grupele (pastilele și ordinea foilor) urmează ordinea aleasă în Grupe (`group.order`, vezi 03 §3b).
- Educatorii: principalul și asistentul grupei. Dacă modulul Personal (24) are roluri pe grupă, se iau de acolo (principal / asistent); altfel se folosește `group.educator`, iar rândul „Asistent” lipsește.
- Detalii: `child.healthNotes`. Pe foaie apare doar prima linie (ellipsis). Eticheta se deduce așa: dacă textul conține „alergi” → `ALERGIE`; dacă e completat, dar fără alergie, și conține unul dintre cuvintele astm / epilep / diabet / inhalator → `MEDICAL`; altfel, fără etichetă.
- **Fără date de contact.** Pe foaie nu apar telefoane, nume de părinți sau adrese. Contactul de urgență îl au alte persoane, nu educatorul.

## 3. Butonul din Prezența
- „Foi pe săptămână”: în **Ziua** stă în bara de filtre, la dreapta legendei (antetul e plin cu salvarea și anularea); în **Luna** stă în antet, înainte de „Tipărește luna” (fostul „Tipărește” se redenumește). **Lunea** e buton principal (portocaliu plin); în celelalte zile e contur portocaliu 1.5px, text `#a34f00`. O singură comandă de tipărire scoate toate foile selectate (câte o `.sheet` cu `page-break-after: always`).

## 4. Fereastra (18c) — `Dialog` 480px
```
Foi de prezență pe săptămână
O foaie A4 orizontală pentru fiecare grupă.

Săptămâna   [‹  28 sep – 2 oct 2026  ›]        (implicit: săptămâna curentă, luni–vineri)
Grupe · 7 din 7                    Toate  Niciuna
[✓ Albinuțe 11] [✓ Buburuze 0] [✓ Fluturași 9] …   (pastile în culoarea grupei; neselectat = alb, „+”)

┌ 16 rânduri pe foaie
│   Rândurile neocupate rămân libere pentru copii noi. Peste 16 copii, grupa trece pe a doua foaie.
│ [✓] Alergii și detalii importante
│ [✓] Notițe pe zile
└
<mesaj despre grupa din previzualizare>      [Anulează]  [Tipărește N foi]
```
- `N foi` = Σ `max(1, ceil(copii/16))` pe grupele selectate. Fără grupe selectate, butonul e gri și dezactivat: „Alege o grupă”.
- Mesajul se schimbă după grupă: „Mars: 14 copii + 2 rânduri libere · 1 foaie”; „Buburuze nu are copii: doar rânduri libere.”
- Deasupra previzualizării (în aplicație: în dreapta ferestrei, micșorată) sunt filele grupelor selectate; un clic schimbă foaia afișată.
- Alegerile (opțiunile, nu săptămâna) se țin minte: `usePersistedState('attendance.weeklySheet', {...})`.

## 5. Foaia (18d) — 297×210 mm, `@page { size: A4 landscape; margin: 0 }`
Pe ecran are 1123×794 px, padding `28px 34px 22px`, flex vertical, gap 12.
1. **Antet:** logo 28px | „Prezența · Grupa Mars · 28 septembrie – 2 octombrie 2026” (Baloo 22) + „Educator principal: Ala Ursu · Asistent: Doina Popa · 14 copii · 5–6 ani” (11px). În dreapta: filiala (bold) și legenda „Scrie: ✓ prezent · A absent · M motivat”. Linie de 2px `#ef8a1d` dedesubt.
2. **Tabel:** coloanele `22px | Copil 1.3fr | Alergii · detalii 1.7fr | Luni…Vineri 5×84px`. Fără detalii, zilele devin `minmax(84px,1fr)`.
   - Cap de tabel: 9px uppercase 800, border-bottom 1.5px `#3a4750`. Fiecare zi are numele și data („Luni / 28.09”).
   - **Exact 16 rânduri:** copiii, apoi rânduri libere până la 16. Rândurile au 29px (34px fără notițe), border-bottom 1px `#c9c4ba`, iar rândurile pare au fundal `#f6f4f0`.
   - Rândul copilului: nr. (gri), nume (800) + vârsta „5a 2l” (9px gri), apoi detalii. Eticheta `ALERGIE`/`MEDICAL` e încadrată cu 1.5px `#3a4750`, iar textul de lângă ea e îngroșat. Fără detalii apare „—”.
   - Rândul liber: text gri 9px, aliniat jos: „Nume, prenume (nu e în aplicație)” · „Alergii / detalii”.
   - Celulele zilelor sunt goale, cu border-left 1px `#3a4750`.
3. **Notițe educator** (dacă sunt bifate): titlu 9px uppercase „Notițe educator · ce s-a întâmplat, cine a plecat mai devreme, cine a preluat copilul”. Dedesubt, 5 coloane (Luni 28.09 … Vineri 02.10), liniate la 22px, care ocupă restul foii.
4. **Subsol** 9px: „Detaliile vin din fișa copilului. Foaia rămâne în grupă.” · „Semnătura educatorului ____” · „Introdus în aplicație ☐” · „tipărit 28.09.2026, 07:40”.
- Alb-negru lizibil: nimic nu depinde doar de culoare.
- Peste 16 copii, a doua foaie are același antet, rândurile 17–32 și notițele, doar pe ultima foaie.

## 6. Teste
- 14 copii → 14 rânduri cu nume + 2 libere; 0 copii → 16 libere; 20 de copii → 2 foi, notițe doar pe a doua.
- Fără „Alergii” → coloana lipsește și zilele se lățesc.
- Niciun număr de telefon în DOM-ul foii (test explicit).
- Numărul de foi din buton se potrivește cu foile randate.

## 7. Criterii de acceptare
- [ ] Butonul e principal lunea și secundar în celelalte zile
- [ ] O foaie pe grupă, A4 orizontal, exact 16 rânduri
- [ ] Ordinea copiilor e aceeași ca în Prezența → Ziua
- [ ] Nu apar date de contact
- [ ] Opțiunile se țin minte; săptămâna revine la cea curentă
- [ ] Printul arată la fel ca în `#18d` (fără meniu, fără antetul aplicației)
