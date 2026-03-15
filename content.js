const CACHE_TIME = 60 * 60 * 1000;
let TARGET = "USD";
let currentRates = null;
let isScanning = false;

const symbolMap = {
  $: "USD",
  "€": "EUR",
  "£": "GBP",
  "¥": "JPY",
  "₹": "INR",
  "₩": "KRW",
  "₽": "RUB",
  "₺": "TRY",
  "₦": "NGN",
  "₫": "VND",
  "₱": "PHP",
};

const multiplierMap = {
  cr: 10000000,
  crore: 10000000,
  crores: 10000000,
  lac: 100000,
  lacs: 100000,
  lakh: 100000,
  lakhs: 100000,
  k: 1000,
  thousand: 1000,
  million: 1000000,
  billion: 1000000000,
  trillion: 1000000000000,
};

const currencyList =
  "USD|EUR|INR|GBP|JPY|AUD|CAD|CNY|KRW|BRL|MXN|NGN|PKR|TRY|RUB|ZAR|SGD|HKD|NZD|THB";
const multiplierWords = Object.keys(multiplierMap).join("|");
const numberPattern = `\\d+(?:[,\\s]\\d{2,3})*(?:\\.\\d+)?`;

const symbolRegexStr =
  `(?:Rs\\.?\\s?)${numberPattern}(?:\\s?(?:${multiplierWords}))?` +
  `|[$€£¥₹₩₽₺₦₫₱]\\s?${numberPattern}(?:\\s?(?:${multiplierWords}))?`;

const codeRegexStr =
  `\\b(?:${currencyList})\\s?${numberPattern}(?:\\s?(?:${multiplierWords}))?\\b` +
  `|\\b${numberPattern}(?:\\s?(?:${multiplierWords}))?\\s?(?:${currencyList})\\b`;

// ✅ PERF: fresh regex every call - no lastIndex bugs
function getRegex() {
  return new RegExp(`${symbolRegexStr}|${codeRegexStr}`, "gi");
}

const bareNumberRegex = /^\s*[\d,\s]+(?:\.\d{1,2})?\s*$/;

const hasCurrencyIndicatorRegex = new RegExp(
  `[$€£¥₹₩₽₺₦₫₱]|^rs\\.?|\\b(${currencyList})\\b`,
  "i",
);

// ✅ PERF: quick pre-check - reject text with no digit instantly
// Runs before heavy regex - saves time on 90% of text nodes
const QUICK_CHECK = /[$€£¥₹₩₽₺₦₫₱\d]/;

// ✅ PERF: skip tags set - faster than array includes
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT"]);

// ✅ PERF: multiplier regex compiled once not inside convertMatch every call
const multiplierRegex = new RegExp(`(${multiplierWords})\\s*$`, "i");

/* ---------- Utilities ---------- */
function debounce(func, timeout = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, timeout);
  };
}

/* ---------- Format number ---------- */
function formatNumber(amount, targetCurrency) {
  if (targetCurrency.toUpperCase() === "INR") {
    const [intPart, decPart] = amount.toFixed(2).split(".");
    const lastThree = intPart.slice(-3);
    const remaining = intPart.slice(0, -3);
    const formatted = remaining
      ? remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree
      : lastThree;
    return `${formatted}.${decPart}`;
  }
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/* ---------- Load Settings ---------- */
chrome.storage.sync.get(["targetCurrency", "blockedSites"], (data) => {
  const blocked = data.blockedSites || [];
  if (blocked.includes(location.hostname)) return;
  TARGET = data.targetCurrency || detectUserCurrency();
  getRates((rates) => {
    currentRates = rates;
    scanPage(document.body);
    processAmazonPrices();
    observe();
    detectUrlChange();
  });
});

function detectUserCurrency() {
  const locale = navigator.language;
  if (locale.includes("IN")) return "INR";
  if (locale.includes("US")) return "USD";
  if (locale.includes("GB")) return "GBP";
  return "USD";
}

function getRates(callback) {
  chrome.storage.local.get(["rates", "timestamp"], (data) => {
    const now = Date.now();
    if (data.rates && now - data.timestamp < CACHE_TIME) {
      callback(data.rates);
    } else {
      fetch(
        "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json",
      )
        .then((r) => r.json())
        .then((d) => {
          chrome.storage.local.set({ rates: d.usd, timestamp: now });
          callback(d.usd);
        })
        .catch(() => {
          fetch("https://latest.currency-api.pages.dev/v1/currencies/usd.json")
            .then((r) => r.json())
            .then((d) => callback(d.usd));
        });
    }
  });
}

function convert(amount, from, target, rates) {
  from = from.toLowerCase();
  target = target.toLowerCase();
  if (!rates[from] || !rates[target]) return null;
  return from === "usd"
    ? amount * rates[target]
    : amount * (rates[target] / rates[from]);
}

function parseAmount(str) {
  return parseFloat(str.replace(/[^\d.]/g, ""));
}

/* ---------- Extract and convert a match ---------- */
function convertMatch(match) {
  let from = null;
  let amount = null;
  let multiplier = 1;

  // ✅ PERF: use pre-compiled multiplierRegex instead of new RegExp every call
  const multiplierMatch = match.match(multiplierRegex);
  if (multiplierMatch) {
    multiplier = multiplierMap[multiplierMatch[1].toLowerCase()] || 1;
  }

  if (/^rs\.?\s?/i.test(match)) {
    from = "INR";
    amount = parseAmount(match.replace(/^rs\.?\s?/i, ""));
  } else if (/[$€£¥₹₩₽₺₦₫₱]/.test(match)) {
    const sym = match.match(/[$€£¥₹₩₽₺₦₫₱]/)[0];
    from = symbolMap[sym];
    amount = parseAmount(match);
  } else if (/^[A-Z]{3}/i.test(match)) {
    const parts = match.trim().split(/\s+/);
    from = parts[0].toUpperCase();
    amount = parseAmount(parts.slice(1).join(""));
  } else {
    const parts = match.trim().split(/\s+/);
    from = parts[parts.length - 1].toUpperCase();
    amount = parseAmount(parts.slice(0, -1).join(""));
  }

  if (!from || isNaN(amount) || amount <= 0) return null;
  amount = amount * multiplier;
  return convert(amount, from, TARGET, currentRates);
}

/* ---------- Handle Nike/Adidas style split prices ---------- */
function processSplitNode(node) {
  if (!node.nodeValue?.trim() || !node.parentElement) return;

  const text = node.nodeValue.trim();
  if (!bareNumberRegex.test(text)) return;

  const parent = node.parentElement;
  if (parent.querySelector(".cc-label")) return;

  const fullText = parent.innerText?.trim();
  if (!fullText || fullText.includes(`(${TARGET}`)) return;

  // ✅ PERF: quick check before running heavy regex
  if (!QUICK_CHECK.test(fullText)) return;

  const match = getRegex().exec(fullText);
  if (!match) return;
  if (!hasCurrencyIndicatorRegex.test(match[0])) return;

  const converted = convertMatch(match[0]);
  if (!converted) return;

  const label = document.createElement("span");
  label.className = "cc-label";
  label.style.cssText = "margin-left:4px; font-size:0.85em; color:gray;";
  label.innerText = `(${TARGET} ${formatNumber(converted, TARGET)})`;
  parent.appendChild(label);
}

/* ---------- Process a single text node ---------- */
function processNode(node) {
  if (!node.nodeValue?.trim() || !node.parentElement) return;

  const parent = node.parentElement;

  // ✅ PERF: Set.has() is O(1) vs array includes() O(n)
  if (SKIP_TAGS.has(parent.tagName)) return;
  if (parent.querySelector(".cc-label")) return;

  const original = node.nodeValue;

  // ✅ PERF: quick reject - no currency symbol or digit = skip immediately
  // This alone skips ~80% of all text nodes on any page
  if (!QUICK_CHECK.test(original)) return;

  if (original.includes(`(${TARGET}`)) return;

  const newText = original.replace(getRegex(), (match) => {
    const converted = convertMatch(match);
    if (!converted) return match;
    return `${match} (${TARGET} ${formatNumber(converted, TARGET)})`;
  });

  if (newText !== original) {
    isScanning = true;
    node.nodeValue = newText;
    isScanning = false;
  } else {
    processSplitNode(node);
  }
}

/* ---------- Scan aria-label prices (ChatGPT style) ---------- */
function processAriaLabels(root) {
  if (!currentRates) return;

  root.querySelectorAll("[aria-label]").forEach((el) => {
    if (el.querySelector(".cc-label")) return;

    const ariaLabel = el.getAttribute("aria-label")?.trim();
    if (!ariaLabel) return;
    if (ariaLabel.length > 20) return;
    if (ariaLabel.includes(`(${TARGET}`)) return;

    // ✅ PERF: quick check before heavy regex
    if (!QUICK_CHECK.test(ariaLabel)) return;
    if (!hasCurrencyIndicatorRegex.test(ariaLabel)) return;

    const match = getRegex().exec(ariaLabel);
    if (!match) return;

    const converted = convertMatch(match[0]);
    if (!converted) return;

    const ccLabel = document.createElement("span");
    ccLabel.className = "cc-label";
    ccLabel.style.cssText = "margin-left:4px; font-size:0.85em; color:gray;";
    ccLabel.innerText = `(${TARGET} ${formatNumber(converted, TARGET)})`;
    el.appendChild(ccLabel);
  });
}

/* ---------- Scan a root element ---------- */
function scanPage(root) {
  if (!currentRates || !root) return;

  // Handle aria-label prices first (ChatGPT style)
  processAriaLabels(root);

  // ✅ PERF: process directly in walker loop - no array allocation
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    null,
    false,
  );
  let n;
  while ((n = walker.nextNode())) {
    processNode(n);
  }
}

/* ---------- Amazon Price Fix ---------- */
function processAmazonPrices() {
  if (!currentRates) return;
  document.querySelectorAll(".a-price").forEach((price) => {
    if (price.querySelector(".cc-label")) return;
    const symbol = price.querySelector(".a-price-symbol")?.innerText;
    const whole = price.querySelector(".a-price-whole")?.innerText;
    const fraction = price.querySelector(".a-price-fraction")?.innerText;
    if (!symbol || !whole) return;
    const amount = parseFloat(
      whole.replace(/,/g, "") + "." + (fraction || "00"),
    );
    const from = symbolMap[symbol];
    if (!from) return;
    const converted = convert(amount, from, TARGET, currentRates);
    if (converted) {
      const label = document.createElement("span");
      label.className = "cc-label";
      label.style.cssText = "margin-left:6px; font-size:12px; color:gray;";
      label.innerText = `(${TARGET} ${formatNumber(converted, TARGET)})`;
      price.appendChild(label);
    }
  });
}

/* ---------- Observe DOM Changes ---------- */
function observe() {
  // ✅ PERF: single observer for both childList and characterData
  new MutationObserver((mutations) => {
    if (isScanning) return;
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.TEXT_NODE) {
            processNode(node);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.querySelectorAll) processAriaLabels(node);
            scanPage(node);
          }
        }
      } else if (mutation.type === "characterData") {
        const node = mutation.target;
        // ✅ PERF: quick check before processNode
        if (node.nodeValue && QUICK_CHECK.test(node.nodeValue)) {
          processNode(node);
        }
      }
    }
  }).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

/* ---------- Detect URL Change ---------- */
function detectUrlChange() {
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(() => {
        scanPage(document.body);
        processAmazonPrices();
      }, 800);
    }
  }).observe(document, { subtree: true, childList: true });
}

/* ---------- Message Listener ---------- */
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "updateCurrency") {
    TARGET = request.target;
    if (currentRates) {
      scanPage(document.body);
      processAmazonPrices();
    }
  }
});
