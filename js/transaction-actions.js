import { auth } from "./firebase.js";
import { getMoneyValue } from "./money.js";

let user=null;
const style=document.createElement("style");
style.textContent=`
.quick-settle{display:flex;align-items:center;gap:8px;margin:12px 0 4px;font-size:.9rem}.quick-settle input{width:17px;height:17px;accent-color:var(--primary)}
.transaction-value,.expense-value,.transfer-value{position:relative;padding-right:34px;min-width:150px}
.transaction-actions,.expense-actions,.transfer-actions{position:static!important;display:block!important;margin-top:6px!important}
.txn-more{position:absolute!important;right:0!important;top:50%!important;transform:translateY(-50%);width:30px!important;height:36px!important;padding:0!important;border:0!important;background:transparent!important;color:var(--muted)!important;font-size:1.65rem!important;font-weight:700!important;line-height:1!important;letter-spacing:1px;display:flex!important;align-items:center;justify-content:center;cursor:pointer;z-index:30}
.txn-more:hover,.txn-more:focus{background:#eef3fa!important;border-radius:8px!important;color:var(--text)!important;outline:none}
.txn-menu{position:absolute!important;right:0!important;top:calc(50% + 22px)!important;z-index:9000!important;min-width:170px;background:#fff;border:1px solid var(--border);border-radius:11px;box-shadow:0 14px 34px rgba(0,0,0,.2);padding:6px;display:none;text-align:left}
.txn-menu.open{display:grid!important;gap:2px}.txn-menu button{display:block!important;width:100%!important;padding:10px 12px!important;text-align:left!important;border:0!important;background:transparent!important;border-radius:8px!important;color:var(--text)!important;font-size:.9rem!important}.txn-menu button:hover{background:#eef3fa!important}.txn-menu .danger{color:var(--danger)!important}.txn-original-action{display:none!important}
@media(max-width:520px){.transaction-value,.expense-value,.transfer-value{padding-right:38px;min-width:135px}.txn-menu{position:fixed!important;right:14px!important;top:auto!important;bottom:18px!important;left:14px!important;min-width:0;border-radius:14px;padding:8px}.txn-menu button{padding:13px 14px!important;font-size:1rem!important}}
`;
document.head.appendChild(style);

const forms=[
 {id:"receitaForm",kind:"receita",save:"salvarReceita"},
 {id:"despesaForm",kind:"despesa",save:"salvarDespesa"},
 {id:"transferForm",kind:"transferencia",save:"transferSalvar"}
];
function ensureQuickSettle(){forms.forEach(c=>{const form=document.getElementById(c.id),save=document.getElementById(c.save);if(!form||!save||form.querySelector(`[data-quick-settle="${c.kind}"]`))return;const label=document.createElement("label");label.className="quick-settle";label.innerHTML=`<input type="checkbox" data-quick-settle="${c.kind}"> Efetivar ao salvar`;save.insertAdjacentElement("beforebegin",label);});}
setTimeout(ensureQuickSettle,0);

function closeMenus(except=null){document.querySelectorAll(".txn-menu.open").forEach(m=>{if(m!==except)m.classList.remove("open");});}
function actionButton(label,source,extra=""){if(!source)return null;const b=document.createElement("button");b.type="button";b.textContent=label;if(extra)b.className=extra;b.addEventListener("click",e=>{e.stopPropagation();closeMenus();source.click();});return b;}
function buildMenu(actions){
 if(actions.querySelector(":scope > .txn-more"))return;
 const edit=actions.querySelector(".edit-revenue,.edit-expense,.edit-transfer");
 const del=actions.querySelector(".delete-revenue,.delete-expense,.delete-transfer");
 const settle=actions.querySelector("[data-settle-record]");
 const settleHolder=actions.querySelector("[data-settle-id]");
 if(!edit&&!del&&!settle)return;
 [edit,del,settleHolder].filter(Boolean).forEach(el=>el.classList.add("txn-original-action"));
 if(settle&&!settleHolder)settle.classList.add("txn-original-action");
 const more=document.createElement("button");more.type="button";more.className="txn-more";more.setAttribute("aria-label","Opções da operação");more.setAttribute("aria-expanded","false");more.textContent="⋮";
 const menu=document.createElement("div");menu.className="txn-menu";menu.setAttribute("role","menu");
 const eb=actionButton("Editar",edit);if(eb)menu.appendChild(eb);
 if(settle){const b=document.createElement("button");b.type="button";b.textContent="Efetivar";b.addEventListener("click",e=>{e.stopPropagation();closeMenus();settle.checked=true;settle.dispatchEvent(new Event("change",{bubbles:true}));});menu.appendChild(b);}
 const db=actionButton("Excluir",del,"danger");if(db)menu.appendChild(db);
 more.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();const opening=!menu.classList.contains("open");closeMenus(menu);menu.classList.toggle("open",opening);more.setAttribute("aria-expanded",String(opening));});
 actions.append(more,menu);
}
function decorate(){ensureQuickSettle();document.querySelectorAll(".transaction-actions,.expense-actions,.transfer-actions").forEach(buildMenu);}
let timer=null;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(decorate,20);}).observe(document.body,{childList:true,subtree:true});
document.addEventListener("click",e=>{if(!e.target.closest(".txn-menu,.txn-more"))closeMenus();});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeMenus();});
window.addEventListener("categories-updated",decorate);
onAuthStateChanged(auth,current=>{user=current;setTimeout(decorate,50);});
