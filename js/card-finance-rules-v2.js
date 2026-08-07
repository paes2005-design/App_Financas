import { auth, db } from "./firebase.js";
import { getMoneyValue, resetMoneyField } from "./money.js";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { nextDate, splitTotal, FREQUENCIES } from "./recurrence-v3.js";

let user=null;
const pad=n=>String(n).padStart(2,"0");
function addMonths(data,n){const [y,m,d]=data.split("-").map(Number),base=new Date(y,m-1+n,1),last=new Date(base.getFullYear(),base.getMonth()+1,0).getDate();return `${base.getFullYear()}-${pad(base.getMonth()+1)}-${pad(Math.min(d,last))}`;}
function parts(data){const d=new Date(`${data}T12:00:00`),m=d.getMonth()+1;return{ano:d.getFullYear(),mes:m,trimestre:Math.ceil(m/3),semestre:m<=6?1:2,dataChave:data};}
function invoiceMeta(purchase,closing,due){const [y,m,d]=purchase.split("-").map(Number),base=d<=closing?`${y}-${pad(m)}-01`:addMonths(`${y}-${pad(m)}-01`,1),[iy,im]=base.split('-').map(Number),dueBase=due>closing?new Date(iy,im-1,1):new Date(iy,im,1),last=new Date(dueBase.getFullYear(),dueBase.getMonth()+1,0).getDate(),dueDate=`${dueBase.getFullYear()}-${pad(dueBase.getMonth()+1)}-${pad(Math.min(Math.max(1,due),last))}`;return{competenciaFatura:`${iy}-${pad(im)}`,vencimentoFatura:dueDate};}
const selectedText=id=>document.getElementById(id)?.selectedOptions?.[0]?.textContent?.trim()||"";
function msg(text,type="success"){const el=document.getElementById("cardExpenseMessage");if(el){el.textContent=text;el.className=`message ${type}`;}}

function ensureUI(){const type=document.getElementById("cardExpenseType");if(!type)return;if(![...type.options].some(o=>o.value==="fixa")){const o=document.createElement("option");o.value="fixa";o.textContent="Fixa";type.insertBefore(o,type.querySelector('option[value="parcelada"]'));}if(!document.getElementById("cardExpenseFrequencyBox")){const box=document.createElement("div");box.id="cardExpenseFrequencyBox";box.className="hidden";box.innerHTML=`<label for="cardExpenseFrequency">Frequência</label><select id="cardExpenseFrequency">${Object.entries(FREQUENCIES).map(([v,l])=>`<option value="${v}">${l}</option>`).join("")}</select>`;type.insertAdjacentElement("afterend",box);}const refresh=()=>{const recurring=type.value==="fixa"||type.value==="parcelada";document.getElementById("cardExpenseFrequencyBox")?.classList.toggle("hidden",!recurring);};if(!type.dataset.frequencyWired){type.dataset.frequencyWired="1";type.addEventListener("change",refresh);}refresh();}
setTimeout(ensureUI,0);new MutationObserver(ensureUI).observe(document.body,{childList:true,subtree:true});

async function createExpense(base,data,amount,card,extra={}){const inv=invoiceMeta(data,card.fechamentoDia,card.vencimentoDia);await addDoc(collection(db,"users",user.uid,"despesas"),{...base,valor:Number(Number(amount).toFixed(2)),data,dataCompra:extra.dataCompra||data,...parts(data),...inv,competencia:data.slice(0,7),planejada:Boolean(extra.planejada),efetivada:!extra.planejada,serieId:extra.serieId||null,recorrenciaTipo:extra.tipo||"unica",frequencia:extra.frequencia||null,parcelaNumero:extra.parcelaNumero||null,parcelasTotal:extra.parcelasTotal||null,criadoEm:serverTimestamp(),atualizadoEm:serverTimestamp()});}

document.addEventListener("submit",async event=>{
 if(event.target?.id!=="cardExpenseForm"||!user)return;
 if(/^Editar/i.test(document.getElementById("cardExpenseTitle")?.textContent||""))return;
 event.preventDefault();event.stopImmediatePropagation();ensureUI();
 try{
  const cardId=document.getElementById("cardExpenseCard")?.value,catId=document.getElementById("cardExpenseCategory")?.value,descricao=document.getElementById("cardExpenseDescription")?.value.trim(),data=document.getElementById("cardExpenseDate")?.value,v=getMoneyValue(document.getElementById("cardExpenseValue")),type=document.getElementById("cardExpenseType")?.value||"unica",frequency=document.getElementById("cardExpenseFrequency")?.value||"mensal";
  if(!cardId||!catId||!descricao||!data||!v||v<=0)throw new Error("Preencha todos os campos obrigatórios.");
  const snap=await getDoc(doc(db,"users",user.uid,"cartoes",cardId));if(!snap.exists())throw new Error("Cartão não encontrado.");
  const raw={id:snap.id,...snap.data()},card={...raw,fechamentoDia:Math.min(31,Math.max(1,Number(raw.fechamento||31))),vencimentoDia:Math.min(31,Math.max(1,Number(raw.vencimento||raw.fechamento||31)))},base={contaId:card.contaId,contaNome:card.contaNome,cartaoId:card.id,cartaoNome:card.nome,cartaoFechamento:card.fechamentoDia,cartaoVencimento:card.vencimentoDia,formaPagamento:"cartao",categoriaId:catId,categoriaNome:selectedText("cardExpenseCategory"),subcategoria:document.getElementById("cardExpenseSubcategory")?.value||"",descricao,moeda:card.moeda||"BRL",semMovimentoConta:true};
  if(type==="unica"){await createExpense(base,data,v,card);}
  else if(type==="fixa"){
   const serie=await addDoc(collection(db,"users",user.uid,"recorrencias"),{operacao:"cartaoDespesa",tipoRecorrencia:"fixa",frequencia:frequency,inicio:data,fim:null,quantidade:null,valorParcela:Number(v.toFixed(2)),valorTotal:null,base,ativo:true,excecoes:[],criadoEm:serverTimestamp(),atualizadoEm:serverTimestamp()});
   await createExpense(base,data,v,card,{serieId:serie.id,tipo:"fixa",frequencia:frequency,planejada:false});
  }else{
   const q=Math.max(2,Number(document.getElementById("cardExpenseInstallments")?.value||2)),mode=document.getElementById("cardExpenseValueMode")?.value||"total",values=mode==="total"?splitTotal(v,q):Array(q).fill(Math.round(v*100)/100),dates=Array.from({length:q},(_,i)=>nextDate(data,frequency,i)),total=Number(values.reduce((a,b)=>a+b,0).toFixed(2));
   const serie=await addDoc(collection(db,"users",user.uid,"recorrencias"),{operacao:"cartaoDespesa",tipoRecorrencia:"parcelada",frequencia:frequency,inicio:data,fim:dates.at(-1),quantidade:q,valorParcela:values[0],valorTotal:total,valorModo:mode,base,ativo:true,excecoes:[],criadoEm:serverTimestamp(),atualizadoEm:serverTimestamp()});
   for(let i=0;i<dates.length;i++)await createExpense(base,dates[i],values[i],card,{serieId:serie.id,tipo:"parcelada",frequencia:frequency,parcelaNumero:i+1,parcelasTotal:q,dataCompra:data,planejada:false});
  }
  event.target.reset();resetMoneyField(document.getElementById("cardExpenseValue"),card.moeda||"BRL");document.getElementById("cardExpenseType").value="unica";document.getElementById("cardExpenseType").dispatchEvent(new Event("change"));msg("Despesa do cartão registrada com recorrência e competência de fatura calculadas.");
 }catch(error){console.error(error);msg(error.message||"Não foi possível salvar a despesa do cartão.","error");}
},true);

onAuthStateChanged(auth,current=>{user=current;});
export { invoiceMeta };
