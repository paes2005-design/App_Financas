import { auth, db } from "./firebase.js";
import { getMoneyValue } from "./money.js";
import { getCategoriesFor } from "./categorias.js";
import { addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

let user=null;
const style=document.createElement("style");
style.textContent=`
.quick-settle{display:flex;align-items:center;gap:8px;margin:12px 0 4px;font-size:.9rem}.quick-settle input{width:17px;height:17px;accent-color:var(--primary)}
.transaction-actions,.expense-actions,.transfer-actions{position:relative}.txn-more{border:0!important;background:transparent!important;font-size:1.3rem!important;line-height:1;padding:2px 7px!important;color:var(--muted)!important}.txn-menu{position:absolute;right:0;top:100%;z-index:4600;min-width:150px;background:#fff;border:1px solid var(--border);border-radius:10px;box-shadow:0 12px 30px rgba(0,0,0,.17);padding:5px;display:none;text-align:left}.txn-menu.open{display:grid}.txn-menu button{display:block!important;width:100%;padding:9px 10px!important;text-align:left!important;border:0!important;background:transparent!important;border-radius:7px!important;color:var(--text)!important}.txn-menu button:hover{background:#eef3fa!important}.txn-menu .danger{color:var(--danger)!important}.txn-original-action{display:none!important}
`;
document.head.appendChild(style);

const forms=[
 {id:"receitaForm",kind:"receita",prefix:"receita",save:"salvarReceita"},
 {id:"despesaForm",kind:"despesa",prefix:"despesa",save:"salvarDespesa"},
 {id:"transferForm",kind:"transferencia",prefix:"transfer",save:"transferSalvar"}
];
function ensureQuickSettle(){
 forms.forEach(c=>{const form=document.getElementById(c.id),save=document.getElementById(c.save);if(!form||!save||form.querySelector(`[data-quick-settle="${c.kind}"]`))return;const label=document.createElement("label");label.className="quick-settle";label.innerHTML=`<input type="checkbox" data-quick-settle="${c.kind}"> Efetivar ao salvar`;save.insertAdjacentElement("beforebegin",label);});
}
setTimeout(ensureQuickSettle,0);

function parts(data){const d=new Date(`${data}T12:00:00`),m=d.getMonth()+1;return{ano:d.getFullYear(),mes:m,trimestre:Math.ceil(m/3),semestre:m<=6?1:2,dataChave:data};}
function text(id){return document.getElementById(id)?.value||"";}
function selected(id){return document.getElementById(id)?.selectedOptions?.[0]?.textContent?.trim()||"";}
function message(kind,msg,type="success"){const id=kind==="receita"?"receitaMensagem":kind==="despesa"?"despesaMensagem":"transferMensagem",el=document.getElementById(id);if(el){el.textContent=msg;el.className=`message ${type}`;}}

async function savePlannedUnique(kind){
 const prefix=kind==="receita"?"receita":kind==="despesa"?"despesa":"transfer";
 const data=text(`${prefix}Data`),valor=getMoneyValue(document.getElementById(`${prefix}Valor`)),moeda=text(`${prefix}Moeda`),descricao=text(`${prefix}Descricao`).trim();
 const categoriaId=text(`${prefix}Categoria`),categoriaNome=selected(`${prefix}Categoria`),subcategoria=text(`${prefix}Subcategoria`);
 if(!data||!valor||valor<=0||!moeda||!descricao||!categoriaId)throw new Error("Preencha todos os campos obrigatórios.");
 const common={categoriaId,categoriaNome,subcategoria,descricao,valor,moeda,data,...parts(data),recorrenciaTipo:"unica",competencia:data.slice(0,7),planejada:true,efetivada:false,criadoEm:serverTimestamp(),atualizadoEm:serverTimestamp()};
 if(kind==="receita"||kind==="despesa"){
  const contaId=text(`${prefix}Conta`),contaNome=selected(`${prefix}Conta`);if(!contaId)throw new Error("Selecione uma conta.");
  await addDoc(collection(db,"users",user.uid,kind==="receita"?"receitas":"despesas"),{...common,contaId,contaNome});
 }else{
  const origemId=text("transferOrigem"),destinoId=text("transferDestino");if(!origemId||!destinoId||origemId===destinoId)throw new Error("Selecione contas diferentes.");
  await addDoc(collection(db,"users",user.uid,"transferencias"),{...common,origemId,origemNome:selected("transferOrigem"),destinoId,destinoNome:selected("transferDestino")});
 }
 document.getElementById(kind==="transferencia"?"transferForm":`${prefix}Form`)?.reset();
 message(kind,"Operação salva como prevista. Use ⋮ → Efetivar quando ela acontecer.");
}

document.addEventListener("submit",async e=>{
 const cfg=forms.find(c=>e.target.id===c.id);if(!cfg||!user)return;
 const type=document.getElementById(`${cfg.prefix}Recorrencia`)?.value||"unica";
 const quick=e.target.querySelector(`[data-quick-settle="${cfg.kind}"]`)?.checked===true;
 if(type!=="unica"||quick)return;
 e.preventDefault();e.stopImmediatePropagation();
 try{await savePlannedUnique(cfg.kind);}catch(err){console.error(err);message(cfg.kind,err.message||"Não foi possível salvar.","error");}
},true);

function closeMenus(except=null){document.querySelectorAll(".txn-menu.open").forEach(m=>{if(m!==except)m.classList.remove("open");});}
function buildMenu(actions){
 if(actions.querySelector(".txn-more"))return;
 const edit=actions.querySelector(".edit-revenue,.edit-expense,.edit-transfer"),del=actions.querySelector(".delete-revenue,.delete-expense,.delete-transfer"),settle=actions.querySelector("[data-settle-record]");
 if(!edit&&!del&&!settle)return;
 [edit,del].filter(Boolean).forEach(b=>b.classList.add("txn-original-action"));const holder=actions.querySelector("[data-settle-id]");if(holder)holder.classList.add("txn-original-action");
 const more=document.createElement("button");more.type="button";more.className="txn-more";more.setAttribute("aria-label","Mais opções");more.textContent="⋮";
 const menu=document.createElement("div");menu.className="txn-menu";
 if(edit){const b=document.createElement("button");b.type="button";b.textContent="Editar";b.onclick=()=>{closeMenus();edit.click();};menu.appendChild(b);}
 if(settle){const b=document.createElement("button");b.type="button";b.textContent="Efetivar";b.onclick=()=>{closeMenus();settle.checked=true;settle.dispatchEvent(new Event("change",{bubbles:true}));};menu.appendChild(b);}
 if(del){const b=document.createElement("button");b.type="button";b.textContent="Excluir";b.className="danger";b.onclick=()=>{closeMenus();del.click();};menu.appendChild(b);}
 more.onclick=e=>{e.stopPropagation();const opening=!menu.classList.contains("open");closeMenus(menu);menu.classList.toggle("open",opening);};actions.append(more,menu);
}
function decorate(){ensureQuickSettle();document.querySelectorAll(".transaction-actions,.expense-actions,.transfer-actions").forEach(buildMenu);}
let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(decorate,40);}).observe(document.body,{childList:true,subtree:true});
document.addEventListener("click",()=>closeMenus());
window.addEventListener("categories-updated",decorate);
onAuthStateChanged(auth,current=>{user=current;setTimeout(decorate,80);});
