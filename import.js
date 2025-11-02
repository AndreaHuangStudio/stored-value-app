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
async function importCustomerCSV(customer){
  return new Promise((resolve)=>{
    const input=document.getElementById('fileImport'); input.value='';
    input.onchange=async ()=>{
      const file=input.files[0]; if(!file){ resolve({imported:0, skipped:0}); return; }
      const text=await file.text(); const rows=parseCSV(text);
      if(!rows || rows.length<=1){ resolve({imported:0, skipped:rows.length}); return; }
      const header=rows[0].map(h=>h.trim());
      const idxDate=header.indexOf('日期'), idxType=header.indexOf('類型'), idxAmt=header.indexOf('金額'), idxNote=header.indexOf('備註');
      if(idxDate<0 || idxType<0 || idxAmt<0){ alert('CSV 欄位需包含：日期、類型、金額（可含備註）'); resolve({imported:0, skipped:rows.length-1}); return; }
      let ok=0, skip=0;
      for(let i=1;i<rows.length;i++){ const r=rows[i];
        const d=Date.parse(r[idxDate]); const t=String(r[idxType]||'').trim(); const a=Number(r[idxAmt]); const n=String(r[idxNote]||'').trim();
        if(!isFinite(d) || !a || !t){ skip++; continue; }
        await saveTxn({customerId:customer.id, type:t, amount:a, note:n, createdAt:d}); ok++;
      }
      resolve({imported:ok, skipped:skip});
    };
    input.click();
  });
}