// lib/gemini.ts
// ✅ Working configuration for Gemini 2.5 Flash

interface GeminiResponse {
    candidates: Array<{
      content: {
        parts: Array<{
          text: string;
        }>;
      };
    }>;
  }
  
  const MODEL_NAME = 'gemini-2.5-flash';
  
  export const geminiModel = {
    generateContent: async (prompt: string): Promise<{ response: { text: () => string } }> => {
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY not configured');
      }
  
      try {
        console.log(`🤖 Using Gemini model: ${MODEL_NAME}`);
        
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1/models/${MODEL_NAME}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: prompt
                }]
              }]
            })
          }
        );
  
        const responseText = await response.text();
  
        if (!response.ok) {
          console.error('❌ Gemini API Error:', response.status, responseText);
          throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
        }
  
        const data: GeminiResponse = JSON.parse(responseText);
        
        if (!data.candidates || !data.candidates[0]) {
          throw new Error('No response from Gemini API');
        }
  
        const text = data.candidates[0].content.parts[0].text;
  
        return {
          response: {
            text: () => text
          }
        };
      } catch (error: any) {
        console.error('❌ Gemini error:', error.message);
        throw error;
      }
    }
  };
  
  console.log(`✅ Gemini configured with model: ${MODEL_NAME}`);