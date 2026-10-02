> **În pauză (02.10).** SMS-ul rămâne manual: aplicația arată cui trebuie trimis, mesajul e pregătit, operatorul decide. Artboard-urile 39a–39c au fost scoase.

# 33 — Reamintiri SMS automate (39a–39c)

Artboard: `Feedback 01-10.dc.html#39a…39c`. Extinde `14-sms.md` (Notificări → fila nouă „Automat”, după „Șabloane”).

## Regula (39a)
- O regulă pe filială: `{ enabled, firstAfterDays: 3, repeatEveryDays: 7, maxRepeats: 2, time: '10:00', weekdaysOnly: true, templateId, mode: 'approve'|'auto', minDebt: 50, quietDays: 5 }`. Valori implicite ca mai sus, `mode: 'approve'`.
- Restanța = aceeași sursă ca Situația plăților (obligații neachitate după scadența copilului). Fără calcul nou.
- Excluși: restanță < `minDebt`; copii cu `smsOptOut` („Fără SMS” în fișă, câmp nou în „Alte date”); notificați în ultimele `quietDays` zile (manual sau automat, din `sms_log`); zilele libere din calendarul grădiniței; copii arhivați.
- `mode: 'auto'` cere PIN de administrator și `monthlyLimit` setat; altfel comutatorul rămâne pe „Aștept aprobarea mea”.
- „Previzualizează” = lista de azi, fără să salveze nimic.

## Lotul (39b)
- La ora regulii, se pregătește lotul (`sms_auto_batches`: `{ id, date, status: 'pending'|'sent'|'expired'|'postponed', childIds, excluded[] }`). Un lot pe zi și filială.
- `approve`: lotul așteaptă. „Trimite N” trimite prin `sendBatch` existent, cu `requestId = batch.id` (idempotența M10 acoperă dublul clic și repornirea). Copiii se pot debifa. „Amână o zi” → `postponed`, fără SMS. Neaprobat până la 18:00 → `expired`.
- `auto`: trimite direct, tot prin `sendBatch`, cu aceleași limite (sold, limită lunară, 429 oprește lotul).
- Fiecare rând din `sms_log` primește `source: 'auto'` și `autoBatchId`.

## Unde rulează
- Doar pe calculatorul cu profil Recepție sau Administrator (`31-profiluri-calculator.md`), doar cât aplicația e deschisă. Dacă la ora regulii e închisă, verificarea se face la următoarea pornire în aceeași zi, până la 18:00. Fără serviciu Windows, fără proces separat.
- Cu sincronizare: lotul se pregătește doar pe un singur calculator (cel marcat „Trimite SMS automat” în profil). Celelalte nu pregătesc nimic.

## Dashboard (39c)
Card „N reamintiri SMS de aprobat” cât lotul e `pending`. În modul `auto`: „N reamintiri trimise azi”. Doar pe profilul Recepție/Administrator.

## Istoric
Fiecare aprobare, amânare, expirare și schimbare de regulă intră în `audit_log` (36g).
