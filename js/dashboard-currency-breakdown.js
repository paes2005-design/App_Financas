import { auth, db } from "./firebase.js";
import { formatMoney } from "./money.js";
import { getPeriod } from "./period.js";
import { convertAccountsToBRL } from "./exchange.js";
import { collection, onSnapshot, orderBy, query } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const dashboard=document.getElementById("dashboard");
const targets=[
  {id:"receitasMes",infoId:"receitasInfoDetalhes",label:"Detalhar receitas por moeda"},
  {id:"despesasMes",infoId:"despesasInfoDetalhes",label:"Detalhar despesas por moeda"},
  {id:"resultadoMes",infoId:"resultadoInfoDetalhes",label:"Detalhar resultado por moeda"}
];

let receitas=[],despesas=[],stops=[],renderToken=0;

function esc(v=""){return String(v).replace(/[&<>'\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'\"':"&quot;"})[c]);}

function attachInfo(target){
  const value=document.getElementById(target.id);
  const card=value?.closest(".card");
  if(!card||document.getElementById(target.infoId))return;
  let title=card.querySelector(".balance-card-title");
  if(!title){
    const original=card.querySelector("span");
    title=document.createElement("div");
    title.className="balance-card-title";
    original?.replaceWith(title);
    if(original)title.appendChild(original);
  }
  const btn=document.createElement("button");
  btn.type="button";btn.className="info-button";btn.textContent="i";btn.setAttribute("aria-label",target.label);
  title.appendChild(btn);
  const info=document.createElement("div");
  info.id=target.infoId;info.className="balance-info hidden";card.appendChild(info);
  btn.addEventListener("click",()=>info.classList.toggle("hidden"));
  btn.addEventListener("mouseenter",()=>info.classList.remove("hidden"));
  btn.addEventListener("mouseleave",()=>{if(!info.matches(":hover"))info.classList.add("hidden");});
}

targets.forEach(attachInfo);

function current(rows){const p=getPeriod("dashboard");return rows.filter(r=>r.data>=p.start&&r.data<=p.end);}
function group(rows){const m=new Map();rows.forEach(r=>{const moeda=r.moeda||"BRL";m.set(moeda,(m.get(moeda)||0)+Number(r.valor||0));});return m;}
async function breakdown(map){
  const entries=await Promise.all([...map].map(async([moeda,valor])=>{
    const conv=await convertAccountsToBRL([{moeda,saldoInicial:valor}]);
    return{moeda,valor,convertido:conv.total};
  }));
  entries.sort((a,b)=>a.moeda==="BRL"?-1:b.moeda==="BRL"?1:a.moeda.localeCompare(b.moeda));
  return entries;
}
function html(entries,empty){
  if(!entries.length)return empty;
  return entries.map(item=>`<div class="balance-info-row"><span><strong>${esc(item.moeda)}</strong><small>${item.moeda==="BRL"?"Valor em reais":"Valor na moeda original"}</small></span><span><strong class="financial-value">${formatMoney(item.valor,item.moeda)}</strong>${item.moeda!=="BRL"?`<small class="financial-value">≈ ${formatMoney(item.convertido,"BRL")}</small>`:""}</span></div>`).join("");
}
async function render(){
  const token=++renderToken;
  const r=current(receitas),d=current(despesas),rg=group(r),dg=group(d),result=new Map();
  const moedas=new Set([...rg.keys(),...dg.keys()]);
  moedas.forEach(m=>result.set(m,(rg.get(m)||0)-(dg.get(m)||0)));
  try{
    const [rb,db,resb]=await Promise.all([breakdown(rg),breakdown(dg),breakdown(result)]);
    if(token!==renderToken)return;
    const ri=document.getElementById("receitasInfoDetalhes"),di=document.getElementById("despesasInfoDetalhes"),resi=document.getElementById("resultadoInfoDetalhes");
    if(ri)ri.innerHTML=html(rb,"Nenhuma receita neste mês.");
    if(di)di.innerHTML=html(db,"Nenhuma despesa neste mês.");
    if(resi)resi.innerHTML=html(resb,"Sem resultado neste mês.");
  }catch(error){console.error("Falha ao detalhar valores por moeda:",error);}
}

window.addEventListener("period-change",e=>{if(e.detail.viewId==="dashboard")render();});
onAuthStateChanged(auth,user=>{
  stops.forEach(s=>s());stops=[];receitas=[];despesas=[];render();if(!user)return;
  [["receitas",v=>receitas=v],["despesas",v=>despesas=v]].forEach(([name,set])=>{
    stops.push(onSnapshot(query(collection(db,"users",user.uid,name),orderBy("data","desc")),snap=>{set(snap.docs.map(d=>({id:d.id,...d.data()})));render();},()=>{set([]);render();}));
  });
});
