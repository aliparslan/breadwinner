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

async function updateProfile() {
  const newEmail = document.getElementById("profile-email").value;
  const currentPass = document.getElementById("current-password").value;
  const newPass = document.getElementById("profile-password").value;
  
  if (!newEmail) return alert("Email cannot be empty");

  // If changing password, REQUIRE current password
  if (newPass && !currentPass) {
    return alert("Please enter your current password to set a new one.");
  }

  showToast("Updating profile...", "loading");
  
  const { data: { session } } = await client.auth.getSession();
  if (!session) return;

  // 1. Re-authenticate if changing password (security check)
  if (newPass) {
    const { error: authError } = await client.auth.signInWithPassword({ 
      email: session.user.email, 
      password: currentPass 
    });
    
    if (authError) {
      showToast("Incorrect current password", "error");
      return;
    }
  }

  // 2. Prepare Updates
  const updates = {};
  if (newEmail !== session.user.email) updates.email = newEmail;
  if (newPass) updates.password = newPass;

  if (Object.keys(updates).length === 0) {
    showToast("No changes detected", "error");
    return;
  }

  // 3. Execute Update
  const { data, error } = await client.auth.updateUser(updates);

  if (error) {
    showToast(error.message, "error");
  } else {
    // If email was updated, Supabase sends a confirmation link.
    if (updates.email) {
      alert("Confirmation link sent to " + newEmail + ". Please click it to finalize the change.");
      
      // OPTIONAL: Sync to profiles table
      const { error: profileError } = await client.from("profiles").update({ email: newEmail }).eq("id", session.user.id);
      if (profileError) console.error("Profile sync error", profileError);
    }
    
    if (updates.password) {
      document.getElementById("current-password").value = "";
      document.getElementById("profile-password").value = "";
      showToast("Password updated successfully", "success");
    } else if (!updates.email) {
      showToast("Profile updated", "success");
    }
  }
}

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
  // Friendlier "Fresh Start" confirmation
  if (!confirm("Ready for a fresh start? \n\nThis will clear your transaction history so you can begin anew. Accounts and settings will be saved.")) return;

  showToast("Starting fresh...", "loading");
  const {
    data: { session },
  } = await client.auth.getSession();

  // Cascading delete relies on RLS, but explicit is safer
  const { error } = await client.from("statement_logs").delete().eq("user_id", session.user.id);
  const { error: txError } = await client.from("transactions").delete().eq("user_id", session.user.id);

  if (error || txError) showToast("Fresh start failed", "error");
  else {
    showToast("Slate wiped clean!", "success");
    // Clear AI cache so insights align with empty state
    await client.from("profiles").update({ insights_cache: null, insights_updated_at: null }).eq("id", session.user.id);
  }
}

async function confirmDeleteAccount() {
  if (!confirm("DANGER: This will permanently delete your account and all data. Are you sure?")) return;

  // Double confirmation for safety
  if (!confirm("This action cannot be undone. Are you sure you want to proceed?")) return;

  showToast("Deleting account...", "loading");

  const { data: { session } } = await client.auth.getSession();
  if (!session) {
    showToast("Not authenticated", "error");
    return;
  }

  try {
    // Call the server-side delete account endpoint
    const res = await fetch("/api/delete-account", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json"
      },
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      showToast("Failed to delete account: " + (data.error || "Unknown error"), "error");
      return;
    }

    // Account deleted successfully, sign out and redirect
    showToast("Account deleted successfully", "success");
    await client.auth.signOut();

    setTimeout(() => {
      window.location.href = "/";
    }, 1000);

  } catch (error) {
    console.error("Delete account error:", error);
    showToast("Failed to delete account", "error");
  }
}

init();
