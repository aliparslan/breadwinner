// --- CONFIGURATION ---
// Config loaded from config.js


// --- CATEGORY COLORS ---
// Loaded from config.js


// --- HELPER: TOAST NOTIFICATIONS ---
// Loaded from utils.js


// --- HELPER: LOADING OVERLAY ---
// Loaded from utils.js


// --- HELPER: FORMATTING ---
// Loaded from utils.js


// --- CORE LOGIC ---
let allCategories = [];
let allTransactions = [];

async function fetchTransactions() {
  const { data: cats } = await client.from("categories").select("*").order("name");
  allCategories = cats || [];

  const filterSelect = document.getElementById("filter-category");
  const currentVal = filterSelect.value;

  filterSelect.innerHTML =
    '<option value="all">All</option>' +
    allCategories.map((c) => `<option value="${c.name}">${c.name}</option>`).join("");

  filterSelect.value = currentVal;

  const { data, error } = await client
    .from("transactions")
    .select(`*, categories ( id, name )`)
    .order("date", { ascending: false });

  if (error) {
    console.error(error);
    showToast("Error loading data", "error");
    return;
  }

  allTransactions = data.map((tx) => ({
    ...tx,
    categoryName: tx.categories ? tx.categories.name : "Uncategorized",
    categoryId: tx.category_id,
  }));

  applyFilters();
}

function applyFilters() {
  const search = document.getElementById("filter-search").value.toLowerCase();
  const cat = document.getElementById("filter-category").value;

  const filtered = allTransactions.filter((tx) => {
    const matchesSearch = tx.description.toLowerCase().includes(search);
    const matchesCat = cat === "all" || tx.categoryName === cat;
    return matchesSearch && matchesCat;
  });

  renderDashboard(filtered);
}

document.getElementById("filter-search").addEventListener("input", debounce(applyFilters, 300));
document.getElementById("filter-category").addEventListener("change", applyFilters);

// Global helper for visualization clicks
window.filterByCategoryAndScroll = function(categoryName) {
  const select = document.getElementById("filter-category");
  if (!select) return;
  
  // Find the option
  let found = false;
  for (let i = 0; i < select.options.length; i++) {
    if (select.options[i].value === categoryName) {
      select.selectedIndex = i;
      found = true;
      break;
    }
  }

  if (!found) {
    // If it's "Other", it might be an aggregation, so just warn
    if (categoryName === "Other") {
       showToast("Cannot filter by 'Other' group", "error");
    } else {
       // Try to find case-insensitive match just in case
       for (let i = 0; i < select.options.length; i++) {
         if (select.options[i].value.toLowerCase() === categoryName.toLowerCase()) {
           select.selectedIndex = i;
           found = true;
           break;
         }
       }
       if (!found) showToast("Category not found in filter", "error");
    }
    if (!found) return;
  }
  
  applyFilters();
  
  const target = document.querySelector(".transactions-header");
  if (target) {
     target.scrollIntoView({ behavior: "smooth" });
  } else {
     document.getElementById("tx-table-container")?.scrollIntoView({ behavior: "smooth" });
  }
};

// --- MONTHLY VIZ LOGIC ---
let vizMonthsData = {}; // Global store for month data
let vizSortedMonthKeys = []; // Sorted month keys
let vizCurrentMonthIndex = 0; // Track currently selected month
let vizAllTransactions = []; // Store all transactions for income/expense calculations

// --- TOOLTIP LOGIC ---
let tooltipEl = null;

function showVizTooltip(e, content) {
  if (!tooltipEl) {
    tooltipEl = document.createElement("div");
    tooltipEl.className = "viz-tooltip";
    document.body.appendChild(tooltipEl);
  }
  
  if (!content) return;
  
  tooltipEl.innerHTML = content;
  tooltipEl.classList.add("visible");
  moveVizTooltip(e);
}

function moveVizTooltip(e) {
  if (!tooltipEl) return;
  const x = e.clientX;
  const y = e.clientY;
  
  // Prevent overflow on right edge
  const rect = tooltipEl.getBoundingClientRect();
  const winWidth = window.innerWidth;
  
  let left = x;
  if (x + rect.width / 2 > winWidth - 10) {
    left = winWidth - rect.width / 2 - 10;
  } else if (x - rect.width / 2 < 10) {
    left = rect.width / 2 + 10;
  }
  
  tooltipEl.style.left = `${left}px`;
  tooltipEl.style.top = `${y}px`;
  
  // Flip if too close to top
  // Default is ABOVE (transform: -100% and margin-top: -16px)
  // If y < rect.height + 20, we should flip to below
  if (y < rect.height + 30) {
    tooltipEl.style.transform = "translate(-50%, 0)";
    tooltipEl.style.marginTop = "20px";
  } else {
    tooltipEl.style.transform = "translate(-50%, -100%)";
    tooltipEl.style.marginTop = "-16px";
  }
}

function hideVizTooltip() {
  if (tooltipEl) {
    tooltipEl.classList.remove("visible");
  }
}

// Attach to window for easier debugging if needed, though not strictly required
window.showVizTooltip = showVizTooltip;
window.hideVizTooltip = hideVizTooltip;
window.moveVizTooltip = moveVizTooltip;

function renderMonthlyViz(transactions) {
  const container = document.getElementById("monthly-viz");
  if (!container) return;

  vizAllTransactions = transactions; // Store for income/expense calculations

  // 1. Filter Expenses Only & Sort by Date Descending
  const expenses = transactions
    .filter((t) => parseFloat(t.amount) < 0)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (expenses.length === 0) {
    container.classList.add("hidden");
    return;
  }

  // 2. Group by Month (YYYY-MM) + All Time
  vizMonthsData = { "all": [] };
  expenses.forEach((t) => {
    const key = t.date.substring(0, 7); // "2023-10"
    if (!vizMonthsData[key]) vizMonthsData[key] = [];
    vizMonthsData[key].push(t);
    vizMonthsData["all"].push(t); // Also add to all time
  });

  // Sort keys with "all" first, then months descending
  const monthKeys = Object.keys(vizMonthsData).filter(k => k !== "all").sort().reverse();
  vizSortedMonthKeys = ["all", ...monthKeys];
  
  // Default Preference Logic
  const storedMonth = localStorage.getItem("breadwinner_month_pref");
  let defaultIndex = 1; 
  
  if (storedMonth) {
     const foundIndex = vizSortedMonthKeys.indexOf(storedMonth);
     if (foundIndex >= 0) defaultIndex = foundIndex;
  }
  
  if (defaultIndex >= vizSortedMonthKeys.length) defaultIndex = 0;
  vizCurrentMonthIndex = defaultIndex;
  
  container.classList.remove("hidden");
  renderVizForMonth(vizCurrentMonthIndex);
}

function renderVizForMonth(monthIndex) {
  const container = document.getElementById("monthly-viz");
  if (!container) return;

  const currentKey = vizSortedMonthKeys[monthIndex];
  const isAllTime = currentKey === "all";
  const prevKey = isAllTime ? null : vizSortedMonthKeys[monthIndex + 1];

  // 3. Current Period Stats
  const currentTxs = vizMonthsData[currentKey];
  // Safety check
  if (!currentTxs) return;

  const currentTotal = currentTxs.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

  // Income/Expense/Net for current period
  let periodIncome = 0, periodExpense = 0;
  const periodTransactions = isAllTime 
    ? vizAllTransactions 
    : vizAllTransactions.filter(t => t.date.startsWith(currentKey));
  
  periodTransactions.forEach(tx => {
    const amt = parseFloat(tx.amount);
    if (amt > 0) periodIncome += amt;
    else periodExpense += Math.abs(amt);
  });
  const periodNet = periodIncome - periodExpense;

  // 4. Previous Month Stats (for comparison)
  let prevTotal = 0;
  let prevCatTotals = {};
  if (prevKey && prevKey !== "all") {
    const prevTxs = vizMonthsData[prevKey];
    if (prevTxs) {
      prevTotal = prevTxs.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);
      prevTxs.forEach((t) => {
        prevCatTotals[t.categoryName] = (prevCatTotals[t.categoryName] || 0) + Math.abs(parseFloat(t.amount));
      });
    }
  }

  // 5. Category Breakdown
  const currentCatTotals = {};
  currentTxs.forEach((t) => {
    currentCatTotals[t.categoryName] = (currentCatTotals[t.categoryName] || 0) + Math.abs(parseFloat(t.amount));
  });

  // Full Breakdown (for Legend)
  let catStats = Object.keys(currentCatTotals).map((name) => {
    const amt = currentCatTotals[name];
    const prevAmt = prevCatTotals[name] || 0;
    let deltaPct = 0;
    if (prevAmt > 0) deltaPct = ((amt - prevAmt) / prevAmt) * 100;
    
    return {
      name,
      amount: amt,
      pctOfTotal: currentTotal > 0 ? (amt / currentTotal) * 100 : 0,
      delta: deltaPct,
      prevAmount: prevAmt
    };
  });
  catStats.sort((a, b) => b.amount - a.amount);

  // Grouped Breakdown (for Bar) - Groups < 3% into "Other"
  const totalVal = currentTotal;
  const barStats = [];
  let otherAmt = 0;
  let otherIncluded = [];

  catStats.forEach(c => {
    const pct = totalVal > 0 ? (c.amount / totalVal) * 100 : 0;
    if (pct < 3 && c.name !== "Other") {
      otherAmt += c.amount;
      otherIncluded.push(c);
    } else {
      barStats.push(c);
    }
  });
  
  if (otherAmt > 0) {
    const existingOther = barStats.find(c => c.name === "Other");
    if (existingOther) {
      existingOther.amount += otherAmt;
      existingOther.pctOfTotal = (existingOther.amount / totalVal) * 100;
      if (!existingOther.included) existingOther.included = [];
      existingOther.included.push(...otherIncluded);
    } else {
      barStats.push({
        name: "Other",
        amount: otherAmt,
        pctOfTotal: (otherAmt / totalVal) * 100,
        delta: 0,
        prevAmount: 0,
        included: otherIncluded
      });
    }
  }
  barStats.sort((a, b) => b.amount - a.amount);

  // 6. Generate HTML
  const monthDropdownOptions = vizSortedMonthKeys.map((key, idx) => {
    let displayName;
    if (key === "all") {
      displayName = "All Time";
    } else {
      const [y, m] = key.split("-");
      displayName = new Date(parseInt(y), parseInt(m) - 1).toLocaleString("default", { month: "long", year: "numeric" });
    }
    return `<option value="${idx}" ${idx === monthIndex ? 'selected' : ''}>${displayName}</option>`;
  }).join("");

  // Ticker Prev Values
  let prevIncomeVal = 0, prevExpenseVal = 0, prevNetVal = 0;
  if (prevKey && prevKey !== "all") {
    const prevPeriodTxs = vizAllTransactions.filter(t => t.date.startsWith(prevKey));
    prevPeriodTxs.forEach(tx => {
      const amt = parseFloat(tx.amount);
      if (amt > 0) prevIncomeVal += amt;
      else prevExpenseVal += Math.abs(amt);
    });
    prevNetVal = prevIncomeVal - prevExpenseVal;
  }

  function getTickerHtml(current, prev, invertColors = false) {
    if (isAllTime) return ''; 
    if (prev === 0) {
      if (current > 0) return `<span class="stat-card-ticker" style="color: var(--text-muted)">New</span>`;
      return '';
    }
    const deltaPct = ((current - prev) / prev) * 100;
    if (Math.abs(deltaPct) < 0.1) return `<span class="stat-card-ticker" style="color: var(--text-muted)">—</span>`;
    const isUp = deltaPct > 0;
    const upColor = invertColors ? 'var(--accent-red)' : 'var(--accent-green)';
    const downColor = invertColors ? 'var(--accent-green)' : 'var(--accent-red)';
    const color = isUp ? upColor : downColor;
    const arrow = isUp ? '▲' : '▼';
    const fmtPct = new Intl.NumberFormat('en-US', { minimumFractionDigits: Math.abs(deltaPct) >= 1000 ? 0 : 1, maximumFractionDigits: Math.abs(deltaPct) >= 1000 ? 0 : 1 }).format(Math.abs(deltaPct));
    return `<span class="stat-card-ticker" style="color: ${color}">${arrow} ${fmtPct}%</span>`;
  }

  const barsHtml = barStats.map((c) => {
      const color = c.name === "Other" ? "#d6d3d1" : getCategoryColor(c.name); 
      let tooltipContent = "";
      const amtStr = formatCurrency(c.amount, true);
      const pctStr = c.pctOfTotal.toFixed(1) + "%";
      
      if (c.name === "Other" && c.included && c.included.length > 0) {
        c.included.sort((a,b) => b.amount - a.amount);
        const rows = c.included.map(sub => {
          const subPct = totalVal > 0 ? (sub.amount / totalVal) * 100 : 0;
          return `
          <div class="viz-tooltip-row">
            <span>${sub.name}</span>
            <span>${subPct.toFixed(1)}%</span>
            <!-- <span>${formatCurrency(sub.amount, true)}</span> -->
          </div>
        `}).join("");
        tooltipContent = `
          <div class="viz-tooltip-header" style="gap: 12px;">
            <span>Other Categories</span>
            <span class="amt">${amtStr}</span>
          </div>
          <div class="viz-tooltip-list">
            ${rows}
          </div>
        `;
      } else {
        tooltipContent = `
          <div class="viz-tooltip-header">
            <span>${c.name}</span>
            <span class="amt">${amtStr}</span>
          </div>
          <div class="viz-tooltip-row">
            <span>Share</span>
            <span>${pctStr}</span>
          </div>
        `;
      }

      const safeTooltip = tooltipContent.replace(/"/g, '&quot;');
      
      return `<div class="viz-segment" 
           style="flex: ${c.pctOfTotal} 1 0px; background: ${color}" 
           data-tooltip-html="${safeTooltip}"
           onclick="filterByCategoryAndScroll('${c.name.replace(/'/g, "\\'")}')"
           onmouseenter="showVizTooltip(event, this.getAttribute('data-tooltip-html'))"
           onmousemove="moveVizTooltip(event)"
           onmouseleave="hideVizTooltip()"
           ></div>`;
    }).join("");

  const legendHtml = catStats.map((c) => {
      const color = getCategoryColor(c.name);
      let deltaStr, deltaColor;
      if (isAllTime) {
         deltaStr = ""; deltaColor = "transparent";
      } else if (c.prevAmount === 0) {
        deltaStr = "New"; deltaColor = "var(--text-muted)";
      } else if (Math.abs(c.delta) < 0.1) {
        deltaStr = "—"; deltaColor = "var(--text-muted)";
      } else {
        const absDelta = Math.abs(c.delta);
        const fmtDelta = new Intl.NumberFormat('en-US', { minimumFractionDigits: absDelta >= 1000 ? 0 : 1, maximumFractionDigits: absDelta >= 1000 ? 0 : 1 }).format(c.delta);
        deltaStr = (c.delta > 0 ? "▲ " : "▼ ") + fmtDelta + "%";
        deltaColor = c.delta > 0 ? "var(--accent-red)" : "var(--accent-green)";
      }

      return `
        <div class="viz-item" onclick="filterByCategoryAndScroll('${c.name.replace(/'/g, "\\'")}')">
          <div class="viz-color-pill" style="background: ${color}"></div>
          <div class="viz-info">
            <div class="viz-row-top">
              <span class="viz-cat-name">${c.name}</span>
              <span class="viz-cat-pct">${c.pctOfTotal.toFixed(1)}%</span>
            </div>
            <div class="viz-row-bot">
              <span class="viz-cat-amt">${formatCurrency(c.amount, true)}</span>
              <span class="viz-cat-change" style="color: ${deltaColor}">${deltaStr}</span>
            </div>
          </div>
        </div>
      `;
    }).join("");

  container.innerHTML = `
    <div class="viz-card">
      <div class="viz-header">
        <div class="viz-month-container">
          <span class="viz-month-text">${isAllTime ? "All Time" : new Date(parseInt(currentKey.split("-")[0]), parseInt(currentKey.split("-")[1]) - 1).toLocaleString("default", { month: "long", year: "numeric" })}</span>
          <svg class="viz-month-arrow-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          <select id="viz-month-dropdown" class="viz-month-overlay" onchange="onVizMonthChange(this.value)">${monthDropdownOptions}</select>
        </div>
      </div>
      <div class="stat-cards-row">
        <div class="stat-card">
          <span class="stat-card-label">Spending</span>
          <div class="stat-card-row">
            <span class="stat-card-value">${formatCurrency(periodExpense, true)}</span>
            ${getTickerHtml(periodExpense, prevExpenseVal, true)}
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-card-label">Income</span>
          <div class="stat-card-row">
            <span class="stat-card-value positive">${formatCurrency(periodIncome, true)}</span>
            ${getTickerHtml(periodIncome, prevIncomeVal, false)}
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-card-label">Net</span>
          <div class="stat-card-row">
            <span class="stat-card-value ${periodNet >= 0 ? 'positive' : 'negative'}">${periodNet >= 0 ? '+' : ''}${formatCurrency(periodNet, true)}</span>
            ${getTickerHtml(periodNet, prevNetVal, false)}
          </div>
        </div>
      </div>
      <div class="viz-breakdown-header"><span class="viz-breakdown-title">Spending Breakdown</span></div>
      <div class="viz-bar-container">${barsHtml}</div>
      <div class="viz-legend">${legendHtml}</div>
    </div>
  `;
}

function onVizMonthChange(monthIndexStr) {
  vizCurrentMonthIndex = parseInt(monthIndexStr, 10);
  
  // Persist selection
  const selectedKey = vizSortedMonthKeys[vizCurrentMonthIndex];
  localStorage.setItem("breadwinner_month_pref", selectedKey);
  
  renderVizForMonth(vizCurrentMonthIndex);
}

function renderDashboard(transactions) {
  // Render the monthly viz (includes summary stats now)
  renderMonthlyViz(allTransactions);

  // Table
  const container = document.getElementById("tx-table-container");
  const grouped = {};

  transactions.forEach((tx) => {
    const [y, m, d] = tx.date.split("-");
    const dateObj = new Date(y, m - 1, d);
    const k = dateObj.toLocaleString("default", { month: "long", year: "numeric" });
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(tx);
  });

  if (Object.keys(grouped).length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📭</span>
        <p>No transactions found.</p>
      </div>`;
    return;
  }

  // Render months with collapsible headers (default collapsed, persisted per-month)
  container.innerHTML = Object.entries(grouped)
    .map(([month, txs]) => {
      const total = txs.reduce((s, t) => s + parseFloat(t.amount), 0);
      const rows = txs.map(renderRow).join("");
      
      // Check localStorage for saved state, default to collapsed
      const monthKey = month.replace(/\s+/g, '-');
      const savedState = localStorage.getItem(`month-${monthKey}`);
      const isExpanded = savedState === 'true'; // Default false (collapsed)
      const hiddenClass = isExpanded ? '' : 'hidden';

      return `
      <div class="month-group">
        <button class="month-header" onclick="toggleMonth(this, '${monthKey}')" aria-expanded="${isExpanded}">
          <span>${month}</span>
          <span style="color: ${total >= 0 ? "var(--accent-green)" : "var(--text-main)"}">
            ${formatCurrency(Math.abs(total))}
          </span>
        </button>
        <div class="month-content ${hiddenClass}">
          <table>
             <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th></tr></thead>
             <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
    })
    .join("");
}

function renderRow(tx) {
  const isNeg = tx.amount < 0;
  const desc = tx.description.length > 60 ? tx.description.substring(0, 58) + "..." : tx.description;
  const pillStyle = getCategoryPillStyle(tx.categoryName);
  const categoryColor = getCategoryColor(tx.categoryName);
  // Tappable row - opens edit modal, with category color for mobile dot
  return `
    <tr onclick="openEdit(${tx.id})" style="cursor: pointer; --category-color: ${categoryColor};" tabindex="0" role="button" aria-label="Edit ${desc}">
      <td>${formatDate(tx.date)}</td>
      <td>${desc}</td>
      <td><span class="category-badge" style="${pillStyle}">${tx.categoryName}</span></td>
      <td style="color:${isNeg ? "var(--text-main)" : "var(--accent-green)"}">${formatCurrency(Math.abs(tx.amount))}</td>
    </tr>`;
}

function toggleMonth(btn, monthKey) {
  const content = btn.nextElementSibling;
  const isHidden = content.classList.toggle("hidden");
  const isExpanded = !isHidden;
  btn.setAttribute("aria-expanded", isExpanded);
  // Save state to localStorage
  localStorage.setItem(`month-${monthKey}`, isExpanded.toString());
}

// --- CONFIRMATION MODAL LOGIC ---
let pendingDeleteId = null;

function initiateDelete(id) {
  pendingDeleteId = id;
  const modal = document.getElementById("confirm-modal");
  modal.classList.remove("hidden");

  // Set up the Yes button specifically for this action
  const yesBtn = document.getElementById("confirm-yes-btn");
  yesBtn.onclick = () => {
    confirmDelete();
    closeConfirm();
  };
}

function closeConfirm() {
  document.getElementById("confirm-modal").classList.add("hidden");
  pendingDeleteId = null;
}

async function confirmDelete() {
  if (!pendingDeleteId) return;
  const id = pendingDeleteId;

  // Optimistic Delete
  const originalTxs = [...allTransactions];
  allTransactions = allTransactions.filter((t) => t.id !== id);
  applyFilters();
  showToast("Transaction deleted", "success");

  const { error } = await client.from("transactions").delete().eq("id", id);
  if (error) {
    console.error("Delete failed", error);
    allTransactions = originalTxs;
    applyFilters();
    showToast("Failed to delete", "error");
  }
}

// --- MODAL LOGIC ---
let currentEditId = null;
let currentTxType = "expense";

document.getElementById("edit-modal").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeModal();
});

document.getElementById("confirm-modal").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeConfirm();
});

function setTxType(type) {
  currentTxType = type;
  document.getElementById("type-expense").className = `type-btn ${type === "expense" ? "active" : ""}`;
  document.getElementById("type-income").className = `type-btn ${type === "income" ? "active" : ""}`;
}

function openAddModal() {
  currentEditId = null;
  document.getElementById("modal-title").innerText = "New Transaction";
  document.getElementById("edit-desc").value = "";
  document.getElementById("edit-amount").value = "";
  document.getElementById("edit-date").value = new Date().toISOString().split("T")[0];
  setTxType("expense");
  renderCats();
  // Hide delete button for new transactions
  document.getElementById("delete-tx-btn").classList.add("hidden");
  document.getElementById("edit-modal").classList.remove("hidden");
  document.getElementById("edit-amount").focus();
}

function openEdit(id, event) {
  // Prevent row click bubbling if clicking specific elements
  if (event) event.stopPropagation();
  
  const tx = allTransactions.find((t) => t.id == id);
  if (!tx) return;
  currentEditId = id;
  document.getElementById("modal-title").innerText = "Edit Transaction";
  document.getElementById("edit-desc").value = tx.description;
  const rawAmt = parseFloat(tx.amount);
  document.getElementById("edit-amount").value = Math.abs(rawAmt).toFixed(2);
  setTxType(rawAmt >= 0 ? "income" : "expense");
  document.getElementById("edit-date").value = tx.date;
  renderCats(tx.category_id);
  // Show delete button for existing transactions
  document.getElementById("delete-tx-btn").classList.remove("hidden");
  document.getElementById("edit-modal").classList.remove("hidden");
}

function renderCats(sel) {
  document.getElementById("edit-category").innerHTML = allCategories
    .map((c) => `<option value="${c.id}" ${c.id == sel ? "selected" : ""}>${c.name}</option>`)
    .join("");
}

function closeModal() {
  document.getElementById("edit-modal").classList.add("hidden");
}

// Delete directly from modal without confirmation
async function deleteFromModal() {
  if (!currentEditId) return;
  const id = currentEditId;
  
  closeModal();
  
  // Optimistic Delete
  const originalTxs = [...allTransactions];
  allTransactions = allTransactions.filter((t) => t.id !== id);
  applyFilters();
  showToast("Transaction deleted", "success");

  const { error } = await client.from("transactions").delete().eq("id", id);
  if (error) {
    console.error("Delete failed", error);
    allTransactions = originalTxs;
    applyFilters();
    showToast("Failed to delete", "error");
  }
}

async function saveEdit() {
  const desc = document.getElementById("edit-desc").value;
  const rawAmt = parseFloat(document.getElementById("edit-amount").value);
  const date = document.getElementById("edit-date").value;
  const cat = document.getElementById("edit-category").value;
  const {
    data: { session },
  } = await client.auth.getSession();

  if (!rawAmt) {
    showToast("Please enter an amount", "error");
    return;
  }

  const finalAmt = currentTxType === "expense" ? -Math.abs(rawAmt) : Math.abs(rawAmt);
  const payload = { description: desc, amount: finalAmt, date: date, category_id: cat };

  closeModal();
  showToast("Saving...", "loading");

  let error;
  if (currentEditId) {
    const res = await client.from("transactions").update(payload).eq("id", currentEditId);
    error = res.error;
  } else {
    const res = await client.from("transactions").insert({ ...payload, user_id: session.user.id });
    error = res.error;
  }

  if (error) {
    console.error(error);
    showToast("Error saving", "error");
  } else {
    await fetchTransactions();
    showToast("Saved successfully", "success");
  }
}

// --- PDF UPLOAD ---
async function extractTextFromPDF(file) {
  try {
    const ab = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(ab).promise;
    let txt = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const p = await pdf.getPage(i);
      const c = await p.getTextContent();
      txt += c.items.map((s) => s.str).join(" ") + "\n";
    }
    return txt;
  } catch (e) {
    return null;
  }
}

const trigger = document.getElementById("trigger-upload-btn");
const input = document.getElementById("file-input");

if (trigger && input) {
  trigger.onclick = () => input.click();
  input.onchange = async () => {
    const f = input.files[0];
    if (!f) return;
    showToast("Reading PDF...", "loading");

    const {
      data: { session },
    } = await client.auth.getSession();
    const txt = await extractTextFromPDF(f);

    const fd = new FormData();
    if (txt && txt.length > 50) fd.append("text", txt);
    else fd.append("file", f);
    fd.append("filename", f.name);

    showToast("Analyzing...", "loading");

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());

      await fetchTransactions();
      showToast("Import successful!", "success");
      input.value = "";
    } catch (e) {
      showToast("Error: " + e.message, "error");
    }
  };
}

// --- AUTH LOGIC ---
function handleLoginEnter(e) {
  if (e.key === "Enter") document.getElementById("login-btn").click();
}
document.getElementById("email")?.addEventListener("keypress", handleLoginEnter);
document.getElementById("password")?.addEventListener("keypress", handleLoginEnter);

document.getElementById("login-btn").onclick = async () => {
  const e = document.getElementById("email").value;
  const p = document.getElementById("password").value;
  toggleLoading(true);
  const { error } = await client.auth.signInWithPassword({ email: e, password: p });
  if (error) {
    document.getElementById("msg").innerText = error.message;
    toggleLoading(false);
  } else {
    checkUser();
  }
};

document.getElementById("signup-btn").onclick = async () => {
  const e = document.getElementById("email").value;
  const p = document.getElementById("password").value;
  toggleLoading(true);
  const { error } = await client.auth.signUp({ email: e, password: p });
  toggleLoading(false);
  if (error) document.getElementById("msg").innerText = error.message;
  else alert("Check your email for the confirmation link.");
};

document.getElementById("logout-btn").onclick = async () => {
  toggleLoading(true);
  await client.auth.signOut();
  updateUI(null);
  toggleLoading(false);
};

// --- AI INSIGHTS ---
async function fetchInsights(forceRefresh = false) {
  const container = document.getElementById("ai-insights");
  const textEl = document.getElementById("insights-text");
  const refreshBtn = document.getElementById("refresh-insights-btn");
  
  if (!container || !textEl) return;
  
  container.classList.remove("hidden");
  textEl.innerText = "Loading insights...";
  textEl.classList.add("loading");
  if (refreshBtn) refreshBtn.disabled = true;
  
  try {
    const { data: { session } } = await client.auth.getSession();
    if (!session) return;
    
    const url = forceRefresh ? "/api/insights?refresh=true" : "/api/insights";
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    
    const data = await res.json();
    textEl.innerText = data.insight;
    textEl.classList.remove("loading");
    
    if (data.error) {
      textEl.classList.add("error");
    } else {
      textEl.classList.remove("error");
    }
  } catch (e) {
    textEl.innerText = "Unable to load insights right now.";
    textEl.classList.remove("loading");
    textEl.classList.add("error");
  }
  
  if (refreshBtn) refreshBtn.disabled = false;
}

// Bind refresh button
document.getElementById("refresh-insights-btn")?.addEventListener("click", () => {
  fetchInsights(true);
});

async function checkUser() {
  toggleLoading(true);
  try {
    const {
      data: { session },
    } = await client.auth.getSession();
    updateUI(session);
    if (session) {
      await fetchTransactions();
      fetchInsights(); // Non-blocking, load in background
    }
  } catch (err) {
    console.error("Initialization error:", err);
    showToast("Failed to load application", "error");
  } finally {
    toggleLoading(false);
  }
}

function updateUI(s) {
  if (s) {
    document.getElementById("auth-section").classList.add("hidden");
    document.getElementById("app-section").classList.remove("hidden");
    document.getElementById("user-email").innerText = s.user.email;
  } else {
    document.getElementById("auth-section").classList.remove("hidden");
    document.getElementById("app-section").classList.add("hidden");
  }
}

// Init
checkUser();

// --- USER DROPDOWN ---
function toggleUserDropdown() {
  const menu = document.getElementById("user-dropdown-menu");
  menu.classList.toggle("hidden");
}

// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
  const dropdown = document.querySelector(".user-dropdown");
  const menu = document.getElementById("user-dropdown-menu");
  if (dropdown && menu && !dropdown.contains(e.target)) {
    menu.classList.add("hidden");
  }
});

// Close modal and dropdown on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    if (typeof closeConfirm === 'function') closeConfirm(false);
    const menu = document.getElementById("user-dropdown-menu");
    if (menu) menu.classList.add("hidden");
  }
});
