import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,mkdirSync,renameSync,readdirSync,readFileSync,existsSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { createApplication,retentionKeep } from '../startica_server.mjs';
import { normalizeRecord,validateState,obligation,cashSummary,emptyState,importReport } from '../domain.mjs';
import { exportWorkbook,readWorkbook } from '../excel.mjs';
const require=createRequire(import.meta.url),XLSX=require('../xlsx.full.min.js');
const child=()=>normalizeRecord('children',{id:'ID-test',name:'Copil test',status:'Activ',attendanceDate:'2026-09-01',fee:2000,dueDay:10,feeHistory:[{from:'2026-09',amount:2000}]});
const payment=()=>normalizeRecord('payments',{id:'PAY-test',childId:'ID-test',date:'2026-09-08',amount:3000,method:'Cash',allocations:[{month:'2026-09',amount:2000},{month:'2026-10',amount:500}]});
test('Încasări după data reală, repartizări, avans, scadență și taxe istorice',()=>{
  const c=child(),p=payment(),s={children:[c],payments:[p],expenses:[]};
  assert.equal(cashSummary(s,'2026-09').income,3000);assert.equal(cashSummary(s,'2026-10').income,0);
  assert.equal(obligation(c,'2026-09',[p],'2026-09-08').paid,2000);
  assert.equal(obligation(c,'2026-10',[p],'2026-09-08').paid,500);
  assert.equal(obligation(c,'2026-09',[],'2026-09-08').label,'Nescadent');
  assert.equal(obligation(c,'2026-09',[],'2026-09-11').label,'Restanță');
  c.feeHistory.push({from:'2026-10',amount:2500});assert.equal(obligation(c,'2026-09',[]).expected,2000);assert.equal(obligation(c,'2026-10',[]).expected,2500);
  assert.equal(obligation({...c,feeHistory:[]},'2026-09',[]).expected,null);
  assert.equal(obligation({...c,attendanceDate:''},'2026-09',[]).label,'De verificat');
  assert.equal(obligation({...c,statusHistory:[{from:'2026-09',status:'Suspendat'}]},'2026-09',[]).expected,0);
  assert.equal(obligation({...c,withdrawalDate:'2026-09-20'},'2026-10',[]).expected,0);
  assert.equal(obligation({...c,dueDay:31},'2027-02',[]).due,'2027-02-28');
  assert.equal(obligation(c,'2026-09',[{...p,date:'2026-10-01'}],'2026-09-08').paid,0);
});
test('Validare monetară, dată, identificatori și referințe',()=>{
  assert.throws(()=>normalizeRecord('children',{}));assert.throws(()=>normalizeRecord('payments',{...payment(),amount:-1}));
  assert.throws(()=>normalizeRecord('payments',{...payment(),date:'2026-02-30'}));
  assert.throws(()=>normalizeRecord('payments',{...payment(),amount:1.001}));
  assert.throws(()=>normalizeRecord('payments',{...payment(),amount:100}));
  assert.throws(()=>validateState({children:[],payments:[payment()],expenses:[]}));
  assert.throws(()=>validateState({children:[child(),child()],payments:[],expenses:[]}));
  assert.equal(normalizeRecord('children',{...child(),status:'Retras'}).status,'Retras');
});
test('Export/reimport complet prin fișier XLSX în memorie',()=>{
  const s={children:[{...child(),notes:'Observații',extra:'câmp păstrat',statusHistory:[{from:'2026-09',status:'Activ'}]}],payments:[{...payment(),archived:true,original:'sursă',notes:'a'.repeat(35000)}],expenses:[normalizeRecord('expenses',{id:'EXP-test',date:'2026-09-08',amount:10.25,category:'Test'})]};
  // Extra long field exercises chunking; validation normally caps text at 10k.
  s.payments[0].notes='text';s.payments[0].extra='a'.repeat(35000);
  const bytes=XLSX.write(exportWorkbook(s,XLSX),{type:'buffer',bookType:'xlsx'});
  const result=readWorkbook(XLSX.read(bytes,{type:'buffer'}),XLSX);
  assert.deepEqual(result.errors,[]);assert.deepEqual(result.state,validateState(s));
  const zero=readWorkbook(exportWorkbook(emptyState(),XLSX),XLSX);assert.deepEqual(zero.state,emptyState());
});
test('Importul refuză exporturi necunoscute în loc să importe liste goale',()=>{
  const wb=XLSX.utils.book_new();for(const name of ['Copii','Achitari','Cheltuieli'])XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['ID'],['ID-test']]),name);
  assert.ok(readWorkbook(wb,XLSX).errors.length);
});
test('V5 original: numărul de înregistrări și totalurile rămân identice',()=>{
  const source=new URL('../../Fisiere_Excel/Evidenta_Achitari_corectata%20v5.xlsx',import.meta.url);
  if(!existsSync(source))return;
  const wb=XLSX.read(readFileSync(source),{type:'buffer'}),report=readWorkbook(wb,XLSX);
  assert.deepEqual(report.errors,[]);
  assert.deepEqual(report.summary,{children:105,payments:810,expenses:1201,paymentTotal:10105096,expenseTotal:1564059});
  const roundtrip=readWorkbook(XLSX.read(XLSX.write(exportWorkbook(report.state,XLSX),{type:'buffer',bookType:'xlsx'}),{type:'buffer'}),XLSX);
  assert.deepEqual(roundtrip.errors,[]);assert.deepEqual(roundtrip.state,report.state);
});
test('Retenția păstrează zile/luni și copii anterioare restaurării',()=>{
  const files=Array.from({length:80},(_,i)=>({name:`startica_new_${i}.db`,modified:`2026-09-08T12:${String(i%60).padStart(2,'0')}:00Z`}));
  files.push({name:'startica_old.db',modified:'2026-08-01T00:00:00Z'},{name:'startica_inainte-import.db',modified:'2024-01-01T00:00:00Z'});
  const keep=retentionKeep(files);assert.ok(keep.has('startica_old.db'));assert.ok(keep.has('startica_inainte-import.db'));assert.ok(keep.size<files.length);
});
test('API: conflicte, reîncercări, backup, restaurare, jurnal și securitate',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'startica-test-')),dataDir=join(dir,'data'),backupDir=join(dir,'backups');
  const app=createApplication({dataDir,backupDir});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${app.server.address().port}`;
  t.after(async()=>{await app.close();if(resolve(dir).startsWith(resolve(tmpdir())+'\\startica-test-')||resolve(dir).startsWith(resolve(tmpdir())+'/startica-test-'))rmSync(dir,{recursive:true,force:true});});
  const token=(await (await fetch(origin+'/api/session')).json()).token;
  const get=async p=>(await fetch(origin+p)).json();
  const post=async(p,b,extra={})=>{const response=await fetch(origin+p,{method:'POST',headers:{'Content-Type':'application/json','X-Startica-Token':token,...extra},body:JSON.stringify(b)});return {status:response.status,body:await response.json()};};
  const request=(record,type,revision,mode='create')=>({record,type,revision,mode,requestId:randomUUID()});
  let r=await post('/api/record',request(child(),'children',0));assert.equal(r.status,200);assert.equal(r.body.revision,1);
  const pay=request(payment(),'payments',1);r=await post('/api/record',pay);assert.equal(r.status,200);
  r=await post('/api/record',pay);assert.equal(r.body.replayed,true);assert.equal(r.body.state.payments.length,1);
  r=await post('/api/record',request(normalizeRecord('expenses',{id:'EXP-test',date:'2026-09-08',amount:100}),'expenses',1));assert.equal(r.status,409);assert.equal((await get('/api/state')).state.payments.length,1);
  assert.equal((await post('/api/record',request({},'children',2))).status,400);
  assert.equal((await post('/api/backup',{}, {'Origin':'https://example.com'})).status,403);
  assert.equal((await post('/api/backup',{}, {'X-Startica-Token':''})).status,403);
  assert.equal((await post('/api/state',emptyState())).status,409);
  const before=await post('/api/backup',{});assert.equal(before.status,200);const name=before.body.name;
  const preview=await get('/api/backup-preview?name='+name);assert.equal(preview.paymentTotal,3000);
  assert.equal((await post('/api/restore',{name,confirm:'',revision:2,requestId:randomUUID()})).status,400);
  const archive=request({...payment(),archived:true},'payments',2,'update');assert.equal((await post('/api/record',archive)).status,200);
  const restored=await post('/api/restore',{name,confirm:'RESTAUREAZA',revision:3,requestId:randomUUID()});assert.equal(restored.status,200);assert.equal(restored.body.state.payments[0].archived,undefined);
  const audit=await get('/api/audit');assert.ok(audit.some(r=>r.action==='restaurare'&&r.before_json&&r.after_json));
  const external=join(dir,'external');mkdirSync(external);assert.equal((await post('/api/settings',{externalDir:external})).status,200);
  const copied=readdirSync(external).find(n=>n.endsWith('.db'));assert.ok(copied);assert.deepEqual(readFileSync(join(external,copied)),readFileSync(join(backupDir,copied)));
  assert.equal((await get('/api/health')).cloudVerified,false);
  renameSync(external,external+'-offline');r=await post('/api/record',request({...child(),phone:'123'},'children',4,'update'));assert.equal(r.status,200);assert.match(r.body.warning,/extern/);
  renameSync(backupDir,backupDir+'-offline');r=await post('/api/record',request({...child(),phone:'456'},'children',5,'update'));assert.equal(r.status,200);assert.match(r.body.warning,/backupul local/);assert.equal(r.body.state.children[0].phone,'456');renameSync(backupDir+'-offline',backupDir);
  assert.equal((await post('/api/restore',{name:'../startica.db',revision:6,confirm:'RESTAUREAZA',requestId:randomUUID()})).status,400);
  const invalid={children:[child(),child()],payments:[],expenses:[]};
  assert.equal((await post('/api/import',{state:invalid,confirm:'IMPORT',revision:6,requestId:randomUUID()})).status,400);
  assert.equal((await get('/api/state')).state.children[0].phone,'456');
  const importRequest={state:{children:[child()],payments:[payment()],expenses:[]},confirm:'IMPORT',revision:6,requestId:randomUUID()};
  r=await post('/api/import',importRequest);assert.equal(r.status,200);assert.equal(r.body.revision,7);
  r=await post('/api/import',importRequest);assert.equal(r.body.replayed,true);assert.equal(r.body.state.payments.length,1);
  assert.ok(readdirSync(backupDir).some(name=>name.includes('inainte-import')));
  assert.equal((await post('/api/record',request({...payment(),archived:true},'payments',7,'update'))).status,200);
  assert.equal((await post('/api/record',request({...payment(),archived:false},'payments',8,'update'))).status,200);
  assert.equal((await get('/api/state')).state.payments[0].archived,false);
});
test('Migrarea bazei vechi păstrează datele și creează copie înainte de migrare',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'startica-migration-'));mkdirSync(join(dir,'data'));const old=new DatabaseSync(join(dir,'data/startica.db'));old.exec('CREATE TABLE app_state(id INTEGER PRIMARY KEY,payload TEXT)');const s={children:[child()],payments:[payment()],expenses:[]};old.prepare('INSERT INTO app_state VALUES(1,?)').run(JSON.stringify(s));old.close();
  const app=createApplication({dataDir:join(dir,'data'),backupDir:join(dir,'backups')});assert.deepEqual(app.envelope().state,s);assert.ok(readdirSync(join(dir,'backups')).some(f=>f.includes('migrare')));app.db.close();if(resolve(dir).startsWith(resolve(tmpdir())+'\\startica-migration-')||resolve(dir).startsWith(resolve(tmpdir())+'/startica-migration-'))rmSync(dir,{recursive:true,force:true});
});
test('Oprire desktop autentificată, cu backup final și închiderea bazei',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'startica-shutdown-'));
  const app=createApplication({dataDir:join(dir,'data'),backupDir:join(dir,'backups'),allowShutdown:true});
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
  const url=`http://127.0.0.1:${app.server.address().port}`;
  try {
    const denied=await fetch(url+'/api/shutdown',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(denied.status,403);await denied.json();
    const {token}=await(await fetch(url+'/api/session')).json();
    const closed=new Promise(r=>app.server.once('close',r));
    const response=await fetch(url+'/api/shutdown',{method:'POST',headers:{'Content-Type':'application/json','X-Startica-Token':token},body:'{}'});
    assert.equal(response.status,200);assert.equal((await response.json()).ok,true);await closed;
    assert.ok(readdirSync(join(dir,'backups')).some(name=>name.includes('inchidere')));
    const check=new DatabaseSync(join(dir,'data/startica.db'),{readOnly:true});assert.equal(check.prepare('PRAGMA integrity_check').get().integrity_check,'ok');check.close();
  } finally {
    if(app.server.listening)await app.close();
    if(resolve(dir).startsWith(resolve(tmpdir())+'\\startica-shutdown-')||resolve(dir).startsWith(resolve(tmpdir())+'/startica-shutdown-'))rmSync(dir,{recursive:true,force:true});
  }
});
