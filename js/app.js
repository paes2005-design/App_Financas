import "./money.js";
import "./period.js";
import "./categorias.js";
import "./receitas.js";
import "./receitas-summary.js";
import "./despesas.js";
import "./transferencias.js";
import "./cartoes.js";
import "./period-views.js";
import "./dashboard.js";
import "./dashboard-analytics.js";
import "./filter-modal.js";
import "./privacy-eye.js";
import "./ui.js";
import "./auth.js";
import { initBankPicker } from "./bank-picker.js";
import "./contas.js";
import "./account-quotes.js";

initBankPicker();

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
