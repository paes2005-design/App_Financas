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
let receitas=[],despesas=[],transferencias=[],contas=[],orcamentos=[],stops=[],usuario=null,renderToken=0,settingsHistoryActive=false;

const style=document.createElement("style");style.textContent=`
.dashboard-toolbar{position:relative;grid-column:1/-1;width:100%}.dashboard-toolbar .month-navigator{width:100%;margin:0}.dashboard-actions{display:flex;gap:8px;position:absolute;right:12px;top:50%;transform:translateY(-50%);z-index:20}.dashboard-action-button,.info-button{border:1px solid var(--border);background:#fff;border-radius:9px;cursor:pointer}.dashboard-action-button{padding:9px 12px;white-space:nowrap}.dashboard-settings-wrap{position:relative}.dashboard-settings-panel{position:absolute;right:0;top:calc(100% + 8px);z-index:40;width:min(320px,88vw);padding:14px;background:#fff;border:1px solid var(--border);border-radius:12px;box-shadow:0 12px 30px rgba(0,0,0,.16)}.dashboard-settings-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}.dashboard-settings-back{border:0;background:#eef3fa;border-radius:8px;padding:7px 10px;color:var(--primary);font-weight:700}.dashboard-settings-panel label{display:flex;gap:9px;align-items:center;margin:9px 0}.info-button{width:23px;height:23px;border-radius:50%;font-weight:800;color:var(--primary);padding:0}.balance-card-title{display:flex;align-items:center;gap:7px}.balance-info{margin-top:10px;padding:10px;border-radius:9px;background:#f5f8fc;font-size:.86rem}.balance-info-row{display:flex;justify-content:space-between;gap:12px;padding:5px 0}.balance-info-row+.balance-info-row{border-top:1px solid var(--border)}.balance-info-row span small{display:block;margin-top:2px;color:var(--muted)}.dashboard-detail-panel,.movements-panel{grid-column:span 2}.dashboard-detail-list .history-row{padding:8px 0}.hidden-panel{display:none!important}.dashboard-values-hidden .financial-value{visibility:hidden}.dashboard-values-hidden .financial-value::after{content:"••••";visibility:visible;display:inline-block;letter-spacing:.12em;color:var(--muted)}
@media(max-width:1180px){.dashboard-actions{position:static;transform:none;grid-column:1/-1;justify-content:flex-end;margin-top:8px}.dashboard-toolbar{display:contents}.dashboard-settings-panel{right:0}}@media(max-width:980px){.dashboard-detail-panel,.movements-panel{grid-column:1/-1}}@media(max-width:760px){.dashboard-settings-panel{position:fixed;right:12px;left:12px;top:90px;width:auto;max-height:calc(100vh - 110px);overflow:auto}.dashboard-actions{width:100%;justify-content:flex-end}.dashboard-action-button{padding:9px 11px}}
`;document.head.appendChild(style);
[saldoTotal,receitasMes,despesasMes,resultadoMes].filter(Boolean).forEach(el=>el.classList.add("financial-value"));

const saldoCard=saldoTotal?.closest(".card");
if(saldoCard&&!document.getElementById("saldoInfoDetalhes")){
 const original=saldoCard.querySelector("span"),title=document.createElement("div");title.className="balance-card-title";original?.replaceWith(title);if(original)title.appendChild(original);
 const infoBtn=document.createElement("button");infoBtn.type="button";infoBtn.className="info-button";infoBtn.textContent="i";infoBtn.setAttribute("aria-label","Detalhar saldo por moeda");title.appendChild(infoBtn);
 const info=document.createElement("div");info.id="saldoInfoDetalhes";info.className="balance-info hidden";saldoCard.appendChild(info);infoBtn.addEventListener("click",()=>info.classList.toggle("hidden"));
}

const toolbar=document.createElement("div");toolbar.className="dashboard-toolbar";nav.parentNode.insertBefore(toolbar,nav);toolbar.appendChild(nav);
const actions=document.createElement("div");actions.className="dashboard-actions";toolbar.appendChild(actions);
actions.innerHTML=`<button type="button" id="dashboardValueToggle" class="dashboard-action-button" aria-label="Ocultar valores" title="Ocultar valores">◉ Valores</button><div class="dashboard-settings-wrap"><button type="button" class="dashboard-action-button dashboard-settings-button" aria-label="Configurar dashboard">⚙ Configurar</button><div class="dashboard-settings-panel hidden"><div class="dashboard-settings-head"><strong>Itens da dashboard</strong><button type="button" class="dashboard-settings-back">← Voltar</button></div><label><input type="checkbox" data-panel="movimentacoes" checked> Últimas movimentações</label><label><input type="checkbox" data-panel="receitas" checked> Detalhamento de receitas</label><label><input type="checkbox" data-panel="despesas" checked> Detalhamento de despesas</label><label><input type="checkbox" data-panel="contas"> Detalhamento de contas</label><label><input type="checkbox" data-panel="transferencias"> Transferências</label><label><input type="checkbox" data-panel="cartoes"> Despesas de cartões</label><label><input type="checkbox" data-panel="orcamentos"> Orçamentos</label></div></div>`;
const valueToggle=document.getElementById("dashboardValueToggle"),settingsWrap=actions.querySelector(".dashboard-settings-wrap"),settingsButton=settingsWrap.querySelector(".dashboard-settings-button"),settingsPanel=settingsWrap.querySelector(".dashboard-settings-panel"),settingsBack=settingsWrap.querySelector(".dashboard-settings-back");
function setValuesHidden(hidden){dashboard.classList.toggle("dashboard-values-hidden",hidden);valueToggle.textContent=hidden?"◎ Mostrar":"◉ Valores";valueToggle.setAttribute("aria-label",hidden?"Mostrar valores":"Ocultar valores");valueToggle.title=hidden?"Mostrar valores":"Ocultar valores";localStorage.setItem("app-financas-hide-values",hidden?"1":"0");}
valueToggle.addEventListener("click",()=>setValuesHidden(!dashboard.classList.contains("dashboard-values-hidden")));setValuesHidden(localStorage.getItem("app-financas-hide-values")==="1");
function openSettings(){if(!settingsPanel.classList.contains("hidden"))return;settingsPanel.classList.remove("hidden");if(!settingsHistoryActive){history.pushState({appOverlay:"dashboard-settings"},"");settingsHistoryActive=true;}}
function closeSettings({fromHistory=false}={}){if(settingsPanel.classList.contains("hidden"))return;settingsPanel.classList.add("hidden");if(fromHistory){settingsHistoryActive=false;return;}if(settingsHistoryActive)history.back();}
settingsButton.addEventListener("click",()=>settingsPanel.classList.contains("hidden")?openSettings():closeSettings());settingsBack.addEventListener("click",()=>closeSettings());window.addEventListener("popstate",()=>{if(!settingsPanel.classList.contains("hidden"))closeSettings({fromHistory:true});});document.addEventListener("click",event=>{if(!settingsPanel.classList.contains("hidden")&&!settingsWrap.contains(event.target))closeSettings();});

const movementsPanel=lista.closest(".panel");movementsPanel.dataset.dashboardPanel="movimentacoes";
function createPanel(id,title){if(document.querySelector(`[data-dashboard-panel="${id}"]`))return;const panel=document.createElement("article");panel.className="panel dashboard-detail-panel";panel.dataset.dashboardPanel=id;panel.innerHTML=`<h3>${title}</h3><div id="dashboard-${id}" class="dashboard-detail-list empty-state">Nenhum registro neste mês.</div>`;dashboard.appendChild(panel);}
createPanel("receitas","Detalhamento de receitas");createPanel("despesas","Detalhamento de despesas");createPanel("contas","Detalhamento de contas");createPanel("transferencias","Transferências");createPanel("cartoes","Despesas de cartões");createPanel("orcamentos","Orçamentos");
const PREF_KEY="app-financas-dashboard-panels";
function applyPrefs(){const prefs={};settingsPanel.querySelectorAll("[data-panel]").forEach(input=>{prefs[input.dataset.panel]=input.checked;document.querySelector(`[data-dashboard-panel="${input.dataset.panel}"]`)?.classList.toggle("hidden-panel",!input.checked);});localStorage.setItem(PREF_KEY,JSON.stringify(prefs));}
function loadPrefs(){let saved={};try{saved=JSON.parse(localStorage.getItem(PREF_KEY)||"{}");}catch{}settingsPanel.querySelectorAll("[data-panel]").forEach(input=>{if(Object.hasOwn(saved,input.dataset.panel))input.checked=Boolean(saved[input.dataset.panel]);});applyPrefs();}
settingsPanel.addEventListener("change",applyPrefs);loadPrefs();

function currentRows(rows){const p=getPeriod("dashboard");return rows.filter(item=>item.data>=p.start&&item.data<=p.end);}
function isDone(r){return r.efetivada===true||Boolean(r.dataEfetivacao);}
function esc(v=""){return String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[c]);}
function renderList(id,rows,type){const el=document.getElementById(`dashboard-${id}`);if(!el)return;el.className=rows.length?"dashboard-detail-list":"dashboard-detail-list empty-state";el.innerHTML=rows.length?rows.slice(0,10).map(r=>`<div class="history-row"><span>${esc(r.descricao||r.categoriaNome||r.nome||r.categoria||"Registro")} · ${esc(r.data||r.mes||"")}</span><strong class="${type} financial-value">${type==="receita"?"+":type==="despesa"?"-":""}${formatMoney(r.valor||r.saldoInicial||0,r.moeda||"BRL")}</strong></div>`).join(""):"Nenhum registro neste mês.";}

async function accountBreakdown(){
 if(!usuario||!contas.length)return{accounts:[],currencies:[]};
 const p=getPeriod("dashboard");
 const accounts=await Promise.all(contas.map(async conta=>{
  const base=`users/${usuario.uid}/contas/${conta.id}`,[moedasSnap,movsSnap]=await Promise.all([getDocs(collection(db,base,"moedas")),getDocs(collection(db,base,"movimentacoes"))]);
  const movs=movsSnap.docs.map(d=>d.data()).filter(m=>m.data&&m.data<=p.end&&m.planejada!==true),moedas=[{codigo:conta.moeda||"BRL",saldoInicial:Number(conta.saldoInicial||0)},...moedasSnap.docs.map(d=>d.data())];
  const saldos=moedas.map(m=>({moeda:m.codigo,saldoInicial:movs.filter(x=>(x.moeda||"BRL")===m.codigo).reduce((s,x)=>s+(x.tipo==="receita"?Number(x.valor||0):-Number(x.valor||0)),Number(m.saldoInicial||0))}));
  const conv=await convertAccountsToBRL(saldos);return{...conta,total:conv.total,saldos};
 }));
 const grouped=new Map();accounts.forEach(account=>account.saldos.forEach(item=>grouped.set(item.moeda,(grouped.get(item.moeda)||0)+Number(item.saldoInicial||0))));
 const currencies=await Promise.all([...grouped].map(async([moeda,valor])=>{const converted=await convertAccountsToBRL([{moeda,saldoInicial:valor}]);return{moeda,valor,convertido:converted.total};}));currencies.sort((a,b)=>a.moeda==="BRL"?-1:b.moeda==="BRL"?1:a.moeda.localeCompare(b.moeda));return{accounts,currencies};
}

async function render(){
 const token=++renderToken,r=currentRows(receitas),d=currentRows(despesas),t=currentRows(transferencias),doneR=r.filter(isDone),doneD=d.filter(isDone),doneT=t.filter(isDone);
 try{
  const breakdown=await accountBreakdown();if(token!==renderToken)return;
  const info=document.getElementById("saldoInfoDetalhes");if(info)info.innerHTML=breakdown.currencies.length?breakdown.currencies.map(item=>`<div class="balance-info-row"><span><strong>${esc(item.moeda)}</strong><small>${item.moeda==="BRL"?"Saldo total em reais":"Saldo agrupado de todas as contas"}</small></span><span><strong class="financial-value">${formatMoney(item.valor,item.moeda)}</strong>${item.moeda!=="BRL"?`<small class="financial-value">≈ ${formatMoney(item.convertido,"BRL")}</small>`:""}</span></div>`).join(""):"Nenhum saldo cadastrado.";
  renderList("receitas",r,"receita");renderList("despesas",d,"despesa");renderList("contas",breakdown.accounts.map(a=>({...a,valor:a.total,moeda:"BRL"})),"");renderList("transferencias",t,"transferencia");renderList("cartoes",d.filter(x=>x.cartaoId||x.formaPagamento==="cartao"),"despesa");
  const month=getPeriod("dashboard").key;renderList("orcamentos",orcamentos.filter(o=>o.mes===month),"");
 }catch(error){console.error("Falha ao renderizar detalhes da dashboard:",error);}
 const movimentos=[...doneR.map(x=>({...x,_tipo:"receita"})),...doneD.map(x=>({...x,_tipo:"despesa"})),...doneT.map(x=>({...x,_tipo:"transferencia"}))].sort((a,b)=>(b.dataEfetivacao||b.data||"").localeCompare(a.dataEfetivacao||a.data||"")).slice(0,10);
 lista.className=movimentos.length?"":"empty-state";lista.innerHTML=movimentos.length?movimentos.map(m=>`<div class="history-row"><span>${esc(m.descricao||m.categoriaNome||"Movimentação")} · ${esc(m.dataEfetivacao||m.data||"")}</span><strong class="${m._tipo} financial-value">${m._tipo==="receita"?"+":m._tipo==="despesa"?"-":""}${formatMoney(m.valor,m.moeda||"BRL")}</strong></div>`).join(""):"Nenhuma movimentação efetivada neste mês.";
}

window.addEventListener("period-change",event=>{if(event.detail.viewId==="dashboard")render();});
onAuthStateChanged(auth,user=>{
 usuario=user;stops.forEach(stop=>stop());stops=[];receitas=[];despesas=[];transferencias=[];contas=[];orcamentos=[];render();if(!user)return;
 const configs=[
  ["receitas",query(collection(db,"users",user.uid,"receitas"),orderBy("data","desc")),v=>receitas=v],
  ["despesas",query(collection(db,"users",user.uid,"despesas"),orderBy("data","desc")),v=>despesas=v],
  ["transferencias",query(collection(db,"users",user.uid,"transferencias"),orderBy("data","desc")),v=>transferencias=v],
  ["contas",collection(db,"users",user.uid,"contas"),v=>contas=v],
  ["orcamentos",collection(db,"users",user.uid,"orcamentos"),v=>orcamentos=v]
 ];
 configs.forEach(([,ref,setter])=>{stops.push(onSnapshot(ref,snap=>{setter(snap.docs.map(d=>({id:d.id,...d.data()})));render();},()=>{setter([]);render();}));});
});
