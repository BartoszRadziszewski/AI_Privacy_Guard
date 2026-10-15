# -*- coding: utf-8 -*-
"""
Outbound PII Guard - PreToolUse hook (reguła DLPP: kontrola wyjścia)

Sprawdza dane wychodzące poza środowisko zaufane, zanim narzędzie je wyśle:
  WebFetch / WebSearch       -> URL, prompt, zapytanie
  mcp__*                     -> całe wejście narzędzia MCP (poza prefiksami zaufanymi)
  Bash / PowerShell          -> tylko polecenia wysyłające (git push, curl, wget,
                                Invoke-WebRequest/RestMethod, scp, rsync, gh ... create/comment,
                                npm publish); dla git push także dodane wiersze wypychanych commitów

Wykrywanie: pii_anonymizer.py (e-maile, osoby z nagłówków e-mail, telefony)
            + PESEL (z sumą kontrolną), karta (Luhn), IBAN PL, wzorce sekretów.

Decyzje:
  sekret                                  -> deny
  PII w WebFetch / WebSearch (URL/zapytanie) -> deny
  PII gdzie indziej (MCP, git push, curl)  -> ask (decyzja człowieka)
  nie da się sprawdzić (git, limit)        -> ask
  błąd hooka                               -> exit 2 (blokada, fail-closed)
  brak wpisu w rejestrze przy przepuszczeniu -> deny (fail-closed)

W rejestrze zapisywane są tylko kategorie i liczby trafień – nigdy wartości.
Konfiguracja: config/governance.json (sekcja "outbound").
"""

import io
import json
import os
import re
import subprocess
import sys
from urllib.parse import urlparse

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(os.path.dirname(SCRIPT_DIR))
CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "governance.json")
LOG_EVENT_JS = os.path.join(SCRIPT_DIR, "log-event.js")

sys.path.insert(0, SCRIPT_DIR)
from pii_anonymizer import Anonymizer  # noqa: E402

SECRET_PATTERNS = [
    ("klucz_anthropic", re.compile(r"sk-ant-[A-Za-z0-9_\-]{20,}")),
    ("klucz_openai", re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_\-]{20,}")),
    ("token_github", re.compile(r"\b(?:ghp|gho|ghs|ghu|ghr)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}")),
    ("klucz_aws", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("token_slack", re.compile(r"\bxox[abprs]-[A-Za-z0-9\-]{10,}")),
    ("token_huggingface", re.compile(r"\bhf_[A-Za-z0-9]{30,}")),
    ("klucz_google", re.compile(r"\bAIza[0-9A-Za-z_\-]{35}\b")),
    ("klucz_prywatny", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
]

RE_PESEL = re.compile(r"(?<!\d)\d{11}(?!\d)")
RE_CARD = re.compile(r"(?<!\d)(?:\d[ \-]?){12,18}\d(?!\d)")
RE_IBAN_PL = re.compile(r"\bPL\s?\d{2}(?:\s?\d{4}){6}\b", re.IGNORECASE)

OUTBOUND_CMD = re.compile(
    r"\bgit\b[^\n|;&]*\bpush\b"
    r"|\bcurl(?:\.exe)?\b|\bwget\b"
    r"|\bInvoke-(?:WebRequest|RestMethod)\b|\b(?:iwr|irm)\s"
    r"|\bscp\b|\brsync\b"
    r"|\bgh\s+(?:pr|issue|gist|release|repo)\s+(?:create|comment|edit)\b"
    r"|\bnpm\s+publish\b",
    re.IGNORECASE,
)
GIT_PUSH = re.compile(r"\bgit\b[^\n|;&]*\bpush\b", re.IGNORECASE)


def load_config():
    with open(CONFIG_PATH, encoding="utf-8") as f:
        return json.load(f)


def pesel_valid(s):
    w = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3]
    return (10 - sum(int(s[i]) * w[i] for i in range(10)) % 10) % 10 == int(s[10])


def luhn_valid(digits):
    total, alt = 0, False
    for ch in reversed(digits):
        d = int(ch)
        if alt:
            d *= 2
            if d > 9:
                d -= 9
        total += d
        alt = not alt
    return total % 10 == 0


def scan(text, allow_patterns):
    """Zwraca (pii: dict kategoria->liczba, sekrety: dict kategoria->liczba). Bez wartości."""
    allow = [re.compile(p, re.IGNORECASE) for p in allow_patterns]

    def allowed(value):
        return any(p.search(value) for p in allow)

    pii, secrets = {}, {}
    for name, pat in SECRET_PATTERNS:
        n = len(pat.findall(text))
        if n:
            secrets[name] = n

    anon = Anonymizer()
    anon.anonymize(text)
    for token, value in anon.get_map().items():
        if allowed(value):
            continue
        cat = token.strip("[]").rsplit("_", 1)[0]
        pii[cat] = pii.get(cat, 0) + 1

    for m in RE_PESEL.finditer(text):
        if pesel_valid(m.group(0)) and not allowed(m.group(0)):
            pii["PESEL"] = pii.get("PESEL", 0) + 1
    for m in RE_CARD.finditer(text):
        digits = re.sub(r"\D", "", m.group(0))
        if 13 <= len(digits) <= 19 and luhn_valid(digits) and not allowed(m.group(0)):
            pii["KARTA"] = pii.get("KARTA", 0) + 1
    for m in RE_IBAN_PL.finditer(text):
        if not allowed(m.group(0)):
            pii["IBAN"] = pii.get("IBAN", 0) + 1
    return pii, secrets


def summary(counts):
    return ", ".join(f"{k}: {v}" for k, v in sorted(counts.items()))


def git_push_payload(command, cwd, max_bytes):
    """Dodane wiersze z commitów, których nie ma na żadnym zdalnym. (tekst, problem|None)"""
    m = re.search(r"\bgit\s+-C\s+(\"[^\"]+\"|'[^']+'|\S+)", command)
    if m:
        cwd = os.path.join(cwd, m.group(1).strip("\"'"))
    elif re.search(r"\bcd\s+\S", command):
        return "", "polecenie zmienia katalog (cd) – nie da się ustalić repozytorium"
    try:
        proc = subprocess.run(
            ["git", "log", "-p", "--no-color", "--no-ext-diff", "HEAD", "--not", "--remotes"],
            cwd=cwd, capture_output=True, timeout=20,
        )
    except Exception as e:  # noqa: BLE001
        return "", f"nie udało się uruchomić git ({e})"
    if proc.returncode != 0:
        return "", "git log zwrócił błąd: " + proc.stderr.decode("utf-8", "replace").strip()[:200]
    if len(proc.stdout) > max_bytes:
        return "", f"wypychane zmiany przekraczają {max_bytes // 1048576} MB – skan pominięty"
    out = proc.stdout.decode("utf-8", "replace")
    added = [ln[1:] for ln in out.splitlines() if ln.startswith("+") and not ln.startswith("+++")]
    return "\n".join(added), None


def log_event(event):
    """Zapis do rejestru przez log-event.js. Zwraca None albo opis błędu."""
    try:
        proc = subprocess.run(
            ["node", LOG_EVENT_JS, "append"],
            input=json.dumps(event, ensure_ascii=False).encode("utf-8"),
            capture_output=True, timeout=15,
        )
    except Exception as e:  # noqa: BLE001
        return str(e)
    if proc.returncode != 0:
        return proc.stderr.decode("utf-8", "replace").strip() or f"exit {proc.returncode}"
    return None


def emit(kind, reason):
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": kind,
            "permissionDecisionReason": reason,
        }
    }, ensure_ascii=False))
    sys.exit(0)


def main():
    data = json.loads(sys.stdin.buffer.read().decode("utf-8"))
    tool =data.get("tool_name", "")
    tin = data.get("tool_input", {}) or {}
    cwd = data.get("cwd") or os.getcwd()
    cfg = load_config().get("outbound", {})
    allow = list(cfg.get("allow_value_patterns", []))
    local_path = os.environ.get("BIELIK_GUARD_LOCAL_ALLOWLIST", "").strip()
    if local_path:
        # Plik lokalny spoza repo (np. wlasne adresy), sciezka w zmiennej srodowiskowej;
        # brak pliku = tylko wzorce z governance.json
        try:
            with open(local_path, encoding="utf-8") as f:
                allow += json.load(f).get("allow_value_patterns", [])
        except FileNotFoundError:
            print(f"[DLPP] Brak pliku lokalnego allowlisty: {local_path}", file=sys.stderr)

    problem = None
    strict = False  # True = PII prowadzi do deny, nie ask
    if tool == "WebFetch":
        text = f"{tin.get('url', '')}\n{tin.get('prompt', '')}"
        host = urlparse(tin.get("url", "")).hostname or "?"
        etype, obj, okey, strict = "net.fetch", f"web:{host}", host, True
    elif tool == "WebSearch":
        text = tin.get("query", "")
        etype, obj, okey, strict = "net.search", "web:search", "search", True
    elif tool.startswith("mcp__"):
        if any(tool.startswith(p) for p in cfg.get("trusted_mcp_prefixes", [])):
            sys.exit(0)
        text = json.dumps(tin, ensure_ascii=False)
        server = tool.split("__")[1] if tool.count("__") >= 2 else tool
        etype, obj, okey = "mcp.call", tool, server
    elif tool in ("Bash", "PowerShell"):
        command = tin.get("command", "")
        if not OUTBOUND_CMD.search(command):
            sys.exit(0)
        text = command
        kind = OUTBOUND_CMD.search(command).group(0).strip().split()[0].lower()
        etype, obj, okey = "cmd.outbound", f"{tool.lower()}:{kind}", kind
        if GIT_PUSH.search(command):
            etype, obj, okey = "git.push", f"git:{cwd.replace(os.sep, '/')}", "git.push"
            payload, problem = git_push_payload(command, cwd, int(cfg.get("max_git_diff_mb", 20)) * 1048576)
            text = f"{command}\n{payload}"
    else:
        sys.exit(0)

    pii, secrets = scan(text, allow)
    event = {"session": data.get("session_id"), "type": etype, "object": obj, "occurrence_key": okey}

    if secrets:
        decision, severity = "deny", "high"
        reason = f"[DLPP] Wykryto sekret w danych wychodzących ({summary(secrets)}). Wysyłka zablokowana. Usuń sekret; rotację wykonuje właściciel."
    elif pii and strict:
        decision, severity = "deny", "high"
        reason = f"[DLPP] Dane osobowe w adresie lub zapytaniu ({summary(pii)}). Dane osobowe nie mogą trafiać do URL ani wyszukiwarki – zanonimizuj i spróbuj ponownie."
    elif pii:
        decision, severity = "ask", "medium"
        reason = f"[DLPP] Dane wychodzące ({obj}) zawierają możliwe dane osobowe: {summary(pii)}. Wysłać mimo to? Zatwierdź tylko, jeśli odbiorca jest uprawniony."
    elif problem:
        decision, severity = "ask", "medium"
        reason = f"[DLPP] Nie udało się sprawdzić danych wychodzących: {problem}. Zatwierdź ręcznie, jeśli wiesz, co jest wysyłane."
    else:
        decision, severity, reason = None, "info", "skan bez trafień"

    event.update({
        "result": decision or "intent",
        "severity": severity,
        "reason": summary({**pii, **secrets}) or (problem or reason),
    })
    log_error = log_event(event)

    if decision:
        if log_error:
            reason += f" (Uwaga: wpis do rejestru nieudany: {log_error})"
        emit(decision, reason)
    if log_error:
        emit("deny", f"[EVENTLOG] Rejestr zdarzeń niedostępny ({log_error}). Wysyłka wstrzymana (fail-closed).")
    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:  # noqa: BLE001
        print(f"[DLPP] Błąd hooka kontroli wyjścia (fail-closed, wysyłka zablokowana): {e}", file=sys.stderr)
        sys.exit(2)
