// lib/openai.ts
// Wrapper for OpenAI ChatGPT with a Gemini-compatible interface

interface ChatGPTResponseWrapper {
  response: {
    text: () => string;
  };
}

export const chatgptModel = {
  generateContent: async (prompt: string): Promise<ChatGPTResponseWrapper> => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    // Lazy import to avoid bundling issues in some environments
    const { default: OpenAI } = await import("openai");

    const client = new OpenAI({ apiKey });

    try {
      console.log("🤖 Using OpenAI ChatGPT model: gpt-4o-mini");
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.2,
      });

      const text = completion.choices?.[0]?.message?.content ?? "";

      return {
        response: {
          text: () => text,
        },
      };
    } catch (error: any) {
      console.error("❌ OpenAI ChatGPT error:", error?.message || error);
      throw error;
    }
  },
};

console.log("✅ OpenAI ChatGPT configured (adapter ready)");


