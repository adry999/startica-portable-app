# §6 (F19) — Subsolul formularelor, unificat — Plan scurt

**Sursă:** `docs/design/PROMPT-CLAUDE-CODE-11.md` §6, design 15k.

**Scop:** `Drawer`/`Dialog` primesc un `footer` structurat în loc de JSX liber, aplicat pe toate cele ~24 folosiri din `features/**`.

## API nou
```ts
footer?: {
  primary: { label: string; loading?: boolean } & (
    | { disabled?: false }
    | { disabled: true; disabledReason: string }
  );
  onCancel?: () => void;           // implicit = requestClose, eticheta "Anulează"
  footerStart?: ReactNode;         // bifă/notă, include "N erori" (roz, focus pe primul invalid)
}
```
Ordine fixă: `[footerStart] … Anulează · Principal`. `loading` → eticheta „Salvez…”, ambele butoane inactive.

## Pași
1. `Drawer.tsx`/`Dialog.tsx`: adaugă noul tip de `footer` **alături** de `ReactNode` existent (migrare treptată, fără big-bang) — sau, dacă regula de arhitectură cere interzicerea JSX liber, schimbă tipul direct și migrează toate cele 24 folosiri în același commit (mai sigur, fără stare intermediară ambiguă).
2. `grep -rn "footer={" webapp/src/features` — listă completă, migrează fiecare la noul API, etichetă principală per ecran („Salvează copilul”, „Salvează · {sumă}”, etc.).
3. Mută „N erori” din bandă separată în `footerStart`.
4. Regulă nouă `architecture.test.ts`: niciun `footer={` cu JSX liber în `features/**` (verifică via regex pe sursă, ca regulile R1–R9 existente).
5. Storybook: `Drawer`/`Dialog` cu footer nou, stare `loading`, `disabledReason`, `footerStart`.
6. Captură: Copil nou, Achitare nouă, Cheltuială, Grupă, Concediu, Avans — subsol identic.

## Ordine de execuție
Rulează **după** grupul 1 (formularele își primesc conținutul nou din §1/§2/§5/§18/§19 întâi) — ca să nu se rescrie subsolul de două ori pe același fișier.

## Verificare
`cd webapp && npx tsc --noEmit -p . && npx vitest run` (toate testele de formular ating subsolul).

## Constrângeri
Un commit (migrarea e atomică — 24 de fișiere pe un API nou nu se poate face parțial fără să spargă testele intermediare); fără atribuire AI.
