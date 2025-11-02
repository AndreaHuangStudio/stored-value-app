
function toCSV(rows){
  const esc = (v)=>{
    if (v===null || v===undefined) return '';
    v = String(v).replace(/"/g,'""');
    return /[",\n]/.test(v) ? `"${v}"` : v;
  };
  return rows.map(r=>Object.values(r).map(esc).join(',')).join('\n');
}
async function exportCustomerCSV(customer){
  const txns = await listTxns(customer.id);
  txns.sort((a,b)=>a.createdAt-b.createdAt);
  const header = ['日期','類型','金額','備註'];
  const rows = [header];
  for(const t of txns){
    rows.push([new Date(t.createdAt).toISOString(), t.type, t.amount, t.note||'']);
  }
  const csv = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `customer_${customer.name}_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
