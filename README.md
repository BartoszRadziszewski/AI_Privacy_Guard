# AI Privacy Guard

**PII protection and data-governance hooks for [Claude Code](https://claude.ai/code).**

Stops personal data from reaching the Anthropic API in user prompts and in files
Claude reads, checks data leaving the machine, backs up files before Claude edits
them, and keeps a tamper-evident event log. All hooks are **fail-closed**: if a
check cannot run, the action is blocked, not allowed through.

> **Scope:** hooks run only in Claude Code (CLI, desktop Code tab, IDE extensions).
> They do not protect the Claude chat on claude.ai.

---

## How it works

```
User prompt
    │
    ▼
[UserPromptSubmit] → guard.py
    ├── Safety classification (Bielik-Guard model) → blocks crime · hate · self-harm
    └── PII detection → prompt BLOCKED; the message shows an anonymized version
        ([EMAIL_1] [OSOBA_1] [TEL_1]) to resend, or resend the original
        with [PII-OK] at the start (explicit decision, written to the event log)
    │
    ▼
Claude plans a tool call
    ├── Read / Grep        → pre_tool_hook.py      (file guard)
    ├── Write / Edit / …   → backup_hook.js        (copy to archiwum/name_vN.ext first)
    └── WebFetch / WebSearch / Bash / PowerShell / mcp__*
                           → outbound_pii_hook.py  (secrets and PII in outgoing data)
    │
    ▼
log-event.js → logs/events.jsonl (append-only, SHA-256 hash chain)
```

> **Why prompts are blocked, not rewritten:** a `UserPromptSubmit` hook cannot
> replace the prompt text (it can only block it or add context). Earlier versions
> returned `{"decision": "modify"}`, which Claude Code ignores, so PII reached the
> model unchanged. Since v3 the prompt is blocked and the user decides.

## Features

- **Prompt moderation** — Polish NLP safety model (Bielik-Guard 0.1B)
- **PII gate on prompts** — block + anonymized suggestion; per-prompt override with `[PII-OK]`
- **File guard** — intercepts `Read` and `Grep`; `always_block_patterns` for secrets and confidential directories
- **Backup before change** — copy to `archiwum/` with SHA-256 verification before every Write/Edit
- **Outbound check** — secrets → deny; PII in a fetched URL → deny; PII in MCP calls, `git push`, `curl` → ask the user
- **Event log** — append-only JSONL with hash chain, `verify` command, no PII or secrets in entries
- **Fail-closed** — hook errors block the action; emergency switch `BIELIK_GUARD_BYPASS=1` (each use is logged)
- **Configurable** — `config/sensitive_patterns.json`, `config/governance.json`; private values in a local file outside the repo

## Requirements

- Python 3.10+ (venv with `transformers`, `torch`; the CPU build of torch is enough)
- Node.js 18+ (backup hook and event log)
- [Claude Code](https://code.claude.com/docs/en/setup) (desktop or CLI; needs a Pro, Max, Team or Enterprise plan)
- Windows 10/11 is the tested platform (`scripts\install.bat`, hook commands use `venv\Scripts\python.exe`).
  macOS/Linux: run `scripts/install.sh` and change the interpreter path in hook commands to `venv/bin/python`
  (see [Hook registration](#hook-registration)). With the Windows path on macOS/Linux the fail-closed guard
  blocks every prompt.

> **No model, no torch needed for the demo.** `demo/separacja.py` runs on the standard library plus
> `.claude/hooks/pii_anonymizer.py` on any OS. Start there: [demo/README.md](demo/README.md).

## Quick Start

```bat
git clone https://github.com/BartoszRadziszewski/AI_Privacy_Guard.git
cd AI_Privacy_Guard
scripts\install.bat
```

macOS/Linux:

```bash
git clone https://github.com/BartoszRadziszewski/AI_Privacy_Guard.git
cd AI_Privacy_Guard
bash scripts/install.sh
```

The installers create a Python venv and install dependencies. The CPU build of torch
(~200 MB) is enough; on Linux a plain `pip install torch` pulls the CUDA build (2 GB+), so the
installer and `requirements.txt` use `--index-url https://download.pytorch.org/whl/cpu`.
If you install by hand: `pip install torch --index-url https://download.pytorch.org/whl/cpu`,
then `pip install transformers`. The project-level
`.claude/settings.json` (and `.codex/hooks.json` for Codex) runs the prompt and file
guards with the venv interpreter when you work inside this repo. To protect all your
projects, register the hooks globally — see [Hook registration](#hook-registration).

> **First run** downloads the Bielik-Guard model (~500 MB) from HuggingFace automatically.
> Use the venv interpreter in hook commands: with a Python that lacks `transformers`,
> the fail-closed guard blocks every prompt.

## Hook registration

Example entries for `~/.claude/settings.json` (replace `<repo>` with your clone path;
on macOS/Linux replace `<repo>/venv/Scripts/python.exe` with `<repo>/venv/bin/python`):

```json
{
  "env": { "BIELIK_GUARD_LOCAL_ALLOWLIST": "<path outside the repo>/allowlist.json" },
  "hooks": {
    "UserPromptSubmit": [
      { "hooks": [{ "type": "command", "command": "<repo>/venv/Scripts/python.exe <repo>/.claude/hooks/guard.py", "timeout": 30 }] }
    ],
    "PreToolUse": [
      { "matcher": "Read", "hooks": [{ "type": "command", "command": "<repo>/venv/Scripts/python.exe <repo>/.claude/hooks/pre_tool_hook.py", "timeout": 15 }] },
      { "matcher": "Grep", "hooks": [{ "type": "command", "command": "<repo>/venv/Scripts/python.exe <repo>/.claude/hooks/pre_tool_hook.py", "timeout": 15 }] },
      { "matcher": "^(Write|Edit|MultiEdit|NotebookEdit)$", "hooks": [{ "type": "command", "command": "node <repo>/.claude/hooks/backup_hook.js", "timeout": 20 }] },
      { "matcher": "^(WebFetch|WebSearch|Bash|PowerShell)$|^mcp__(?!ccd_|terminal__|visualize__).*", "hooks": [{ "type": "command", "command": "<repo>/venv/Scripts/python.exe <repo>/.claude/hooks/outbound_pii_hook.py", "timeout": 30 }] }
    ]
  }
}
```

`destructive_cmd_hook.js` (backup before `rm`, `mv`, `Remove-Item`, `>` …) is included
but optional; register it with matcher `^(Bash|PowerShell)$` if you want it.

## Demo: data separation before sending to a model

`demo/` holds a synthetic data set (invoices, a dunning e-mail, board minutes, a contract
fragment, a prompt) before and after separation, the script `separacja.py` (minimisation →
PII tokens with checksum validation → business secrets list → amount buckets), an optional
Presidio/spaCy variant of `pii_anonymizer.py` that the hooks pick up through
`PII_ANONYMIZER_PATH`, and `METODA.md` describing the method. Works without the model and
without Claude Code:

```bash
cd demo
python separacja.py --in przed --out po
python separacja.py --in przed --out po_przedzialy --kwoty=przedzialy
```

Details and the live-demo script: [demo/README.md](demo/README.md).

## Configuration

### `config/sensitive_patterns.json` — file guard

```json
{
  "always_block_patterns": ["\\.pem$", "(token|key|secret|password).*\\.txt$", "..."],
  "path_patterns": ["\\.env$", "spotkani", "pracowni", "kontakt", "..."],
  "content_peek_patterns": ["@[\\w.-]+\\.[a-z]{2,}", "\\+48[\\d \\-]{9,}"],
  "binary_extensions": [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"],
  "intercepted_tools": ["Read", "Grep"]
}
```

Paths matching `always_block_patterns` are blocked without reading the file.

### `config/governance.json` — backup, outbound check, event log

Backup exclusions, trusted MCP prefixes, log location, confidentiality labels.
Keep `allow_value_patterns` empty in the repo; put your own addresses in the local
file named by `BIELIK_GUARD_LOCAL_ALLOWLIST` (same key, patterns are merged).

### Environment variables

| Variable | Description |
|----------|-------------|
| `BIELIK_GUARD_LOCAL_ALLOWLIST` | Path to a local JSON file (outside the repo) with `allow_value_patterns`, e.g. your own e-mail addresses. Used by `guard.py` and `outbound_pii_hook.py`. |
| `BIELIK_GUARD_PII_MODE` | `block` (default) or `warn` (prompt passes with a warning — PII reaches the model). |
| `BIELIK_GUARD_BYPASS` | `1` = emergency fail-open for `guard.py` and `pre_tool_hook.py`. Every use is logged. |
| `EVENT_LOG_PATH` | Overrides the event log location. |
| `BIELIK_GUARD_PROJECTS_ROOT` | Folder containing your projects; the first path segment below it becomes the client label in the event log. Unset = no client label. |
| `PII_ANONYMIZER_PATH` | Directory containing `pii_anonymizer.py` (default: the hooks directory). |
| `BIELIK_GUARD_PATTERNS` | Absolute path to `sensitive_patterns.json` (overrides default). |
| `HUGGINGFACE_HUB_TOKEN` | HuggingFace token for model download (only if the repo is gated). |

## Prompt with PII — what the user sees

```
[PII-Filter] Prompt zawiera dane osobowe i nie zostal wyslany do Claude.
Masz dwie mozliwosci:
  1) wyslij ponownie wersje zanonimizowana (ponizej), albo
  2) wyslij oryginal z [PII-OK] na poczatku - przejdzie jawnie, decyzja trafi do rejestru.

Napisz do [EMAIL_1] w sprawie umowy
```

- `[PII-OK]` must be the first characters of the prompt and applies to that prompt only.
- It does not bypass the safety classifier. For a false positive of the classifier
  (`crime`, `sex`, `vulgar`) start the prompt with `[GUARD-OK]`; `hate` and `self-harm`
  are always blocked. Both markers can be combined: `[GUARD-OK] [PII-OK] …`.
  Every override is written to the event log.
- Token mapping lives only in the hook process — replace tokens in Claude's answer manually.

## Event log

```bat
node .claude\hooks\log-event.js verify    :: check numbering and hash chain
node .claude\hooks\log-event.js tail      :: last entries
node scripts\review-event-log.js          :: integrity + anomaly report (logs\raporty\)
```

Entries store paths, categories and counts — never PII values or secrets.
A gap or hash mismatch is an incident.

## Project structure

```
AI_Privacy_Guard/
├── .claude/hooks/
│   ├── guard.py                # UserPromptSubmit: moderation + PII gate
│   ├── pre_tool_hook.py        # PreToolUse: Read + Grep file guard
│   ├── backup_hook.js          # PreToolUse: backup before Write/Edit
│   ├── backup_lib.js           # shared backup logic
│   ├── destructive_cmd_hook.js # PreToolUse (optional): backup before destructive shell commands
│   ├── outbound_pii_hook.py    # PreToolUse: outbound data check
│   ├── log-event.js            # event log (append, verify, tail)
│   └── pii_anonymizer.py       # regex anonymizer
├── .codex/                     # the same hooks for Codex CLI
├── config/
│   ├── sensitive_patterns.json
│   └── governance.json
├── demo/                       # synthetic data, separacja.py, Presidio variant, METODA.md
├── scripts/
│   ├── install.bat             # Windows
│   ├── install.sh              # macOS / Linux
│   └── review-event-log.js
├── CLAUDE.md
├── requirements.txt
└── LICENSE
```

## Safety model

**[speakleash/Bielik-Guard-0.1B-v1.1](https://huggingface.co/speakleash/Bielik-Guard-0.1B-v1.1)**
Polish language safety classifier. Labels: `crime`, `hate`, `self-harm`, `sex`, `vulgar`.
`crime`, `hate` and `self-harm` are always blocked. Default threshold: `0.5`
(`--threshold` in CLI mode).

## CLI testing

```bat
:: Prompt classification
venv\Scripts\python.exe .claude\hooks\guard.py --text "Normal question about Python."

:: File guard (should pass)
echo {"tool_name":"Read","tool_input":{"file_path":"C:\\project\\main.py"}} | ^
  venv\Scripts\python.exe .claude\hooks\pre_tool_hook.py

:: File guard (should block — sensitive path)
echo {"tool_name":"Read","tool_input":{"file_path":"C:\\docs\\kontakty.xlsx"}} | ^
  venv\Scripts\python.exe .claude\hooks\pre_tool_hook.py
```

## Known limitations

- Hooks protect Claude Code only, not the claude.ai chat.
- A hook **timeout** still lets the action through (Claude Code before `onFailure: "block"` support); fail-closed covers errors inside the scripts.
- The event log records the intent before an action, not the result after it (no `PostToolUse` hook yet).
- The regex anonymizer treats any 9-digit number as a phone number (false positives on invoice or order numbers); PESEL, NIP, IBAN and names in free text are only partly detected.
- Hook commands in `.claude/settings.json` use Windows venv paths; on macOS/Linux edit them to `venv/bin/python`. The model loads on every prompt (~3–5 s).
- Binary files (PDF, DOCX…) are blocked at path level — content is not parsed.

## License

MIT © Bartosz Radziszewski, 2025
