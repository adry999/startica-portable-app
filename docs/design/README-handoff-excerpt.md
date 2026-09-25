# Handoff design → cod (extras) — `master-v2`

Extras din `design_handoff_startica_redesign/README.md` (proiect claude.ai/design "Startica V2"), citit direct din browser 2026-09-25 — nu toată secțiunile per-ecran (liniile ~49-192) au fost salvate încă, doar intro + tabelul de mapare fișiere. Pentru detalii vizuale per ecran (Copii, Grupe, Vizite, Achitări, Cheltuieli, Situația plăților, De notificat, Taxe și grupe, De verificat, Asociere achitări, Istoric, Notificări, Backup și setări, Formulare), redeschide proiectul și citește secțiunea corespunzătoare înainte de a implementa ecranul respectiv.

Link proiect: https://claude.ai/design/p/48bf3ace-a7af-4f08-acd9-58b3091919a2?file=Set+final.dc.html

## Reguli generale (se aplică pe orice ecran)

- Referințele sunt fișiere `.dc.html` (Design Components) — arată aspect/comportament, **nu sunt cod de copiat**. Se recreează în `webapp/` cu componentele din `@shared/ui` (`Badge`, `Card`, `SegmentedControl`, `Drawer`, `ToastProvider`/`useToast`, `DataTable`, `MonthPicker`) și tokenii din `webapp/src/shared/tokens/tokens.css`.
- Logica rămâne în hook-urile existente (`useChildren`, `usePayments`, `useDashboard`…). Nu se schimbă backend-ul, baza de date sau calculele.
- **Vezi `CORECTII-master-v2.md` primul** — se aplică înainte de orice ecran nou.
- Valorile de culoare dintr-o secțiune se referă **doar** la elementul numit (label, link), nu la tot cardul/elementul. Cifrele mari sunt mereu `#3a4750`. Cardurile colorate sunt plate (fără umbră); cardurile albe au border `#ede7dc`, fără umbră.
- Fidelitate: **high-fidelity** — culori, tipografie, raze, spațiere și copy sunt finale. Datele din mock sunt exemple, se folosesc datele reale.

## Variante alese (sursa de adevăr)

| Ecran | Id | Fișier design |
|---|---|---|
| Dashboard | 1a | Dashboard.dc.html#1a |
| Copii (listă) | 1c | Copii.dc.html#1c |
| Fișa copilului | 1e | Copii.dc.html#1e |
| Grupe | 1g | Grupe.dc.html#1g |
| Vizite | 2a | Operatiuni.dc.html#2a |
| De notificat | 2b | Operatiuni.dc.html#2b |
| Achitări | 1i (Tabel) + 1j (Pe luni) | Achitari.dc.html |
| Cheltuieli | 1k (Tabel) + 1l (Pe zile) | Cheltuieli.dc.html |
| Situația plăților | 1m (Lună) + 1n (An școlar) | Situatia.dc.html |
| Taxe și grupe | 2c | De rezolvat.dc.html#2c |
| De verificat | 2d | De rezolvat.dc.html#2d |
| Asociere achitări | 2e | De rezolvat.dc.html#2e |
| Istoric / Notificări / Backup și setări | 2f / 2g / 2h | Administrare.dc.html |
| Formulare (copil, achitare, cheltuială) | 3a / 3b / 3c | Formulare.dc.html |
| Confirmări / liste goale / salvare | 3d / 3e / 3f | Formulare.dc.html |

Ignoră variantele neselectate (1b, 1d, 1f, 1h). Meniul lateral: varianta „a" (alb) peste tot.

## Shell global

- **Sidebar** (`Sidebar.dc.html`, varianta `a`): lățime 248px, fundal `#fff`, `border-right: 1px solid #ede7dc`, padding `26px 16px 18px`, gap 22px între blocuri. Logo `startica-logo.svg` la 38px înălțime, versiunea (`v1.6.3`, 11px, 700, `#9aa3a9`) aliniată dreapta pe aceeași linie.

## Assets

- `webapp/public/assets/startica-logo.svg`, `startica-icon.svg` (servite la `/assets/...`).
- Fonturi: Baloo 2 și Nunito — locale în `webapp/public/assets/fonts/`, declarate în `tokens.css`.
- Iconițe: doar caractere text (glife unicode), fără set de iconițe noi.

## Maparea pe fișiere din repo (`master-v2`, rădăcina `webapp/src/`)

**Shell**
- `app/shell/Sidebar.tsx` + `.module.css`, `nav-items.ts` — meniul lateral (gata; ajustare logo/versiune).
- `app/shell/Topbar.tsx` + `.module.css` — antet, căutare globală Ctrl K, selector lună.
- `app/shell/SaveStatusCard.tsx` + `.module.css`, `save-status.ts` — cardul de salvare (3f).
- `app/shell/AppShell.tsx`, `app/App.tsx`, `routes.ts` — layout, rute, contoare sidebar.

**Componente comune (`shared/ui/`)**
- `Card` (KPI, raze 20-24, cerc decorativ), `Badge` (tonuri statut/categorii), `SegmentedControl` (comutatoare Tabel/Pe luni, filtre Activi/Arhivați), `DataTable` (filtre în cap, selecție, paginare), `Drawer` (3a/3b/3c), `Toast` (3d), `MonthPicker`.
- **De adăugat**: meniul ⋯ pe rând, bară de selecție, dialog ștergere „Scrie ȘTERGE", stări goale (3e).

**Ecrane (`features/`)**

| Ecran | Id | Fișiere |
|---|---|---|
| Dashboard | 1a | `dashboard/DashboardPage.tsx`, `useDashboard.ts` |
| Copii + fișa | 1c, 1e | `children/ChildrenPage.tsx`, `useChildren.ts`, `useChildProfile.ts`, `ChildrenCsvDialog.tsx` |
| Copil nou | 3a | `children/ChildFormDrawer.tsx`, `child-form.ts` |
| Grupe | 1g | `groups/GroupsPage.tsx`, `useGroups.ts` |
| Vizite | 2a | `visits/VisitsPage.tsx`, `VisitFormDrawer.tsx`, `EnrollDrawer.tsx`, `useVisits.ts` |
| Achitări | 1i, 1j | `payments/PaymentsPage.tsx`, `usePayments.ts` |
| Achitare nouă | 3b | `payments/PaymentFormDrawer.tsx`, `payment-form.ts` |
| Cheltuieli + 3c | 1k, 1l, 3c | `expenses/ExpensesPage.tsx`, `useExpenses.ts` |
| Situația plăților | 1m, 1n | `status/StatusPage.tsx`, `useStatus.ts` |
| De notificat | 2b | `notify/NotifyPage.tsx`, `useNotify.ts` |
| Taxe și grupe | 2c | `fee-setup/FeeSetupPage.tsx`, `useFeeSetup.ts` |
| De verificat | 2d | `review/ReviewPage.tsx`, `useReview.ts` |
| Asociere achitări | 2e | `assign/AssignPage.tsx`, `useAssign.ts` |
| Istoric | 2f | `audit-log/AuditLogPage.tsx`, `useAuditLog.ts` |
| Notificări | 2g | `notifications/NotificationsPage.tsx`, `useNotificationPreferences.ts`, `useTelegramStatus.ts` |
| Backup și setări | 2h | `backup/BackupPage.tsx`, `ExcelImportDialog.tsx`, `useBackup.ts`, `useRestore.ts`, `useExcelTransfer.ts` |

Fiecare ecran are teste (`*.test.tsx` / `*.test.ts`) — actualizează-le o dată cu markup-ul și rulează `npm test` + `npm run typecheck` în `webapp/`.

## Fișiere în pachetul de design

`Set final.dc.html` (index) · `Sidebar.dc.html` · `Dashboard.dc.html` · `Copii.dc.html` · `Grupe.dc.html` · `Achitari.dc.html` · `Cheltuieli.dc.html` · `Situatia.dc.html` · `Operatiuni.dc.html` · `De rezolvat.dc.html` · `Administrare.dc.html` · `Formulare.dc.html` · `support.js` (runtime pentru a deschide referințele de design) · `web/assets/*` (copii locale ale logo-ului, identice cu `webapp/public/assets/`).

## Funcții noi, "de confirmat" cu utilizatorul înainte de implementare

- Buget pe categorii (Cheltuieli)
- „Anulează" în Istoric (undo pe o acțiune din audit log)
- „Ține minte plătitorul" (checkbox la achitare nouă)
- Confirmare trimisă părintelui (email/notificare la achitare sau la eveniment)
- Atașare bon la cheltuială

Niciuna nu e implementată acum în aplicație — nu se construiesc fără decizie explicită a utilizatorului.
