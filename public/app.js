// public/app.js

// --- CONFIGURATION ---
const SUPABASE_URL = 'https://ahvfdteobwmrqkiorhpv.supabase.co';
const SUPABASE_KEY = 'YOUR_EYJ_KEY_HERE'; // <--- PASTE KEY HERE

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- HELPER: Fix Currency Display ---
function formatCurrency(amount) {
    const num = parseFloat(amount);
    const isNeg = num < 0;
    const absVal = Math.abs(num).toFixed(2);
    return (isNeg ? '-$' : '$') + absVal;
}

// --- UPLOAD LOGIC ---
const uploadBtn = document.getElementById('upload-btn');
if (uploadBtn) {
    uploadBtn.onclick = async () => {
        const fileInput = document.getElementById('file-input');
        const file = fileInput.files[0];
        const status = document.getElementById('status');

        if (!file) {
            alert("Please select a PDF first!");
            return;
        }

        const { data: { session } } = await client.auth.getSession();
        if (!session) { alert("Please log in first!"); return; }

        status.innerHTML = 'Analyzing... <div class="loader"></div>';
        
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session.access_token}` },
                body: formData
            });

            if (!response.ok) throw new Error(await response.text());

            const data = await response.json();
            renderDashboard(data);
            status.innerText = "✅ Done!";
        } catch (error) {
            status.innerText = "Error: " + error.message;
        }
    };
}

// --- RENDER LOGIC ---
function renderDashboard(transactions) {
    let income = 0;
    let expense = 0;
    const catTotals = {};

    transactions.forEach(tx => {
        const amt = parseFloat(tx.amount);
        if (amt > 0) income += amt;
        else {
            expense += amt;
            const catName = tx.category || "Miscellaneous";
            if (!catTotals[catName]) catTotals[catName] = 0;
            catTotals[catName] += Math.abs(amt);
        }
    });

    const net = income + expense;

    document.getElementById('sum-income').innerText = formatCurrency(income);
    document.getElementById('sum-expense').innerText = formatCurrency(expense);
    document.getElementById('sum-net').innerText = formatCurrency(net);
    document.getElementById('sum-net').className = net >= 0 ? 'positive' : 'negative';

    // Categories
    const catContainer = document.getElementById('category-list');
    catContainer.innerHTML = '';
    
    const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    const maxSpend = sortedCats.length > 0 ? sortedCats[0][1] : 1;

    sortedCats.forEach(([name, total]) => {
        const percent = (total / maxSpend) * 100;
        const html = `
            <div style="margin-bottom: 12px;">
                <div class="cat-row">
                    <span>${name}</span>
                    <span>$${total.toFixed(2)}</span>
                </div>
                <div class="cat-bar-bg">
                    <div class="cat-bar-fill" style="width: ${percent}%;"></div>
                </div>
            </div>
        `;
        catContainer.innerHTML += html;
    });

    // Table
    const tbody = document.getElementById('tx-body');
    tbody.innerHTML = ''; 
    transactions.forEach(tx => {
        const displayAmt = formatCurrency(tx.amount);
        const colorClass = tx.amount < 0 ? 'negative' : 'positive';
        
        const row = `<tr>
            <td data-label="Date">${tx.date}</td>
            <td data-label="Description">${tx.description}</td>
            <td data-label="Category">${tx.category}</td>
            <td data-label="Amount" class="amount ${colorClass}">${displayAmt}</td>
        </tr>`;
        tbody.innerHTML += row;
    });

    document.getElementById('results-area').classList.remove('hidden');
}

// --- AUTH LOGIC ---
async function checkUser() {
    const { data: { session } } = await client.auth.getSession();
    updateUI(session);
}

const loginBtn = document.getElementById('login-btn');
if (loginBtn) {
    loginBtn.onclick = async () => {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) document.getElementById('msg').innerText = error.message;
        else checkUser();
    };
}

const signupBtn = document.getElementById('signup-btn');
if (signupBtn) {
    signupBtn.onclick = async () => {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const { error } = await client.auth.signUp({ email, password });
        if (error) document.getElementById('msg').innerText = error.message;
        else alert("Account created!");
    };
}

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.onclick = async () => {
        await client.auth.signOut();
        updateUI(null);
    };
}

function updateUI(session) {
    const authSection = document.getElementById('auth-section');
    const appSection = document.getElementById('app-section');
    
    if (session) {
        authSection.classList.add('hidden');
        appSection.classList.remove('hidden');
        document.getElementById('user-email').innerText = session.user.email;
    } else {
        authSection.classList.remove('hidden');
        appSection.classList.add('hidden');
        const msg = document.getElementById('msg');
        if(msg) msg.innerText = "";
    }
}

// Start
checkUser();