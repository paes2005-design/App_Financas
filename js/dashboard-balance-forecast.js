import { auth, db } from "./firebase.js";
import { formatMoney } from "./money.js";
import { getPeriod } from "./period.js";
import { convertAccountsToBRL } from "./exchange.js";
import { collection, getDocs, onSnapshot, orderBy, query } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const dashboard=document.getElementById("dashboard");
const saldoTotal=document.getElementById("saldoTotal");
const receitasMes=document.getElementById("receitasMes");
const despesasMes=document.getElementById("despesasMes");
const resultadoMes=document.getElementById("resultadoMes");
const exchangeStatus=document.getElementById("exchangeStatus");
let user=null,receitas=[],despesas=[],stops=[],token=0;

const style=document.createElement("style");
style.textContent=`
.balance-mini-summary{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:10px;padding-top:9px;border-top:1px solid var(--border)}
.balance-mini-item{min-width:0}.balance-mini-item span{display:block!important;margin:0 0 3px!important;color:var(--muted);font-size:.72rem}.balance-mini-item strong{display:block;font-size:.88rem!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.balance-mini-item:last-child{text-align:right}.balance-info-reference{margin-top:8px;padding-top:8px;border-top:1px solid var(--border);color:var(--muted);font-size:.72rem;line-height:1.35}
@media(max-width:420px){.balance-mini-summary{gap:8px}.balance-mini-item strong{font-size:.82rem!important}}
`;
document.head.appendChild(style);

function addMini(valueEl,id,leftLabel,rightLabel){
  if(!valueEl||document.getElementById(id))return;
  const mini=document.createElement("div");
  mini.id=id;mini.className="balance-mini-summary";
  mini.innerHTML=`<div class="balance-mini-item"><span>${leftLabel}</span><strong id="${id}Left" class="financial-value">R$ 0,00</strong></div><div class="balance-mini-item"><span>${rightLabel}</span><strong id="${id}Right" class="financial-value">R$ 0,00</strong></div>`;
  valueEl.insertAdjacentElement("afterend",mini);
}
addMini(saldoTotal,"dashboardBalanceMini","Inicial","Previsão");
addMini(receitasMes,"dashboardRevenueMini","Realizado","Previsão");
addMini(despesasMes,"dashboardExpenseMini","Realizado","Previsão");
addMini(resultadoMes,"dashboardResultMini","Realizado","Previsão");

function current(rows){const p=getPeriod("dashboard");return rows.filter(r=>r.data>=p.start&&r.data<=p.end);}
function realized(rows){return rows.filter(r=>r.planejada!==true);}
async function convertedRows(rows){if(!rows.length)return 0;return (await convertAccountsToBRL(rows.map(r=>({moeda:r.moeda||"BRL",saldoInicial:Number(r.valor||0)})))).total;}
function monthKey(date){return String(date).slice(0,7);}
function timestampDate(value){if(!value)return null;if(typeof value.toDate==="function")return value.toDate();if(typeof value.seconds==="number")return new Date(value.seconds*1000);const d=new Date(value);return Number.isNaN(d.getTime())?null:d;}
function accountStartMonth(acc){const d=timestampDate(acc.criadoEm||acc.createdAt||acc.dataCriacao);return d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`:monthKey(new Date().toISOString());}

async function openingBalance(){
  if(!user)return 0;
  const p=getPeriod("dashboard"),selectedMonth=monthKey(p.start);
  const accountsSnap=await getDocs(collection(db,"users",user.uid,"contas"));
  const currencyTotals=new Map();
  await Promise.all(accountsSnap.docs.map(async accDoc=>{
    const acc={id:accDoc.id,...accDoc.data()},startMonth=accountStartMonth(acc);
    if(selectedMonth<startMonth)return;
    const base=`users/${user.uid}/contas/${acc.id}`;
    const [currSnap,movSnap]=await Promise.all([getDocs(collection(db,base,"moedas")),getDocs(collection(db,base,"movimentacoes"))]);
    const currencies=[{codigo:acc.moeda||"BRL",saldoInicial:Number(acc.saldoInicial||0)},...currSnap.docs.map(d=>d.data())];
    const movs=movSnap.docs.map(d=>d.data()).filter(m=>m.data&&m.data<p.start&&m.planejada!==true);
    currencies.forEach(c=>{
      const code=c.codigo||"BRL";let value=Number(c.saldoInicial||0);
      movs.filter(m=>(m.moeda||"BRL")===code).forEach(m=>{value+=m.tipo==="receita"?Number(m.valor||0):-Number(m.valor||0);});
      currencyTotals.set(code,(currencyTotals.get(code)||0)+value);
    });
  }));
  if(!currencyTotals.size)return 0;
  return (await convertAccountsToBRL([...currencyTotals].map(([moeda,saldoInicial])=>({moeda,saldoInicial})))).total;
}

function setPair(id,left,right,{negativeRight=false,negativeLeft=false}={}){
  const l=document.getElementById(`${id}Left`),r=document.getElementById(`${id}Right`);
  if(l){l.textContent=formatMoney(left,"BRL");l.style.color=negativeLeft&&left<0?"var(--danger)":"";}
  if(r){r.textContent=formatMoney(right,"BRL");r.style.color=negativeRight&&right<0?"var(--danger)":"";}
}

async function render(){
  const my=++token;
  try{
    const monthR=current(receitas),monthD=current(despesas),doneR=realized(monthR),doneD=realized(monthD);
    const [initial,realR,realD,forecastR,forecastD]=await Promise.all([openingBalance(),convertedRows(doneR),convertedRows(doneD),convertedRows(monthR),convertedRows(monthD)]);
    if(my!==token)return;
    const realResult=realR-realD,forecastResult=forecastR-forecastD,forecastBalance=initial+forecastResult;

    // Os valores grandes representam o que já foi efetivado no mês.
    if(receitasMes)receitasMes.textContent=formatMoney(realR,"BRL");
    if(despesasMes)despesasMes.textContent=formatMoney(realD,"BRL");
    if(resultadoMes){resultadoMes.textContent=formatMoney(realResult,"BRL");resultadoMes.style.color=realResult<0?"var(--danger)":"";}

    setPair("dashboardBalanceMini",initial,forecastBalance,{negativeRight:true,negativeLeft:true});
    setPair("dashboardRevenueMini",realR,forecastR);
    setPair("dashboardExpenseMini",realD,forecastD);
    setPair("dashboardResultMini",realResult,forecastResult,{negativeRight:true,negativeLeft:true});
  }catch(error){console.error("Falha ao calcular realizado/previsão da dashboard:",error);}
}

function annotateInfo(){
  const ref=(exchangeStatus?.textContent||"").trim();if(!ref)return;
  ["saldoInfoDetalhes","receitasInfoDetalhes","despesasInfoDetalhes","resultadoInfoDetalhes"].forEach(id=>{
    const box=document.getElementById(id);if(!box)return;let line=box.querySelector(".balance-info-reference");const text=`Referência da cotação: ${ref}`;
    if(!line){line=document.createElement("div");line.className="balance-info-reference";box.appendChild(line);}if(line.textContent!==text)line.textContent=text;
  });
}
let annotateTimer=null;const observer=new MutationObserver(()=>{clearTimeout(annotateTimer);annotateTimer=setTimeout(annotateInfo,40);});if(dashboard)observer.observe(dashboard,{childList:true,subtree:true,characterData:true});annotateInfo();
window.addEventListener("period-change",e=>{if(e.detail.viewId==="dashboard")render();});
onAuthStateChanged(auth,current=>{user=current;stops.forEach(s=>s());stops=[];receitas=[];despesas=[];render();if(!current)return;[["receitas",v=>receitas=v],["despesas",v=>despesas=v]].forEach(([name,set])=>{stops.push(onSnapshot(query(collection(db,"users",current.uid,name),orderBy("data","desc")),snap=>{set(snap.docs.map(d=>({id:d.id,...d.data()})));render();},()=>{set([]);render();}));});});
