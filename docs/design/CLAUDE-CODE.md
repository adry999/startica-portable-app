# Instrucțiuni pentru Claude Code

Copiază acest folder în repo la `docs/design/` (branch `master-v2`), apoi dă-i lui Claude Code promptul de mai jos, pas cu pas. Fă câte un commit la fiecare pas, ca să poți compara după fiecare.

## Pregătire (o singură dată)
```
Lipește conținutul din docs/design/CLAUDE-md-snippet.md în CLAUDE.md din rădăcina repo-ului.
Copiază docs/design/project-conventions.md în .claude/skills/project-conventions/DESIGN.md
și adaugă în SKILL.md o linie care trimite la el. Nu schimba altceva.
```

## Regula de lucru
Pentru fiecare ecran există o specificație explicită în `docs/design/screens/` (vezi `screens/README.md`). Acolo sunt fișierele de creat sau modificat, datele, arborele de componente, CSS-ul exact, stările, testele și criteriile de acceptare. **Un ecran per sesiune.** Spec-ul are prioritate față de `.dc.html`.

## Pasul 1 — componente comune și shell
```
Citește docs/design/screens/00-comun.md și implementează A–F (antet compact, FilterPills, groupTone, comutator, card-tabel).
Citește docs/design/CORECTII-master-v2.md, secțiunile 1–7 și 14.
Aplică-le în webapp/src/shared/ui și webapp/src/app/shell.
Creează RowMenu.tsx și ConfirmDeleteDialog.tsx în shared/ui și exportă-le din index.ts.
Rulează npm run typecheck și npm test în webapp/. Nu atinge ecranele din features/.
```

## Pasul 2 — ecranele existente, unul câte unul
Pentru fiecare ecran în ordinea: Copii (02), Grupe (03), Vizite (04), Achitări (05), Cheltuieli (06), Situația (07), apoi Dashboard:
```
Citește docs/design/screens/00-comun.md și docs/design/screens/<NN-ecran>.md.
Deschide docs/design/<Fișier>.dc.html#<id> ca referință vizuală.
Implementează exact arborele și CSS-ul din spec; bifează criteriile de acceptare și raportează ce a rămas nebifat.
Pentru Dashboard (fără spec propriu): secțiunea din README.md + CORECTII-master-v2.md.
Păstrează hook-urile și logica existente; schimbă doar markup-ul și CSS-ul.
Actualizează testele ecranului. Rulează typecheck + test.
```

## Pasul 3 — Situația plăților + SMS
```
Construiește StatusPage după Situatia.dc.html #1m și #1n (secțiunea 12 din CORECTII).
Apoi SmsConfirmDialog.tsx după #2a, #2b, #2c, cu contorul de caractere GSM-7/UCS-2 și testele lui.
Backend: endpoint POST /api/sms/send și tabelele sms_log, sms_templates, cum scrie în README
la „Notificare SMS”. Furnizorul se implementează în spatele unei interfețe SmsProvider
(o implementare „fake” pentru teste și dezvoltare, plus SmsMdProvider pentru sms.md — REST API,
webhook pentru raportul de livrare; cheia API din setările locale, niciodată în frontend).
```

## Pasul 4 — Mesaje SMS și șabloane
```
Adaugă filele „Mesaje SMS” și „Șabloane” în NotificationsPage după Sms.dc.html #4a și #4b.
```

## Pasul 5 — laptop mic
```
Aplică secțiunea „Ecrane mai mici” din README, doar pragul 900–1279 px (Responsive.dc.html #5a, #5b):
sidebar overlay cu buton ☰, grile KPI pe 2 coloane. Nu face varianta de tabletă (5c).
```

## Pasul 6 — Ține minte plătitorul
```
Implementează „Ține minte plătitorul” din Asociere (2e), cum scrie în README la „Decizii funcții noi”.
Ascunde din UI funcțiile care nu intră acum (buget, Anulează în Istoric, confirmare părinte,
atașare bon, rezumat săptămânal).
```

## Pasul 7 — Grădinița și tipărire
```
Construiește fila „Grădinița” din Backup și setări, confirmarea de plată A5 și
situația tipărită A4 după Tiparire.dc.html #6a, #6b, #6c (secțiunile din README).
```

## Pasul 8 — Zile de naștere
```
Implementează docs/design/screens/01-copii-zile-de-nastere.md de la cap la coadă.
Atenție: ruta /copii/zile-de-nastere se declară ÎNAINTEA /copii/:childId în App.tsx.
Funcția nouă buildBirthdayMonth se adaugă lângă buildBirthdayCalendar, fără s-o modifice pe cea existentă.
```

## După fiecare push
Scrie „sync” în proiectul de design. Comparăm codul nou cu designul și primești o listă nouă de corecții.
