/* ---------- Currency to Country Code Map ---------- */
const CURRENCY_COUNTRY = {
  USD: "us",
  EUR: "eu",
  GBP: "gb",
  INR: "in",
  JPY: "jp",
  AUD: "au",
  CAD: "ca",
  CNY: "cn",
  AED: "ae",
  SGD: "sg",
  CHF: "ch",
  SAR: "sa",
  HKD: "hk",
  NZD: "nz",
  MYR: "my",
  PKR: "pk",
  BDT: "bd",
  ZAR: "za",
  RUB: "ru",
  BRL: "br",
  KRW: "kr",
  THB: "th",
  IDR: "id",
  TRY: "tr",
  MXN: "mx",
  SEK: "se",
  NOK: "no",
  DKK: "dk",
  PLN: "pl",
  CZK: "cz",
  HUF: "hu",
  ILS: "il",
  PHP: "ph",
  VND: "vn",
  NGN: "ng",
  EGP: "eg",
  KWD: "kw",
  QAR: "qa",
  OMR: "om",
  BHD: "bh",
  LKR: "lk",
  NPR: "np",
  MMK: "mm",
  KZT: "kz",
  UAH: "ua",
  RON: "ro",
  BGN: "bg",
  MAD: "ma",
  TND: "tn",
  GHS: "gh",
  KES: "ke",
  TZS: "tz",
  UGX: "ug",
  CLP: "cl",
  COP: "co",
  PEN: "pe",
  ARS: "ar",
  UYU: "uy",
  TWD: "tw",
  DZD: "dz",
  IQD: "iq",
  JOD: "jo",
  LBP: "lb",
  MKD: "mk",
  RSD: "rs",
};

function getFlagImg(code, size = "16x12") {
  const country = CURRENCY_COUNTRY[code?.toUpperCase()];
  if (!country) return "";
  return `<img 
    src="https://flagcdn.com/${size}/${country}.png" 
    width="${size === "16x12" ? 16 : 20}" 
    height="${size === "16x12" ? 12 : 15}"
    style="vertical-align:middle; border-radius:2px; margin-right:4px;"
    onerror="this.style.display='none'" />`;
}

/* ---------- Popular Fiat Currencies ---------- */
const POPULAR_FIATS = [
  { code: "USD", name: "US Dollar" },
  { code: "INR", name: "Indian Rupee" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "AED", name: "UAE Dirham" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "SAR", name: "Saudi Riyal" },
  { code: "HKD", name: "Hong Kong Dollar" },
  { code: "NZD", name: "New Zealand Dollar" },
  { code: "MYR", name: "Malaysian Ringgit" },
  { code: "PKR", name: "Pakistani Rupee" },
  { code: "BDT", name: "Bangladeshi Taka" },
  { code: "ZAR", name: "South African Rand" },
  { code: "RUB", name: "Russian Ruble" },
  { code: "BRL", name: "Brazilian Real" },
  { code: "KRW", name: "South Korean Won" },
  { code: "MXN", name: "Mexican Peso" },
  { code: "IDR", name: "Indonesian Rupiah" },
  { code: "TRY", name: "Turkish Lira" },
  { code: "THB", name: "Thai Baht" },
];

const POPULAR_CODES = POPULAR_FIATS.map((c) => c.code);

/* ---------- Crypto List ---------- */
const CRYPTO_LIST = [
  { code: "BTC", name: "Bitcoin", icon: "₿", id: "bitcoin" },
  { code: "ETH", name: "Ethereum", icon: "Ξ", id: "ethereum" },
  { code: "USDT", name: "Tether", icon: "₮", id: "tether" },
  { code: "BNB", name: "BNB", icon: "◈", id: "binancecoin" },
  { code: "SOL", name: "Solana", icon: "◎", id: "solana" },
  { code: "XRP", name: "XRP", icon: "✕", id: "ripple" },
  { code: "USDC", name: "USD Coin", icon: "◉", id: "usd-coin" },
  { code: "ADA", name: "Cardano", icon: "₳", id: "cardano" },
  { code: "DOGE", name: "Dogecoin", icon: "Ð", id: "dogecoin" },
  { code: "TRX", name: "TRON", icon: "◈", id: "tron" },
];

/* ---------- State ---------- */
let allFiats = [];
let selectedCurrency = "USD";
let selectedFrom = "USD";
let selectedTo = "INR";
let selectedCryptoFrom = "BTC";
let selectedCryptoTo = "USD";

/* ---------- Dropdown Builder ---------- */
// Creates a fully working searchable dropdown
// Works for both fiat (with flags) and crypto (with icons)
function createDropdown({
  optionsEl,
  searchEl,
  selectedEl,
  items,
  defaultCode,
  onSelect,
  isCrypto,
}) {
  // Render the selected button display
  function renderSelected(code) {
    const item = items.find((c) => c.code === code);
    if (!item) return;
    if (isCrypto) {
      selectedEl.innerHTML = `
        <span style="display:flex;align-items:center;gap:5px;">
          <span style="font-size:13px;min-width:16px;text-align:center;">${item.icon}</span>
          <b>${item.code}</b>
        </span>`;
    } else {
      selectedEl.innerHTML = `
        <span style="display:flex;align-items:center;">
          ${getFlagImg(item.code)}
          <b>${item.code}</b>
        </span>`;
    }
  }

  // Render the dropdown list items
  function renderList(query = "") {
    optionsEl.innerHTML = "";
    const q = query.toLowerCase().trim();

    if (isCrypto) {
      // Crypto: simple filtered list
      const filtered = items.filter(
        (c) =>
          c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q),
      );
      filtered.forEach((item) => optionsEl.appendChild(makeItem(item)));
      return;
    }

    // Fiat: Popular group first, then All Currencies
    const popular = items.filter(
      (c) =>
        POPULAR_CODES.includes(c.code) &&
        (c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)),
    );
    const others = items.filter(
      (c) =>
        !POPULAR_CODES.includes(c.code) &&
        (c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)),
    );

    if (popular.length > 0) {
      if (!q) {
        const lbl = document.createElement("div");
        lbl.className = "dropdown-group-label";
        lbl.textContent = "⭐ Popular";
        optionsEl.appendChild(lbl);
      }
      popular.forEach((item) => optionsEl.appendChild(makeItem(item)));
    }

    if (others.length > 0) {
      if (!q) {
        const lbl = document.createElement("div");
        lbl.className = "dropdown-group-label";
        lbl.textContent = "All Currencies";
        optionsEl.appendChild(lbl);
      }
      others.forEach((item) => optionsEl.appendChild(makeItem(item)));
    }

    if (popular.length === 0 && others.length === 0) {
      const empty = document.createElement("div");
      empty.style.cssText =
        "padding:10px;text-align:center;color:#aaa;font-size:12px;";
      empty.textContent = "No results found";
      optionsEl.appendChild(empty);
    }
  }

  // Make a single dropdown item element
  function makeItem(item) {
    const div = document.createElement("div");
    div.className = "dropdown-item";
    div.dataset.code = item.code;

    if (isCrypto) {
      div.innerHTML = `
        <span style="font-size:14px;min-width:20px;text-align:center;">${item.icon}</span>
        <span class="code">${item.code}</span>
        <span class="name">${item.name}</span>`;
    } else {
      div.innerHTML = `
        ${getFlagImg(item.code)}
        <span class="code">${item.code}</span>
        <span class="name">${item.name}</span>`;
    }

    div.addEventListener("click", () => {
      onSelect(item.code);
      renderSelected(item.code);
      closeAllDropdowns();
    });

    return div;
  }

  // Wire up search input
  searchEl.addEventListener("input", (e) => {
    renderList(e.target.value);
  });

  // Initial render
  renderList();
  renderSelected(defaultCode);

  // Return a method to update the selected value from outside
  return { renderSelected, renderList };
}

/* ---------- Open / Close Logic ---------- */
function closeAllDropdowns() {
  document
    .querySelectorAll(".dropdown-list")
    .forEach((d) => d.classList.remove("open"));
}

document.querySelectorAll(".dropdown-wrap").forEach((wrap) => {
  const selectedEl = wrap.querySelector(".dropdown-selected");
  const listEl = wrap.querySelector(".dropdown-list");
  const searchEl = wrap.querySelector(".dropdown-search input");

  selectedEl.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = listEl.classList.contains("open");
    closeAllDropdowns();
    if (!isOpen) {
      listEl.classList.add("open");
      if (searchEl) {
        // Clear search and re-render full list every time dropdown opens
        searchEl.value = "";
        searchEl.dispatchEvent(new Event("input"));
        setTimeout(() => searchEl.focus(), 50);
      }
    }
  });
});

// Close when clicking outside
document.addEventListener("click", closeAllDropdowns);

// Prevent closing when clicking inside list
document.querySelectorAll(".dropdown-list").forEach((list) => {
  list.addEventListener("click", (e) => e.stopPropagation());
});

/* ---------- Initialize Fiat Dropdowns ---------- */
// All three fiat dropdowns are built AFTER data is loaded
// This ensures flags and search work correctly
let dropdownCurrency, dropdownFrom, dropdownTo, dropdownCryptoTo;

function initFiatDropdowns(savedCurrency) {
  selectedCurrency = savedCurrency;

  dropdownCurrency = createDropdown({
    optionsEl: document.getElementById("currencyOptions"),
    searchEl: document.getElementById("currencySearch"),
    selectedEl: document.getElementById("currencySelected"),
    items: allFiats,
    defaultCode: savedCurrency,
    onSelect: (code) => {
      selectedCurrency = code;
    },
    isCrypto: false,
  });

  dropdownFrom = createDropdown({
    optionsEl: document.getElementById("fromOptions"),
    searchEl: document.getElementById("fromSearch"),
    selectedEl: document.getElementById("fromSelected"),
    items: allFiats,
    defaultCode: "USD",
    onSelect: (code) => {
      selectedFrom = code;
    },
    isCrypto: false,
  });

  dropdownTo = createDropdown({
    optionsEl: document.getElementById("toOptions"),
    searchEl: document.getElementById("toSearch"),
    selectedEl: document.getElementById("toSelected"),
    items: allFiats,
    defaultCode: "INR",
    onSelect: (code) => {
      selectedTo = code;
    },
    isCrypto: false,
  });

  // Crypto To (fiat target)
  dropdownCryptoTo = createDropdown({
    optionsEl: document.getElementById("cryptoToOptions"),
    searchEl: document.getElementById("cryptoToSearch"),
    selectedEl: document.getElementById("cryptoToSelected"),
    items: allFiats,
    defaultCode: "USD",
    onSelect: (code) => {
      selectedCryptoTo = code;
    },
    isCrypto: false,
  });
}

/* ---------- Load Fiat Data ---------- */
function buildFiatList(apiData) {
  const popular = POPULAR_FIATS.map((p) => {
    const found = apiData.find((c) => c.code === p.code);
    return { code: p.code, name: found?.name || p.name };
  });

  const others = apiData
    .filter((c) => !POPULAR_CODES.includes(c.code))
    .sort((a, b) => a.code.localeCompare(b.code));

  allFiats = [...popular, ...others];
}

// Load from cache or fetch
chrome.storage.local.get(
  ["currencyList", "currencyListTimestamp"],
  (stored) => {
    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000;

    if (stored.currencyList && now - stored.currencyListTimestamp < ONE_DAY) {
      // Use cached list
      buildFiatList(stored.currencyList);
      loadSavedAndInit();
    } else {
      // Fetch fresh list
      fetch(
        "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies.json",
      )
        .then((r) => r.json())
        .then((data) => {
          const list = Object.keys(data).map((code) => ({
            code: code.toUpperCase(),
            name:
              typeof data[code] === "string" ? data[code] : code.toUpperCase(),
          }));
          chrome.storage.local.set({
            currencyList: list,
            currencyListTimestamp: now,
          });
          buildFiatList(list);
          loadSavedAndInit();
        })
        .catch(() => {
          // Fallback to popular list only
          allFiats = [...POPULAR_FIATS];
          loadSavedAndInit();
        });
    }
  },
);

function loadSavedAndInit() {
  chrome.storage.sync.get("targetCurrency", (data) => {
    const saved = data.targetCurrency || "USD";
    initFiatDropdowns(saved);
  });
}

/* ---------- Crypto From Dropdown ---------- */
// Built immediately since it doesn't need API data
createDropdown({
  optionsEl: document.getElementById("cryptoFromOptions"),
  searchEl: document.getElementById("cryptoFromSearch"),
  selectedEl: document.getElementById("cryptoFromSelected"),
  items: CRYPTO_LIST,
  defaultCode: "BTC",
  onSelect: (code) => {
    selectedCryptoFrom = code;
  },
  isCrypto: true,
});

/* ---------- Save Page Currency ---------- */
const saveBtn = document.getElementById("save");
saveBtn.onclick = () => {
  if (!selectedCurrency) return;

  saveBtn.textContent = "Saving...";
  saveBtn.disabled = true;

  chrome.storage.sync.set({ targetCurrency: selectedCurrency }, () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) return;
      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: "updateCurrency", target: selectedCurrency },
        () => {
          if (chrome.runtime.lastError) {
            chrome.tabs.reload(tabs[0].id);
          }
        },
      );
    });

    saveBtn.textContent = "Applied ✓";
    setTimeout(() => {
      saveBtn.textContent = "Apply";
      saveBtn.disabled = false;
    }, 1500);
  });
};

/* ---------- Mini Converter ---------- */
document.getElementById("convert").onclick = () => {
  const amount = parseFloat(document.getElementById("amount").value);
  const resultDiv = document.getElementById("result");

  if (isNaN(amount) || amount <= 0) {
    resultDiv.className = "result error";
    resultDiv.textContent = "Enter a valid amount.";
    return;
  }

  resultDiv.className = "result loading";
  resultDiv.textContent = "Converting...";

  const from = selectedFrom.toLowerCase();
  const to = selectedTo.toLowerCase();

  fetch(
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${from}.json`,
  )
    .then((r) => r.json())
    .then((data) => {
      const rate = data[from]?.[to];
      if (!rate) {
        resultDiv.className = "result error";
        resultDiv.textContent = "Conversion not available.";
        return;
      }
      const result = (amount * rate).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      resultDiv.className = "result";
      resultDiv.innerHTML = `
        ${getFlagImg(selectedFrom)}
        <b>${amount} ${selectedFrom}</b>
        &nbsp;=&nbsp;
        ${getFlagImg(selectedTo)}
        <b>${result} ${selectedTo}</b>`;
    })
    .catch(() => {
      resultDiv.className = "result error";
      resultDiv.textContent = "Conversion failed.";
    });
};

/* ---------- Crypto Converter ---------- */
document.getElementById("cryptoConvert").onclick = () => {
  const amount = parseFloat(document.getElementById("cryptoAmount").value);
  const resultDiv = document.getElementById("cryptoResult");

  if (isNaN(amount) || amount <= 0) {
    resultDiv.className = "result error";
    resultDiv.textContent = "Enter a valid amount.";
    return;
  }

  resultDiv.className = "result loading";
  resultDiv.textContent = "Fetching price...";

  const crypto = CRYPTO_LIST.find((c) => c.code === selectedCryptoFrom);
  if (!crypto) return;

  const fiat = selectedCryptoTo.toLowerCase();

  fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${crypto.id}&vs_currencies=${fiat}`,
  )
    .then((r) => r.json())
    .then((data) => {
      const rate = data[crypto.id]?.[fiat];
      if (!rate) {
        resultDiv.className = "result error";
        resultDiv.textContent = "Price not available.";
        return;
      }
      const result = (amount * rate).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      resultDiv.className = "result";
      resultDiv.innerHTML = `
        <b>${crypto.icon} ${amount} ${crypto.code}</b>
        &nbsp;=&nbsp;
        ${getFlagImg(selectedCryptoTo)}
        <b>${result} ${selectedCryptoTo}</b>`;
    })
    .catch(() => {
      resultDiv.className = "result error";
      resultDiv.textContent = "Failed to fetch crypto price.";
    });
};

/* ---------- Site Toggle ---------- */
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const toggle = document.getElementById("toggleSite");

  if (!tabs[0]?.url?.startsWith("http")) {
    toggle.disabled = true;
    return;
  }

  const host = new URL(tabs[0].url).hostname;

  chrome.storage.sync.get("blockedSites", (data) => {
    toggle.checked = !(data.blockedSites || []).includes(host);
  });

  toggle.onchange = () => {
    chrome.storage.sync.get("blockedSites", (data) => {
      let blocked = data.blockedSites || [];
      blocked = toggle.checked
        ? blocked.filter((s) => s !== host)
        : [...new Set([...blocked, host])];
      chrome.storage.sync.set({ blockedSites: blocked });
    });
  };
});
