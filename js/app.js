import "./ui.js";
import "./auth.js";
import "./money.js";
import { initBankPicker } from "./bank-picker.js";

function limparCacheDeCotacoes() {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith("app-financas-fx:"))
      .forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.warn("Não foi possível limpar o cache de cotações:", error);
  }
}

function acompanharHorarioDaCotacao() {
  const status = document.getElementById("exchangeStatus");
  if (!status) return;

  const adicionarHorario = () => {
    const texto = status.textContent.trim();
    const finalizouConsulta = texto.startsWith("Cotações de referência de") || texto.startsWith("Conversão indisponível");

    if (!finalizouConsulta || texto.includes("Consulta atualizada às")) return;

    const horario = new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });

    status.textContent = `${texto} · Consulta atualizada às ${horario}`;
  };

  new MutationObserver(adicionarHorario).observe(status, {
    childList: true,
    characterData: true,
    subtree: true
  });

  adicionarHorario();
}

limparCacheDeCotacoes();
initBankPicker();
acompanharHorarioDaCotacao();
await import("./contas.js");

if (!document.querySelector('link[href$="money.css"]')) {
  const moneyStyles = document.createElement("link");
  moneyStyles.rel = "stylesheet";
  moneyStyles.href = "./css/money.css";
  document.head.appendChild(moneyStyles);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./sw.js");
      console.info("Service Worker registrado.");
    } catch (error) {
      console.error("Falha ao registrar o Service Worker:", error);
    }
  });
}
