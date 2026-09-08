import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, copyFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, resolve, basename, isAbsolute, relative } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { TYPES, emptyState, validateState, normalizeRecord, summary, importReport } from './domain.mjs';
import { previewChildrenCSV } from './children-csv.mjs';
import { financialImportPlan } from './financial-import.mjs';

const ROOT=fileURLToPath(new URL('.',import.meta.url));
const fail=(message,status=400)=>{ throw Object.assign(new Error(message),{status}); };
const hash=value=>createHash('sha256').update(value).digest('hex');
const sqlString=value=>`'${String(value).replaceAll("'","''")}'`;
const stamp=()=>new Date().toISOString().replace(/[:.]/g,'-');
export function retentionKeep(files) {
  const sorted=[...files].sort((a,b)=>b.modified.localeCompare(a.modified));
  const keep=new Set(sorted.slice(0,20).map(f=>f.name)), days=new Set(), months=new Set();
  for(const f of sorted) { const day=f.modified.slice(0,10),month=day.slice(0,7); if(!days.has(day)&&days.size<30){days.add(day);keep.add(f.name)} if(!months.has(month)&&months.size<12){months.add(month);keep.add(f.name)} if(/inainte-|migrare/.test(f.name)) keep.add(f.name); }
  return keep;
}
export function createApplication(options={}) {
  const root=options.root||ROOT, dataDir=options.dataDir||join(root,'Startica_Date');
  const backupDir=options.backupDir||join(root,'Startica_Backup');
  mkdirSync(dataDir,{recursive:true}); mkdirSync(backupDir,{recursive:true});
  const dbFile=join(dataDir,'startica.db'), db=new DatabaseSync(dbFile), token=randomUUID();
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  const existed=!!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='records'").get();
  if(!existed && db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='app_state'").get()) db.exec(`VACUUM INTO ${sqlString(join(backupDir,`startica_${stamp()}_migrare.db`))}`);
  db.exec(`CREATE TABLE IF NOT EXISTS records(kind TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(kind,id));
    CREATE TABLE IF NOT EXISTS meta(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,updated_at TEXT NOT NULL);
    INSERT OR IGNORE INTO meta VALUES(1,0,'');
    CREATE TABLE IF NOT EXISTS audit_changes(id INTEGER PRIMARY KEY,created_at TEXT NOT NULL,action TEXT NOT NULL,kind TEXT,record_id TEXT,before_json TEXT,after_json TEXT);
    CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY,digest TEXT NOT NULL,revision INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
  if(!db.prepare("SELECT value FROM settings WHERE key='legacyMigrated'").get() && db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='app_state'").get()) {
    const row=db.prepare('SELECT payload FROM app_state WHERE id=1').get();
    if(row) {
      const legacy=JSON.parse(row.payload);
      db.exec('BEGIN IMMEDIATE');
      try { for(const type of TYPES) for(const r of legacy[type]||[]) db.prepare('INSERT INTO records VALUES(?,?,?)').run(type,r.id,JSON.stringify(r)); db.prepare('INSERT INTO settings VALUES(?,?)').run('legacyMigrated','1'); db.exec('COMMIT'); }
      catch(e){ db.exec('ROLLBACK');db.close();throw e; }
    }
  }
  const setting=k=>db.prepare('SELECT value FROM settings WHERE key=?').get(k)?.value||'';
  const setSetting=(k,v)=>db.prepare('INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k,v);
  function readState(){const s=emptyState();for(const r of db.prepare('SELECT kind,payload FROM records ORDER BY rowid').all())s[r.kind].push(JSON.parse(r.payload));return s;}
  function envelope(){const m=db.prepare('SELECT * FROM meta WHERE id=1').get();return {state:readState(),revision:m.revision,updatedAt:m.updated_at};}
  function fileList(dir){return readdirSync(dir).filter(n=>/^startica_[A-Za-z0-9_.-]+\.db$/.test(n)).map(name=>({name,modified:statSync(join(dir,name)).mtime.toISOString()})).sort((a,b)=>b.modified.localeCompare(a.modified));}
  function snapshotState(file) {
    const source=new DatabaseSync(file,{readOnly:true});
    try {
      if(source.prepare('PRAGMA integrity_check').get().integrity_check!=='ok') fail('Backup corupt.');
      if(source.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='records'").get()) { const s=emptyState();for(const r of source.prepare('SELECT kind,payload FROM records').all())s[r.kind].push(JSON.parse(r.payload));return s; }
      return JSON.parse(source.prepare('SELECT payload FROM app_state WHERE id=1').get().payload);
    } finally {source.close();}
  }
  function prune(){ const files=fileList(backupDir),keep=retentionKeep(files);for(const f of files)if(!keep.has(f.name))unlinkSync(join(backupDir,f.name)); }
  function backup(reason='manual') {
    const name=`startica_${stamp()}_${reason}_${randomUUID().slice(0,8)}.db`,file=join(backupDir,name),temp=file+'.tmp';
    db.exec(`VACUUM INTO ${sqlString(temp)}`); snapshotState(temp); renameSync(temp,file);
    setSetting('lastLocal',new Date().toISOString());setSetting('localError','');
    let warning='';const external=setting('externalDir');
    if(external) {
      try {
        if(!existsSync(external)||!statSync(external).isDirectory())fail('Folderul extern nu este disponibil.');
        const dest=join(external,name),copy=dest+'.tmp';copyFileSync(file,copy);
        if(hash(readFileSync(file))!==hash(readFileSync(copy)))fail('Copia externă diferă de original.');
        snapshotState(copy);renameSync(copy,dest);setSetting('lastExternal',new Date().toISOString());setSetting('externalError','');
      } catch(e){warning='Backup local creat; copia externă a eșuat: '+e.message;setSetting('externalError',e.message);}
    }
    try{prune()}catch(e){warning+=' Curățarea backupurilor vechi a eșuat: '+e.message;}
    return {file,name,warning};
  }
  function safeBackup(reason){try{return backup(reason)}catch(e){setSetting('localError',e.message);return {warning:'Datele sunt salvate, dar backupul local a eșuat: '+e.message};}}
  function health(){return {ok:true,database:dbFile,backup:backupDir,externalDir:setting('externalDir'),lastLocal:setting('lastLocal')||fileList(backupDir)[0]?.modified||'',lastExternal:setting('lastExternal'),localError:setting('localError'),externalError:setting('externalError'),cloudVerified:false};}
  function selectedBackup(name){if(typeof name!=='string'||basename(name)!==name||!/^startica_[A-Za-z0-9_.-]+\.db$/.test(name))fail('Nume de backup invalid.');const file=join(backupDir,name);if(!existsSync(file))fail('Backup inexistent.');return file;}
  function audit(action,type,id,before,after){db.prepare('INSERT INTO audit_changes(created_at,action,kind,record_id,before_json,after_json) VALUES(?,?,?,?,?,?)').run(new Date().toISOString(),action,type,id,before?JSON.stringify(before):null,after?JSON.stringify(after):null);}
  function commit(body,action,fn,preBackup=false){
    if(typeof body.requestId!=='string'||!/^[a-zA-Z0-9-]{10,100}$/.test(body.requestId))fail('Identificator de operațiune invalid.');
    const digest=hash(JSON.stringify({action,...body})), prior=db.prepare('SELECT * FROM requests WHERE id=?').get(body.requestId);
    if(prior){if(prior.digest!==digest)fail('Operațiunea a fost deja folosită cu alte date.',409);return {ok:true,replayed:true,...envelope(),health:health()};}
    if(body.revision!==envelope().revision)fail('Datele au fost schimbate în altă filă. Reîncarcă datele și verifică formularul înainte să salvezi din nou.',409);
    if(preBackup)backup('inainte-'+action);
    db.exec('BEGIN IMMEDIATE');
    try {
      if(body.revision!==db.prepare('SELECT revision FROM meta').get().revision)fail('Date modificate în altă filă.',409);
      fn();db.prepare('UPDATE meta SET revision=revision+1,updated_at=? WHERE id=1').run(new Date().toISOString());
      db.prepare('INSERT INTO requests VALUES(?,?,?)').run(body.requestId,digest,body.revision+1);db.exec('COMMIT');
    }catch(e){db.exec('ROLLBACK');throw e;}
    const b=safeBackup('automat');return {ok:true,...envelope(),warning:b.warning||'',health:health()};
  }
  function replace(s,action){const before=readState();db.exec('DELETE FROM records');for(const type of TYPES){for(const r of s[type])db.prepare('INSERT INTO records VALUES(?,?,?)').run(type,r.id,JSON.stringify(r));const old=new Map(before[type].map(r=>[r.id,r])),fresh=new Map(s[type].map(r=>[r.id,r]));for(const id of new Set([...old.keys(),...fresh.keys()]))if(JSON.stringify(old.get(id))!==JSON.stringify(fresh.get(id)))audit(action,type,id,old.get(id),fresh.get(id));}}
  const staticFiles={'/':'Startica_aplicatie_simpla.html','/index.html':'Startica_aplicatie_simpla.html','/startica_app.js':'startica_app.js','/domain.mjs':'domain.mjs','/review-center.mjs':'review-center.mjs','/excel.mjs':'excel.mjs','/xlsx.full.min.js':'xlsx.full.min.js','/app.css':'app.css','/assets/startica-logo.svg':'assets/startica-logo.svg','/assets/startica-icon.svg':'assets/startica-icon.svg'};
  function send(res,value,status=200,mime='application/json; charset=utf-8'){const content=Buffer.isBuffer(value)?value:Buffer.from(mime.startsWith('application/json')?JSON.stringify(value):value);res.writeHead(status,{'Content-Type':mime,'Content-Length':content.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(content);}
  async function readJson(req){let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>20000000)fail('Fișierul este prea mare.',413);chunks.push(c)}return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}
  const server=createServer(async(req,res)=>{
    try{
      const port=server.address().port,origin=`http://127.0.0.1:${port}`;
      if(req.headers.host!==`127.0.0.1:${port}`)fail('Adresă nepermisă.',403);
      if(req.headers.origin && req.headers.origin!==origin)fail('Origine nepermisă.',403);
      const url=new URL(req.url,origin),path=url.pathname;
      if(req.method==='GET'&&staticFiles[path])return send(res,readFileSync(join(root,staticFiles[path])),200,path.endsWith('.svg')?'image/svg+xml':path.endsWith('.css')?'text/css; charset=utf-8':path.endsWith('.js')||path.endsWith('.mjs')?'text/javascript; charset=utf-8':'text/html; charset=utf-8');
      if(req.method==='GET'&&path==='/api/session')return send(res,{token});
      if(req.method==='GET'&&path==='/api/state')return send(res,envelope());
      if(req.method==='GET'&&path==='/api/health')return send(res,health());
      if(req.method==='GET'&&path==='/api/backups')return send(res,fileList(backupDir));
      if(req.method==='GET'&&path==='/api/backup-preview'){const s=snapshotState(selectedBackup(url.searchParams.get('name')));return send(res,{...summary(s),errors:importReport(s).errors});}
      if(req.method==='GET'&&path==='/api/audit'){const offset=Math.max(0,Number(url.searchParams.get('offset'))||0);return send(res,db.prepare('SELECT * FROM audit_changes ORDER BY id DESC LIMIT 100 OFFSET ?').all(offset));}
      if(req.method!=='POST')fail('Pagina nu există.',404);
      if(req.headers['x-startica-token']!==token||!req.headers['content-type']?.startsWith('application/json'))fail('Reîncarcă aplicația înainte de a salva.',403);
      const b=await readJson(req);
      if(path==='/api/shutdown' && options.allowShutdown){const result=safeBackup('inchidere');send(res,{ok:true,warning:result.warning||''});server.close(()=>db.close());server.closeIdleConnections();return;}
      if(path==='/api/record')return send(res,commit(b,'salvare',()=>{
        const r=normalizeRecord(b.type,b.record),s=readState(),old=s[b.type].find(x=>x.id===r.id);
        if(!['create','update'].includes(b.mode))fail('Mod de salvare invalid.');
        if(b.mode==='create'&&old)fail('ID deja folosit.',409);if(b.mode==='update'&&!old)fail('Înregistrarea nu mai există.',409);
        if(b.type==='payments'&&r.childId&&!s.children.some(c=>c.id===r.childId))fail('Copilul asociat nu există.');
        db.prepare('INSERT INTO records VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET payload=excluded.payload').run(b.type,r.id,JSON.stringify(r));audit(old?'modificare':'adăugare',b.type,r.id,old,r);
      }));
      if(path==='/api/import-preview')return send(res,importReport(b.state));
      if(path==='/api/financial-preview'){const current=envelope();const plan=financialImportPlan(b,current.state);return send(res,{summary:plan.summary,skipped:plan.skipped,mappedChildren:plan.mappedChildren,revision:current.revision});}
      if(path==='/api/financial-import'){
        if(b.confirm!=='IMPORT ISTORIC')fail('Confirmă importul istoricului financiar.');
        return send(res,commit(b,'import-istoric',()=>{
          const plan=financialImportPlan(b,readState());
          if(!plan.summary.payments&&!plan.summary.expenses)fail('Istoricul este deja importat.');
          for(const type of ['payments','expenses'])for(const r of plan.additions[type]){db.prepare('INSERT INTO records VALUES(?,?,?)').run(type,r.id,JSON.stringify(r));audit('import istoric V5',type,r.id,null,r);}
        },true));
      }
      if(path==='/api/children-csv-preview'){const current=envelope();return send(res,{...previewChildrenCSV(b.csv,current.state.children),revision:current.revision});}
      if(path==='/api/children-csv'){
        if(b.confirm!=='IMPORT COPII')fail('Scrie IMPORT COPII pentru confirmare.');
        return send(res,commit(b,'import-copii',()=>{
          const report=previewChildrenCSV(b.csv,readState().children);
          if(report.errors.length)fail(report.errors.join('\n'));
          if(!report.additions.length)fail('Nu există copii noi de importat.');
          for(const r of report.additions){db.prepare('INSERT INTO records VALUES(?,?,?)').run('children',r.id,JSON.stringify(r));audit('import copii CSV','children',r.id,null,r);}
        },true));
      }
      if(path==='/api/import'){if(b.confirm!=='IMPORT')fail('Confirmă importul.');const s=validateState(b.state);return send(res,commit(b,'import',()=>replace(s,'import'),true));}
      if(path==='/api/restore'){if(b.confirm!=='RESTAUREAZA')fail('Confirmă restaurarea.');const s=validateState(snapshotState(selectedBackup(b.name)));return send(res,commit(b,'restaurare',()=>replace(s,'restaurare'),true));}
      if(path==='/api/backup')return send(res,{ok:true,...backup(),health:health()});
      if(path==='/api/settings'){
        const folder=String(b.externalDir||'').trim();
        if(folder){if(!isAbsolute(folder)||!existsSync(folder)||!statSync(folder).isDirectory())fail('Alege un folder existent, folosind calea completă.');const absolute=resolve(folder);for(const reserved of [dataDir,backupDir])if(absolute===resolve(reserved)||(!relative(resolve(reserved),absolute).startsWith('..')&&!isAbsolute(relative(resolve(reserved),absolute))))fail('Alege un folder diferit de baza de date și backupurile locale.');}
        const before=setting('externalDir');setSetting('externalDir',folder);if(before!==folder){setSetting('lastExternal','');setSetting('externalError','');}audit('configurare backup',null,null,{externalDir:before},{externalDir:folder});return send(res,{ok:true,...safeBackup('configurare'),health:health()});
      }
      if(path==='/api/state')fail('Această versiune este veche. Reîncarcă pagina.',409);
      fail('Operațiune inexistentă.',404);
    }catch(e){send(res,{error:e.message},e.status||400);}
  });
  return {server,db,backup,health,envelope,close:()=>new Promise(resolveClose=>{server.close(()=>{db.close();resolveClose()})})};
}
if(process.argv[1] && resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))){
  const port=Number(process.env.STARTICA_PORT||8765);
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('Port Startica invalid.');
  const app=createApplication({allowShutdown:true});
  app.server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`Startica este deja pornită. Deschide http://127.0.0.1:${port}`:e.message);app.db.close();process.exitCode=1;});
  app.server.listen(port,'127.0.0.1',()=>{try{app.backup('pornire')}catch(e){console.error('Backup la pornire: '+e.message)}console.log(`Startica: http://127.0.0.1:${port}`);if(process.env.STARTICA_NO_BROWSER!=='1')spawn('cmd.exe',['/c','start','',`http://127.0.0.1:${port}`],{detached:true,stdio:'ignore',windowsHide:true}).unref();});
  let closing=false;const shutdown=async()=>{if(closing)return;closing=true;try{app.backup('inchidere')}catch(e){console.error(e.message)}await app.close();};process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
}
