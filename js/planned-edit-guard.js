import { auth, db } from "./firebase.js";
import { getMoneyValue } from "./money.js";
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

let user=null,stops=[];
const records={receita:[],despesa:[],transferencia:[]};
const editing={receita:null,despesa:null,transferencia:null};
const cfg={
 receita:{collection:"receitas",form:"receitaForm",prefix:"receita",edit:".edit-revenue",cancel:"cancelarEdicaoReceita",message:"receitaMensagem"},
 despesa:{collection:"despesas",form:"despesaForm",prefix:"despesa",edit:".edit-expense",cancel:"cancelarEdicaoDespesa",message:"despesaMensagem"},
 transferencia:{collection:"transferencias",form:"transferForm",prefix:"transfer",edit:".edit-transfer",cancel:"transferCancelar",message:"transferMensagem"}
};
function val(id){return document.getElementById(id)?.value||"";}
function selected(id){return document.getElementById(id)?.selectedOptions?.[0]?.textContent?.trim()||"";}
function parts(data){const d=new Date(`${data}T12:00:00`),m=d.getMonth()+1;return{ano:d.getFullYear(),mes:m,trimestre:Math.ceil(m/3),semestre:m<=6?1:2,dataChave:data};}
function isDone(r){return r?.efetivada===true||Boolean(r?.dataEfetivacao);}
function show(kind,text,type="success"){const el=document.getElementById(cfg[kind].message);if(el){el.textContent=text;el.className=`message ${type}`;}}
function dataFromForm(kind){
 const p=cfg[kind].prefix,data=val(`${p}Data`),valor=getMoneyValue(document.getElementById(`${p}Valor`)),moeda=val(`${p}Moeda`),descricao=val(`${p}Descricao`).trim(),categoriaId=val(`${p}Categoria`),categoriaNome=selected(`${p}Categoria`),subcategoria=val(`${p}Subcategoria`);
 if(!data||!Number.isFinite(valor)||valor<=0||!moeda||!descricao||!categoriaId)throw new Error("Preencha todos os campos obrigatórios.");
 const base={categoriaId,categoriaNome,subcategoria,descricao,valor,moeda,data,...parts(data),competencia:data.slice(0,7),planejada:true,efetivada:false,atualizadoEm:serverTimestamp()};
 if(kind==="receita"||kind==="despesa"){
  const contaId=val(`${p}Conta`),contaNome=selected(`${p}Conta`);if(!contaId)throw new Error("Selecione uma conta.");return{...base,contaId,contaNome};
 }
 const origemId=val("transferOrigem"),destinoId=val("transferDestino");if(!origemId||!destinoId||origemId===destinoId)throw new Error("Selecione contas diferentes.");return{...base,origemId,origemNome:selected("transferOrigem"),destinoId,destinoNome:selected("transferDestino")};
}

document.addEventListener("click",event=>{
 for(const [kind,c] of Object.entries(cfg)){
  const edit=event.target.closest(c.edit);if(edit){editing[kind]=edit.dataset.id||null;return;}
  if(event.target.closest(`#${c.cancel}`)){editing[kind]=null;return;}
 }
},true);

document.addEventListener("submit",async event=>{
 const entry=Object.entries(cfg).find(([,c])=>event.target.id===c.form);if(!entry||!user)return;
 const [kind,c]=entry,id=editing[kind];if(!id)return;
 const record=records[kind].find(r=>r.id===id);if(!record||isDone(record))return;
 event.preventDefault();event.stopImmediatePropagation();
 try{
  const update=dataFromForm(kind);
  await updateDoc(doc(db,"users",user.uid,c.collection,id),update);
  editing[kind]=null;
  event.target.reset();
  show(kind,"Operação prevista atualizada. Ela continua sem afetar o saldo até ser efetivada.");
 }catch(error){console.error(error);show(kind,error.message||"Não foi possível atualizar a operação prevista.","error");}
},true);

onAuthStateChanged(auth,current=>{
 user=current;stops.forEach(s=>s());stops=[];Object.keys(records).forEach(k=>records[k]=[]);Object.keys(editing).forEach(k=>editing[k]=null);if(!current)return;
 for(const [kind,c] of Object.entries(cfg)){
  stops.push(onSnapshot(query(collection(db,"users",current.uid,c.collection),orderBy("data","desc")),snap=>{records[kind]=snap.docs.map(d=>({id:d.id,...d.data()}));}));
 }
});
