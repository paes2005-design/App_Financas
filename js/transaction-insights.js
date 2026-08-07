import { auth, db } from "./firebase.js";
import { formatMoney } from "./money.js";
import { getPeriod } from "./period.js";
import { convertAccountsToBRL } from "./exchange.js";
import { collection, onSnapshot, orderBy, query } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const configs={
  receitas:{collection:"receitas",title:"Detalhamento das receitas",button:"Detalhes",kind:"receita"},
  despesas:{collection:"despesas",title:"Detalhamento das despesas",button:"Detalhes",kind:"despesa"},
  transferencias:{collection:"transferencias",title:"Detalhamento das transferências",button:"Detalhes",kind:"transferencia"}
};
const state={receitas:[],despesas:[],transferencias:[]};
let stops=[];

const style=document.createElement("style");
style.textContent=`
.insight-trigger{margin-left:auto;border:1px solid var(--border);background:#fff;border-radius:9px;padding:8px 11px;color:var(--primary);font-weight:700}.insight-modal{position:fixed;inset:0;z-index:4200;display:grid;place-items:center;padding:18px}.insight-modal.hidden{display:none}.insight-backdrop{position:absolute;inset:0;background:rgba(15,23,42,.55)}.insight-sheet{position:relative;width:min(620px,100%);max-height:92vh;overflow:auto;background:white;border-radius:20px;padding:22px;box-shadow:0 24px 70px rgba(0,0,0,.28)}.insight-sheet-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.insight-sheet-head h2{margin:0}.insight-close{border:0;background:#eef3fa;border-radius:9px;width:38px;height:38px}.insight-section{margin-top:22px}.insight-section h4{margin:0 0 9px;color:var(--muted)}.insight-card{background:#f7f9fc;border-radius:18px;padding:16px}.insight-row{display:flex;justify-content:space-between;gap:18px;padding:3px 0}.insight-row strong{text-align:right}.insight-divider{height:1px;background:var(--border);margin:10px 0}.insight-positive{color:var(--secondary)}.insight-negative{color:var(--danger)}.insight-warning{color:#d28a00}.insight-muted{color:var(--muted)}
@media(max-width:600px){.insight-modal{align-items:end;padding:0}.insight-sheet{width:100%;max-height:94vh;border-radius:22px 22px 0 0;padding:20px 18px 28px}.insight-sheet:before{content:"";display:block;width:58px;height:6px;border-radius:999px;background:#ddd;margin:-8px auto 20px}}
`;
document.head.appendChild(style);

const modal=document.createElement("div");
modal.className="insight-modal hidden";
modal.innerHTML=`<div class="insight-backdrop"></div><section class="insight-sheet"><div class="insight-sheet-head"><h2 id="insightTitle"></h2><button type="button" class="insight-close" aria-label="Fechar">×</button></div><div id="insightBody"></div></section>`;
document.body.appendChild(modal);
modal.addEventListener("click",e=>{if(e.target.classList.contains("insight-backdrop")||e.target.closest(".insight-close"))modal.classList.add("hidden");});
document.addEventListener("keydown",e=>{if(e.key==="Escape")modal.classList.add("hidden");});

function ensureButtons(){
  Object.keys(configs).forEach(viewId=>{
    const view=document.getElementById(viewId);if(!view||view.querySelector(`[data-insight-open="${viewId}"]`))return;
    const navigator=view.querySelector(`#${viewId}MonthNavigator`)||view.firstElementChild;
    const row=document.createElement("div");row.style.cssText="display:flex;justify-content:flex-end;margin:8px 0 10px";
    row.innerHTML=`<button type="button" class="insight-trigger" data-insight-open="${viewId}">ⓘ ${configs[viewId].button}</button>`;
    navigator?.insertAdjacentElement("afterend",row);
  });
}
setTimeout(ensureButtons,0);

function rowsFor(viewId){const p=getPeriod(viewId);return state[viewId].filter(r=>r.data>=p.start&&r.data<=p.end);}
async function converted(value,moeda){if((moeda||"BRL")==="BRL")return Number(value||0);try{return (await convertAccountsToBRL([{moeda:moeda||"BRL",saldoInicial:Number(value||0)}])).total;}catch{return 0;}}
async function enrich(rows){return Promise.all(rows.map(async r=>({...r,_brl:await converted(r.valor,r.moeda)})));}
function sum(rows){return rows.reduce((s,r)=>s+Number(r._brl||0),0);}
function recurrenceLabel(r){const t=r.recorrenciaTipo||"unica";if(t==="fixa")return"fixa";if(t==="parcelada")return"parcelada";if(t==="periodo")return"periodo";return"unica";}
function reference(viewId){const p=getPeriod(viewId);return new Date(`${p.start}T12:00:00`).toLocaleDateString("pt-BR",{month:"long",year:"numeric"});}
function row(label,value,cls=""){return `<div class="insight-row"><span>${label}</span><strong class="${cls}">${value}</strong></div>`;}
function weekdayName(i){return["Domingos","Segundas","Terças","Quartas","Quintas","Sextas","Sábados"][i];}

async function build(viewId){
  const cfg=configs[viewId],raw=rowsFor(viewId),rows=await enrich(raw),total=sum(rows),planned=rows.filter(r=>r.planejada===true),posted=rows.filter(r=>r.planejada!==true),card=rows.filter(r=>r.formaPagamento==="cartao"||r.cartaoId);
  const rec={fixa:0,parcelada:0,periodo:0,unica:0};rows.forEach(r=>rec[recurrenceLabel(r)]+=Number(r._brl||0));
  const days=Array(7).fill(0);rows.forEach(r=>{const d=new Date(`${r.data}T12:00:00`);days[d.getDay()]+=Number(r._brl||0);});
  const weekdays=days[1]+days[2]+days[3]+days[4]+days[5],weekends=days[0]+days[6];
  let situation="";
  if(cfg.kind==="despesa") situation=`<div class="insight-section"><h4>Situação</h4><div class="insight-card">${row("Lançadas",formatMoney(sum(posted),"BRL"),"insight-negative")}${row("Planejadas",formatMoney(sum(planned),"BRL"),"insight-warning")}${row("Cartões de crédito",formatMoney(sum(card),"BRL"))}</div></div>`;
  else situation=`<div class="insight-section"><h4>Situação</h4><div class="insight-card">${row(cfg.kind==="receita"?"Recebidas":"Realizadas",formatMoney(sum(posted),"BRL"),cfg.kind==="receita"?"insight-positive":"")}${row("Planejadas",formatMoney(sum(planned),"BRL"),"insight-warning")}</div></div>`;
  const recurringTotal=rec.fixa+rec.parcelada+rec.periodo;
  const summary=`<div class="insight-section"><h4>Resumo</h4><div class="insight-card">${row("Referência",reference(viewId))}${row("Registros",String(rows.length))}${row("Total",formatMoney(total,"BRL"),cfg.kind==="despesa"?"insight-negative":cfg.kind==="receita"?"insight-positive":"")}${cfg.kind==="despesa"?row("Total sem cartões",formatMoney(total-sum(card),"BRL")):""}${row("Recorrentes",formatMoney(recurringTotal,"BRL"))}</div></div>`;
  const recurrence=`<div class="insight-section"><h4>Recorrência</h4><div class="insight-card">${row("Fixas",formatMoney(rec.fixa,"BRL"))}${row("Parceladas",formatMoney(rec.parcelada,"BRL"))}${row("Por período",formatMoney(rec.periodo,"BRL"))}${row("Únicas",formatMoney(rec.unica,"BRL"))}</div></div>`;
  const weekRows=[1,2,3,4,5,6,0].map(i=>row(weekdayName(i),formatMoney(days[i],"BRL"))).join("");
  const week=`<div class="insight-section"><h4>Semana</h4><div class="insight-card">${weekRows}<div class="insight-divider"></div>${row("Dias úteis",formatMoney(weekdays,"BRL"))}${row("Média dias úteis",formatMoney(weekdays/5,"BRL"))}${row("Fins de semana",formatMoney(weekends,"BRL"))}${row("Média fins de semana",formatMoney(weekends/2,"BRL"))}</div></div>`;
  return summary+situation+recurrence+week;
}

document.addEventListener("click",async e=>{const b=e.target.closest("[data-insight-open]");if(!b)return;const viewId=b.dataset.insightOpen;document.getElementById("insightTitle").textContent=configs[viewId].title;document.getElementById("insightBody").innerHTML='<div class="empty-state">Calculando...</div>';modal.classList.remove("hidden");document.getElementById("insightBody").innerHTML=await build(viewId);});
window.addEventListener("period-change",()=>{});

onAuthStateChanged(auth,user=>{stops.forEach(s=>s());stops=[];Object.keys(state).forEach(k=>state[k]=[]);if(!user)return;Object.entries(configs).forEach(([viewId,cfg])=>{const stop=onSnapshot(query(collection(db,"users",user.uid,cfg.collection),orderBy("data","desc")),snap=>{state[viewId]=snap.docs.map(d=>({id:d.id,...d.data()}));ensureButtons();});stops.push(stop);});});
