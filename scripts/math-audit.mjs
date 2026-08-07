import fs from 'node:fs';

const failures=[];
function test(name,fn){try{fn();console.log(`PASS ${name}`);}catch(e){failures.push(`${name}: ${e.message}`);console.error(`FAIL ${name}: ${e.message}`);}}
function eq(actual,expected,msg=''){if(actual!==expected)throw new Error(`${msg} esperado=${expected} obtido=${actual}`.trim());}
function close(actual,expected,eps=1e-9,msg=''){if(Math.abs(actual-expected)>eps)throw new Error(`${msg} esperado=${expected} obtido=${actual}`.trim());}
const pad=n=>String(n).padStart(2,'0');
function addMonths(date,n){const [y,m,d]=date.split('-').map(Number),base=new Date(y,m-1+n,1),last=new Date(base.getFullYear(),base.getMonth()+1,0).getDate();return `${base.getFullYear()}-${pad(base.getMonth()+1)}-${pad(Math.min(d,last))}`;}
function monthKey(d){return d.slice(0,7);}
function monthSeries(start,end){const out=[];for(let i=0;i<600;i++){const d=addMonths(start,i);if(d>end)break;out.push(d);}return out;}
function splitTotal(total,q){const cents=Math.round(total*100),base=Math.floor(cents/q),rest=cents-base*q;return Array.from({length:q},(_,i)=>(base+(i<rest?1:0))/100);}
function installmentPlan(value,q,mode){return mode==='total'?splitTotal(value,q):Array(q).fill(Math.round(value*100)/100);}
function sum(a){return a.reduce((x,y)=>x+y,0);}
function projectedFixed(start,selectedMonth,value,exceptions=[]){if(selectedMonth<monthKey(start)||exceptions.includes(selectedMonth))return 0;return value;}
function afterDelete(months,current,scope){if(scope==='one')return months.filter(m=>m!==current);if(scope==='all')return [];if(scope==='future')return months.filter(m=>m<current);throw new Error('scope inválido');}
function monthlyForecast(opening,revenues,expenses){return Math.round((opening+sum(revenues)-sum(expenses))*100)/100;}
function convert(items,rates,main='BRL'){let brl=0;for(const i of items){const r=i.currency==='BRL'?1:rates[i.currency];if(!Number.isFinite(r))throw new Error(`cotação ausente ${i.currency}`);brl+=i.value*r;}if(main==='BRL')return brl;const mainRate=rates[main];if(!Number.isFinite(mainRate)||mainRate===0)throw new Error(`cotação principal ausente ${main}`);return brl/mainRate;}
function invoiceMonth(purchase,closingDay){const [y,m,d]=purchase.split('-').map(Number);return d<=closingDay?`${y}-${pad(m)}`:monthKey(addMonths(`${y}-${pad(m)}-01`,1));}

console.log('=== AUDITORIA MATEMÁTICA FINANCEIRA ===');
test('fixa nunca projeta para trás',()=>{eq(projectedFixed('2026-08-07','2026-07',100),0);eq(projectedFixed('2026-08-07','2026-08',100),100);eq(projectedFixed('2026-08-07','2027-12',100),100);});
test('fixa respeita exceção de uma ocorrência',()=>{eq(projectedFixed('2026-08-07','2026-09',100,['2026-09']),0);eq(projectedFixed('2026-08-07','2026-10',100,['2026-09']),100);});
test('por período inclui início e fim por competência',()=>{const x=monthSeries('2026-08-31','2026-11-30');eq(x.length,4);eq(x[0],'2026-08-31');eq(x[1],'2026-09-30');eq(x[3],'2026-11-30');});
test('parcelado por valor total preserva centavos exatamente',()=>{const p=installmentPlan(1000,3,'total');eq(p.length,3);eq(Math.round(sum(p)*100),100000);eq(p[0],333.34);eq(p[1],333.33);eq(p[2],333.33);});
test('parcelado por valor da parcela calcula total',()=>{const p=installmentPlan(333.33,3,'parcela');eq(Math.round(sum(p)*100),99999);});
test('parcelamento preserva dia com ajuste de fim do mês',()=>{eq(addMonths('2026-01-31',1),'2026-02-28');eq(addMonths('2028-01-31',1),'2028-02-29');eq(addMonths('2026-08-31',1),'2026-09-30');});
test('exclusão só esta ocorrência',()=>{const m=['2026-08','2026-09','2026-10'];eq(afterDelete(m,'2026-09','one').join(','),'2026-08,2026-10');});
test('exclusão desde o início',()=>{eq(afterDelete(['2026-08','2026-09'],'2026-09','all').length,0);});
test('exclusão deste mês em diante',()=>{eq(afterDelete(['2026-08','2026-09','2026-10'],'2026-09','future').join(','),'2026-08');});
test('previsão mês a mês parte do fechamento real anterior',()=>{const augClose=monthlyForecast(1000,[800],[250]);eq(augClose,1550);const sepForecast=monthlyForecast(augClose,[1200,300],[400,150]);eq(sepForecast,2500);});
test('previsão mensal acumula efetivado + ainda previsto do próprio mês',()=>{eq(monthlyForecast(1000,[200,500],[100,250]),1350);});
test('múltiplas moedas convertem antes de consolidar',()=>{close(convert([{currency:'BRL',value:100},{currency:'USD',value:50},{currency:'EUR',value:10}],{USD:5,EUR:6}),410);close(convert([{currency:'BRL',value:100},{currency:'USD',value:50}],{USD:5},'USD'),70);});
test('fatura: compra até fechamento fica na competência atual',()=>eq(invoiceMonth('2026-08-20',20),'2026-08'));
test('fatura: compra após fechamento vai para a próxima competência',()=>eq(invoiceMonth('2026-08-21',20),'2026-09'));
test('fatura parcelada avança uma competência por parcela',()=>{const first=invoiceMonth('2026-08-21',20);eq(first,'2026-09');eq(monthKey(addMonths(`${first}-01`,1)),'2026-10');eq(monthKey(addMonths(`${first}-01`,2)),'2026-11');});

const recurrence=fs.readFileSync('js/recurrence.js','utf8');
const dashboard=fs.readFileSync('js/dashboard-balance-forecast.js','utf8');
const cards=fs.readFileSync('js/card-expenses.js','utf8');
const exchange=fs.readFileSync('js/exchange.js','utf8');
test('contrato do app: recorrência tem fixa/parcelada/período e três escopos de exclusão',()=>{for(const s of ['fixa','parcelada','periodo','scope==="one"','scope==="all"','future'])if(!recurrence.includes(s))throw new Error(`ausente ${s}`);});
test('contrato do app: múltiplas moedas usam conversão consolidada',()=>{if(!exchange.includes('convertAccountsToBRL')||!exchange.includes('rate'))throw new Error('conversor não localizado');});
test('contrato do app: previsão bloqueia meses anteriores ao início da conta',()=>{if(!dashboard.includes('beforeStart')||!dashboard.includes('validFromAccountStart'))throw new Error('guarda de início não localizada');});
test('contrato do app: cartão possui parcelamento',()=>{if(!cards.includes('cardExpenseInstallments')||!cards.includes('parcelada'))throw new Error('parcelamento de cartão não localizado');});

// Alertas de coerência: estes pontos precisam refletir as regras matemáticas acima.
test('implementação: parcelamento não deve gerar fração de centavo',()=>{if(/d\.valor\s*\/\s*d\.qtd/.test(recurrence))throw new Error('recurrence.js divide valor total diretamente e pode gerar fração de centavo');if(/v\s*\/\s*q/.test(cards))throw new Error('card-expenses.js divide valor total diretamente e pode gerar fração de centavo');});
test('implementação: previsão do saldo deve usar saldo inicial do mês + previsão do próprio mês',()=>{if(dashboard.includes('forecastBalance=startInfo.initial+forecastResult'))throw new Error('dashboard usa saldo inicial original + previsão acumulada, não o fechamento real anterior + previsão do mês');});
test('implementação: fatura de cartão deve ter competência por fechamento/vencimento',()=>{if(!/fatura|fechamento.*despesa|competenciaFatura/i.test(cards))throw new Error('card-expenses.js ainda não possui lógica de competência de fatura');});

if(failures.length){console.error(`\nAUDITORIA MATEMÁTICA: ${failures.length} FALHA(S)`);for(const f of failures)console.error('- '+f);process.exit(1);}console.log('\nAUDITORIA MATEMÁTICA OK — todas as regras validadas.');
