# Opcje rozwojowe (zaplanowane, nieaktywne)

Lista świadomie odłożonych wariantów. Stan bieżący pozostaje bez zmian — te opcje
implementujemy dopiero na wyraźną decyzję.

## 1. Serwerowy adapter STT (SttAdapter, wariant B)

**Stan bieżący:** transkrypcja mowy odbywa się w przeglądarce (Web Speech API,
`public/js/speech.js`, `pl-PL`). Zaleta: zero kosztu i minimalna latencja.
Ograniczenie: brak wsparcia m.in. w Firefoksie (wtedy działa fallback tekstowy).

**Opcja:** transkrypcja po stronie Node.js, niezależna od przeglądarki i o wyższej
jakości dla polszczyzny.

Szkic architektury:

1. Frontend: `MediaRecorder` (Opus/WebM) nagrywa mikrofon i wysyła chunki audio
   przez istniejący WebSocket (nowy typ wiadomości `audio_chunk` + `audio_end`).
2. Backend: nowy moduł `src/services/stt/` z interfejsem wspólnym dla adapterów:
   - `openaiSttService.js` — OpenAI `gpt-4o-transcribe` / Whisper (multipart upload
     bufora audio, `language: "pl"`),
   - miejsce na kolejne adaptery (np. Deepgram — streaming, niższa latencja).
3. Wybór wariantu w `config/default.json`: `"stt": { "engine": "browser" | "openai" }`
   + przełącznik w panelu sterowania UI.
4. Konsekwencje: dodatkowy koszt za minutę transkrypcji, ~0,5–1,5 s dodatkowej
   latencji (upload + przetwarzanie), wymagany `OPENAI_API_KEY` nawet gdy LLM ≠ OpenAI.

## 2. Streaming odpowiedzi LLM + sentence chunking do TTS

Odpowiedź modelu streamowana tokenami; pierwsze pełne zdanie wysyłane do
HeyGen/ElevenLabs od razu, kolejne w kolejce. Skraca odczuwalną latencję
o czas generacji reszty odpowiedzi. Wymaga przejścia adapterów LLM na API
streamingowe i kolejkowania zadań `streaming.task`.

## 3. Eksport BPMN 2.0 XML

Obecnie procesy są specyfikowane tabelarycznie + diagramy Mermaid (wizualizacja).
Opcja: generowanie poprawnego BPMN XML (ISO/IEC 19510) importowalnego do narzędzi
klasy Camunda/Signavio — jako czwarty format eksportu obok .md/.json/.docx.

## 4. Autoryzacja endpointów proxy

Struktura jest gotowa pod dodanie warstwy autoryzacji (REQ-NFR-006): sesyjny token
wydawany przy starcie wywiadu, wymagany przez `/api/heygen/*`, `/api/tts`
i `/api/export`. Zasadne przed wystawieniem aplikacji poza localhost.
