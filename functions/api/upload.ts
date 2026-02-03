import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

interface Env {
  GEMINI_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
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

    // 2. Fetch User Profile to check for Custom Key
    const { data: profile } = await supabase.from("profiles").select("gemini_api_key").eq("id", user.id).single();

    // 3. Determine which key to use (User's Key > System Env Key)
    const activeApiKey = profile?.gemini_api_key || env.GEMINI_API_KEY;

    if (!activeApiKey) {
      return new Response("No AI API Key configured. Please add one in Settings.", { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const rawText = formData.get("text") as string | null;
    const filename = (formData.get("filename") as string) || (file ? file.name : "Unknown_Upload.pdf");

    if (!file && !rawText) return new Response("No content uploaded", { status: 400 });

    const { data: categories } = await supabase.from("categories").select("id, name");
    if (!categories) return new Response("Could not fetch categories", { status: 500 });
    const categoryNames = categories.map((c) => c.name).join(", ");

    // Initialize Gemini with the ACTIVE KEY
    const genAI = new GoogleGenerativeAI(activeApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    let result;

    try {
      if (rawText) {
        // FAST MODE
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
               - If the statement shows "- $50.00" under Debit → use -50.00
               - If the statement shows "+ $1000.00" under Credit → use 1000.00
               
               FOR CREDIT CARDS:
               - Payments/Credits (reduces balance owed) = POSITIVE amounts (treats as income/credit to your finances)
               - Purchases/Charges/Transactions = NEGATIVE amounts (spending/debits from your finances)
               - If the statement shows "- $158.17" under "Payments, Credits and Adjustments" → use +158.17 (it's a payment, which is good)
               - If the statement shows "$84.80" under "Transactions" → use -84.80 (it's a charge, which is spending)
            
            3. Categorize into: [${categoryNames}]. Use "Other" if unsure. Income-like transactions (salary, deposits, payments received, refunds) should not be categorized as expenses.
            
            4. Return ONLY raw JSON array: [{ "date": "YYYY-MM-DD", "description": "txt", "amount": -10.00, "category": "ExactName" }]
            
            TEXT:
            ${rawText}
          `;
        result = await model.generateContent(prompt);
      } else if (file) {
        // SLOW MODE (Vision)
        const arrayBuffer = await file.arrayBuffer();
        const base64Data = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ""));
        const prompt = `
          Extract all transactions from this bank/credit card statement image.
          
          CRITICAL: Identify if this is a BANK ACCOUNT or CREDIT CARD statement:
          
          BANK ACCOUNT signs:
          - Shows account balance, "Debit"/"Credit" labels
          - Debits/Spending = NEGATIVE (e.g., "- $50" under Debit → -50.00)
          - Credits/Deposits = POSITIVE (e.g., "+ $1000" under Credit → +1000.00)
          
          CREDIT CARD signs:
          - Headers like "Payments, Credits and Adjustments" or "Transactions"
          - Payments = POSITIVE amounts even if shown as negative (e.g., "- $158" in Payments section → +158.00)
          - Charges/Purchases = NEGATIVE amounts even if shown as positive (e.g., "$84.80" in Transactions → -84.80)
          
          Categories: [${categoryNames}]. Return JSON: [{"date":"YYYY-MM-DD","description":"text","amount":number,"category":"name"}]
        `;

        result = await model.generateContent([prompt, { inlineData: { data: base64Data, mimeType: file.type } }]);
      }
    } catch (aiError: any) {
      // Handle rate limiting
      if (aiError.status === 429 || aiError.message?.includes("429") || aiError.message?.includes("rate")) {
        return new Response("AI rate limit reached. Please try again in a few minutes.", { status: 429 });
      }
      throw aiError;
    }

    const rawOutput = result.response.text();
    const jsonMatch = rawOutput.match(/\[.*\]/s);
    if (!jsonMatch) return new Response("AI failed to generate valid JSON", { status: 422 });

    let parsedTransactions;
    try {
      parsedTransactions = JSON.parse(jsonMatch[0]);
    } catch (e) {
      return new Response("JSON Parse Error: " + rawOutput, { status: 422 });
    }

    const { data: statement, error: stmtError } = await supabase
      .from("statement_logs")
      .insert({ user_id: user.id, filename: filename })
      .select()
      .single();
    if (stmtError) throw new Error(stmtError.message);

    const finalData = parsedTransactions.map((tx: any) => {
      const catMatch = categories.find((c) => c.name === tx.category);
      const categoryId = catMatch ? catMatch.id : categories.find((c) => c.name === "Miscellaneous")?.id;
      return {
        user_id: user.id,
        statement_id: statement.id,
        category_id: categoryId,
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
      };
    });

    const { error: txError } = await supabase.from("transactions").insert(finalData);
    if (txError) throw new Error(txError.message);

    return new Response(JSON.stringify(finalData), { headers: { "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
};
