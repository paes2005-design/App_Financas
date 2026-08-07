import { auth } from "./firebase.js";

let user=null;

const style=document.createElement("style");
style.textContent=`
.quick-settle{display:flex;align-items:center;gap:8px;margin:12px 0 4px;font-size:.9rem}.quick-settle input{width:17px;height:17px;accent-color:var(--primary)}
.transaction-value,.expense-value,.transfer-value{position:relative;padding-right:38px;min-width:150px}
.transaction-actions,.expense-actions,.transfer-actions{position:static!important;display:block!important;margin-top:5px!important}
.txn-more{position:absolute!important;right:0!important;top:50%!important;transform:translateY(-50%);width:32px!important;height:38px!important;padding:0!important;border:0!important;background:transparent!important;color:var(--muted)!important;font-size:1.7rem!important;font-weight:700!important;line-height:1!important;display:flex!important;align-items:center;justify-content:center;cursor:pointer;z-index:30}
.txn-more:hover,.txn-more:focus{background:#eef3fa!important;border-radius:8px!important;color:var(--text)!important;outline:none}
.txn-menu{position:absolute!important;right:0!important;top:calc(50% + 22px)!important;z-index:9000!important;min-width:170px;background:#fff;border:1px solid var(--border);border-radius:11px;box-shadow:0 14px 34px rgba(0,0,0,.2);padding:6px;display:none;text-align:left}
.txn-menu.open{display:grid!important;gap:2px}.txn-menu button{display:block!important;width:100%!important;padding:10px 12px!important;text-align:left!important;border:0!important;background:transparent!important;border-radius:8px!important;color:var(--text)!important;font-size:.9rem!important}.txn-menu button:hover{background:#eef3fa!important}.txn-menu .danger{color:var(--danger)!important}.txn-status{display:block;margin-top:4px;font-size:.76rem}.txn-status.done{color:#2e7d32}.txn-status.pending{color:#b7791f}
@media(max-width:520px){.transaction-value,.expense-value,.transfer-value{padding-right:40px;min-width:135px}.txn-menu{position:fixed!important;right:14px!important;top:auto!important;bottom:18px!important;left:14px!important;min-width:0;border-radius:14px;padding:8px}.txn-menu button{padding:13px 14px!important;font-size:1rem!important}}
`;
document.head.appendChild(style);

const forms=[
 {id:"receitaForm",kind:"receita",save:"salvarReceita"},
 {id:"despesaForm",kind:"despesa",save:"salvarDespesa"},
 {id:"transferForm",kind:"transferencia",save:"transferSalvar"}
];

function ensureQuickSettle(){
 forms.forEach(c=>{
  const form=document.getElementById(c.id),save=document.getElementById(c.save);
  if(!form||!save||form.querySelector(`[data-quick-settle="${c.kind}"]`))return;
  const label=document.createElement("label");
  label.className="quick-settle";
  label.innerHTML=`<input type="checkbox" data-quick-settle="${c.kind}"> Efetivar ao salvar`;
  save.insertAdjacentElement("beforebegin",label);
 });
}

function closeMenus(except=null){
 document.querySelectorAll(".txn-menu.open").forEach(menu=>{
  if(menu!==except){menu.classList.remove("open");menu.previousElementSibling?.setAttribute("aria-expanded","false");}
 });
}

// As três listas são criadas antes deste módulo. Não usamos MutationObserver aqui:
// menus são renderizados diretamente por receitas/despesas/transferências.
ensureQuickSettle();
setTimeout(ensureQuickSettle,100);

document.addEventListener("click",event=>{
 const more=event.target.closest(".txn-more");
 if(more){
  event.preventDefault();event.stopPropagation();
  const menu=more.nextElementSibling;
  if(!menu?.classList.contains("txn-menu"))return;
  const opening=!menu.classList.contains("open");
  closeMenus(menu);
  menu.classList.toggle("open",opening);
  more.setAttribute("aria-expanded",String(opening));
  return;
 }
 if(!event.target.closest(".txn-menu"))closeMenus();
});

document.addEventListener("keydown",event=>{if(event.key==="Escape")closeMenus();});
window.addEventListener("period-change",()=>closeMenus());
onAuthStateChanged(auth,current=>{user=current;closeMenus();ensureQuickSettle();});
