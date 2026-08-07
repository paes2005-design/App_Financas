import { auth, db } from "./firebase.js";
import { formatMoney, getMoneyCurrency, getMoneyValue, resetMoneyField, setMoneyValue } from "./money.js";
import { getBank, setBankPickerValue } from "./bank-picker.js";
import { convertAccountsToBRL } from "./exchange.js";
import {
  addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const $=(id)=>document.getElementById(id);
const form=$("contaForm"), bancoInput=$("contaBanco"), nomeLivreGrupo=$("contaNomeLivreGrupo"), nomeLivreInput=$("contaNomeLivre"), tipoInput=$("contaTipo"), saldoInput=$("contaSaldoInicial"), lista=$("listaContas"), mensagem=$("contaMensagem"), saldoTotal=$("saldoTotal"), exchangeStatus=$("exchangeStatus");
const details=$("accountDetails"), detailsEmpty=$("accountDetailsEmpty"), detailsContent=$("accountDetailsContent"), detailsIdentity=$("detailsIdentity"), detailsBalances=$("detailsBalances"), detailsHistory=$("detailsHistory");
const editForm=$("detailsEditForm"), detailsTipo=$("detailsTipo"), detailsMoeda=$("detailsMoeda"), detailsSaldoInicial=$("detailsSaldoInicial");
const adjustmentForm=$("balanceAdjustmentForm"), adjustmentCurrency=$("adjustmentCurrency"), adjustmentCurrencyMirror=$("adjustmentCurrencyMirror"), adjustmentRealBalance=$("adjustmentRealBalance"), adjustmentCalculated=$("adjustmentCalculated"), adjustmentAutoMovement=$("adjustmentAutoMovement"), adjustmentMessage=$("adjustmentMessage");
const addCurrencyForm=$("addCurrencyForm"), newCurrencyCode=$("newCurrencyCode"), newCurrencyMirror=$("newCurrencyMirror"), newCurrencyBalance=$("newCurrencyBalance"), currencyMessage=$("currencyMessage");

let usuarioAtual=null, pararContas=null, pararMoedas=null, pararMovimentos=null;
let contasAtuais=[], contaSelecionada=null, moedasExtras=[], movimentos=[];
let renderSequence=0;

function msg(el,texto="",tipo=""){el.textContent=texto;el.className=`message ${tipo}`.trim();}
function esc(v=""){return String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[c]);}
function instituicao(){const chave=bancoInput.value;if(chave==="outro"){const nome=nomeLivreInput.value.trim();return{chave:"outro",nome,simbolo:nome?nome.slice(0,3).toUpperCase():"OUT",cor:"#607d8b",segmento:"Livre",logo:""};}const b=getBank(chave);return b?{chave:b.id,...b}:null;}
function logo(c){if(!c.logo)return `<span class="bank-symbol" style="--bank-color:${esc(c.cor||"#607d8b")}">${esc(c.simbolo||"CTA")}</span>`;return `<span class="bank-symbol bank-logo" style="--bank-color:${esc(c.cor||"#607d8b")}"><img src="${esc(c.logo)}" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>${esc(c.simbolo||"CTA")}</span></span>`;}

function calcularSaldoDaMoeda(saldoInicial,codigo,movimentosConta){
  return movimentosConta
    .filter((movimento)=>movimento.moeda===codigo)
    .reduce((saldo,movimento)=>saldo+(movimento.tipo==="receita"?Number(movimento.valor||0):-Number(movimento.valor||0)),Number(saldoInicial||0));
}

async function carregarSaldosCompletos(conta){
  const base=`users/${usuarioAtual.uid}/contas/${conta.id}`;
  const [moedasSnap,movimentosSnap]=await Promise.all([
    getDocs(collection(db,base,"moedas")),
    getDocs(collection(db,base,"movimentacoes"))
  ]);
  const extras=moedasSnap.docs.map((d)=>({id:d.id,...d.data()}));
  const movs=movimentosSnap.docs.map((d)=>({id:d.id,...d.data()}));
  const principal={codigo:conta.moeda||"BRL",saldoInicial:Number(conta.saldoInicial||0),principal:true};
  const moedas=[principal,...extras.filter((m)=>m.codigo!==principal.codigo)];
  const saldos=moedas.map((m)=>({
    moeda:m.codigo,
    saldoInicial:calcularSaldoDaMoeda(m.saldoInicial,m.codigo,movs)
  }));
  const conversao=await convertAccountsToBRL(saldos);
  return {...conta,saldos,totalConvertidoBRL:conversao.total,conversionMeta:conversao};
}

async function atualizarTotaisELista(contas,sequence){
  if(!contas.length){saldoTotal.textContent=formatMoney(0,"BRL");exchangeStatus.textContent="Aguardando contas.";return;}
  exchangeStatus.textContent="Atualizando cotações e saldos...";
  try{
    const completas=await Promise.all(contas.map(carregarSaldosCompletos));
    if(sequence!==renderSequence)return;
    const totalGeral=completas.reduce((s,c)=>s+Number(c.totalConvertidoBRL||0),0);
    saldoTotal.textContent=formatMoney(totalGeral,"BRL");
    const datas=completas.map(c=>c.conversionMeta?.latestDate).filter(Boolean).sort();
    const indisponiveis=[...new Set(completas.flatMap(c=>c.conversionMeta?.unavailable||[]))];
    exchangeStatus.textContent=`Cotações de referência de ${datas.at(-1)||"data mais recente"}${indisponiveis.length?` · sem cotação: ${indisponiveis.join(", ")}`:""}`;
    lista.innerHTML=completas.map(c=>`<button type="button" class="account-item account-select ${contaSelecionada?.id===c.id?"selected":""}" data-id="${c.id}"><div class="account-main">${logo(c)}<div><strong>${esc(c.nome)}</strong><span>${esc(c.tipo)} · ${c.saldos.length} moeda${c.saldos.length>1?"s":""}</span></div></div><div class="account-value"><strong>${formatMoney(c.totalConvertidoBRL,"BRL")}</strong><small>Total convertido · abrir detalhes</small></div></button>`).join("");
  }catch(error){
    if(sequence!==renderSequence)return;
    const totalBRL=contas.filter(c=>(c.moeda||"BRL")==="BRL").reduce((s,c)=>s+Number(c.saldoInicial||0),0);
    saldoTotal.textContent=formatMoney(totalBRL,"BRL");
    exchangeStatus.textContent="Conversão indisponível; exibindo somente valores principais em BRL.";
    console.error(error);
  }
}

function renderContas(contas){
  contasAtuais=contas;
  const sequence=++renderSequence;
  if(!contas.length){lista.innerHTML='<div class="empty-state">Nenhuma conta cadastrada.</div>';fecharDetalhes();atualizarTotaisELista([],sequence);return;}
  lista.innerHTML=contas.map(c=>`<button type="button" class="account-item account-select ${contaSelecionada?.id===c.id?"selected":""}" data-id="${c.id}"><div class="account-main">${logo(c)}<div><strong>${esc(c.nome)}</strong><span>${esc(c.tipo)} · carregando saldos...</span></div></div><div class="account-value"><strong>${formatMoney(c.saldoInicial,c.moeda||"BRL")}</strong><small>Calculando total convertido...</small></div></button>`).join("");
  atualizarTotaisELista(contas,sequence);
}

function moedasDaConta(){const principal={codigo:contaSelecionada.moeda||"BRL",saldoInicial:Number(contaSelecionada.saldoInicial||0),principal:true};return [principal,...moedasExtras.filter(m=>m.codigo!==principal.codigo)];}
function saldoAtual(codigo){const base=moedasDaConta().find(m=>m.codigo===codigo)?.saldoInicial||0;return movimentos.filter(m=>m.moeda===codigo).reduce((s,m)=>s+(m.tipo==="receita"?Number(m.valor||0):-Number(m.valor||0)),base);}
function preencherSelect(select,codigos){select.innerHTML=codigos.map(c=>`<option value="${c}">${c}</option>`).join("");}

function renderDetalhes(){if(!contaSelecionada)return;detailsEmpty.classList.add("hidden");detailsContent.classList.remove("hidden");detailsIdentity.innerHTML=`<div class="account-main">${logo(contaSelecionada)}<div><h3>${esc(contaSelecionada.nome)}</h3><span>${esc(contaSelecionada.tipo)} · moeda principal ${esc(contaSelecionada.moeda||"BRL")}</span></div></div>`;
 const moedas=moedasDaConta();detailsBalances.innerHTML=`<div class="balance-grid">${moedas.map(m=>`<article><span>${m.codigo}${m.principal?" · principal":""}</span><strong>${formatMoney(saldoAtual(m.codigo),m.codigo)}</strong><small>Inicial: ${formatMoney(m.saldoInicial,m.codigo)}</small></article>`).join("")}</div>`;
 detailsHistory.innerHTML=movimentos.length?`<h4>Últimos ajustes</h4>${movimentos.slice(0,8).map(m=>`<div class="history-row"><span>${m.tipo==="receita"?"Receita":"Despesa"} · ${esc(m.descricao||"Ajuste de saldo")}</span><strong class="${m.tipo}">${m.tipo==="receita"?"+":"-"}${formatMoney(m.valor,m.moeda)}</strong></div>`).join("")}`:'<div class="empty-state compact">Nenhum ajuste registrado.</div>';
 detailsTipo.value=contaSelecionada.tipo||"Conta corrente";preencherSelect(detailsMoeda,[contaSelecionada.moeda||"BRL"]);setMoneyValue(detailsSaldoInicial,contaSelecionada.saldoInicial||0);
 const codigos=moedas.map(m=>m.codigo);preencherSelect(adjustmentCurrency,codigos);preencherSelect(adjustmentCurrencyMirror,codigos);atualizarResumoAjuste();}

function abrirDetalhes(id){contaSelecionada=contasAtuais.find(c=>c.id===id)||null;if(!contaSelecionada)return;renderContas(contasAtuais);if(pararMoedas)pararMoedas();if(pararMovimentos)pararMovimentos();pararMoedas=onSnapshot(collection(db,"users",usuarioAtual.uid,"contas",id,"moedas"),s=>{moedasExtras=s.docs.map(d=>({id:d.id,...d.data()}));renderDetalhes();renderContas(contasAtuais);});const q=query(collection(db,"users",usuarioAtual.uid,"contas",id,"movimentacoes"),orderBy("criadoEm","desc"));pararMovimentos=onSnapshot(q,s=>{movimentos=s.docs.map(d=>({id:d.id,...d.data()}));renderDetalhes();renderContas(contasAtuais);});renderDetalhes();}
function fecharDetalhes(){contaSelecionada=null;moedasExtras=[];movimentos=[];if(pararMoedas)pararMoedas();if(pararMovimentos)pararMovimentos();detailsContent.classList.add("hidden");detailsEmpty.classList.remove("hidden");if(contasAtuais.length)renderContas(contasAtuais);}
function atualizarResumoAjuste(){if(!contaSelecionada)return;const cod=adjustmentCurrency.value||contaSelecionada.moeda||"BRL";adjustmentCurrencyMirror.innerHTML=`<option value="${cod}">${cod}</option>`;const atual=saldoAtual(cod);adjustmentCalculated.textContent=`Saldo calculado: ${formatMoney(atual,cod)}. Informe abaixo o saldo real atual.`;setMoneyValue(adjustmentRealBalance,atual);}

bancoInput.addEventListener("change",()=>{const livre=bancoInput.value==="outro";nomeLivreGrupo.classList.toggle("hidden",!livre);nomeLivreInput.required=livre;if(!livre)nomeLivreInput.value="";});
lista.addEventListener("click",e=>{const b=e.target.closest(".account-select");if(b)abrirDetalhes(b.dataset.id);});
$("closeDetails").addEventListener("click",fecharDetalhes);
document.querySelectorAll(".details-tab").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".details-tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.querySelectorAll(".details-section").forEach(s=>s.classList.add("hidden"));$(`details${b.dataset.detailsTab[0].toUpperCase()+b.dataset.detailsTab.slice(1)}`).classList.remove("hidden");}));
adjustmentCurrency.addEventListener("change",atualizarResumoAjuste);
newCurrencyCode.addEventListener("change",()=>{newCurrencyMirror.innerHTML=`<option value="${newCurrencyCode.value}">${newCurrencyCode.value}</option>`;});newCurrencyCode.dispatchEvent(new Event("change"));

form.addEventListener("submit",async e=>{e.preventDefault();msg(mensagem);if(!usuarioAtual)return msg(mensagem,"Faça login para cadastrar uma conta.","error");const inst=instituicao(),saldoInicial=getMoneyValue(saldoInput),moeda=getMoneyCurrency(saldoInput);if(!inst)return msg(mensagem,"Selecione um banco ou a opção de nome livre.","error");if(!inst.nome)return msg(mensagem,"Informe o nome da conta.","error");if(!Number.isFinite(saldoInicial))return msg(mensagem,"Informe um saldo inicial válido.","error");try{await addDoc(collection(db,"users",usuarioAtual.uid,"contas"),{bancoId:inst.chave,nome:inst.nome,simbolo:inst.simbolo,cor:inst.cor,logo:inst.logo||"",segmento:inst.segmento,tipo:tipoInput.value,saldoInicial,moeda,ativa:true,criadoEm:serverTimestamp(),atualizadoEm:serverTimestamp()});form.reset();bancoInput.value="";setBankPickerValue("");nomeLivreGrupo.classList.add("hidden");resetMoneyField(saldoInput,"BRL");msg(mensagem,"Conta cadastrada com sucesso.","success");}catch(err){msg(mensagem,"Não foi possível cadastrar a conta.","error");console.error(err);}});

editForm.addEventListener("submit",async e=>{e.preventDefault();if(!contaSelecionada)return;const saldo=getMoneyValue(detailsSaldoInicial);if(!Number.isFinite(saldo))return;await updateDoc(doc(db,"users",usuarioAtual.uid,"contas",contaSelecionada.id),{tipo:detailsTipo.value,saldoInicial:saldo,atualizadoEm:serverTimestamp()});msg(mensagem,"Conta atualizada com sucesso.","success");});

adjustmentForm.addEventListener("submit",async e=>{e.preventDefault();msg(adjustmentMessage);if(!contaSelecionada)return;const moeda=adjustmentCurrency.value,real=getMoneyValue(adjustmentRealBalance),calculado=saldoAtual(moeda),dif=real-calculado;if(!Number.isFinite(real))return msg(adjustmentMessage,"Informe um saldo válido.","error");if(Math.abs(dif)<0.005)return msg(adjustmentMessage,"O saldo já está ajustado.","success");if(!adjustmentAutoMovement.checked)return msg(adjustmentMessage,"Para preservar o histórico, mantenha o registro automático marcado.","error");await addDoc(collection(db,"users",usuarioAtual.uid,"contas",contaSelecionada.id,"movimentacoes"),{tipo:dif>0?"receita":"despesa",categoria:"Ajuste de saldo",descricao:"Correção manual de saldo",valor:Math.abs(dif),moeda,automatico:true,criadoEm:serverTimestamp()});msg(adjustmentMessage,`${dif>0?"Receita":"Despesa"} de ajuste criada com sucesso.`,"success");});

addCurrencyForm.addEventListener("submit",async e=>{e.preventDefault();msg(currencyMessage);if(!contaSelecionada)return;const codigo=newCurrencyCode.value,saldo=getMoneyValue(newCurrencyBalance);if(codigo===(contaSelecionada.moeda||"BRL")||moedasExtras.some(m=>m.codigo===codigo))return msg(currencyMessage,"Essa moeda já existe na conta.","error");if(!Number.isFinite(saldo))return msg(currencyMessage,"Informe um saldo inicial válido.","error");await setDoc(doc(db,"users",usuarioAtual.uid,"contas",contaSelecionada.id,"moedas",codigo),{codigo,saldoInicial:saldo,criadoEm:serverTimestamp(),atualizadoEm:serverTimestamp()});resetMoneyField(newCurrencyBalance,codigo);msg(currencyMessage,"Moeda adicionada com sucesso.","success");});

onAuthStateChanged(auth,user=>{usuarioAtual=user;if(pararContas)pararContas();if(!user){renderContas([]);return;}const q=query(collection(db,"users",user.uid,"contas"),orderBy("criadoEm","desc"));pararContas=onSnapshot(q,s=>{const contas=s.docs.map(d=>({id:d.id,...d.data()}));renderContas(contas);if(contaSelecionada){const atual=contas.find(c=>c.id===contaSelecionada.id);if(atual){contaSelecionada=atual;renderDetalhes();}else fecharDetalhes();}},e=>{msg(mensagem,"Não foi possível carregar as contas.","error");console.error(e);});});