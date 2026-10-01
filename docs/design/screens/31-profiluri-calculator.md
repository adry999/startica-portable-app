# 31 — Profiluri de calculator (36a–36h)

Artboard: `Profiluri calculator.dc.html`.

## Profiluri
| Profil | Modifică | Doar citire | Nu primește |
|---|---|---|---|
| Complet | tot | — | — |
| Educator | Prezența (toate grupele) | Copii, Grupe | plăți, cheltuieli, salarii, note medicale |
| Recepție | Vizite, Prezența | Copii, Grupe | idem |
| Bazin | Bazin | Copii | idem |
| Personalizat | per modul: Nu vede / Vede / Modifică | | Administrare, Salarii, Sincronizare sunt mereu doar Complet |

Alergiile rămân vizibile pe fișă în toate profilurile.

## Ecrane
- 36a: pasul 1 la „Conectează un calculator” (alegere profil + rezumat). Pasul 2 = codul din 14b, plus linia „Profil: …”.
- 36b: matrice Personalizat.
- 36c: lista de calculatoare cu coloana Profil și panou lateral „Schimbă”.
- 36d: meniul pe profil. Grupele de meniu goale dispar. Cardul de sincronizare arată „Profil X · acces limitat”.
- 36e: fișa copilului doar citire, fără plăți, plan, note medicale, fără butoane de editare.
- 36g: Administrare → Istoric cu filtru „Calculator” (pastile), coloană calculator pe fiecare rând, fila nouă „Acces”, panou sumar (acțiuni azi, ultima, profil, acces blocat). Doar pe profil Complet. Link „Vezi istoricul calculatorului” din 36c.
- 36h: ecranul PIN la intrarea în modul + lista verificărilor.
- 36f: stare goală `profil.blocked` pentru rute din afara profilului.

## Server (obligatoriu, nu doar UI)
- `devices.profile` (JSON: modul → 0/1/2) pe sync-server; se setează la `POST /v1/pairing-codes` și prin `POST /v1/devices/:id/profile` (doar de pe un dispozitiv Complet).
- Pull/snapshot filtrate pe `kind` după profil; câmpurile sensibile (note medicale, plan tarifar) tăiate din `children` dacă Achitări = 0.
- Push respins (403 pe rând, nu pe lot) pentru `kind` fără „Modifică”.
- La restrângerea profilului: clientul șterge local tipurile nepermise și refuză backup local cu ele.
- `/api/session` expune profilul; rutele și meniul se construiesc din el.

## Istoric pe calculatoare
- Tip nou de sincronizat `audit_log` (append-only): fiecare intrare are `deviceId`, `deviceName`, `branchId`, `module`, `action`, `recordId`, diff (fără date medicale), `at`.
- Toate dispozitivele îl trimit; doar dispozitivele Complet îl primesc la pull. Serverul refuză update/delete pe `audit_log`. Păstrare 365 de zile (`SYNC_HISTORY_DAYS`).
- Evenimente de acces: `access.pin_ok`, `access.pin_fail`, `access.blocked` (rută din afara profilului), `access.locked` (5 PIN-uri greșite → notificare pe dispozitivele Complet).

## Verificări la intrare (pentru orice modul, chiar dacă nu e în meniu)
1. Ruta: un singur `ModuleGuard` în router, citește profilul din `/api/session`; fără acces → `profil.blocked` (36f) + `access.blocked` în istoric.
2. Ctrl K, scurtături, linkuri interne (Dashboard → „Vezi lista”, istoric, notificări): filtrate după profil.
3. Serverul local: middleware pe fiecare `/api/<modul>` → 403 dacă modulul nu e permis sau dacă e cu PIN și sesiunea de modul nu e deblocată.
4. PIN la intrare: per modul în profil (implicit Achitări, Cheltuieli, Raport, De rezolvat; și pe Complet). Deblocarea expiră după 10 min de inactivitate. 5 greșeli → blocare 15 min.
5. Test de arhitectură: fiecare rută din `nav-items.ts`/router are un `moduleId` și trece prin `ModuleGuard`; fiecare router `/api` din server are middleware-ul de profil.
