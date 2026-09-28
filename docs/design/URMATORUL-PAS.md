# Următorul pas pentru Claude Code

Stadiu la 28.09.2026, 13:46: Claude Code a închis Etapa 0.1–0.4 și toate cele 7 module (COADA-DE-LUCRU.md). A lucrat însă pe versiunea din repo, fără deciziile de după 11:06. Rămân doar acestea.

Copiază întâi în `docs/design/` din pachet: `URMATORUL-PAS.md`, `FEEDBACK.md`, `screens/03-grupe.md`, `screens/24-personal.md`, `screens/27-componente-comune.md` (nou), `Grupe.dc.html`, `Personal.dc.html`, `Copii.dc.html`.

Lipește în Claude Code:

```
Rest din URMATORUL-PAS (versiunea nouă din docs/design). Aceleași reguli: un punct e închis când arată ca .dc.html-ul, criteriile din spec sunt bifate și npm run check + webapp typecheck + test sunt verzi. Commit după fiecare, trece-l în COADA-DE-LUCRU.md, oprește-te (eu scriu „sync”).

0.5 Componente comune (screens/27-componente-comune.md): initials unic → PersonCell → DataTable.groupBy (TeamView pe DataTable) → ListToolbar → ProfileLayout/ProfileSection/StatCard. Fără schimbare vizuală; Copii și Personal trec pe ele.
0.6 „Mărimea interfeței” Compact 90% implicit (FEEDBACK 6) + umbra doar pe butonul principal din antet (FEEDBACK 7).
0.7 Grupe: echipa grupei aleasă din Personal (GroupTeamPicker, 03-grupe.md §5c) în 4a și 4c: principal, asistenți, înlocuitori, disponibilitate L–V. Din 4b (tablă), „Editează” trece automat în 4a.
0.8 Personal: fila Candidați (23l, 24-personal.md): tabel `candidates` comun ambelor filiale (nume, rol, vârstă, experiență, filială, telefon, note), construit din piesele de la 0.5. Fără flux de angajare.
0.9 Culori grupe: unifică groupBoardTone.ts (8 tonuri) cu @shared/ui/group-tone.ts; ordinea grupelor (group.order) și în FilterPills din Copii, Achitări, Situația plăților.

Pentru fiecare punct, la început scrie o listă scurtă: ce lipsește. Apoi lucrează pe ea.
```

Separat, nu design: sincronizarea 14b/14c. Recomandat: întâi bug-urile C-1/C-2 din `audit-A-core-filiale-sync.md`, apoi UI-ul (Sincronizare.dc.html).
