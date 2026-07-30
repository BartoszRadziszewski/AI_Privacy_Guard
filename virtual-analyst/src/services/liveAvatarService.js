// Mostek HeyGen LiveAvatar (tryb A). Klucz API zostaje na serwerze;
// frontend wymienia SDP/ICE wyłącznie przez te funkcje (Moduł C).
import { logger } from '../utils/logger.js';

const HEYGEN_BASE = 'https://api.heygen.com/v1';

function requireKey() {
  const key = process.env.HEYGEN_API_KEY;
  if (!key) throw new Error('Brak HEYGEN_API_KEY w środowisku');
  return key;
}

async function heygenPost(endpoint, body) {
  const response = await fetch(`${HEYGEN_BASE}/${endpoint}`, {
    method: 'POST',
    headers: {
      'x-api-key': requireKey(),
      'content-type': 'application/json',
    },
    body: JSON.stringify(body ?? {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    logger.error(`heygen ${endpoint} → HTTP ${response.status}`, {
      message: payload?.message ?? payload?.error ?? null,
    });
    throw new Error(`HeyGen ${endpoint} zwrócił HTTP ${response.status}`);
  }
  return payload.data ?? payload;
}

/** Tworzy sesję streamingu; zwraca session_id, SDP offer i serwery ICE. */
export function createStreamingSession({ quality = 'medium', avatarName } = {}) {
  const body = { quality };
  const avatar = avatarName || process.env.HEYGEN_AVATAR_NAME;
  if (avatar) body.avatar_name = avatar;
  return heygenPost('streaming.new', body);
}

/** Przekazuje SDP answer z przeglądarki. */
export function startStreamingSession(sessionId, sdp) {
  return heygenPost('streaming.start', { session_id: sessionId, sdp });
}

/** Wysyła tekst do wypowiedzenia przez awatara (HeyGen robi TTS + lip-sync). */
export function sendSpeakTask(sessionId, text) {
  return heygenPost('streaming.task', { session_id: sessionId, text, task_type: 'repeat' });
}

/** Przekazuje kandydata ICE z przeglądarki. */
export function submitIceCandidate(sessionId, candidate) {
  return heygenPost('streaming.ice', { session_id: sessionId, candidate });
}

/** Zamyka sesję streamingu. */
export function stopStreamingSession(sessionId) {
  return heygenPost('streaming.stop', { session_id: sessionId });
}
