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

// ✅ Number pattern now supports:
// - Comma separator:  8,599.00  (western)
// - Space separator:  8 599.00  (adidas/european)
// - Indian format:    1,07,309
// - Plain:            8599.00
const numberPattern = `\\d+(?:[,\\s]\\d{2,3})*(?:\\.\\d+)?`;

const symbolRegexStr =
  `(?:Rs\\.?\\s?)${numberPattern}(?:\\s?(?:${multiplierWords}))?` +
  `|[$€£¥₹₩₽₺₦₫₱]\\s?${numberPattern}(?:\\s?(?:${multiplierWords}))?`;

const codeRegexStr =
  `\\b(?:${currencyList})\\s?${numberPattern}(?:\\s?(?:${multiplierWords}))?\\b` +
  `|\\b${numberPattern}(?:\\s?(?:${multiplierWords}))?\\s?(?:${currencyList})\\b`;

const combinedRegex = new RegExp(`${symbolRegexStr}|${codeRegexStr}`, "gi");

const bareNumberRegex = /^\s*[\d,\s]+(?:\.\d{1,2})?\s*$/;

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

/* ---------- Format number with commas ---------- */
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

/* ---------- Parse amount from matched string ---------- */
// Strips all non-numeric characters except decimal point
function parseAmount(str) {
  // Remove currency symbols, letters, commas, spaces
  return parseFloat(str.replace(/[^\d.]/g, ""));
}

/* ---------- Extract and convert a match ---------- */
function convertMatch(match) {
  let from = null;
  let amount = null;
  let multiplier = 1;

  const multiplierRegex = new RegExp(`(${multiplierWords})\\s*$`, "i");
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
    // Join remaining parts in case number has spaces (8 599)
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

  combinedRegex.lastIndex = 0;
  const match = combinedRegex.exec(fullText);
  combinedRegex.lastIndex = 0;

  if (!match) return;

  const hasCurrencyIndicator =
    /[$€£¥₹₩₽₺₦₫₱]/.test(match[0]) ||
    /^rs\.?/i.test(match[0]) ||
    new RegExp(`\\b(${currencyList})\\b`, "i").test(match[0]);

  if (!hasCurrencyIndicator) return;

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
  if (
    ["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT"].includes(
      parent.tagName,
    )
  )
    return;
  if (parent.querySelector(".cc-label")) return;

  const original = node.nodeValue;
  if (original.includes(`(${TARGET}`)) return;

  combinedRegex.lastIndex = 0;
  const newText = original.replace(combinedRegex, (match) => {
    const converted = convertMatch(match);
    if (!converted) return match;
    return `${match} (${TARGET} ${formatNumber(converted, TARGET)})`;
  });
  combinedRegex.lastIndex = 0;

  if (newText !== original) {
    isScanning = true;
    node.nodeValue = newText;
    isScanning = false;
  } else {
    processSplitNode(node);
  }
}

/* ---------- Scan a root element ---------- */
function scanPage(root) {
  if (!currentRates || !root) return;
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    null,
    false,
  );
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  nodes.forEach((n) => processNode(n));
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
  new MutationObserver((mutations) => {
    if (isScanning) return;
    for (let mutation of mutations) {
      for (let node of mutation.addedNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          processNode(node);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          scanPage(node);
        }
      }
    }
  }).observe(document.body, { childList: true, subtree: true });

  new MutationObserver((mutations) => {
    if (isScanning) return;
    for (let mutation of mutations) {
      const node = mutation.target;
      if (node.nodeValue && /[$€£¥₹₩₽₺₦₫₱\d]/.test(node.nodeValue)) {
        processNode(node);
      }
    }
  }).observe(document.body, { subtree: true, characterData: true });
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
