import { getRateToBRL } from "./exchange.js";

const detailsBalances = document.getElementById("detailsBalances");
let refreshToken = 0;
let refreshTimer = null;

function currencyFromCard(card) {
  const label = card.querySelector("span")?.textContent?.trim() || "";
  return label.split("·")[0].trim().toUpperCase();
}

function formatRate(rate) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(rate);
}

async function renderQuotes() {
  if (!detailsBalances) return;
  const token = ++refreshToken;
  const cards = [...detailsBalances.querySelectorAll(".balance-grid article")];

  await Promise.all(cards.map(async (card) => {
    const currency = currencyFromCard(card);
    if (!currency) return;

    let quoteLine = card.querySelector(".currency-quote");
    if (!quoteLine) {
      quoteLine = document.createElement("small");
      quoteLine.className = "currency-quote";
      card.appendChild(quoteLine);
    }

    if (currency === "BRL") {
      quoteLine.textContent = "Cotação usada: 1 BRL = R$ 1,00";
      return;
    }

    quoteLine.textContent = "Consultando cotação...";
    try {
      const quote = await getRateToBRL(currency);
      if (token !== refreshToken || !card.isConnected) return;
      const time = new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
      quoteLine.textContent = `Cotação usada: 1 ${currency} = R$ ${formatRate(quote.rate)} · consulta às ${time}`;
    } catch (error) {
      if (token !== refreshToken || !card.isConnected) return;
      quoteLine.textContent = "Cotação indisponível no momento";
      console.error(`Falha ao obter cotação de ${currency}:`, error);
    }
  }));
}

function scheduleQuoteRender() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(renderQuotes, 50);
}

if (detailsBalances) {
  const observer = new MutationObserver(scheduleQuoteRender);
  // Observa somente a troca do conteúdo principal. Alterações internas nas linhas
  // de cotação não podem disparar novamente o observador.
  observer.observe(detailsBalances, { childList: true, subtree: false });
  renderQuotes();
}
