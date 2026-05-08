async function getAuthToken() {
  const {
    data: { session },
  } = await client.auth.getSession();

  if (!session) {
    throw new Error("No active session");
  }

  return session.access_token;
}

async function apiFetch(url, options = {}) {
  const token = await getAuthToken();
  const headers = { Authorization: `Bearer ${token}`, ...options.headers };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

async function init() {
  toggleLoading(true);
  try {
    const {
      data: { session },
    } = await client.auth.getSession();

    if (!session) {
      window.location.href = "/?login";
      return;
    }

    const email = session.user.email || "";
    const emailDisplay = document.getElementById("profile-email-display");
    if (emailDisplay) emailDisplay.innerText = email;
    const emailAccount = document.getElementById("profile-email-account");
    if (emailAccount) emailAccount.innerText = email;

    try {
      const profile = await apiFetch("/api/profile");
      if (profile.gemini_api_key) {
        document.getElementById("api-key").value = profile.gemini_api_key;
      }
    } catch (e) {
      console.error("Failed to load profile:", e);
    }

    document.getElementById("logout-btn").onclick = async () => {
      toggleLoading(true);
      await client.auth.signOut();
      window.location.href = "/";
    };
  } catch (e) {
    console.error("Profile initialization error:", e);
    showToast("Failed to load settings", "error");
  } finally {
    toggleLoading(false);
  }
}

async function saveKey() {
  const key = document.getElementById("api-key").value;
  if (!key) {
    showToast("Please enter a key", "error");
    return;
  }

  showToast("Saving Key...", "loading");

  try {
    await apiFetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gemini_api_key: key }),
    });
    showToast("API Key saved!", "success");
  } catch {
    showToast("Error saving key", "error");
  }
}

async function testConnection() {
  const key = document.getElementById("api-key").value;
  if (!key) {
    showToast("Enter a key to test first", "error");
    return;
  }

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
      statusDiv.innerHTML = "Connection Successful!";
      statusDiv.style.color = "var(--accent-green)";
    } else {
      statusDiv.innerText = "Error: " + (data.error || "Invalid Key");
      statusDiv.style.color = "var(--accent-red)";
    }
  } catch {
    statusDiv.innerText = "Network Error";
    statusDiv.style.color = "var(--accent-red)";
  }
}

async function confirmReset() {
  if (
    !confirm(
      "Ready for a fresh start? \n\nThis will clear your transaction history so you can begin anew. Accounts and settings will be saved."
    )
  )
    return;

  showToast("Starting fresh...", "loading");

  try {
    await apiFetch("/api/transactions", { method: "DELETE" });

    await apiFetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ insights_cache: null, insights_updated_at: null }),
    });

    showToast("Slate wiped clean!", "success");
  } catch {
    showToast("Fresh start failed", "error");
  }
}

async function confirmDeleteAccount() {
  if (!confirm("DANGER: This will permanently delete your account and all Breadwinner data. Are you sure?"))
    return;
  if (!confirm("This action cannot be undone. Are you sure you want to proceed?")) return;

  showToast("Deleting account...", "loading");

  try {
    await apiFetch("/api/delete-account", { method: "POST" });

    showToast("Account deleted successfully", "success");
    await client.auth.signOut();
    setTimeout(() => {
      window.location.href = "/landing.html";
    }, 1000);
  } catch (e) {
    console.error("Delete account error:", e);
    showToast(e.message || "Failed to delete account", "error");
  }
}

init();
