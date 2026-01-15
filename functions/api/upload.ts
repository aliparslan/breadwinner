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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return new Response("Invalid User", { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const rawText = formData.get("text") as string | null;
    const filename = (formData.get("filename") as string) || (file ? file.name : "Unknown_Upload.pdf");

    if (!file && !rawText) return new Response("No content uploaded", { status: 400 });

    const { data: categories } = await supabase.from("categories").select("id, name");
    if (!categories) return new Response("Could not fetch categories", { status: 500 });
    const categoryNames = categories.map((c) => c.name).join(", ");

    // Using Gemini 2.5 Flash Lite
    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    let result;

    if (rawText) {
      // FAST MODE
      const prompt = `
          Extract date, description, and amount for every transaction from this bank statement text.
          RULES:
          1. Spending is NEGATIVE. Deposits are POSITIVE.
          2. Categorize into: [${categoryNames}]. Use "Miscellaneous" if unsure.
          3. Return ONLY raw JSON array: [{ "date": "YYYY-MM-DD", "description": "txt", "amount": -10.00, "category": "ExactName" }]
          
          TEXT:
          ${rawText}
        `;
      result = await model.generateContent(prompt);
    } else if (file) {
      // SLOW MODE (Vision)
      const arrayBuffer = await file.arrayBuffer();
      const base64Data = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ""));
      const prompt = `Extract transactions. Spending=Negative. Categories: [${categoryNames}]. Return JSON array.`;

      result = await model.generateContent([prompt, { inlineData: { data: base64Data, mimeType: file.type } }]);
    }

    const jsonText = result.response
      .text()
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    const parsedTransactions = JSON.parse(jsonText);

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
