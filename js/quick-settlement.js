import { auth, db } from "./firebase.js";
import { getMoneyValue } from "./money.js";
import { addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

let user=null;
const pad=n=>String(n).padStart(2,"0");
function parts(data){const d=new Date(`${data}T12:00:00`),m=d.getMonth()+1;return{ano:d.getFullYear(),mes:m,trimestre:Math.ceil(m/3),semestre:m<=6?1:2,dataChave:data};}
function addMonths(data,n){const [y,m,d]=data.split("-").map(Number),base=new Date(y,m-1+n,1),last=new Date(base.getFullYear(),base.getMonth()+1,0).getDate();return `${base.getFullYear()}-${pad(base.getMonth()+1)}-${pad(Math.min(d,last))}`;}
function monthsBetween(start,end,max=600){const out=[];for(let i=0;i<max;i++){const d=addMonths(start,i);if(d>end)break;out.push(d);}return out;}
function value(id){return document.getElementById(id)?.value||"";}
function selected(id){return document.getElementById(id)?.selectedOptions?.[0]?.textContent?.trim()||"";}
function message(kind,text,type="success"){const id=kind==="receita"?"receitaMensagem":kind==="despesa"?"despesaMensagem":"transferMensagem",el=document.getElementById(id);if(el){el.textContent=text;el.className=`message ${type}`;}}

function payload(kind){
 const prefix=kind==="receita"?"receita":kind==="despesa"?"despesa":"transfer";
 const data=value(`${prefix}Data`),amount=getMoneyValue(document.getElementById(`${prefix}Valor`)),moeda=value(`${prefix}Moeda`),descricao=value(`${prefix}Descricao`).trim(),categoriaId=value(`${prefix}Categoria`),categoriaNome=selected(`${prefix}Categoria`),subcategoria=value(`${prefix}Subcategoria`),tipo=value(`${prefix}Recorrencia`)||"unica";
 if(!data||!amount||amount<=0||!moeda||!descricao||!categoriaId)throw new Error("Preencha todos os campos obrigatórios.");
 const base={categoriaId,categoriaNome,subcategoria,descricao,moeda};
 if(kind==="receita"||kind==="despesa"){
  base.contaId=value(`${prefix}Conta`);base.contaNome=selected(`${prefix}Conta`);if(!base.contaId)throw new Error("Selecione uma conta.");
 }else{
  base.origemId=value("transferOrigem");base.origemNome=selected("transferOrigem");base.destinoId=value("transferDestino");base.destinoNome=selected("transferDestino");if(!base.origemId||!base.destinoId||base.origemId===base.destinoId)throw new Error("Selecione contas diferentes.");
 }
 return{prefix,data,amount,tipo,base};
}

async function movements(kind,base,amount,data,meta={}){
 const common={categoriaId:base.categoriaId,categoriaNome:base.categoriaNome,subcategoria:base.subcategoria,descricao:base.descricao,valor:amount,moeda:base.moeda,data,...parts(data),competencia:data.slice(0,7),serieId:meta.serieId||null,recorrenciaTipo:meta.tipo||"unica",planejada:false,efetivada:true,dataEfetivacao:data,atualizadoEm:serverTimestamp()};
 if(kind==="receita"||kind==="despesa"){
  const ref=await addDoc(collection(db,"users",user.uid,"contas",base.contaId,"movimentacoes"),{...common,tipo:kind,origem:kind==="receita"?"receitas":"despesas",criadoEm:serverTimestamp()});return{movimentacaoId:ref.id};
 }
 const out=await addDoc(collection(db,"users",user.uid,"contas",base.origemId,"movimentacoes"),{...common,tipo:"despesa",origem:"transferencias",descricao:`Transferência: ${base.descricao}`,criadoEm:serverTimestamp()});
 const inn=await addDoc(collection(db,"users",user.uid,"contas",base.destinoId,"movimentacoes"),{...common,tipo:"receita",origem:"transferencias",descricao:`Transferência: ${base.descricao}`,criadoEm:serverTimestamp()});
 return{movSaida:out.id,movEntrada:inn.id};
}

async function occurrence(kind,base,data,amount,{effective=false,serieId=null,tipo="unica",parcelaNumero=null,parcelasTotal=null}={}){
 const ids=effective?await movements(kind,base,amount,data,{serieId,tipo}):{};
 const record={...base,valor:amount,data,...parts(data),serieId,recorrenciaTipo:tipo,competencia:data.slice(0,7),parcelaNumero,parcelasTotal,planejada:!effective,efetivada:effective,...(effective?{dataEfetivacao:data,valorEfetivado:amount}:{}),...ids,criadoEm:serverTimestamp(),atualizadoEm:serverTimestamp()};
 await addDoc(collection(db,"users",user.uid,kind==="receita"?"receitas":kind==="despesa"?"despesas":"transferencias"),record);
}

async function create(kind,d){
 if(d.tipo==="unica"){await occurrence(kind,d.base,d.data,d.amount,{effective:true});return;}
 let fim=null,qtd=null,parcela=d.amount,total=null;
 if(d.tipo==="periodo"){fim=value(`${d.prefix}Fim`);if(!fim||fim<d.data)throw new Error("Informe uma data final válida.");}
 if(d.tipo==="parcelada"){
  qtd=Math.max(2,Number(value(`${d.prefix}Parcelas`)||2));const modo=value(`${d.prefix}ValorModo`)||"total";parcela=modo==="total"?d.amount/qtd:d.amount;total=modo==="total"?d.amount:d.amount*qtd;fim=addMonths(d.data,qtd-1);
 }
 const serie=await addDoc(collection(db,"users",user.uid,"recorrencias"),{operacao:kind,tipoRecorrencia:d.tipo,inicio:d.data,fim,quantidade:qtd,valorParcela:parcela,valorTotal:total,base:d.base,excecoes:[],ativo:true,criadoEm:serverTimestamp(),atualizadoEm:serverTimestamp()});
 if(d.tipo==="fixa"){await occurrence(kind,d.base,d.data,d.amount,{effective:true,serieId:serie.id,tipo:d.tipo});return;}
 const dates=d.tipo==="parcelada"?Array.from({length:qtd},(_,i)=>addMonths(d.data,i)):monthsBetween(d.data,fim);
 for(let i=0;i<dates.length;i++)await occurrence(kind,d.base,dates[i],parcela,{effective:i===0,serieId:serie.id,tipo:d.tipo,parcelaNumero:d.tipo==="parcelada"?i+1:null,parcelasTotal:d.tipo==="parcelada"?qtd:null});
}

const configs=[{form:"receitaForm",kind:"receita",title:"receitaFormTitulo"},{form:"despesaForm",kind:"despesa",title:"despesaFormTitulo"},{form:"transferForm",kind:"transferencia",title:"transferFormTitle"}];
document.addEventListener("submit",async event=>{
 const cfg=configs.find(c=>event.target.id===c.form);if(!cfg||!user)return;
 const editing=/^Editar/i.test(document.getElementById(cfg.title)?.textContent||"");if(editing)return;
 const quick=event.target.querySelector(`[data-quick-settle="${cfg.kind}"]`)?.checked===true;if(!quick)return;
 event.preventDefault();event.stopImmediatePropagation();
 try{const d=payload(cfg.kind);await create(cfg.kind,d);event.target.reset();message(cfg.kind,"Operação salva e efetivada. Ocorrências futuras permanecem previstas.");}
 catch(error){console.error(error);message(cfg.kind,error.message||"Não foi possível salvar e efetivar.","error");}
},true);

onAuthStateChanged(auth,current=>{user=current;});
