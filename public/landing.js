// === LANDING PAGE - Mock Data & Component Rendering ===

// Define colors locally to avoid dependency timing issues
const DEMO_CATEGORY_COLORS = {
  "Housing": "#5c4033",
  "Groceries": "#228b22",
  "Transportation": "#4169e1",
  "Subscriptions": "#9932cc",
  "Health": "#dc143c",
  "Shopping": "#daa520",
  "Entertainment": "#ff8c00",
  "Savings": "#20b2aa",
  "Other": "#708090",
  "Dining": "#db7093",
  "Travel": "#00ced1",
  "Gifts": "#ba55d3",
  "Income": "#2e8b57",
  "Uncategorized": "#a9a9a9",
};

const DEMO_PILL_COLORS = {
  "Housing": { bg: "#d4c4bc", text: "#5c4033" },
  "Groceries": { bg: "#c8e6c9", text: "#1b5e20" },
  "Transportation": { bg: "#bbdefb", text: "#1565c0" },
  "Subscriptions": { bg: "#e1bee7", text: "#7b1fa2" },
  "Health": { bg: "#ffcdd2", text: "#b71c1c" },
  "Shopping": { bg: "#fff3cd", text: "#856404" },
  "Entertainment": { bg: "#ffe0b2", text: "#e65100" },
  "Savings": { bg: "#b2dfdb", text: "#00695c" },
  "Other": { bg: "#cfd8dc", text: "#455a64" },
  "Dining": { bg: "#f8bbd9", text: "#880e4f" },
  "Travel": { bg: "#b2ebf2", text: "#00838f" },
  "Gifts": { bg: "#e1bee7", text: "#6a1b9a" },
  "Income": { bg: "#c8e6c9", text: "#2e7d32" },
  "Uncategorized": { bg: "#e0e0e0", text: "#616161" },
};

function getDemoPillStyle(categoryName) {
  const pill = DEMO_PILL_COLORS[categoryName] || DEMO_PILL_COLORS["Other"];
  return `background-color: ${pill.bg}; color: ${pill.text};`;
}

// Mock spending data for visualization
const MOCK_SPENDING_DATA = {
  month: "January 2026",
  spending: 2847.32,
  income: 5200.00,
  net: 2352.68,
  spendingChange: -12,
  incomeChange: 5,
  netChange: 18,
  categories: [
    { name: "Housing", amount: 1200.00, percent: 42.1, color: DEMO_CATEGORY_COLORS["Housing"] },
    { name: "Groceries", amount: 487.23, percent: 17.1, color: DEMO_CATEGORY_COLORS["Groceries"] },
    { name: "Transportation", amount: 342.50, percent: 12.0, color: DEMO_CATEGORY_COLORS["Transportation"] },
    { name: "Dining", amount: 298.45, percent: 10.5, color: DEMO_CATEGORY_COLORS["Dining"] },
    { name: "Entertainment", amount: 245.00, percent: 8.6, color: DEMO_CATEGORY_COLORS["Entertainment"] },
    { name: "Shopping", amount: 189.14, percent: 6.6, color: DEMO_CATEGORY_COLORS["Shopping"] },
    { name: "Other", amount: 85.00, percent: 3.0, color: DEMO_CATEGORY_COLORS["Other"] },
  ]
};

// Mock AI insight
const MOCK_INSIGHT = `Your dining expenses are 23% higher than last month, with most transactions occurring on weekends. Consider meal prepping on Sundays to reduce spontaneous restaurant visits. Your grocery spending is consistent with previous months, which suggests good budgeting habits.`;

// Mock transactions
const MOCK_TRANSACTIONS = [
  { date: "Jan 24", desc: "Whole Foods Market", category: "Groceries", amount: -89.47 },
  { date: "Jan 23", desc: "Spotify Premium", category: "Subscriptions", amount: -10.99 },
  { date: "Jan 23", desc: "Shell Gas Station", category: "Transportation", amount: -52.30 },
  { date: "Jan 22", desc: "Amazon Prime", category: "Shopping", amount: -156.78 },
  { date: "Jan 21", desc: "Chipotle", category: "Dining", amount: -14.25 },
  { date: "Jan 20", desc: "Netflix", category: "Subscriptions", amount: -15.99 },
  { date: "Jan 19", desc: "Target", category: "Shopping", amount: -67.34 },
  { date: "Jan 18", desc: "Uber Eats", category: "Dining", amount: -32.50 },
];

// Format currency
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(Math.abs(amount));
}

// Render the visualization demo
function renderVizDemo() {
  const container = document.getElementById('demo-viz');
  if (!container) return;

  const data = MOCK_SPENDING_DATA;

  // Build stat cards with delta triangles
  // For spending: down (▼) is good (green), up (▲) is bad (red)
  // For income/net: up (▲) is good (green), down (▼) is bad (red)
  const spendingTicker = data.spendingChange !== 0
    ? `<span class="stat-card-ticker" style="color: ${data.spendingChange < 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">${data.spendingChange < 0 ? '▼' : '▲'}${Math.abs(data.spendingChange)}%</span>`
    : '';
  const incomeTicker = data.incomeChange !== 0
    ? `<span class="stat-card-ticker" style="color: ${data.incomeChange > 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">${data.incomeChange > 0 ? '▲' : '▼'}${Math.abs(data.incomeChange)}%</span>`
    : '';
  const netTicker = data.netChange !== 0
    ? `<span class="stat-card-ticker" style="color: ${data.netChange > 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">${data.netChange > 0 ? '▲' : '▼'}${Math.abs(data.netChange)}%</span>`
    : '';

  const statCardsHTML = `
    <div class="stat-cards-row">
      <div class="stat-card">
        <span class="stat-card-label">Money Out</span>
        <div class="stat-card-row">
          <span class="stat-card-value">${formatCurrency(data.spending)}</span>
          ${spendingTicker}
        </div>
      </div>
      <div class="stat-card">
        <span class="stat-card-label">Money In</span>
        <div class="stat-card-row">
          <span class="stat-card-value positive">${formatCurrency(data.income)}</span>
          ${incomeTicker}
        </div>
      </div>
      <div class="stat-card">
        <span class="stat-card-label">Net</span>
        <div class="stat-card-row">
          <span class="stat-card-value positive">${formatCurrency(data.net)}</span>
          ${netTicker}
        </div>
      </div>
    </div>
  `;

  // Build bar segments
  const segmentsHTML = data.categories.map(cat => `
    <div class="viz-segment" style="width: ${cat.percent}%; background-color: ${cat.color};" title="${cat.name}: ${formatCurrency(cat.amount)}"></div>
  `).join('');

  // Build legend items
  const legendHTML = data.categories.slice(0, 6).map(cat => `
    <div class="viz-item">
      <div class="viz-color-pill" style="background-color: ${cat.color};"></div>
      <div class="viz-info">
        <div class="viz-row-top">
          <span class="viz-cat-name">${cat.name}</span>
          <span class="viz-cat-pct">${cat.percent}%</span>
        </div>
        <div class="viz-row-bot">
          <span class="viz-cat-amt">${formatCurrency(cat.amount)}</span>
        </div>
      </div>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="viz-card">
      <div class="viz-header">
        <div class="viz-month-container">
          <span class="viz-month-text">${data.month}</span>
          <svg class="viz-month-arrow-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>
      ${statCardsHTML}
      <div class="viz-breakdown-header">
        <span class="viz-breakdown-title">Spending Breakdown</span>
      </div>
      <div class="viz-bar-container">
        ${segmentsHTML}
      </div>
      <div class="viz-legend">
        ${legendHTML}
      </div>
    </div>
  `;
}

// Render the insights demo
function renderInsightsDemo() {
  const container = document.getElementById('demo-insights');
  if (!container) return;

  container.innerHTML = `
    <div class="insights-card">
      <div class="insights-header">
        <svg class="insights-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
        </svg>
        <span class="insights-title">AI Insights</span>
        <button class="insights-refresh" title="Refresh insights" disabled>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
        </button>
      </div>
      <p class="insights-body">${MOCK_INSIGHT}</p>
    </div>
  `;
}

// Render the transactions demo
function renderTransactionsDemo() {
  const container = document.getElementById('demo-transactions');
  if (!container) return;

  const rowsHTML = MOCK_TRANSACTIONS.map(tx => {
    const isIncome = tx.amount > 0;
    const amountClass = isIncome ? 'positive' : '';
    const amountStr = (isIncome ? '+' : '-') + formatCurrency(tx.amount);
    const pillStyle = getDemoPillStyle(tx.category);

    return `
      <tr>
        <td>${tx.date}</td>
        <td>${tx.desc}</td>
        <td><span class="category-badge" style="${pillStyle}">${tx.category}</span></td>
        <td class="${amountClass}">${amountStr}</td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <div class="demo-tx-container">
      <div class="month-group">
        <button class="month-header" aria-expanded="true">
          <span>January 2026</span>
          <span>$2,847.32</span>
        </button>
        <div class="month-content">
          <table class="demo-tx-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHTML}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// Initialize all demos when page loads
document.addEventListener('DOMContentLoaded', () => {
  renderVizDemo();
  renderInsightsDemo();
  renderTransactionsDemo();
});
