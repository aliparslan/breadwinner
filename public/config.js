const SUPABASE_URL = "https://ahvfdteobwmrqkiorhpv.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFodmZkdGVvYndtcnFraW9yaHB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyNzI5NzMsImV4cCI6MjA4Mzg0ODk3M30.2K314udaXPAKiWalxXLNmZHqvv9YQ7iQnUtYyONTPrI";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const CATEGORY_COLORS = {
  "Housing": "#5c4033",
  "Groceries": "#228b22",
  "Transportation": "#4169e1",
  "Subscriptions": "#9932cc",
  "Health": "#dc143c",
  "Shopping": "#daa520",
  "Entertainment": "#ff8c00",
  "Savings": "#20b2aa",
  "Miscellaneous": "#778899",
  "Other": "#708090",
  "Dining": "#db7093",
  "Travel": "#00ced1",
  "Gifts": "#ba55d3",
  "Income": "#2e8b57",
  "Uncategorized": "#a9a9a9",
};

const CATEGORY_PILL_COLORS = {
  "Housing": { bg: "#d4c4bc", text: "#5c4033" },
  "Groceries": { bg: "#c8e6c9", text: "#1b5e20" },
  "Transportation": { bg: "#bbdefb", text: "#1565c0" },
  "Subscriptions": { bg: "#e1bee7", text: "#7b1fa2" },
  "Health": { bg: "#ffcdd2", text: "#b71c1c" },
  "Shopping": { bg: "#fff3cd", text: "#856404" },
  "Entertainment": { bg: "#ffe0b2", text: "#e65100" },
  "Savings": { bg: "#b2dfdb", text: "#00695c" },
  "Miscellaneous": { bg: "#cfd8dc", text: "#546e7a" },
  "Other": { bg: "#cfd8dc", text: "#455a64" },
  "Dining": { bg: "#f8bbd9", text: "#880e4f" },
  "Travel": { bg: "#b2ebf2", text: "#00838f" },
  "Gifts": { bg: "#e1bee7", text: "#6a1b9a" },
  "Income": { bg: "#c8e6c9", text: "#2e7d32" },
  "Uncategorized": { bg: "#e0e0e0", text: "#616161" },
};

function getCategoryColor(categoryName) {
  return CATEGORY_COLORS[categoryName] || CATEGORY_COLORS["Other"];
}

function getCategoryPillStyle(categoryName) {
  const pill = CATEGORY_PILL_COLORS[categoryName] || CATEGORY_PILL_COLORS["Other"];
  return `background-color: ${pill.bg}; color: ${pill.text};`;
}
