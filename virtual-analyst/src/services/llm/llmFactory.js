// Multi-LLM Engine — wzorzec Adapter. Wspólny format historii: [{role, content}].
import { getClaudeResponse } from './anthropicService.js';
import { getOpenAIResponse } from './openaiService.js';
import { getGeminiResponse } from './geminiService.js';

const PROVIDERS = ['anthropic', 'openai', 'gemini'];

export function isSupportedProvider(provider) {
  return PROVIDERS.includes(String(provider).toLowerCase());
}

/**
 * @param {string} provider anthropic | openai | gemini
 * @param {Array<{role: 'user'|'assistant', content: string}>} history
 * @param {string} systemPrompt
 * @param {{model?: string, maxTokens?: number, effort?: string}} options
 * @returns {Promise<string>}
 */
export async function generateAnalystResponse(provider, history, systemPrompt, options = {}) {
  switch (String(provider).toLowerCase()) {
    case 'openai':
      return getOpenAIResponse(history, systemPrompt, options);
    case 'gemini':
      return getGeminiResponse(history, systemPrompt, options);
    case 'anthropic':
    default:
      return getClaudeResponse(history, systemPrompt, options);
  }
}
