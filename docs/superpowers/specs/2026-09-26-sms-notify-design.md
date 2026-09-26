# Notificări SMS către părinți prin sms.md — 26 septembrie 2026

Stare la scriere: `master-v2`, punctul 9 („Faza 5”) din `docs/design/COADA-DE-LUCRU.md`. Zero cod SMS în repo (confirmat de auditul din 2026-09-26, §6.2); există doar mockup-ul UI (`docs/design/screens/14-sms.md`, `Sms.dc.html#4a/#4b`, `Situatia.dc.html#2a–#2c`) și o propunere de backend în `docs/design/README.md` („Situația plăților — notificare SMS”). Furnizorul `sms.md` e decis de utilizator (2026-09-26). Acest document e designul; planul de implementare cu pași vine separat, după citirea și aprobarea lui.

**Sursa pentru API-ul sms.md:** `https://docs.sms.md/` servește o pagină Scalar cu specificația OpenAPI 3.1 încorporată în `<script id="api-reference">` (titlu „sms.md — Client API”, versiunea 3.0). A fost descărcată și citită integral pe 2026-09-26; tot ce e scris în §4 vine de acolo, nu e presupus. Ce **nu** e în documentație e marcat explicit ca „nedocumentat” în §4.6.

## 1. Context și problemă

Azi operatorul vede în „De notificat” lista copiilor cu rest de plată și poate **copia** în clipboard un mesaj fix (`billing/domain/reminder-message.mjs`), pe care îl lipește manual în telefon. Rezumatul zilnic Telegram (`telegram-notify`) merge doar către **operator**, nu către părinți. Lipsesc: trimiterea efectivă către părinte, un istoric al mesajelor trimise (cine, când, dacă a ajuns) și șabloane editabile.

Diferențe față de `telegram-notify`, care schimbă designul:

| | telegram-notify | sms-notify |
| --- | --- | --- |
| Destinatar | operatorul, un singur chat | părinții, un număr de telefon per copil, zeci de destinatari per lot |
| Cost | gratuit | **0,30 MDL per segment** (sms.md, cu TVA), sold preplătit, depozit minim 500 MDL |
| Declanșare | automată, zilnic, din sarcina programată Windows | **manuală**, din aplicație, cu confirmare (vezi §6) |
| Text | fix, generat din date | șablon editabil de operator, cu variabile |
| Stare | un fișier JSON cu chei de deduplicare | tabel `sms_log` în SQLite, cu starea de livrare per mesaj |
| Proces | separat, citește baza doar-citire | serverul aplicației (scrie în `sms_log`) |

## 2. Scop

- Trimiterea unui SMS către părintele unui copil, din „Situația plăților” (un rând sau „Notifică toți”) și din „De notificat”, cu previzualizare și confirmare înainte de fiecare trimitere.
- Șabloane de mesaj editabile (nume, text cu variabile, „fără diacritice la trimitere”, unul implicit), cu contor de caractere/segmente corect pentru GSM-7 și UCS-2.
- Configurarea furnizorului sms.md din ecranul „Notificări”: token API, nume de expeditor, limită lunară, „Trimite SMS de test”, sold curent.
- Jurnalul mesajelor trimise (`sms_log`) cu stare (trimis / livrat / eșuat), răspunsul furnizorului la eșec, „Retrimite”, și starea de livrare adusă de la furnizor.
- Insigna „Notificat azi” pe rândul copilului și „Ultima notificare” în dialogul de confirmare.

### În afara scopului (v1)

- Trimitere **automată** (fără operator) de orice fel — vezi justificarea în §6.
- SMS bidirecțional (răspunsuri de la părinți), OTP, agende de contacte sms.md.
- Alt furnizor decât sms.md. Serviciul e în spatele unei interfețe `SmsService`, dar nu se scrie o a doua implementare acum.
- Webhook DLR (livrare) — aplicația e locală, fără adresă publică; starea se aduce prin interogare (§4.4).
- Mesaje în chirilică sau transliterare automată (opțiunea există în contul sms.md; nu o cablăm).
- Numere din afara Moldovei (inclusiv `+373 77…`, Transnistria — sms.md le tratează ca internaționale, dezactivate implicit pe cont).
- Modificarea rezumatului Telegram al operatorului.

## 3. Model de date

### 3.1 Numărul de telefon al părintelui

Sursa: `Child.phone` (părintele 1, `Child.parent`) și `Child.phone2` (părintele 2, `Child.parent2`) din `#shared/contracts/record-types.d.mts`. Ambele sunt text liber azi (`record-schema.mjs` doar face `??= ''`), deci normalizarea e obligatorie înainte de trimitere și de afișare în dialoguri.

Funcție pură, izomorfă, nouă: `#shared/domain/phone-number.mjs`:

```ts
/** `+373XXXXXXXX` (E.164) sau null dacă nu e un număr mobil moldovenesc valid. */
normalizeMoldovanPhone(raw: string): string | null
```

Reguli (prefixele valide vin din documentația sms.md, §4.2):

1. Se elimină spații, puncte, cratime, paranteze; `00` inițial devine `+`.
2. Forme acceptate → `+373` + 8 cifre: `+373 6XXXXXXX`, `373 6XXXXXXX`, `0 6XXXXXXX`, `6XXXXXXX` (8 cifre).
3. Cele 8 cifre trebuie să înceapă cu unul din prefixele `60, 61, 62, 67, 68, 69, 76, 78, 79, 80`. Altfel `null`.
4. `null` înseamnă „fără telefon”: rândul e exclus automat din trimiterea în masă și marcat ca atare (mockup 2b), iar dialogul pe un rând arată „Corectează telefonul” (→ `/copii/:id`, secțiunea Părinți).

Destinatarul unui copil = telefonul părintelui 1; dacă e invalid și al părintelui 2 e valid, se folosește al doilea (dialogul arată numele părintelui ales). Un singur SMS per copil per lot. Trimiterea către ambii părinți e întrebare deschisă (§10).

Stă în `#shared/domain/` pentru că o folosesc două locuri: `webapp/` (excluderea din listă, previzualizarea) și serverul (validarea finală înainte de apelul plătit). Aceeași regulă în ambele, o singură implementare.

### 3.2 Șablonul de mesaj (`sms_templates`)

```ts
interface SmsTemplate {
  id: string;              // 'TPL-<uuid>'; șablonul implicit seed-uit are id fix 'TPL-restanta'
  name: string;            // „Reamintire restanță”
  body: string;            // text cu variabile {părinte} {copil} {luna} {taxa} {rest} {achitat} {zi}, max 800 caractere
  stripDiacritics: boolean;// „Fără diacritice la trimitere” (implicit true — vezi §7)
  isDefault: boolean;      // exact unul; „Implicit pentru Notifică”
  createdAt: string;       // ISO
  updatedAt: string;
}
```

Variabilele (mockup 4b listează `părinte, copil, luna, rest, achitat, zi`; `taxa` e adăugată pentru că mesajul fix de azi o conține):

| Variabilă | Valoare | Sursă |
| --- | --- | --- |
| `{părinte}` | numele părintelui ales ca destinatar; gol → se elimină și virgula/spațiul din față („Bună ziua!”) | `Child.parent` / `parent2` |
| `{copil}` | `Child.name` | |
| `{luna}` | `formatMonthName(month)` — „septembrie 2026” | luna selectată în ecran |
| `{taxa}` | `formatMoney(obligation.expected)` | `evaluateChildrenForMonth` |
| `{rest}` | `formatMoney(obligation.rest)` | idem |
| `{achitat}` | `formatMoney(obligation.paid)` | idem |
| `{zi}` | `formatDate(obligation.due)` — „05.09.2026” | idem |

Stocare: tabel propriu `sms_templates`, **nu** un `kind` nou în `records`. Motiv: `records`/`RecordsSnapshot`/`record-schema.mjs` sunt fișiere fierbinți (audit 2026-09-26 §5) și snapshot-ul se încarcă în fiecare sesiune de browser; șabloanele nu sunt fișe de business cu conflicte de revizie (un singur operator le editează, rar). Sunt în `startica.db`, deci intră automat în backupuri (spre deosebire de token). Modificările se scriu în istoric prin `auditTrail.recordChange({ action: 'șablon sms', ... })`.

Șablonul implicit e seed-uit la prima pornire (`INSERT OR IGNORE`) cu textul actual din `reminder-message.mjs`, rescris cu variabile:

```
Bună ziua, {părinte}! Vă reamintim că taxa pentru {luna} pentru {copil} este de {taxa}, cu scadența la {zi}. Rest de plată: {rest}. Vă mulțumim! Startica
```

Nu se poate șterge; se poate edita și se poate muta „Implicit” pe alt șablon. Un al doilea șablon seed-uit, „Plată parțială” (mockup 2a îl listează), e întrebare deschisă (§10).

### 3.3 Mutarea `reminderMessage` în `#shared/domain/`

Conform regulii „reguli folosite de două feature-uri trec în `#shared/domain/`” (audit 2026-09-26 §6.2, roadmap Faza 5): `billing/domain/reminder-message.mjs` dispare, înlocuit de `#shared/domain/sms-template.mjs`:

```ts
DEFAULT_SMS_TEMPLATE_BODY: string
SMS_TEMPLATE_VARIABLES: readonly ['părinte','copil','luna','taxa','rest','achitat','zi']
/** Înlocuiește variabilele; cele necunoscute rămân ca atare (vizibil în previzualizare, nu ascuns). */
renderSmsTemplate(body: string, variables: Record<string, string>): string
/** Variabilele pentru un copil + obligația lui, din aceleași câmpuri ca reminderMessage azi. */
smsVariablesFor({ child, parentName, obligation, month }): Record<string, string>
```

`useNotify.ts` (butoanele „Copiază”) trece pe `renderSmsTemplate(DEFAULT_SMS_TEMPLATE_BODY, smsVariablesFor(...))` — cu șablonul implicit din bază când ecranul îl are încărcat, altfel constanta. `billing/index.web.mjs` nu mai exportă `reminderMessage`; testul `reminder-message.test.mjs` se mută cu funcția. Rezultatul pentru copierea în clipboard rămâne caracter cu caracter identic (test de regresie).

### 3.4 Codificare, segmente, diacritice

`#shared/domain/sms-segments.mjs` (pur, izomorf — contorul din dialoguri și valoarea scrisă în jurnal trebuie să coincidă):

```ts
countSmsSegments(text: string): { characters: number; segments: number; encoding: 'gsm-7' | 'ucs-2' }
```

Regulile sunt exact cele din documentația sms.md (§Billing): GSM 03.38 → 160 caractere pe un segment, 153 pe segment când sunt mai multe; orice caracter din afara setului GSM-7 (chirilice, **ă â î ș ț**, emoji) comută **tot** mesajul pe UCS-2 → 70 / 67; caracterele `^ { } [ ] ~ \ |` și `€` numără dublu în GSM-7. Textul gol → 0 segmente.

`#shared/format/strip-diacritics.mjs`: `stripDiacritics(text)` — NFD + eliminarea semnelor combinate (acoperă ă â î ș ț și variantele cu sedilă). Se aplică la trimitere când `template.stripDiacritics` e pornit, **înainte** de numărare, ca operatorul să vadă în contor exact ce se plătește. Nu folosim opțiunea echivalentă din contul sms.md: ar face contorul local să mintă.

Consecința practică, care justifică implicitul `true`: mesajul implicit de mai sus are ~190 de caractere → 2 segmente GSM-7 (0,60 MDL) sau 3 segmente UCS-2 (0,90 MDL) cu diacritice.

### 3.5 Jurnalul (`sms_log`)

```ts
type SmsLogStatus = 'sent' | 'delivered' | 'failed' | 'unknown';
type SmsSource = 'status-row' | 'status-bulk' | 'notify' | 'resend' | 'test';

interface SmsLogEntry {
  id: number;                 // INTEGER PRIMARY KEY, ordinea trimiterii
  createdAt: string;          // ISO, momentul cererii
  childId: string | null;     // null pentru 'test'
  recipientName: string;      // părintele, la momentul trimiterii (nu se recalculează)
  childName: string;          // idem
  phone: string;              // E.164, exact ce s-a trimis
  text: string;               // textul final (după fără-diacritice), exact ce s-a trimis
  templateId: string | null;  // null pentru „Personalizat” și 'test'
  templateName: string;       // instantaneu; șablonul poate fi redenumit/șters ulterior
  month: string | null;       // luna obligației ('YYYY-MM'), pentru „Notificat azi” și filtrare
  source: SmsSource;
  characters: number;
  segments: number;           // ce s-a facturat (din răspunsul sms.md, nu din contorul local)
  encoding: 'gsm-7' | 'ucs-2';
  cost: string | null;        // „0.60”, MDL, șir ca în API (precizie)
  status: SmsLogStatus;
  providerId: string | null;  // `data.id` (UUID) de la sms.md; null când cererea nici nu a plecat
  providerStatus: string;     // numele stării de la furnizor („Queued”, „Delivered”, „Undelivered”…) sau ''
  providerError: string;      // codul + primul mesaj din `errors` la eșec, altfel ''
  statusCheckedAt: string;    // ISO, ultima interogare de stare; '' până la prima
}
```

Tabelul se creează în `SCHEMA` din `core/server/database/schema.mjs` (`CREATE TABLE IF NOT EXISTS`, ca `audit_changes` și `settings`), plus `sms_templates`; nu e nevoie de o migrare numerotată (nu se transformă date existente). Index pe `(child_id, created_at)` pentru „Notificat azi” și pe `(status)` pentru interogarea stărilor neterminale.

Reguli:
- Un rând se scrie **înainte** de apelul de rețea, cu `status: 'failed'`, `providerId: null`, și se actualizează după răspuns. Astfel un server oprit în mijlocul unui lot nu pierde urma unui mesaj deja plătit (mai bine un „eșuat” fals, corectabil, decât un SMS plătit fără urmă).
- Un mesaj **nu se șterge** din jurnal niciodată din UI. Fără retenție în v1 (500 rânduri pe lună e nimic pentru SQLite). Întrebare deschisă (§10) dacă e nevoie de curățare la 12 luni, ca `healthNotes`.
- `healthNotes`, `notes`, `verification` nu sunt niciodată variabile de șablon și nu ajung în `text`.

`sentThisMonth` (bara „61 / 500” din 4a) = numărul de rânduri cu `status != 'failed'` din luna calendaristică curentă (ora locală). `segmentsThisMonth` = suma `segments` pe aceleași rânduri („SMS consumate”).

## 4. Integrarea sms.md (verificată pe OpenAPI 3.0, 2026-09-26)

### 4.1 Autentificare și adrese

- Server de producție: `https://api.sms.md`. Toate cererile v3 poartă antetul `X-Api-Token: <token>`. Tokenul se creează în contul sms.md (**Settings → API**, `https://app.sms.md/settings/api`), **nu expiră** și e creat cu un set de **scope-uri**; un endpoint chemat fără scope-ul lui răspunde `403 SCOPE_FORBIDDEN`. Documentația spune explicit: tokenul dă acces la cont și poate cheltui soldul, deci stă doar pe server.
- Scope-uri de care are nevoie Startica (operatorul le bifează la crearea tokenului; ecranul „Notificări” le listează în textul de ajutor): `messages:send`, `messages:read`, `account:read`, `senders:read`.
- Numele de expeditor (`from`, max 15 caractere) se **înregistrează în dashboard** și trebuie aprobat de operatori; API-ul poate doar să îl citească (`GET /v3/sender-aliases`, stare `1 Active`). Propunere: „Startica” sau numele grădiniței — întrebare deschisă (§10).
- Există și un API v1 (`?token=` în query, fără envelope). Nu îl folosim.

### 4.2 Trimiterea unui mesaj

`POST /v3/messages`, JSON `{ from, to, text, sendAt? }`:

- `to`: format recomandat de sms.md e cel național fără prefix (`69123456`); acceptă și `069123456`, `37369123456`, `+37369123456`. Trimitem forma E.164 din §3.1 (`+37369123456`) — o singură formă în bază, în jurnal și pe fir. Prefixe valide: `60, 61, 62, 67, 68, 69, 76, 78, 79, 80`.
- `text`: 1–800 caractere (până la 6 segmente GSM-7 / 12 UCS-2). Editorul de șabloane și serverul refuză peste 800.
- `sendAt`: nu îl folosim (v1 trimite imediat).
- Răspuns 200: `{ status: 'success', httpCode: 200, data: { id (UUID), to, text (textul final trimis), characters, segments, encoding: 'gsm-7'|'ucs-2', cost: '0.30', currency: 'MDL', destination: 'moldova'|'international', ... } }`. **Soldul e debitat imediat**, înainte de livrare. `segments`, `encoding`, `cost` din răspuns sunt cele scrise în `sms_log` (nu contorul local; dacă diferă, e un bug de numărare la noi și apare în jurnal).
- `POST /v3/messages/bulk` (același text la până la 500 de numere) **nu se potrivește**: fiecare mesaj al nostru e personalizat. Trimitem secvențial, un mesaj per cerere.
- `POST /v3/messages/estimate` `{ to, text }` calculează `segments`/`cost` fără să trimită și fără să debiteze. Nu îl chemăm per destinatar în dialog (N cereri înainte de confirmare); contorul local din §3.4 e suficient și e aceeași regulă. Rămâne opțiune pentru testul de integrare manual „contorul nostru = contorul lor” înainte de livrare.

### 4.3 Clasificarea eșecurilor

Toate erorile vin în envelope `{ status: 'error', httpCode, code, message, errors? }`. Documentația cere explicit: **ramifică pe `code`, nu pe `message`** (în producție `message` e înlocuit cu „An error occurred.”). Codurile: `AUTHENTICATION_REQUIRED`, `INVALID_API_TOKEN` (401), `SCOPE_FORBIDDEN` (403), `INSUFFICIENT_BALANCE` (402, nimic pus în coadă, nimic debitat), `VALIDATION_ERROR` (422, cu `errors: { câmp: [mesaje] }`, `_` pentru erori fără câmp), `NOT_FOUND` (404), `RATE_LIMIT_EXCEEDED` (429, antet `Retry-After` în secunde), `INTERNAL_ERROR` (5xx).

`classifySmsFailure(error)` în `sms.service.mjs`, într-un singur loc, ca `classifyTelegramFailure`, dar cu o a doua dimensiune — la un lot, unele eșecuri privesc **un destinatar**, altele **tot contul**:

```ts
interface SmsFailure {
  kind: 'transient' | 'permanent';
  scope: 'recipient' | 'account';
  code: string;      // codul sms.md sau 'NETWORK' / 'TIMEOUT'
  message: string;   // text pentru operator, în română
}
```

| Situație | kind | scope | Mesaj pentru operator | Efect asupra lotului |
| --- | --- | --- | --- | --- |
| `TypeError: fetch failed`, `AbortError` (timeout 15 s), 5xx / `INTERNAL_ERROR` | transient | account | „Fără internet sau sms.md indisponibil.” | se oprește; restul rămân netrimise (`skipped`) |
| 429 `RATE_LIMIT_EXCEEDED` | transient | account | idem | se așteaptă `Retry-After` (max 30 s) **o dată**, se reia același mesaj; a doua oară se oprește |
| 401 `INVALID_API_TOKEN` / `AUTHENTICATION_REQUIRED` | permanent | account | „Token sms.md invalid sau dezactivat. Reconectează din Notificări.” | se oprește |
| 403 `SCOPE_FORBIDDEN` | permanent | account | „Tokenul nu are permisiunea `<scope>`. Creează un token cu messages:send, messages:read, account:read, senders:read.” | se oprește |
| 402 `INSUFFICIENT_BALANCE` | permanent | account | „Sold insuficient la sms.md. Alimentează contul și reia eșuatele.” | se oprește |
| 422 cu `errors.from` | permanent | account | „Expeditorul „<sender>” nu e aprobat la sms.md.” | se oprește |
| 422 cu `errors.to` sau `errors._` (număr invalid / internațional dezactivat) | permanent | recipient | „Număr invalid pentru sms.md: <phone>.” | rândul e `failed`, **lotul continuă** |
| 422 cu `errors.text` | permanent | recipient | „sms.md a refuzat textul: <primul mesaj>.” | rândul e `failed`, lotul continuă |
| orice alt `code` | permanent | recipient | „sms.md a refuzat mesajul (<code>).” | rândul e `failed`, lotul continuă |

Un mesaj marcat `recipient`/`failed` nu a fost debitat (sms.md: „rejected requests due to invalid numbers aren't billed”); unul oprit ca `skipped` nu a fost nici măcar trimis. `providerError` reține `code` + primul text din `errors` (util pentru „răspunsul furnizorului la eșec” din panoul 4a).

### 4.4 Starea de livrare

- `GET /v3/messages/{id}` → `data.status: { id, name }`. Valorile (din `GET /v3/messages/statuses`, listă statică): `1 Queued`, `2 Sent`, `3 Delivered`, `8 Unknown`, `9 Undelivered`, `10 Failed`. Terminale: 3, 9, 10.
- Webhook-ul DLR (POST către un „DLR URL” setat în cont) există, dar cere o adresă publică; Startica rulează pe `localhost`. **Nu se folosește.**
- Interogare (`refreshDeliveryStatuses`): la deschiderea filei „Mesaje SMS” și la 30 s după un lot (o singură dată, din UI), serverul ia din `sms_log` rândurile cu `status = 'sent'` și `providerId != null`, cele mai noi 50, le interoghează secvențial și scrie `providerStatus`, `statusCheckedAt` și starea mapată: `Delivered → 'delivered'`; `Undelivered`/`Failed → 'failed'` cu `providerError = status_name`; `Queued`/`Sent` → rămâne `'sent'`; `Unknown` → rămâne `'sent'`. Un rând `'sent'` mai vechi de **48 h** devine `'unknown'` și nu se mai interoghează. Eșecul interogării (rețea, 429) nu e eroare pentru operator: starea rămâne cea veche, `statusCheckedAt` neschimbat.
- În UI: `sent` = „În curs” (yellow), `delivered` = „Livrat” (mint), `failed` = „Eșuat” (pink), `unknown` = „Necunoscut” (neutru) — a patra stare **nu e în mockup**, se adaugă (§10).

### 4.5 Sold și expeditor

- `GET /v3/account/balance` → `{ balance: '123.45', currency: 'MDL' }`. Se cheamă la `GET /api/sms-status` (o cerere; la eșec `balance: null`, fără eroare) și înainte de fiecare lot (§7).
- `GET /v3/sender-aliases?status=1` → lista expeditorilor activi. Se cheamă la conectare pentru a verifica că `sender` există și e `Active`; altfel 400 cu lista numelor găsite.

### 4.6 Nedocumentat sau neverificat (de confirmat cu sms.md sau prin test real)

- **Limita numerică de rată** pentru `POST /v3/messages` nu e în specificație (doar „429 + `Retry-After`” și sfatul „folosiți bulk pentru campanii”). Propunerea din `docs/design/README.md` — **secvențial, cel mult 1 mesaj/s** — rămâne; se verifică la primul lot real de 10–20 de mesaje.
- **Prețul** 0,30 MDL/segment vine din pagina de marketing `sms.md`, nu din API; API-ul întoarce `cost` per mesaj, deci Startica nu are nevoie de o constantă de preț decât pentru **estimarea** dinaintea confirmării. Se folosește ultimul `cost/segments` din `sms_log` (sau 0,30 dacă jurnalul e gol).
- Comportamentul real al lui `+373…` vs. formatul „recomandat” fără prefix: documentația spune că ambele sunt acceptate; se confirmă la testul de conectare.
- Cât timp păstrează sms.md istoricul (relevant doar pentru „Retrimite” după luni — nu depindem de el, textul e în `sms_log`).

## 5. Structura feature-ului

```
src/features/sms-notify/
├── README.md
├── sms-notify.types.d.mts            # SmsConfig, SmsStatus, SmsTemplate, SmsLogEntry, SmsFailure, SmsSendRequest/Result, SmsService
├── index.server.mjs                  # createSmsService, createSmsRoutes, createSmsLogRepository, createSmsTemplateRepository, read/write/removeSmsConfig
├── index.web.mjs                     # doar domeniu pur (ca billing/index.web.mjs azi): planSmsBatch — fără DOM, fără controller
├── domain/
│   └── sms-batch.mjs (+ .test.mjs)   # planSmsBatch: destinatari + text randat + excluși; pur, primește listele gata calculate
├── server/
│   ├── sms-config.repository.mjs (+ .test.mjs)     # Startica_Date\sms.json, pe #core/server/files/json-file.mjs
│   ├── sms-log.repository.mjs (+ .test.mjs)        # sms_log: insert, update după răspuns, listă după dată, ultimele per copil, neterminale, contoare pe lună
│   ├── sms-template.repository.mjs (+ .test.mjs)   # sms_templates: list, save, delete, setDefault, seed implicit
│   ├── sms.service.mjs (+ .test.mjs)               # sendMessage, getMessage, getBalance, listSenderAliases, classifySmsFailure; primește fetch
│   ├── sms-send.service.mjs (+ .test.mjs)          # orchestrarea unui lot: validare, limită lunară, sold, secvențial, jurnal, audit
│   └── sms.routes.mjs (+ .integration.test.mjs)
└── test-support/
    └── fake-sms-api.mjs              # fetch fals: /v3/messages, /v3/messages/{id}, /v3/account/balance, /v3/sender-aliases + jurnalul apelurilor + SMS_RESPONSES (401/402/422/429/5xx)
```

Fără `web/` (stratul vanilla e în curs de eliminare pe `master-v2`). `index.web.mjs` există doar ca `webapp/` să importe domeniul prin barrel, nu prin cale internă (regula din SKILL.md §Stadiul migrării).

Cine importă ce (interdicțiile din `tests/architecture/import-boundaries.test.mjs` rămân valabile):

- `domain/sms-batch.mjs` → doar `#shared/domain/phone-number.mjs`, `#shared/domain/sms-template.mjs`, `#shared/domain/sms-segments.mjs`, `#shared/format/strip-diacritics.mjs`. Primește rândurile deja evaluate (`{ child, obligation }`), nu importă `billing` sau `children`.
- `server/*` → `#core/server/errors/domain-error.mjs`, `#core/server/files/json-file.mjs`, `#core/server/files/remove-file-if-present.mjs`, `#shared/contracts/audit-trail.mjs`, `node:path`, `node:crypto`. `sms.service.mjs` primește `fetch`; `sms-send.service.mjs` primește `smsService`, repository-urile, `auditTrail`, `now`.
- `src/app/server/create-application.mjs` → `createSmsRoutes({ database: db, dataDirectory: dataDir, smsService: createSmsService({ fetch: options.fetch ?? globalThis.fetch }), auditTrail: auditLogRepository })`. `startTestApplication` primește deja `fetch` fals prin opțiuni (introdus la Telegram); același `fetch` fals trebuie să ruteze după host (`api.telegram.org` vs `api.sms.md`) — `tests/support/` capătă un `composeFakeFetch({ 'api.telegram.org': ..., 'api.sms.md': ... })`.
- `webapp/src/features/sms/` → `#features/sms-notify/index.web.mjs` (`planSmsBatch`), `#shared/domain/*` de mai sus, `@shared/api/session` (`requestJson`), `@shared/ui`.

### 5.1 Configurația (`sms-config.repository.mjs`)

```ts
interface SmsConfig {
  token: string;        // X-Api-Token; niciodată în răspunsuri HTTP, audit sau jurnale
  sender: string;       // numele de expeditor aprobat, max 15
  monthlyLimit: number; // 1..5000, implicit 500
}
```

Fișier `Startica_Date\sms.json`, scriere atomică, exact ca `telegram.json`. **De ce fișier în `dataDir` și nu `settings` sau `process.env`:** (a) tokenul dă acces la sold — nu are ce căuta în backupuri, iar `settings` e copiat integral în fiecare backup, inclusiv pe Google Drive (decizia din spec-ul Telegram, §2, se aplică identic); (b) `#config/environment.mjs` e pentru variabile de lansator (`STARTICA_HOME`, port, profil), setate o dată la instalare, nu pentru o valoare pe care operatorul o lipește dintr-un dashboard fără să deschidă un terminal. Consecință documentată în GHID: după restaurare pe alt calculator, tokenul se lipește din nou; șabloanele și jurnalul revin din backup (sunt în bază). `monthlyLimit` stă tot aici, nu în `settings`, ca să existe un singur card „Furnizor SMS” cu un singur formular; pierderea ei la restaurare (revine la 500) e acceptabilă.

### 5.2 Rutele (`sms.routes.mjs`)

Numele urmează convenția existentă `/api/telegram-<verb>` (cu cratimă), nu `/api/sms/send` din propunerea din `docs/design/README.md`.

| Rută | Cerere | Răspuns 200 | 400 |
| --- | --- | --- | --- |
| `GET /api/sms-status` | — | `SmsStatus` (mai jos) | — |
| `POST /api/sms-connect` | `{ token, sender, monthlyLimit }` | `{ ok, status }` | token gol/format aiurea (fără apel); `getBalance` 401/403 → mesajul clasificat; `sender` inexistent/neaprobat → „Expeditorul „X” nu e activ la sms.md. Expeditori activi: A, B.” |
| `POST /api/sms-disconnect` | `{}` | `{ ok, status }` | — |
| `POST /api/sms-test` | `{ phone }` | `{ ok, status, entry: SmsLogEntry }` | neconectat; telefon invalid; eșecul clasificat |
| `POST /api/sms-send` | `SmsSendRequest` | `SmsSendResult` | neconectat; lot gol; peste limita lunară; sold insuficient estimat (§7) |
| `GET /api/sms-log?after=YYYY-MM-DD` | — | `{ entries: SmsLogEntry[], stats: { sentThisMonth, failedThisMonth, segmentsThisMonth, monthlyLimit } }` | dată invalidă |
| `GET /api/sms-last-notified` | — | `{ [childId]: { at, status, month, templateName } }` — ultimul mesaj ne-eșuat per copil | — |
| `POST /api/sms-refresh-statuses` | `{}` | `{ updated: number, entries: SmsLogEntry[] }` (rândurile atinse) | neconectat |
| `GET /api/sms-templates` | — | `{ templates: SmsTemplate[] }` | — |
| `POST /api/sms-template-save` | `{ id?, name, body, stripDiacritics, isDefault }` | `{ ok, template }` | nume gol; text gol / > 800; variabilă necunoscută (`{xyz}`) |
| `POST /api/sms-template-delete` | `{ id }` | `{ ok }` | șablonul implicit („Șablonul implicit nu se poate șterge. Alege alt implicit mai întâi.”); id inexistent 409 |

```ts
interface SmsStatus {
  configured: boolean;
  sender: string;
  tokenMasked: string;        // '••••••••' + ultimele 4 caractere; '' când nu e configurat
  monthlyLimit: number;
  sentThisMonth: number;
  failedThisMonth: number;
  segmentsThisMonth: number;
  balance: string | null;     // '123.45' MDL, null dacă interogarea a eșuat
  balanceCheckedAt: string;   // ISO sau ''
  lastError: string;          // ultimul eșec de cont (account-scoped), golit la următorul succes
}

interface SmsSendRequest {
  source: 'status-row' | 'status-bulk' | 'notify' | 'resend';
  month: string | null;                       // 'YYYY-MM'
  templateId: string | null;                  // null = Personalizat
  messages: Array<{ childId: string; childName: string; recipientName: string; phone: string; text: string }>;
}

interface SmsSendResult {
  ok: boolean;                                // true doar dacă toate au plecat
  results: Array<{ childId: string; outcome: 'sent' | 'failed' | 'skipped'; logId: number | null; segments: number; cost: string | null; error: string }>;
  stopped: { code: string; message: string } | null;   // eșecul de cont care a oprit lotul, dacă a fost
  status: SmsStatus;
}
```

`POST /api/sms-send` e singura rută care costă bani în masă. Serverul **nu recalculează** textul din șablon (textul aprobat de operator în previzualizare e cel trimis, un singur loc de randare, în `planSmsBatch`), dar **revalidează** fiecare mesaj: `normalizeMoldovanPhone(phone)` non-null, `text` 1–800, `childId` non-gol; un mesaj invalid → 400 pentru tot lotul, înainte de orice apel (clientul a greșit, nu utilizatorul). Apoi `sms-send.service.mjs`:

1. Citește config; neconectat → 400.
2. `sentThisMonth + messages.length > monthlyLimit` → 400 „Limita lunară de N SMS ar fi depășită (trimise: M). Mărește limita în Notificări sau trimite mai puține.”
3. Sold: `getBalance()`; dacă reușește și `balance < estimare` → 400 „Sold sms.md insuficient: X lei disponibili, ≈ Y lei necesari.” (estimarea = Σ segmente locale × ultimul cost unitar). Dacă interogarea soldului eșuează, se merge mai departe — 402 de la trimitere oprește oricum lotul fără cost.
4. Pentru fiecare mesaj, în ordine: insert în `sms_log` (`failed`, fără `providerId`) → `sendMessage` → update (`sent`, `providerId`, `segments`, `encoding`, `cost`) sau update (`providerError`) după clasificare; `scope: 'account'` → restul devin `skipped` (fără rând în jurnal — nu au fost încercate) și `stopped` se completează. Pauză de 1 s între cereri (§4.6); `now`/`sleep` injectate pentru teste.
5. Un rând de audit per lot: `{ action: 'trimitere sms', recordType: null, before: null, after: { source, month, templateName, requested, sent, failed, skipped, cost } }` — fără telefoane și fără text (sunt în `sms_log`, care nu e istoric de modificări).

Rutele au **un singur `catch`** local, cel care traduce eșecul clasificat în `fail(message)` (permis explicit de SKILL.md §Erori pentru erori de rețea, ca la rutele Telegram); orice altă eroare urcă la dispatcher.

## 6. Declanșarea: manual, cu confirmare — și de ce nu automat

Toate trimiterile pleacă dintr-un gest explicit al operatorului și trec printr-un dialog de confirmare cu previzualizarea textului final, numărul de segmente și costul estimat:

| De unde | Dialog | `source` |
| --- | --- | --- |
| Situația plăților → „Notifică” pe rând | 2a (un destinatar, text editabil liber, file Reamintire / Personalizat) | `status-row` |
| Situația plăților → „Notifică toți” / „Notifică” din An școlar | 2b (șablon + previzualizare per destinatar, listă cu bife, excluși marcați) | `status-bulk` |
| De notificat → „Trimite SMS” pe rând / „Trimite tuturor” (înlocuiește sau completează „Copiază”) | 2a / 2b | `notify` |
| Mesaje SMS → panou detaliu → „Retrimite” | 2a precompletat cu textul din jurnal | `resend` |
| Notificări → card Furnizor → „Trimite SMS de test” | câmp telefon + confirmare „costă 1 SMS” | `test` |

**Nu există trimitere automată în v1**, deși `telegram-digest.mjs` ar fi un loc tentant (ex. „luni, toți restanțierii”). Motive, în ordinea greutății:

1. **Cost fără supraveghere.** Un rest calculat greșit (taxă necompletată, achitare încă nealocată — `hasUnassignedHint` din `useNotify`) trimis automat la 40 de părinți costă bani și credibilitate; la Telegram același rezumat ajunge la operator, care îl citește critic. Operatorul vrea să se uite pe listă înainte — asta face azi cu „Copiază”.
2. **Procesul programat e doar-citire prin design** (`openDatabaseReadOnly`, spec Telegram §3.2). SMS-ul trebuie să scrie în `sms_log`; ar cere fie un al doilea scriitor al bazei (contrazice „un singur scriitor”), fie un al doilea fișier de stare — complexitate pentru un beneficiu pe care utilizatorul nu l-a cerut.
3. **Audiența e externă.** Un mesaj greșit către operator se ignoră; unul către părinte cere explicații.

Ce rămâne posibil mai târziu, fără să contrazică designul: o linie în rezumatul Telegram „N părinți de notificat prin SMS — deschide Startica › De notificat”, adică automatizăm **reamintirea către operator**, nu trimiterea. Nu intră în v1.

## 7. Conștientizarea costului — garduri

SMS-ul e prima operațiune din Startica care cheltuie bani per apăsare. Gardurile, de la cel mai ieftin la cel mai dur:

1. **Contor vizibil peste tot unde se scrie text**: „N caractere · N SMS · ≈ X lei” (dialog 2a/2b sub textarea, editorul de șabloane). Trece pe roșu (`--pink-ink`) când textul comută pe UCS-2 (diacritice, emoji) — dublează prețul.
2. **„Fără diacritice la trimitere” implicit pornit** pe șablonul implicit (întrebare deschisă §10 dacă implicitul e corect pentru grădiniță; ș/ț fără diacritice sunt încă lizibile în SMS, iar economia e ~33%).
3. **Butonul de confirmare spune ce costă**: „Trimite 13 SMS (≈ 7,80 lei)” în 2b; „Trimite SMS (≈ 0,60 lei)” în 2a. Dezactivat cât textul e gol sau niciun destinatar bifat.
4. **Soldul în dialog și în cardul Furnizor**: „Sold sms.md: 123,45 lei” (din `GET /api/sms-status`); sub 20 × costul unui mesaj → avertizare yellow „Soldul ajunge pentru ~N mesaje”.
5. **Limita lunară** (`monthlyLimit`, bara „61 / 500” din 4a): refuz server-side înainte de orice apel (§5.2 pasul 2); la 80% bara devine `--orange`, la 100% roșie și butoanele de trimitere spun de ce sunt dezactivate.
6. **Verificarea soldului înainte de lot** (§5.2 pasul 3) și oprirea imediată la `402` — nimic debitat, restul `skipped`, dialogul rămâne deschis cu „11 trimise · 2 eșuate · 3 netrimise — Reîncearcă” (mockup 2b), unde „Reîncearcă” retrimite doar `failed` + `skipped`.
7. **„Notificat azi”** pe rând (din `GET /api/sms-last-notified`) și „Ultima notificare: ieri, 14:02, Reamintire restanță” în 2a. Un copil deja notificat **azi** e debifat implicit în 2b (rebifabil) — previne dublul lot din greșeală fără să blocheze un al doilea mesaj intenționat.
8. **Testul costă**: „Trimite SMS de test” cere numărul operatorului și spune „costă 1 SMS (≈ 0,30 lei)” — nu trimite la un număr fictiv, nu e gratuit.
9. **Nicio trimitere automată** (§6).

## 8. Interfața (`webapp/src/features/sms/`, schiță)

Urmează `docs/design/screens/14-sms.md` (4a, 4b) și `README.md` §„notificare SMS” (2a, 2b, 2c). Rutele existente: `/notificari` (fila nouă), `/situatia-platilor`, `/de-notificat`.

```
webapp/src/features/sms/
├── index.ts
├── useSmsStatus.ts (+ .test.ts)          # GET sms-status; connect / disconnect / sendTest — ca useTelegramStatus
├── useSmsTemplates.ts (+ .test.ts)       # list / save / delete / setDefault
├── useSmsLog.ts (+ .test.ts)             # GET sms-log?after=; filtre locale (stare, șablon, căutare); POST sms-refresh-statuses la montare + 30 s după un lot
├── useSmsSend.ts (+ .test.ts)            # POST sms-send; starea lotului (în curs / rezultat parțial / „Reîncearcă eșuatele”)
├── useSmsLastNotified.ts                 # GET sms-last-notified — consumat de status/notify pentru insigna „Notificat azi”
├── SmsMessagesPanel.tsx (+ .module.css, .test.tsx)   # 4a: statistici, bara limitei, tabel + panou detaliu, Retrimite / Corectează telefonul
├── SmsTemplatesPanel.tsx (+ .module.css, .test.tsx)  # 4b: lista șabloanelor + card Furnizor + editor cu pastile de variabile, contor, previzualizare cu primul restanțier
├── SmsProviderCard.tsx                   # cardul Furnizor SMS (Serviciu: sms.md fix, Expeditor, Cheie API mascată + Schimbă, Limită lunară, Trimite SMS de test, badge Conectat/Neconectat, Sold)
├── SmsConfirmDialog.tsx (+ .module.css, .test.tsx)   # 2a / 2b / 2c într-o singură componentă cu mod 'single' | 'bulk'; expus către status/ și notify/
└── sms-segment-counter.tsx               # „N caractere · N SMS · ≈ X lei”, pe countSmsSegments din #shared
```

- `NotificationsPage.tsx` capătă comutatorul `Canale · Mesaje SMS · Șabloane` (mockup 4a) — „Canale” e conținutul de azi (Telegram + preferințe), celelalte două montează panourile de mai sus. Fără selector de lună.
- `status/StatusPage.tsx` și `notify/NotifyPage.tsx` importă `SmsConfirmDialog` din `@features/sms` (un feature de `webapp/` poate importa altul — granițele stricte sunt pe `src/`, nu pe `webapp/`; de confirmat cu `arch-guard-webapp`, dacă a introdus o regulă între timp). Datele destinatarilor (copil, părinte, telefon normalizat, obligație) le pregătește ecranul apelant din `evaluateChildrenForMonth`, dialogul primește `recipients` gata și randează prin `planSmsBatch`.
- Editorul de șabloane: pastilele inserează `{copil}` etc. la cursor; textarea stochează textul plat cu acolade; previzualizarea folosește primul restanțier din luna curentă (sau date-exemplu dacă nu există). Avertizare yellow când o previzualizare trece de 2 segmente.
- Cheia API: câmp `type="password"`, se trimite o singură dată la „Conectează”; după, doar `tokenMasked` + „Schimbă” (care redeschide câmpul). Criteriul „cheia nu ajunge niciodată în frontend” din 14-sms.md e satisfăcut de `SmsStatus`, care nu are câmp `token`.

## 9. Testare

- **`#shared/domain/phone-number.test.mjs`**: fiecare formă acceptată → E.164; prefix invalid, 7/9 cifre, `+40…`, `+373 77…`, text gol → `null`; spații/cratime/paranteze ignorate.
- **`#shared/domain/sms-segments.test.mjs`**: 160 → 1 GSM, 161 → 2, 306 → 2, 307 → 3; un `ă` într-un text de 100 → UCS-2, 2 segmente; 70 → 1 UCS-2, 71 → 2; `€` și `{` numără dublu; gol → 0 (criteriul de acceptare din 14-sms.md).
- **`#shared/domain/sms-template.test.mjs`**: randarea mesajului implicit e identică caracter cu caracter cu vechiul `reminderMessage` (regresie); `{părinte}` gol elimină virgula; variabilă necunoscută rămâne literal; `stripDiacritics` pe „Bună ziua, Ștefan!” → „Buna ziua, Stefan!”.
- **`domain/sms-batch.test.mjs`**: destinatarul e părintele 1, cade pe părintele 2, exclus fără telefon valid (cu motiv); un mesaj per copil; textul e randat după fără-diacritice când e pornit; totalul segmentelor/costului.
- **`sms.service.test.mjs`**: `classifySmsFailure` pentru `fetch failed`, `AbortError`, 5xx, 429, 401, 402, 403, 422 pe `from`/`to`/`_`/`text`, cod necunoscut → `{ kind, scope }` din tabelul §4.3; `sendMessage` pune `X-Api-Token`, `Content-Type`, corpul `{ from, to, text }` și întoarce `data`; `getMessage` mapează stările 1/2/3/8/9/10.
- **Repository-uri**: `sms.json` lipsă → `null`, corupt → `null` + `console.error`, scriere atomică; `sms_templates` seed o singură dată (a doua deschidere nu dublează), `setDefault` mută flagul atomic, ștergerea implicitului refuzată; `sms_log` insert-apoi-update, contoare pe luna curentă ignoră `failed`, `lastNotifiedByChild` ignoră `failed` și `test`, `pendingDelivery` întoarce doar `sent` cu `providerId` și sub 48 h.
- **`sms-send.service.test.mjs`** (cu `fake-sms-api`): lot de 3 → 3 apeluri în ordine, 3 rânduri `sent` cu `segments`/`cost` din răspuns, un audit; al doilea răspunde 422 `to` → rândul 2 `failed`, rândul 3 tot `sent`; al doilea răspunde 402 → rândul 2 `failed`, rândul 3 `skipped` fără rând în jurnal, `stopped.code = 'INSUFFICIENT_BALANCE'`; 429 o dată → așteaptă `Retry-After` (cu `sleep` fals) și reușește; limita lunară depășită → 400 fără apel; soldul sub estimare → 400 fără apel.
- **`sms.routes.integration.test.mjs`**: `connect` cu token gol → 400 fără apel; 401 → 400 și niciun fișier; expeditor neaprobat → 400 cu lista; succes → fișier scris, audit **fără token**, `status.tokenMasked` are 4 caractere vizibile; `send` neconectat → 400; `template-save` cu `{necunoscut}` → 400; `template-delete` pe implicit → 400; `refresh-statuses` actualizează un rând `sent` → `delivered`; `last-notified` după un lot.
- **Arhitectură**: `import-boundaries.test.mjs` primește cazul negativ `sms-notify/... → #features/billing/...` și pozitiv `webapp/src/features/sms → #features/sms-notify/index.web.mjs`.
- **`webapp/`** (Vitest + RTL): contorul se înroșește pe UCS-2; „Trimite” dezactivat la text gol sau zero bifați; un copil notificat azi e debifat implicit; rezultatul parțial arată „N trimise · M eșuate · K netrimise” și „Reîncearcă” retrimite doar `failed`+`skipped`; cheia apare mascată după conectare.
- **Înainte de livrare, manual, cu un cont sms.md real** (nu se automatizează — costă): conectare cu expeditorul aprobat; „Trimite SMS de test” către telefonul operatorului; un lot de 2 din „De notificat”; `refresh-statuses` aduce „Livrat”; contorul local = `segments` din răspuns pe un text cu și fără diacritice.

## 10. Decizii deschise (de confirmat înainte de planul de implementare)

1. **Numele de expeditor**: „Startica” sau numele grădiniței? Se înregistrează în dashboard-ul sms.md și cere aprobarea operatorilor (zile); trebuie pornit **acum**, în paralel cu implementarea. Max 15 caractere.
2. **Contul sms.md**: sms.md lucrează doar cu persoane juridice (contract, factură, TVA). Cine deschide contul și pune depozitul minim de 500 MDL — grădinița?
3. **„Fără diacritice la trimitere” implicit pornit** pe șablonul implicit (economie ~33%, text fără ș/ț/ă)? Sau implicit oprit și doar avertizare de cost?
4. **Al doilea șablon seed-uit „Plată parțială”** (mockup 2a îl listează) — cu ce text? Sau pornim doar cu „Reamintire restanță” și operatorul își face restul?
5. **Ambii părinți**: un SMS per copil (părintele 1, cu cădere pe 2) — sau opțiune „trimite și părintelui 2” în 2b, cu cost dublu vizibil?
6. **Limita lunară implicită 500** (≈ 150 MDL/lună, propunerea din README) — ok? Și maximul editabil (5000)?
7. **Starea „Necunoscut”** (`unknown`, după 48 h fără răspuns terminal) — o afișăm ca a patra insignă neutră (adăugare la mockup) sau o vărsăm în „Eșuat”?
8. **Retenția jurnalului**: păstrăm `sms_log` pe termen nelimitat (conține telefoane și nume) sau golim textul după 12 luni, ca `healthNotes`?
9. **„De notificat” → „Copiază”** rămâne lângă „Trimite SMS” (pentru cine încă trimite manual de pe telefon) sau dispare?
10. **Limita de rată**: 1 mesaj/s e presupunere (nedocumentat de sms.md, §4.6). Acceptăm să o aflăm la primul lot real (un 429 oprește lotul curat, fără cost) sau întrebăm suportul înainte?
11. **Ce se întâmplă la sold insuficient în mijlocul lotului** e decis (§4.3: oprire, restul `skipped`, „Reîncearcă”); de confirmat că nu se dorește în schimb o „coadă” care reia automat după alimentare — propunerea e **nu** (ar fi trimitere fără operator).
12. **Faze de livrare** (propunere, de confirmat ordinea): (P1) `#shared` + `sms-notify` server + card Furnizor + șabloane + „Trimite SMS” din De notificat; (P2) dialogurile 2a/2b în Situația plăților — depinde de ecranul 07, care azi e un stub (vezi `INTREBARI.md`); (P3) fila „Mesaje SMS” cu jurnal și stări de livrare. P1 e utilizabil singur.
