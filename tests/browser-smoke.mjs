// Browser connector cannot start with this machine's Node 22.17 runtime.
// Isolated headless Chrome test; never uses the user's Chrome profile or production DB.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApplication } from '../startica_server.mjs';
const dir = mkdtempSync(join(tmpdir(), 'startica-browser-'));
const screenshotDir =
  process.env.STARTICA_UI_SCREENSHOTS === '1' ? mkdtempSync(join(tmpdir(), 'startica-ui-shots-')) : null;
// autoBackupIntervalMs: 0 => backup după fiecare scriere. Testul verifică
// dialogul de restaurare, care previzualizează cel mai recent backup; politica
// de rărire este acoperită separat, în tests/fixes.test.mjs.
const app = createApplication({ dataDir: join(dir, 'data'), backupDir: join(dir, 'backups'), autoBackupIntervalMs: 0 });
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
  // Raportările și alocările rămân în aceeași lună, indiferent când rulează testul.
  await evaluate(
    "document.getElementById('selectedMonth').value='2026-09';document.getElementById('selectedMonth').dispatchEvent(new Event('change'))",
  );
  console.log('Application loaded');
  // Un modul inexistent cerut la /src/... dovedește că import map-ul a trecut de CSP și a rezolvat aliasul.
  const aliasResolution = await evaluate(
    "import('#shared/alias-probe.mjs').then(() => 'loaded', error => String(error.message))",
  );
  assert.doesNotMatch(aliasResolution, /Failed to resolve module specifier/, aliasResolution);
  assert.match(aliasResolution, /\/src\/shared\/alias-probe\.mjs/, aliasResolution);
  assert.equal(await evaluate("!!document.querySelector('.system-status #saveIndicator')"), true);
  assert.equal(await evaluate("!!document.querySelector('.system-status #backupStatus')"), true);
  assert.equal(await evaluate("document.querySelectorAll('#primaryNav .nav').length"), 12);
  assert.equal(
    await evaluate("new Set([...document.querySelectorAll('#primaryNav .nav')].map(b=>b.dataset.view)).size"),
    12,
  );
  assert.deepEqual(
    await evaluate(
      "['activeChildrenStat','occupiedGroupsStat','incompleteChildrenStat'].map(id=>document.getElementById(id).textContent)",
    ),
    ['0', '0', '0'],
  );
  assert.equal(await evaluate("!!document.querySelector('#alerts .attention-empty')"), true);
  const viewport = async width => {
    await command('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  };
  const noPageOverflow = async () =>
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), true);
  const screenshot = async name => {
    if (!screenshotDir) return;
    const { data } = await command('Page.captureScreenshot', { format: 'png' });
    const path = join(screenshotDir, name + '.png');
    writeFileSync(path, Buffer.from(data, 'base64'));
    console.log('UI screenshot: ' + path);
  };
  for (const width of [1440, 1024, 390]) {
    await viewport(width);
    await noPageOverflow();
    if (width === 390)
      assert.equal(await evaluate("document.querySelector('.topbar').getBoundingClientRect().height < 360"), true);
    await evaluate("document.getElementById('monthTrigger').click()");
    assert.equal(await evaluate("document.getElementById('monthMenu').hidden"), false);
    assert.equal(
      await evaluate(
        "(()=>{const r=document.getElementById('monthMenu').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})()",
      ),
      true,
    );
    assert.equal(
      await evaluate(
        "(()=>{const menu=document.getElementById('monthMenu').getBoundingClientRect();const trigger=document.getElementById('monthTrigger').getBoundingClientRect();return menu.top-trigger.bottom>=0&&menu.top-trigger.bottom<=12;})()",
      ),
      true,
    );
    await screenshot('dashboard-' + width);
    await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
    assert.equal(await evaluate("document.getElementById('monthMenu').hidden"), true);
    await evaluate(
      "document.getElementById('monthTrigger').focus();document.getElementById('monthTrigger').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}))",
    );
    assert.equal(
      await evaluate("document.activeElement.dataset.month === document.getElementById('selectedMonth').value"),
      true,
    );
    await evaluate(
      "document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))",
    );
    assert.equal(await evaluate("document.activeElement.dataset.month.endsWith('-10')"), true);
    await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
    assert.equal(await evaluate('document.activeElement.id'), 'monthTrigger');
  }
  assert.equal(await evaluate("getComputedStyle(document.getElementById('primaryNav')).display"), 'none');
  await evaluate("document.getElementById('navToggle').click()");
  assert.equal(await evaluate("document.getElementById('navToggle').getAttribute('aria-expanded')"), 'true');
  assert.notEqual(await evaluate("getComputedStyle(document.getElementById('primaryNav')).display"), 'none');
  await evaluate("document.querySelector('#primaryNav [data-view=children]').click()");
  assert.equal(await evaluate("document.querySelector('.view.active').id"), 'children');
  assert.equal(await evaluate("document.getElementById('navToggle').getAttribute('aria-expanded')"), 'false');
  assert.equal(await evaluate("document.querySelector('#primaryNav [aria-current=page]').dataset.view"), 'children');
  await noPageOverflow();
  await screenshot('children-mobile');
  await evaluate(
    "document.getElementById('navToggle').click();document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))",
  );
  assert.equal(await evaluate('document.activeElement.id'), 'navToggle');
  await viewport(1440);
  assert.notEqual(await evaluate("getComputedStyle(document.getElementById('primaryNav')).display"), 'none');
  await evaluate("document.querySelector('#primaryNav [data-view=dashboard]').click()");
  await until(() => evaluate("document.querySelector('.brand img')?.naturalWidth > 0"), 'Official logo failed to load');
  await evaluate(
    "document.querySelector('#primaryNav [data-view=groups]').click();document.getElementById('groupNameInput').value='Grupa test';document.getElementById('groupCapacityInput').value='12';document.getElementById('groupCreateForm').requestSubmit()",
  );
  await until(
    () => evaluate("document.querySelectorAll('#groupsGrid [data-group]').length===1"),
    'Group creation failed',
  );
  const groupId = (await (await fetch(url + '/api/state')).json()).state.groups[0].id;
  await evaluate("document.querySelector('#primaryNav [data-view=dashboard]').click()");
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
    `(()=>{const f=document.getElementById('editorForm');f.elements.name.value='Copil <test>';f.elements.parent.value='Părinte test';f.elements.parent2.value='Al doilea părinte';f.elements.phone2.value='060123456';f.elements.groupId.value=${JSON.stringify(groupId)};f.elements.attendanceDate.value='2026-09-01';f.elements.fee.value='2000';f.elements.feeFrom.value='2026-09';f.elements.statusFrom.value='2026-09';f.requestSubmit();})()`,
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
  assert.equal(await evaluate("document.getElementById('activeChildrenStat').textContent"), '1');
  assert.equal(await evaluate("document.getElementById('occupiedGroupsStat').textContent"), '1');
  await evaluate(
    "document.getElementById('childrenSearch').value='Aucun rezultat';document.getElementById('childrenSearch').dispatchEvent(new Event('input'))",
  );
  assert.equal(await evaluate("!!document.querySelector('#childrenTable .empty')"), true);
  assert.equal(await evaluate("document.getElementById('activeChildrenStat').textContent"), '1');
  await evaluate(
    "document.getElementById('childrenSearch').value='';document.getElementById('childrenSearch').dispatchEvent(new Event('input'))",
  );
  await evaluate(
    "document.getElementById('childrenSearch').value='parinte test';document.getElementById('childrenSearch').dispatchEvent(new Event('input'))",
  );
  assert.match(await evaluate("document.getElementById('childrenTable').textContent"), /Copil <test>/);
  assert.equal(await evaluate("typeof document.querySelector('#childrenHead [data-sort=name]').onclick"), 'function');
  await evaluate(
    "document.getElementById('childrenSearch').value='';document.getElementById('childrenSearch').dispatchEvent(new Event('input'));document.querySelector('#childrenHead [data-sort=name]').click()",
  );
  assert.equal(
    await evaluate("document.querySelector('#childrenHead [data-sort=name]').parentElement.getAttribute('aria-sort')"),
    'ascending',
  );
  await evaluate("document.querySelector('#childrenHead [data-sort=name]').click()");
  assert.equal(
    await evaluate("document.querySelector('#childrenHead [data-sort=name]').parentElement.getAttribute('aria-sort')"),
    'descending',
  );
  await evaluate("document.querySelector('[data-create=payments]').click()");
  assert.match(await evaluate("document.getElementById('childrenTable').textContent"), /Al doilea părinte/);
  await evaluate(
    "(()=>{const f=document.getElementById('editorForm'),picker=f.querySelector('[data-child-picker]'),search=picker.querySelector('.child-picker-input');search.focus();picker.querySelector('.combobox-option[data-id]:not([data-id=\"\"])').dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));f.elements.date.value='2026-09-08';f.elements.tenderCash.value='1000';f.elements.tenderCard.value='2000';f.elements.tenderCard.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-month]').value='2026-09';document.querySelector('[data-amount]').value='2000';document.getElementById('addAllocation').click();const rows=document.querySelectorAll('.allocation');rows[1].querySelector('[data-month]').value='2026-10';rows[1].querySelector('[data-amount]').value='500';})()",
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
  const originalMonth = await evaluate("document.getElementById('selectedMonth').value");
  const originalAdvance = await evaluate("document.getElementById('advanceStat').textContent");
  await evaluate(
    "document.getElementById('monthTrigger').click();document.getElementById('monthPrevYear').click();document.querySelector('#monthOptions button').click()",
  );
  assert.notEqual(await evaluate("document.getElementById('selectedMonth').value"), originalMonth);
  assert.equal(await evaluate("document.getElementById('advanceStat').textContent"), originalAdvance);
  assert.equal(await evaluate("!!document.querySelector('#alerts .attention-empty')"), false);
  assert.equal(await evaluate("!!document.querySelector('#alerts .alert-clear')"), true);
  await evaluate(
    `document.getElementById('selectedMonth').value=${JSON.stringify(originalMonth)};document.getElementById('selectedMonth').dispatchEvent(new Event('change'))`,
  );
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
  await evaluate("document.querySelector('[data-view=fees]').click()");
  await evaluate(
    "document.getElementById('feesFilter').value='all';document.getElementById('feesFilter').dispatchEvent(new Event('change',{bubbles:true}))",
  );
  assert.equal(
    await evaluate("document.querySelector('#feesTable tr[data-child] select[data-status]').value"),
    'Retras',
  );
  await evaluate("document.getElementById('feesSave').click()");
  await until(
    () => evaluate("document.getElementById('feesError').textContent!==''"),
    'Untouched row should be rejected',
  );
  assert.match(await evaluate("document.getElementById('feesError').textContent"), /Nu ai completat nicio taxă/);
  const beforeFeeOnlyEdit = (await (await fetch(url + '/api/state')).json()).state.children.find(
    c => c.name === 'Copil <test>',
  );
  assert.equal(beforeFeeOnlyEdit.status, 'Retras');
  await evaluate(
    "(()=>{const input=document.querySelector('#feesTable tr[data-child] input[data-fee]');input.value='2500';input.dispatchEvent(new Event('input',{bubbles:true}));})()",
  );
  await evaluate("document.getElementById('feesSave').click()");
  await until(async () => {
    const child = (await (await fetch(url + '/api/state')).json()).state.children.find(c => c.name === 'Copil <test>');
    return child?.feeHistory?.at(-1)?.amount === 2500;
  }, 'Fee-only edit did not persist');
  const afterFeeOnlyEdit = (await (await fetch(url + '/api/state')).json()).state.children.find(
    c => c.name === 'Copil <test>',
  );
  assert.equal(afterFeeOnlyEdit.status, 'Retras');
  assert.equal(afterFeeOnlyEdit.groupId, groupId);
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
  // Read-only UI fixtures: no API writes; restore the loaded state afterwards.
  const summaryFixture = await evaluate(`(async()=>{
    const {session}=await import('/ui/session.mjs');
    const {render}=await import('/ui/views.mjs');
    const original=session.state;
    try {
      const sample=structuredClone(original.children[0]);
      session.state={...original,payments:[],expenses:[],children:[
        {...sample,id:'summary-active',name:'Copil neevaluabil',archived:false,status:'Activ',feeHistory:[],groupId:original.groups[0].id},
        {...sample,id:'summary-suspended',archived:false,status:'Suspendat',groupId:original.groups[0].id},
        {...sample,id:'summary-archived',name:'Copil arhivat exclusiv',archived:true,status:'Activ',groupId:original.groups[0].id}
      ]};
      render();
      return {
        active:document.getElementById('activeChildrenStat').textContent,
        groups:document.getElementById('occupiedGroupsStat').textContent,
        review:Number(document.getElementById('incompleteChildrenStat').textContent),
        groupText:document.getElementById('groupsGrid').textContent,
        allClear:!!document.querySelector('#alerts .attention-empty'),
        notifyText:document.getElementById('notifyTable').textContent,
        notifyStats:document.getElementById('notifyStats').textContent
      };
    } finally {session.state=original;render();}
  })()`);
  assert.equal(summaryFixture.active, '1');
  assert.equal(summaryFixture.groups, '1');
  assert.ok(summaryFixture.review > 0);
  assert.doesNotMatch(summaryFixture.groupText, /Copil arhivat exclusiv/);
  assert.equal(summaryFixture.allClear, false);
  assert.doesNotMatch(summaryFixture.notifyText, /Copil neevaluabil/);
  assert.match(summaryFixture.notifyStats, /Nu pot fi evaluați\s*1/);
  await viewport(390);
  for (const view of ['children', 'payments', 'expenses', 'review']) {
    await evaluate(`document.querySelector('#primaryNav [data-view=${view}]').click()`);
    await noPageOverflow();
  }
  await viewport(1440);
  await evaluate(
    "window.testPrint=[];window.print=()=>window.testPrint.push(document.body.dataset.printView);document.querySelector('#primaryNav [data-view=notify]').click();document.getElementById('printNotify').click();document.querySelector('#primaryNav [data-view=status]').click();document.getElementById('printButton').click()",
  );
  assert.deepEqual(await evaluate('window.testPrint'), ['notify', 'status']);
  await evaluate("window.dispatchEvent(new Event('afterprint'))");
  assert.equal(await evaluate('document.body.dataset.printView === undefined'), true);
  await evaluate("document.querySelector('#primaryNav [data-view=children]').click()");
  await screenshot('children-desktop-populated');
  await evaluate("document.querySelector('#primaryNav [data-view=dashboard]').click()");
  await screenshot('dashboard-desktop-populated');
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
