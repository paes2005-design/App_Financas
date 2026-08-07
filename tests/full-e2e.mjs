import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const baseURL=process.env.APP_URL||'http://127.0.0.1:4173/';
const stamp=Date.now(),email=`e2e.full.${stamp}@example.com`,password='Teste123!',today=new Date().toISOString().slice(0,10);
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];
page.on('pageerror',e=>{errors.push(e.message);console.error('PAGEERROR',e.message)});
page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error('CONSOLE',m.text())}});
async function nav(id){await page.locator(`.nav-item[data-page="${id}"]`).click();await page.locator(`#${id}`).waitFor({state:'visible'});}
async function choose(sel,text){const o=page.locator(`${sel} option`,{hasText:text}).first();await o.waitFor();const v=await o.getAttribute('value');assert(v);await page.locator(sel).selectOption(v);}
async function freeAccount(name,balance){await page.evaluate(()=>{const h=document.querySelector('#contaBanco');h.value='outro';h.dispatchEvent(new Event('change',{bubbles:true}));});await page.locator('#contaNomeLivre').fill(name);await page.locator('#contaSaldoInicial').fill(`${balance},00`);await page.locator('#contaForm button[type=submit]').click();await page.locator('#contaMensagem').filter({hasText:/sucesso/i}).waitFor();}
try{
 await page.goto(baseURL,{waitUntil:'domcontentloaded',timeout:60000});
 await page.locator('#loginPage').waitFor({state:'visible',timeout:10000});
 await page.locator('#email').fill(email);await page.locator('#password').fill(password);await page.locator('#btnCadastrar').click();
 await page.locator('#appPage').waitFor({state:'visible',timeout:30000});
 console.log('AUTH_OK',email);

 await nav('contas'); await freeAccount('Conta Teste A',1000); await freeAccount('Conta Teste B',500);
 assert.equal(await page.locator('#listaContas .account-item').count(),2);console.log('CONTAS_OK');
 await page.reload({waitUntil:'domcontentloaded',timeout:30000});await page.locator('#appPage').waitFor({state:'visible',timeout:30000});

 await nav('categorias');await page.locator('#categoryOperation').selectOption('todos');await page.locator('#categoryName').fill('Categoria E2E');await page.locator('#categorySubcategories').fill('Sub A, Sub B');await page.locator('#categoryForm button[type=submit]').click();await page.locator('#categoryList').filter({hasText:'Categoria E2E'}).waitFor();console.log('CATEGORIAS_OK');

 await nav('receitas');await choose('#receitaConta','Conta Teste A');await choose('#receitaCategoria','Categoria E2E');await page.locator('#receitaSubcategoria').selectOption({label:'Sub A'});await page.locator('#receitaDescricao').fill('Receita prevista E2E');await page.locator('#receitaData').fill(today);await page.locator('#receitaValor').fill('100,00');if(await page.locator('[data-quick-settle="receita"]').isChecked())await page.locator('[data-quick-settle="receita"]').uncheck();await page.locator('#salvarReceita').click();await page.locator('#listaReceitas').filter({hasText:'Receita prevista E2E'}).waitFor();await page.locator('#listaReceitas .txn-more').first().waitFor();console.log('RECEITA_PREVISTA_OK');

 await nav('contas');await page.locator('#listaContas .account-item',{hasText:'Conta Teste A'}).click();await page.locator('#detailsBalances').waitFor({state:'visible'});let txt=(await page.locator('#detailsBalances').innerText()).replace(/\s+/g,' ');if(!/1\.000,00/.test(txt))throw new Error('Prevista alterou saldo: '+txt);console.log('PREVISTA_NAO_MOVIMENTA_OK');

 await nav('receitas');const rr=page.locator('#listaReceitas .transaction-item',{hasText:'Receita prevista E2E'});await rr.locator('.txn-more').click();await rr.locator('.settle-revenue').click();await page.locator('#settlementModal').waitFor();page.once('dialog',d=>d.accept());await page.locator('.settlement-confirm').click();await page.waitForTimeout(1200);console.log('EFETIVAR_RECEITA_OK');

 await nav('despesas');await choose('#despesaConta','Conta Teste A');await choose('#despesaCategoria','Categoria E2E');if(await page.locator('#despesaSubcategoria option',{hasText:'Sub A'}).count())await page.locator('#despesaSubcategoria').selectOption({label:'Sub A'});await page.locator('#despesaDescricao').fill('Despesa prevista E2E');await page.locator('#despesaData').fill(today);await page.locator('#despesaValor').fill('25,00');if(await page.locator('[data-quick-settle="despesa"]').isChecked())await page.locator('[data-quick-settle="despesa"]').uncheck();await page.locator('#salvarDespesa').click();await page.locator('#listaDespesas').filter({hasText:'Despesa prevista E2E'}).waitFor();await page.locator('#listaDespesas .txn-more').first().waitFor();console.log('DESPESA_OK');

 await choose('#despesaConta','Conta Teste A');await choose('#despesaCategoria','Categoria E2E');await page.locator('#despesaDescricao').fill('Despesa parcelada E2E');await page.locator('#despesaData').fill(today);await page.locator('#despesaValor').fill('300,00');await page.locator('#despesaRecorrencia').selectOption('parcelada');await page.locator('#despesaParcelas').fill('3');await page.locator('#despesaValorModo').selectOption('total');await page.locator('#salvarDespesa').click();await page.locator('#listaDespesas').filter({hasText:'Despesa parcelada E2E'}).waitFor();console.log('PARCELAMENTO_OK');

 await nav('transferencias');await choose('#transferOrigem','Conta Teste A');await choose('#transferDestino','Conta Teste B');await choose('#transferCategoria','Categoria E2E');await page.locator('#transferDescricao').fill('Transferência prevista E2E');await page.locator('#transferData').fill(today);await page.locator('#transferValor').fill('10,00');if(await page.locator('[data-quick-settle="transferencia"]').isChecked())await page.locator('[data-quick-settle="transferencia"]').uncheck();await page.locator('#transferSalvar').click();await page.locator('#listaTransferencias').filter({hasText:'Transferência prevista E2E'}).waitFor();await page.locator('#listaTransferencias .txn-more').first().waitFor();console.log('TRANSFERENCIA_OK');

 await nav('cartoes');await page.locator('#cardNome').fill('Cartão E2E');await choose('#cardConta','Conta Teste A');await page.waitForTimeout(500);await page.locator('#cardLimite').fill('1500,00');await page.locator('#cardFechamento').fill('10');await page.locator('#cardVencimento').fill('18');await page.locator('#cardSalvar').click();await page.locator('#listaCartoes').filter({hasText:'Cartão E2E'}).waitFor();console.log('CARTAO_OK');

 await nav('orcamentos');await page.locator('#budgetCategory').fill('Categoria E2E');await page.locator('#budgetMonth').fill(today.slice(0,7));await page.locator('#budgetValue').fill('300,00');await page.locator('#budgetForm button[type=submit]').click();await page.locator('#budgetList').filter({hasText:'Categoria E2E'}).waitFor();console.log('ORCAMENTO_OK');
 await nav('objetivos');await page.locator('#goalName').fill('Objetivo E2E');await page.locator('#goalValue').fill('2000,00');await page.locator('#goalForm button[type=submit]').click();await page.locator('#goalList').filter({hasText:'Objetivo E2E'}).waitFor();console.log('OBJETIVO_OK');

 for(const id of ['receitas','despesas','transferencias']){await nav(id);await page.locator(`#${id} .filter-launch`).click();await page.locator('.filter-modal:not(.hidden)').waitFor();await page.locator('.filter-modal:not(.hidden) .filter-close').click();}
 console.log('FILTROS_OK');
 await nav('relatorios');await page.locator('#reportIncome').waitFor();await nav('configuracoes');await page.locator('#mainCurrency').selectOption('BRL');await nav('dashboard');for(const s of ['#saldoTotal','#receitasMes','#despesasMes','#resultadoMes','#chart-cashChart','#chart-compareChart','#chart-categoryChart'])await page.locator(s).waitFor({state:'visible'});console.log('DASHBOARD_OK');

 if(errors.length)throw new Error('Erros de runtime/console: '+errors.join(' | '));
 console.log('E2E_FULL_OK',email);
}finally{await browser.close();}
