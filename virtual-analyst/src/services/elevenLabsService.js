// Streaming TTS ElevenLabs (tryb B — audio-only, niska latencja, bez lip-sync).
import { logger } from '../utils/logger.js';

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';
// Domyślny głos multilingual (Rachel); nadpisywany przez ELEVENLABS_VOICE_ID.
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

/**
 * Zwraca strumień audio/mpeg (ReadableStream) dla podanego tekstu.
 * @param {string} text
 * @param {{voiceId?: string, modelId?: string}} options
 */
export async function streamSpeech(text, options = {}) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('Brak ELEVENLABS_API_KEY w środowisku');

  const voiceId = options.voiceId || process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  const modelId = options.modelId || 'eleven_flash_v2_5';

  const response = await fetch(
    `${ELEVENLABS_BASE}/text-to-speech/${encodeURIComponent(voiceId)}/stream`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': key,
        'content-type': 'application/json',
        accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        // Polski jest wspierany przez modele multilingual/flash — bez dodatkowej konfiguracji.
      }),
    }
  );

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => '');
    logger.error(`elevenlabs tts → HTTP ${response.status}`, { detail: detail.slice(0, 200) });
    throw new Error(`ElevenLabs TTS zwrócił HTTP ${response.status}`);
  }
  return response.body;
}
