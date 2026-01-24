// --- CONFIGURATION ---
const SUPABASE_URL = "https://ahvfdteobwmrqkiorhpv.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFodmZkdGVvYndtcnFraW9yaHB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyNzI5NzMsImV4cCI6MjA4Mzg0ODk3M30.2K314udaXPAKiWalxXLNmZHqvv9YQ7iQnUtYyONTPrI";

// Initialize Client Globally
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- CATEGORY COLORS (for viz bars - saturated) ---
const CATEGORY_COLORS = {
  "Housing": "#5c4033",       // Dark Brown
  "Groceries": "#228b22",     // Forest Green
  "Transportation": "#4169e1", // Royal Blue
  "Subscriptions": "#9932cc", // Purple
  "Health": "#dc143c",        // Crimson
  "Shopping": "#daa520",      // Goldenrod
  "Entertainment": "#ff8c00", // Dark Orange
  "Savings": "#20b2aa",       // Light Sea Green
  "Other": "#708090",         // Slate Gray
  "Dining": "#db7093",        // Pale Violet Red
  "Travel": "#00ced1",        // Dark Turquoise
  "Gifts": "#ba55d3",         // Medium Orchid
  "Income": "#2e8b57",        // Sea Green
  "Uncategorized": "#a9a9a9", // Dark Gray
};

// --- CATEGORY PILL COLORS (lighter backgrounds for pills) ---
const CATEGORY_PILL_COLORS = {
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

function getCategoryColor(categoryName) {
  return CATEGORY_COLORS[categoryName] || CATEGORY_COLORS["Other"];
}

function getCategoryPillStyle(categoryName) {
  const pill = CATEGORY_PILL_COLORS[categoryName] || CATEGORY_PILL_COLORS["Other"];
  return `background-color: ${pill.bg}; color: ${pill.text};`;
}
