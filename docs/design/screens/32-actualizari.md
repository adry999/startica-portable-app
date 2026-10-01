# 32 — Actualizări și versiuni (37a–37d)

Artboard: `Actualizari.dc.html`.

## Compatibilitate (sync-server)
- Fiecare cerere `/v1/*` trimite `X-Startica-Version`. Serverul are `SYNC_MIN_CLIENT_VERSION` (env) și răspunde **426** la push/pull pentru versiuni mai mici, cu `{ minVersion, latestVersion, downloadUrl }`.
- `GET /v1/devices` întoarce și `version` (ultima văzută).
- La o versiune cu tip nou sau câmpuri noi: se ridică `SYNC_MIN_CLIENT_VERSION` în același deploy al serverului. Serverul se redesfășoară înaintea instalerului.

## Client
- 426 → starea „Sincronizare oprită” (37a, 37c): coada locală rămâne, pull-ul se oprește, nu se șterge nimic.
- **Sursa versiunilor: GitHub Releases** (decizie 01.10). Repo-ul de release e public, separat de cod dacă `startica-portable-app` rămâne privat (ex. `adry999/startica-releases`); aplicația nu are token GitHub. Fiecare release = tag `vX.Y.Z`, asset-uri `Startica_Setup_X.Y.Z.exe` + `latest.json`, notele în corpul release-ului.
- Verificare de actualizare la pornire și la 6 ore: `https://github.com/<owner>/<repo>/releases/latest/download/latest.json` (versiune, URL instaler = asset-ul din același release, SHA-256, note). Fără API GitHub (limită 60 cereri/oră/IP); doar URL-ul `latest/download`, cu redirect. Pre-release-urile și draft-urile nu se văd.
- `downloadUrl` din răspunsul 426 al serverului = același URL `latest/download/Startica_Setup_<latestVersion>.exe` (serverul nu găzduiește instalere).
- Publicarea: script `scripts/release.mjs` (build instaler → SHA-256 → `latest.json` → `gh release create`), rulat manual după redesfășurarea `sync-server`. Descărcare în fundal în `<home>\Actualizari`, verificare SHA-256, instalare silențioasă la închidere (lansatorul rulează instalerul după oprirea serverului și a backupului de închidere).
- Bara 37b o dată pe versiune; „Repornește acum” = flush coadă → închidere → instalare → pornire.
- 37d: coloana Versiune în Calculatoare conectate (și în 36c), oprite primele, banner cu numărul lor.
- Eșec la descărcare/verificare: rămâne cardul 37a, cu link manual la instaler.
