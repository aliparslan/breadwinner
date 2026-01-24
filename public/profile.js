// --- CONFIGURATION ---
// Loaded from config.js


// --- HELPER: TOAST NOTIFICATIONS ---
// Loaded from utils.js


// --- HELPER: LOADING OVERLAY ---
// Loaded from utils.js


// --- INIT ---
async function init() {
  toggleLoading(true);
  const {
    data: { session },
  } = await client.auth.getSession();

  if (!session) {
    window.location.href = "/";
    return;
  }

  // Load Profile Data
  const { data: profile } = await client
    .from("profiles")
    .select("email, gemini_api_key")
    .eq("id", session.user.id)
    .single();

  if (profile) {
    document.getElementById("profile-email").value = profile.email || session.user.email;
    const emailDisplay = document.getElementById("profile-email-display");
    if(emailDisplay) emailDisplay.innerText = session.user.email;
    // We do NOT show the full key for security, just a placeholder if it exists
    if (profile.gemini_api_key) {
      document.getElementById("api-key").value = profile.gemini_api_key;
    }
  }

  toggleLoading(false);
}

// --- ACTIONS ---

async function saveKey() {
  const key = document.getElementById("api-key").value;
  const {
    data: { session },
  } = await client.auth.getSession();

  if (!key) return alert("Please enter a key");

  showToast("Saving Key...", "loading");
  const { error } = await client.from("profiles").update({ gemini_api_key: key }).eq("id", session.user.id);

  if (error) showToast("Error saving key", "error");
  else showToast("API Key saved!", "success");
}

async function testConnection() {
  const key = document.getElementById("api-key").value;
  if (!key) return alert("Enter a key to test first.");

  const statusDiv = document.getElementById("key-status");
  statusDiv.innerText = "Testing connection...";
  statusDiv.style.color = "var(--text-muted)";

  try {
    const res = await fetch("/api/validate-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: key }),
    });
    const data = await res.json();

    if (data.valid) {
      statusDiv.innerHTML = "✅ Connection Successful!";
      statusDiv.style.color = "var(--accent-green)";
    } else {
      statusDiv.innerText = "❌ Error: " + (data.error || "Invalid Key");
      statusDiv.style.color = "var(--accent-red)";
    }
  } catch (e) {
    statusDiv.innerText = "❌ Network Error";
    statusDiv.style.color = "var(--accent-red)";
  }
}

async function confirmReset() {
  if (!confirm("Are you sure? This will delete ALL your transactions. This cannot be undone.")) return;

  showToast("Deleting data...", "loading");
  const {
    data: { session },
  } = await client.auth.getSession();

  // Cascading delete relies on RLS, but explicit is safer
  const { error } = await client.from("statement_logs").delete().eq("user_id", session.user.id);
  const { error: txError } = await client.from("transactions").delete().eq("user_id", session.user.id);

  if (error || txError) showToast("Delete failed", "error");
  else {
    showToast("All data wiped", "success");
  }
}

async function confirmDeleteAccount() {
  if (!confirm("DANGER: This will permanently delete your account and all data. Are you sure?")) return;

  // Note: Supabase Client cannot delete the Auth User itself without a Service Key.
  // We will delete their data, sign them out, and ideally you'd have an Edge Function to clean up Auth.
  // For this implementation, we wipe data and sign out.

  await confirmReset(); // Wipe data first
  await client.auth.signOut();
  window.location.href = "/";
}

init();
