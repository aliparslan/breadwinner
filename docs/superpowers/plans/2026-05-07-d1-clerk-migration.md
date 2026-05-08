# Supabase → Cloudflare D1 + Clerk Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Supabase (auth + database) with Clerk (auth) and Cloudflare D1 (database), keeping the same app functionality.

**Architecture:** Clerk handles all auth via its vanilla JS SDK (frontend) and JWT verification via `@clerk/backend` (API middleware). D1 replaces PostgreSQL with SQLite — all data queries move from Supabase client SDK to SQL via D1 bindings in Pages Functions. Frontend switches from direct Supabase queries to fetch() calls against new REST API endpoints.

**Tech Stack:** Cloudflare Pages + D1, Clerk JS SDK, @clerk/backend, @google/generative-ai (unchanged)

---

## File Structure

```
breadwinner/
├── db/
│   ├── schema.sql                  # NEW - D1 table definitions
│   └── seed.sql                    # NEW - Predefined categories
├── functions/
│   └── api/
│       ├── _middleware.ts          # NEW - Clerk JWT verification
│       ├── categories.ts          # NEW - GET /api/categories
│       ├── transactions.ts        # NEW - GET/POST /api/transactions
│       ├── transaction/
│       │   └── [id].ts            # NEW - PUT/DELETE /api/transaction/:id
│       ├── profile.ts             # NEW - GET/PUT /api/profile
│       ├── upload.ts              # MODIFY - D1 instead of Supabase
│       ├── insights.ts            # MODIFY - D1 instead of Supabase
│       ├── delete-account.ts      # MODIFY - D1 + Clerk user deletion
│       └── validate-key.ts        # UNCHANGED
├── public/
│   ├── index.html                 # MODIFY - Clerk SDK, remove Supabase
│   ├── profile.html               # MODIFY - Clerk SDK, remove Supabase, simplify account section
│   ├── landing.html               # UNCHANGED
│   ├── app.js                     # MODIFY - Clerk auth, fetch() data layer
│   ├── config.js                  # MODIFY - Remove Supabase, add Clerk key
│   ├── utils.js                   # UNCHANGED
│   ├── profile.js                 # MODIFY - Clerk auth, fetch() data layer
│   ├── landing.js                 # UNCHANGED
│   ├── styles.css                 # UNCHANGED
│   └── landing.css                # UNCHANGED
├── wrangler.toml                  # NEW - D1 binding + Clerk vars
└── package.json                   # MODIFY - swap deps
```

---

### Task 1: Database Schema & Seed Data

**Files:**
- Create: `db/schema.sql`
- Create: `db/seed.sql`

- [ ] **Step 1: Create D1 schema**

Create `db/schema.sql`:

```sql
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS statement_logs;
DROP TABLE IF EXISTS profiles;
DROP TABLE IF EXISTS categories;

CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE profiles (
  user_id TEXT PRIMARY KEY,
  gemini_api_key TEXT,
  insights_cache TEXT,
  insights_updated_at TEXT
);

CREATE TABLE statement_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  statement_id INTEGER REFERENCES statement_logs(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  amount REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_statement_logs_user_id ON statement_logs(user_id);
```

- [ ] **Step 2: Create category seed data**

Create `db/seed.sql`:

```sql
INSERT INTO categories (name) VALUES
  ('Dining'),
  ('Entertainment'),
  ('Gifts'),
  ('Groceries'),
  ('Health'),
  ('Housing'),
  ('Income'),
  ('Miscellaneous'),
  ('Other'),
  ('Savings'),
  ('Shopping'),
  ('Subscriptions'),
  ('Transportation'),
  ('Travel'),
  ('Uncategorized');
```

- [ ] **Step 3: Commit**

```bash
git add db/schema.sql db/seed.sql
git commit -m "feat: add D1 database schema and category seed data"
```

---

### Task 2: Wrangler Config & Dependencies

**Files:**
- Create: `wrangler.toml`
- Modify: `package.json`

- [ ] **Step 1: Create wrangler.toml**

Create `wrangler.toml`:

```toml
name = "breadwinner"
compatibility_date = "2024-12-01"
pages_build_output_dir = "public"

[[d1_databases]]
binding = "DB"
database_name = "breadwinner"
database_id = "YOUR_DATABASE_ID"
```

> The user must replace `YOUR_DATABASE_ID` after running `npx wrangler d1 create breadwinner`.

- [ ] **Step 2: Update package.json dependencies**

Replace `@supabase/supabase-js` with `@clerk/backend`:

```json
{
  "dependencies": {
    "@clerk/backend": "^1",
    "@google/generative-ai": "^0.24.1",
    "wrangler": "^4.58.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20260113.0"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add wrangler.toml package.json
git commit -m "feat: add wrangler config and swap supabase for clerk dependency"
```

---

### Task 3: API Auth Middleware

**Files:**
- Create: `functions/api/_middleware.ts`

- [ ] **Step 1: Create Clerk auth middleware**

Create `functions/api/_middleware.ts`:

```typescript
import { verifyToken } from "@clerk/backend";

interface Env {
  DB: D1Database;
  CLERK_SECRET_KEY: string;
  CLERK_PUBLISHABLE_KEY: string;
  GEMINI_API_KEY: string;
}

const PUBLIC_ROUTES = ["/api/validate-key"];

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);

  if (PUBLIC_ROUTES.includes(url.pathname)) {
    return context.next();
  }

  const authHeader = context.request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const token = authHeader.slice(7);
  try {
    const payload = await verifyToken(token, {
      secretKey: context.env.CLERK_SECRET_KEY,
    });
    context.data.userId = payload.sub;
    return context.next();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add functions/api/_middleware.ts
git commit -m "feat: add Clerk JWT auth middleware for API routes"
```

---

### Task 4: Categories API

**Files:**
- Create: `functions/api/categories.ts`

- [ ] **Step 1: Create categories endpoint**

Create `functions/api/categories.ts`:

```typescript
interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare(
    "SELECT id, name FROM categories ORDER BY name"
  ).all();

  return Response.json(results);
};
```

- [ ] **Step 2: Commit**

```bash
git add functions/api/categories.ts
git commit -m "feat: add categories GET endpoint"
```

---

### Task 5: Transactions API

**Files:**
- Create: `functions/api/transactions.ts`
- Create: `functions/api/transaction/[id].ts`

- [ ] **Step 1: Create transactions list + create endpoint**

Create `functions/api/transactions.ts`:

```typescript
interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async ({ env, data }) => {
  const userId = (data as any).userId;

  const { results } = await env.DB.prepare(`
    SELECT t.id, t.user_id, t.category_id, t.statement_id, t.date,
           t.description, t.amount, t.created_at, c.name as category_name
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ?
    ORDER BY t.date DESC
  `).bind(userId).all();

  return Response.json(results);
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env, data }) => {
  const userId = (data as any).userId;
  const body = await request.json() as {
    description: string;
    amount: number;
    date: string;
    category_id: number;
  };

  const result = await env.DB.prepare(`
    INSERT INTO transactions (user_id, category_id, date, description, amount)
    VALUES (?, ?, ?, ?, ?)
  `).bind(userId, body.category_id, body.date, body.description, body.amount).run();

  return Response.json({ id: result.meta.last_row_id, ...body, user_id: userId });
};
```

- [ ] **Step 2: Create single-transaction endpoint (update + delete)**

Create directory and file `functions/api/transaction/[id].ts`:

```typescript
interface Env {
  DB: D1Database;
}

export const onRequestPut: PagesFunction<Env> = async ({ request, env, data, params }) => {
  const userId = (data as any).userId;
  const id = params.id;
  const body = await request.json() as {
    description: string;
    amount: number;
    date: string;
    category_id: number;
  };

  const result = await env.DB.prepare(`
    UPDATE transactions
    SET description = ?, amount = ?, date = ?, category_id = ?
    WHERE id = ? AND user_id = ?
  `).bind(body.description, body.amount, body.date, body.category_id, id, userId).run();

  if (result.meta.changes === 0) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return Response.json({ success: true });
};

export const onRequestDelete: PagesFunction<Env> = async ({ env, data, params }) => {
  const userId = (data as any).userId;
  const id = params.id;

  const result = await env.DB.prepare(
    "DELETE FROM transactions WHERE id = ? AND user_id = ?"
  ).bind(id, userId).run();

  if (result.meta.changes === 0) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return Response.json({ success: true });
};
```

- [ ] **Step 3: Commit**

```bash
git add functions/api/transactions.ts functions/api/transaction/
git commit -m "feat: add transactions CRUD API endpoints"
```

---

### Task 6: Profile API

**Files:**
- Create: `functions/api/profile.ts`

- [ ] **Step 1: Create profile endpoint with lazy creation**

Create `functions/api/profile.ts`:

```typescript
interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async ({ env, data }) => {
  const userId = (data as any).userId;

  const { results } = await env.DB.prepare(
    "SELECT * FROM profiles WHERE user_id = ?"
  ).bind(userId).all();

  if (results.length === 0) {
    await env.DB.prepare(
      "INSERT INTO profiles (user_id) VALUES (?)"
    ).bind(userId).run();
    return Response.json({ user_id: userId, gemini_api_key: null, insights_cache: null, insights_updated_at: null });
  }

  return Response.json(results[0]);
};

export const onRequestPut: PagesFunction<Env> = async ({ request, env, data }) => {
  const userId = (data as any).userId;
  const body = await request.json() as Record<string, any>;

  const allowedFields = ["gemini_api_key", "insights_cache", "insights_updated_at"];
  const updates: string[] = [];
  const values: any[] = [];

  for (const field of allowedFields) {
    if (field in body) {
      updates.push(`${field} = ?`);
      values.push(body[field]);
    }
  }

  if (updates.length === 0) {
    return new Response(JSON.stringify({ error: "No valid fields to update" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  values.push(userId);

  await env.DB.prepare(
    `INSERT INTO profiles (user_id) VALUES (?) ON CONFLICT(user_id) DO NOTHING`
  ).bind(userId).run();

  await env.DB.prepare(
    `UPDATE profiles SET ${updates.join(", ")} WHERE user_id = ?`
  ).bind(...values).run();

  return Response.json({ success: true });
};
```

- [ ] **Step 2: Commit**

```bash
git add functions/api/profile.ts
git commit -m "feat: add profile API with lazy creation"
```

---

### Task 7: Migrate Upload Endpoint

**Files:**
- Modify: `functions/api/upload.ts`

- [ ] **Step 1: Rewrite upload.ts for D1**

Replace the entire file contents of `functions/api/upload.ts`:

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

interface Env {
  DB: D1Database;
  GEMINI_API_KEY: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env, data }) => {
  try {
    const userId = (data as any).userId;

    const { results: profile } = await env.DB.prepare(
      "SELECT gemini_api_key FROM profiles WHERE user_id = ?"
    ).bind(userId).all();

    const activeApiKey = profile?.[0]?.gemini_api_key || env.GEMINI_API_KEY;
    if (!activeApiKey) {
      return new Response("No AI API Key configured. Please add one in Settings.", { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const rawText = formData.get("text") as string | null;
    const filename = (formData.get("filename") as string) || (file ? file.name : "Unknown_Upload.pdf");

    if (!file && !rawText) return new Response("No content uploaded", { status: 400 });

    const { results: categories } = await env.DB.prepare(
      "SELECT id, name FROM categories"
    ).all();
    if (!categories?.length) return new Response("Could not fetch categories", { status: 500 });
    const categoryNames = categories.map((c: any) => c.name).join(", ");

    const genAI = new GoogleGenerativeAI(activeApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    let result;
    try {
      if (rawText) {
        const prompt = `
            Extract date, description, and amount for every transaction from this bank/credit card statement text.
            
            CRITICAL RULES FOR AMOUNT INTERPRETATION:
            1. First, identify the statement type:
               - BANK ACCOUNT (checking/savings): Look for "Balance", "Debit", "Credit" labels, account balances
               - CREDIT CARD: Look for "Payments, Credits and Adjustments", "Transactions", "Amount Owed"
            
            2. Apply the CORRECT sign convention based on statement type:
               
               FOR BANK ACCOUNTS:
               - Debits/Spending/Purchases = NEGATIVE amounts (money leaving account)
               - Credits/Deposits/Income = POSITIVE amounts (money entering account)
               
               FOR CREDIT CARDS:
               - Payments/Credits (reduces balance owed) = POSITIVE amounts
               - Purchases/Charges/Transactions = NEGATIVE amounts
            
            3. Categorize into: [${categoryNames}]. Use "Other" if unsure.
            
            4. Return ONLY raw JSON array: [{ "date": "YYYY-MM-DD", "description": "txt", "amount": -10.00, "category": "ExactName" }]
            
            TEXT:
            ${rawText}
          `;
        result = await model.generateContent(prompt);
      } else if (file) {
        const arrayBuffer = await file.arrayBuffer();
        const base64Data = btoa(new Uint8Array(arrayBuffer).reduce((d, byte) => d + String.fromCharCode(byte), ""));
        const prompt = `
          Extract all transactions from this bank/credit card statement image.
          
          CRITICAL: Identify if this is a BANK ACCOUNT or CREDIT CARD statement:
          
          BANK ACCOUNT: Debits = NEGATIVE, Credits = POSITIVE
          CREDIT CARD: Payments = POSITIVE, Charges = NEGATIVE
          
          Categories: [${categoryNames}]. Return JSON: [{"date":"YYYY-MM-DD","description":"text","amount":number,"category":"name"}]
        `;
        result = await model.generateContent([prompt, { inlineData: { data: base64Data, mimeType: file.type } }]);
      }
    } catch (aiError: any) {
      if (aiError.status === 429 || aiError.message?.includes("429") || aiError.message?.includes("rate")) {
        return new Response("AI rate limit reached. Please try again in a few minutes.", { status: 429 });
      }
      throw aiError;
    }

    const rawOutput = result!.response.text();
    const jsonMatch = rawOutput.match(/\[.*\]/s);
    if (!jsonMatch) return new Response("AI failed to generate valid JSON", { status: 422 });

    let parsedTransactions;
    try {
      parsedTransactions = JSON.parse(jsonMatch[0]);
    } catch {
      return new Response("JSON Parse Error: " + rawOutput, { status: 422 });
    }

    const stmtResult = await env.DB.prepare(
      "INSERT INTO statement_logs (user_id, filename) VALUES (?, ?) RETURNING id"
    ).bind(userId, filename).first<{ id: number }>();
    if (!stmtResult) throw new Error("Failed to create statement log");

    const insertStmt = env.DB.prepare(`
      INSERT INTO transactions (user_id, statement_id, category_id, date, description, amount)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const batchOps = parsedTransactions.map((tx: any) => {
      const catMatch = categories.find((c: any) => c.name === tx.category);
      const categoryId = catMatch
        ? (catMatch as any).id
        : (categories.find((c: any) => c.name === "Miscellaneous") as any)?.id;
      return insertStmt.bind(userId, stmtResult.id, categoryId, tx.date, tx.description, tx.amount);
    });

    await env.DB.batch(batchOps);

    const { results: inserted } = await env.DB.prepare(
      "SELECT * FROM transactions WHERE statement_id = ? AND user_id = ?"
    ).bind(stmtResult.id, userId).all();

    return Response.json(inserted);
  } catch (err: any) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add functions/api/upload.ts
git commit -m "refactor: migrate upload endpoint from Supabase to D1"
```

---

### Task 8: Migrate Insights Endpoint

**Files:**
- Modify: `functions/api/insights.ts`

- [ ] **Step 1: Rewrite insights.ts for D1**

Replace the entire file contents of `functions/api/insights.ts`:

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

interface Env {
  DB: D1Database;
  GEMINI_API_KEY: string;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env, data }) => {
  try {
    const userId = (data as any).userId;
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get("refresh") === "true";

    const profile = await env.DB.prepare(
      "SELECT gemini_api_key, insights_cache, insights_updated_at FROM profiles WHERE user_id = ?"
    ).bind(userId).first<{ gemini_api_key: string | null; insights_cache: string | null; insights_updated_at: string | null }>();

    const txCount = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM transactions WHERE user_id = ?"
    ).bind(userId).first<{ count: number }>();

    if (!txCount || txCount.count === 0) {
      if (profile?.insights_cache) {
        await env.DB.prepare(
          "UPDATE profiles SET insights_cache = NULL, insights_updated_at = NULL WHERE user_id = ?"
        ).bind(userId).run();
      }
      return Response.json({
        insight: "Add some transactions to get personalized spending insights!",
        cached: false,
      });
    }

    if (!forceRefresh && profile?.insights_cache && profile?.insights_updated_at) {
      const updatedAt = new Date(profile.insights_updated_at);
      const hoursSinceUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceUpdate < 24) {
        return Response.json({ insight: profile.insights_cache, cached: true });
      }
    }

    const { results: transactions } = await env.DB.prepare(`
      SELECT t.amount, t.date, c.name as category_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ?
      ORDER BY t.date DESC
      LIMIT 200
    `).bind(userId).all();

    if (!transactions?.length) {
      return Response.json({
        insight: "Add some transactions to get personalized spending insights!",
        cached: false,
      });
    }

    let totalIncome = 0;
    let totalExpenses = 0;
    const categoryTotals: Record<string, number> = {};
    const catCounts: Record<string, number> = {};
    const monthlyTotals: Record<string, { income: number; expenses: number }> = {};

    transactions.forEach((tx: any) => {
      const amt = parseFloat(tx.amount);
      const monthKey = tx.date.substring(0, 7);
      const catName = tx.category_name || "Other";

      if (!monthlyTotals[monthKey]) monthlyTotals[monthKey] = { income: 0, expenses: 0 };

      if (amt > 0) {
        totalIncome += amt;
        monthlyTotals[monthKey].income += amt;
      } else {
        totalExpenses += Math.abs(amt);
        monthlyTotals[monthKey].expenses += Math.abs(amt);
        categoryTotals[catName] = (categoryTotals[catName] || 0) + Math.abs(amt);
      }
      catCounts[catName] = (catCounts[catName] || 0) + 1;
    });

    const detailedCategories = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, total]) => `${name}: $${total.toFixed(0)} (${catCounts[name] || 0} txs)`)
      .join(", ");

    let largestAmt = 0;
    let largestCat = "None";
    transactions.forEach((tx: any) => {
      const abs = Math.abs(parseFloat(tx.amount));
      if (abs > largestAmt) {
        largestAmt = abs;
        largestCat = tx.category_name || "Other";
      }
    });

    const activeApiKey = profile?.gemini_api_key || env.GEMINI_API_KEY;
    if (!activeApiKey) {
      return new Response("No AI API Key configured", { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(activeApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const prompt = `Role: Financial Data Analyst.
Task: Synthesize the provided transaction data into behavioral insights.

Guidelines:
- Ignore the Obvious: Do not simply list the largest categories unless they show an unusual spike or deviation.
- Identify Anomalies: Focus on unusual transaction frequencies, large single purchases, or spending concentration.
- Infer Patterns: Connect the data to logical lifestyle assumptions.
- Format: 3-5 sentences. No advice or tips. Max 100 words. Be specific with numbers.

Context Data:
- Total Spending: $${totalExpenses.toFixed(0)} over ${Object.keys(monthlyTotals).length} months
- Breakdown: ${detailedCategories}
- Largest Single Purchase: ${largestCat} ($${largestAmt.toFixed(0)})
- Transaction Volume: ${transactions.length} recorded transactions
`;

    let result;
    try {
      result = await model.generateContent(prompt);
    } catch (aiError: any) {
      if (aiError.status === 429 || aiError.message?.includes("429")) {
        return Response.json(
          { insight: "AI rate limit reached. Please try again in a few minutes.", error: true },
          { status: 429 }
        );
      }
      throw aiError;
    }

    const insight = result.response.text().trim();

    await env.DB.prepare(
      `INSERT INTO profiles (user_id, insights_cache, insights_updated_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET insights_cache = ?, insights_updated_at = ?`
    ).bind(userId, insight, new Date().toISOString(), insight, new Date().toISOString()).run();

    return Response.json({ insight, cached: false });
  } catch (err: any) {
    console.error("Insights error:", err);
    return Response.json(
      { insight: "Unable to generate insights right now. Please try again later.", error: true },
      { status: 500 }
    );
  }
};
```

Note: This also fixes the bug where `?refresh=true` was ignored — the query param is now read and used to bypass cache.

- [ ] **Step 2: Commit**

```bash
git add functions/api/insights.ts
git commit -m "refactor: migrate insights endpoint to D1, fix refresh param bug"
```

---

### Task 9: Migrate Delete Account Endpoint

**Files:**
- Modify: `functions/api/delete-account.ts`

- [ ] **Step 1: Rewrite delete-account.ts for D1 + Clerk**

Replace the entire file contents of `functions/api/delete-account.ts`:

```typescript
import { createClerkClient } from "@clerk/backend";

interface Env {
  DB: D1Database;
  CLERK_SECRET_KEY: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ env, data }) => {
  try {
    const userId = (data as any).userId;

    await env.DB.prepare("DELETE FROM transactions WHERE user_id = ?").bind(userId).run();
    await env.DB.prepare("DELETE FROM statement_logs WHERE user_id = ?").bind(userId).run();
    await env.DB.prepare("DELETE FROM profiles WHERE user_id = ?").bind(userId).run();

    const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
    await clerk.users.deleteUser(userId);

    return Response.json({ success: true });
  } catch (err: any) {
    console.error("Delete account error:", err);
    return Response.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
};
```

- [ ] **Step 2: Delete test endpoint**

Delete `functions/api/test.ts` — it's not needed.

- [ ] **Step 3: Commit**

```bash
git rm functions/api/test.ts
git add functions/api/delete-account.ts
git commit -m "refactor: migrate delete-account to D1 + Clerk, remove test endpoint"
```

---

### Task 10: Frontend — HTML & Config

**Files:**
- Modify: `public/index.html`
- Modify: `public/profile.html`
- Modify: `public/config.js`

- [ ] **Step 1: Update index.html**

In `public/index.html`, make these changes:

Replace the two Supabase/pdf.js script tags in `<head>`:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script>
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
</script>
```

With:
```html
<script src="https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script>
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
</script>
```

Replace the auth section `<div id="auth-section">` entirely:

```html
<div id="auth-section" class="auth-container hidden">
  <div id="clerk-sign-in"></div>
</div>
```

- [ ] **Step 2: Update profile.html**

In `public/profile.html`, make these changes:

Replace the Supabase script tag:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

With:
```html
<script src="https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js"></script>
```

Replace the inline `onclick` on the logout button:
```html
<button class="secondary logout-btn" onclick="client.auth.signOut().then(() => window.location.href = '/')">Log Out</button>
```

With:
```html
<button class="secondary logout-btn" id="logout-btn">Log Out</button>
```

Remove the entire Account settings section (the `<div class="section-header"><h3>Account</h3></div>` and the `<div class="settings-group">` with email/password fields and Update Profile button, and the `<div class="settings-divider"></div>` after it). Replace it with:

```html
<div class="section-header">
  <h3>Account</h3>
</div>
<div class="settings-group">
  <div style="display: flex; justify-content: space-between; align-items: center;">
    <div>
      <p id="profile-email-display" style="font-weight: 600; margin: 0;"></p>
      <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 4px 0 0 0;">
        Manage your email, password, and security via Clerk.
      </p>
    </div>
    <button class="secondary" id="manage-account-btn">Manage Account</button>
  </div>
</div>

<div class="settings-divider"></div>
```

- [ ] **Step 3: Rewrite config.js**

Replace the entire contents of `public/config.js`:

```javascript
const CLERK_PUBLISHABLE_KEY = "__CLERK_PUBLISHABLE_KEY__";

const CATEGORY_COLORS = {
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
```

> The user must replace `__CLERK_PUBLISHABLE_KEY__` with their actual Clerk publishable key.

- [ ] **Step 4: Commit**

```bash
git add public/index.html public/profile.html public/config.js
git commit -m "refactor: swap Supabase SDK for Clerk in HTML/config"
```

---

### Task 11: Frontend — App.js Rewrite

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Rewrite app.js**

Replace the entire contents of `public/app.js`. The core changes: Clerk replaces Supabase auth, all data queries become fetch() calls, `getAuthToken()` helper centralizes token retrieval.

```javascript
let allCategories = [];
let allTransactions = [];

const clerk = new window.Clerk(CLERK_PUBLISHABLE_KEY);

async function getAuthToken() {
  return await clerk.session.getToken();
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

async function fetchTransactions() {
  try {
    allCategories = await apiFetch("/api/categories");
  } catch (e) {
    console.error(e);
    showToast("Error loading categories", "error");
    return;
  }

  const filterSelect = document.getElementById("filter-category");
  const currentVal = filterSelect.value;

  filterSelect.innerHTML =
    '<option value="all">All</option>' +
    allCategories.map((c) => `<option value="${c.name}">${c.name}</option>`).join("");

  filterSelect.value = currentVal;

  try {
    const data = await apiFetch("/api/transactions");
    allTransactions = data.map((tx) => ({
      ...tx,
      categoryName: tx.category_name || "Uncategorized",
      categoryId: tx.category_id,
    }));
  } catch (e) {
    console.error(e);
    showToast("Error loading data", "error");
    return;
  }

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

  const isFiltering = cat !== "all" || search.length > 0;
  renderDashboard(filtered, isFiltering);
}

document.getElementById("filter-search").addEventListener("input", debounce(applyFilters, 300));
document.getElementById("filter-category").addEventListener("change", applyFilters);

window.filterByCategoryAndScroll = function (categoryName) {
  const select = document.getElementById("filter-category");
  if (!select) return;

  let found = false;
  for (let i = 0; i < select.options.length; i++) {
    if (select.options[i].value === categoryName) {
      select.selectedIndex = i;
      found = true;
      break;
    }
  }

  if (!found) {
    if (categoryName === "Other") {
      showToast("Cannot filter by 'Other' group", "error");
    } else {
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
let vizMonthsData = {};
let vizSortedMonthKeys = [];
let vizCurrentMonthIndex = 0;
let vizAllTransactions = [];

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

window.showVizTooltip = showVizTooltip;
window.hideVizTooltip = hideVizTooltip;
window.moveVizTooltip = moveVizTooltip;

function renderMonthlyViz(transactions) {
  const container = document.getElementById("monthly-viz");
  if (!container) return;

  vizAllTransactions = transactions;

  const expenses = transactions
    .filter((t) => parseFloat(t.amount) < 0)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (expenses.length === 0) {
    container.classList.add("hidden");
    return;
  }

  vizMonthsData = { all: [] };
  expenses.forEach((t) => {
    const key = t.date.substring(0, 7);
    if (!vizMonthsData[key]) vizMonthsData[key] = [];
    vizMonthsData[key].push(t);
    vizMonthsData["all"].push(t);
  });

  const monthKeys = Object.keys(vizMonthsData)
    .filter((k) => k !== "all")
    .sort()
    .reverse();
  vizSortedMonthKeys = ["all", ...monthKeys];

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

  const currentTxs = vizMonthsData[currentKey];
  if (!currentTxs) return;

  const currentTotal = currentTxs.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

  let periodIncome = 0,
    periodExpense = 0;
  const periodTransactions = isAllTime
    ? vizAllTransactions
    : vizAllTransactions.filter((t) => t.date.startsWith(currentKey));

  periodTransactions.forEach((tx) => {
    const amt = parseFloat(tx.amount);
    if (amt > 0) periodIncome += amt;
    else periodExpense += Math.abs(amt);
  });
  const periodNet = periodIncome - periodExpense;

  let prevTotal = 0;
  let prevCatTotals = {};
  if (prevKey && prevKey !== "all") {
    const prevTxs = vizMonthsData[prevKey];
    if (prevTxs) {
      prevTotal = prevTxs.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);
      prevTxs.forEach((t) => {
        prevCatTotals[t.categoryName] =
          (prevCatTotals[t.categoryName] || 0) + Math.abs(parseFloat(t.amount));
      });
    }
  }

  const currentCatTotals = {};
  currentTxs.forEach((t) => {
    currentCatTotals[t.categoryName] =
      (currentCatTotals[t.categoryName] || 0) + Math.abs(parseFloat(t.amount));
  });

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
      prevAmount: prevAmt,
    };
  });
  catStats.sort((a, b) => b.amount - a.amount);

  const totalVal = currentTotal;
  const barStats = [];
  let otherAmt = 0;
  let otherIncluded = [];

  catStats.forEach((c) => {
    const pct = totalVal > 0 ? (c.amount / totalVal) * 100 : 0;
    if (pct < 3 && c.name !== "Other") {
      otherAmt += c.amount;
      otherIncluded.push(c);
    } else {
      barStats.push(c);
    }
  });

  if (otherAmt > 0) {
    const existingOther = barStats.find((c) => c.name === "Other");
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
        included: otherIncluded,
      });
    }
  }
  barStats.sort((a, b) => b.amount - a.amount);

  const monthDropdownOptions = vizSortedMonthKeys
    .map((key, idx) => {
      let displayName;
      if (key === "all") {
        displayName = "All Time";
      } else {
        const [y, m] = key.split("-");
        displayName = new Date(parseInt(y), parseInt(m) - 1).toLocaleString("default", {
          month: "long",
          year: "numeric",
        });
      }
      return `<option value="${idx}" ${idx === monthIndex ? "selected" : ""}>${displayName}</option>`;
    })
    .join("");

  let prevIncomeVal = 0,
    prevExpenseVal = 0,
    prevNetVal = 0;
  if (prevKey && prevKey !== "all") {
    const prevPeriodTxs = vizAllTransactions.filter((t) => t.date.startsWith(prevKey));
    prevPeriodTxs.forEach((tx) => {
      const amt = parseFloat(tx.amount);
      if (amt > 0) prevIncomeVal += amt;
      else prevExpenseVal += Math.abs(amt);
    });
    prevNetVal = prevIncomeVal - prevExpenseVal;
  }

  function getTickerHtml(current, prev, invertColors = false) {
    if (isAllTime) return "";
    if (prev === 0) {
      if (current > 0)
        return `<span class="stat-card-ticker" style="color: var(--text-muted)">New</span>`;
      return "";
    }
    const deltaPct = ((current - prev) / prev) * 100;
    if (Math.abs(deltaPct) < 0.1)
      return `<span class="stat-card-ticker" style="color: var(--text-muted)">—</span>`;
    const isUp = deltaPct > 0;
    const upColor = invertColors ? "var(--accent-red)" : "var(--accent-green)";
    const downColor = invertColors ? "var(--accent-green)" : "var(--accent-red)";
    const color = isUp ? upColor : downColor;
    const arrow = isUp ? "▲" : "▼";
    const fmtPct = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: Math.abs(deltaPct) >= 1000 ? 0 : 1,
      maximumFractionDigits: Math.abs(deltaPct) >= 1000 ? 0 : 1,
    }).format(Math.abs(deltaPct));
    return `<span class="stat-card-ticker" style="color: ${color}">${arrow} ${fmtPct}%</span>`;
  }

  const barsHtml = barStats
    .map((c) => {
      const color = c.name === "Other" ? "#d6d3d1" : getCategoryColor(c.name);
      let tooltipContent = "";
      const amtStr = formatCurrency(c.amount, true);
      const pctStr = c.pctOfTotal.toFixed(1) + "%";

      if (c.name === "Other" && c.included && c.included.length > 0) {
        c.included.sort((a, b) => b.amount - a.amount);
        const rows = c.included
          .map((sub) => {
            const subPct = totalVal > 0 ? (sub.amount / totalVal) * 100 : 0;
            return `
          <div class="viz-tooltip-row">
            <span>${sub.name}</span>
            <span>${subPct.toFixed(1)}%</span>
          </div>
        `;
          })
          .join("");
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

      const safeTooltip = tooltipContent.replace(/"/g, "&quot;");

      return `<div class="viz-segment" 
           style="flex: ${c.pctOfTotal} 1 0px; background: ${color}" 
           data-tooltip-html="${safeTooltip}"
           onclick="filterByCategoryAndScroll('${c.name.replace(/'/g, "\\'")}')"
           onmouseenter="showVizTooltip(event, this.getAttribute('data-tooltip-html'))"
           onmousemove="moveVizTooltip(event)"
           onmouseleave="hideVizTooltip()"
           ></div>`;
    })
    .join("");

  const legendHtml = catStats
    .map((c) => {
      const color = getCategoryColor(c.name);
      let deltaStr, deltaColor;
      if (isAllTime) {
        deltaStr = "";
        deltaColor = "transparent";
      } else if (c.prevAmount === 0) {
        deltaStr = "New";
        deltaColor = "var(--text-muted)";
      } else if (Math.abs(c.delta) < 0.1) {
        deltaStr = "—";
        deltaColor = "var(--text-muted)";
      } else {
        const absDelta = Math.abs(c.delta);
        const fmtDelta = new Intl.NumberFormat("en-US", {
          minimumFractionDigits: absDelta >= 1000 ? 0 : 1,
          maximumFractionDigits: absDelta >= 1000 ? 0 : 1,
        }).format(c.delta);
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
    })
    .join("");

  container.innerHTML = `
    <div class="viz-card">
      <div class="viz-header">
        <div class="viz-month-container">
          <span class="viz-month-text">${
            isAllTime
              ? "All Time"
              : new Date(
                  parseInt(currentKey.split("-")[0]),
                  parseInt(currentKey.split("-")[1]) - 1
                ).toLocaleString("default", { month: "long", year: "numeric" })
          }</span>
          <svg class="viz-month-arrow-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          <select id="viz-month-dropdown" class="viz-month-overlay" onchange="onVizMonthChange(this.value)">${monthDropdownOptions}</select>
        </div>
      </div>
      <div class="stat-cards-row">
        <div class="stat-card">
          <span class="stat-card-label">Money Out</span>
          <div class="stat-card-row">
            <span class="stat-card-value">${formatCurrency(periodExpense, true)}</span>
            ${getTickerHtml(periodExpense, prevExpenseVal, true)}
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-card-label">Money In</span>
          <div class="stat-card-row">
            <span class="stat-card-value positive">${formatCurrency(periodIncome, true)}</span>
            ${getTickerHtml(periodIncome, prevIncomeVal, false)}
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-card-label">Net</span>
          <div class="stat-card-row">
            <span class="stat-card-value ${periodNet >= 0 ? "positive" : "negative"}">${
              periodNet >= 0 ? "+" : ""
            }${formatCurrency(periodNet, true)}</span>
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
  const selectedKey = vizSortedMonthKeys[vizCurrentMonthIndex];
  localStorage.setItem("breadwinner_month_pref", selectedKey);
  renderVizForMonth(vizCurrentMonthIndex);
}

function renderDashboard(transactions, forceExpand = false) {
  renderMonthlyViz(allTransactions);

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

  let activeMonthLabel = null;
  const currentVizKey = vizSortedMonthKeys[vizCurrentMonthIndex];
  if (currentVizKey && currentVizKey !== "all") {
    const [y, m] = currentVizKey.split("-");
    const d = new Date(parseInt(y), parseInt(m) - 1);
    activeMonthLabel = d.toLocaleString("default", { month: "long", year: "numeric" });
  }

  container.innerHTML = Object.entries(grouped)
    .map(([month, txs]) => {
      const total = txs.reduce((s, t) => s + parseFloat(t.amount), 0);
      const rows = txs.map(renderRow).join("");

      const monthKey = month.replace(/\s+/g, "-");
      const savedState = localStorage.getItem(`month-${monthKey}`);

      let isExpanded = savedState === "true";

      if (forceExpand) {
        if (activeMonthLabel) {
          isExpanded = month === activeMonthLabel;
        } else {
          isExpanded = true;
        }
      }

      const hiddenClass = isExpanded ? "" : "hidden";

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
  const desc =
    tx.description.length > 60 ? tx.description.substring(0, 58) + "..." : tx.description;
  const pillStyle = getCategoryPillStyle(tx.categoryName);
  const categoryColor = getCategoryColor(tx.categoryName);
  return `
    <tr onclick="openEdit(${tx.id})" style="cursor: pointer; --category-color: ${categoryColor};" tabindex="0" role="button" aria-label="Edit ${desc}">
      <td>${formatDate(tx.date)}</td>
      <td>${desc}</td>
      <td><span class="category-badge" style="${pillStyle}">${tx.categoryName}</span></td>
      <td style="color:${isNeg ? "var(--text-main)" : "var(--accent-green)"}">${formatCurrency(
        Math.abs(tx.amount)
      )}</td>
    </tr>`;
}

function toggleMonth(btn, monthKey) {
  const content = btn.nextElementSibling;
  const isHidden = content.classList.toggle("hidden");
  const isExpanded = !isHidden;
  btn.setAttribute("aria-expanded", isExpanded);
  localStorage.setItem(`month-${monthKey}`, isExpanded.toString());
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
  document.getElementById("type-expense").className = `type-btn ${
    type === "expense" ? "active" : ""
  }`;
  document.getElementById("type-income").className = `type-btn ${
    type === "income" ? "active" : ""
  }`;
}

function openAddModal() {
  currentEditId = null;
  document.getElementById("modal-title").innerText = "New Transaction";
  document.getElementById("edit-desc").value = "";
  document.getElementById("edit-amount").value = "";
  document.getElementById("edit-date").value = new Date().toISOString().split("T")[0];
  setTxType("expense");
  renderCats();
  document.getElementById("delete-tx-btn").classList.add("hidden");
  document.getElementById("edit-modal").classList.remove("hidden");
  document.getElementById("edit-amount").focus();
}

function openEdit(id) {
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

function openAboutModal() {
  document.getElementById("about-modal").classList.remove("hidden");
}

function closeAboutModal() {
  document.getElementById("about-modal").classList.add("hidden");
}

// --- CONFIRMATION MODAL LOGIC ---
let pendingDeleteId = null;

function closeConfirm() {
  document.getElementById("confirm-modal").classList.add("hidden");
  pendingDeleteId = null;
}

function deleteFromModal() {
  if (!currentEditId) return;
  pendingDeleteId = currentEditId;
  closeModal();

  const modal = document.getElementById("confirm-modal");
  modal.classList.remove("hidden");

  document.getElementById("confirm-yes-btn").onclick = () => {
    confirmDelete();
    closeConfirm();
  };
}

async function confirmDelete() {
  if (!pendingDeleteId) return;
  const id = pendingDeleteId;

  const originalTxs = [...allTransactions];
  allTransactions = allTransactions.filter((t) => t.id !== id);
  applyFilters();
  showToast("Transaction deleted", "success");

  try {
    await apiFetch(`/api/transaction/${id}`, { method: "DELETE" });
  } catch (e) {
    console.error("Delete failed", e);
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

  if (!rawAmt) {
    showToast("Please enter an amount", "error");
    return;
  }

  const finalAmt = currentTxType === "expense" ? -Math.abs(rawAmt) : Math.abs(rawAmt);
  const payload = { description: desc, amount: finalAmt, date: date, category_id: parseInt(cat) };

  closeModal();
  showToast("Saving...", "loading");

  try {
    if (currentEditId) {
      await apiFetch(`/api/transaction/${currentEditId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    await fetchTransactions();
    showToast("Saved successfully", "success");
  } catch (e) {
    console.error(e);
    showToast("Error saving", "error");
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
  } catch {
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

    const token = await getAuthToken();
    const txt = await extractTextFromPDF(f);

    const fd = new FormData();
    if (txt && txt.length > 50) fd.append("text", txt);
    else fd.append("file", f);
    fd.append("filename", f.name);

    showToast("Analyzing...", "loading");

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
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
    const url = forceRefresh ? "/api/insights?refresh=true" : "/api/insights";
    const data = await apiFetch(url);

    textEl.innerText = data.insight;
    textEl.classList.remove("loading");

    if (data.error) {
      textEl.classList.add("error");
    } else {
      textEl.classList.remove("error");
    }
  } catch {
    textEl.innerText = "Unable to load insights right now.";
    textEl.classList.remove("loading");
    textEl.classList.add("error");
  }

  if (refreshBtn) refreshBtn.disabled = false;
}

document.getElementById("refresh-insights-btn")?.addEventListener("click", () => {
  fetchInsights(true);
});

// --- AUTH ---
async function checkUser() {
  toggleLoading(true);
  try {
    await clerk.load();

    if (!clerk.user) {
      const urlParams = new URLSearchParams(window.location.search);
      if (!urlParams.has("login")) {
        window.location.href = "/landing.html";
        return;
      }
      document.getElementById("auth-section").classList.remove("hidden");
      document.getElementById("app-section").classList.add("hidden");
      clerk.mountSignIn(document.getElementById("clerk-sign-in"));
      toggleLoading(false);
      return;
    }

    clerk.addListener(({ user }) => {
      if (!user) window.location.href = "/landing.html";
    });

    updateUI(clerk.user);
    await fetchTransactions();
    fetchInsights();
  } catch (err) {
    console.error("Initialization error:", err);
    showToast("Failed to load application", "error");
  } finally {
    toggleLoading(false);
  }
}

function updateUI(user) {
  if (user) {
    document.getElementById("auth-section").classList.add("hidden");
    document.getElementById("app-section").classList.remove("hidden");
    const email = user.emailAddresses?.[0]?.emailAddress || "";
    document.getElementById("user-email").innerText = email;
  }
}

checkUser();

// --- USER DROPDOWN ---
function toggleUserDropdown() {
  const menu = document.getElementById("user-dropdown-menu");
  menu.classList.toggle("hidden");
}

document.addEventListener("click", (e) => {
  const dropdown = document.querySelector(".user-dropdown");
  const menu = document.getElementById("user-dropdown-menu");
  if (dropdown && menu && !dropdown.contains(e.target)) {
    menu.classList.add("hidden");
  }
});

document.getElementById("logout-btn").onclick = async () => {
  toggleLoading(true);
  await clerk.signOut();
  window.location.href = "/landing.html";
};

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal();
    closeConfirm();
    const menu = document.getElementById("user-dropdown-menu");
    if (menu) menu.classList.add("hidden");
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add public/app.js
git commit -m "refactor: migrate app.js from Supabase to Clerk + fetch API"
```

---

### Task 12: Frontend — Profile.js Rewrite

**Files:**
- Modify: `public/profile.js`

- [ ] **Step 1: Rewrite profile.js**

Replace the entire contents of `public/profile.js`:

```javascript
const clerk = new window.Clerk(CLERK_PUBLISHABLE_KEY);

async function getAuthToken() {
  return await clerk.session.getToken();
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

  await clerk.load();

  if (!clerk.user) {
    window.location.href = "/?login";
    return;
  }

  const email = clerk.user.emailAddresses?.[0]?.emailAddress || "";
  const emailDisplay = document.getElementById("profile-email-display");
  if (emailDisplay) emailDisplay.innerText = email;

  try {
    const profile = await apiFetch("/api/profile");
    if (profile.gemini_api_key) {
      document.getElementById("api-key").value = profile.gemini_api_key;
    }
  } catch (e) {
    console.error("Failed to load profile:", e);
  }

  document.getElementById("manage-account-btn").onclick = () => {
    clerk.openUserProfile();
  };

  document.getElementById("logout-btn").onclick = async () => {
    toggleLoading(true);
    await clerk.signOut();
    window.location.href = "/";
  };

  toggleLoading(false);
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
    const token = await getAuthToken();

    await fetch("/api/transactions", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

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
  if (!confirm("DANGER: This will permanently delete your account and all data. Are you sure?"))
    return;
  if (!confirm("This action cannot be undone. Are you sure you want to proceed?")) return;

  showToast("Deleting account...", "loading");

  try {
    await apiFetch("/api/delete-account", { method: "POST" });

    showToast("Account deleted successfully", "success");
    await clerk.signOut();
    setTimeout(() => {
      window.location.href = "/landing.html";
    }, 1000);
  } catch (e) {
    console.error("Delete account error:", e);
    showToast("Failed to delete account", "error");
  }
}

init();
```

Note: The profile page's `confirmReset` uses `DELETE /api/transactions` (no ID) to bulk-delete. We need to add this handler.

- [ ] **Step 2: Add bulk delete to transactions endpoint**

Add a `DELETE` handler to `functions/api/transactions.ts`:

```typescript
export const onRequestDelete: PagesFunction<Env> = async ({ env, data }) => {
  const userId = (data as any).userId;

  await env.DB.prepare("DELETE FROM statement_logs WHERE user_id = ?").bind(userId).run();
  await env.DB.prepare("DELETE FROM transactions WHERE user_id = ?").bind(userId).run();

  return Response.json({ success: true });
};
```

- [ ] **Step 3: Commit**

```bash
git add public/profile.js functions/api/transactions.ts
git commit -m "refactor: migrate profile.js to Clerk + fetch API, add bulk delete"
```

---

### Task 13: Cleanup & Verification

**Files:**
- Delete: `functions/api/test.ts` (if not already deleted in Task 9)
- Verify: all files compile and reference no Supabase code

- [ ] **Step 1: Grep for remaining Supabase references**

Run:
```bash
grep -r "supabase\|SUPABASE\|createClient.*supabase" --include="*.ts" --include="*.js" --include="*.html" public/ functions/
```

Expected: no results. If anything found, remove it.

- [ ] **Step 2: Install dependencies**

Run:
```bash
bun install
```

- [ ] **Step 3: Commit final state**

```bash
git add -A
git commit -m "chore: remove all Supabase references, clean up migration"
```

---

## Manual Setup Steps (User Action Required)

After all code changes, the user must:

1. **Create a Clerk account** at [clerk.com](https://clerk.com) and create an application
   - Get the **Publishable Key** (starts with `pk_`)
   - Get the **Secret Key** (starts with `sk_`)

2. **Update `public/config.js`** — replace `__CLERK_PUBLISHABLE_KEY__` with the actual publishable key

3. **Create the D1 database**:
   ```bash
   npx wrangler d1 create breadwinner
   ```
   Copy the `database_id` from the output.

4. **Update `wrangler.toml`** — replace `YOUR_DATABASE_ID` with the actual ID

5. **Run the schema migration**:
   ```bash
   npx wrangler d1 execute breadwinner --local --file=db/schema.sql
   npx wrangler d1 execute breadwinner --local --file=db/seed.sql
   ```

6. **Create `.dev.vars`** for local development:
   ```
   CLERK_SECRET_KEY="sk_test_..."
   CLERK_PUBLISHABLE_KEY="pk_test_..."
   GEMINI_API_KEY="AIzaSy..."
   ```

7. **Run the dev server**:
   ```bash
   npx wrangler pages dev public
   ```

8. **For production deployment**, set the same environment variables in the Cloudflare Pages dashboard and run:
   ```bash
   npx wrangler d1 execute breadwinner --file=db/schema.sql
   npx wrangler d1 execute breadwinner --file=db/seed.sql
   ```
