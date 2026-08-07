const API_BASE = "https://api.frankfurter.dev/v2/rate";
const CACHE_PREFIX = "app-financas-fx:";
const CACHE_TTL = 60 * 60 * 1000;

function readCache(currency){
  try { const item=JSON.parse(localStorage.getItem(CACHE_PREFIX+currency)); return item && Date.now()-item.savedAt<CACHE_TTL ? item : null; } catch { return null; }
}
function writeCache(currency,data){ try{localStorage.setItem(CACHE_PREFIX+currency,JSON.stringify({...data,savedAt:Date.now()}));}catch{} }

export async function getRateToBRL(currency){
  if(!currency || currency==="BRL") return {rate:1,date:new Date().toISOString().slice(0,10),provider:"BRL",savedAt:Date.now()};
  const cached=readCache(currency); if(cached) return cached;
  const urls=[`${API_BASE}/${currency}/BRL?providers=BCB`,`${API_BASE}/${currency}/BRL`];
  let lastError;
  for(const url of urls){
    try{ const response=await fetch(url,{headers:{Accept:"application/json"}}); if(!response.ok) throw new Error(`HTTP ${response.status}`); const data=await response.json(); if(!Number.isFinite(Number(data.rate))) throw new Error("Cotação inválida"); const result={rate:Number(data.rate),date:data.date||"",provider:url.includes("providers=BCB")?"BCB/PTAX":"Frankfurter",savedAt:Date.now()}; writeCache(currency,result); return result; }catch(error){ lastError=error; }
  }
  throw lastError || new Error("Cotação indisponível");
}

export async function convertAccountsToBRL(accounts){
  const currencies=[...new Set(accounts.map(a=>a.moeda||"BRL"))];
  const rates=new Map();
  await Promise.all(currencies.map(async currency=>{ try{rates.set(currency,await getRateToBRL(currency));}catch(error){rates.set(currency,{rate:null,error:error.message});} }));
  let total=0; const unavailable=[]; let latestDate="",latestCheckedAt=0;
  for(const account of accounts){ const currency=account.moeda||"BRL"; const quote=rates.get(currency); if(!quote?.rate){unavailable.push(currency);continue;} total+=Number(account.saldoInicial||0)*quote.rate; if(quote.date>latestDate) latestDate=quote.date; if(Number(quote.savedAt||0)>latestCheckedAt)latestCheckedAt=Number(quote.savedAt||0); }
  return {total,rates,unavailable:[...new Set(unavailable)],latestDate,latestCheckedAt};
}
