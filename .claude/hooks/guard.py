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
  PII_ANONYMIZER_PATH   Path to directory or file containing pii_anonymizer.py
                        If not set, anonymization is skipped (prompt still classified).
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
ALWAYS_BLOCK = {"crime", "hate", "self-harm"}


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

    scores = {label: round(prob.item(), 3) for label, prob in zip(LABELS, probs)}

    flagged = [
        label for label, score in scores.items()
        if score >= threshold
    ]
    return scores, flagged


def build_block_message(flagged: list, scores: dict) -> str:
    flagged_pl = [f"{LABEL_PL.get(f, f)} ({scores[f]:.0%})" for f in flagged]
    return (
        f"[Bielik-Guard] Prompt zablokowany.\n"
        f"Wykryte kategorie: {', '.join(flagged_pl)}.\n"
        f"Zmien tresc promptu i sprobuj ponownie."
    )


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


def anonymize_prompt(text: str) -> str:
    """Anonymizes PII in prompt text. Returns original text on any error (fail-open)."""
    try:
        anon_dir = _find_anonymizer_dir()
        if anon_dir is None:
            print(
                "[PII-Filter] pii_anonymizer.py not found. "
                "Set PII_ANONYMIZER_PATH to enable anonymization.",
                file=sys.stderr,
            )
            return text

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
        return text


def run_hook_mode(threshold: float, model_path: str):
    """Claude Code hook mode — reads JSON from stdin, writes JSON decision to stdout."""
    try:
        data = json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(0)

    text = data.get("prompt", "").strip()
    if not text:
        sys.exit(0)

    try:
        tokenizer, model, torch = load_model(model_path)
        scores, flagged = classify(text, tokenizer, model, torch, threshold)
    except Exception as e:
        print(f"[Bielik-Guard] Model error: {e}", file=sys.stderr)
        sys.exit(0)

    if flagged:
        result = {
            "decision": "block",
            "reason": build_block_message(flagged, scores),
        }
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(0)

    cleaned = anonymize_prompt(text)
    if cleaned != text:
        result = {"decision": "modify", "prompt": cleaned}
        print(json.dumps(result, ensure_ascii=False))

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

    print(f"\nText: {text[:120]}{'...' if len(text) > 120 else ''}")
    print(f"Threshold: {threshold:.0%}\n")
    print(f"{'Label':<15} {'Score':>7}  {'Status'}")
    print("-" * 36)
    for label in LABELS:
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
