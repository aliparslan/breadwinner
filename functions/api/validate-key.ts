import { GoogleGenerativeAI } from "@google/generative-ai";

export const onRequestPost: PagesFunction = async ({ request }) => {
  try {
    const { apiKey } = (await request.json()) as { apiKey: string };

    if (!apiKey) return new Response("No key provided", { status: 400 });

    // Initialize Gemini with the User's Key
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    // Run a tiny, cheap prompt to test validity
    await model.generateContent("Hi");

    return new Response(JSON.stringify({ valid: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ valid: false, error: err.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
};
