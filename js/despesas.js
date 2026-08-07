import { auth, db } from "./firebase.js";
import { formatMoney, getMoneyValue, resetMoneyField, setMoneyValue } from "./money.js";
import { getCategoriesFor } from "./categorias.js";
import { createMonthNavigator, getPeriod } from "./period.js";
import { convertAccountsToBRL } from "./exchange.js";
import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const content=document.getElementById("content");
const placeholder=document.getElementById("placeholderView");
let view=document.getElementById("despesas");
if(view)view.remove();
view=document.createElement("div");
view.id="despesas";
view.className="app-view hidden";
view.innerHTML=`
  <div id="despesasMonthNavigator"></div>
  <div class="page-grid expense-layout">
    <article class="panel">
      <h3 id="despesaFormTitulo">Nova despesa</h3>
      <form id="despesaForm" class="account-form">
        <label for="despesaConta">Conta de origem</label>
        <select id="despesaConta" required></select>

        <div class="field-with-action">
          <div>
            <label for="despesaCategoria">Categoria</label>
            <select id="despesaCategoria" required></select>
          </div>
          <button id="addDespesaCategoria" type="button" class="small-action">+ Categoria</button>
        </div>

        <label for="despesaSubcategoria">Subcategoria</label>
        <select id="despesaSubcategoria"><option value="">Sem subcategoria</option></select>

        <label for="despesaDescricao">Descrição</label>
        <input id="despesaDescricao" maxlength="80" placeholder="Ex.: Supermercado" required>

        <label for="despesaData">Data</label>
        <input id="despesaData" type="date" required>

        <label for="despesaValor">Valor</label>
        <div class="money-field" data-money-field>
          <div class="money-input-row">
            <select id="despesaMoeda" data-money-currency></select>
            <input id="despesaValor" data-money-input type="text" inputmode="decimal" value="0,00">
            <button type="button" class="calculator-toggle" data-money-calculator aria-label="Abrir calculadora">🧮</button>
          </div>
        </div>

        <button id="salvarDespesa" class="primary form-button" type="submit">Salvar despesa</button>
        <button id="cancelarEdicaoDespesa" class="secondary form-button hidden" type="button">Cancelar edição</button>
        <p id="despesaMensagem" class="message"></p>
      </form>
    </article>

    <article class="panel">
      <div class="panel-heading">
        <div><h3>Despesas do mês</h3><small id="totalDespesasFiltradas"></small></div>
      </div>
      <div class="dynamic-filter-grid">
        <select id="filtroDespesaConta"></select>
        <select id="filtroDespesaCategoria"></select>
        <select id="filtroDespesaSubcategoria"></select>
        <select id="filtroDespesaMoeda"></select>
      </div>
      <div id="listaDespesas"><div class="empty-state">Nenhuma despesa cadastrada.</div></div>
    </article>
  </div>`;
content.insertBefore(view,placeholder);
createMonthNavigator("despesas",document.getElementById("despesasMonthNavigator"));

const style=document.createElement("style");
style.textContent=`
.expense-layout{grid-template-columns:minmax(300px,380px) minmax(0,1fr)}
.expense-layout .field-with-action{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end}
.expense-layout .small-action{height:44px;padding:0 10px;border:1px solid var(--primary);border-radius:9px;background:white;color:var(--primary);font-weight:700}
.expense-item{display:flex;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px solid var(--border)}
.expense-item span{display:block;margin-top:4px;color:var(--muted);font-size:.88rem}
.expense-value{text-align:right}.expense-value>strong{color:var(--danger)}
.expense-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:6px}.expense-actions button{border:0;background:transparent;font-size:.86rem}.edit-expense{color:var(--primary)}.delete-expense{color:var(--danger)}
@media(max-width:980px){.expense-layout{grid-template-columns:1fr}}
@media(max-width:520px){.expense-item{align-items:flex-start}}
`;
document.head.appendChild(style);

const $=id=>document.getElementById(id);
const form=$("despesaForm"),formTitle=$("despesaFormTitulo"),saveBtn=$("salvarDespesa"),cancelBtn=$("cancelarEdicaoDespesa");
const account=$("despesaConta"),category=$("despesaCategoria"),subcategory=$("despesaSubcategoria"),currency=$("despesaMoeda"),valueInput=$("despesaValor"),message=$("despesaMensagem"),list=$("listaDespesas");
const filterAccount=$("filtroDespesaConta"),filterCategory=$("filtroDespesaCategoria"),filterSub=$("filtroDespesaSubcategoria"),filterCurrency=$("filtroDespesaMoeda"),total=$("totalDespesasFiltradas");
let user=null,stop=null,accounts=[],expenses=[],editing=null,summaryToken=0;

function esc(v=""){return String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[c]);}
function msg(text="",type=""){message.textContent=text;message.className=`message ${type}`.trim();}
function today(){return new Date().toISOString().slice(0,10);}
function periodParts(data){const d=new Date(`${data}T12:00:00`),mes=d.getMonth()+1;return{ano:d.getFullYear(),mes,trimestre:Math.ceil(mes/3),semestre:mes<=6?1:2,dataChave:data};}
function categories(){return getCategoriesFor("despesa");}

async function accountCurrencies(item){
  const snap=await getDocs(collection(db,"users",user.uid,"contas",item.id,"moedas"));
  return [...new Set([item.moeda||"BRL",...snap.docs.map(d=>d.data().codigo)])];
}
async function updateCurrencies(preferred=""){
  const item=accounts.find(a=>a.id===account.value);
  if(!item){currency.innerHTML="";return;}
  const values=await accountCurrencies(item);
  currency.innerHTML=values.map(v=>`<option value="${v}">${v}</option>`).join("");
  currency.value=values.includes(preferred)?preferred:values[0];
}
function renderAccounts(){
  account.innerHTML=`<option value="">Selecione...</option>${accounts.map(a=>`<option value="${a.id}">${esc(a.nome)}</option>`).join("")}`;
}
function renderCategories(preferredCategory="",preferredSub=""){
  const values=categories();
  category.innerHTML=`<option value="">Selecione...</option>${values.map(c=>`<option value="${c.id}">${esc(c.nome)}</option>`).join("")}`;
  if(preferredCategory)category.value=preferredCategory;
  renderSubcategories(preferredSub);
}
function renderSubcategories(preferred=""){
  const selected=categories().find(c=>c.id===category.value),values=selected?.subcategorias||[];
  subcategory.innerHTML=`<option value="">Sem subcategoria</option>${values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("")}`;
  if(values.includes(preferred))subcategory.value=preferred;
}
function monthRows(){const p=getPeriod("despesas");return expenses.filter(r=>r.data>=p.start&&r.data<=p.end);}
function optionList(values,label){return `<option value="">${label}</option>${values.map(v=>`<option value="${esc(v.value)}">${esc(v.label)}</option>`).join("")}`;}
function rebuildDynamicFilters(){
  const rows=monthRows();
  const accountsMap=new Map(rows.map(r=>[r.contaId,r.contaNome]));
  const catsMap=new Map(rows.map(r=>[r.categoriaId,r.categoriaNome]));
  const subs=[...new Set(rows.map(r=>r.subcategoria).filter(Boolean))].sort();
  const currencies=[...new Set(rows.map(r=>r.moeda||"BRL")].sort((a,b)=>a==="BRL"?-1:b==="BRL"?1:a.localeCompare(b));
  const keep={a:filterAccount.value,c:filterCategory.value,s:filterSub.value,m:filterCurrency.value};
  filterAccount.innerHTML=optionList([...accountsMap].map(([value,label])=>({value,label})),"Todas as contas");
  filterCategory.innerHTML=optionList([...catsMap].map(([value,label])=>({value,label})),"Todas as categorias");
  filterSub.innerHTML=optionList(subs.map(v=>({value:v,label:v})),"Todas as subcategorias");
  filterCurrency.innerHTML=optionList(currencies.map(v=>({value:v,label:v})),"Todas as moedas");
  if([...filterAccount.options].some(o=>o.value===keep.a))filterAccount.value=keep.a;
  if([...filterCategory.options].some(o=>o.value===keep.c))filterCategory.value=keep.c;
  if([...filterSub.options].some(o=>o.value===keep.s))filterSub.value=keep.s;
  if([...filterCurrency.options].some(o=>o.value===keep.m))filterCurrency.value=keep.m;
}
function filtered(){
  return monthRows().filter(r=>(!filterAccount.value||r.contaId===filterAccount.value)&&(!filterCategory.value||r.categoriaId===filterCategory.value)&&(!filterSub.value||r.subcategoria===filterSub.value)&&(!filterCurrency.value||(r.moeda||"BRL")===filterCurrency.value));
}
async function renderSummary(rows){
  const token=++summaryToken;
  if(!rows.length){total.textContent="Sem despesas no período";return;}
  const sums=new Map();
  rows.forEach(r=>sums.set(r.moeda||"BRL",(sums.get(r.moeda||"BRL")||0)+Number(r.valor||0)));
  const ordered=[...sums].sort(([a],[b])=>a==="BRL"?-1:b==="BRL"?1:a.localeCompare(b));
  let converted="";
  try{
    const result=await convertAccountsToBRL(rows.map(r=>({moeda:r.moeda||"BRL",saldoInicial:Number(r.valor||0)})));
    converted=` · Total convertido: ${formatMoney(result.total,"BRL")}`;
  }catch(error){console.error("Falha ao converter total de despesas:",error);}
  if(token!==summaryToken)return;
  total.textContent=ordered.map(([m,v])=>formatMoney(v,m)).join(" · ")+converted;
}
function render(){
  rebuildDynamicFilters();
  const rows=filtered();
  renderSummary(rows);
  list.innerHTML=rows.length?rows.map(r=>`<article class="expense-item"><div><strong>${esc(r.descricao)}</strong><span>${esc(r.categoriaNome||"Sem categoria")}${r.subcategoria?` › ${esc(r.subcategoria)}`:""} · ${esc(r.contaNome)} · ${esc(r.data)}</span></div><div class="expense-value"><strong>-${formatMoney(r.valor,r.moeda||"BRL")}</strong><div class="expense-actions"><button type="button" class="edit-expense" data-id="${r.id}">Editar</button><button type="button" class="delete-expense" data-id="${r.id}" data-account="${r.contaId}" data-movement="${r.movimentacaoId||""}">Excluir</button></div></div></article>`).join(""):'<div class="empty-state">Nenhuma despesa encontrada neste mês.</div>';
}
function reset(){
  editing=null;form.reset();formTitle.textContent="Nova despesa";saveBtn.textContent="Salvar despesa";cancelBtn.classList.add("hidden");
  const p=getPeriod("despesas");$("despesaData").value=(today()>=p.start&&today()<=p.end)?today():p.start;
  account.value="";currency.innerHTML="";renderCategories();resetMoneyField(valueInput,"BRL");msg();
}
async function edit(id){
  const r=expenses.find(x=>x.id===id);if(!r)return;
  editing=r;formTitle.textContent="Editar despesa";saveBtn.textContent="Salvar alterações";cancelBtn.classList.remove("hidden");
  account.value=r.contaId;await updateCurrencies(r.moeda||"BRL");renderCategories(r.categoriaId||"",r.subcategoria||"");
  $("despesaDescricao").value=r.descricao||"";$("despesaData").value=r.data||today();setMoneyValue(valueInput,Number(r.valor||0));
  msg("Editando despesa.","success");form.scrollIntoView({behavior:"smooth",block:"start"});
}

account.addEventListener("change",()=>updateCurrencies());
category.addEventListener("change",()=>renderSubcategories());
$("addDespesaCategoria").addEventListener("click",()=>window.dispatchEvent(new CustomEvent("open-category-manager",{detail:{operacao:"despesa"}})));
window.addEventListener("categories-updated",()=>{const c=category.value,s=subcategory.value;renderCategories(c,s);render();});
window.addEventListener("period-change",e=>{if(e.detail.viewId==="despesas"){reset();render();}});
[filterAccount,filterCategory,filterSub,filterCurrency].forEach(el=>el.addEventListener("change",render));
cancelBtn.addEventListener("click",reset);

list.addEventListener("click",async e=>{
  const editBtn=e.target.closest(".edit-expense"),deleteBtn=e.target.closest(".delete-expense");
  if(editBtn)return edit(editBtn.dataset.id);
  if(!deleteBtn||!confirm("Excluir esta despesa?"))return;
  try{
    await deleteDoc(doc(db,"users",user.uid,"despesas",deleteBtn.dataset.id));
    if(deleteBtn.dataset.movement)await deleteDoc(doc(db,"users",user.uid,"contas",deleteBtn.dataset.account,"movimentacoes",deleteBtn.dataset.movement));
    if(editing?.id===deleteBtn.dataset.id)reset();
  }catch(error){msg("Não foi possível excluir a despesa.","error");console.error(error);}
});

form.addEventListener("submit",async e=>{
  e.preventDefault();msg();
  const acc=accounts.find(a=>a.id===account.value),cat=categories().find(c=>c.id===category.value),valor=getMoneyValue(valueInput),data=$("despesaData").value,descricao=$("despesaDescricao").value.trim(),moeda=currency.value,sub=subcategory.value;
  if(!acc)return msg("Selecione uma conta.","error");
  if(!cat)return msg("Selecione uma categoria.","error");
  if(!descricao||!data||!moeda)return msg("Preencha os campos obrigatórios.","error");
  if(!Number.isFinite(valor)||valor<=0)return msg("Informe um valor maior que zero.","error");
  const p=periodParts(data);
  const movement={tipo:"despesa",categoriaId:cat.id,categoriaNome:cat.nome,subcategoria:sub,descricao,valor,moeda,data,...p,origem:"despesas",atualizadoEm:serverTimestamp()};
  const record={contaId:acc.id,contaNome:acc.nome,categoriaId:cat.id,categoriaNome:cat.nome,subcategoria:sub,descricao,valor,moeda,data,...p,atualizadoEm:serverTimestamp()};
  try{
    if(editing){
      let movementId=editing.movimentacaoId||"";
      if(editing.contaId!==acc.id){
        if(movementId)await deleteDoc(doc(db,"users",user.uid,"contas",editing.contaId,"movimentacoes",movementId));
        const created=await addDoc(collection(db,"users",user.uid,"contas",acc.id,"movimentacoes"),{...movement,criadoEm:serverTimestamp()});movementId=created.id;
      }else if(movementId){
        await updateDoc(doc(db,"users",user.uid,"contas",acc.id,"movimentacoes",movementId),movement);
      }else{
        const created=await addDoc(collection(db,"users",user.uid,"contas",acc.id,"movimentacoes"),{...movement,criadoEm:serverTimestamp()});movementId=created.id;
      }
      await updateDoc(doc(db,"users",user.uid,"despesas",editing.id),{...record,movimentacaoId:movementId});
      reset();msg("Despesa atualizada e saldo recalculado.","success");
    }else{
      const created=await addDoc(collection(db,"users",user.uid,"contas",acc.id,"movimentacoes"),{...movement,criadoEm:serverTimestamp()});
      await addDoc(collection(db,"users",user.uid,"despesas"),{...record,movimentacaoId:created.id,criadoEm:serverTimestamp()});
      reset();msg("Despesa cadastrada e descontada do saldo da conta.","success");
    }
  }catch(error){msg("Não foi possível salvar a despesa.","error");console.error(error);}
});

onAuthStateChanged(auth,async current=>{
  user=current;if(stop)stop();expenses=[];render();if(!current)return;
  const snap=await getDocs(collection(db,"users",current.uid,"contas"));
  accounts=snap.docs.map(d=>({id:d.id,...d.data()}));renderAccounts();renderCategories();reset();
  stop=onSnapshot(query(collection(db,"users",current.uid,"despesas"),orderBy("data","desc")),snapshots=>{expenses=snapshots.docs.map(d=>({id:d.id,...d.data()}));render();});
});
