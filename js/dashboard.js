import { auth, db } from "./firebase.js";
import { formatMoney } from "./money.js";
import { createMonthNavigator, getPeriod } from "./period.js";
import { convertAccountsToBRL } from "./exchange.js";
import { collection, getDocs, onSnapshot, orderBy, query } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const dashboard=document.getElementById("dashboard");
let nav=document.getElementById("dashboardMonthNavigator");
if(!nav&&dashboard){nav=document.createElement("div");nav.id="dashboardMonthNavigator";dashboard.prepend(nav);}
createMonthNavigator("dashboard",nav);

const receitasMes=document.getElementById("receitasMes"),despesasMes=document.getElementById("despesasMes"),resultadoMes=document.getElementById("resultadoMes"),lista=document.getElementById("listaMovimentacoes"),saldoTotal=document.getElementById("saldoTotal");
let receitas=[],despesas=[],transferencias=[],contas=[],cartoes=[],orcamentos=[],stops=[],usuario=null,renderToken=0;

const style=document.createElement("style");
style.textContent=`
.dashboard-toolbar{position:relative;grid-column:1/-1;width:100%}.dashboard-toolbar .month-navigator{width:100%;margin:0}.dashboard-settings-wrap{position:absolute;right:12px;top:50%;transform:translateY(-50%);z-index:20}.dashboard-settings-button,.info-button{border:1px solid var(--border);background:#fff;border-radius:9px;cursor:pointer}.dashboard-settings-button{padding:9px 12px}.info-button{width:23px;height:23px;border-radius:50%;font-weight:800;color:var(--primary);padding:0}.dashboard-settings-panel{position:absolute;right:0;top:calc(100% + 8px);z-index:30;width:min(310px,85vw);padding:14px;background:#fff;border:1px solid var(--border);border-radius:12px;box-shadow:0 12px 30px rgba(0,0,0,.16)}.dashboard-settings-panel label{display:flex;gap:9px;align-items:center;margin:9px 0}.balance-card-title{display:flex;align-items:center;gap:7px}.balance-info{margin-top:10px;padding:10px;border-radius:9px;background:#f5f8fc;font-size:.86rem}.balance-info-row{display:flex;justify-content:space-between;gap:12px;padding:5px 0}.balance-info-row+.balance-info-row{border-top:1px solid var(--border)}.balance-info-row span small{display:block;margin-top:2px;color:var(--muted)}.dashboard-detail-panel,.movements-panel{grid-column:span 2}.dashboard-detail-list .history-row{padding:8px 0}.hidden-panel{display:none!important}@media(max-width:980px){.dashboard-detail-panel,.movements-panel{grid-column:1/-1}}@media(max-width:760px){.dashboard-settings-wrap{position:static;transform:none;display:flex;justify-content:flex-end;margin-top:8px}.dashboard-settings-panel{position:fixed;right:12px;left:12px;top:90px;width:auto}.dashboard-toolbar .month-navigator{margin:0}}
`;
document.head.appendChild(style);

const saldoCard=saldoTotal?.closest(".card");
if(saldoCard){
  const original=saldoCard.querySelector("span");
  const title=document.createElement("div");title.className="balance-card-title";
  original.replaceWith(title);title.appendChild(original);
  const infoBtn=document.createElement("button");infoBtn.type="button";infoBtn.className="info-button";infoBtn.textContent="i";infoBtn.setAttribute("aria-label","Detalhar saldo por moeda");title.appendChild(infoBtn);
  const info=document.createElement("div");info.id="saldoInfoDetalhes";info.className="balance-info hidden";saldoCard.appendChild(info);
  infoBtn.addEventListener("click",()=>info.classList.toggle("hidden"));
  infoBtn.addEventListener("mouseenter",()=>info.classList.remove("hidden"));
  infoBtn.addEventListener("mouseleave",()=>{if(!info.matches(":hover"))info.classList.add("hidden");});
}

const toolbar=document.createElement("div");toolbar.className="dashboard-toolbar";
nav.parentNode.insertBefore(toolbar,nav);toolbar.appendChild(nav);
const settingsWrap=document.createElement("div");settingsWrap.className="dashboard-settings-wrap";toolbar.appendChild(settingsWrap);
settingsWrap.innerHTML=`<button type="button" class="dashboard-settings-button" aria-label="Configurar dashboard">⚙ Configurar</button><div class="dashboard-settings-panel hidden"><strong>Itens da dashboard</strong><label><input type="checkbox" data-panel="movimentacoes" checked> Últimas movimentações</label><label><input type="checkbox" data-panel="receitas" checked> Detalhamento de receitas</label><label><input type="checkbox" data-panel="despesas" checked> Detalhamento de despesas</label><label><input type="checkbox" data-panel="contas"> Detalhamento de contas</label><label><input type="checkbox" data-panel="transferencias"> Transferências</label><label><input type="checkbox" data-panel="cartoes"> Despesas de cartões</label><label><input type="checkbox" data-panel="orcamentos"> Orçamentos</label></div>`;
const settingsButton=settingsWrap.querySelector("button"),settingsPanel=settingsWrap.querySelector("div");settingsButton.addEventListener("click",()=>settingsPanel.classList.toggle("hidden"));

const movementsPanel=lista.closest(".panel");movementsPanel.dataset.dashboardPanel="movimentacoes";
function createPanel(id,title){const panel=document.createElement("article");panel.className="panel dashboard-detail-panel";panel.dataset.dashboardPanel=id;panel.innerHTML=`<h3>${title}</h3><div id="dashboard-${id}" class="dashboard-detail-list empty-state">Nenhum registro neste mês.</div>`;dashboard.appendChild(panel);return panel;}
createPanel("receitas","Detalhamento de receitas");createPanel("despesas","Detalhamento de despesas");createPanel("contas","Detalhamento de contas");createPanel("transferencias","Transferências");createPanel("cartoes","Despesas de cartões");createPanel("orcamentos","Orçamentos");

const PREF_KEY="app-financas-dashboard-panels";
function loadPrefs(){let saved={};try{saved=JSON.parse(localStorage.getItem(PREF_KEY)||"{}");}catch{}settingsPanel.querySelectorAll("[data-panel]").forEach(input=>{if(Object.hasOwn(saved,input.dataset.panel))input.checked=Boolean(saved[input.dataset.panel]);});applyPrefs();}
function applyPrefs(){const prefs={};settingsPanel.querySelectorAll("[data-panel]").forEach(input=>{prefs[input.dataset.panel]=input.checked;document.querySelector(`[data-dashboard-panel="${input.dataset.panel}"]`)?.classList.toggle("hidden-panel",!input.checked);});localStorage.setItem(PREF_KEY,JSON.stringify(prefs));}
settingsPanel.addEventListener("change",applyPrefs);loadPrefs();

function currentRows(rows){const p=getPeriod("dashboard");return rows.filter(item=>item.data>=p.start&&item.data<=p.end);}
function esc(v=""){return String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[c]);}
async function convertedTotal(rows){if(!rows.length)return 0;const result=await convertAccountsToBRL(rows.map(r=>({moeda:r.moeda||"BRL",saldoInicial:Number(r.valor||0)})));return result.total;}
function renderList(id,rows,type){const el=document.getElementById(`dashboard-${id}`);if(!el)return;el.className=rows.length?"dashboard-detail-list":"dashboard-detail-list empty-state";el.innerHTML=rows.length?rows.slice(0,10).map(r=>`<div class="history-row"><span>${esc(r.descricao||r.categoriaNome||r.nome||"Registro")} · ${esc(r.data||"")}</span><strong class="${type}">${type==="receita"?"+":type==="despesa"?"-":""}${formatMoney(r.valor||r.saldoInicial||0,r.moeda||"BRL")}</strong></div>`).join(""):"Nenhum registro neste mês.";}

async function accountBreakdown(){
  if(!usuario||!contas.length)return{accounts:[],currencies:[]};
  const accounts=await Promise.all(contas.map(async conta=>{
    const base=`users/${usuario.uid}/contas/${conta.id}`;
    const [moedasSnap,movsSnap]=await Promise.all([getDocs(collection(db,base,"moedas")),getDocs(collection(db,base,"movimentacoes"))]);
    const movs=movsSnap.docs.map(d=>d.data());
    const moedas=[{codigo:conta.moeda||"BRL",saldoInicial:Number(conta.saldoInicial||0)},...moedasSnap.docs.map(d=>d.data())];
    const saldos=moedas.map(m=>({
      moeda:m.codigo,
      saldoInicial:movs.filter(x=>(x.moeda||"BRL")===m.codigo).reduce((s,x)=>s+(x.tipo==="receita"?Number(x.valor||0):-Number(x.valor||0)),Number(m.saldoInicial||0))
    }));
    const conv=await convertAccountsToBRL(saldos);
    return{...conta,total:conv.total,saldos};
  }));
  const grouped=new Map();
  accounts.forEach(account=>account.saldos.forEach(item=>grouped.set(item.moeda,(grouped.get(item.moeda)||0)+Number(item.saldoInicial||0))));
  const currencies=await Promise.all([...grouped].map(async([moeda,valor])=>{
    const converted=await convertAccountsToBRL([{moeda,saldoInicial:valor}]);
    return{moeda,valor,convertido:converted.total};
  }));
  currencies.sort((a,b)=>a.moeda==="BRL"?-1:b.moeda==="BRL"?1:a.moeda.localeCompare(b.moeda));
  return{accounts,currencies};
}

async function render(){
  const token=++renderToken;
  const r=currentRows(receitas),d=currentRows(despesas),t=currentRows(transferencias);
  try{
    const [totalR,totalD,breakdown]=await Promise.all([convertedTotal(r),convertedTotal(d),accountBreakdown()]);
    if(token!==renderToken)return;
    receitasMes.textContent=formatMoney(totalR,"BRL");despesasMes.textContent=formatMoney(totalD,"BRL");resultadoMes.textContent=formatMoney(totalR-totalD,"BRL");
    const info=document.getElementById("saldoInfoDetalhes");
    if(info)info.innerHTML=breakdown.currencies.length?breakdown.currencies.map(item=>`<div class="balance-info-row"><span><strong>${esc(item.moeda)}</strong><small>${item.moeda==="BRL"?"Saldo total em reais":"Saldo agrupado de todas as contas"}</small></span><span><strong>${formatMoney(item.valor,item.moeda)}</strong>${item.moeda!=="BRL"?`<small>≈ ${formatMoney(item.convertido,"BRL")}</small>`:""}</span></div>`).join(""):"Nenhum saldo cadastrado.";
    renderList("receitas",r,"receita");renderList("despesas",d,"despesa");renderList("contas",breakdown.accounts.map(a=>({...a,valor:a.total,moeda:"BRL"})),"");renderList("transferencias",t,"transferencia");renderList("cartoes",currentRows(cartoes),"despesa");renderList("orcamentos",currentRows(orcamentos),"");
  }catch(error){console.error(error);}
  const movimentos=[...r.map(x=>({...x,_tipo:"receita"})),...d.map(x=>({...x,_tipo:"despesa"})),...t.map(x=>({...x,_tipo:"transferencia"}))].sort((a,b)=>(b.data||"").localeCompare(a.data||"")).slice(0,10);
  lista.className=movimentos.length?"":"empty-state";
  lista.innerHTML=movimentos.length?movimentos.map(m=>`<div class="history-row"><span>${esc(m.descricao||m.categoriaNome||"Movimentação")} · ${esc(m.data||"")}</span><strong class="${m._tipo}">${m._tipo==="receita"?"+":m._tipo==="despesa"?"-":""}${formatMoney(m.valor,m.moeda||"BRL")}</strong></div>`).join(""):"Nenhuma movimentação neste mês.";
}

window.addEventListener("period-change",event=>{if(event.detail.viewId==="dashboard")render();});
onAuthStateChanged(auth,user=>{usuario=user;stops.forEach(stop=>stop());stops=[];receitas=[];despesas=[];transferencias=[];contas=[];cartoes=[];orcamentos=[];render();if(!user)return;[["receitas",v=>receitas=v],["despesas",v=>despesas=v],["transferencias",v=>transferencias=v],["contas",v=>contas=v],["cartoes",v=>cartoes=v],["orcamentos",v=>orcamentos=v]].forEach(([name,setter])=>{const qref=name==="contas"?collection(db,"users",user.uid,name):query(collection(db,"users",user.uid,name),orderBy("data","desc"));const stop=onSnapshot(qref,snap=>{setter(snap.docs.map(d=>({id:d.id,...d.data()})));render();},()=>{setter([]);render();});stops.push(stop);});});
