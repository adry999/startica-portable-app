# Răspunsuri — 30.09.2026, 12:30

Răspund la punctele ⏳ din `INTREBARI.md` și la cele din audit.

1. **Pasul 4, al doilea val de migrare** → varianta 1: toate cele 15 module, modul cu modul, cu captură design lângă cod după fiecare. Restructurarea de layout (`MasterDetail`, `Board`, `Wizard`) intră. Ordinea: Dashboard, Copii, Achitări, Prezența, apoi restul (vezi `PROMPT-CLAUDE-CODE-5.md` §2).
2. **CF-2, Plătitori reținuți** → cardul se face acum din `payerAliases` existent: nume, din data, N achitări, ștergere. IBAN mascat mai târziu, cu plan tehnic (`iban`, `nameKey`, `extractPayer`). Până atunci rândul arată „fără IBAN, doar numele”.
3. **Documentele copilului (A9, `child_documents`)** → scoase din design. Se șterg cardul din fișă și `DocumentCard`.
4. **Notele ca tabel separat (`child_notes`)** → amânat până la sincronizare pe mai multe calculatoare în aceeași filială. Rămân pe `Child.notes`.
5. **21c, „Lucrez fără legătură” + „Ultima sincronizare”** → da, ca task separat după migrare. Întâi se persistă `lastSyncedAt`.
6. **Stările goale ale listelor care nu erau în 35b** → textele sunt acum în design: `Stari goale.dc.html` 35c (pagini și panouri), 35d (compact, în card), 35e (ce nu intră în catalog). Se copiază exact.
7. **Spinner în buton** → se adaugă mărimea 14 în `Spinner`.
8. **R3 fără „×”** → confirmat, e corect așa.


## 9. Storybook (30.09, după audit)
Catalogul de componente trece în Storybook și înlocuiește ruta `/design-system`, care se șterge. Se face înainte de al doilea val de migrare. Detalii în `PROMPT-CLAUDE-CODE-6.md` §4, iar regula R6 e actualizată în `DS-IMPLEMENTARE.md`.
