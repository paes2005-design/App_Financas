import { auth, db } from "./firebase.js";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const content=document.getElementById("content");
const view=document.createElement("div");
view.id="categorias";
view.className="app-view hidden";
view.innerHTML=`<div class="page-grid category-layout"><article class="panel"><h3 id="categoryFormTitle">Nova categoria</h3><form id="categoryForm" class="account-form"><label for="categoryOperation">Usar em</label><select id="categoryOperation"><option value="receita">Receitas</option><option value="despesa">Despesas</option><option value="transferencia">Transferências</option><option value="todos">Todas as operações</option></select><label for="categoryName">Categoria</label><input id="categoryName" maxlength="50" placeholder="Ex.: Trabalho" required><label for="categorySubcategories">Subcategorias</label><input id="categorySubcategories" maxlength="250" placeholder="Ex.: Salário, Freelance, Comissão"><small>Separe as subcategorias por vírgula.</small><button id="categorySubmit" type="submit" class="primary form-button">Salvar categoria</button><button id="categoryCancel" type="button" class="secondary form-button hidden">Cancelar edição</button><p id="categoryMessage" class="message"></p></form></article><article class="panel"><h3>Categorias cadastradas</h3><div id="categoryList"><div class="empty-state">Nenhuma categoria cadastrada.</div></div></article></div>`;
content.insertBefore(view,document.getElementById("placeholderView"));

const style=document.createElement("style");
style.textContent=`.category-layout{grid-template-columns:minmax(300px,380px) minmax(0,1fr)}.category-item{padding:14px 0;border-bottom:1px solid var(--border)}.category-item:last-child{border-bottom:0}.category-item-head{display:flex;justify-content:space-between;gap:12px}.category-item small{display:block;margin-top:4px;color:var(--muted)}.category-actions{display:flex;gap:8px}.category-actions button{border:0;background:transparent}.category-actions .edit-category{color:var(--primary)}.category-actions .delete-category{color:var(--danger)}.subcategory-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.subcategory-chips span{padding:5px 8px;border-radius:999px;background:#eef3fa;font-size:.8rem}@media(max-width:980px){.category-layout{grid-template-columns:1fr}}`;
document.head.appendChild(style);

const $=(id)=>document.getElementById(id);
const form=$("categoryForm"), operation=$("categoryOperation"), nameInput=$("categoryName"), subsInput=$("categorySubcategories"), list=$("categoryList"), message=$("categoryMessage"), title=$("categoryFormTitle"), submit=$("categorySubmit"), cancel=$("categoryCancel");
let user=null, categories=[], editingId=null, stop=null;

function esc(value=""){return String(value).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[c]);}
function showMessage(text="",type=""){message.textContent=text;message.className=`message ${type}`.trim();}
function parseSubs(){return [...new Set(subsInput.value.split(",").map(v=>v.trim()).filter(Boolean))];}
function reset(){editingId=null;form.reset();title.textContent="Nova categoria";submit.textContent="Salvar categoria";cancel.classList.add("hidden");showMessage();}
function emit(){window.dispatchEvent(new CustomEvent("categories-updated",{detail:{categories}}));}
function render(){list.innerHTML=categories.length?categories.map(c=>`<article class="category-item"><div class="category-item-head"><div><strong>${esc(c.nome)}</strong><small>${esc(c.operacao)}</small></div><div class="category-actions"><button type="button" class="edit-category" data-id="${c.id}">Editar</button><button type="button" class="delete-category" data-id="${c.id}">Excluir</button></div></div><div class="subcategory-chips">${(c.subcategorias||[]).map(s=>`<span>${esc(s)}</span>`).join("")||"<small>Sem subcategorias</small>"}</div></article>`).join(""):'<div class="empty-state">Nenhuma categoria cadastrada.</div>';emit();}

form.addEventListener("submit",async e=>{e.preventDefault();showMessage();if(!user)return;const nome=nameInput.value.trim();if(!nome)return showMessage("Informe o nome da categoria.","error");const data={nome,operacao:operation.value,subcategorias:parseSubs(),atualizadoEm:serverTimestamp()};try{if(editingId)await updateDoc(doc(db,"users",user.uid,"categorias",editingId),data);else await addDoc(collection(db,"users",user.uid,"categorias"),{...data,criadoEm:serverTimestamp()});showMessage(editingId?"Categoria atualizada.":"Categoria cadastrada.","success");reset();}catch(error){showMessage("Não foi possível salvar a categoria.","error");console.error(error);}});
cancel.addEventListener("click",reset);
list.addEventListener("click",async e=>{const edit=e.target.closest(".edit-category"),del=e.target.closest(".delete-category");if(edit){const c=categories.find(x=>x.id===edit.dataset.id);if(!c)return;editingId=c.id;operation.value=c.operacao;nameInput.value=c.nome;subsInput.value=(c.subcategorias||[]).join(", ");title.textContent="Editar categoria";submit.textContent="Salvar alterações";cancel.classList.remove("hidden");form.scrollIntoView({behavior:"smooth",block:"start"});}if(del&&confirm("Excluir esta categoria? As operações existentes manterão o nome salvo.")){await deleteDoc(doc(db,"users",user.uid,"categorias",del.dataset.id));if(editingId===del.dataset.id)reset();}});

window.addEventListener("open-category-manager",e=>{const requested=e.detail?.operacao;if(requested&&["receita","despesa","transferencia"].includes(requested))operation.value=requested;document.querySelector('[data-page="categorias"]')?.click();nameInput.focus();});

export function getCategoriesFor(operationName){return categories.filter(c=>c.operacao===operationName||c.operacao==="todos");}

onAuthStateChanged(auth,current=>{user=current;if(stop)stop();categories=[];render();if(!current)return;stop=onSnapshot(query(collection(db,"users",current.uid,"categorias"),orderBy("nome")),snap=>{categories=snap.docs.map(d=>({id:d.id,...d.data()}));render();});});