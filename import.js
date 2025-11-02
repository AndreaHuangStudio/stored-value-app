// A1.3.3a — 單一客戶 CSV 匯入（防重複）
function parseCSV(text){
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
// 產生交易指紋：同一客戶 + 類型 + 金額(兩位小數) + 時間戳(秒) + 備註前80字
function txnFingerprint(customerId, type, amount, createdAt, note){
  const amt = Number(amount||0).toFixed(2);
  const ts = Math.floor((typeof createdAt==='number'?createdAt:Date.parse(createdAt))/1000);
  const n = String(note||'').trim().slice(0,80);
  return `${customerId}|${type}|${amt}|${ts}|${n}`;
}
async function importCustomerCSV(customer){
  return new Promise((resolve)=>{
    const input=document.getElementById('fileImport'); input.value='';
    input.onchange=async ()=>{
      const file=input.files[0]; if(!file){ resolve({imported:0, skipped:0, duplicated:0}); return; }
      const text=await file.text(); const rows=parseCSV(text);
      if(!rows || rows.length<=1){ resolve({imported:0, skipped:rows.length, duplicated:0}); return; }
      const header=rows[0].map(h=>h.trim());
      const idxDate=header.indexOf('日期'), idxType=header.indexOf('類型'), idxAmt=header.indexOf('金額'), idxNote=header.indexOf('備註');
      if(idxDate<0 || idxType<0 || idxAmt<0){ alert('CSV 欄位需包含：日期、類型、金額（可含備註）'); resolve({imported:0, skipped:rows.length-1, duplicated:0}); return; }

      // 建立現有交易集合，避免重複
      const current = await listTxns(customer.id);
      const seen = new Set(current.map(t => txnFingerprint(customer.id, t.type, t.amount, t.createdAt, t.note)));

      let ok=0, skip=0, dup=0;
      for(let i=1;i<rows.length;i++){ const r=rows[i];
        const d=Date.parse(r[idxDate]); const t=String(r[idxType]||'').trim(); const a=Number(r[idxAmt]); const n=String(r[idxNote]||'').trim();
        if(!isFinite(d) || !a || !t){ skip++; continue; }
        const fp = txnFingerprint(customer.id, t, a, d, n);
        if(seen.has(fp)){ dup++; continue; }
        await saveTxn({customerId:customer.id, type:t, amount:a, note:n, createdAt:d});
        seen.add(fp); ok++;
      }
      resolve({imported:ok, skipped:skip, duplicated:dup});
    };
    input.click();
  });
}
