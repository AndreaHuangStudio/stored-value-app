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
  const idxCustomer=header.indexOf('客戶'), idxDate=header.indexOf('日期'), idxType=header.indexOf('類型'), idxAmt=header.indexOf('金額'), idxNote=header.indexOf('備註');
  if(idxCustomer<0 || idxDate<0 || idxType<0 || idxAmt<0){ alert('CSV 欄位需包含：客戶、日期、類型、金額'); return; }
  let ok=0, skip=0;
  for(let i=1;i<rows.length;i++){ const r=rows[i];
    const name=String(r[idxCustomer]||'').trim(); if(!name){ skip++; continue; }
    const c=await ensureCustomerByName(name);
    const d=Date.parse(r[idxDate]); const t=String(r[idxType]||'').trim(); const a=Number(r[idxAmt]); const n=String(r[idxNote]||'').trim();
    if(!isFinite(d) || !a || !t){ skip++; continue; }
    await saveTxn({customerId:c.id, type:t, amount:a, note:n, createdAt:d}); ok++;
  }
  alert(`匯入完成：交易 ${ok} 筆；略過 ${skip} 筆`);
}
async function importAllInterviewsCSV(){
  const file = await readFileFromPicker('fileImportAll','.csv,text/csv');
  if(!file) return;
  const text = await file.text(); const rows = csvToRows(text);
  if(rows.length<=1){ alert('CSV 無資料'); return; }
  const header=rows[0].map(h=>h.trim());
  const idxCustomer=header.indexOf('客戶'), idxDate=header.indexOf('日期'), idxTopic=header.indexOf('主題'), idxContent=header.indexOf('內容'), idxNext=header.indexOf('後續');
  if(idxCustomer<0 || idxDate<0 || idxTopic<0){ alert('CSV 欄位需包含：客戶、日期、主題（可含內容/後續）'); return; }
  let ok=0, skip=0;
  for(let i=1;i<rows.length;i++){ const r=rows[i];
    const name=String(r[idxCustomer]||'').trim(); if(!name){ skip++; continue; }
    const c=await ensureCustomerByName(name);
    const d=Date.parse(r[idxDate]); const topic=String(r[idxTopic]||'').trim();
    const content=String(r[idxContent]||'').trim(); const nextAction=String(r[idxNext]||'').trim();
    if(!isFinite(d) || !topic){ skip++; continue; }
    await saveInterview({customerId:c.id, date:d, topic, content, nextAction}); ok++;
  }
  alert(`匯入完成：訪談 ${ok} 筆；略過 ${skip} 筆`);
}
async function importAllDataJSON(){
  const file = await readFileFromPicker('fileImportAll','.json,application/json');
  if(!file) return;
  const text = await file.text();
  let payload;
  try{ payload = JSON.parse(text); }catch(e){ alert('JSON 解析失敗'); return; }
  const arr = Array.isArray(payload?.data) ? payload.data : [];
  let cntC=0, cntT=0, cntI=0;
  for(const block of arr){
    const c0 = block.customer||{}; if(!c0.name) continue;
    const c = await ensureCustomerByName(c0.name);
    for(const t of (block.txns||[])){ await saveTxn({customerId:c.id, type:t.type, amount:Number(t.amount||0), note:t.note||'', createdAt: Number(t.createdAt)||Date.parse(t.createdAt)||Date.now()}); cntT++; }
    for(const it of (block.interviews||[])){ await saveInterview({customerId:c.id, date: Number(it.date)||Date.parse(it.date)||Date.now(), topic:it.topic||'', content:it.content||'', nextAction:it.nextAction||''}); cntI++; }
    cntC++;
  }
  alert(`匯入完成：客戶 ${cntC} 位、交易 ${cntT} 筆、訪談 ${cntI} 筆`);
}
async function importCustomerCSVInteractive(){
  alert('請到某位客戶詳細頁，點「匯入CSV」即可針對該客戶匯入。');
}
