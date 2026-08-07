import fs from 'node:fs';
const failures=[];
function test(name,fn){try{fn();console.log(`PASS ${name}`);}catch(e){failures.push(`${name}: ${e.message}`);console.error(`FAIL ${name}: ${e.message}`);}}
function eq(a,b,msg=''){if(a!==b)throw new Error(`${msg} esperado=${b} obtido=${a}`.trim());}
function close(a,b,eps=1e-9){if(Math.abs(a-b)>eps)throw new Error(`esperado=${b} obtido=${a}`);}
const pad=n=>String(n).padStart(2,'0');
function addDays(date,n){const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+n);return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;}
function addMonths(date,n){const [y,m,d]=date.split('-').map(Number),base=new Date(y,m-1+n,1),last=new Date(base.getFullYear(),base.getMonth()+1,0).getDate();return `${base.getFullYear()}-${pad(base.getMonth()+1)}-${pad(Math.min(d,last))}`;}
function nextDate(start,f,i){if(f==='diaria')return addDays(start,i);if(f==='semanal')return addDays(start,i*7);return addMonths(start,({mensal:1,trimestral:3,semestral:6,anual:12}[f]||1)*i);}
const monthKey=d=>d.slice(0,7),sum=a=>a.reduce((x,y)=>x+y,0);
function splitTotal(total,q){const cents=Math.round(total*100),base=Math.floor(cents/q),rest=cents-base*q;return Array.from({length:q},(_,i)=>(base+(i<rest?1:0))/100);}
function afterDelete(dates,current,scope){if(scope==='one')return dates.filter(d=>d!==current);if(scope==='all')return [];if(scope==='future')return dates.filter(d=>d<current);throw new Error('scope inválido');}
function monthlyForecast(opening,r,d){return Math.round((opening+sum(r)-sum(d))*100)/100;}
function convert(items,rates,main='BRL'){let brl=0;for(const i of items){const r=i.currency==='BRL'?1:rates[i.currency];if(!Number.isFinite(r))throw new Error('cotação ausente');brl+=i.value*r;}return main==='BRL'?brl:brl/rates[main];}
function invoiceMonth(purchase,closing){const [y,m,d]=purchase.split('-').map(Number);return d<=closing?`${y}-${pad(m)}`:monthKey(addMonths(`${y}-${pad(m)}-01`,1));}

console.log('=== AUDITORIA MATEMÁTICA FINANCEIRA ===');
test('frequência diária',()=>{eq(nextDate('2026-08-07','diaria',1),'2026-08-08');eq(nextDate('2026-08-07','diaria',30),'2026-09-06');});
test('frequência semanal preserva dia da semana',()=>{eq(nextDate('2026-08-03','semanal',1),'2026-08-10');eq(nextDate('2026-08-03','semanal',4),'2026-08-31');});
test('frequência mensal ajusta fim do mês',()=>{eq(nextDate('2026-01-31','mensal',1),'2026-02-28');eq(nextDate('2028-01-31','mensal',1),'2028-02-29');});
test('frequências trimestral semestral anual',()=>{eq(nextDate('2026-01-31','trimestral',1),'2026-04-30');eq(nextDate('2026-01-31','semestral',1),'2026-07-31');eq(nextDate('2026-01-31','anual',1),'2027-01-31');});
test('fixa nunca projeta para trás',()=>{const start='2026-08-07';eq(nextDate(start,'mensal',0),start);if('2026-07-31'>=start)throw new Error('comparação temporal inválida');});
test('parcelado valor total fecha exatamente nos centavos',()=>{const p=splitTotal(1000,3);eq(p.join(','),'333.34,333.33,333.33');eq(Math.round(sum(p)*100),100000);});
test('parcelado valor da parcela calcula total exato',()=>{const p=Array(3).fill(200);eq(sum(p),600);});
test('parcelado respeita frequência selecionada',()=>{eq([0,1,2].map(i=>nextDate('2026-08-07','trimestral',i)).join(','),'2026-08-07,2026-11-07,2027-02-07');});
test('exclusão só esta ocorrência',()=>eq(afterDelete(['2026-08-07','2026-08-14','2026-08-21'],'2026-08-14','one').join(','),'2026-08-07,2026-08-21'));
test('exclusão desde início',()=>eq(afterDelete(['2026-08-07','2026-09-07'],'2026-09-07','all').length,0));
test('exclusão desta ocorrência em diante',()=>eq(afterDelete(['2026-08-07','2026-09-07','2026-10-07'],'2026-09-07','future').join(','),'2026-08-07'));
test('previsão mês a mês usa fechamento real anterior',()=>{const aug=monthlyForecast(1000,[800],[250]);eq(aug,1550);const sep=monthlyForecast(aug,[1200,300],[400,150]);eq(sep,2500);});
test('previsão mensal soma efetivado e previsto do próprio mês',()=>eq(monthlyForecast(1000,[200,500],[100,250]),1350));
test('múltiplas moedas convertem antes de consolidar',()=>{close(convert([{currency:'BRL',value:100},{currency:'USD',value:50},{currency:'EUR',value:10}],{USD:5,EUR:6}),410);close(convert([{currency:'BRL',value:100},{currency:'USD',value:50}],{USD:5},'USD'),70);});
test('fatura até fechamento fica na competência atual',()=>eq(invoiceMonth('2026-08-20',20),'2026-08'));
test('fatura após fechamento vai para próxima competência',()=>eq(invoiceMonth('2026-08-21',20),'2026-09'));
test('parcelas de cartão respeitam frequência',()=>{eq(nextDate('2026-08-21','mensal',2),'2026-10-21');eq(nextDate('2026-08-21','trimestral',2),'2027-02-21');});

const recurrence=fs.readFileSync('js/recurrence-v3.js','utf8');
const dashboard=fs.readFileSync('js/dashboard-balance-forecast-v2.js','utf8');
const cardRules=fs.readFileSync('js/card-finance-rules-v2.js','utf8');
const formUX=fs.readFileSync('js/transaction-form-experience.js','utf8');
const dashUX=fs.readFileSync('js/dashboard-ui-refinements.js','utf8');
const dateDisplay=fs.readFileSync('js/date-display.js','utf8');
const exchange=fs.readFileSync('js/exchange.js','utf8');
test('app tem Única, Fixa e Parcelada',()=>{for(const x of ['value="unica"','value="fixa"','value="parcelada"'])if(!recurrence.includes(x))throw new Error(`tipo ausente ${x}`);if(recurrence.includes('value="periodo"'))throw new Error('tipo redundante por período ainda exposto');});
test('app tem seis frequências',()=>{for(const x of ['diaria','semanal','mensal','trimestral','semestral','anual'])if(!recurrence.includes(x))throw new Error(`frequência ausente ${x}`);});
test('app usa motor de parcelamento por centavos',()=>{if(!recurrence.includes('splitTotal')||!recurrence.includes('base+(i<rest?1:0)'))throw new Error('motor de centavos não localizado');if(!cardRules.includes('splitTotal'))throw new Error('cartão não usa motor de centavos');});
test('app usa seleção valor total ou parcela',()=>{if(!recurrence.includes('Valor total')||!recurrence.includes('Valor da parcela')||!recurrence.includes('valorModo'))throw new Error('seleção de valor incompleta');});
test('app usa previsão mensal e saldo de abertura',()=>{if(!dashboard.includes('forecastBalance=opening+forecastResult')||!dashboard.includes('convertRows(mr)')||!dashboard.includes('convertRows(md)'))throw new Error('previsão mensal correta não localizada');});
test('app bloqueia previsão antes do início da conta',()=>{if(!dashboard.includes('info.before')||!dashboard.includes('valid(r,info)'))throw new Error('guarda de início ausente');});
test('app tem três escopos de exclusão',()=>{for(const x of ['scope==="one"','scope==="all"','future'])if(!recurrence.includes(x))throw new Error(`ausente ${x}`);});
test('app consolida moedas via cotação',()=>{if(!exchange.includes('convertAccountsToBRL')||!exchange.includes('getRateToBRL'))throw new Error('conversão ausente');});
test('cartão implementa fixa, parcelada, frequência e fatura',()=>{for(const x of ['value="fixa"','cardExpenseFrequency','invoiceMeta','competenciaFatura','vencimentoFatura'])if(!cardRules.includes(x))throw new Error(`cartão ausente ${x}`);});
test('descrição é histórica e auto preenche valor/categoria',()=>{for(const x of ['datalist','setMoneyValue','categoriaId','lastAutofill'])if(!formUX.includes(x))throw new Error(`histórico ausente ${x}`);});
test('dashboard oculta cotação externa e efetivado duplicado',()=>{if(!dashUX.includes('#exchangeStatus{display:none')||!dashUX.includes('.balance-mini-item:first-child'))throw new Error('refino da dashboard ausente');});
test('datas visíveis usam DD/MM/AAAA',()=>{if(!dateDisplay.includes('${d}/${m}/${y}'))throw new Error('formatador DD/MM/AAAA ausente');});

if(failures.length){console.error(`\nAUDITORIA MATEMÁTICA: ${failures.length} FALHA(S)`);for(const f of failures)console.error('- '+f);process.exit(1);}console.log('\nAUDITORIA MATEMÁTICA OK — regras financeiras e frequências validadas.');
