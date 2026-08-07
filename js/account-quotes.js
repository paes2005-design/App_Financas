import { getRateToBRL } from "./exchange.js";

const detailsBalances = document.getElementById("detailsBalances");
let refreshToken = 0;
let refreshTimer = null;

function currencyFromCard(card) {
  const label = card.querySelector("span")?.textContent?.trim() || "";
  return label.split("·")[0].trim().toUpperCase();
}

function parseDisplayedValue(card) {
  const text=card.querySelector("strong")?.textContent||"";
  const cleaned=text.replace(/[^0-9,.-]/g,"").replace(/\./g,"").replace(",",".");
  const value=Number(cleaned);
  return Number.isFinite(value)?value:0;
}

function formatRate(rate) {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(rate);
}

function formatBRL(value){
  return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(value);
}

async function renderQuotes() {
  if (!detailsBalances) return;
  const token = ++refreshToken;
  const cards = [...detailsBalances.querySelectorAll(".balance-grid article")];

  await Promise.all(cards.map(async (card) => {
    const currency = currencyFromCard(card);
    if (!currency) return;

    let convertedLine=card.querySelector(".currency-converted");
    if(!convertedLine){convertedLine=document.createElement("small");convertedLine.className="currency-converted";card.appendChild(convertedLine);}
    let quoteLine = card.querySelector(".currency-quote");
    if (!quoteLine) {quoteLine = document.createElement("small");quoteLine.className = "currency-quote";card.appendChild(quoteLine);}

    const balance=parseDisplayedValue(card);
    if (currency === "BRL") {
      convertedLine.textContent=`Saldo convertido: ${formatBRL(balance)}`;
      quoteLine.textContent = "Cotação usada: 1 BRL = R$ 1,00";
      return;
    }

    convertedLine.textContent="Calculando saldo convertido...";
    quoteLine.textContent = "Consultando cotação...";
    try {
      const quote = await getRateToBRL(currency);
      if (token !== refreshToken || !card.isConnected) return;
      const time = new Date().toLocaleTimeString("pt-BR", {hour:"2-digit",minute:"2-digit",second:"2-digit"});
      convertedLine.textContent=`Saldo convertido: ${formatBRL(balance*quote.rate)}`;
      quoteLine.textContent = `Cotação usada: 1 ${currency} = R$ ${formatRate(quote.rate)} · consulta às ${time}`;
    } catch (error) {
      if (token !== refreshToken || !card.isConnected) return;
      convertedLine.textContent="Conversão indisponível";
      quoteLine.textContent = "Cotação indisponível no momento";
      console.error(`Falha ao obter cotação de ${currency}:`, error);
    }
  }));
}

function scheduleQuoteRender() {clearTimeout(refreshTimer);refreshTimer = setTimeout(renderQuotes, 50);}
if (detailsBalances) {const observer = new MutationObserver(scheduleQuoteRender);observer.observe(detailsBalances, { childList: true, subtree: false });renderQuotes();}
