# Următorul pas pentru Claude Code

Lipește în Claude Code:

```
Folosește FilterPills și groupTone (deja în @shared/ui) și în celelalte ecrane:
1. Copii (docs/design/screens/02-copii-lista.md): înlocuiește SearchSelect-urile Grupă și Plată cu FilterPills, două grupuri separate.
2. Vizite (docs/design/screens/04-vizite.md): înlocuiește SearchSelect „Filtru statut” cu FilterPills Statut, cu contorul „N vizite” în dreapta; înlocuiește cele 5 linkuri de pe rând cu un meniu ⋯ (Editează · Reprogramează · Arhivează · Șterge).
3. Badge-urile de grupă din Copii și Grupe folosesc groupTone.
Bifează criteriile de acceptare din fiecare spec și rulează npm run typecheck && npm test.
```

După push, scrie „sync”.
