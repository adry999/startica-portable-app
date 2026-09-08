import { emptyState, normalizeRecord, importReport, today, allocations,paymentTenders } from './domain.mjs';
export function excelDate(value, XLSX) {
  if(value===null || value===undefined || value==='')return '';
  if(typeof value==='number'){const d=XLSX.SSF.parse_date_code(value);return d?`${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`:'';}
  if(value instanceof Date)return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;
  const s=String(value).trim(),ro=s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  return ro?`${ro[3]}-${ro[2].padStart(2,'0')}-${ro[1].padStart(2,'0')}`:/^\d{4}-\d{2}-\d{2}$/.test(s)?s:'';
}
export function readWorkbook(workbook,XLSX){
  const state=emptyState(),errors=[],warnings=[];
  const rows=name=>XLSX.utils.sheet_to_json(workbook.Sheets[name],{header:1,raw:true,defval:null});
  if(workbook.Sheets.Startica_Format){
    if(rows('Startica_Format')[0]?.[0]!=='STARTICA_EXPORT_2'||!workbook.Sheets.Startica_Date)return {errors:['Format Startica necunoscut.'],warnings:[]};
    const chunks=new Map();
    for(const [type,id,part,json] of rows('Startica_Date').slice(1)){
      if(!Object.hasOwn(state,type)||typeof id!=='string'||!Number.isInteger(part)||part<0||typeof json!=='string'){errors.push('Rând invalid în datele complete.');continue;}
      const key=JSON.stringify([type,id]);if(!chunks.has(key))chunks.set(key,[]);if(chunks.get(key)[part]!==undefined)errors.push(`Fragment repetat: ${id}`);chunks.get(key)[part]=json;
    }
    for(const [key,parts] of chunks){const [type,id]=JSON.parse(key);try{for(let n=0;n<parts.length;n++)if(typeof parts[n]!=='string')throw Error('fragment lipsă');const r=JSON.parse(parts.join(''));if(r.id!==id)throw Error('ID diferit');state[type].push(r);}catch(e){errors.push(`${id}: ${e.message}`);}}
  } else {
    for(const name of ['Copii','Achitari','Cheltuieli'])if(!workbook.Sheets[name])errors.push(`Lipsește fila ${name}.`);
    if(errors.length)return {errors,warnings};
    // V5 starts data on row 5. A native/unknown export must never be interpreted as V5.
    if(!String(rows('Copii')[3]?.[0]||'').toLowerCase().includes('id')||!String(rows('Achitari')[3]?.[0]||'').toLowerCase().includes('id'))return {errors:['Structura nu este V5. Folosește V5 original sau un export complet din această versiune.'],warnings};
    const parse=(name,type,fn,belongs)=>rows(name).slice(4).forEach((row,i)=>{if(!belongs(row))return;try{state[type].push(normalizeRecord(type,fn(row,i)))}catch(e){errors.push(`${name}, rândul ${i+5}: ${e.message}`);}});
    const t=v=>String(v??'').trim(),d=v=>excelDate(v,XLSX);
    parse('Copii','children',r=>({id:t(r[0]),name:t(r[1]),parent:t(r[2]),phone:t(r[3]),birthDate:d(r[4]),contractDate:d(r[5]),attendanceDate:d(r[6]),group:t(r[7]),fee:Number(r[8])>0?Number(r[8]):null,dueDay:r[9]?Number(r[9]):10,status:t(r[10])||'Activ',withdrawalDate:d(r[11]),notes:t(r[12]),verification:t(r[13]),feeHistory:[],statusHistory:[]}),r=>!!r[0]&&!String(r[0]).toUpperCase().includes('TOTAL'));
    parse('Achitari','payments',r=>({id:t(r[0]),date:d(r[1]),childId:t(r[2]),childName:t(r[3]),sourceName:t(r[4]),group:t(r[5]),month:d(r[6]).slice(0,7),method:t(r[7])||'Cash',amount:Number(r[8]),type:t(r[9]),notes:t(r[10]),verification:t(r[11]),original:t(r[12])}),r=>!!r[0]&&!String(r[0]).toUpperCase().includes('TOTAL'));
    parse('Cheltuieli','expenses',(r,i)=>({id:`EXP-${String(i+1).padStart(4,'0')}`,date:d(r[6]),category:t(r[7])||'Altele',description:'',amount:Number(r[8])}),r=>r[6]!=null && r[6]!=='' && !String(r[6]).toUpperCase().includes('TOTAL') && r[8]!=null && r[8]!=='');
    warnings.push({reason:'V5: taxa nu are dată de aplicare. Completează istoricul taxei înainte de a folosi restanțele.'});
    const childIds=new Set(state.children.map(c=>c.id));
    for(const p of state.payments){if(p.childId&&!childIds.has(p.childId)){p.sourceChildId=p.childId;p.childId='';warnings.push({reason:`${p.id}: ID copil necunoscut ${p.sourceChildId}; plata rămâne de asociat.`});}if(/multi|mai multe|multe luni/i.test(p.verification)){p.allocations=[];p.month='';}}
  }
  const report=importReport(state);return {...report,errors:[...errors,...report.errors],warnings:[...warnings,...report.warnings]};
}
export function exportWorkbook(state,XLSX){
  const wb=XLSX.utils.book_new(),sheet=(name,data)=>XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(data),name);
  sheet('Copii',state.children.map(r=>({ID:r.id,Nume:r.name,Parinte:r.parent,Telefon:r.phone,Parinte_2:r.parent2||'',Telefon_2:r.phone2||'',Nr_contract:r.contractNumber||'',Grupa:r.group,Statut:r.status,Arhivat:!!r.archived,Taxa:r.fee,Scadenta:r.dueDay,Inceput:r.attendanceDate,Retragere:r.withdrawalDate,Observatii:r.notes})));
  sheet('Achitari',state.payments.map(r=>({ID:r.id,Data:r.date,ID_copil:r.childId,Copil:state.children.find(c=>c.id===r.childId)?.name||r.childName||r.sourceName||'',Metoda:r.method,Suma:r.amount,Cash:paymentTenders(r).filter(p=>p.method==='Cash').reduce((n,p)=>n+p.amount,0),Card:paymentTenders(r).filter(p=>p.method==='Card').reduce((n,p)=>n+p.amount,0),Transfer:paymentTenders(r).filter(p=>p.method==='Transfer').reduce((n,p)=>n+p.amount,0),Detalii_metode:paymentTenders(r).map(p=>`${p.method}: ${p.amount}`).join('; '),Repartizari:allocations(r).map(a=>`${a.month}: ${a.amount}`).join('; '),Arhivat:!!r.archived,Observatii:r.notes})));
  sheet('Cheltuieli',state.expenses.map(r=>({ID:r.id,Data:r.date,Categorie:r.category,Descriere:r.description,Suma:r.amount,Arhivat:!!r.archived})));
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['STARTICA_EXPORT_2'],['Creat',today()],['Reimportul folosește fila Startica_Date, care păstrează toate câmpurile.']]),'Startica_Format');
  const raw=[['Tip','ID','Fragment','Date complete']];
  for(const type of Object.keys(state))if(['children','payments','expenses'].includes(type))for(const r of state[type]){const json=JSON.stringify(r);for(let i=0;i<json.length;i+=16000)raw.push([type,r.id,i/16000,json.slice(i,i+16000)]);}
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(raw),'Startica_Date');return wb;
}
