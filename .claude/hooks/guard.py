# -*- coding: utf-8 -*-
"""
Bielik-Guard - UserPromptSubmit hook for Claude Code

Classifies user prompts using the Bielik-Guard safety model and anonymizes PII
before the prompt reaches the Claude API.

Modes:
  Hook mode (default): reads JSON from stdin, writes JSON decision to stdout
  CLI mode:            python guard.py --text "text to check"

Model: speakleash/Bielik-Guard-0.1B-v1.1
Labels: crime, hate, self-harm, sex, vulgar

Environment variables:
  PII_ANONYMIZER_PATH     Path to directory or file containing pii_anonymizer.py
  BIELIK_GUARD_PII_MODE   "block" (default) | "warn"
                          block: prompt z PII jest blokowany, a uzytkownik dostaje
                                 zanonimizowana wersje do ponownego wyslania
                          warn:  prompt przechodzi bez zmian, uzytkownik widzi ostrzezenie
  BIELIK_GUARD_BYPASS  "1" = awaryjny fail-open (stare zachowanie); domyslnie fail-closed

Uwaga: UserPromptSubmit NIE moze podmienic tresci promptu (dokumentacja hookow
Claude Code: "can't replace the prompt; it only injects additionalContext").
Dawny wynik {"decision": "modify"} byl ignorowany - prompt z PII trafial do Claude.
"""

import sys
import json
import argparse
import io
import os

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")


LABELS = ["crime", "hate", "self-harm", "sex", "vulgar"]
LABEL_PL = {
    "crime": "przestepstwo",
    "hate": "mowa nienawisci",
    "self-harm": "samookaleczenie",
    "sex": "tresci seksualne",
    "vulgar": "wulgaryzmy",
}

DEFAULT_THRESHOLD = 0.5
FAIL_OPEN = os.environ.get("BIELIK_GUARD_BYPASS", "").strip() == "1"
PII_MODE = os.environ.get("BIELIK_GUARD_PII_MODE", "block").strip().lower()


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


# Decyzja uzytkownika per prompt: prompt zaczynajacy sie od znacznika jest przepuszczany
# mimo wykrytych PII (decyzja trafia do rejestru, bez wartosci PII).
OVERRIDE_MARKER = "[PII-OK]"
GOVERNANCE_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "config", "governance.json",
)


def append_event(event: dict) -> bool:
    """Dopisuje zdarzenie do rejestru przez log-event.js. Zwraca True przy sukcesie."""
    try:
        import subprocess
        js = os.path.join(os.path.dirname(os.path.abspath(__file__)), "log-event.js")
        proc = subprocess.run(["node", js, "append"], input=json.dumps(event, ensure_ascii=False).encode("utf-8"),
                              capture_output=True, timeout=10)
        if proc.returncode != 0:
            raise RuntimeError(proc.stderr.decode("utf-8", "replace").strip())
        return True
    except Exception as e:  # noqa: BLE001
        print(f"[Bielik-Guard] Nie zapisano zdarzenia w rejestrze: {e}", file=sys.stderr)
        return False


def load_allow_patterns() -> list:
    """Wzorce wartosci dozwolonych (np. wlasne adresy): config/governance.json -> outbound.allow_value_patterns
    plus plik lokalny spoza repo wskazany w zmiennej BIELIK_GUARD_LOCAL_ALLOWLIST (wzorce sa laczone)."""
    import re
    try:
        with open(GOVERNANCE_FILE, encoding="utf-8") as f:
            cfg = json.load(f).get("outbound", {})
    except FileNotFoundError:
        return []
    patterns = list(cfg.get("allow_value_patterns", []))
    local_path = os.environ.get("BIELIK_GUARD_LOCAL_ALLOWLIST", "").strip()
    if local_path:
        try:
            with open(local_path, encoding="utf-8") as f:
                patterns += json.load(f).get("allow_value_patterns", [])
        except FileNotFoundError:
            print(f"[PII-Filter] Brak pliku lokalnego allowlisty: {local_path}", file=sys.stderr)
    return [re.compile(p, re.IGNORECASE) for p in patterns]


def mask_allowed(text: str, patterns: list) -> str:
    """Zastepuje dozwolone wartosci neutralnym tekstem, zeby anonimizator ich nie liczyl jako PII."""
    for p in patterns:
        text = p.sub("ALLOWED_VALUE", text)
    return text


ALWAYS_BLOCK = {"crime", "hate", "self-harm"}


def get_labels(model) -> list:
    """
    Zwraca etykiety w kolejności zgodnej z indeksami wyjść modelu
    (model.config.id2label). Fallback na stałą LABELS, gdy id2label
    jest puste lub niekompletne (liczba etykiet się nie zgadza).
    """
    id2label = getattr(model.config, "id2label", None) or {}
    if len(id2label) == len(LABELS):
        try:
            return [id2label[i] for i in range(len(id2label))]
        except KeyError:
            try:
                return [id2label[str(i)] for i in range(len(id2label))]
            except KeyError:
                return LABELS
    return LABELS


def load_model(model_path: str):
    from transformers import AutoTokenizer, AutoModelForSequenceClassification
    import torch

    tokenizer = AutoTokenizer.from_pretrained(model_path)
    model = AutoModelForSequenceClassification.from_pretrained(model_path)
    model.eval()
    return tokenizer, model, torch


def classify(text: str, tokenizer, model, torch, threshold: float):
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
    with torch.no_grad():
        outputs = model(**inputs)
        probs = torch.sigmoid(outputs.logits)[0]

    labels = get_labels(model)
    scores = {label: round(prob.item(), 3) for label, prob in zip(labels, probs)}

    flagged = [
        label for label, score in scores.items()
        if score >= threshold
    ]
    return scores, flagged


def build_block_message(flagged: list, scores: dict) -> str:
    flagged_pl = [f"{LABEL_PL.get(f, f)} ({scores[f]:.0%})" for f in flagged]
    if all(f in GUARD_OVERRIDABLE for f in flagged):
        hint = (f"Zmien tresc promptu albo - jesli to falszywy alarm - wyslij go ponownie z {GUARD_MARKER} "
                f"na poczatku (decyzja trafi do rejestru).")
    else:
        hint = "Zmien tresc promptu i sprobuj ponownie (tej kategorii nie mozna pominac)."
    return (
        f"[Bielik-Guard] Prompt zablokowany.\n"
        f"Wykryte kategorie: {', '.join(flagged_pl)}.\n"
        f"{hint}"
    )


# Decyzja uzytkownika per prompt dla falszywych alarmow moderacji. Mowa nienawisci
# i samookaleczenie sa blokowane zawsze, bez mozliwosci pominiecia.
GUARD_MARKER = "[GUARD-OK]"
GUARD_OVERRIDABLE = {"crime", "sex", "vulgar"}


def split_markers(text: str):
    """Zdejmuje znaczniki decyzji z poczatku promptu (dowolna kolejnosc). Zwraca (zbior_znacznikow, reszta)."""
    markers = set()
    rest = text.lstrip()
    changed = True
    while changed:
        changed = False
        for m in (GUARD_MARKER, OVERRIDE_MARKER):
            if rest.startswith(m):
                markers.add(m)
                rest = rest[len(m):].lstrip()
                changed = True
    return markers, rest


def _find_anonymizer_dir():
    """
    Finds the pii_anonymizer module directory.
    Checks PII_ANONYMIZER_PATH env var first, then the script's own directory.
    Returns the directory path or None if not found.
    """
    env_val = os.environ.get("PII_ANONYMIZER_PATH", "").strip()
    candidates = []

    if env_val:
        # Accept both a directory and a direct path to the .py file
        if env_val.endswith(".py"):
            candidates.append(os.path.dirname(env_val))
        else:
            candidates.append(env_val)

    # Fallback: same directory as this script
    candidates.append(os.path.dirname(os.path.abspath(__file__)))

    for d in candidates:
        if os.path.isfile(os.path.join(d, "pii_anonymizer.py")):
            return d

    return None


def anonymize_prompt(text: str):
    """Anonymizes PII in prompt text. Returns cleaned text, or None on error (fail-closed)."""
    try:
        anon_dir = _find_anonymizer_dir()
        if anon_dir is None:
            print(
                "[PII-Filter] pii_anonymizer.py not found. "
                "Set PII_ANONYMIZER_PATH to enable anonymization.",
                file=sys.stderr,
            )
            return None

        if anon_dir not in sys.path:
            sys.path.insert(0, anon_dir)

        from pii_anonymizer import get_global
        anon = get_global()
        cleaned = anon.anonymize(text)
        if cleaned != text:
            print(f"[PII-Filter] Anonymized prompt (tokens: {anon.stats()})", file=sys.stderr)
        return cleaned
    except Exception as e:
        print(f"[PII-Filter] Anonymization error: {e}", file=sys.stderr)
        return None


def emit_block(reason: str):
    print(json.dumps({"decision": "block", "reason": reason}, ensure_ascii=False))
    sys.exit(0)


def run_hook_mode(threshold: float, model_path: str):
    """Claude Code hook mode — reads JSON from stdin, writes JSON decision to stdout."""
    try:
        data = json.loads(sys.stdin.buffer.read().decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        if FAIL_OPEN:
            log_bypass("guard.py:input", e)
            sys.exit(0)
        emit_block(f"[Bielik-Guard] Nie udalo sie odczytac promptu ({e}). Blokada (fail-closed).")

    text = data.get("prompt", "").strip()
    if not text:
        sys.exit(0)
    markers, text = split_markers(text)
    if not text:
        sys.exit(0)

    try:
        tokenizer, model, torch = load_model(model_path)
        scores, flagged = classify(text, tokenizer, model, torch, threshold)
    except Exception as e:
        print(f"[Bielik-Guard] Model error: {e}", file=sys.stderr)
        if FAIL_OPEN:
            log_bypass("guard.py:model", e)
            sys.exit(0)
        emit_block(
            f"[Bielik-Guard] Model moderacji niedostepny ({e}). Prompt zablokowany (fail-closed).\n"
            f"Awaryjnie: ustaw BIELIK_GUARD_BYPASS=1 i uruchom Claude Code ponownie."
        )

    if flagged:
        if GUARD_MARKER in markers and all(f in GUARD_OVERRIDABLE for f in flagged):
            if not append_event({
                "type": "guard.moderation_override", "object": "UserPromptSubmit", "result": "success",
                "severity": "medium", "consent": f"uzytkownik: znacznik {GUARD_MARKER} w prompcie",
                "reason": "Falszywy alarm moderacji pominiety decyzja uzytkownika: "
                          + ", ".join(f"{f} {scores[f]:.0%}" for f in flagged),
            }):
                emit_block(f"[Bielik-Guard] Nie udalo sie zapisac decyzji {GUARD_MARKER} w rejestrze - prompt zablokowany (fail-closed).")
        else:
            append_event({
                "type": "guard.moderation_blocked", "object": "UserPromptSubmit", "result": "deny", "severity": "low",
                "reason": "Moderacja: " + ", ".join(f"{f} {scores[f]:.0%}" for f in flagged),
            })
            emit_block(build_block_message(flagged, scores))

    override = OVERRIDE_MARKER in markers

    try:
        allow = load_allow_patterns()
    except Exception as e:  # noqa: BLE001
        if FAIL_OPEN:
            log_bypass("guard.py:allowlist", e)
            sys.exit(0)
        emit_block(f"[PII-Filter] Nie mozna wczytac config/governance.json ({e}) - prompt zablokowany (fail-closed).")

    masked = mask_allowed(text, allow)
    cleaned_masked = anonymize_prompt(masked)
    if cleaned_masked is None:
        if FAIL_OPEN:
            log_bypass("guard.py:anonymizer", "anonimizator niedostepny")
            sys.exit(0)
        emit_block("[PII-Filter] Anonimizator niedostepny - prompt zablokowany (fail-closed).")

    if cleaned_masked != masked:
        if override:
            if not append_event({
                "type": "pii.prompt_override", "object": "UserPromptSubmit", "result": "success",
                "severity": "medium", "consent": "uzytkownik: znacznik [PII-OK] w prompcie",
                "reason": "Prompt z PII wyslany jawnie decyzja uzytkownika",
            }):
                emit_block("[PII-Filter] Nie udalo sie zapisac decyzji [PII-OK] w rejestrze - prompt zablokowany (fail-closed).")
            print(json.dumps({"systemMessage": "[PII-Filter] Prompt z danymi osobowymi wyslany jawnie (Twoja decyzja [PII-OK], zapisana w rejestrze)."}, ensure_ascii=False))
            sys.exit(0)
        if PII_MODE == "warn":
            print(json.dumps({"systemMessage": "[PII-Filter] Prompt zawiera dane osobowe i zostal wyslany BEZ anonimizacji (tryb warn)."}, ensure_ascii=False))
            sys.exit(0)
        append_event({
            "type": "pii.prompt_blocked", "object": "UserPromptSubmit", "result": "deny",
            "severity": "low", "reason": "Prompt z PII zablokowany, zaproponowano wersje zanonimizowana",
        })
        cleaned = anonymize_prompt(text) or cleaned_masked
        emit_block(
            "[PII-Filter] Prompt zawiera dane osobowe i nie zostal wyslany do Claude.\n"
            "Masz dwie mozliwosci:\n"
            "  1) wyslij ponownie wersje zanonimizowana (ponizej), albo\n"
            f"  2) wyslij oryginal z {OVERRIDE_MARKER} na poczatku - przejdzie jawnie, decyzja trafi do rejestru.\n\n"
            f"{cleaned}"
        )

    sys.exit(0)


def run_cli_mode(text: str, threshold: float, model_path: str):
    """CLI mode — prints results to stdout."""
    try:
        tokenizer, model, torch = load_model(model_path)
    except ImportError as e:
        print(f"Import error: {e}", file=sys.stderr)
        print("Run: pip install -r requirements.txt", file=sys.stderr)
        sys.exit(1)

    scores, flagged = classify(text, tokenizer, model, torch, threshold)

    labels = get_labels(model)

    print(f"\nText: {text[:120]}{'...' if len(text) > 120 else ''}")
    print(f"Threshold: {threshold:.0%}\n")
    print(f"{'Label':<15} {'Score':>7}  {'Status'}")
    print("-" * 36)
    for label in labels:
        score = scores[label]
        status = "FLAGGED" if label in flagged else "OK"
        print(f"{label:<15} {score:>6.1%}  {status}")

    print()
    if flagged:
        print(f"RESULT: BLOCKED — {', '.join(flagged)}")
        sys.exit(2)
    else:
        print("RESULT: SAFE")
        sys.exit(0)


def main():
    parser = argparse.ArgumentParser(
        description="Bielik-Guard — Polish text safety classifier"
    )
    parser.add_argument("--text", "-t", type=str, help="Text to classify")
    parser.add_argument(
        "--threshold", type=float, default=DEFAULT_THRESHOLD,
        help=f"Flagging threshold (default {DEFAULT_THRESHOLD})",
    )
    parser.add_argument(
        "--model", type=str, default="speakleash/Bielik-Guard-0.1B-v1.1",
        help="HuggingFace model path or name",
    )
    parser.add_argument("--hook", action="store_true", help="Claude Code hook mode")
    args = parser.parse_args()

    hook_mode = args.hook or (not sys.stdin.isatty() and not args.text)

    if hook_mode:
        run_hook_mode(args.threshold, args.model)
    else:
        text = args.text or ""
        if not text:
            print("Provide text: --text '...' or via stdin", file=sys.stderr)
            sys.exit(1)
        run_cli_mode(text, args.threshold, args.model)


if __name__ == "__main__":
    main()
