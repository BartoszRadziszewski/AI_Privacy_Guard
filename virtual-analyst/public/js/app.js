// Orkiestracja frontendu: STT ↔ WebSocket ↔ awatar/TTS (Moduły B i C).
import { SpeechAdapter } from './speech.js';
import { AvatarSession } from './avatarWebRTC.js';
import { initLlmSelector } from './llmSelector.js';
import {
  addBubble,
  clearInterim,
  setConnectionState,
  setContextStatus,
  showExportLinks,
  showInterim,
} from './uiController.js';

const els = {
  video: document.getElementById('avatar-video'),
  ttsAudio: document.getElementById('tts-audio'),
  overlay: document.getElementById('avatar-overlay'),
  btnStart: document.getElementById('btn-start'),
  btnStop: document.getElementById('btn-stop'),
  btnMic: document.getElementById('btn-mic'),
  llmSelect: document.getElementById('llm-select'),
  voiceSelect: document.getElementById('voice-select'),
  contextFile: document.getElementById('context-file'),
  contextManual: document.getElementById('context-manual'),
  btnContextSend: document.getElementById('btn-context-send'),
  btnContextReset: document.getElementById('btn-context-reset'),
  btnExport: document.getElementById('btn-export'),
  textForm: document.getElementById('text-form'),
  textInput: document.getElementById('text-input'),
};

const state = {
  ws: null,
  sessionId: null,
  provider: null,
  voiceEngine: 'heygen',
  avatar: new AvatarSession(els.video),
  interviewActive: false,
};

// --- Wybór modelu AI ---
const { config, provider } = await initLlmSelector(els.llmSelect, (newProvider) => {
  state.provider = newProvider;
  if (state.ws?.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify({ type: 'set_provider', provider: newProvider }));
  }
});
state.provider = provider;

if (!config.voice.heygenAvailable) {
  els.voiceSelect.value = 'elevenlabs';
  els.voiceSelect.querySelector('option[value="heygen"]').disabled = true;
}
if (!config.voice.elevenLabsAvailable) {
  els.voiceSelect.querySelector('option[value="elevenlabs"]').disabled = true;
}
state.voiceEngine = els.voiceSelect.value;
els.voiceSelect.addEventListener('change', () => {
  state.voiceEngine = els.voiceSelect.value;
});

// --- STT (Web Speech API, pl-PL) ---
const speech = new SpeechAdapter({
  onFinal: (text) => {
    clearInterim();
    sendUserMessage(text);
  },
  onInterim: (text) => showInterim(text),
  onStateChange: (listening) => {
    els.btnMic.setAttribute('aria-pressed', String(listening));
    els.btnMic.textContent = listening ? '🔴 Nasłuchuję…' : '🎙️ Mów';
  },
});

if (!speech.supported) {
  els.btnMic.title = 'Ta przeglądarka nie wspiera Web Speech API — użyj pola tekstowego';
  addBubble('system', 'Uwaga: przeglądarka nie wspiera rozpoznawania mowy. Możesz pisać w polu poniżej.');
}

// --- WebSocket ---
function connectWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${protocol}://${location.host}/ws`);
  state.ws = ws;

  ws.addEventListener('open', () => setConnectionState('online', 'połączony'));
  ws.addEventListener('close', () => {
    setConnectionState('offline', 'rozłączony');
    setTimeout(connectWebSocket, 2000);
  });
  ws.addEventListener('error', () => setConnectionState('error', 'błąd połączenia'));

  ws.addEventListener('message', async (event) => {
    const message = JSON.parse(event.data);

    if (message.type === 'session_started') {
      state.sessionId = message.sessionId;
      if (state.provider && state.provider !== message.provider) {
        ws.send(JSON.stringify({ type: 'set_provider', provider: state.provider }));
      }
      return;
    }

    if (message.type === 'assistant_message') {
      addBubble('assistant', message.text);
      await speak(message.text);
      if (message.specificationReady) {
        addBubble('system', 'Analityk zebrał komplet danych — generuję specyfikację PIM…');
        await generateSpecification();
      }
    }
  });
}
connectWebSocket();

function sendUserMessage(text) {
  const trimmed = text.trim();
  if (!trimmed || state.ws?.readyState !== WebSocket.OPEN) return;
  addBubble('user', trimmed);
  els.btnExport.disabled = false;
  state.ws.send(JSON.stringify({ type: 'user_message', text: trimmed }));
}

// --- Wyjście głosowe: tryb A (HeyGen) lub B (ElevenLabs audio-only) ---
async function speak(text) {
  if (!text) return;
  try {
    if (state.voiceEngine === 'heygen' && state.avatar.active) {
      await state.avatar.speak(text);
    } else if (state.voiceEngine === 'elevenlabs') {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) throw new Error('TTS niedostępny');
      const blob = await response.blob();
      els.ttsAudio.src = URL.createObjectURL(blob);
      await els.ttsAudio.play();
    }
  } catch {
    addBubble('system', 'Nie udało się odtworzyć głosu — odpowiedź dostępna w transkrypcie.');
  }
}

// --- Start / stop wywiadu ---
els.btnStart.addEventListener('click', async () => {
  els.btnStart.disabled = true;
  try {
    if (state.voiceEngine === 'heygen') {
      addBubble('system', 'Łączę z awatarem…');
      await state.avatar.start();
      els.overlay.hidden = true;
    }
    state.interviewActive = true;
    els.btnStart.hidden = true;
    els.btnStop.hidden = false;
    els.btnMic.disabled = !speech.supported;
    addBubble('system', 'Wywiad rozpoczęty. Powiedz coś albo napisz w polu poniżej.');
  } catch (error) {
    addBubble('system', `Nie udało się uruchomić awatara: ${error.message}. Przełączam na tryb audio.`);
    state.voiceEngine = 'elevenlabs';
    els.voiceSelect.value = 'elevenlabs';
    state.interviewActive = true;
    els.btnStart.hidden = true;
    els.btnStop.hidden = false;
    els.btnMic.disabled = !speech.supported;
  } finally {
    els.btnStart.disabled = false;
  }
});

els.btnStop.addEventListener('click', async () => {
  speech.stop();
  await state.avatar.stop();
  els.overlay.hidden = false;
  state.interviewActive = false;
  els.btnStart.hidden = false;
  els.btnStop.hidden = true;
  els.btnMic.disabled = true;
  addBubble('system', 'Wywiad zakończony.');
});

els.btnMic.addEventListener('click', () => speech.toggle());

// --- Wejście tekstowe (alternatywa dla mowy) ---
els.textForm.addEventListener('submit', (event) => {
  event.preventDefault();
  sendUserMessage(els.textInput.value);
  els.textInput.value = '';
});

// --- Kontekst organizacji (Moduł A) ---
els.btnContextSend.addEventListener('click', async () => {
  const file = els.contextFile.files[0];
  const manual = els.contextManual.value.trim();

  try {
    if (file) {
      const form = new FormData();
      form.append('file', file);
      const response = await fetch('/api/context/upload', { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Błąd uploadu');
      setContextStatus(data.contextChars);
      addBubble('system', `Dodano plik ${data.file} do kontekstu (${data.extractedChars} znaków).`);
      els.contextFile.value = '';
    }
    if (manual) {
      const response = await fetch('/api/context/manual', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ description: manual }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Błąd zapisu opisu');
      setContextStatus(data.contextChars);
      addBubble('system', 'Dodano ręczny opis organizacji do kontekstu.');
      els.contextManual.value = '';
    }
  } catch (error) {
    addBubble('system', `Błąd kontekstu: ${error.message}`);
  }
});

els.btnContextReset.addEventListener('click', async () => {
  await fetch('/api/context/reset', { method: 'POST' });
  setContextStatus(0);
  addBubble('system', 'Kontekst organizacji wyczyszczony.');
});

// --- Eksport specyfikacji (Moduł D) ---
async function generateSpecification() {
  els.btnExport.disabled = true;
  els.btnExport.textContent = 'Generuję specyfikację…';
  try {
    const response = await fetch('/api/export', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: state.sessionId, provider: state.provider }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? 'Błąd eksportu');
    showExportLinks(data.files);
    addBubble('system', 'Specyfikacja PIM gotowa — linki do pobrania w panelu sterowania.');
  } catch (error) {
    addBubble('system', `Błąd generacji specyfikacji: ${error.message}`);
  } finally {
    els.btnExport.disabled = false;
    els.btnExport.textContent = 'Generuj specyfikację (.md / .json / .docx)';
  }
}

els.btnExport.addEventListener('click', generateSpecification);
