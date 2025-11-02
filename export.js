function asCSV(rows){
  const esc = (v)=>{
    if (v===null || v===undefined) return '';
    v = String(v).replace(/"/g,'""');
    return /[",\n]/.test(v) ? `"${v}"` : v;
  };
  return rows.map(r=>r.map(esc).join(',')).join('\n');
}
function saveBlob(filename, blob){
  if (navigator.share && blob.size < 9*1024*1024) {
    const file = new File([blob], filename, {type: blob.type});
    navigator.share({ files: [file], title: filename }).catch(()=>{
      const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; document.body.appendChild(a); a.click(); a.remove();
    });
    return;
  }
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; document.body.appendChild(a); a.click(); a.remove();
}
async function exportCustomerCSV(customer){
  const txns = await listTxns(customer.id);
  txns.sort((a,b)=>a.createdAt-b.createdAt);
  const rows = [['日期','類型','金額','備註']];
  for(const t of txns){ rows.push([new Date(t.createdAt).toISOString(), t.type, t.amount, t.note||'']); }
  const blob = new Blob([asCSV(rows)], {type:'text/csv;charset=utf-8'});
  saveBlob(`交易_${customer.name}_${new Date().toISOString().slice(0,10)}.csv`, blob);
}
async function exportCustomerInterviewsCSV(customer){
  let list = await listInterviews(customer.id);
  list.sort((a,b)=>a.date-b.date);
  const rows = [['日期','主題','內容','後續']];
  for(const it of list){ rows.push([new Date(it.date).toISOString(), it.topic||'', it.content||'', it.nextAction||'']); }
  const blob = new Blob([asCSV(rows)], {type:'text/csv;charset=utf-8'});
  saveBlob(`訪談_${customer.name}_${new Date().toISOString().slice(0,10)}.csv`, blob);
}
async function exportAllTxnsCSV(){
  const customers = await listCustomers();
  const rows = [['客戶','日期','類型','金額','備註']];
  for(const c of customers){
    const txns = await listTxns(c.id);
    txns.sort((a,b)=>a.createdAt-b.createdAt);
    for(const t of txns){
      rows.push([c.name, new Date(t.createdAt).toISOString(), t.type, t.amount, t.note||'']);
    }
  }
  const blob = new Blob([asCSV(rows)], {type:'text/csv;charset=utf-8'});
  saveBlob(`全部交易_${new Date().toISOString().slice(0,10)}.csv`, blob);
}
async function exportAllInterviewsCSV(){
  const customers = await listCustomers();
  const rows = [['客戶','日期','主題','內容','後續']];
  for(const c of customers){
    let list = await listInterviews(c.id);
    list.sort((a,b)=>a.date-b.date);
    for(const it of list){
      rows.push([c.name, new Date(it.date).toISOString(), it.topic||'', it.content||'', it.nextAction||'']);
    }
  }
  const blob = new Blob([asCSV(rows)], {type:'text/csv;charset=utf-8'});
  saveBlob(`全部訪談_${new Date().toISOString().slice(0,10)}.csv`, blob);
}
async function exportAllDataJSON(){
  const customers = await listCustomers();
  const payload = [];
  for(const c of customers){
    const txns = await listTxns(c.id);
    const interviews = await listInterviews(c.id);
    payload.push({ customer:c, txns, interviews });
  }
  const blob = new Blob([JSON.stringify({ exportedAt: Date.now(), data: payload }, null, 2)], {type:'application/json'});
  saveBlob(`儲值帳本_完整備份_${new Date().toISOString().slice(0,10)}.json`, blob);
}
