const LOCALE = "pt-BR";

export const MOEDAS = [
  ["BRL", "Real brasileiro (R$)"],
  ["USD", "Dólar americano (US$)"],
  ["EUR", "Euro (€)"],
  ["GBP", "Libra esterlina (£)"],
  ["JPY", "Iene japonês (¥)"],
  ["CHF", "Franco suíço (CHF)"],
  ["CAD", "Dólar canadense (C$)"],
  ["AUD", "Dólar australiano (A$)"],
  ["ARS", "Peso argentino (ARS)"],
  ["CLP", "Peso chileno (CLP)"],
  ["MXN", "Peso mexicano (MXN)"],
  ["CNY", "Yuan chinês (CNY)"],
  ["UYU", "Peso uruguaio (UYU)"],
  ["PYG", "Guarani paraguaio (PYG)"]
];

export function formatMoney(value, currency = "BRL") {
  return Number(value || 0).toLocaleString(LOCALE, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function parseMoney(value) {
  const text = String(value ?? "").trim().replace(/\s/g, "");
  if (!text) return 0;

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  let normalized = text.replace(/[^0-9,.-]/g, "");

  if (lastComma > lastDot) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    normalized = normalized.replace(/,/g, "");
  } else {
    normalized = normalized.replace(",", ".");
  }

  const number = Number(normalized);
  return Number.isFinite(number) ? number : NaN;
}

export function getMoneyValue(inputOrId) {
  const input = typeof inputOrId === "string" ? document.getElementById(inputOrId) : inputOrId;
  return parseMoney(input?.value);
}

export function getMoneyCurrency(inputOrId) {
  const input = typeof inputOrId === "string" ? document.getElementById(inputOrId) : inputOrId;
  return input?.closest("[data-money-field]")?.querySelector("[data-money-currency]")?.value || "BRL";
}

export function setMoneyValue(inputOrId, value) {
  const input = typeof inputOrId === "string" ? document.getElementById(inputOrId) : inputOrId;
  if (!input) return;
  input.value = Number(value || 0).toLocaleString(LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function resetMoneyField(inputOrId, currency = "BRL") {
  const input = typeof inputOrId === "string" ? document.getElementById(inputOrId) : inputOrId;
  if (!input) return;
  setMoneyValue(input, 0);
  const select = input.closest("[data-money-field]")?.querySelector("[data-money-currency]");
  if (select) select.value = currency;
}

function tokenize(expression) {
  const clean = expression.replace(/,/g, ".").replace(/×/g, "*").replace(/÷/g, "/").replace(/\s/g, "");
  if (!clean || !/^[0-9+\-*/().]+$/.test(clean)) throw new Error("Expressão inválida");
  return clean.match(/\d+(?:\.\d+)?|[()+\-*/]/g) || [];
}

function calculateExpression(expression) {
  const tokens = tokenize(expression);
  let index = 0;

  function parsePrimary() {
    const token = tokens[index++];
    if (token === "(") {
      const value = parseAddSubtract();
      if (tokens[index++] !== ")") throw new Error("Parênteses inválidos");
      return value;
    }
    if (token === "+") return parsePrimary();
    if (token === "-") return -parsePrimary();
    const value = Number(token);
    if (!Number.isFinite(value)) throw new Error("Número inválido");
    return value;
  }

  function parseMultiplyDivide() {
    let value = parsePrimary();
    while (tokens[index] === "*" || tokens[index] === "/") {
      const operator = tokens[index++];
      const right = parsePrimary();
      if (operator === "/" && right === 0) throw new Error("Divisão por zero");
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  }

  function parseAddSubtract() {
    let value = parseMultiplyDivide();
    while (tokens[index] === "+" || tokens[index] === "-") {
      const operator = tokens[index++];
      const right = parseMultiplyDivide();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  }

  const result = parseAddSubtract();
  if (index !== tokens.length || !Number.isFinite(result)) throw new Error("Expressão inválida");
  return result;
}

function calculatorMarkup() {
  const keys = ["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "-", "0", ",", "(", ")", "+"];
  return `
    <div class="money-calculator hidden" data-calculator-panel>
      <input class="calculator-display" data-calculator-display inputmode="decimal" aria-label="Expressão da calculadora">
      <div class="calculator-keys">
        ${keys.map((key) => `<button type="button" data-calc-key="${key}">${key}</button>`).join("")}
        <button type="button" data-calc-action="back">⌫</button>
        <button type="button" data-calc-action="clear">C</button>
        <button type="button" class="calc-equals" data-calc-action="equals">=</button>
      </div>
      <button type="button" class="primary calc-apply" data-calc-action="apply">Usar resultado</button>
      <p class="calculator-message" data-calculator-message></p>
    </div>`;
}

function initializeMoneyField(field) {
  if (field.dataset.moneyReady === "true") return;
  field.dataset.moneyReady = "true";

  const input = field.querySelector("[data-money-input]");
  const currency = field.querySelector("[data-money-currency]");
  const toggle = field.querySelector("[data-money-calculator]");
  if (!input || !currency || !toggle) return;

  if (!field.querySelector("[data-calculator-panel]")) field.insertAdjacentHTML("beforeend", calculatorMarkup());
  const panel = field.querySelector("[data-calculator-panel]");
  const display = field.querySelector("[data-calculator-display]");
  const message = field.querySelector("[data-calculator-message]");
  let lastResult = getMoneyValue(input) || 0;

  setMoneyValue(input, getMoneyValue(input) || 0);

  input.addEventListener("blur", () => {
    const value = getMoneyValue(input);
    if (Number.isFinite(value)) setMoneyValue(input, value);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && panel && !panel.classList.contains("hidden")) event.preventDefault();
  });

  toggle.addEventListener("click", () => {
    panel.classList.toggle("hidden");
    if (!panel.classList.contains("hidden")) {
      display.value = String(getMoneyValue(input) || 0).replace(".", ",");
      display.focus();
    }
  });

  field.querySelectorAll("[data-calc-key]").forEach((button) => {
    button.addEventListener("click", () => {
      display.value += button.dataset.calcKey;
      display.focus();
    });
  });

  field.querySelector('[data-calc-action="back"]').addEventListener("click", () => {
    display.value = display.value.slice(0, -1);
  });

  field.querySelector('[data-calc-action="clear"]').addEventListener("click", () => {
    display.value = "";
    message.textContent = "";
  });

  const calculate = () => {
    try {
      lastResult = calculateExpression(display.value);
      display.value = lastResult.toLocaleString(LOCALE, { maximumFractionDigits: 8 });
      message.textContent = `Resultado: ${formatMoney(lastResult, currency.value)}`;
      message.className = "calculator-message success";
      return true;
    } catch (error) {
      message.textContent = error.message;
      message.className = "calculator-message error";
      return false;
    }
  };

  field.querySelector('[data-calc-action="equals"]').addEventListener("click", calculate);
  field.querySelector('[data-calc-action="apply"]').addEventListener("click", () => {
    if (!calculate()) return;
    setMoneyValue(input, lastResult);
    panel.classList.add("hidden");
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });

  display.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      calculate();
    }
  });

  currency.addEventListener("change", () => {
    const value = getMoneyValue(input);
    if (Number.isFinite(value)) message.textContent = `Moeda selecionada: ${currency.options[currency.selectedIndex].text}`;
  });
}

export function initializeMoneyFields(root = document) {
  root.querySelectorAll("[data-money-field]").forEach(initializeMoneyField);
}

initializeMoneyFields();

new MutationObserver((mutations) => {
  mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
    if (!(node instanceof Element)) return;
    if (node.matches("[data-money-field]")) initializeMoneyField(node);
    initializeMoneyFields(node);
  }));
}).observe(document.body, { childList: true, subtree: true });
