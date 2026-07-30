// Wirtualny Analityk IT / Architekt PIM — główny serwer HTTP + WebSocket.
// Zob. docs/RECENZJA.md i docs/PROMPTY_V2.md dla decyzji projektowych.
import 'dotenv/config';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';
import { WebSocketServer } from 'ws';

import { generateAnalystResponse, isSupportedProvider } from './src/services/llm/llmFactory.js';
import { buildSystemPrompt, hasSpecTag, stripSpecTag } from './src/prompts/analystPrompts.js';
import * as heygen from './src/services/liveAvatarService.js';
import { streamSpeech } from './src/services/elevenLabsService.js';
import {
  createSession,
  destroySession,
  getContextBuffer,
  pushTurn,
  sanitizeUserMessage,
} from './src/controllers/sessionController.js';
import {
  handleContextReset,
  makeManualContextHandler,
  makeUploadHandler,
} from './src/controllers/uploadController.js';
import { makeExportHandler } from './src/controllers/exportController.js';
import { logger } from './src/utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = JSON.parse(await fs.readFile(path.join(__dirname, 'config', 'default.json'), 'utf-8'));
const templates = JSON.parse(
  await fs.readFile(path.join(__dirname, 'config', 'pim_iso_templates.json'), 'utf-8')
);

const uploadsDir = path.join(__dirname, 'uploads');
const exportsDir = path.join(__dirname, 'exports');
await fs.mkdir(uploadsDir, { recursive: true });
await fs.mkdir(exportsDir, { recursive: true });

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/exports', express.static(exportsDir));

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 10 * 1024 * 1024 }, // REQ-NFR-002: 10 MB
});

// --- Konfiguracja dla frontendu (bez sekretów) ---
app.get('/api/config', (_req, res) => {
  res.json({
    defaultProvider: process.env.DEFAULT_LLM_PROVIDER || config.defaultProvider,
    providers: Object.fromEntries(
      Object.entries(config.providers).map(([key, value]) => [
        key,
        { label: value.label, model: value.model, available: providerKeyPresent(key) },
      ])
    ),
    voice: {
      engine: config.voice.engine,
      heygenAvailable: Boolean(process.env.HEYGEN_API_KEY),
      elevenLabsAvailable: Boolean(process.env.ELEVENLABS_API_KEY),
    },
  });
});

function providerKeyPresent(provider) {
  switch (provider) {
    case 'anthropic':
      return Boolean(process.env.ANTHROPIC_API_KEY);
    case 'openai':
      return Boolean(process.env.OPENAI_API_KEY);
    case 'gemini':
      return Boolean(process.env.GEMINI_API_KEY);
    default:
      return false;
  }
}

// --- Moduł A: kontekst organizacji ---
app.post('/api/context/upload', upload.single('file'), makeUploadHandler(config));
app.post('/api/context/manual', makeManualContextHandler(config));
app.post('/api/context/reset', handleContextReset);

// --- Moduł C, tryb A: proxy HeyGen (klucz zostaje na serwerze) ---
app.post('/api/heygen/session', async (_req, res) => {
  try {
    const data = await heygen.createStreamingSession({
      quality: config.heygen.quality,
    });
    res.json(data);
  } catch (error) {
    logger.error('heygen/session', { message: error.message });
    res.status(502).json({ error: 'Nie udało się utworzyć sesji awatara' });
  }
});

app.post('/api/heygen/start', async (req, res) => {
  try {
    const { session_id, sdp } = req.body ?? {};
    res.json(await heygen.startStreamingSession(session_id, sdp));
  } catch (error) {
    logger.error('heygen/start', { message: error.message });
    res.status(502).json({ error: 'Nie udało się wystartować sesji awatara' });
  }
});

app.post('/api/heygen/ice', async (req, res) => {
  try {
    const { session_id, candidate } = req.body ?? {};
    res.json(await heygen.submitIceCandidate(session_id, candidate));
  } catch (error) {
    res.status(502).json({ error: 'Błąd wymiany ICE' });
  }
});

app.post('/api/heygen/task', async (req, res) => {
  try {
    const { session_id } = req.body ?? {};
    const text = sanitizeUserMessage(req.body?.text);
    if (!text) return res.status(400).json({ error: 'Pusty tekst' });
    res.json(await heygen.sendSpeakTask(session_id, text));
  } catch (error) {
    logger.error('heygen/task', { message: error.message });
    res.status(502).json({ error: 'Awatar nie przyjął wypowiedzi' });
  }
});

app.post('/api/heygen/stop', async (req, res) => {
  try {
    const { session_id } = req.body ?? {};
    res.json(await heygen.stopStreamingSession(session_id));
  } catch (error) {
    res.status(502).json({ error: 'Błąd zamykania sesji awatara' });
  }
});

// --- Moduł C, tryb B: streaming TTS ElevenLabs (audio-only) ---
app.post('/api/tts', async (req, res) => {
  try {
    const text = sanitizeUserMessage(req.body?.text);
    if (!text) return res.status(400).json({ error: 'Pusty tekst' });
    const stream = await streamSpeech(text, { modelId: config.voice.elevenLabsModel });
    res.setHeader('content-type', 'audio/mpeg');
    for await (const chunk of stream) {
      res.write(chunk);
    }
    res.end();
  } catch (error) {
    logger.error('tts', { message: error.message });
    if (!res.headersSent) res.status(502).json({ error: 'Błąd syntezy mowy' });
    else res.end();
  }
});

// --- Moduł D: eksport specyfikacji PIM ---
app.post('/api/export', makeExportHandler({ config, templates, exportsDir }));

// --- HTTP + WebSocket (Moduł B: Live Analyst Engine) ---
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const FAIL_SOFT_MESSAGE =
  'Przepraszam, mam chwilowy problem techniczny. Powtórz proszę ostatnią wypowiedź.';

wss.on('connection', (ws) => {
  const defaultProvider = process.env.DEFAULT_LLM_PROVIDER || config.defaultProvider;
  const session = createSession(defaultProvider);
  logger.info('ws: nowa sesja wywiadu', { sessionId: session.id });

  ws.send(JSON.stringify({ type: 'session_started', sessionId: session.id, provider: session.provider }));

  ws.on('message', async (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (message.type === 'set_provider') {
      if (isSupportedProvider(message.provider)) {
        session.provider = String(message.provider).toLowerCase();
        ws.send(JSON.stringify({ type: 'provider_changed', provider: session.provider }));
      }
      return;
    }

    if (message.type !== 'user_message') return;

    const text = sanitizeUserMessage(message.text);
    if (!text) return;

    pushTurn(session, 'user', text);
    const providerConfig = config.providers[session.provider] ?? {};

    try {
      const systemPrompt = buildSystemPrompt(getContextBuffer());
      const rawReply = await generateAnalystResponse(session.provider, session.history, systemPrompt, {
        model: providerConfig.model,
        maxTokens: config.limits?.chatMaxTokens ?? 1024,
        effort: providerConfig.chatEffort ?? 'low',
      });

      pushTurn(session, 'assistant', rawReply);

      // Kontrakt sterujący: znacznik nigdy nie trafia do TTS/awatara.
      const specificationReady = hasSpecTag(rawReply);
      const spokenText = stripSpecTag(rawReply);

      ws.send(
        JSON.stringify({
          type: 'assistant_message',
          text: spokenText,
          specificationReady,
          sessionId: session.id,
        })
      );
    } catch (error) {
      logger.error('ws: błąd dostawcy LLM', { provider: session.provider, message: error.message });
      ws.send(
        JSON.stringify({ type: 'assistant_message', text: FAIL_SOFT_MESSAGE, specificationReady: false, error: true })
      );
    }
  });

  ws.on('close', () => {
    destroySession(session.id);
    logger.info('ws: sesja zakończona', { sessionId: session.id });
  });
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => {
  logger.info(`Wirtualny Analityk działa na http://localhost:${PORT}`);
});
