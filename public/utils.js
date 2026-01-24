// --- UTILITIES ---

// --- TOAST NOTIFICATIONS ---
const toastEl = document.getElementById("status-toast");
const toastText = document.getElementById("status-text");
let toastTimer;

function showToast(msg, type = "loading") {
  if (!toastText || !toastEl) return;
  toastText.innerText = msg;
  toastEl.className = "";
  // Reset classes first
  toastEl.classList.remove("loading", "success", "error", "show");
  
  toastEl.classList.add(type, "show");
  clearTimeout(toastTimer);
  if (type !== "loading") {
    toastTimer = setTimeout(() => {
      toastEl.classList.remove("show");
    }, 3000);
  }
}

// --- LOADING OVERLAY ---
function toggleLoading(show) {
  const overlay = document.getElementById("loading-overlay");
  if (!overlay) return;
  if (show) overlay.classList.remove("hidden");
  else overlay.classList.add("hidden");
}

// --- FORMATTING ---
function formatCurrency(amount, compact = false) {
  const num = parseFloat(amount);
  const absNum = Math.abs(num);
  
  // 1. If explicit compact requested OR very large amount (>= 100k), use K/M notation
  if (compact || absNum >= 100000) {
     return new Intl.NumberFormat('en-US', {
       style: 'currency',
       currency: 'USD',
       notation: 'compact',
       compactDisplay: 'short',
       maximumFractionDigits: 1 // e.g. $1.5M, $500K
     }).format(num);
  }

  // 2. If reasonably large (>= 1000), remove cents
  if (absNum >= 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(num);
  }

  // 3. Standard (< 1000): Keep cents
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(num);
}

function formatDate(dateString) {
  const [y, m, d] = dateString.split("-");
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}
