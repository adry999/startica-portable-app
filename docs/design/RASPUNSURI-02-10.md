# Răspunsuri la INTREBARI.md — 02.10

1. **§5.2 repo release** — repo public separat `adry999/startica-releases`; codul rămâne privat. Schimbă `DEFAULT_RELEASE_REPO` în `src/config/environment.mjs` + `scripts/release.mjs --repo`.
2. **§3.2 F9 Raport contabil EUR** — păstrezi secțiunea „Pentru taxe în EUR”. F9 se citește: agregatele (Dashboard, Situația, Cheltuieli) doar MDL; raportul contabil poate avea secțiunea EUR separată.
3. **F12 curs + planuri** — se mută în baza comună. Migrare separată: sursa de adevăr = filiala cu cele mai multe zile de curs; divergențele celorlalte se raportează (dry-run), nu se șterg tăcut.
4. **F11 „+ Plată” din fișă** — doar taxa lunii. Restanța rămâne bifă manuală (F7).
5. **§9.2 cod „P”** — apare distinct: literă „P” pe `--mint-soft` / `--mint-ink`, în grilă și la tipărire; legendă „P = prezent confirmat”. Ziua nemarcată rămâne goală.
6. **§5.3 restrângere profil** — nu se șterg niciodată date locale; doar se ascund prin `ModuleGuard`. Backup local cu tipuri nepermise: se face în continuare (datele sunt deja pe disc).
7. **42d prima pornire** — desenat: `Prima pornire.dc.html#46a–46d`.
8. **F4 Chrome** — netestat încă; rămâne în VERIFICARE.
