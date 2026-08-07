import { auth, db } from "./firebase.js";
import { formatMoney } from "./money.js";
import { createMonthNavigator, getPeriod } from "./period.js";
import { collection, onSnapshot, orderBy, query } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const dashboard=document.getElementById("dashboard");
let nav=document.getElementById("dashboardMonthNavigator");
if(!nav&&dashboard){nav=document.createElement("div");nav.id="dashboardMonthNavigator";dashboard.prepend(nav);}
createMonthNavigator("dashboard",nav);
const receitasMes=document.getElementById("receitasMes"),despesasMes=document.getElementById("despesasMes"),resultadoMes=document.getElementById("resultadoMes"),lista=document.getElementById("listaMovimentacoes");
let receitas=[],despesas=[],transferencias=[],stops=[];
function currentRows(rows){const p=getPeriod("dashboard");return rows.filter(item=>item.data>=p.start&&item.data<=p.end);}
function brlTotal(rows){return rows.filter(item=>(item.moeda||"BRL")==="BRL").reduce((sum,item)=>sum+Number(item.valor||0),0);}
function esc(v=""){return String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[c]);}
function render(){const r=currentRows(receitas),d=currentRows(despesas),t=currentRows(transferencias),totalR=brlTotal(r),totalD=brlTotal(d);receitasMes.textContent=formatMoney(totalR,"BRL");despesasMes.textContent=formatMoney(totalD,"BRL");resultadoMes.textContent=formatMoney(totalR-totalD,"BRL");const movimentos=[...r.map(x=>({...x,_tipo:"receita"})),...d.map(x=>({...x,_tipo:"despesa"})),...t.map(x=>({...x,_tipo:"transferencia"}))].sort((a,b)=>(b.data||"").localeCompare(a.data||"")).slice(0,10);lista.className=movimentos.length?"":"empty-state";lista.innerHTML=movimentos.length?movimentos.map(m=>`<div class="history-row"><span>${esc(m.descricao||m.categoriaNome||"Movimentação")} · ${esc(m.data||"")}</span><strong class="${m._tipo}">${m._tipo==="receita"?"+":m._tipo==="despesa"?"-":""}${formatMoney(m.valor,m.moeda||"BRL")}</strong></div>`).join(""):"Nenhuma movimentação neste mês.";}
window.addEventListener("period-change",event=>{if(event.detail.viewId==="dashboard")render();});
onAuthStateChanged(auth,user=>{stops.forEach(stop=>stop());stops=[];receitas=[];despesas=[];transferencias=[];render();if(!user)return;[["receitas",v=>receitas=v],["despesas",v=>despesas=v],["transferencias",v=>transferencias=v]].forEach(([name,setter])=>{const stop=onSnapshot(query(collection(db,"users",user.uid,name),orderBy("data","desc")),snap=>{setter(snap.docs.map(d=>({id:d.id,...d.data()})));render();},()=>{setter([]);render();});stops.push(stop);});});
