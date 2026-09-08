// Browser connector cannot start with this machine's Node 22.17 runtime.
// Isolated headless Chrome test; never uses the user's Chrome profile or production DB.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApplication } from '../startica_server.mjs';
const dir = mkdtempSync(join(tmpdir(), 'startica-browser-'));
const app = createApplication({ dataDir: join(dir, 'data'), backupDir: join(dir, 'backups') });
await new Promise(r => app.server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${app.server.address().port}`;
console.log('UI test server ready');
const executable = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
if (!existsSync(executable)) throw Error('Chrome not installed.');
const chrome = spawn(
  executable,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    `--user-data-dir=${join(dir, 'profile')}`,
    '--window-size=1440,1000',
    'about:blank',
  ],
  { windowsHide: true, stdio: 'ignore' },
);
let ws,
  seq = 0;
const pending = new Map(),
  errors = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, message) {
  for (let n = 0; n < 100; n++) {
    if (await fn()) return;
    await sleep(100);
  }
  throw Error(message);
}
try {
  await until(() => existsSync(join(dir, 'profile', 'DevToolsActivePort')), 'Headless browser did not start');
  const port = readFileSync(join(dir, 'profile', 'DevToolsActivePort'), 'utf8').split('\n')[0];
  console.log('Headless Chrome ready');
  const target = await (
    await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, {
      method: 'PUT',
      signal: AbortSignal.timeout(5000),
    })
  ).json();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    const timer = setTimeout(() => j(Error('WebSocket timeout')), 5000);
    ws.onopen = () => {
      clearTimeout(timer);
      r();
    };
    ws.onerror = j;
  });
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.method === 'Runtime.exceptionThrown')
      errors.push(m.params.exceptionDetails.text + ' ' + JSON.stringify(m.params.exceptionDetails.exception));
    if (m.id) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.reject(m.error) : p.resolve(m.result);
    }
  };
  ws.onclose = e => console.error('Browser connection closed: ' + e.code + ' ' + e.reason);
  const command = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      const timer = setTimeout(() => reject(Error('Timeout: ' + method)), 5000);
      pending.set(id, {
        resolve: value => {
          clearTimeout(timer);
          resolve(value);
        },
        reject,
      });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async expression => {
    const r = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  await command('Runtime.enable');
  await until(
    () => evaluate("document.getElementById('saveIndicator')?.dataset.state==='saved'"),
    'Application failed to load',
  );
  console.log('Application loaded');
  assert.equal(await evaluate("!!document.querySelector('.topbar #saveIndicator')"), true);
  await until(() => evaluate("document.querySelector('.brand img')?.naturalWidth > 0"), 'Official logo failed to load');
  await evaluate(
    "document.querySelector('[data-create=children]').click();document.getElementById('editorForm').elements.name.dispatchEvent(new Event('input',{bubbles:true}))",
  );
  assert.equal(await evaluate("document.getElementById('saveIndicator').dataset.state"), 'pending');
  await evaluate("document.querySelector('[data-close=editor]').click()");
  await until(
    () => evaluate("document.getElementById('saveIndicator').dataset.state==='saved'"),
    'Cancel should clear draft status',
  );
  await evaluate("document.querySelector('[data-create=children]').click()");
  assert.equal(
    await evaluate(
      "(()=>{const f=document.getElementById('editorForm');f.elements.name.value='Test';f.elements.name.dispatchEvent(new Event('input',{bubbles:true}));const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;})()",
    ),
    true,
  );
  // Hold the response after the server has committed, then simulate its loss.
  // Retrying must reuse the request ID and produce just one child.
  await evaluate(
    "window.testFetch=window.fetch;window.fetch=async(...args)=>{if(args[0]==='/api/record'){const response=await window.testFetch(...args);return new Promise((resolve,reject)=>{window.failSave=()=>reject(new TypeError('Test lost response'));});}return window.testFetch(...args);}",
  );
  await evaluate(
    "(()=>{const f=document.getElementById('editorForm');f.elements.name.value='Copil <test>';f.elements.parent.value='Părinte test';f.elements.parent2.value='Al doilea părinte';f.elements.phone2.value='060123456';f.elements.group.value='1';f.elements.attendanceDate.value='2026-09-01';f.elements.fee.value='2000';f.elements.feeFrom.value='2026-09';f.elements.statusFrom.value='2026-09';f.requestSubmit();})()",
  );
  await until(() => evaluate("typeof window.failSave==='function'"), 'Save did not reach test server');
  assert.equal(await evaluate("document.getElementById('saveIndicator').dataset.state"), 'pending');
  assert.match(await evaluate("document.getElementById('saveStatus').textContent"), /Se salvează/);
  await evaluate('window.fetch=window.testFetch;window.failSave()');
  await until(
    () => evaluate("document.getElementById('saveIndicator').dataset.state==='error'"),
    'Lost response must show red',
  );
  await evaluate("document.querySelector('[data-close=editor]').click()");
  assert.equal(await evaluate("document.getElementById('saveIndicator').dataset.state"), 'error');
  await evaluate("document.getElementById('reloadButton').click()");
  await until(() => evaluate("!document.getElementById('editor').open"), 'Child save failed');
  await until(
    () => evaluate("document.getElementById('saveIndicator').dataset.state==='saved'"),
    'Retry must confirm saved status',
  );
  assert.equal((await (await fetch(url + '/api/state')).json()).state.children.length, 1);
  assert.match(await evaluate("document.getElementById('childrenTable').textContent"), /Copil <test>/);
  assert.equal(await evaluate("document.querySelector('test') !== null"), false);
  await evaluate("document.querySelector('[data-create=payments]').click()");
  assert.match(await evaluate("document.getElementById('childrenTable').textContent"), /Al doilea părinte/);
  await evaluate(
    "(()=>{const f=document.getElementById('editorForm');f.elements.childId.selectedIndex=1;f.elements.date.value='2026-09-08';f.elements.tenderCash.value='1000';f.elements.tenderCard.value='2000';f.elements.tenderCard.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-month]').value='2026-09';document.querySelector('[data-amount]').value='2000';document.getElementById('addAllocation').click();const rows=document.querySelectorAll('.allocation');rows[1].querySelector('[data-month]').value='2026-10';rows[1].querySelector('[data-amount]').value='500';})()",
  );
  assert.equal(await evaluate("document.getElementById('editorForm').elements.amount.value"), '3000.00');
  await evaluate("document.getElementById('editorForm').requestSubmit()");
  await until(() => evaluate("!document.getElementById('editor').open"), 'Payment save failed');
  assert.match(await evaluate("document.getElementById('paymentsTable').textContent"), /Cash:.*Card:/);
  assert.match(await evaluate("document.getElementById('incomeMethods').textContent"), /Cash:.*1.?000.*Card:.*2.?000/);
  await evaluate("document.querySelector('[data-action=edit][data-type=payments]').click()");
  assert.equal(await evaluate("document.getElementById('editorForm').elements.tenderCash.value"), '1000');
  assert.equal(await evaluate("document.getElementById('editorForm').elements.tenderCard.value"), '2000');
  await evaluate("document.querySelector('[data-close=editor]').click()");
  assert.match(await evaluate("document.getElementById('incomeStat').textContent"), /3.?000/);
  assert.match(await evaluate("document.getElementById('advanceStat').textContent"), /500/);
  await evaluate("document.querySelector('[data-view=status]').click()");
  assert.match(await evaluate("document.getElementById('statusTable').textContent"), /Plătit/);
  await evaluate("document.querySelector('[data-action=edit][data-type=children]').click()");
  await evaluate(
    "(()=>{const f=document.getElementById('editorForm');f.elements.status.value='Retras';f.elements.statusFrom.value='2026-10';f.elements.withdrawalDate.value='2026-09-30';f.requestSubmit();})()",
  );
  await until(() => evaluate("!document.getElementById('editor').open"), 'Child status edit failed');
  await evaluate("document.querySelector('[data-action=edit][data-type=children]').click()");
  assert.equal(await evaluate("document.getElementById('editorForm').elements.status.value"), 'Retras');
  await evaluate(
    "(()=>{const f=document.getElementById('editorForm');f.elements.phone.value='123';f.requestSubmit();})()",
  );
  await until(() => evaluate("!document.getElementById('editor').open"), 'Phone edit failed');
  assert.match(await evaluate("document.getElementById('childrenTable').textContent"), /Retras/);
  assert.match(await evaluate("document.getElementById('statusTable').textContent"), /Plătit/);
  await evaluate("document.querySelector('[data-action=profile]').click()");
  assert.match(await evaluate("document.getElementById('profileBody').textContent"), /3.?000/);
  await evaluate(
    "document.querySelector('[data-close=profile]').click();document.querySelector('[data-view=review]').click()",
  );
  assert.match(await evaluate("document.getElementById('reviewList').textContent"), /Avans nerepartizat/);
  await evaluate(
    "document.querySelector('[data-view=settings]').click();document.getElementById('restoreButton').click()",
  );
  await until(
    () =>
      evaluate(
        "document.getElementById('restorePreview').textContent.includes('3000') || document.getElementById('restorePreview').textContent.includes('3.000') || document.getElementById('restorePreview').textContent.includes('3 000')",
      ),
    'Restore preview failed',
  );
  await evaluate(
    "document.querySelector('[data-close=restoreDialog]').click();document.querySelector('[data-view=audit]').click()",
  );
  await until(
    () => evaluate("document.getElementById('auditList').textContent.includes('modificare')"),
    'Audit UI failed',
  );
  await evaluate(
    "document.querySelector('[data-view=settings]').click();const dir=document.getElementById('externalDir');dir.value='C:\\\\does-not-exist-startica-test';dir.dispatchEvent(new Event('input',{bubbles:true}));window.dispatchEvent(new Event('focus'))",
  );
  assert.equal(await evaluate("document.getElementById('saveIndicator').dataset.state"), 'pending');
  await sleep(300);
  assert.match(await evaluate("document.getElementById('externalDir').value"), /does-not-exist/);
  await evaluate("document.getElementById('settingsForm').requestSubmit()");
  await until(
    () => evaluate("document.getElementById('saveIndicator').dataset.state==='error'"),
    'Invalid settings must show red',
  );
  await evaluate(
    "document.getElementById('externalDir').value='';document.getElementById('externalDir').dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('settingsForm').requestSubmit()",
  );
  await until(
    () => evaluate("document.getElementById('saveIndicator').dataset.state==='saved'"),
    'Settings retry must show green',
  );
  await evaluate(
    "window.fetch=async()=>{throw new TypeError('Test offline')};window.dispatchEvent(new Event('focus'))",
  );
  await until(
    () => evaluate("document.getElementById('saveIndicator').dataset.state==='error'"),
    'Offline server must show red',
  );
  await evaluate("window.fetch=window.testFetch;document.getElementById('reloadButton').click()");
  await until(
    () => evaluate("document.getElementById('saveIndicator').dataset.state==='saved'"),
    'Connection recovery must show green',
  );
  const csv =
    'ID (Nr. contract),Nume copil,Parinte,Telefon,Data nasterii,Data frecventarii\n888,CSV <test>,Parinte CSV,060999999,01.01.2022,01.09.2026';
  const chooseCsv = `(()=>{const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(csv)}],'copii.csv',{type:'text/csv'}));const input=document.getElementById('childrenCsvInput');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`;
  await evaluate("document.querySelector('[data-view=children]').click()");
  await evaluate(chooseCsv);
  await until(() => evaluate("document.getElementById('csvDialog').open"), 'CSV preview did not open');
  assert.match(await evaluate("document.getElementById('csvPreview').textContent"), /1 copii noi/);
  assert.equal((await (await fetch(url + '/api/state')).json()).state.children.length, 1);
  assert.equal(await evaluate("document.getElementById('commitCsv').disabled"), true);
  await evaluate(
    "document.getElementById('csvConfirm').value='IMPORT COPII';document.getElementById('csvConfirm').dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('commitCsv').click()",
  );
  await until(() => evaluate("!document.getElementById('csvDialog').open"), 'CSV import failed');
  const imported = (await (await fetch(url + '/api/state')).json()).state;
  assert.equal(imported.children.length, 2);
  assert.equal(imported.payments.length, 1);
  assert.equal(imported.payments[0].amount, 3000);
  await evaluate(chooseCsv);
  await until(() => evaluate("document.getElementById('csvDialog').open"), 'CSV reimport preview failed');
  assert.match(await evaluate("document.getElementById('csvPreview').textContent"), /0 copii noi · 1 existenți/);
  assert.equal(await evaluate("document.querySelector('test') !== null"), false);
  await evaluate("document.querySelector('[data-close=csvDialog]').click()");
  assert.deepEqual(errors, []);
  console.log(
    'PASS: header saved/draft/saving/error states, cancel, lost-response retry without duplicates, settings preservation/retry, offline/reconnect; load, child, XSS, payment allocations, dashboard, profile, review, restore preview, audit.',
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  ws?.close();
  chrome.kill();
  app.server.closeAllConnections();
  await app.close();
  await sleep(1200);
  if (
    resolve(dir).startsWith(resolve(tmpdir()) + '\\startica-browser-') ||
    resolve(dir).startsWith(resolve(tmpdir()) + '/startica-browser-')
  ) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      console.log('Temporary test folder retained: ' + dir);
    }
  }
}
