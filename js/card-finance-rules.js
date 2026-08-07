import { auth, db } from "./firebase.js";
import { getMoneyValue, resetMoneyField } from "./money.js";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

let user=null;
const pad=n=>String(n).padStart(2,"0");
function addMonths(data,n){const [y,m,d]=data.split("-").map(Number),base=new Date(y,m-1+n,1),last=new Date(base.getFullYear(),base.getMonth()+1,0).getDate();return `${base.getFullYear()}-${pad(base.getMonth()+1)}-${pad(Math.min(d,last))}`;}
function parts(data){const d=new Date(`${data}T12:00:00`),m=d.getMonth()+1;return{ano:d.getFullYear(),mes:m,trimestre:Math.ceil(m/3),semestre:m<=6?1:2,dataChave:data};}
function splitTotal(total,q){const cents=Math.round(Number(total)*100),base=Math.floor(cents/q),rest=cents-base*q;return Array.from({length:q},(_,i)=>(base+(i<rest?1:0))/100);}
function invoiceMeta(purchase,closing,due){const [y,m,d]=purchase.split("-").map(Number),base=d<=closing?`${y}-${pad(m)}-01`:addMonths(`${y}-${pad(m)}-01`,1),[iy,im]=base.split('-').map(Number),dueBase=due>closing?new Date(iy,im-1,1):new Date(iy,im,1),last=new Date(dueBase.getFullYear(),dueBase.getMonth()+1,0).getDate(),dueDate=`${dueBase.getFullYear()}-${pad(dueBase.getMonth()+1)}-${pad(Math.min(Math.max(1,due),last))}`;return{competenciaFatura:`${iy}-${pad(im)}`,vencimentoFatura:dueDate};}
function selectedText(id){return document.getElementById(id)?.selectedOptions?.[0]?.textContent?.trim()||"";}
function msg(text,type="success"){const el=document.getElementById("cardExpenseMessage");if(el){el.textContent=text;el.className=`message ${type}`;}}

document.addEventListener("submit",async event=>{
  if(event.target?.id!=="cardExpenseForm"||!user)return;
  if(/^Editar/i.test(document.getElementById("cardExpenseTitle")?.textContent||""))return;
  event.preventDefault();event.stopImmediatePropagation();
  try{
    const cardId=document.getElementById("cardExpenseCard")?.value,catId=document.getElementById("cardExpenseCategory")?.value,descricao=document.getElementById("cardExpenseDescription")?.value.trim(),data=document.getElementById("cardExpenseDate")?.value,v=getMoneyValue(document.getElementById("cardExpenseValue")),type=document.getElementById("cardExpenseType")?.value||"unica";
    if(!cardId||!catId||!descricao||!data||!v||v<=0)throw new Error("Preencha todos os campos obrigatórios.");
    const cardSnap=await getDoc(doc(db,"users",user.uid,"cartoes",cardId));if(!cardSnap.exists())throw new Error("Cartão não encontrado.");
    const card={id:cardSnap.id,...cardSnap.data()},closing=Math.min(31,Math.max(1,Number(card.fechamento||31))),due=Math.min(31,Math.max(1,Number(card.vencimento||closing))),base={contaId:card.contaId,contaNome:card.contaNome,cartaoId:card.id,cartaoNome:card.nome,formaPagamento:"cartao",categoriaId:catId,categoriaNome:selectedText("cardExpenseCategory"),subcategoria:document.getElementById("cardExpenseSubcategory")?.value||"",descricao,moeda:card.moeda||"BRL",semMovimentoConta:true,planejada:false,efetivada:true,atualizadoEm:serverTimestamp()};
    if(type==="unica"){
      const inv=invoiceMeta(data,closing,due);await addDoc(collection(db,"users",user.uid,"despesas"),{...base,valor:Number(v.toFixed(2)),data,dataCompra:data,...parts(data),...inv,recorrenciaTipo:"unica",criadoEm:serverTimestamp()});
    }else{
      const q=Math.max(2,Number(document.getElementById("cardExpenseInstallments")?.value||2)),mode=document.getElementById("cardExpenseValueMode")?.value||"total",values=mode==="total"?splitTotal(v,q):Array(q).fill(Math.round(v*100)/100),total=Number(values.reduce((a,b)=>a+b,0).toFixed(2));
      const serie=await addDoc(collection(db,"users",user.uid,"recorrencias"),{operacao:"despesa",tipoRecorrencia:"parcelada",inicio:data,fim:addMonths(data,q-1),quantidade:q,valorParcela:values[0],valorTotal:total,base,ativo:true,excecoes:[],criadoEm:serverTimestamp(),atualizadoEm:serverTimestamp()});
      for(let i=0;i<q;i++){const dt=addMonths(data,i),inv=invoiceMeta(dt,closing,due);await addDoc(collection(db,"users",user.uid,"despesas"),{...base,valor:values[i],data:dt,dataCompra:data,...parts(dt),...inv,serieId:serie.id,recorrenciaTipo:"parcelada",competencia:dt.slice(0,7),parcelaNumero:i+1,parcelasTotal:q,criadoEm:serverTimestamp()});}
    }
    event.target.reset();resetMoneyField(document.getElementById("cardExpenseValue"),card.moeda||"BRL");document.getElementById("cardExpenseType").value="unica";document.getElementById("cardExpenseType").dispatchEvent(new Event("change"));msg("Despesa do cartão registrada com competência de fatura e parcelamento conferido nos centavos.");
  }catch(error){console.error(error);msg(error.message||"Não foi possível salvar a despesa do cartão.","error");}
},true);

onAuthStateChanged(auth,current=>{user=current;});
export { invoiceMeta, splitTotal };
