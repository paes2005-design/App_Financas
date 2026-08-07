import { auth, db } from "./firebase.js";
import { formatMoney } from "./money.js";
import { getPeriod } from "./period.js";
import { convertAccountsToBRL, getRateToBRL } from "./exchange.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const saldoTotal=document.getElementById("saldoTotal");
const saldoCard=saldoTotal?.closest(".card");
let user=null,token=0;
function timestampDate(value){if(!value)return null;if(typeof value.toDate==="function")return value.toDate();if(typeof value.seconds==="number")return new Date(value.seconds*1000);const d=new Date(value);return Number.isNaN(d.getTime())?null:d;}
function monthKey(date){return String(date||"").slice(0,7);}
function accountStartMonth(acc){const d=timestampDate(acc.criadoEm||acc.createdAt||acc.dataCriacao);return d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`:monthKey(new Date().toISOString());}
function currencyLabel(code){const labels={BRL:"reais",USD:"dólares",EUR:"euros",GBP:"libras",JPY:"ienes",CHF:"francos suíços",CAD:"dólares canadenses",AUD:"dólares australianos",ARS:"pesos argentinos",CLP:"pesos chilenos",MXN:"pesos mexicanos",CNY:"yuans",UYU:"pesos uruguaios",PYG:"guaranis"};return labels[code]||code;}
function primaryCurrency(){return localStorage.getItem("app-financas-main-currency")||"BRL";}
async function fromBRL(value,currency){if(currency==="BRL")return value;const q=await getRateToBRL(currency);return q?.rate?value/q.rate:0;}
async function render(){
 if(!user||!saldoTotal)return;const my=++token,p=getPeriod("dashboard"),selectedMonth=monthKey(p.start);
 try{
  const snap=await getDocs(collection(db,"users",user.uid,"contas")),accounts=snap.docs.map(d=>({id:d.id,...d.data()})),main=primaryCurrency();
  const title=saldoCard?.querySelector(".balance-card-title span")||saldoCard?.querySelector("span");if(title)title.textContent=`Saldo total em ${currencyLabel(main)}`;
  const active=accounts.filter(acc=>selectedMonth>=accountStartMonth(acc));
  if(!active.length){saldoTotal.textContent=formatMoney(0,main);return;}
  const perAccount=await Promise.all(active.map(async acc=>{
   const base=`users/${user.uid}/contas/${acc.id}`,[currSnap,movSnap]=await Promise.all([getDocs(collection(db,base,"moedas")),getDocs(collection(db,base,"movimentacoes"))]);
   const currencies=[{codigo:acc.moeda||"BRL",saldoInicial:Number(acc.saldoInicial||0)},...currSnap.docs.map(d=>d.data())];
   const movs=movSnap.docs.map(d=>d.data()).filter(m=>m.data&&m.data<=p.end&&m.planejada!==true);
   return currencies.map(c=>{const code=c.codigo||"BRL",value=movs.filter(m=>(m.moeda||"BRL")===code).reduce((sum,m)=>sum+(m.tipo==="receita"?Number(m.valor||0):-Number(m.valor||0)),Number(c.saldoInicial||0));return{moeda:code,saldoInicial:value};});
  }));
  if(my!==token)return;const rows=perAccount.flat(),converted=rows.length?await convertAccountsToBRL(rows):{total:0},finalValue=await fromBRL(converted.total,main);if(my!==token)return;saldoTotal.textContent=formatMoney(finalValue,main);
 }catch(error){console.error("Falha ao aplicar regra mensal ao saldo total:",error);}
}
window.addEventListener("period-change",e=>{if(e.detail?.viewId==="dashboard")render();});
window.addEventListener("main-currency-change",render);
onAuthStateChanged(auth,current=>{user=current;render();});
