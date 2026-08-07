export default [
  {
    files: ["js/**/*.js", "sw.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        window: "readonly", document: "readonly", navigator: "readonly", location: "readonly",
        localStorage: "readonly", sessionStorage: "readonly", history: "readonly",
        console: "readonly", fetch: "readonly", URL: "readonly", CustomEvent: "readonly",
        MutationObserver: "readonly", Element: "readonly", HTMLElement: "readonly", Node: "readonly",
        Event: "readonly", KeyboardEvent: "readonly", MouseEvent: "readonly",
        setTimeout: "readonly", clearTimeout: "readonly", setInterval: "readonly", clearInterval: "readonly",
        queueMicrotask: "readonly", confirm: "readonly", alert: "readonly",
        caches: "readonly", self: "readonly", Response: "readonly", Request: "readonly",
        Intl: "readonly", Date: "readonly", Map: "readonly", Set: "readonly", Promise: "readonly",
        Object: "readonly", Array: "readonly", Number: "readonly", String: "readonly", Boolean: "readonly",
        Math: "readonly", JSON: "readonly", RegExp: "readonly", Error: "readonly", NaN: "readonly",
        Infinity: "readonly", parseInt: "readonly", parseFloat: "readonly", structuredClone: "readonly"
      }
    },
    rules: {
      "no-undef": "error",
      "no-redeclare": "error",
      "no-unreachable": "error"
    }
  }
];
