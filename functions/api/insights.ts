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
