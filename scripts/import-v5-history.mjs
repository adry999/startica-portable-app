// Maintenance import for the supplied V5. Default is read-only preview.
// --apply uses the application's authenticated API, revision check and backups.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {readWorkbook} from '../excel.mjs';
import {financialImportPlan} from '../financial-import.mjs';
import {createApplication} from '../startica_server.mjs';
import {emptyState,total} from '../domain.mjs';

if(process.argv.slice(2).some(a=>a!=='--apply'))throw Error('Folosește fără argumente pentru verificare sau --apply pentru import.');
const sourceName='Evidenta_Achitari_corectata v5.xlsx';
const sourceFile=new URL('../../Fisiere_Excel/Evidenta_Achitari_corectata%20v5.xlsx',import.meta.url);
const bytes=readFileSync(sourceFile),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const require=createRequire(import.meta.url),XLSX=require('../xlsx.full.min.js');
const report=readWorkbook(XLSX.read(bytes,{type:'buffer'}),XLSX);
assert.deepEqual(report.errors,[]);
assert.deepEqual(report.summary,{children:105,payments:810,expenses:1201,paymentTotal:10105096,expenseTotal:1564059},'V5 diferă de fișierul analizat; este necesară o nouă verificare.');
const input={format:'STARTICA_V5',sourceName,sourceHash:sha(bytes),state:report.state};
const db=new DatabaseSync(fileURLToPath(new URL('../Startica_Date/startica.db',import.meta.url)),{readOnly:true});
const before={state:emptyState(),revision:0};
try{db.exec('BEGIN');before.revision=db.prepare('SELECT revision FROM meta').get().revision;for(const r of db.prepare('SELECT kind,payload FROM records ORDER BY rowid').all())before.state[r.kind].push(JSON.parse(r.payload));db.exec('COMMIT');}finally{db.close();}
const plan=financialImportPlan(input,before.state);
console.log(JSON.stringify({phase:'preview',sourceName,sourceHash:input.sourceHash,revision:before.revision,mappedChildren:plan.mappedChildren,summary:plan.summary,skipped:plan.skipped},null,2));
if(process.argv.includes('--apply')&&(plan.summary.payments||plan.summary.expenses)){
  const app=createApplication();await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
  try{
    const url=`http://127.0.0.1:${app.server.address().port}`;
    const {token}=await(await fetch(url+'/api/session')).json();
    const backupDir=app.health().backup,previous=new Set(readdirSync(backupDir));
    const body={...input,confirm:'IMPORT ISTORIC',revision:before.revision,requestId:randomUUID()};
    const response=await fetch(url+'/api/financial-import',{method:'POST',headers:{'Content-Type':'application/json','X-Startica-Token':token},body:JSON.stringify(body)});
    const result=await response.json();if(!response.ok)throw Error(result.error);
    assert.deepEqual(result.state.children,before.state.children,'Fișele copiilor trebuie să rămână identice.');
    for(const type of ['payments','expenses']){
      const found=new Map(result.state[type].map(r=>[r.id,r]));
      for(const r of [...before.state[type],...plan.additions[type]])assert.deepEqual(found.get(r.id),r);
      assert.equal(result.state[type].length,before.state[type].length+plan.additions[type].length);
      assert.equal(Math.round(total(result.state[type])*100),Math.round(total(before.state[type])*100)+Math.round(total(plan.additions[type])*100));
    }
    assert.equal(app.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
    const replay=financialImportPlan(input,result.state);assert.equal(replay.summary.payments,0);assert.equal(replay.summary.expenses,0);
    const h=app.health(),backups=[];
    for(const name of readdirSync(backupDir).filter(n=>n.endsWith('.db')&&!previous.has(n))){
      const local=join(backupDir,name),external=h.externalDir?join(h.externalDir,name):'';
      const check=new DatabaseSync(local,{readOnly:true});
      try{assert.equal(check.prepare('PRAGMA integrity_check').get().integrity_check,'ok');backups.push({name,counts:check.prepare('SELECT kind,count(*) AS count FROM records GROUP BY kind').all(),externalIdentical:!!external&&existsSync(external)&&sha(readFileSync(local))===sha(readFileSync(external))});}finally{check.close();}
    }
    assert.ok(backups.some(b=>b.name.includes('inainte-import-istoric')));
    console.log(JSON.stringify({phase:'complete',revision:result.revision,childrenUnchanged:true,summary:plan.summary,warning:result.warning,health:h,backups},null,2));
  }finally{await app.close();}
}
