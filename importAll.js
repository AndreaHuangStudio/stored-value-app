
// A1.3.3e — Import All (dedupe + lastModified)
function readFileFromPicker(inputId, accept){
  return new Promise((resolve)=>{
    const input=document.getElementById(inputId); input.value=''; input.accept=accept;
    input.onchange=async ()=>{ const file=input.files[0]; if(!file){ resolve(null); return; } resolve(file); };
    input.click();
  });
}
function csvToRows(text){
  const lines=text.split(/\r?\n/).filter(l=>l.trim().length>0);
  if(!lines.length) return [];
  lines[0]=lines[0].replace(/^\uFEFF/,'');
  return lines.map(line=>{
    const out=[]; let cur=''; let q=false;
    for(let i=0;i<line.length;i++){ const ch=line[i];
      if(q){ if(ch==='"' && line[i+1]==='"'){ cur+='"'; i++; } else if(ch==='"'){ q=false; } else { cur+=ch; } }
      else { if(ch===','){ out.push(cur); cur=''; } else if(ch==='"'){ q=true; } else { cur+=ch; } }
    }
    out.push(cur); return out;
  });
}
function txnFingerprint(customerId, type, amount, createdAt, note){
  const amt = Number(amount||0).toFixed(2);
  const ts = Math.floor((typeof createdAt==='number'?createdAt:Date.parse(createdAt))/1000);
  const n = String(note||'').trim().slice(0,80);
  return `${customerId}|${type}|${amt}|${ts}|${n}`;
}
function interviewFingerprint(customerId, date, topic, content, nextAction){
  const ts = Math.floor((typeof date==='number'?date:Date.parse(date))/1000);
  const tp = String(topic||'').trim();
  const c = String(content||'').trim().slice(0,80);
  const nx = String(nextAction||'').trim().slice(0,40);
  return `${customerId}|${ts}|${tp}|${c}|${nx}`;
}
async function ensureCustomerByName(name){
  let c = await getCustomerByName(name);
  if (c) return c;
  c = { name: name.trim(), phone:'', lineId:'', note:'' };
  return await saveCustomer(c);
}
async function importAllTxnsCSV(){
  const file = await readFileFromPicker('fileImportAll','.csv,text/csv');
  if(!file) return;
  const text = await file.text(); const rows = csvToRows(text);
  if(rows.length<=1){ alert('CSV 無資料'); return; }
  const header=rows[0].map(h=>h.trim());
  const idxCustomer=header.indexOf('客戶'), idxDate=header.indexOf('日期'), idxType=header.indexOf('類型'), idxAmt=header.indexOf('金額'), idxNote=header.indexOf('備註'), idxLM=header.indexOf('最後修改');
  if(idxCustomer<0 || idxDate<0 || idxType<0 || idxAmt<0){ alert('CSV 欄位需包含：客戶、日期、類型、金額（備註/最後修改可選）'); return; }
  const cacheSets = new Map();
  let ok=0, skip=0, dup=0;
  for(let i=1;i<rows.length;i++){ const r=rows[i];
    const name=String(r[idxCustomer]||'').trim(); if(!name){ skip++; continue; }
    const c=await ensureCustomerByName(name);
    if(!cacheSets.has(c.id)){
      const existing = await listTxns(c.id);
      cacheSets.set(c.id, new Set(existing.map(t => txnFingerprint(c.id, t.type, t.amount, t.createdAt, t.note))));
    }
    const set = cacheSets.get(c.id);
    const d=Date.parse(r[idxDate]); const t=String(r[idxType]||'').trim(); const a=Number(r[idxAmt]); const n=String(r[idxNote]||'').trim();
    const lm = (idxLM>=0 && r[idxLM]) ? (Number(r[idxLM])||Date.parse(r[idxLM])) : null;
    if(!isFinite(d) || !a || !t){ skip++; continue; }
    const fp = txnFingerprint(c.id, t, a, d, n);
    if(set.has(fp)){ dup++; continue; }
    await saveTxn({customerId:c.id, type:t, amount:a, note:n, createdAt:d, lastModified: lm || Date.now()});
    set.add(fp); ok++;
  }
  alert(`匯入完成：交易 ${ok} 筆；略過 ${skip} 筆；重複跳過 ${dup} 筆`);
}
async function importAllInterviewsCSV(){
  const file = await readFileFromPicker('fileImportAll','.csv,text/csv');
  if(!file) return;
  const text = await file.text(); const rows = csvToRows(text);
  if(rows.length<=1){ alert('CSV 無資料'); return; }
  const header=rows[0].map(h=>h.trim());
  const idxCustomer=header.indexOf('客戶'), idxDate=header.indexOf('日期'), idxTopic=header.indexOf('主題'), idxContent=header.indexOf('內容'), idxNext=header.indexOf('後續'), idxLM=header.indexOf('最後修改');
  if(idxCustomer<0 || idxDate<0 || idxTopic<0){ alert('CSV 欄位需包含：客戶、日期、主題（內容/後續/最後修改可選）'); return; }
  const cacheSets = new Map();
  let ok=0, skip=0, dup=0;
  for(let i=1;i<rows.length;i++){ const r=rows[i];
    const name=String(r[idxCustomer]||'').trim(); if(!name){ skip++; continue; }
    const c=await ensureCustomerByName(name);
    if(!cacheSets.has(c.id)){
      const existing = await listInterviews(c.id);
      cacheSets.set(c.id, new Set(existing.map(it => interviewFingerprint(c.id, it.date, it.topic, it.content, it.nextAction))));
    }
    const set = cacheSets.get(c.id);
    const d=Date.parse(r[idxDate]); const topic=String(r[idxTopic]||'').trim();
    const content=String(r[idxContent]||'').trim(); const nextAction=String(r[idxNext]||'').trim();
    const lm = (idxLM>=0 && r[idxLM]) ? (Number(r[idxLM])||Date.parse(r[idxLM])) : null;
    if(!isFinite(d) || !topic){ skip++; continue; }
    const fp = interviewFingerprint(c.id, d, topic, content, nextAction);
    if(set.has(fp)){ dup++; continue; }
    await saveInterview({customerId:c.id, date:d, topic, content, nextAction, lastModified: lm || Date.now()});
    set.add(fp); ok++;
  }
  alert(`匯入完成：訪談 ${ok} 筆；略過 ${skip} 筆；重複跳過 ${dup} 筆`);
}
async function importAllDataJSON(){
  const file = await readFileFromPicker('fileImportAll','.json,application/json');
  if(!file) return;
  const text = await file.text();
  let payload;
  try{ payload = JSON.parse(text); }catch(e){ alert('JSON 解析失敗'); return; }
  const arr = Array.isArray(payload?.data) ? payload.data : [];
  let cntC=0, cntT=0, cntI=0, dupT=0, dupI=0;
  const cacheTx = new Map();
  const cacheIv = new Map();
  for(const block of arr){
    const c0 = block.customer||{}; if(!c0.name) continue;
    const c = await ensureCustomerByName(c0.name);
    if(!cacheTx.has(c.id)){
      const existing = await listTxns(c.id);
      cacheTx.set(c.id, new Set(existing.map(t => txnFingerprint(c.id, t.type, t.amount, t.createdAt, t.note))));
    }
    if(!cacheIv.has(c.id)){
      const existingI = await listInterviews(c.id);
      cacheIv.set(c.id, new Set(existingI.map(it => interviewFingerprint(c.id, it.date, it.topic, it.content, it.nextAction))));
    }
    const setT = cacheTx.get(c.id);
    const setI = cacheIv.get(c.id);
    for(const t of (block.txns||[])){
      const lm = Number(t.lastModified)||Date.parse(t.lastModified)||null;
      const fp = txnFingerprint(c.id, t.type, Number(t.amount||0), Number(t.createdAt)||Date.parse(t.createdAt)||Date.now(), t.note||'');
      if(setT.has(fp)){ dupT++; continue; }
      await saveTxn({customerId:c.id, type:t.type, amount:Number(t.amount||0), note:t.note||'', createdAt: Number(t.createdAt)||Date.parse(t.createdAt)||Date.now(), lastModified: lm || Date.now()});
      setT.add(fp); cntT++;
    }
    for(const it of (block.interviews||[])){
      const when = Number(it.date)||Date.parse(it.date)||Date.now();
      const lm = Number(it.lastModified)||Date.parse(it.lastModified)||null;
      const fp = interviewFingerprint(c.id, when, it.topic||'', it.content||'', it.nextAction||'');
      if(setI.has(fp)){ dupI++; continue; }
      await saveInterview({customerId:c.id, date: when, topic:it.topic||'', content:it.content||'', nextAction:it.nextAction||'', lastModified: lm || Date.now()});
      setI.add(fp); cntI++;
    }
    cntC++;
  }
  alert(`匯入完成：客戶 ${cntC} 位、交易 ${cntT} 筆（重複${dupT}） 、訪談 ${cntI} 筆（重複${dupI}）`);
}
async function importCustomerCSVInteractive(){
  alert('請到某位客戶詳細頁，點「匯入CSV」即可針對該客戶匯入。');
}
