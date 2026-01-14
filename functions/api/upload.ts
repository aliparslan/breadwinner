import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

interface Env {
  GEMINI_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    // 1. Validate Auth Token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return new Response("Missing Auth Header", { status: 401 });

    // Initialize Supabase acting AS THE USER
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // 2. Get User ID (Security Check)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return new Response("Invalid User", { status: 401 });

    // 3. Get File
    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) return new Response("No file uploaded", { status: 400 });

    // 4. Get Valid Categories from DB (The "Rigid List")
    const { data: categories } = await supabase.from('categories').select('id, name');
    if (!categories) return new Response("Could not fetch categories", { status: 500 });
    
    const categoryNames = categories.map(c => c.name).join(", ");

    // 5. Prepare Gemini
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" }); // Using the fast model

    // 6. The "Enforcer" Prompt
    const prompt = `
      Analyze this bank statement PDF.
      
      RULES:
      1. Spending/Debits must be NEGATIVE numbers (e.g., -20.50).
      2. Income/Credits must be POSITIVE numbers.
      3. For the "category" field, you MUST strictly use one of these exact names: [${categoryNames}].
      4. If unsure, use "Miscellaneous".

      Return ONLY raw JSON in this format:
      [
        { "date": "YYYY-MM-DD", "description": "text", "amount": -10.00, "category": "ExactCategoryName" }
      ]
    `;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType: file.type } }
    ]);

    const jsonText = result.response.text()
      .replace(/```json/g, "").replace(/```/g, "").trim(); // Clean up markdown if Gemini adds it
    
    const parsedTransactions = JSON.parse(jsonText);

    // 7. Save to Database (The Transactional Flow)
    
    // A. Create the Log Entry (Statement)
    const { data: statement, error: stmtError } = await supabase
      .from('statement_logs')
      .insert({
        user_id: user.id,
        filename: file.name
      })
      .select()
      .single();

    if (stmtError) throw new Error("Failed to log statement: " + stmtError.message);

    // B. Prepare Transactions with correct Category IDs
    const finalData = parsedTransactions.map((tx: any) => {
      // Find the ID for the text category Gemini returned
      const catMatch = categories.find(c => c.name === tx.category);
      const categoryId = catMatch ? catMatch.id : categories.find(c => c.name === 'Miscellaneous')?.id;

      return {
        user_id: user.id,
        statement_id: statement.id, // Link to the log we just made
        category_id: categoryId,
        date: tx.date,
        description: tx.description,
        amount: tx.amount
      };
    });

    // C. Insert Transactions
    const { error: txError } = await supabase.from('transactions').insert(finalData);
    if (txError) throw new Error("Failed to save transactions: " + txError.message);

    // 8. Return data to frontend (include the category name for display)
    // We merge the name back in so the frontend table still looks nice without extra work
    const displayData = finalData.map((tx: any) => ({
      ...tx,
      category: categories.find(c => c.id === tx.category_id)?.name
    }));

    return new Response(JSON.stringify(displayData), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
};