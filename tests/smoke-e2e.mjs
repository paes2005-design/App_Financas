import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const baseURL = process.env.APP_URL || 'http://127.0.0.1:4173/';
const stamp = Date.now();
const email = `e2e.${stamp}@example.com`;
const password = 'Teste123!';
const today = new Date().toISOString().slice(0,10);

const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];
page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));
page.on('console',m=>{ if(m.type()==='error') errors.push(`console: ${m.text()}`); });

async function nav(name){
  await page.locator(`.nav-item[data-page="${name}"]`).click();
  await page.locator(`#${name}`).waitFor({state:'visible'});
}
async function waitText(selector,rx){ await page.locator(selector).filter({hasText:rx}).waitFor({state:'visible'}); }
async function setBankFree(name,balance){
  await page.evaluate(()=>{
    const h=document.getElementById('contaBanco');
    h.value='outro';h.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await page.locator('#contaNomeLivre').fill(name);
  await page.locator('#contaSaldoInicial').fill(String(balance).replace('.',','));
  await page.locator('#contaForm button[type="submit"]').click();
  await page.locator('#contaMensagem').filter({hasText:/sucesso/i}).waitFor({state:'visible'});
}
async function chooseByText(selector,text){
  const opt=page.locator(`${selector} option`,{hasText:text}).first();
  const value=await opt.getAttribute('value');
  assert(value,`Opção ${text} não encontrada em ${selector}`);
  await page.locator(selector).selectOption(value);
}

try{
  await page.goto(baseURL,{waitUntil:'networkidle',timeout:60000});
  await page.locator('#loginPage').waitFor({state:'visible'});
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('#btnCadastrar').click();
  await page.locator('#appPage').waitFor({state:'visible',timeout:30000});
  assert.equal(await page.locator('#userEmail').textContent(),email);

  // Contas
  await nav('contas');
  await setBankFree('Conta Teste A',1000);
  await setBankFree('Conta Teste B',500);
  await page.locator('#listaContas .account-item').first().waitFor();
  assert.equal(await page.locator('#listaContas .account-item').count(),2);

  // Categorias
  await nav('categorias');
  await page.locator('#categoryOperation').selectOption('todos');
  await page.locator('#categoryName').fill('Categoria E2E');
  await page.locator('#categorySubcategories').fill('Sub A, Sub B');
  await page.locator('#categoryForm button[type="submit"]').click();
  await page.locator('#categoryList').filter({hasText:'Categoria E2E'}).waitFor();

  // Receita prevista: não deve alterar saldo bancário antes de efetivar.
  await nav('receitas');
  await chooseByText('#receitaConta','Conta Teste A');
  await chooseByText('#receitaCategoria','Categoria E2E');
  await page.locator('#receitaSubcategoria').selectOption({label:'Sub A'});
  await page.locator('#receitaDescricao').fill('Receita prevista E2E');
  await page.locator('#receitaData').fill(today);
  await page.locator('#receitaValor').fill('100,00');
  const quickR=page.locator('[data-quick-settle="receita"]');
  if(await quickR.isChecked()) await quickR.uncheck();
  await page.locator('#salvarReceita').click();
  await page.locator('#listaReceitas').filter({hasText:'Receita prevista E2E'}).waitFor();
  await page.locator('#listaReceitas .txn-more').first().waitFor();

  await nav('contas');
  const contaA=page.locator('#listaContas .account-item',{hasText:'Conta Teste A'});
  await contaA.click();
  await page.locator('#detailsBalances').waitFor({state:'visible'});
  const detailsText=(await page.locator('#detailsBalances').innerText()).replace(/\s+/g,' ');
  if(!/1\.000,00/.test(detailsText)) throw new Error(`Receita prevista alterou o saldo antes da efetivação: ${detailsText}`);

  // Efetiva via menu de três pontos.
  await nav('receitas');
  const revenueRow=page.locator('#listaReceitas .transaction-item',{hasText:'Receita prevista E2E'});
  await revenueRow.locator('.txn-more').click();
  await revenueRow.locator('.txn-menu .settle-revenue').click();
  await page.locator('#settlementModal').waitFor({state:'visible'});
  await page.locator('#settlementDate').fill(today);
  await page.locator('#settlementValue').fill('100,00');
  page.once('dialog',d=>d.accept());
  await page.locator('.settlement-confirm').click();
  await page.waitForTimeout(700);

  // Despesa prevista
  await nav('despesas');
  await chooseByText('#despesaConta','Conta Teste A');
  await chooseByText('#despesaCategoria','Categoria E2E');
  if(await page.locator('#despesaSubcategoria option',{hasText:'Sub A'}).count()) await page.locator('#despesaSubcategoria').selectOption({label:'Sub A'});
  await page.locator('#despesaDescricao').fill('Despesa prevista E2E');
  await page.locator('#despesaData').fill(today);
  await page.locator('#despesaValor').fill('25,00');
  const quickD=page.locator('[data-quick-settle="despesa"]');
  if(await quickD.isChecked()) await quickD.uncheck();
  await page.locator('#salvarDespesa').click();
  await page.locator('#listaDespesas').filter({hasText:'Despesa prevista E2E'}).waitFor();
  await page.locator('#listaDespesas .txn-more').first().waitFor();

  // Transferência prevista
  await nav('transferencias');
  await chooseByText('#transferOrigem','Conta Teste A');
  await chooseByText('#transferDestino','Conta Teste B');
  await chooseByText('#transferCategoria','Categoria E2E');
  await page.locator('#transferDescricao').fill('Transferência prevista E2E');
  await page.locator('#transferData').fill(today);
  await page.locator('#transferValor').fill('10,00');
  const quickT=page.locator('[data-quick-settle="transferencia"]');
  if(await quickT.isChecked()) await quickT.uncheck();
  await page.locator('#transferSalvar').click();
  await page.locator('#listaTransferencias').filter({hasText:'Transferência prevista E2E'}).waitFor();
  await page.locator('#listaTransferencias .txn-more').first().waitFor();

  // Cartão
  await nav('cartoes');
  await page.locator('#cardNome').fill('Cartão E2E');
  await chooseByText('#cardConta','Conta Teste A');
  await page.waitForTimeout(200);
  await page.locator('#cardLimite').fill('1500,00');
  await page.locator('#cardFechamento').fill('10');
  await page.locator('#cardVencimento').fill('18');
  await page.locator('#cardSalvar').click();
  await page.locator('#listaCartoes').filter({hasText:'Cartão E2E'}).waitFor();

  // Orçamento e objetivo
  await nav('orcamentos');
  await page.locator('#budgetCategory').fill('Categoria E2E');
  await page.locator('#budgetMonth').fill(today.slice(0,7));
  await page.locator('#budgetValue').fill('300,00');
  await page.locator('#budgetForm button[type="submit"]').click();
  await page.locator('#budgetList').filter({hasText:'Categoria E2E'}).waitFor();

  await nav('objetivos');
  await page.locator('#goalName').fill('Objetivo E2E');
  await page.locator('#goalValue').fill('2000,00');
  await page.locator('#goalForm button[type="submit"]').click();
  await page.locator('#goalList').filter({hasText:'Objetivo E2E'}).waitFor();

  // Filtros, relatórios, configurações, dashboard e gráficos.
  await nav('receitas');
  await page.locator('#receitas .filter-launch').click();
  await page.locator('.filter-modal:not(.hidden)').waitFor({state:'visible'});
  await page.locator('.filter-modal:not(.hidden) .filter-close').click();
  await nav('relatorios');
  await page.locator('#reportIncome').waitFor({state:'visible'});
  await nav('configuracoes');
  await page.locator('#mainCurrency').selectOption('BRL');
  await nav('dashboard');
  await page.locator('#saldoTotal').waitFor({state:'visible'});
  await page.locator('#chart-cashChart').waitFor({state:'visible'});
  await page.locator('#chart-compareChart').waitFor({state:'visible'});
  await page.locator('#chart-categoryChart').waitFor({state:'visible'});

  if(errors.length) throw new Error(`Erros de console/runtime:\n${errors.join('\n')}`);
  console.log(`E2E_OK account=${email}`);
} finally {
  await browser.close();
}
