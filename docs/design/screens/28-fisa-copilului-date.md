# 28 — Fișa copilului: modelul de date

**Referință:** `Copii.dc.html#2b`. **Deblochează:** CF-2, CF-4, CF-7 din `AUDIT-UI-2026-09-28.md`, A-5 din Asociere (9c). **Depinde de:** `09-copii-fisa.md`, `18-sincronizare.md`.

Plan tehnic în `docs/superpowers/plans/` înainte de cod, ca la EUR/BNM și filiale. Test care pică înainte de fiecare pas.

## 0. Decizii (utilizator, 29.09)
- Numele rămâne **un singur câmp** (`Child.name`).
- „Date personale” = data nașterii + **alergii și date medicale** (`healthNotes`, există) + **persoane autorizate să ridice copilul**. Fără IDNP, adresă, certificat.
- Părinții rămân **2 sloturi fixe**; se adaugă doar relația (Mamă/Tată/Bunic…).
- **Note:** listă cu text, dată, autor; editabile; ștergerea are „Anulează”.
- **Documente:** orice PDF/JPG/PNG, max. 10 MB, **se sincronizează prin server**.
- **Plătitori reținuți:** nume din extras + IBAN când există; **pe filială** (plățile sunt pe filială).
- Nota veche (`Child.notes`) devine prima notă din listă, la migrare.

## 1. De ce kind-uri separate
Notele, documentele și aliasurile se adaugă des, de pe calculatoare diferite. Dacă ar sta ca liste pe `Child`, două note scrise în aceeași zi pe A și B ar da **conflict pe tot copilul** (CONFLICT_KIND `children`). Ca înregistrări separate, fiecare notă e o inserare independentă, fără conflict. Pe `Child` rămân doar câmpurile editate rar.

## 2. Schema (`record-schema.mjs`, `record-types.d.mts`)

### 2.1 `Child` — câmpuri noi
```ts
parentRelation?: string;      // „Mamă”, „Tată”, „Bunică”… liber, ≤ 40
parent2Relation?: string;
pickupPersons?: PickupPerson[]; // ≤ 10
interface PickupPerson { name: string; relation?: string; phone?: string; note?: string } // note ex. „marți, joi”
```
- `notes` **se păstrează în schemă** (read-only după migrare, pentru backup-uri vechi), dar UI-ul nu-l mai scrie.
- `pickupPersons` nu e sensibil; `healthNotes` rămâne în `SENSITIVE_FIELDS`.

### 2.2 Kind nou `child_notes`
```ts
interface ChildNote {
  id: string;            // NOTE-…
  childId: string;
  text: string;          // 1…4000, trim
  createdAt: string;     // ISO
  createdBy: string;     // deviceName din /api/session (nu există conturi); „” la migrare
  updatedAt?: string;    // ISO, doar dacă s-a editat → „editată” în UI
  migrated?: boolean;    // true = venită din Child.notes
  archived?: boolean; archivedAt?: string | null;
}
```

### 2.3 Kind nou `child_documents` (doar metadate)
```ts
interface ChildDocument {
  id: string;            // DOC-…
  childId: string;
  name: string;          // numele afișat, editabil
  mime: 'application/pdf' | 'image/jpeg' | 'image/png';
  size: number;          // octeți, ≤ 10_485_760
  sha256: string;        // hex, cheia fișierului
  uploadedAt: string; uploadedBy: string;
  archived?: boolean; archivedAt?: string | null;
}
```

### 2.4 Kind nou `payer_aliases`
```ts
interface PayerAlias {
  id: string;            // ALIAS-…
  childId: string;
  name: string;          // cum apare în extras, păstrat pentru afișare
  nameKey: string;       // normalizat: majuscule, fără diacritice, spații comprimate, cuvinte sortate
  iban?: string;         // fără spații, majuscule; validat /^MD\d{2}[A-Z0-9]{20}$/ sau IBAN generic
  createdAt: string;
  lastUsedAt?: string;
}
```
- Unic pe `(nameKey, iban ?? '')`. Același plătitor la doi copii (frați) e permis: două înregistrări.
- Ștergere = ștergere reală (nu arhivare), cu „Anulează” din toast.

### 2.5 Peste tot unde intră un kind nou (lecția de la `charges`)
`TYPES`, `FIELDS`, `emptyState`, `validateState` (copilul trebuie să existe), `RecordsSnapshot`/`RecordByType`, `sync-server/src/change-policy.mjs` `RECORD_KINDS`, testul `tests/sync-shared-constants.test.mjs`, `upgradeSnapshot()`, exportul Excel (câte o foaie lizibilă), importul (lipsă = listă goală), jurnalul de modificări. Niciunul nu intră în CONFLICT_KIND: ultimul care scrie câștigă, pe înregistrare.

## 3. Migrare (o singură dată, idempotentă)
- Pentru fiecare copil cu `notes` ne-gol și fără `child_notes` cu `migrated:true`: creează `NOTE-<childId>-legacy` (id determinist, ca două calculatoare să nu dubleze nota), `createdAt` = `contractDate` sau `archivedAt` sau momentul migrării, `createdBy: ''`, `migrated: true`.
- `Child.notes` nu se golește (backup-urile vechi rămân coerente).
- Test: rulată de două ori și pe două calculatoare sincronizate → o singură notă.

## 4. Fișierele documentelor
- **Local:** `<folder filială>/documente/<sha256>` (content-addressed, fără extensie). Același fișier încărcat de două ori = un singur blob.
- **API local:** `POST /api/children/:id/documents` (multipart; verifică mime după primii octeți, nu doar extensia; 413 peste 10 MB), `GET /api/documents/:id` (stream cu `Content-Disposition` pe `name`), `PATCH` (redenumire), arhivare prin `/api/record`.
- **Sincronizare:** metadatele merg prin outbox ca orice kind. Blob-ul separat:
  - `PUT /blobs/:sha256` pe `sync-server` (idempotent, verifică hash-ul, 10 MB), `GET /blobs/:sha256`, `HEAD` pentru „există deja”.
  - Coadă proprie de urcare (`sync_blob_outbox`), ca un fișier mare să nu blocheze sincronizarea datelor. Urcă după ce metadata a fost acceptată.
  - Descărcare **leneșă**: la primirea metadatelor, blob-ul se cere în fundal; până atunci cardul arată „Se descarcă de pe server…”. Offline și fără blob → „Disponibil după conectare”, clic dezactivat.
  - Blob-urile orfane (nicio metadată ne-arhivată de 30 de zile) se curăță la backup-ul zilnic, pe ambele părți.
- **Backup:** folderul `documente/` intră în backup-ul filialei. Exportul Excel conține doar lista, nu fișierele.

## 5. Plătitori reținuți în Asociere (9c)
- La „Salvează asocierea” cu „Ține minte plătitorul” bifat: `nameKey` + `iban` extrase din `payment.sourceName`/`original` (funcție pură `extractPayer(payment)` în `payment-assignment/domain`, testată pe extrase reale din import).
- `listUnassignedPayments`: aliasurile se verifică **primele**. Potrivire pe IBAN → „Potrivire mare”, motiv „Plătitor reținut (IBAN)”. Doar pe `nameKey` → „Potrivire mare” dacă e un singur copil, altfel „Posibil”, motiv „Plătitor reținut”. `lastUsedAt` se actualizează la asociere.
- Coloana **Plătitor** din Achitări (5a) arată `alias.name` când plata a fost asociată printr-un alias.

## 6. UI (2b)
- **Date personale:** Data nașterii; „Alergii, sănătate” (`healthNotes`, roșu `#a3361f` dacă e ne-gol); Părinți cu relația sub nume; „Pot ridica copilul” cu nume · relație · notă · telefon și „+ Adaugă” (deschide 15a la secțiunea respectivă).
- **Note:** „+ Notă” deschide editorul inline deasupra listei (Ctrl+Enter salvează, Esc renunță). Cea mai recentă pe `--yellow-soft`, restul `--neutral-softer`. Sub text: `dd.mm.yyyy, HH:MM · autor`, plus „· editată” dacă are `updatedAt`, sau „nota din fișa veche” dacă e `migrated`. „⋯” → Editează / Șterge (toast „Notă ștearsă.” + „Anulează”). Mai mult de 5 → „Toate notele (N)”.
- **Documente:** grid 3, icon colorat pe tip (PDF/JPG/PNG), nume, `dată · mărime` sau starea de descărcare. Trage fișierul peste card sau „+ Încarcă”. „⋯” → Deschide / Redenumește / Arhivează.
- **Plătitori reținuți:** rând cu nume (majuscule, ca în extras), IBAN mascat (primele 4 + ultimele 4) sau „fără IBAN, doar numele”, `din dd.mm.yyyy · N achitări`, „×” (fără confirmare, cu „Anulează”). Card ascuns dacă lista e goală.

## 7. Criterii de acceptare
- [ ] Nota veche apare prima în listă, marcată „nota din fișa veche”; migrarea pe A și B sincronizate dă o singură notă.
- [ ] Două note scrise simultan pe A și B pentru același copil ajung pe ambele, fără conflict în `/conflicte`.
- [ ] Nota ștearsă revine cu „Anulează”; nota editată arată „editată”.
- [ ] Un PDF de 3 MB încărcat pe A se deschide pe B după sincronizare; unul de 11 MB e refuzat cu mesaj clar.
- [ ] Offline, un document fără blob local arată „Disponibil după conectare”.
- [ ] După „Ține minte plătitorul”, următorul extras de la același IBAN apare primul, „Potrivire mare”, motiv „Plătitor reținut (IBAN)”.
- [ ] „×” pe un alias îl scoate din sugestii; „Anulează” îl readuce.
- [ ] Persoanele autorizate apar în fișă, dar nu pe foaia săptămânii (fără date de contact, `26-foaie-saptamana.md`).
- [ ] `sync-shared-constants.test.mjs` verde cu cele 3 kind-uri noi; export + reimport Excel dintr-un backup vechi (fără kind-urile noi) funcționează.
