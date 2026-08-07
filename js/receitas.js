import { auth, db } from "./firebase.js";
import { formatMoney, getMoneyValue, resetMoneyField } from "./money.js";
import {
  addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const $=(id)=>document.getElementById(id);
const form=$("receitaForm"), contaSelect=$("receitaConta"), moedaSelect=$("receitaMoeda"), valorInput=$("receitaValor"), mensagem=$("receitaMensagem"), lista=$("listaReceitas");
const filtroConta=$("filtroReceitaConta"), filtroInicio=$("filtroReceitaInicio"), filtroFim=$("filtroReceitaFim"), filtroTipo=$("filtroReceitaTipo"), total=$("totalReceitasFiltradas");
let usuario=null, pararReceitas=null, contas=[], receitas=[];

const tipos=["Salário","Freelance","Vendas","Rendimentos","Aluguel recebido","Reembolso","Presente","Outros"];

function esc(v=""){return String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[c]);}
function msg(texto="",tipo=""){mensagem.textContent=texto;mensagem.className=`message ${tipo}`.trim();}
function dateParts(dateString){const d=new Date(`${dateString}T12:00:00`);const mes=d.getMonth()+1;return{ano:d.getFullYear(),mes,trimestre:Math.ceil(mes/3),semestre:mes<=6?1:2,dataChave:dateString};}
function hoje(){return new Date().toISOString().slice(0,10);}

async function moedasDaConta(conta){
  const extras=await getDocs(collection(db,"users",usuario.uid,"contas",conta.id,"moedas"));
  return [...new Set([conta.moeda||"BRL",...extras.docs.map(d=>d.data().codigo)])];
}

async function atualizarMoedas(){
  const conta=contas.find(c=>c.id===contaSelect.value);
  if(!conta){moedaSelect.innerHTML="";return;}
  const moedas=await moedasDaConta(conta);
  moedaSelect.innerHTML=moedas.map(m=>`<option value="${m}">${m}</option>`).join("");
  const campo=valorInput.closest("[data-money-field]")?.querySelector("[data-money-currency]");
  if(campo){campo.innerHTML=moedas.map(m=>`<option value="${m}">${m}</option>`).join("");campo.value=moedas[0];}
}

function renderFiltros(){
  const options=contas.map(c=>`<option value="${c.id}">${esc(c.nome)}</option>`).join("");
  contaSelect.innerHTML=`<option value="">Selecione...</option>${options}`;
  filtroConta.innerHTML=`<option value="">Todas as contas</option>${options}`;
  $("receitaTipo").innerHTML=tipos.map(t=>`<option value="${t}">${t}</option>`).join("");
  filtroTipo.innerHTML=`<option value="">Todos os tipos</option>${tipos.map(t=>`<option value="${t}">${t}</option>`).join("")}`;
}

function filtradas(){return receitas.filter(r=>(!filtroConta.value||r.contaId===filtroConta.value)&&(!filtroTipo.value||r.tipoReceita===filtroTipo.value)&&(!filtroInicio.value||r.data>=filtroInicio.value)&&(!filtroFim.value||r.data<=filtroFim.value));}
function render(){
  const rows=filtradas();
  const somaBRL=rows.filter(r=>(r.moeda||"BRL")==="BRL").reduce((s,r)=>s+Number(r.valor||0),0);
  total.textContent=`Total em BRL: ${formatMoney(somaBRL,"BRL")}${rows.some(r=>(r.moeda||"BRL")!=="BRL")?" · moedas estrangeiras exibidas separadamente":""}`;
  lista.innerHTML=rows.length?rows.map(r=>`<article class="transaction-item"><div><strong>${esc(r.descricao)}</strong><span>${esc(r.tipoReceita)} · ${esc(r.contaNome)} · ${esc(r.data)}</span></div><div class="transaction-value"><strong>+${formatMoney(r.valor,r.moeda||"BRL")}</strong><button type="button" class="delete-revenue" data-id="${r.id}" data-account="${r.contaId}" data-movement="${r.movimentacaoId||""}">Excluir</button></div></article>`).join(""):'<div class="empty-state">Nenhuma receita encontrada.</div>';
}

contaSelect.addEventListener("change",atualizarMoedas);
[filtroConta,filtroInicio,filtroFim,filtroTipo].forEach(el=>el.addEventListener("change",render));
lista.addEventListener("click",async e=>{const b=e.target.closest(".delete-revenue");if(!b||!confirm("Excluir esta receita?"))return;await deleteDoc(doc(db,"users",usuario.uid,"receitas",b.dataset.id));if(b.dataset.movement)await deleteDoc(doc(db,"users",usuario.uid,"contas",b.dataset.account,"movimentacoes",b.dataset.movement));});

form.addEventListener("submit",async e=>{
  e.preventDefault();msg();
  const conta=contas.find(c=>c.id===contaSelect.value), valor=getMoneyValue(valorInput), data=$("receitaData").value, descricao=$("receitaDescricao").value.trim(), tipoReceita=$("receitaTipo").value, moeda=moedaSelect.value;
  if(!conta)return msg("Selecione uma conta.","error");if(!descricao)return msg("Informe a descrição.","error");if(!Number.isFinite(valor)||valor<=0)return msg("Informe um valor maior que zero.","error");
  const periodo=dateParts(data);
  try{
    const mov=await addDoc(collection(db,"users",usuario.uid,"contas",conta.id,"movimentacoes"),{tipo:"receita",categoria:tipoReceita,descricao,valor,moeda,data,...periodo,origem:"receitas",criadoEm:serverTimestamp()});
    await addDoc(collection(db,"users",usuario.uid,"receitas"),{contaId:conta.id,contaNome:conta.nome,tipoReceita,descricao,valor,moeda,data,...periodo,movimentacaoId:mov.id,criadoEm:serverTimestamp()});
    form.reset();$("receitaData").value=hoje();resetMoneyField(valorInput,"BRL");moedaSelect.innerHTML="";msg("Receita cadastrada e adicionada ao saldo da conta.","success");
  }catch(err){msg("Não foi possível cadastrar a receita.","error");console.error(err);}
});

onAuthStateChanged(auth,async user=>{
  usuario=user;if(pararReceitas)pararReceitas();if(!user)return;
  const contasSnap=await getDocs(collection(db,"users",user.uid,"contas"));contas=contasSnap.docs.map(d=>({id:d.id,...d.data()}));renderFiltros();$("receitaData").value=hoje();
  pararReceitas=onSnapshot(query(collection(db,"users",user.uid,"receitas"),orderBy("data","desc")),snap=>{receitas=snap.docs.map(d=>({id:d.id,...d.data()}));render();});
});