# AI Privacy Guard — Claude Code Hooks

This project provides Claude Code hooks that keep personal and confidential data
from reaching the Anthropic API, back up files before changes, check outgoing
data, and keep a tamper-evident event log. All hooks are **fail-closed**.

## Hook Overview

| Hook | File | Trigger |
|------|------|---------|
| `UserPromptSubmit` | `.claude/hooks/guard.py` | Every user prompt |
| `PreToolUse` | `.claude/hooks/pre_tool_hook.py` | `Read`, `Grep` |
| `PreToolUse` | `.claude/hooks/backup_hook.js` | `Write`, `Edit`, `MultiEdit`, `NotebookEdit` |
| `PreToolUse` | `.claude/hooks/outbound_pii_hook.py` | `WebFetch`, `WebSearch`, `Bash`, `PowerShell`, `mcp__*` (except trusted prefixes) |
| `PreToolUse` (optional, not registered by default) | `.claude/hooks/destructive_cmd_hook.js` | `Bash`, `PowerShell` |

Event log: `.claude/hooks/log-event.js` → `logs/events.jsonl` (append-only, SHA-256 chain).

## What the hooks do

**guard.py** — classifies the prompt with the Bielik-Guard model (Polish NLP,
0.1B parameters) and blocks `crime`, `hate`, `self-harm`. If the prompt contains
PII, it is **blocked**: the message shows an anonymized version to resend, or the
user resends the original starting with `[PII-OK]` (explicit decision, logged).
A `UserPromptSubmit` hook cannot replace the prompt text — never return
`{"decision": "modify"}`; Claude Code ignores it and the PII passes through.
Values matching `allow_value_patterns` (repo config + local file from
`BIELIK_GUARD_LOCAL_ALLOWLIST`) are not treated as PII.

**pre_tool_hook.py** — checks the path (`always_block_patterns`, `path_patterns`)
and content (first 2000 chars) of files Claude reads. `always_block_patterns`
block without reading. Text files with PII: blocked with anonymized content in
the reason. Binary files on sensitive paths: blocked.

**backup_hook.js** — before Claude changes an existing file, copies it to
`archiwum/name_vN.ext` next to the file, verifies size and SHA-256, and logs the
event. A failed copy or log write blocks the edit.

**outbound_pii_hook.py** — scans outgoing data: secrets → deny; PII in a fetched
URL or query → deny; PII in MCP calls, `git push`, `curl` and similar → ask the
user. Only categories and counts go to the log, never values.

## Fail-closed design

Hook errors block the action (exit code 2, or a `block`/`deny` decision).
Emergency switch: `BIELIK_GUARD_BYPASS=1` restores pass-through for `guard.py`
and `pre_tool_hook.py`; every use is written to the event log.
Hook commands must use the project venv interpreter — a Python without
`transformers` makes `guard.py` block every prompt.
Stdout is reserved for JSON output to Claude Code; diagnostics go to stderr.
Known gap: a hook **timeout** still lets the action through in Claude Code
versions without `onFailure: "block"`.

## Configuration

- `config/sensitive_patterns.json` — file guard patterns (no code changes needed).
- `config/governance.json` — event log path, backup exclusions, trusted MCP
  prefixes, confidentiality labels, `allow_value_patterns` (keep empty in the repo).

## Environment variables

| Variable | Description |
|----------|-------------|
| `BIELIK_GUARD_LOCAL_ALLOWLIST` | Local JSON file outside the repo with `allow_value_patterns` (e.g. the owner's own addresses). |
| `BIELIK_GUARD_PII_MODE` | `block` (default) or `warn`. |
| `BIELIK_GUARD_BYPASS` | `1` = emergency fail-open (logged). |
| `EVENT_LOG_PATH` | Overrides the event log location. |
| `PII_ANONYMIZER_PATH` | Directory containing `pii_anonymizer.py` (default: hooks directory). |
| `BIELIK_GUARD_PATTERNS` | Absolute path to `sensitive_patterns.json`. |

## Rules for working in this repo

- The repo is public. Never commit personal data, own addresses, local absolute
  paths (`<drive>:/<your folders>/...`) or logs. Replace local paths with environment
  variables before pushing; keep private values in files outside the repo.
- `archiwum/`, `logs/`, `propozycje/`, `dziennik-projektu.md`,
  `architektura-projektu.md` are git-ignored and stay local.
- Changing an active hook changes protection for every Claude Code session on
  this machine: test with synthetic data first (never real PII), keep a copy
  in `archiwum/`, and record the change in `dziennik-projektu.md`.

## Adding new tool interceptors (file guard)

1. Add the tool name to `intercepted_tools` in `config/sensitive_patterns.json`
2. Add a handler function `handle_<toolname>(tool_input, ...)` in `pre_tool_hook.py`
3. Register it in the `TOOL_HANDLERS` dict

## Testing hooks from CLI

```bash
# Should pass (neutral file)
echo '{"tool_name":"Read","tool_input":{"file_path":"/project/main.py"}}' \
  | venv/Scripts/python.exe .claude/hooks/pre_tool_hook.py

# Should block (sensitive path)
echo '{"tool_name":"Read","tool_input":{"file_path":"/docs/spotkanie.pdf"}}' \
  | venv/Scripts/python.exe .claude/hooks/pre_tool_hook.py

# Event log integrity
node .claude/hooks/log-event.js verify
```

Use `EVENT_LOG_PATH` pointing to a scratch file when testing, so test events do
not enter the real log.
