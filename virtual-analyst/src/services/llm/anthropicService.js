import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../../utils/logger.js';

let client = null;

function getClient() {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('Brak ANTHROPIC_API_KEY w środowisku');
    }
    client = new Anthropic();
  }
  return client;
}

/**
 * @param {Array<{role: 'user'|'assistant', content: string}>} history
 * @param {string} systemPrompt
 * @param {{model?: string, maxTokens?: number, effort?: string}} options
 * @returns {Promise<string>}
 */
export async function getClaudeResponse(history, systemPrompt, options = {}) {
  const { model = 'claude-opus-5', maxTokens = 1024, effort = 'low' } = options;

  // Uwaga: nowe modele Claude (Opus 5 itd.) nie przyjmują temperature/top_p/budget_tokens.
  // Server-side fallback: przy odmowie klasyfikatora żądanie jest ponawiane na modelu
  // zastępczym w tym samym wywołaniu.
  const response = await getClient().beta.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: history.map((m) => ({ role: m.role, content: m.content })),
    output_config: { effort },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  });

  if (response.stop_reason === 'refusal') {
    logger.warn('anthropic: stop_reason=refusal', {
      category: response.stop_details?.category ?? null,
    });
    return 'Przepraszam, nie mogę odpowiedzieć na to pytanie. Wróćmy do analizy procesu.';
  }

  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');

  if (response.stop_reason === 'max_tokens') {
    logger.warn('anthropic: odpowiedź ucięta przez max_tokens');
  }
  return text;
}
