# Coada de lucru pentru Claude Code

Se lucrează pe rând, în ordinea de mai jos. După fiecare punct:
- rulează `npm run check`;
- bifează criteriile de acceptare din spec;
- fă commit cu mesajul `ui(<ecran>): aliniat la docs/design/screens/<NN>`;
- treci la punctul următor fără să aștepți confirmare.

Te oprești doar dacă:
- un spec contrazice codul existent într-un mod pe care nu-l poți rezolva singur;
- ai nevoie de o decizie de business;
- `npm run check` rămâne roșu după 2 încercări.

În aceste cazuri, scrie întrebarea în `docs/design/INTREBARI.md` și treci la următorul punct care nu depinde de ea.

## Coada
1. **Antet compact:** `00-comun.md` A (Topbar 60px, titlu + eyebrow pe un rând, butoane mai mici). Verifică toate ecranele.
2. **Dashboard:** `08-dashboard.md` (KPI fără zecimale, „Necesită atenție” cu 0 gri, „Vezi calendarul →”).
3. **Fișa copilului:** `09-copii-fisa.md` (header în culoarea grupei, „+ Plată” precompletat, plătitori reținuți).
4. **De notificat:** `10-de-notificat.md`.
5. **De rezolvat:** `11-de-rezolvat.md` (Taxe și grupe, De verificat cu tasta S, Asociere achitări cu „Ține minte plătitorul”).
6. **Formulare și stări:** `13-formulare.md` (Drawer comun, ConfirmDeleteDialog „Scrie ȘTERGE” în locul `window.confirm`, liste goale, cardul de salvare).
7. **Administrare:** `12-administrare.md` (Istoric, Notificări, Backup și setări cu filele Import și export + Grădinița; Import CSV doar aici).
8. **Tipărire:** `15-tiparire.md` (confirmare de plată A5, situația A4; ruta confirmării înainte de `/achitari/:paymentId`).
9. **Curățenie R5–R7 din roadmap:** `Button` și `SearchInput` comune, comentarii și nume.
10. **Faza 4, moneda EUR/BNM:** scrie întâi planul după `16-planuri-eur.md` în `docs/superpowers/plans/`, apoi implementează.
11. **Faza 5, SMS:** scrie întâi spec-ul (sms.md, după `14-sms.md` și README „Notificare SMS”), apoi planul, apoi codul.

12. **Faza 6, două filiale:** scrie întâi planul tehnic după `17-filiale.md` (date separate pe filială, selector în Sidebar). 
13. **Faza 16b, sincronizare:** după 12, scrie spec-ul tehnic și planul după `18-sincronizare.md` (server de reconciliere, local-first, conflicte), apoi implementează.

## Stadiu — coada fină din RASPUNSURI.md „Coada, continuare”

- **8 (EUR/BNM UI):** DONE 2026-09-27 — fila Curs valutar (12a), selector în `PaymentFormDrawer` (12b), monedă în Taxe și grupe (12g) + Copil nou (3a), € pe fișa copilului (12d), pastilă curs pe Dashboard (12f). Commit-uri `fc25d06`, `5f94422`. Rămân **12c** (Situația plăților €, în punctul 10) și **12e** (Confirmarea de plată €, în punctul 15) — se fac odată cu ecranele lor, nu separat.
- **9b (SMS P1):** DONE 2026-09-27 — toate cele 21 de taskuri din plan implementate (shared domain, storage, client sms.md, orchestrare trimitere, rute, webapp: hooks + dialog + Notificări + De notificat). `npm run check` + `webapp` typecheck/test + `npm run test:e2e` verde. P3 (jurnalul „Mesaje SMS”, „Retrimite”) și P2 (dialogul din Situația plăților) rămân neimplementate, cum era planificat.
- **10 (Situația plăților completă):** DONE 2026-09-27 — toate cele 10 taskuri din plan implementate (obligation().currency, evaluare an școlar, cardurile lunii, harta 12 luni, antet compact Lună/An școlar). `npm run check` + webapp typecheck/test verde. „Notifică”/„Notifică toți” rămân vizibile, dezactivate — SMS P2, plan separat.
- **11 (curățenie):** DONE 2026-09-27 — R6 (ștergerile folosesc „Scrie ȘTERGE”; confirmarea de plată duplicată rămâne `window.confirm`, nu e ștergere), R7 (nume generice eliminate), R10 (ChildrenPage/ExpensesPage împărțite), `Button`/`SearchInput` comune (20 + 4 fișiere). **R9 (rute per feature) NEFĂCUT** — schimbare de arhitectură, nu mecanică; de decis separat.
- **12 (Încărcare):** DONE 2026-09-27 — StartupScreen, Skeleton/LoadingState peste tot, ecranul de 15 s (fără „Lucrez fără legătură”, vezi INTREBARI.md).
- **13 (Prezența):** DONE 2026-09-27 — plan `docs/superpowers/plans/2026-09-27-prezenta.md`; tabel `attendance` separat, vederi Zi/Lună, secțiunea din fișă; nu atinge taxele.
- **14 (Raport contabil):** DONE 2026-09-27 — `/raport`, export Excel/PDF; fără selector de filială (INTREBARI.md).
- **15 (Confirmarea de plată):** DONE 2026-09-27 — fila Grădinița (16a), A5 și A4 1/3+2/3 (16b, 16g), numerotare, sumă în litere, Situația tipărită (16c; fără „Pagina N din M”, Chrome nu știe numărul total de pagini).
- **Extra (cerut 2026-09-27):** istoricul cursului BNM se completează retroactiv la pornire; iconiță ↗ spre pagina BNM a zilei lângă fiecare curs afișat.
- **FEEDBACK 27.09 (Prezența, Raport contabil):** DONE 2026-09-27.
- **Design system:** DONE 2026-09-27 — `/design-system` (doar dev) + build static pentru Vercel (`npm run build:design-system`, rădăcina `webapp`); nepublicat încă.
- **Faza 6 — filialele:** DONE 2026-09-27 — plan `docs/superpowers/plans/2026-09-27-filiale.md`; câte o bază + folder de backup pe filială, registru `filiale.json`, instalarea existentă = filiala 1 (fără mutări), selector în meniu, dialog pentru formular nesalvat, fila Filiale, „Ambele” în exportul Raportului contabil, Telegram pe filiale.
- **După 12–15:** Faza 6 — filialele (`17-filiale.md`), apoi sincronizarea (`18-sincronizare.md`), confirmat de utilizator 2026-09-27. La filiale se revin deciziile provizorii din `INTREBARI.md` (selectorul de filială din exportul Raportului contabil, pasul „Sincronizez” de la pornire).

## Etapa 0 — baza comună (URMATORUL-PAS.md, sync 28.09 11:06) — DONE 2026-09-28

Toate cele 4 puncte închise, `npm run check` + webapp typecheck/test verzi (137 fișiere, 727 teste) după fiecare:

- **0.1 Shell/z-index:** DONE — scara `--z-sticky/--z-drawer/--z-popover/--z-toast/--z-dialog` în `tokens.css`; `.sidebar` (sticky) + `BranchSelector` (portal), `Drawer`, `Toast`, `RowMenu`, `ConfirmDeleteDialog`, `SmsConfirmDialog`, `MonthPicker`, `SearchSelect` migrate pe variabile, înlocuind valorile ad-hoc (900/1000/1/20/500). Commit-uri `e9d3647`, `757c7f9`.
- **0.2 ScrollArea:** DONE — componentă nouă `shared/ui/ScrollArea` (bară 3px/5px hover, pistă invizibilă, tragere, umbră de continuare), pusă în `.nav` din meniul lateral. Doar sidebar-ul acum — dropdown filială/Drawer/RowMenu/tabele rămân cu scroll nativ, adoptare separată la nevoie. Commit `f772742`.
- **0.3 Antet comun T-1…T-6:** verificat — deja aliniat la `00-comun.md` A (Topbar.tsx/css, nav-items.ts, AppShell.module.css au deja valorile din spec; auditul descria o stare de cod mai veche). Niciun commit necesar.
- **0.4 Bug Prezența:** DONE — `markGroupPresent` folosește `changesToMarkUnmarkedPresent` (doar nemarcații), buton dezactivat la 0 nemarcați, text „Nemarcații (N) → prezenți”. Commit `c7cab97`.

Extra rezolvat din FEEDBACK 28.09 în aceeași trecere (nu erau în Etapa 0, dar mecanice și mici): A5 indicator de salvare Prezența (`e2dc022`), A6 toast „Anulează” la arhivarea unei vizite (`072edb9`). A7 (monedă + pastilă curs) era deja DONE din 27.09, confirmat.

## Modulul 1 — Dashboard (URMATORUL-PAS.md) — DONE 2026-09-28

Delegat unui subagent Sonnet (spec complet: 08-dashboard.md + AUDIT-UI 2.1 D-1…D-4), verificat pe disc (diff + tsc + vitest, nu doar raportul agentului) înainte de commit `8b248d1`.

- **D-1:** DONE — CTA-ul „Necesită atenție” ascuns când `count===0 && !forceShow`.
- **D-2:** DONE — un chip per copil la zilele de naștere (`flatMap`, nu grupat pe zi cu virgulă).
- **D-3:** DONE — hex literali → tokeni (`--muted`, `--orange-bar-past`, `--sand`, `--neutral-softer`); primii 3 tokeni noi existau deja în `tokens.css` (altă sesiune concurentă); `--muted` (#6b7780) nu e o potrivire exactă pt. #5b666e original, dar e cea mai apropiată din scară — diferență imperceptibilă.
- **D-4:** DONE — „+ Adaugă cheltuială” deschide direct formularul (`onNavigate('expenses', {nou:'1'})` + `useSearchParams` în `ExpensesPage`, curăță parametrul după deschidere).
- **Extra (criteriul „KPI fără zecimale”):** `formatKpiMoney` local în `DashboardPage.tsx`, nu schimbă `formatMoney` global (folosit în ~30 de fișiere cu semnătură diferită).
- Cele 4 criterii de acceptare din `08-dashboard.md` — toate bifate. `useDashboard.ts`/`useDashboard.test.ts` neatinse.
- `npm run typecheck` + `vitest run` (137 fișiere, 730 teste) + `prettier --check` — toate verzi, verificat independent.

## Modulul 2 — Copii, listă + fișă (URMATORUL-PAS.md) — DONE 2026-09-28

Delegat unui subagent Sonnet (spec: 02/09-copii*.md + AUDIT-UI 2.2/2.3). Verificat pe disc — rulat concurent cu Modulul 3, izolat prin `git add` doar pe fișierele proprii (fără `git stash`, blocat de sandbox pe fișiere active ale altei sesiuni); scop de teste `children/` + `RowMenu` (53/53 verde) în loc de tsc pe tot arborele, ca să nu prind erorile tranzitorii ale Modulului 3 încă în lucru. Commit `fd6a128`.

- **C-1…C-3, C-5…C-10:** DONE — bordură toolbar, căutare pe părinte/telefon, „Toți” fără număr, badge „Fără grupă”, „ziua N”, antet „Plată <lună>”, `EmptyState` + filtre active, „Mută în grupă” ca `RowMenu` (prop nou `trigger`, backward-compatible), reset paginare pe `key`.
- **C-4, C-11:** SKIP — [decizie], neschimbate.
- **CF-1, CF-3, CF-5, CF-6, CF-8, CF-9, CF-10:** DONE — hero în tonul grupei, card Grupă cu `SearchSelect` inline, sold/taxă cu al treilea rând, „Tipărește confirmarea” ca `RowMenu`, titlu 18px, `--muted`, „Născut”.
- **CF-2 (Date personale, Plătitori reținuți), CF-7 (Documente):** BLOCAT/SKIP — lipsesc din modelul de date, întrebare în `INTREBARI.md`.
- **CF-4 (Note):** PARȚIAL — buton „+ Notă” adăugat; lista cu dată per notă rămâne blocată (`Child.notes` e un singur string, nu o listă) — aceeași categorie ca CF-2, de reluat cu decizia de schemă.

**Următorul:** Modulul 3 — Grupe v2 (`03-grupe.md`, înlocuiește G-1…G-16 din audit) — în lucru, rulează concurent cu ce precede (fișiere disjuncte din `features/groups/`, plus `record-types.d.mts`/`tokens.css` comune). Delegat la subagent Sonnet cu arhitectura deja decisă (câmpuri `order`/`tone` pe `Group`, fără endpoint nou — `/api/record` existent, DnD nativ existent din `GroupsBoard.tsx`), eu verific + commit la final.

**După Modulul 3:** Modulul 4 — Personal (`Personal.dc.html`, `24-personal.md`).
