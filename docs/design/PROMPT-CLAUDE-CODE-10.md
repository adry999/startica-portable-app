# PROMPT-CLAUDE-CODE-10 — 02.10 (după sync 13:25, `master-v2` după `c2c745e` + AUDIT-COD-02-10-B)

Mută `PROMPT-CLAUDE-CODE-9.md` în `arhiva/`. Copiază din pachet doar `FEEDBACK-01-10.md`, `VERIFICARE-DUPA-PROMPT-8.md` și acest fișier; restul din `docs/design/` e mai nou în repo — nu suprascrie. Dacă `COMPONENTE.md`/`DECIZII.md` au fost deja suprascrise: `git restore docs/design/COMPONENTE.md docs/design/DECIZII.md` (versiunea comisă e cea bună; utilizatorul a confirmat). Fiecare punct: test + captură; ce nu se închide intră în `INTREBARI.md`. Nu rula niciun `--execute` pe date reale.

Deciziile marcate „implicit” se aplică așa dacă utilizatorul nu răspunde altfel în `RASPUNSURI-*.md`.

## §1 F4 — autocompletare Chrome
Dacă `VERIFICARE` §„Rămase” e bifat cu „oferă sugestii”: `autoComplete="new-password"` + `name` unic pe Nume copil, Nume/Telefon părinte, Persoane autorizate (`webapp/src/features/children/ChildFormDrawer.tsx`) și pe `PhoneInput` (`webapp/src/shared/ui/PhoneInput.tsx`). Altfel nimic.

## §2 41f — rotunjirea scrie `roundingDiff`
`webapp/src/features/payments/PaymentFormDrawer.tsx` + `payment-form.ts`: sumă cu bănuți → câmp rotunjit; încasat ≠ datorat cu < 1 leu → `roundingDiff` pe plată (schema în `src/shared/domain/record-schema.mjs`, validare ±0,99). Bonul (`PaymentReceipt.tsx`, 42c) citește deja câmpul. Cazurile din `VERIFICARE` §4 (4.922 / 4.920 / 4.900 / 5.000) ca teste.

## §3 41d — mesaje de eroare (`toUserError`)
`webapp/src/shared/app/` (sau `shared/api/`): `toUserError(err)` → text românesc fără coduri (409 = „Altcineva a modificat între timp. Reîncarcă și încearcă din nou.”, rețea, validare cu numele câmpului). Folosit în `Drawer`/`Dialog` errorBanner (`usePanelController.ts`) și în toast-urile de eroare. Test arhitectură: niciun `err.message` brut randat în `features/**`.

## §4 PIN pe ecrane (36h, rest)
- Montează `PinGate` (`webapp/src/shared/app/PinGate.tsx`) pe rutele ale căror module sunt în `profile.pinModules`, din `ModuleGuard.tsx` (un singur loc, nu pe fiecare ecran).
- **Implicit:** blocare după 5 încercări greșite = **15 min**, ca în `screens/31-profiluri-calculator.md` §4 (`LOCKOUT_DURATION_MS` în `src/features/personal/server/pin.service.mjs`; actualizează `pin.service.test.mjs`).

## §5 Istoric sincronizat (36g, goluri)
- `applySnapshotEntry` (`src/features/sync/server/change-applier.mjs`) aplică și `audit_log` prin `mergeSyncedEntry`; instantaneul inițial din `sync-connect.service.mjs` include `audit_log` pentru profil Complet. Test în `tests/audit-log-sync.integration.test.mjs`.
- `access.locked` → banda din 42a pe calculatoarele Complet după pull (`webapp/src/app/shell/sync-status.ts`), fără canal live nou.
- 36c: pastila de profil din `DevicesList.tsx` pe tonul preset-ului (Complet portocaliu, Educator mint, Bazin galben, Personalizat albastru) — `Sincronizare.dc.html#36c`.

## §6 Mărunte
- `Toast.stories.tsx` (singura componentă `shared/ui` vizuală fără poveste).
- `COMPONENTE.md`: `SiblingPaymentRows` (44b) și `BackupContents` (38g) → „inline în `PaymentFormDrawer`” / „înlocuit de `BackupPreviewTable`”. Cardul Backup din 10c (`BackupPage.tsx`) folosește `BackupPreviewTable` pentru „Vezi conținutul”.
- Gardă `if (submitting) return` în `ServicesSettings.tsx`, `VisitFormDrawer.tsx` (Audit B, Scăzut).
- `PaymentFormDrawer.tsx:760-770`: sufix €/lei lângă câmpul de repartizare manuală.

## §7 Luna — copil mutat între grupe (Audit B #4)
**Implicit: varianta 1.** Sub titlul din Luna (18b) și pe foaia săptămânală: „Copiii din grupa de azi” (12px, `--ink-3`) când luna vizualizată nu e luna curentă. Fișiere: `useAttendanceMonth.ts`, `WeeklySheet.tsx`, `WeeklySheetDialog.tsx`. Istoricul de apartenență (`groupHistory`) rămâne neconstruit.

## §8 Actualizări (37a–37d, rest)
- 426 pe `sync-server` pentru `SYNC_MIN_CLIENT_VERSION` + banda roz 42a „Sincronizarea e oprită…”.
- Descărcare în `<home>\Actualizari` + verificare SHA-256; banda verde 42b „Se instalează când închizi aplicația”; coloana Versiune în Calculatoare conectate (`DevicesList.tsx`).
- Fără publicare reală: `scripts/release.mjs` rămâne dry-run.

## La final — pași operaționali pentru utilizator (doar listează-i, nu-i executa)
1. Creează repo public `adry999/startica-releases`.
2. Redesfășoară `sync-server` (profiluri, `audit_log`, 426).
3. Pe o copie (`scripts/dev-data-copy.mjs`): dry-run `exchange-rates-plan-presets-to-common.mjs`, apoi `fxrate-backfill.mjs`; trimite rapoartele. `--execute` pe date reale doar după confirmare.

## Rămân în afara PROMPT-10
43a Educator, C6–C13, închiderea anului școlar, ștergerea datelor locale la restrângere (decis: niciodată), paginare server-side (Audit #4, de urmărit), `groupHistory`.
