// A1.3.3c — 訪談可編輯日期 + lastModified
const $=(s)=>document.querySelector(s), $$=(s)=>Array.from(document.querySelectorAll(s));
const screenList=$('#screen-list'), screenDetail=$('#screen-detail');
let currentCustomer=null, currentFilter='all';

function wireDialogCancel(id) {
  const dlg = document.getElementById(id);
  if (!dlg) return;
  dlg.querySelectorAll('button[value="cancel"]').forEach(btn => {
    btn.setAttribute('type','button');
    btn.addEventListener('click', (e)=>{ e.preventDefault(); try{ dlg.close('cancel'); }catch(_){ } });
  });
  dlg.addEventListener('click', (e)=>{
    const r = dlg.getBoundingClientRect();
    const inBox = (e.clientX>=r.left && e.clientX<=r.right && e.clientY>=r.top && e.clientY<=r.bottom);
    if (!inBox) { try{ dlg.close('cancel'); }catch(_){ } }
  });
}

function showList(){ screenList.classList.add('active'); screenDetail.classList.remove('active'); renderCustomerList(); }
function showDetail(c){ currentCustomer=c; screenList.classList.remove('active'); screenDetail.classList.add('active'); $('#detailName').textContent=c.name; setContactLine(c); updateBalance(); renderTxnList(); renderInterviewList(); }
function setContactLine(c){ const p=[]; if(c.phone)p.push(`📞 ${c.phone}`); if(c.lineId)p.push(`💬 LINE: ${c.lineId}`); $('#detailContact').textContent=p.join('  ·  '); }
async function updateBalance(){ const bal=await calcBalance(currentCustomer.id); $('#detailBalance').textContent=new Intl.NumberFormat('zh-Hant-TW',{style:'currency',currency:'TWD'}).format(Number(bal||0)); }

function pad(n){ return String(n).padStart(2,'0'); }
function toLocalDatetimeValue(ms){
  const d = new Date(ms);
  const y = d.getFullYear(), m=pad(d.getMonth()+1), day=pad(d.getDate());
  const hh=pad(d.getHours()), mm=pad(d.getMinutes());
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

async function renderCustomerList(){
  const kw=$('#searchInput').value.trim(); const list=$('#customerList'); list.innerHTML=''; let arr=await listCustomers();
  if(kw){ arr=arr.filter(c=> (c.name&&c.name.includes(kw)) || (c.phone&&c.phone.includes(kw)) || (c.lineId&&c.lineId.includes(kw)) ); }
  const withBal=await Promise.all(arr.map(async c=>({...c,balance:await calcBalance(c.id),last:(await listTxns(c.id)).sort((a,b)=>b.createdAt-a.createdAt)[0]?.createdAt||null})));
  withBal.sort((a,b)=> a.name.localeCompare(b.name,'zh-Hant'));
  for(const c of withBal){
    const li=document.createElement('li'); li.className='item';
    const sub=[c.phone||'', c.lineId?`LINE:${c.lineId}`:'', c.last?new Date(c.last).toLocaleDateString():null].filter(Boolean).join(' ・ ');
    li.innerHTML=`<div class="row between"><div><div class="title">${c.name}</div><div class="sub">${sub}</div></div><div class="money">${new Intl.NumberFormat('zh-Hant-TW',{style:'currency',currency:'TWD'}).format(Number(c.balance||0))}</div></div>`;
    li.addEventListener('click',()=>showDetail(c)); list.appendChild(li);
  }
}

async function renderTxnList(){
  let txns=await listTxns(currentCustomer.id); txns.sort((a,b)=>b.createdAt-a.createdAt);
  if(currentFilter!=='all'){ txns=txns.filter(t=>t.type===currentFilter); }
  const ul=$('#txnList'); ul.innerHTML='';
  for(const t of txns){
    const li=document.createElement('li'); li.className='item';
    const sign=(t.type==='topup'||t.type==='refund'||(t.type==='adjust'&&Number(t.amount)>=0))?'+':'−';
    li.innerHTML=`<div class="row between"><div><div class="title">${labelOf(t.type)}</div><div class="sub">${new Date(t.createdAt).toLocaleString()} ${t.note?`・ ${t.note}`:''}</div></div><div class="money">${sign}${new Intl.NumberFormat('zh-Hant-TW',{style:'currency','currency':'TWD'}).format(Math.abs(Number(t.amount||0)))}</div></div>`;
    ul.appendChild(li);
  }
}

async function renderInterviewList(){
  const ul=$('#interviewList'); ul.innerHTML=''; let arr=await listInterviews(currentCustomer.id); arr.sort((a,b)=>b.date-a.date);
  for(const it of arr){
    const li=document.createElement('li'); li.className='item'; li.tabIndex=0;
    const edited = it.lastModified ? `（編輯於：${new Date(it.lastModified).toLocaleString()}）` : '';
    const summary=(it.content||'').length>60? it.content.slice(0,60)+'…' : (it.content||'');
    li.innerHTML=`<div class="row between"><div><div class="title">${it.topic||'(未命名主題)'}</div><div class="sub">🗓 ${new Date(it.date).toLocaleString()}${summary?` ・ ${summary}`:''}${it.nextAction?` ・ 後續：${it.nextAction}`:''} ${edited}</div></div></div>`;
    li.addEventListener('click',()=>openInterviewDialog(it));
    li.addEventListener('keydown',(e)=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); openInterviewDialog(it); } });
    ul.appendChild(li);
  }
}

// UI events
$('#btnAddCustomer').addEventListener('click',()=>openCustomerDialog());
$('#searchInput').addEventListener('input',renderCustomerList);
$('#btnBack').addEventListener('click',showList);
$('#btnEditCustomer').addEventListener('click',()=>openCustomerDialog(currentCustomer));
$('#btnExport').addEventListener('click',()=>exportCustomerCSV(currentCustomer));
$('#btnExportInterviews').addEventListener('click',()=>exportCustomerInterviewsCSV(currentCustomer));
$('#btnImport').addEventListener('click',async ()=>{
  const res=await importCustomerCSV(currentCustomer);
  $('#importSummary').textContent=`成功匯入 ${res.imported} 筆；略過 ${res.skipped} 筆；重複跳過 ${res.duplicated||0} 筆。`;
  document.getElementById('dlgImportResult').showModal();
  await updateBalance(); renderTxnList(); renderCustomerList(); renderInterviewList();
});
$('#btnDeleteCustomer').addEventListener('click',async ()=>{
  if(!currentCustomer) return;
  if(!confirm(`刪除「${currentCustomer.name}」及其所有交易與訪談？`)) return;
  await deleteCustomerCascade(currentCustomer.id); showList();
});
$$('.segmented .seg').forEach(btn=>{
  btn.addEventListener('click',()=>{
    $$('.segmented .seg').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); currentFilter=btn.dataset.filter; renderTxnList();
  });
});
$('#btnTopUp').addEventListener('click',()=>openTxnDialog('topup'));
$('#btnSpend').addEventListener('click',()=>openTxnDialog('spend'));
$('#btnAddInterview').addEventListener('click',()=>openInterviewDialog());

// 全站備份 + 全站匯入
$('#btnBackupAll').addEventListener('click',()=> document.getElementById('dlgBackupAll').showModal());
$('#btnImportAll').addEventListener('click',()=> document.getElementById('dlgImportAll').showModal());

document.getElementById('btnBackupTxns').addEventListener('click',()=>exportAllTxnsCSV());
document.getElementById('btnBackupInterviews').addEventListener('click',()=>exportAllInterviewsCSV());
document.getElementById('btnBackupJSON').addEventListener('click',()=>exportAllDataJSON());

document.getElementById('btnImportTxns').addEventListener('click',()=>importAllTxnsCSV());
document.getElementById('btnImportInterviews').addEventListener('click',()=>importAllInterviewsCSV());
document.getElementById('btnImportJSON').addEventListener('click',()=>importAllDataJSON());
document.getElementById('btnImportPartial').addEventListener('click',()=>importCustomerCSVInteractive());

['dlgCustomer','dlgTxn','dlgInterview','dlgImportResult','dlgBackupAll','dlgImportAll'].forEach(wireDialogCancel);

// Dialog helpers
function openCustomerDialog(edit=null){
  const dlg=$('#dlgCustomer'); $('#dlgCustomerTitle').textContent=edit?'編輯客戶':'新增客戶';
  $('#cName').value=edit?.name||''; $('#cPhone').value=edit?.phone||''; $('#cLineId').value=edit?.lineId||''; $('#cNote').value=edit?.note||'';
  dlg.showModal(); dlg.addEventListener('close',async ()=>{
    if(dlg.returnValue!=='ok') return;
    const c={id:edit?.id,name:$('#cName').value.trim(),phone:$('#cPhone').value.trim(),lineId:$('#cLineId').value.trim(),note:$('#cNote').value.trim()};
    if(!c.name) return; await saveCustomer(c);
    if(screenDetail.classList.contains('active')){
      currentCustomer=c; $('#detailName').textContent=c.name; setContactLine(c);
      await updateBalance(); renderInterviewList(); renderTxnList();
    }
    renderCustomerList();
  },{once:true});
}

function openTxnDialog(type){
  const dlg=$('#dlgTxn'); $('#dlgTxnTitle').textContent=type==='topup'?'儲值':(type==='spend'?'消費':'交易');
  $('#tAmount').value=''; $('#tNote').value=''; dlg.showModal();
  dlg.addEventListener('close',async ()=>{
    if(dlg.returnValue!=='ok') return;
    const amount=Number($('#tAmount').value); if(!(amount>0)) return;
    const t={customerId:currentCustomer.id,type,amount,note:$('#tNote').value.trim()};
    await saveTxn(t); await updateBalance(); renderTxnList(); renderCustomerList();
  },{once:true});
}

// 新：訪談可新增/編輯/刪除 + 編輯日期 + lastModified
function openInterviewDialog(edit=null){
  const dlg=$('#dlgInterview');
  const title=$('#dlgInterviewTitle');
  const delBtn=$('#btnDeleteInterview');
  const whenInput=$('#iWhen');
  const meta=$('#iMeta');

  // 預設時間
  const whenMs = edit?.date || Date.now();
  whenInput.value = toLocalDatetimeValue(whenMs);

  $('#iTopic').value=edit?.topic||'';
  $('#iContent').value=edit?.content||'';
  $('#iNext').value=edit?.nextAction||'';
  title.textContent = edit ? '編輯訪談紀錄' : '新增訪談紀錄';
  delBtn.style.display = edit ? 'inline-block' : 'none';
  meta.textContent = edit?.lastModified ? `上次編輯：${new Date(edit.lastModified).toLocaleString()}` : '';

  // 刪除
  delBtn.onclick = async ()=>{
    if(!edit) return;
    if(!confirm('確認刪除此筆訪談紀錄？')) return;
    await dbDelete('interviews', edit.id);
    dlg.close('cancel');
    renderInterviewList();
  };

  dlg.showModal();
  dlg.addEventListener('close',async ()=>{
    if(dlg.returnValue!=='ok') return;
    const picked = whenInput.value ? new Date(whenInput.value).getTime() : whenMs;
    const item={
      id: edit?.id,
      customerId: currentCustomer.id,
      topic: $('#iTopic').value.trim(),
      content: $('#iContent').value.trim(),
      nextAction: $('#iNext').value.trim(),
      date: picked,
      lastModified: Date.now()
    };
    if(!item.topic) return;
    await saveInterview(item);
    renderInterviewList();
  },{once:true});
}

function labelOf(t){ return {topup:'儲值',spend:'消費',adjust:'調整',refund:'退款'}[t]||t; }

(async function seed(){
  const customers=await listCustomers();
  if(customers.length===0){
    const alice=await saveCustomer({name:'陳小姐',phone:'0912-345-678',lineId:'chenbeauty'});
    const bob=await saveCustomer({name:'王先生',phone:'0922-888-000',lineId:'king888'});
    await saveTxn({customerId:alice.id,type:'topup',amount:3000,note:'開卡'});
    await saveTxn({customerId:alice.id,type:'spend',amount:1200,note:'護理A'});
    await saveTxn({customerId:bob.id,type:'topup',amount:2000,note:'現金'});
    await saveInterview({customerId:alice.id,topic:'初次諮詢',content:'希望改善肩頸緊繃',nextAction:'下週預約', date: Date.now(), lastModified: Date.now() });
  }
  showList();
})();
