# AI Privacy Guard

**Two-layer PII protection for [Claude Code](https://claude.ai/code) via hooks.**

Automatically classifies prompts for harmful content and anonymizes personal data
(emails, phone numbers, names) before they reach the Anthropic API —
both in user prompts and in files Claude reads during a session.

---

## How it works

```
User prompt
    │
    ▼
[UserPromptSubmit] → guard.py
    ├── Safety classification (Bielik-Guard model)
    │     blocks: crime · hate · self-harm
    └── PII anonymization  →  [EMAIL_1] [OSOBA_1] [TEL_1]
    │
    ▼
Claude plans to Read a file
    │
    ▼
[PreToolUse] → pre_tool_hook.py
    ├── Sensitive path? (.env, spotkanie*, pracownicy*, …)
    ├── Sensitive content? (email regex, PL phone, long number)
    └── Text file  →  anonymized content returned to Claude
        Binary file →  access blocked with explanation
```

## Features

- **Prompt moderation** — Polish NLP safety model (Bielik-Guard 0.1B)
- **PII anonymization** — regex-based, tokens survive the session for deanonymization
- **File guard** — intercepts `Read` and `Grep` tool calls
- **Binary-aware** — PDF, DOCX, XLSX blocked at path level (no byte-level parsing)
- **Configurable patterns** — edit `config/sensitive_patterns.json`, no code changes needed
- **Fail-open** — hook errors never block Claude Code

## Requirements

- Windows 10/11
- Python 3.10+
- [Claude Code](https://claude.ai/code) (Claude Code desktop or CLI)

## Quick Start

```bat
git clone https://github.com/BartoszRadziszewski/AI_Privacy_Guard.git
cd AI_Privacy_Guard
scripts\install.bat
```

`install.bat` creates a Python venv, installs dependencies, and generates
`.claude/settings.local.json` with the correct hook paths for your machine.

> **First run** downloads the Bielik-Guard model (~500 MB) from HuggingFace automatically.

## Configuration

### Sensitive patterns

Edit `config/sensitive_patterns.json` to add path or content patterns:

```json
{
  "path_patterns": ["\\.env$", "spotkani", "pracowni", "kontakt", "..."],
  "content_peek_patterns": ["@[\\w.-]+\\.[a-z]{2,}", "\\+48[\\d \\-]{9,}"],
  "binary_extensions": [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"],
  "intercepted_tools": ["Read", "Grep"]
}
```

### Environment variables

| Variable | Description |
|----------|-------------|
| `PII_ANONYMIZER_PATH` | Directory containing `pii_anonymizer.py`. If unset, anonymization is skipped; safety classification still runs. |
| `HUGGINGFACE_HUB_TOKEN` | HuggingFace token for model download (only needed if repo is gated). |
| `BIELIK_GUARD_PATTERNS` | Absolute path to `sensitive_patterns.json` (overrides default). |

### PII anonymization module

The hooks use `pii_anonymizer.py` for tokenization. You can bring your own
implementation — it needs to export:

```python
def get_global() -> Anonymizer: ...

class Anonymizer:
    def anonymize(self, text: str) -> str: ...
    def stats(self) -> str: ...
```

Set `PII_ANONYMIZER_PATH` to the directory containing your implementation.

## Project structure

```
AI_Privacy_Guard/
├── .claude/
│   ├── hooks/
│   │   ├── guard.py            # UserPromptSubmit hook
│   │   └── pre_tool_hook.py    # PreToolUse hook (Read + Grep)
│   └── settings.json           # Project-level hook config (portable)
├── config/
│   └── sensitive_patterns.json # Detection patterns
├── scripts/
│   └── install.bat             # Windows setup script
├── CLAUDE.md                   # Instructions for Claude Code
├── requirements.txt
└── LICENSE
```

## Safety model

**[speakleash/Bielik-Guard-0.1B-v1.1](https://huggingface.co/speakleash/Bielik-Guard-0.1B-v1.1)**
Polish language safety classifier. Labels: `crime`, `hate`, `self-harm`, `sex`, `vulgar`.

| Label | Always block |
|-------|:---:|
| crime | ✓ |
| hate | ✓ |
| self-harm | ✓ |
| sex | — |
| vulgar | — |

Default threshold: `0.5`. Configurable via `--threshold` in CLI mode.

## CLI testing

```bat
:: Test prompt classification
venv\Scripts\python.exe .claude\hooks\guard.py --text "Normal question about Python."

:: Test file guard (should pass)
echo {"tool_name":"Read","tool_input":{"file_path":"C:\\project\\main.py"}} | ^
  venv\Scripts\python.exe .claude\hooks\pre_tool_hook.py

:: Test file guard (should block — sensitive path)
echo {"tool_name":"Read","tool_input":{"file_path":"C:\\docs\\kontakty.xlsx"}} | ^
  venv\Scripts\python.exe .claude\hooks\pre_tool_hook.py
```

## Known limitations

- Windows-only (hook paths use `\`; Linux/macOS support requires minor path adjustments)
- Model loads on every hook invocation (~3–5 s); acceptable for interactive sessions
- Binary files (PDF, DOCX…) are blocked at path level — content is not parsed
- PII anonymization requires an external `pii_anonymizer.py` module

## License

MIT © Bartosz Radziszewski, 2025
