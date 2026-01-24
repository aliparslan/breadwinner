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
function formatCurrency(amount) {
  const num = parseFloat(amount);
  const isNeg = num < 0;
  const absVal = Math.abs(num).toFixed(2);
  return (isNeg ? "-$" : "$") + absVal;
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
