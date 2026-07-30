import { GoogleGenAI } from '@google/genai';

let client = null;

function getClient() {
  if (!client) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Brak GEMINI_API_KEY w środowisku');
    }
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
}

/**
 * @param {Array<{role: 'user'|'assistant', content: string}>} history
 * @param {string} systemPrompt
 * @param {{model?: string, maxTokens?: number}} options
 * @returns {Promise<string>}
 */
export async function getGeminiResponse(history, systemPrompt, options = {}) {
  const { model = 'gemini-2.5-flash', maxTokens = 1024 } = options;

  const response = await getClient().models.generateContent({
    model,
    contents: history.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    config: {
      systemInstruction: systemPrompt,
      maxOutputTokens: maxTokens,
    },
  });

  return response.text ?? '';
}
