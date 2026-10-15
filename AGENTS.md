# AI Privacy Guard — Codex Hooks

This project adds PII protection hooks to Codex. The hooks in `.codex/hooks/` are
copies of the Claude Code hooks in `.claude/hooks/` (source of truth) — after
changing a hook there, copy it here as well. All hooks are **fail-closed**.

## Hook Overview

| Hook | File | Trigger |
|------|------|---------|
| `UserPromptSubmit` | `.codex/hooks/guard.py` | Every user prompt |
| `PreToolUse` | `.codex/hooks/pre_tool_hook.py` | `Read` and `Grep` tool calls |

Registered in `.codex/hooks.json`, run with the project venv interpreter.

## What the hooks do

**guard.py** — classifies the prompt with the Bielik-Guard model (Polish NLP,
0.1B parameters) and blocks `crime`, `hate`, `self-harm`. A prompt containing
PII is **blocked**: the message shows an anonymized version to resend, or the
user resends the original starting with `[PII-OK]` (explicit decision, written to
the event log via `.codex/hooks/log-event.js`). A prompt hook cannot replace the
prompt text — never return `{"decision": "modify"}`.

**pre_tool_hook.py** — checks the path (`always_block_patterns`, `path_patterns`)
and content (first 2000 chars) of files the agent reads. Text files with PII are
blocked with anonymized content in the reason; binary files on sensitive paths
are blocked.

## Fail-closed design

Hook errors block the action. Emergency switch: `BIELIK_GUARD_BYPASS=1`
(every use is logged). A Python without `transformers` makes `guard.py` block
every prompt — keep the venv interpreter in `.codex/hooks.json`.
Stdout is reserved for JSON output; diagnostics go to stderr.

## Configuration and environment variables

Same as for Claude Code — see `CLAUDE.md` and `README.md`:
`config/sensitive_patterns.json`, `config/governance.json`,
`BIELIK_GUARD_LOCAL_ALLOWLIST`, `BIELIK_GUARD_PII_MODE`, `BIELIK_GUARD_BYPASS`,
`EVENT_LOG_PATH`, `PII_ANONYMIZER_PATH`, `BIELIK_GUARD_PATTERNS`.
Without `BIELIK_GUARD_LOCAL_ALLOWLIST` in the Codex environment, the owner's own
addresses are treated as PII too.

## Rules for working in this repo

The repo is public: no personal data, own addresses, local absolute paths or
logs in commits; replace local paths with environment variables before pushing.
