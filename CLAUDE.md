# AI Privacy Guard — Claude Code Hooks

This project adds two security layers to Claude Code via hooks, protecting PII
from reaching the Anthropic API.

## Hook Overview

| Hook | File | Trigger |
|------|------|---------|
| `UserPromptSubmit` | `.claude/hooks/guard.py` | Every user prompt |
| `PreToolUse` | `.claude/hooks/pre_tool_hook.py` | `Read` and `Grep` tool calls |

## What the hooks do

**guard.py** — classifies the user's prompt using the Bielik-Guard safety model
(Polish NLP, 0.1B parameters). Blocks prompts flagged as `crime`, `hate`, or
`self-harm`. Anonymizes PII (emails, phone numbers, names) before the prompt
reaches Claude.

**pre_tool_hook.py** — intercepts file reads. Checks the file path and content
(first 2000 chars) against sensitive patterns. For text files: returns anonymized
content. For binary files (pdf, docx, xlsx…): blocks access with an explanation.

## Sensitive patterns

Edit `config/sensitive_patterns.json` to add/remove detection patterns.
No code changes required.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PII_ANONYMIZER_PATH` | Optional | Path to directory containing `pii_anonymizer.py`. If unset, PII anonymization is skipped (classification still runs). |
| `BIELIK_GUARD_PATTERNS` | Optional | Absolute path to `sensitive_patterns.json`. Overrides default location. |

## Fail-open design

Hook errors always exit with code 0 — Claude Code continues normally.
Stdout is reserved for JSON output to Claude Code.
Diagnostic logs go to stderr.

## Adding new tool interceptors

1. Add the tool name to `intercepted_tools` in `config/sensitive_patterns.json`
2. Add a handler function `handle_<toolname>(tool_input, ...)` in `pre_tool_hook.py`
3. Register it in the `TOOL_HANDLERS` dict

## Testing hooks from CLI

```bash
# Should pass (neutral file)
echo '{"tool_name":"Read","tool_input":{"file_path":"/project/main.py"}}' \
  | python .claude/hooks/pre_tool_hook.py

# Should block (sensitive path)
echo '{"tool_name":"Read","tool_input":{"file_path":"/docs/spotkanie.pdf"}}' \
  | python .claude/hooks/pre_tool_hook.py
```
