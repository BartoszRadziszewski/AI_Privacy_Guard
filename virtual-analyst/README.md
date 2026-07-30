# Wirtualny Analityk IT / Architekt PIM

Aplikacja webowa do prowadzenia wywiadów analitycznych w czasie rzeczywistym po polsku,
przez interaktywnego awatara. System pełni rolę Senior Analityka Systemowego: prowadzi
wywiad warstwami BCE (Boundary-Control-Entity), traktuje procesy jako maszyny stanów
dokumentów cyfrowych, wykrywa sprzeczności na żywo i generuje specyfikację **PIM**
zgodną z ISO/IEC 19510 (BPMN 2.0), ISO/IEC/IEEE 29148 i SBVR — w formatach
`.md`, `.json` i `.docx`.

Implementacja powstała według **poprawionej** specyfikacji projektu — patrz:

- [`docs/RECENZJA.md`](docs/RECENZJA.md) — krytyczna recenzja oryginalnego dokumentu projektu,
- [`docs/PROMPTY_V2.md`](docs/PROMPTY_V2.md) — poprawione prompty (Meta-Prompt, Runtime, Spec-Gen),
- [`docs/OPCJE.md`](docs/OPCJE.md) — zaplanowane opcje rozwojowe (m.in. serwerowy STT,
  streaming LLM→TTS, eksport BPMN XML).

## Architektura

- **Backend:** Node.js 20+ (ESM), Express + natywny WebSocket (`ws`).
- **Frontend:** Vanilla JS (ES6 Modules), bez zależności CDN.
- **Multi-LLM Engine** (wzorzec Adapter, przełączany na żywo z UI):
  - Anthropic `claude-opus-5` (oficjalny SDK; tryb rozmowy z niskim `effort` dla latencji,
    generacja specyfikacji z wysokim; server-side fallback przy odmowie klasyfikatora),
  - OpenAI `gpt-4o`,
  - Google `gemini-2.5-flash` (SDK `@google/genai`).
- **STT:** Web Speech API w przeglądarce (`pl-PL`) — zero kosztu i minimalna latencja;
  pole tekstowe jako fallback dla przeglądarek bez wsparcia.
- **Głos / awatar — dwa tryby:**
  - **HeyGen native** — pełny awatar WebRTC z lip-sync (backend pośredniczy w SDP/ICE),
  - **ElevenLabs audio-only** — streaming TTS `eleven_flash_v2_5`, niższa latencja, bez animacji ust.
- **Kontekst organizacji:** upload PDF/DOCX/TXT/MD (limit 10 MB, bufor 60 000 znaków)
  lub opis ręczny; treść traktowana jako **dane niezaufane** (ochrona przed prompt injection).
- **Eksport:** osobne wywołanie LLM z dedykowanym promptem → Markdown → `.md` + `.json`
  (sekcje sparsowane) + `.docx` (nagłówki, tabele, listy, bloki Mermaid).

## Uruchomienie

```bash
cd virtual-analyst
npm install
cp .env.example .env   # uzupełnij klucze API
npm start              # http://localhost:3000
```

Wymagany jest klucz przynajmniej jednego dostawcy LLM. Bez `HEYGEN_API_KEY` aplikacja
działa w trybie audio-only (ElevenLabs) lub czysto tekstowym.

## Zmienne środowiskowe

| Zmienna | Wymagana | Opis |
|---|---|---|
| `PORT` | nie | Port HTTP (domyślnie 3000) |
| `DEFAULT_LLM_PROVIDER` | nie | `anthropic` \| `openai` \| `gemini` |
| `ANTHROPIC_API_KEY` | co najmniej jeden | Klucz Anthropic |
| `OPENAI_API_KEY` | z trzech | Klucz OpenAI |
| `GEMINI_API_KEY` | kluczy LLM | Klucz Google AI |
| `HEYGEN_API_KEY` | nie | Awatar WebRTC (tryb A) |
| `HEYGEN_AVATAR_NAME` | nie | Nazwa awatara interaktywnego |
| `ELEVENLABS_API_KEY` | nie | Streaming TTS (tryb B) |
| `ELEVENLABS_VOICE_ID` | nie | ID głosu (domyślnie multilingual) |

## Przepływ wywiadu

1. Wgraj plik opisu procesu/organizacji (opcjonalnie) i wybierz model AI.
2. Kliknij **Rozpocznij wywiad z awatarem** i mów (albo pisz).
3. Analityk prowadzi wywiad warstwami: Encje/Dokumenty → Procesy/Control → Boundary,
   zgłaszając na bieżąco sprzeczności (brak nośnika stanu, mieszanie PIM/PSM, luki legacy).
4. Gdy model uzna dane za kompletne, emituje znacznik `[GENERATE_SPECIFICATION]`
   (usuwany przed syntezą mowy) — specyfikacja generuje się automatycznie;
   można też wymusić ją przyciskiem w dowolnym momencie.
5. Pakiet `.md` / `.json` / `.docx` pojawia się do pobrania w panelu sterowania.
