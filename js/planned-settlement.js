import { auth, db } from "./firebase.js";
import { formatMoney } from "./money.js";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

let user=null,receitas=[],despesas=[],transferencias=[],stops=[];
const today=()=>new Date().toISOString().slice(0,10);
function parts(data){const d=new Date(`${data}T12:00:00`),m=d.getMonth()+1;return{ano:d.getFullYear(),mes:m,trimestre:Math.ceil(m/3),semestre:m<=6?1:2,dataChave:data};}
function parseMoney(v){v=String(v||"").trim().replace(/\s/g,"");if(!v)return 0;if(v.includes(","))v=v.replace(/\./g,"").replace(",",".");return Number(v)||0;}
function moneyInput(v){return Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});}
function records(kind){return kind==="receita"?receitas:kind==="despesa"?despesas:transferencias;}
function isDone(r){return r?.efetivada===true||Boolean(r?.dataEfetivacao);}

const style=document.createElement("style");
style.textContent=`.settlement-modal{position:fixed;inset:0;z-index:9500;display:grid;place-items:center;padding:18px}.settlement-backdrop{position:absolute;inset:0;background:rgba(15,23,42,.58)}.settlement-card{position:relative;width:min(480px,100%);background:#fff;border-radius:16px;padding:20px;box-shadow:0 24px 70px rgba(0,0,0,.3)}.settlement-card h3{margin:0 0 6px}.settlement-card p{margin:0 0 14px;color:var(--muted);line-height:1.4}.settlement-card label{display:block;margin:12px 0 5px;font-weight:600}.settlement-card input{width:100%;padding:11px;border:1px solid var(--border);border-radius:9px}.settlement-actions{display:flex;gap:9px;margin-top:18px}.settlement-actions button{flex:1;padding:11px;border-radius:9px}.settlement-confirm{border:0;background:var(--primary);color:white;font-weight:700}.settlement-cancel{border:1px solid var(--border);background:white}.settlement-note{display:block;margin-top:8px;color:var(--muted);font-size:.78rem}`;
document.head.appendChild(style);

function labels(kind){
 if(kind==="receita")return{title:"Efetivar receita",date:"Data do recebimento",value:"Valor recebido",verb:"o recebimento",undo:"o recebimento"};
 if(kind==="despesa")return{title:"Efetivar despesa",date:"Data do pagamento",value:"Valor pago",verb:"o pagamento",undo:"o pagamento"};
 return{title:"Efetivar transferência",date:"Data da transferência",value:"Valor transferido",verb:"a transferência",undo:"a transferência"};
}

function modal(kind,record){
 return new Promise(resolve=>{
  document.getElementById("settlementModal")?.remove();
  const l=labels(kind),m=document.createElement("div");
  m.id="settlementModal";m.className="settlement-modal";
  m.innerHTML=`<div class="settlement-backdrop"></div><section class="settlement-card"><h3>${l.title}</h3><p>${record.descricao||"Operação prevista"} · previsto ${formatMoney(record.valor||0,record.moeda||"BRL")}</p><label for="settlementDate">${l.date}</label><input id="settlementDate" type="date" value="${today()}"><label for="settlementValue">${l.value}</label><input id="settlementValue" type="text" inputmode="decimal" value="${moneyInput(record.valor)}"><small class="settlement-note">O valor efetivado pode ser diferente do previsto. Somente após confirmar ele entra no realizado.</small><div class="settlement-actions"><button type="button" class="settlement-cancel">Cancelar</button><button type="button" class="settlement-confirm">Confirmar</button></div></section>`;
  document.body.appendChild(m);
  const finish=v=>{m.remove();resolve(v);};
  m.querySelector(".settlement-cancel").onclick=()=>finish(null);
  m.querySelector(".settlement-backdrop").onclick=()=>finish(null);
  m.querySelector(".settlement-confirm").onclick=()=>{
   const data=m.querySelector("#settlementDate").value,valor=parseMoney(m.querySelector("#settlementValue").value);
   if(!data||valor<=0){alert("Informe a data e um valor maior que zero.");return;}
   finish({data,valor});
  };
 });
}

async function settle(kind,record,data,valor){
 if(isDone(record))return;
 const common={categoriaId:record.categoriaId||"",categoriaNome:record.categoriaNome||"",subcategoria:record.subcategoria||"",descricao:record.descricao||"",valor,moeda:record.moeda||"BRL",data,...parts(data),serieId:record.serieId||null,recorrenciaTipo:record.recorrenciaTipo||"unica",competencia:record.competencia||String(record.data||data).slice(0,7),parcelaNumero:record.parcelaNumero||null,parcelasTotal:record.parcelasTotal||null,planejada:false,efetivada:true,dataEfetivacao:data,atualizadoEm:serverTimestamp()};
 if(kind==="receita"||kind==="despesa"){
  if(record.semMovimentoConta||record.formaPagamento==="cartao"||record.cartaoId){
   await updateDoc(doc(db,"users",user.uid,kind==="receita"?"receitas":"despesas",record.id),{planejada:false,efetivada:true,dataEfetivacao:data,valorPrevisto:Number(record.valor||0),valorEfetivado:valor,valor,atualizadoEm:serverTimestamp()});
   return;
  }
  const mov=await addDoc(collection(db,"users",user.uid,"contas",record.contaId,"movimentacoes"),{...common,tipo:kind,origem:kind==="receita"?"receitas":"despesas",criadoEm:serverTimestamp()});
  await updateDoc(doc(db,"users",user.uid,kind==="receita"?"receitas":"despesas",record.id),{planejada:false,efetivada:true,dataEfetivacao:data,valorPrevisto:Number(record.valor||0),valorEfetivado:valor,valor,movimentacaoId:mov.id,atualizadoEm:serverTimestamp()});
  return;
 }
 const out=await addDoc(collection(db,"users",user.uid,"contas",record.origemId,"movimentacoes"),{...common,tipo:"despesa",origem:"transferencias",descricao:`Transferência: ${record.descricao||""}`,criadoEm:serverTimestamp()});
 const inn=await addDoc(collection(db,"users",user.uid,"contas",record.destinoId,"movimentacoes"),{...common,tipo:"receita",origem:"transferencias",descricao:`Transferência: ${record.descricao||""}`,criadoEm:serverTimestamp()});
 await updateDoc(doc(db,"users",user.uid,"transferencias",record.id),{planejada:false,efetivada:true,dataEfetivacao:data,valorPrevisto:Number(record.valor||0),valorEfetivado:valor,valor,movSaida:out.id,movEntrada:inn.id,atualizadoEm:serverTimestamp()});
}

async function unsettle(kind,record){
 if(!isDone(record))return;
 const original=Number(record.valorPrevisto??record.valor??0);
 if(kind==="receita"||kind==="despesa"){
  if(record.movimentacaoId&&record.contaId&&!record.semMovimentoConta&&!record.formaPagamento&&!record.cartaoId){
   await deleteDoc(doc(db,"users",user.uid,"contas",record.contaId,"movimentacoes",record.movimentacaoId));
  }
  await updateDoc(doc(db,"users",user.uid,kind==="receita"?"receitas":"despesas",record.id),{planejada:true,efetivada:false,dataEfetivacao:null,valorEfetivado:null,valor:original,movimentacaoId:null,atualizadoEm:serverTimestamp()});
  return;
 }
 if(record.movSaida&&record.origemId)await deleteDoc(doc(db,"users",user.uid,"contas",record.origemId,"movimentacoes",record.movSaida));
 if(record.movEntrada&&record.destinoId)await deleteDoc(doc(db,"users",user.uid,"contas",record.destinoId,"movimentacoes",record.movEntrada));
 await updateDoc(doc(db,"users",user.uid,"transferencias",record.id),{planejada:true,efetivada:false,dataEfetivacao:null,valorEfetivado:null,valor:original,movSaida:null,movEntrada:null,atualizadoEm:serverTimestamp()});
}

document.addEventListener("click",async event=>{
 const btn=event.target.closest(".settle-revenue,.settle-expense,.settle-transfer");
 if(!btn||!user)return;
 event.preventDefault();event.stopPropagation();
 const kind=btn.classList.contains("settle-revenue")?"receita":btn.classList.contains("settle-expense")?"despesa":"transferencia";
 const record=records(kind).find(r=>r.id===btn.dataset.id);
 if(!record)return;
 const l=labels(kind);
 if(isDone(record)){
  if(!confirm(`Deseja desefetivar ${l.undo}? O valor realizado será removido e a operação voltará para Pendente.`))return;
  try{await unsettle(kind,record);}catch(error){console.error(error);alert("Não foi possível desefetivar a operação.");}
  return;
 }
 const result=await modal(kind,record);if(!result)return;
 if(!confirm(`Confirma ${l.verb} de ${formatMoney(result.valor,record.moeda||"BRL")} em ${new Date(`${result.data}T12:00:00`).toLocaleDateString("pt-BR")}?`))return;
 try{await settle(kind,record,result.data,result.valor);}catch(error){console.error(error);alert("Não foi possível efetivar a operação.");}
});

onAuthStateChanged(auth,current=>{
 user=current;stops.forEach(stop=>stop());stops=[];receitas=[];despesas=[];transferencias=[];
 if(!current)return;
 [["receitas",v=>receitas=v],["despesas",v=>despesas=v],["transferencias",v=>transferencias=v]].forEach(([name,set])=>{
  stops.push(onSnapshot(query(collection(db,"users",current.uid,name),orderBy("data","desc")),snap=>set(snap.docs.map(d=>({id:d.id,...d.data()})))));
 });
});
