import { GoogleGenerativeAI } from "@google/generative-ai";

interface Env {
  GEMINI_API_KEY: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    // 1. Get the file from the frontend
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return new Response("No file uploaded", { status: 400 });
    }

    // 2. Prepare the file for Gemini (Convert to Base64)
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = btoa(
      new Uint8Array(arrayBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ""
      )
    );

    // 3. Initialize Gemini
    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 4. The Magic Prompt
    const prompt = `
      You are a bank statement analyzer.
      Analyze the attached PDF bank statement.
      Extract the Date, Description, Amount, and categorize the transaction (e.g., Food, Transport, Utilities).
      
      Return ONLY raw JSON. Do not use Markdown formatting.
      Format:
      [
        { "date": "YYYY-MM-DD", "description": "text", "amount": 10.00, "category": "text" }
      ]
    `;

    // 5. Send to Google
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      },
    ]);

    const responseText = result.response.text();

    // 6. Return the JSON to the Frontend
    return new Response(responseText, {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
};