// One-time provisional data fix (2026-09-29), per the user's decision recorded in
// docs/design/RASPUNSURI.md (2026-09-29): the 7 payments listed in
// docs/design/INTREBARI.md §B1 with an unrecognized raw `method` ("Mixtă" / "De verificat")
// are set to `method: 'Cash'` so they stop showing as "De rezolvat", accepting that the
// per-method totals for just these 7 are temporarily approximate until someone manually
// reconciles them. This does NOT change normalizeTenderMethod() or its alias map — unknown
// method strings on any OTHER record still surface for review as before. Run once, by hand:
//   node scripts/migrate/b1-fix-mixed-payments.mjs
import { randomUUID } from 'node:crypto';

const BASE_URL = process.env.STARTICA_BASE_URL || 'http://127.0.0.1:8765';

const PAYMENT_IDS = ['PAY-0055', 'PAY-0447', 'PAY-0452', 'PAY-0558', 'PAY-0574', 'PAY-0575', 'PAY-0783'];

async function getJson(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  const body = await res.json();
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${body.error || JSON.stringify(body)}`);
  return body;
}

async function postJson(path, body, token) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Startica-Token': token },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${json.error || JSON.stringify(json)}`);
  return json;
}

async function main() {
  const session = await getJson('/api/session');
  const token = session.token;

  const backup = await postJson('/api/backup', {}, token);
  console.log('Backup OK:', JSON.stringify(backup));

  for (const id of PAYMENT_IDS) {
    const { state, revision } = await getJson('/api/state');
    const payment = state.payments.find(p => p.id === id);
    if (!payment) {
      console.error(`STOP: ${id} nu mai există în state.payments.`);
      process.exitCode = 1;
      return;
    }
    console.log(`${id}: method brut curent = ${JSON.stringify(payment.method)}`);
    if (['Cash', 'Card', 'Transfer'].includes(payment.method)) {
      console.error(`STOP: ${id} are deja method=${payment.method} — nu mai e „de rezolvat”, verifică manual.`);
      process.exitCode = 1;
      return;
    }
    const updated = { ...payment, method: 'Cash' };
    const result = await postJson(
      '/api/record',
      { type: 'payments', mode: 'update', record: updated, revision, requestId: randomUUID() },
      token,
    );
    const saved = result.state.payments.find(p => p.id === id);
    console.log(`${id}: method nou = ${JSON.stringify(saved?.method)} (revision ${result.revision})`);
  }

  console.log('\nGata. Rulează scripts/diagnostic/b1-payment-methods.mjs pentru verificare.');
}

main().catch(e => {
  console.error('EROARE:', e.message);
  process.exitCode = 1;
});
