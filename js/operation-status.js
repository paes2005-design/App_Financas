import { auth, db } from "./firebase.js";
import { collection, onSnapshot, orderBy, query } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

let user=null,stops=[];
const data={receita:new Map(),despesa:new Map(),transferencia:new Map()};

const style=document.createElement("style");
style.textContent=`
.transaction-value,.expense-value,.transfer-value{padding-right:148px!important}
.operation-status{position:absolute;right:42px;top:50%;transform:translateY(-50%);display:inline-flex;align-items:center;gap:7px;min-width:92px;justify-content:center;padding:6px 10px;border-radius:999px;font-size:.76rem;font-weight:800;letter-spacing:.01em;white-space:nowrap;box-shadow:0 3px 10px rgba(15,23,42,.07);border:1px solid transparent;user-select:none}
.operation-status::before{content:"";width:8px;height:8px;border-radius:50%;box-shadow:0 0 0 3px rgba(255,255,255,.72)}
.operation-status.pending{color:#155e75;background:linear-gradient(135deg,#e0f2fe,#dbeafe);border-color:#bae6fd}.operation-status.pending::before{background:#0284c7}
.operation-status.effective{color:#166534;background:linear-gradient(135deg,#dcfce7,#d1fae5);border-color:#bbf7d0}.operation-status.effective::before{background:#16a34a}
.txn-menu .unsettle-action{color:#166534!important;font-weight:750!important}.txn-menu .unsettle-action:hover{background:#ecfdf5!important}
@media(max-width:620px){.transaction-value,.expense-value,.transfer-value{padding-right:42px!important}.operation-status{position:static;transform:none;margin:7px 38px 0 0;min-width:86px;padding:5px 9px;font-size:.72rem;float:right}}
`;
document.head.appendChild(style);

function isDone(r){return r?.efetivada===true||Boolean(r?.dataEfetivacao);}
function rowInfo(row){
 if(row.classList.contains("transaction-item"))return{kind:"receita",actions:row.querySelector(".transaction-actions"),selector:".edit-revenue,.delete-revenue,.settle-revenue"};
 if(row.classList.contains("expense-item"))return{kind:"despesa",actions:row.querySelector(".expense-actions"),selector:".edit-expense,.delete-expense,.settle-expense"};
 if(row.classList.contains("transfer-item"))return{kind:"transferencia",actions:row.querySelector(".transfer-actions"),selector:".edit-transfer,.delete-transfer,.settle-transfer"};
 return null;
}
function decorateRow(row){
 const info=rowInfo(row);if(!info?.actions)return;
 const source=info.actions.querySelector(info.selector),id=source?.dataset.id;if(!id)return;
 const record=data[info.kind].get(id);if(!record)return;
 const done=isDone(record);
 let badge=info.actions.querySelector(":scope > .operation-status");
 if(!badge){badge=document.createElement("span");badge.className="operation-status";badge.setAttribute("aria-label","Status da operação");const more=info.actions.querySelector(":scope > .txn-more");more?info.actions.insertBefore(badge,more):info.actions.appendChild(badge);}
 badge.classList.toggle("effective",done);badge.classList.toggle("pending",!done);badge.textContent=done?"Efetivado":"Pendente";badge.title=done?"Esta operação já foi efetivada":"Esta operação ainda está pendente";
 const settle=info.actions.querySelector(".settle-revenue,.settle-expense,.settle-transfer");
 if(settle){settle.textContent=done?"Desefetivar":"Efetivar";settle.dataset.status=done?"effective":"pending";settle.classList.toggle("unsettle-action",done);settle.setAttribute("aria-label",done?"Desefetivar operação":"Efetivar operação");}
}
function decorate(){document.querySelectorAll(".transaction-item,.expense-item,.transfer-item").forEach(decorateRow);}
const observer=new MutationObserver(m=>{if(m.some(x=>x.addedNodes.length||x.removedNodes.length))queueMicrotask(decorate);});
observer.observe(document.body,{childList:true,subtree:true});
window.addEventListener("period-change",()=>setTimeout(decorate,80));

onAuthStateChanged(auth,current=>{
 user=current;stops.forEach(s=>s());stops=[];Object.values(data).forEach(m=>m.clear());decorate();if(!current)return;
 for(const [name,kind] of [["receitas","receita"],["despesas","despesa"],["transferencias","transferencia"]]){
  stops.push(onSnapshot(query(collection(db,"users",current.uid,name),orderBy("data","desc")),snap=>{data[kind]=new Map(snap.docs.map(d=>[d.id,{id:d.id,...d.data()}]));decorate();}));
 }
});
