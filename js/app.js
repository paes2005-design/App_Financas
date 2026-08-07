import "./money.js";
import "./period.js";
import "./categorias.js";
import "./receitas.js";
import "./receitas-summary.js";
import "./despesas.js";
import "./transferencias.js";
import "./cartoes.js";
import "./account-form-sync.js";
import "./transaction-actions.js";
import "./planned-edit-guard.js";
import "./recurrence-v3.js";
import "./recurrence-period-bridge.js";
import "./planned-settlement.js";
import "./transaction-insights.js";
import "./card-expenses.js";
import "./card-finance-rules-v2.js";
import "./card-fixed-sync.js";
import "./transaction-form-experience.js";
import "./remaining-modules.js";
import "./period-views.js";
import "./dashboard.js";
import "./dashboard-currency-breakdown.js";
import "./dashboard-balance-forecast-v2.js";
import "./dashboard-balance-guard.js";
import "./dashboard-analytics.js";
import "./dashboard-ui-refinements.js";
import "./date-display.js";
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
