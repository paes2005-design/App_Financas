import { auth, db } from "./firebase.js";
import { formatMoney } from "./money.js";
import { getPeriod } from "./period.js";
import { convertAccountsToBRL } from "./exchange.js";
import { collection, onSnapshot, orderBy, query } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const total=document.getElementById("totalReceitasFiltradas");
const filterAccount=document.getElementById("filtroReceitaConta");
const filterCategory=document.getElementById("filtroReceitaCategoria");
const filterSub=document.getElementById("filtroReceitaSubcategoria");
const filterCurrency=document.getElementById("filtroReceitaMoeda");
let rows=[],stop=null,token=0;

function selectedRows(){
  const p=getPeriod("receitas");
  return rows.filter(r=>r.data>=p.start&&r.data<=p.end)
    .filter(r=>(!filterAccount?.value||r.contaId===filterAccount.value)
      &&(!filterCategory?.value||r.categoriaId===filterCategory.value)
      &&(!filterSub?.value||r.subcategoria===filterSub.value)
      &&(!filterCurrency?.value||(r.moeda||"BRL")===filterCurrency.value));
}

async function render(){
  if(!total)return;
  const current=++token;
  const filtered=selectedRows();
  if(!filtered.length){total.textContent="Sem receitas no período";return;}
  const sums=new Map();
  filtered.forEach(r=>{const currency=r.moeda||"BRL";sums.set(currency,(sums.get(currency)||0)+Number(r.valor||0));});
  const ordered=[...sums].sort(([a],[b])=>a==="BRL"?-1:b==="BRL"?1:a.localeCompare(b));
  total.textContent=`${ordered.map(([currency,value])=>formatMoney(value,currency)).join(" · ")} · calculando total convertido...`;
  try{
    const conversion=await convertAccountsToBRL(filtered.map(r=>({moeda:r.moeda||"BRL",saldoInicial:Number(r.valor||0)})));
    if(current!==token)return;
    total.textContent=`${ordered.map(([currency,value])=>formatMoney(value,currency)).join(" · ")} · Total convertido: ${formatMoney(conversion.total,"BRL")}`;
  }catch(error){
    if(current!==token)return;
    total.textContent=`${ordered.map(([currency,value])=>formatMoney(value,currency)).join(" · ")} · Conversão indisponível`;
    console.error(error);
  }
}

[filterAccount,filterCategory,filterSub,filterCurrency].filter(Boolean).forEach(el=>el.addEventListener("change",()=>setTimeout(render,0)));
window.addEventListener("period-change",event=>{if(event.detail.viewId==="receitas")setTimeout(render,0);});
onAuthStateChanged(auth,user=>{if(stop)stop();rows=[];render();if(!user)return;stop=onSnapshot(query(collection(db,"users",user.uid,"receitas"),orderBy("data","desc")),snap=>{rows=snap.docs.map(d=>({id:d.id,...d.data()}));setTimeout(render,0);});});
