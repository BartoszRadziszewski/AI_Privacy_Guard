// Stan sesji wywiadu (Moduł B). Sesja żyje per połączenie WebSocket;
// historia jest przycinana, a bufor kontekstu współdzielony w ramach procesu
// (aplikacja jednostanowiskowa — jeden analityk, jeden wywiad naraz).
import { randomUUID } from 'node:crypto';

const MAX_HISTORY_TURNS = 30; // par user+assistant
const MAX_MESSAGE_CHARS = 4000; // REQ-NFR-002

// Globalny bufor kontekstu organizacji (upload plików / opis ręczny).
let contextBuffer = '';

const sessions = new Map();

export function setContextBuffer(text) {
  contextBuffer = text ?? '';
}

export function appendContextBuffer(text) {
  contextBuffer = contextBuffer ? `${contextBuffer}\n\n${text}` : text;
  return contextBuffer;
}

export function getContextBuffer() {
  return contextBuffer;
}

export function createSession(provider) {
  const id = randomUUID();
  const session = { id, provider, history: [], createdAt: Date.now() };
  sessions.set(id, session);
  return session;
}

export function getSession(id) {
  return sessions.get(id);
}

export function destroySession(id) {
  sessions.delete(id);
}

export function sanitizeUserMessage(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_MESSAGE_CHARS);
}

export function pushTurn(session, role, content) {
  session.history.push({ role, content });
  const maxEntries = MAX_HISTORY_TURNS * 2;
  if (session.history.length > maxEntries) {
    session.history.splice(0, session.history.length - maxEntries);
  }
}
