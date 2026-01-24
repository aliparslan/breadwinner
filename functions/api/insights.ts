import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

interface Env {
  GEMINI_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
}

interface CategoryTotal {
  name: string;
  total: number;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) return new Response("Missing Auth Header", { status: 401 });

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // 1. Get User
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return new Response("Invalid User", { status: 401 });

    // 2. Fetch User Profile for API Key and cached insights
    const { data: profile } = await supabase
      .from("profiles")
      .select("gemini_api_key, insights_cache, insights_updated_at")
      .eq("id", user.id)
      .single();

    // 3. Check if we have a recent cached insight (less than 24 hours old)
    if (profile?.insights_cache && profile?.insights_updated_at) {
      const updatedAt = new Date(profile.insights_updated_at);
      const now = new Date();
      const hoursSinceUpdate = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceUpdate < 24) {
        return new Response(JSON.stringify({ 
          insight: profile.insights_cache,
          cached: true 
        }), {
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // 4. Fetch transactions to generate new insight
    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select(`amount, date, categories ( name )`)
      .order("date", { ascending: false })
      .limit(200); // Last 200 transactions for context

    if (txError || !transactions || transactions.length === 0) {
      return new Response(JSON.stringify({ 
        insight: "Add some transactions to get personalized spending insights!",
        cached: false 
      }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 5. Aggregate data to minimize token usage
    let totalIncome = 0;
    let totalExpenses = 0;
    const categoryTotals: Record<string, number> = {};
    const monthlyTotals: Record<string, { income: number; expenses: number }> = {};

    transactions.forEach((tx: any) => {
      const amt = parseFloat(tx.amount);
      const monthKey = tx.date.substring(0, 7); // YYYY-MM
      const catName = tx.categories?.name || "Other";

      if (!monthlyTotals[monthKey]) {
        monthlyTotals[monthKey] = { income: 0, expenses: 0 };
      }

      if (amt > 0) {
        totalIncome += amt;
        monthlyTotals[monthKey].income += amt;
      } else {
        totalExpenses += Math.abs(amt);
        monthlyTotals[monthKey].expenses += Math.abs(amt);
        categoryTotals[catName] = (categoryTotals[catName] || 0) + Math.abs(amt);
      }
    });

    // Sort categories by spending
    const topCategories = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, total]) => `${name}: $${total.toFixed(0)}`);

    // Prepare compact prompt
    const summaryData = {
      totalIncome: totalIncome.toFixed(0),
      totalExpenses: totalExpenses.toFixed(0),
      netSavings: (totalIncome - totalExpenses).toFixed(0),
      topCategories: topCategories.join(", "),
      monthCount: Object.keys(monthlyTotals).length,
    };

    // 6. Determine which API key to use
    const activeApiKey = profile?.gemini_api_key || env.GEMINI_API_KEY;

    if (!activeApiKey) {
      return new Response("No AI API Key configured", { status: 500 });
    }

    // 7. Generate insight with Gemini
    const genAI = new GoogleGenerativeAI(activeApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    // Calculate category percentages for the prompt
    const categoryPercentages = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, total]) => `${name}: ${((total / totalExpenses) * 100).toFixed(0)}%`)
      .join(", ");

    const prompt = `Analyze this spending data and describe trends and patterns in 2-3 sentences. Focus on:
- Spending distribution across categories (use percentages)
- Any notable outliers or unusual patterns
- Comparisons between categories

Do NOT give tips or advice. Only describe what you observe in the data.

Data:
- Monthly outflow: $${summaryData.totalExpenses}
- Income: $${summaryData.totalIncome}
- Net: $${summaryData.netSavings}
- Spending breakdown: ${categoryPercentages}
- Period: ${summaryData.monthCount} months

Keep under 60 words. Be specific with numbers and percentages.`;

    let result;
    try {
      result = await model.generateContent(prompt);
    } catch (aiError: any) {
      // Handle rate limiting
      if (aiError.status === 429 || aiError.message?.includes("429")) {
        return new Response(JSON.stringify({ 
          insight: "AI rate limit reached. Please try again in a few minutes.",
          error: true 
        }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw aiError;
    }

    const insight = result.response.text().trim();

    // 8. Cache the insight
    await supabase
      .from("profiles")
      .update({ 
        insights_cache: insight, 
        insights_updated_at: new Date().toISOString() 
      })
      .eq("id", user.id);

    return new Response(JSON.stringify({ insight, cached: false }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Insights error:", err);
    return new Response(JSON.stringify({ 
      insight: "Unable to generate insights right now. Please try again later.",
      error: true 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
