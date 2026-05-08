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
