import { auth, db } from "./firebase.js";
import { formatMoney } from "./money.js";
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

let user=null,receitas=[],despesas=[],stops=[];
const today=()=>new Date().toISOString().slice(0,10);
function parts(data){const d=new Date(`${data}T12:00:00`),m=d.getMonth()+1;return{ano:d.getFullYear(),mes:m,trimestre:Math.ceil(m/3),semestre:m<=6?1:2,dataChave:data};}
function parseMoney(v){v=String(v||"").trim().replace(/\s/g,"");if(!v)return 0;if(v.includes(","))v=v.replace(/\./g,"").replace(",",".");return Number(v)||0;}
function moneyInput(v){return Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});}

const style=document.createElement("style");style.textContent=`
.settlement-control{display:inline-flex;align-items:center;gap:6px;margin-right:4px;font-size:.82rem;color:var(--primary);cursor:pointer}.settlement-control input{width:16px;height:16px;accent-color:var(--primary)}.settlement-done{display:inline-flex;align-items:center;gap:5px;margin-right:4px;font-size:.78rem;color:#2e7d32}.settlement-modal{position:fixed;inset:0;z-index:6500;display:grid;place-items:center;padding:18px}.settlement-backdrop{position:absolute;inset:0;background:rgba(15,23,42,.58)}.settlement-card{position:relative;width:min(480px,100%);background:#fff;border-radius:16px;padding:20px;box-shadow:0 24px 70px rgba(0,0,0,.3)}.settlement-card h3{margin:0 0 6px}.settlement-card p{margin:0 0 14px;color:var(--muted);line-height:1.4}.settlement-card label{display:block;margin:12px 0 5px;font-weight:600}.settlement-card input{width:100%;padding:11px;border:1px solid var(--border);border-radius:9px}.settlement-actions{display:flex;gap:9px;margin-top:18px}.settlement-actions button{flex:1;padding:11px;border-radius:9px}.settlement-confirm{border:0;background:var(--primary);color:white;font-weight:700}.settlement-cancel{border:1px solid var(--border);background:white}.settlement-note{display:block;margin-top:8px;color:var(--muted);font-size:.78rem}
`;document.head.appendChild(style);

function records(kind){return kind==="receita"?receitas:despesas;}
function decorate(){
  [{kind:"receita",selector:".delete-revenue"},{kind:"despesa",selector:".delete-expense"}].forEach(({kind,selector})=>{
    document.querySelectorAll(selector).forEach(del=>{
      const id=del.dataset.id,record=records(kind).find(r=>r.id===id),actions=del.parentElement;
      if(!record||!actions)return;
      actions.querySelector(`[data-settle-id="${id}"]`)?.remove();
      const holder=document.createElement("span");holder.dataset.settleId=id;
      if(record.planejada===true&&!record.efetivada){
        holder.innerHTML=`<label class="settlement-control"><input type="checkbox" data-settle-kind="${kind}" data-settle-record="${id}"> Efetivar</label>`;
      }else if(record.serieId||record.dataEfetivacao){
        holder.innerHTML=`<span class="settlement-done">✓ Efetivada</span>`;
      }else return;
      actions.insertBefore(holder,actions.firstChild);
    });
  });
}

let observerTimer=null;const observer=new MutationObserver(()=>{clearTimeout(observerTimer);observerTimer=setTimeout(decorate,30);});observer.observe(document.body,{childList:true,subtree:true});

function modal(kind,record){return new Promise(resolve=>{
  document.getElementById("settlementModal")?.remove();const isRevenue=kind==="receita",m=document.createElement("div");m.id="settlementModal";m.className="settlement-modal";m.innerHTML=`<div class="settlement-backdrop"></div><section class="settlement-card"><h3>${isRevenue?"Efetivar receita":"Efetivar despesa"}</h3><p>${record.descricao||"Operação prevista"} · previsto ${formatMoney(record.valor||0,record.moeda||"BRL")}</p><label for="settlementDate">${isRevenue?"Data do recebimento":"Data do pagamento"}</label><input id="settlementDate" type="date" value="${today()}"><label for="settlementValue">${isRevenue?"Valor recebido":"Valor pago"}</label><input id="settlementValue" type="text" inputmode="decimal" value="${moneyInput(record.valor)}"><small class="settlement-note">O valor pode ser diferente do previsto. O saldo da conta só será alterado após confirmar.</small><div class="settlement-actions"><button type="button" class="settlement-cancel">Cancelar</button><button type="button" class="settlement-confirm">Confirmar</button></div></section>`;document.body.appendChild(m);const finish=v=>{m.remove();resolve(v);};m.querySelector(".settlement-cancel").onclick=()=>finish(null);m.querySelector(".settlement-backdrop").onclick=()=>finish(null);m.querySelector(".settlement-confirm").onclick=()=>{const data=m.querySelector("#settlementDate").value,valor=parseMoney(m.querySelector("#settlementValue").value);if(!data||valor<=0){alert("Informe a data e um valor maior que zero.");return;}finish({data,valor});};});}

async function settle(kind,record,data,valor){
  const common={tipo:kind,categoriaId:record.categoriaId||"",categoriaNome:record.categoriaNome||"",subcategoria:record.subcategoria||"",descricao:record.descricao||"",valor,moeda:record.moeda||"BRL",data,...parts(data),origem:kind==="receita"?"receitas":"despesas",serieId:record.serieId||null,recorrenciaTipo:record.recorrenciaTipo||"unica",competencia:record.competencia||String(record.data||data).slice(0,7),parcelaNumero:record.parcelaNumero||null,parcelasTotal:record.parcelasTotal||null,atualizadoEm:serverTimestamp()};
  const mov=await addDoc(collection(db,"users",user.uid,"contas",record.contaId,"movimentacoes"),{...common,criadoEm:serverTimestamp()});
  await updateDoc(doc(db,"users",user.uid,kind==="receita"?"receitas":"despesas",record.id),{planejada:false,efetivada:true,dataEfetivacao:data,valorPrevisto:Number(record.valor||0),valorEfetivado:valor,valor, movimentacaoId:mov.id,atualizadoEm:serverTimestamp()});
}

document.addEventListener("change",async e=>{
  const input=e.target.closest("[data-settle-record]");if(!input||!user)return;const kind=input.dataset.settleKind,record=records(kind).find(r=>r.id===input.dataset.settleRecord);if(!record){input.checked=false;return;}const result=await modal(kind,record);if(!result){input.checked=false;return;}if(!confirm(`Confirma ${kind==="receita"?"o recebimento":"o pagamento"} de ${formatMoney(result.valor,record.moeda||"BRL")} em ${new Date(`${result.data}T12:00:00`).toLocaleDateString("pt-BR")}?`)){input.checked=false;return;}try{await settle(kind,record,result.data,result.valor);}catch(error){console.error(error);alert("Não foi possível efetivar a operação.");input.checked=false;}
});

onAuthStateChanged(auth,current=>{user=current;stops.forEach(s=>s());stops=[];receitas=[];despesas=[];decorate();if(!current)return;[["receitas",v=>receitas=v],["despesas",v=>despesas=v]].forEach(([name,set])=>{stops.push(onSnapshot(query(collection(db,"users",current.uid,name),orderBy("data","desc")),snap=>{set(snap.docs.map(d=>({id:d.id,...d.data()})));decorate();}));});});
