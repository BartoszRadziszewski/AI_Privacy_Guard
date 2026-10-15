# -*- coding: utf-8 -*-
"""
PII-Guard - PreToolUse hook for Claude Code

Intercepts Read and Grep tool calls and blocks access to files containing
personally identifiable information (PII), returning anonymized content instead.

Detection levels:
  1. File path vs. path_patterns (regex on path/filename)
  2. Content peek — first 2000 chars vs. content_peek_patterns
     (skipped for binary formats: pdf, doc, docx, xls, xlsx, ppt, pptx)

Configuration: config/sensitive_patterns.json (editable without code changes)

Environment variables:
  PII_ANONYMIZER_PATH     Path to directory or file containing pii_anonymizer.py
  BIELIK_GUARD_PATTERNS   Path to sensitive_patterns.json (overrides default location)
  BIELIK_GUARD_BYPASS  "1" = emergency fail-open (old behaviour); default fail-closed

Exit codes:
  0  — pass through (no action)
  2  — block (JSON reason printed to stdout, or hook error — fail-closed)
"""

import sys
import json
import re
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Config file: check env var, then relative to project root, then script dir
def _resolve_patterns_file():
    env_path = os.environ.get("BIELIK_GUARD_PATTERNS", "").strip()
    if env_path and os.path.isfile(env_path):
        return env_path
    # When script lives in .claude/hooks/, project root is two levels up
    project_root = os.path.dirname(os.path.dirname(SCRIPT_DIR))
    candidates = [
        os.path.join(project_root, "config", "sensitive_patterns.json"),
        os.path.join(SCRIPT_DIR, "sensitive_patterns.json"),
        os.path.join(SCRIPT_DIR, "..", "..", "config", "sensitive_patterns.json"),
    ]
    for p in candidates:
        if os.path.isfile(p):
            return p
    return None


PATTERNS_FILE = _resolve_patterns_file()

CONTENT_PEEK_BYTES = 2000

# Fail-closed by default (DLPP). Emergency switch: BIELIK_GUARD_BYPASS=1
FAIL_OPEN = os.environ.get("BIELIK_GUARD_BYPASS", "").strip() == "1"


def log_bypass(component: str, detail: str):
    """Rejestruje uzycie furtki BIELIK_GUARD_BYPASS (EVENTLOG). Blad zapisu nie blokuje -
    furtka jest awaryjna - ale trafia na stderr."""
    try:
        import subprocess
        js = os.path.join(os.path.dirname(os.path.abspath(__file__)), "log-event.js")
        event = {
            "type": "guard.bypass", "object": component, "result": "success", "severity": "high",
            "reason": f"BIELIK_GUARD_BYPASS=1: przepuszczono mimo bledu ({str(detail)[:200]})",
        }
        proc = subprocess.run(["node", js, "append"], input=json.dumps(event, ensure_ascii=False).encode("utf-8"),
                              capture_output=True, timeout=10)
        if proc.returncode != 0:
            raise RuntimeError(proc.stderr.decode("utf-8", "replace").strip())
    except Exception as e:  # noqa: BLE001
        print(f"[Bielik-Guard] Nie zapisano uzycia BIELIK_GUARD_BYPASS w rejestrze: {e}", file=sys.stderr)


def _find_anonymizer_dir():
    """Find pii_anonymizer module. Checks PII_ANONYMIZER_PATH env var first."""
    env_val = os.environ.get("PII_ANONYMIZER_PATH", "").strip()
    candidates = []
    if env_val:
        candidates.append(os.path.dirname(env_val) if env_val.endswith(".py") else env_val)
    candidates.append(SCRIPT_DIR)
    for d in candidates:
        if os.path.isfile(os.path.join(d, "pii_anonymizer.py")):
            return d
    return None


def load_patterns():
    if not PATTERNS_FILE:
        raise RuntimeError("sensitive_patterns.json not found. Set BIELIK_GUARD_PATTERNS.")
    try:
        with open(PATTERNS_FILE, encoding="utf-8") as f:
            data = json.load(f)
        always_block = [re.compile(p, re.IGNORECASE) for p in data.get("always_block_patterns", [])]
        path_patterns = [re.compile(p, re.IGNORECASE) for p in data.get("path_patterns", [])]
        content_patterns = [re.compile(p, re.IGNORECASE) for p in data.get("content_peek_patterns", [])]
        binary_exts = set(ext.lower() for ext in data.get("binary_extensions", []))
        intercepted_tools = set(data.get("intercepted_tools", ["Read"]))
        return always_block, path_patterns, content_patterns, binary_exts, intercepted_tools
    except Exception as e:
        raise RuntimeError(f"Failed to load patterns: {e}") from e


def is_sensitive_path(path_str, path_patterns):
    normalized = path_str.replace("\\", "/")
    return any(p.search(normalized) for p in path_patterns)


def is_binary(file_path, binary_exts):
    _, ext = os.path.splitext(file_path)
    return ext.lower() in binary_exts


def has_sensitive_content(file_path, content_patterns):
    try:
        with open(file_path, encoding="utf-8", errors="replace") as f:
            peek = f.read(CONTENT_PEEK_BYTES)
        return any(p.search(peek) for p in content_patterns)
    except Exception as e:
        # Fail-closed: an unreadable existing file is treated as sensitive
        # (handle_read then blocks it if anonymization cannot read it either).
        print(f"[PII-Guard] Cannot peek file: {e}", file=sys.stderr)
        return os.path.exists(file_path)


def load_anonymizer():
    anon_dir = _find_anonymizer_dir()
    if anon_dir is None:
        raise ImportError(
            "pii_anonymizer.py not found. Set PII_ANONYMIZER_PATH environment variable."
        )
    if anon_dir not in sys.path:
        sys.path.insert(0, anon_dir)
    from pii_anonymizer import get_global
    return get_global()


def anonymize_file(file_path):
    """Reads and anonymizes file. Returns (original, anonymized), (None, None) on read error,
    (original, None) on anonymization error (fail-closed: caller blocks)."""
    try:
        with open(file_path, encoding="utf-8", errors="replace") as f:
            original = f.read()
    except Exception as e:
        print(f"[PII-Guard] Cannot read file: {e}", file=sys.stderr)
        return None, None

    try:
        anon = load_anonymizer()
        cleaned = anon.anonymize(original)
        return original, cleaned
    except Exception as e:
        print(f"[PII-Guard] Anonymization error: {e}", file=sys.stderr)
        return original, None


def deny_result(reason):
    return {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }


def handle_read(tool_input, always_block, path_patterns, content_patterns, binary_exts):
    file_path = tool_input.get("file_path", "")
    if not file_path:
        return None

    if always_block and is_sensitive_path(file_path, always_block):
        print(f"[PII-Guard] Always-blocked secrets file (Read): {file_path}", file=sys.stderr)
        return deny_result(
            f"[PII-Guard] '{os.path.basename(file_path)}' jest plikiem sekretów (always-block). "
            f"Dostęp zablokowany. Użyj tego pliku bezpośrednio w aplikacji — nie przez Claude."
        )

    sensitive = is_sensitive_path(file_path, path_patterns)
    binary = is_binary(file_path, binary_exts)

    if not sensitive and not binary and content_patterns:
        sensitive = has_sensitive_content(file_path, content_patterns)

    if not sensitive:
        return None

    print(f"[PII-Guard] Sensitive file (Read): {file_path}", file=sys.stderr)

    if binary:
        _, ext = os.path.splitext(file_path)
        return deny_result(
            f"[PII-Guard] '{os.path.basename(file_path)}' is a binary format ({ext}) "
            f"and may contain personal data (PII). Access blocked. "
            f"Open the file manually and paste only the required excerpt."
        )

    original, cleaned = anonymize_file(file_path)

    if original is None:
        return deny_result(
            f"[PII-Guard] '{os.path.basename(file_path)}' may contain PII "
            f"but could not be read for anonymization. Access blocked."
        )

    if cleaned is None:
        return deny_result(
            f"[PII-Guard] '{os.path.basename(file_path)}' may contain PII "
            f"and the anonymizer failed (fail-closed). Access blocked."
        )

    if cleaned == original:
        print(f"[PII-Guard] No PII detected in content, passing: {file_path}", file=sys.stderr)
        return None

    return deny_result(
        f"[PII-Guard] '{os.path.basename(file_path)}' contained personal data. "
        f"Anonymized content below:\n\n"
        f"--- CONTENT (anonymized) ---\n{cleaned}\n--- END ---"
    )


def handle_grep(tool_input, always_block, path_patterns, content_patterns, binary_exts):
    search_path = tool_input.get("path", "")
    glob_pat = tool_input.get("glob", "")
    combined = f"{search_path} {glob_pat}".strip()

    if not combined:
        return None

    if always_block and is_sensitive_path(combined, always_block):
        print(f"[PII-Guard] Always-blocked secrets path (Grep): {combined}", file=sys.stderr)
        return deny_result(
            f"[PII-Guard] Grep trafia na plik sekretów (always-block): '{combined}'. Dostęp zablokowany."
        )

    if not is_sensitive_path(combined, path_patterns):
        return None

    print(f"[PII-Guard] Grep on sensitive path: {combined}", file=sys.stderr)

    return deny_result(
        f"[PII-Guard] Grep targets a sensitive area: '{combined}'. "
        f"Access blocked. Narrow the search scope or inspect the file manually."
    )


TOOL_HANDLERS = {
    "Read": handle_read,
    "Grep": handle_grep,
}


def main():
    data = json.loads(sys.stdin.buffer.read().decode("utf-8"))

    tool_name = data.get("tool_name", "")
    tool_input = data.get("tool_input", {})

    always_block, path_patterns, content_patterns, binary_exts, intercepted_tools = load_patterns()

    if tool_name not in intercepted_tools:
        sys.exit(0)

    handler = TOOL_HANDLERS.get(tool_name)
    if handler is None:
        sys.exit(0)

    result = handler(tool_input, always_block, path_patterns, content_patterns, binary_exts)

    if result is None:
        sys.exit(0)

    print(json.dumps(result, ensure_ascii=True))
    sys.exit(2)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:
        if FAIL_OPEN:
            print(f"[PII-Guard] Unexpected error (BIELIK_GUARD_BYPASS=1, passing): {e}", file=sys.stderr)
            log_bypass("pre_tool_hook.py", e)
            sys.exit(0)
        print(f"[PII-Guard] Hook error — access blocked (fail-closed): {e}. "
              f"Emergency bypass: set BIELIK_GUARD_BYPASS=1.", file=sys.stderr)
        sys.exit(2)
