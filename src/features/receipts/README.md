# receipts

Numerotarea confirmării de plată (16b, `docs/design/screens/15-tiparire.md`). Numărul se asignează o singură dată, la prima tipărire a unei achitări, din `kindergarten.nextReceiptNumber` (`#shared/domain/kindergarten-settings.mjs`), care crește la fel. O retipărire a aceleiași achitări refolosește numărul salvat pe `Payment.receiptNumber`, nu trage unul nou.

Modul **dependent**: are nevoie de `recordRepository`, de `auditTrail`, de tranzacția cu revizie și de settings (pentru contorul grădiniței). Le primește prin porturi injectate de `app/`, fără să importe alt feature.

## Public API

### `index.server.mjs`

| Export | Rol |
| --- | --- |
| `createReceiptNumberingService({ recordRepository, auditTrail, runRevisionTransaction, readSetting, writeSetting })` | `assignReceiptNumber(request)` |
| `createReceiptNumberingRoutes({ receiptNumberingService })` | `POST /api/payments-receipt-number`, corp `{ paymentId, revision, requestId }` |

Ecranul de confirmare (16b) e randat de React, în `webapp/src/features/payments/PaymentReceipt.tsx` — apelează ruta prin `session.mutate`, la prima randare, doar dacă achitarea nu are deja `receiptNumber`.

## Structură

```
receipts/
├── README.md
├── receipts.types.d.mts
├── index.server.mjs
└── server/
    ├── receipt-numbering.service.mjs   # ★ asignare, în tranzacție
    ├── receipt-numbering.service.test.mjs
    ├── receipt-numbering.routes.mjs
    └── receipt-numbering.routes.integration.test.mjs
```

## Garanții

- Asignarea rulează **în tranzacție**: citirea achitării, citirea/scrierea contorului din settings și salvarea achitării numerotate sunt atomice.
- O achitare cu `receiptNumber` deja setat nu se schimbă — nici la o reluare cu alt `requestId`, nici la o retipărire.
- O achitare ștearsă între timp respinge cererea (409), fără să consume un număr din contor.

## Teste

```
node --test "src/features/receipts/**/*.test.mjs"
```
