import { auth, db } from "./firebase.js";
import { formatMoney, getMoneyCurrency, getMoneyValue, resetMoneyField, setMoneyValue } from "./money.js";
import { getBank, setBankPickerValue } from "./bank-picker.js";
import { convertAccountsToBRL } from "./exchange.js";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const form=document.getElementById("contaForm");
const bancoInput=document.getElementById("contaBanco");
const nomeLivreGrupo=document.getElementById("contaNomeLivreGrupo");
const nomeLivreInput=document.getElementById("contaNomeLivre");
const tipoInput=document.getElementById("contaTipo");
const saldoInput=document.getElementById("contaSaldoInicial");
const moedaInput=document.getElementById("contaMoeda");
const lista=document.getElementById("listaContas");
const mensagem=document.getElementById("contaMensagem");
const saldoTotal=document.getElementById("saldoTotal");
const exchangeStatus=document.getElementById("exchangeStatus");
const submitButton=form.querySelector('button[type="submit"]');

let usuarioAtual=null;
let pararEscuta=null;
let contasAtuais=[];
let contaEmEdicaoId=null;
let cancelEditButton=null;

function mostrarMensagem(texto="",tipo=""){
  mensagem.textContent=texto;
  mensagem.className=`message ${tipo}`.trim();
}

function escapeHtml(valor=""){
  return String(valor).replace(/[&<>'"]/g,(caractere)=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[caractere]);
}

function obterDadosInstituicao(){
  const chave=bancoInput.value;
  if(chave==="outro"){
    const nome=nomeLivreInput.value.trim();
    return {chave:"outro",nome,simbolo:nome?nome.slice(0,3).toUpperCase():"OUT",cor:"#607d8b",segmento:"Livre",logo:""};
  }
  const banco=getBank(chave);
  return banco?{chave:banco.id,...banco}:null;
}

function logoMarkup(conta){
  if(!conta.logo) return `<span class="bank-symbol" style="--bank-color:${escapeHtml(conta.cor||"#607d8b")}">${escapeHtml(conta.simbolo||"CTA")}</span>`;
  return `<span class="bank-symbol bank-logo" style="--bank-color:${escapeHtml(conta.cor||"#607d8b")}"><img src="${escapeHtml(conta.logo)}" alt=""><span>${escapeHtml(conta.simbolo||"CTA")}</span></span>`;
}

async function atualizarSaldoConvertido(contas){
  if(!contas.length){
    saldoTotal.textContent=formatMoney(0,"BRL");
    exchangeStatus.textContent="Aguardando contas.";
    return;
  }
  exchangeStatus.textContent="Atualizando cotações...";
  try{
    const result=await convertAccountsToBRL(contas);
    saldoTotal.textContent=formatMoney(result.total,"BRL");
    const indisponiveis=result.unavailable.length?` · sem cotação: ${result.unavailable.join(", ")}`:"";
    exchangeStatus.textContent=`Cotações de referência de ${result.latestDate||"data mais recente"}${indisponiveis}`;
  }catch(error){
    const totalBRL=contas.filter((conta)=>(conta.moeda||"BRL")==="BRL").reduce((soma,conta)=>soma+Number(conta.saldoInicial||0),0);
    saldoTotal.textContent=formatMoney(totalBRL,"BRL");
    exchangeStatus.textContent="Conversão indisponível; exibindo somente contas em BRL.";
    console.error(error);
  }
}

function renderizarContas(contas){
  contasAtuais=contas;
  atualizarSaldoConvertido(contas);

  if(!contas.length){
    lista.innerHTML='<div class="empty-state">Nenhuma conta cadastrada.</div>';
    return;
  }

  lista.innerHTML=contas.map((conta)=>{
    const moeda=conta.moeda||"BRL";
    return `<article class="account-item">
      <div class="account-main">${logoMarkup(conta)}<div><strong>${escapeHtml(conta.nome)}</strong><span>${escapeHtml(conta.tipo)}${conta.segmento?` · ${escapeHtml(conta.segmento)}`:""} · ${escapeHtml(moeda)}</span></div></div>
      <div class="account-value"><strong>${formatMoney(conta.saldoInicial,moeda)}</strong><div class="account-actions"><button type="button" class="edit-account" data-id="${conta.id}">Editar</button><button type="button" class="delete-account" data-id="${conta.id}">Excluir</button></div></div>
    </article>`;
  }).join("");
}

function garantirBotaoCancelar(){
  if(cancelEditButton) return;
  cancelEditButton=document.createElement("button");
  cancelEditButton.type="button";
  cancelEditButton.className="secondary form-button cancel-edit hidden";
  cancelEditButton.textContent="Cancelar edição";
  submitButton.insertAdjacentElement("afterend",cancelEditButton);
  cancelEditButton.addEventListener("click",resetarFormulario);
}

function resetarFormulario(){
  contaEmEdicaoId=null;
  form.reset();
  bancoInput.value="";
  setBankPickerValue("");
  nomeLivreGrupo.classList.add("hidden");
  nomeLivreInput.required=false;
  resetMoneyField(saldoInput,"BRL");
  submitButton.textContent="Salvar conta";
  cancelEditButton?.classList.add("hidden");
  mostrarMensagem();
}

function iniciarEdicao(id){
  const conta=contasAtuais.find((item)=>item.id===id);
  if(!conta) return;

  contaEmEdicaoId=id;
  setBankPickerValue(conta.bancoId||"outro");
  bancoInput.dispatchEvent(new Event("change",{bubbles:true}));

  if((conta.bancoId||"outro")==="outro"){
    nomeLivreInput.value=conta.nome||"";
  }

  tipoInput.value=conta.tipo||"Conta corrente";
  moedaInput.value=conta.moeda||"BRL";
  setMoneyValue(saldoInput,conta.saldoInicial||0);
  submitButton.textContent="Salvar alterações";
  garantirBotaoCancelar();
  cancelEditButton.classList.remove("hidden");
  mostrarMensagem("Editando conta. Altere os dados e salve.","success");
  form.scrollIntoView({behavior:"smooth",block:"start"});
}

bancoInput.addEventListener("change",()=>{
  const livre=bancoInput.value==="outro";
  nomeLivreGrupo.classList.toggle("hidden",!livre);
  nomeLivreInput.required=livre;
  if(!livre) nomeLivreInput.value="";
});

lista.addEventListener("click",async(event)=>{
  const editButton=event.target.closest(".edit-account");
  if(editButton){
    iniciarEdicao(editButton.dataset.id);
    return;
  }

  const deleteButton=event.target.closest(".delete-account");
  if(!deleteButton || !usuarioAtual || !confirm("Excluir esta conta?")) return;

  try{
    await deleteDoc(doc(db,"users",usuarioAtual.uid,"contas",deleteButton.dataset.id));
    if(contaEmEdicaoId===deleteButton.dataset.id) resetarFormulario();
  }catch(error){
    mostrarMensagem("Não foi possível excluir a conta.","error");
    console.error(error);
  }
});

form.addEventListener("submit",async(event)=>{
  event.preventDefault();
  mostrarMensagem();

  if(!usuarioAtual){
    mostrarMensagem("Faça login para cadastrar uma conta.","error");
    return;
  }

  const instituicao=obterDadosInstituicao();
  const saldoInicial=getMoneyValue(saldoInput);
  const moeda=getMoneyCurrency(saldoInput);

  if(!instituicao){
    mostrarMensagem("Selecione um banco ou a opção de nome livre.","error");
    return;
  }
  if(!instituicao.nome){
    mostrarMensagem("Informe o nome da conta.","error");
    return;
  }
  if(!Number.isFinite(saldoInicial)){
    mostrarMensagem("Informe um saldo inicial válido.","error");
    return;
  }

  const dados={
    bancoId:instituicao.chave,
    nome:instituicao.nome,
    simbolo:instituicao.simbolo,
    cor:instituicao.cor,
    logo:instituicao.logo||"",
    segmento:instituicao.segmento,
    tipo:tipoInput.value,
    saldoInicial,
    moeda,
    ativa:true,
    atualizadoEm:serverTimestamp()
  };

  try{
    if(contaEmEdicaoId){
      await updateDoc(doc(db,"users",usuarioAtual.uid,"contas",contaEmEdicaoId),dados);
      mostrarMensagem("Conta atualizada com sucesso.","success");
    }else{
      await addDoc(collection(db,"users",usuarioAtual.uid,"contas"),{...dados,criadoEm:serverTimestamp()});
      mostrarMensagem("Conta cadastrada com sucesso.","success");
    }
    resetarFormulario();
  }catch(error){
    mostrarMensagem(contaEmEdicaoId?"Não foi possível atualizar a conta.":"Não foi possível cadastrar a conta.","error");
    console.error(error);
  }
});

onAuthStateChanged(auth,(user)=>{
  usuarioAtual=user;
  if(pararEscuta) pararEscuta();
  if(!user){
    renderizarContas([]);
    return;
  }

  const contasQuery=query(collection(db,"users",user.uid,"contas"),orderBy("criadoEm","desc"));
  pararEscuta=onSnapshot(contasQuery,(snapshot)=>{
    renderizarContas(snapshot.docs.map((documento)=>({id:documento.id,...documento.data()})));
  },(error)=>{
    mostrarMensagem("Não foi possível carregar as contas.","error");
    console.error(error);
  });
});
