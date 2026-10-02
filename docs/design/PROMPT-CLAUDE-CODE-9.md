# PROMPT-CLAUDE-CODE-9 — 02.10

Copiază `design_final_startica/` peste `docs/design/` (PROMPT-8 e deja în `arhiva/`). Citește întâi `RASPUNSURI-02-10.md`, `FEEDBACK-01-10.md` (tabelul Stare), `COMPONENTE.md` §3c și `INTREBARI.md` din repo. La §0, compară diff-ul pachetului cu `docs/design/` înainte de suprascriere (vezi incidentul din INTREBARI 01.10). Fiecare punct: test + captură; ce nu se închide intră în `INTREBARI.md`.

## §1 Decizii de aplicat (mici)
1. `DEFAULT_RELEASE_REPO = 'adry999/startica-releases'` (`src/config/environment.mjs`); `scripts/release.mjs` publică acolo. Nu publica nimic fără `--execute`.
2. Cod „P” vizibil: `timesheet` grilă + tipar + legendă (`personal/` grilă, `timesheet-rules.ts`). Literă „P”, `--mint-soft`/`--mint-ink`.
3. Raport contabil EUR — păstrat; bifează F9 ca închis în `FEEDBACK-01-10.md`.
4. F11 — rămâne doar taxa lunii; închide punctul în INTREBARI.

## §2 Strat client profiluri (§5.3, 36a–36f) — ordinea din `screens/31-profiluri-calculator.md`
- `ModuleGuard` în `App.tsx`, citește profilul din `/api/session`; rută interzisă → starea goală `profil.blocked` (36f).
- Meniu filtrat (`nav-items.ts`), grupe goale ascunse; card sincronizare „Profil X · acces limitat” (36d).
- Fișă copil doar-citire pe profil restrâns (36e).
- Pairing cu alegere profil + matrice Personalizat (36a/36b); listă calculatoare cu coloana Profil + „Schimbă” (36c).
- Test arhitectură client: fiecare rută are `moduleId` și trece prin `ModuleGuard`.
- **Nu șterge date locale la restrângere** (decizie 02.10). Doar ascunde.

## §3 Reguli Drawer/Dialog (44d)
Lățimi 620/480/440 ca tokeni; în `Drawer`/`Dialog` de bază: focus pe primul câmp, Ctrl+Enter = submit, Esc → 40c, subsol fix, focus pe primul câmp cu eroare + „N erori” în subsol, `loading` pe butonul principal. Test arhitectură: fără drawer în drawer. Apoi o trecere prin formularele existente.

## §4 Prima pornire + restaurare (42d UI) — `Prima pornire.dc.html#46a–46d`
- 46a: ecran nou înainte de 20a când nu există date (detectare „fără date” pe server). 3 carduri: Din backup / Alt calculator (14b) / De la zero (20a).
- 46b: previzualizare din `/api/backup-preview` (tabel per bază + total).
- 46c: versiune mai nouă / numărătoare greșită (roșu, blocat) / .db vechi (galben, se poate continua).
- 46d: `BackupPage.tsx` + `useRestore.ts` — după restaurarea unei arhive, dialog fără ×, reîncărcare completă în 5 s; toast după reîncărcare.

## §5 Anulare după salvare (40b) — restul acțiunilor
Leagă `UndoToast` pentru achitare, avans, copil nou, mutare în grupă (tiparul de la cheltuială). Grup frați (44b): reține toate `auditId`-urile, `/api/undo` independent per id, raportează ce a eșuat.

## §6 Istoric — filtre (§14)
Pe `AuditLogPage`: filtre modul / calculator / perioadă lângă `SearchSelect`. Calculatorul vine din §7 (`device_name`); până atunci filtrul arată doar calculatorul local.

## §7 Istoric sincronizat (36g) + PIN per modul (36h)
- 36g: `device_id`/`device_name` pe `audit_changes` (`ensureColumn`), producător în `sync-outbox`, consumator la pull, evenimente `access.*`, fila „Acces”. Test cu două baze push-pull.
- 36h: `pinService` expus în `create-branch-context.mjs`, hook `assertPinUnlocked(moduleId)` în `route-dispatcher.mjs`, `PinGate` pe orice modul din `pinModules`. Salarii nu regresează.

## §8 Curs + planuri în baza comună (F12)
Mută `exchangeRates`/`exchangeRateSources`/`plan-presets` în `create-common-context.mjs`. Script `scripts/migrate/` dry-run implicit: sursa = filiala cu cele mai multe zile de curs; listează divergențele. Backup înainte de `--execute`.

## §9 Migrare `fxRate` plăți vechi (după §8)
Script `scripts/migrate/`: plățile pe taxă EUR fără `fxRate`/`amountEur` primesc cursul BNM al zilei plății din istoricul comun. Dry-run, raport, backup, apoi `--execute`.

## Rămân în afara PROMPT-9
43a Educator, C6–C13, închiderea anului școlar, 426 `SYNC_MIN_CLIENT_VERSION`, redesfășurarea `sync-server` (pas operațional — semnalează la final).
