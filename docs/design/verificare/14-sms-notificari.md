# 14 — SMS și Notificări — val 2, pe design system

**Referință:** `docs/design/screens/14-sms.md` (11a Mesaje SMS, 11b Șabloane și furnizor), `docs/design/screens/12-administrare.md` §10b (Notificări — fila „Canale", care e cea proprie acestui ecran; „Mesaje SMS"/„Șabloane" sunt spec 14). `Sms.dc.html#11a`, `#11b`; `Administrare.dc.html#10b`.

## Stare la intrare în val 2

Modulul era deja aproape complet migrat, singurul din val 2 cu o listă de excepții atât de îngustă (3 intrări, pe două fișiere din cinci): `NotificationsPage.tsx` (comutator `Canale · Mesaje SMS · Șabloane` din `SegmentedControl`, card Telegram + listă de comutatoare `Toggle`/`Checkbox`, toate din `@shared/ui`), `SmsMessagesPanel.tsx` (jurnal `DataTable`, statistici `Card`, panou de detaliu, dialogul „SMS nou" și `SmsConfirmDialog` pentru retrimitere), `SmsNewMessageDialog.tsx` (compunere destinatar/text liber sau șablon, `SearchSelect`/`TextArea`/`TextField`), `SmsProviderCard.tsx` (card furnizor SMS, cheie API mascată) și `SmsTemplatesPanel.tsx` (listă șabloane + editor + previzualizare `SmsSegmentCounter`) foloseau deja componentele corecte din `@shared/ui`/`@shared/sms`, `formatDateTime`/`formatMoney`/`formatMonthLabel`/`formatMonthName` din `#shared/format/*.mjs`, și nicio iconiță-caracter sau import `lucide-react` direct.

## Ce s-a schimbat în această trecere

- **`SmsTemplatesPanel.module.css`**: `.row { background: #fff; }` → `background: var(--white);` (tokenul există deja în `tokens.css`, valoare identică). Singura încălcare R2 fixabilă găsită în tot modulul.
- **`architecture.test.ts`**: comentarii adăugate pe cele două excepții existente (`notifications/SmsTemplatesPanel.module.css` în R2, `notifications/SmsMessagesPanel.tsx` în R9 text) ca să explice exact ce rămâne și de ce, fără să adaug intrări noi.

## Ce a rămas neschimbat, cu motiv

- **R2 — `SmsTemplatesPanel.module.css`, `.rowActive { box-shadow: inset 4px 0 0 var(--orange); }`** (bara activă de 4px a șablonului selectat): exact shorthand-ul deja acceptat în `notify/NotifyPage.module.css`/`payments/PaymentsByMonth.module.css`/`review/ReviewPage.module.css` pentru aceeași afordanță „rând activ" — regexul cere ca valoarea să *înceapă* cu `var(...)`, ceea ce acest shorthand pe patru valori nu poate face. Rămâne singur motiv pentru care fișierul rămâne în R2 `ALLOWED` (hex-ul de mai sus a fost fixat).
- **R9 — `SmsMessagesPanel.tsx`, `emptyState={<p>Niciun SMS pentru filtrele alese.</p>}`**: stare „fără rezultate" pentru tabelul jurnalului SMS filtrat (segment/căutare/șablon/perioadă) — header-ul `empty-states.ts` exclude explicit acest caz din catalog („„Fără rezultate" (căutare/filtre active) NU e în acest catalog — are prioritate peste orice cheie și textul ei e generic, generat direct de consumator"), exact ca `assign/AssignPage.tsx`/`groups/GroupsBoard.tsx`. Rămâne în R9 `TEXT_ALLOWED`.
- **R9 — `NotificationsPage.test.tsx`**: linia `expect(screen.getByText('Niciun SMS pentru filtrele alese.'))` doar menționează în test textul de mai sus, ca să verifice starea fără rezultate — mențiune de test, nu text nou de UI; exceptare permanentă, ca celelalte `*.test.tsx` din listă.
- **`NotificationsPage.tsx`, `{ value: 'never', label: 'Niciodată' }`**: opțiune de `Select` (cadența „Restanțe"), nu stare goală — exclusă direct de `EMPTY_TEXT_EXEMPT_LINE_PATTERN` (`label:`), nu apare deloc ca violare, nu are nevoie de excepție.
- **`SmsNewMessageDialog.tsx` vs. `SmsConfirmDialog`**: verificat explicit dacă ar trebui unificate — sunt fluxuri genuin diferite. `SmsConfirmDialog` (folosit deja pentru „Retrimite" din panoul de detaliu, `mode="single"`) confirmă un destinatar/lot deja rezolvat, cu cost și sold. `SmsNewMessageDialog` („+ SMS nou") *compune* mesajul: alege destinatarul (din aplicație sau alt număr), alege șablon sau text liber, poate salva ca șablon nou — un formular, nu o confirmare. Separarea actuală e corectă, nimic de schimbat.

Nimic altceva de reparat: niciunul din cele cinci fișiere `.tsx` nu avea taguri brute R1 (`<input>/<select>/<textarea>/<button>/<table>/<dialog>`), caractere-iconiță R3, import `lucide-react` direct (R4) sau `toLocaleDateString`/`toLocaleString`/`toFixed` brut (R7) — `formatDateTime`/`formatMoney`/`formatMonthLabel`/`formatMonthName` erau deja folosite peste tot unde era nevoie. Niciun `EmptyState` nou importat (R9 `IMPORT_ALLOWED`) — modulul nu are stări „goală de listă" de tipul `first`/`done`/`period` din catalog, doar stări „fără rezultate la filtrare", care sunt explicit în afara catalogului.

## Verificare

- `npx tsc --noEmit -p .` — o singură eroare, în `pool/MonthView.tsx` (`'formatDateTime' is declared but its value is never read`), fișier al altui modul aflat concurent în lucru — nimic în `notifications/`.
- `npx vitest run src/features/notifications src/architecture.test.ts` — 7/7 fișiere, 39/39 teste `notifications/`; `architecture.test.ts` a oscilat tranzitoriu (alte sesiuni editează concurent aceeași listă de excepții pentru `pool/`, `report/`, `backup/`, `personal/`, `visits/` — niciodată pentru `notifications/`) și a revenit verde de fiecare dată când am rulat izolat imediat după.
- `npx vitest run src/features/notifications` (izolat, fără `architecture.test.ts`) — verde, 7/7 fișiere, 39/39 teste.
- `npx vitest run` (webapp, complet) — 245/249 fișiere, 1348/1352 teste; cele 4 eșecuri sunt în `app/App.test.tsx`, `attendance/AttendancePage.test.tsx`, `visits/VisitsPage.test.tsx` (×2) — module în lucru concurent la alte sesiuni, nimic în `notifications/`.
- `npm run check` (root) — `format:check` a semnalat inițial `architecture.test.ts` nealiniat cu Prettier (alte sesiuni adăugaseră intrări fără `prettier --write`); rulat `npx prettier --write webapp/src/architecture.test.ts` — a reformatat tot fișierul (conținutul altor sesiuni inclus), fără nicio schimbare semantică; comentariile proprii au rămas intacte după reformatare.
- `architecture.test.ts`: nicio intrare scoasă din excepții (`SmsTemplatesPanel.module.css` rămâne în R2 din cauza `box-shadow`-ului, `SmsMessagesPanel.tsx`/`NotificationsPage.test.tsx` rămân în R9 din motive documentate mai sus); niciun fișier `notifications/` nou adăugat în vreo listă; doar comentarii pe cele două excepții existente.

**Captură 1440×900 vs. artboard:** efectuată 01.10 — `14-sms-notificari.png` (stânga artboard, dreapta aplicația reală, fila „Mesaje SMS” deschisă explicit, pe copie izolată de date — §3). Diferențe vizuale: doar date de test; modificarea `#fff` → `var(--white)` e identică la pixel.
