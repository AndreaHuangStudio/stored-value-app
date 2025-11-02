
const DB_NAME = 'sv-ledger-db';
const DB_VERSION = 2; // bump for new store + customer field
const STORE_CUSTOMERS = 'customers';
const STORE_TXNS = 'transactions';
const STORE_INTERVIEWS = 'interviews';

let dbPromise;

function openDB(){
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e)=>{
      const db = req.result;
      // customers
      let s;
      if (!db.objectStoreNames.contains(STORE_CUSTOMERS)){
        s = db.createObjectStore(STORE_CUSTOMERS, { keyPath:'id' });
        s.createIndex('name','name',{unique:false});
        s.createIndex('phone','phone',{unique:false});
        s.createIndex('lineId','lineId',{unique:false});
      } else {
        s = req.transaction.objectStore(STORE_CUSTOMERS);
        if (!s.indexNames.contains('name')) s.createIndex('name','name',{unique:false});
        if (!s.indexNames.contains('phone')) s.createIndex('phone','phone',{unique:false});
        if (!s.indexNames.contains('lineId')) s.createIndex('lineId','lineId',{unique:false});
      }
      // transactions
      if (!db.objectStoreNames.contains(STORE_TXNS)){
        const t = db.createObjectStore(STORE_TXNS, { keyPath:'id' });
        t.createIndex('customerId','customerId',{unique:false});
        t.createIndex('createdAt','createdAt',{unique:false});
        t.createIndex('type','type',{unique:false});
      }
      // interviews
      if (!db.objectStoreNames.contains(STORE_INTERVIEWS)){
        const i = db.createObjectStore(STORE_INTERVIEWS, { keyPath:'id' });
        i.createIndex('customerId','customerId',{unique:false});
        i.createIndex('date','date',{unique:false});
      }
    };
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
  return dbPromise;
}

// Generic helpers
async function dbPut(store, value){
  const db = await openDB();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(store,'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = ()=> resolve(value);
    tx.onerror = ()=> reject(tx.error);
  });
}
async function dbGetAll(store, indexName=null, query=null){
  const db = await openDB();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(store,'readonly');
    const os = tx.objectStore(store);
    const source = indexName ? os.index(indexName) : os;
    const req = source.getAll(query);
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
}
async function dbDelete(store, key){
  const db = await openDB();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(store,'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = ()=> resolve();
    tx.onerror = ()=> reject(tx.error);
  });
}
async function dbFilter(store, predicate){
  const all = await dbGetAll(store);
  return all.filter(predicate);
}

// Domain API
async function listCustomers(){ return dbGetAll(STORE_CUSTOMERS); }
async function saveCustomer(c){
  c.id = c.id || crypto.randomUUID();
  c.lineId = c.lineId || '';
  return dbPut(STORE_CUSTOMERS, c);
}
async function deleteCustomerCascade(id){
  const txns = await dbFilter(STORE_TXNS, t=>t.customerId===id);
  await Promise.all(txns.map(t=>dbDelete(STORE_TXNS, t.id)));
  const interviews = await dbFilter(STORE_INTERVIEWS, t=>t.customerId===id);
  await Promise.all(interviews.map(t=>dbDelete(STORE_INTERVIEWS, t.id)));
  await dbDelete(STORE_CUSTOMERS, id);
}
async function listTxns(customerId){ return dbGetAll(STORE_TXNS, 'customerId', customerId); }
async function saveTxn(t){ t.id = t.id || crypto.randomUUID(); t.createdAt = t.createdAt || Date.now(); return dbPut(STORE_TXNS, t); }

async function calcBalance(customerId){
  const txns = await listTxns(customerId);
  return txns.reduce((acc,t)=>{
    const amt = Number(t.amount||0);
    if (t.type==='topup' || t.type==='refund') return acc + amt;
    if (t.type==='spend') return acc - amt;
    if (t.type==='adjust') return acc + amt;
    return acc;
  }, 0);
}

// Interviews
async function listInterviews(customerId){ return dbGetAll(STORE_INTERVIEWS, 'customerId', customerId); }
async function saveInterview(i){
  i.id = i.id || crypto.randomUUID();
  i.date = i.date || Date.now();
  return dbPut(STORE_INTERVIEWS, i);
}
