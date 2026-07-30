import OpenAI from 'openai';

let client = null;

function getClient() {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('Brak OPENAI_API_KEY w środowisku');
    }
    client = new OpenAI();
  }
  return client;
}

/**
 * @param {Array<{role: 'user'|'assistant', content: string}>} history
 * @param {string} systemPrompt
 * @param {{model?: string, maxTokens?: number}} options
 * @returns {Promise<string>}
 */
export async function getOpenAIResponse(history, systemPrompt, options = {}) {
  const { model = 'gpt-4o', maxTokens = 1024 } = options;

  const response = await getClient().chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ],
  });

  return response.choices[0]?.message?.content ?? '';
}
