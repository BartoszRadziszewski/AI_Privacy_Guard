#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
pii_anonymizer.py (wariant Presidio) — zamiennik modułu z .claude/hooks/pii_anonymizer.py.

Ten sam interfejs (Anonymizer, get_global, anonymize, deanonymize_text, get_map, stats),
więc guard.py, pre_tool_hook.py i outbound_pii_hook.py korzystają z niego bez zmian w kodzie:

    PII_ANONYMIZER_PATH=<repo>/demo/presidio

Potok:
  1. regex + sumy kontrolne  (oryginalny pii_anonymizer.py z repo: NIP, PESEL, NRB, TEL, EMAIL, Imię Nazwisko)
  2. Presidio + spaCy pl_core_news_lg (NER): osoby w odmianie i same imiona -> [OSOBA_N],
     organizacje -> [FIRMA_N], miejscowości -> [MIEJSCE_N]
  3. filtr szumu (deny-list, wzorce numerów dokumentów, już zamaskowane tokeny)

Fallback: jeśli Presidio/spaCy nie są zainstalowane, działa sam krok 1 (ostrzeżenie na stderr),
czyli dokładnie tak jak dotychczasowy hook. Fail-closed zostaje po stronie hooków.

Instalacja (venv repo):
    pip install presidio-analyzer spacy
    python -m spacy download pl_core_news_lg
"""
from __future__ import annotations

import importlib.util
import os
import re
import sys
from threading import Lock

# ── 1. załaduj oryginalny anonimizator regexowy z repo pod inną nazwą ─────────
_HERE = os.path.dirname(os.path.abspath(__file__))
_CANDIDATES = [
    os.environ.get("PII_REGEX_ANONYMIZER", ""),
    os.path.join(_HERE, "..", "..", ".claude", "hooks", "pii_anonymizer.py"),
    os.path.join(_HERE, "..", "..", ".codex", "hooks", "pii_anonymizer.py"),
]


def _load_regex_module():
    for p in _CANDIDATES:
        if p and os.path.isfile(p):
            spec = importlib.util.spec_from_file_location("regex_pii_anonymizer", p)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            return mod
    raise ImportError("Nie znaleziono oryginalnego pii_anonymizer.py (ustaw PII_REGEX_ANONYMIZER).")


_regex_mod = _load_regex_module()

# ── 2. Presidio (opcjonalnie) ─────────────────────────────────────────────────
_PRESIDIO_OK = False
_analyzer = None
_LANG = "pl"
_SCORE = float(os.environ.get("PRESIDIO_SCORE_THRESHOLD", "0.4"))
_ENTITY_TOKEN = {"PERSON": "OSOBA", "ORGANIZATION": "FIRMA", "LOCATION": "MIEJSCE"}
_ENABLED = set(os.environ.get("PRESIDIO_ENTITIES", "PERSON,ORGANIZATION,LOCATION").split(","))

try:
    from presidio_analyzer import AnalyzerEngine
    from presidio_analyzer.nlp_engine import NlpEngineProvider

    _conf = {
        "nlp_engine_name": "spacy",
        "models": [{"lang_code": _LANG, "model_name": os.environ.get("PRESIDIO_SPACY_MODEL", "pl_core_news_lg")}],
        "ner_model_configuration": {
            "model_to_presidio_entity_mapping": {
                "persName": "PERSON", "PER": "PERSON",
                "orgName": "ORGANIZATION", "ORG": "ORGANIZATION",
                "placeName": "LOCATION", "geogName": "LOCATION", "LOC": "LOCATION", "GPE": "LOCATION",
            },
            "low_score_entity_names": [],
            "labels_to_ignore": ["date", "time", "DATE", "TIME", "CARDINAL", "ORDINAL", "MONEY", "PERCENT"],
        },
    }
    _nlp = NlpEngineProvider(nlp_configuration=_conf).create_engine()
    _analyzer = AnalyzerEngine(nlp_engine=_nlp, supported_languages=[_LANG])
    _PRESIDIO_OK = True
except Exception as _e:  # noqa: BLE001
    print(f"[PII-Filter] Presidio niedostepne ({_e.__class__.__name__}: {_e}); dziala sam regex.", file=sys.stderr)

# ── 3. filtr szumu ────────────────────────────────────────────────────────────
_DENY = {
    "finansowy", "dyrektor", "prezes", "zarząd", "zarządu", "spółka", "sp.", "s.a.", "z o.o.", "ul.", "al.",
    "pan", "pani", "państwo", "cfo", "coo", "cto", "nip", "regon", "pesel", "iban", "temat", "od", "do", "dw",
}
_RE_DOCNUM = re.compile(r"^[A-Z]{1,4}/\d{2,4}/\d+$|^\d[\d\s\-/.]*$")
_RE_TOKEN = re.compile(r"\[?[A-Z_]+_\d+\]?")
_RE_SUFFIX = re.compile(r"^\s*(?:S\.\s?A\.|A\.|Sp\.\s*z\s*o\.\s?o\.|z\s*o\.\s?o\.|sp\.\s*k\.|S\.K\.A\.)", re.IGNORECASE)


def _is_noise(text: str) -> bool:
    t = text.strip(" „”\"'()[]")
    if not t or len(t) < 3:
        return True
    if t.lower() in _DENY:
        return True
    if _RE_DOCNUM.match(t):
        return True
    if "@" in t or _RE_TOKEN.fullmatch(t) or _RE_TOKEN.search(t):
        return True
    return False


class Anonymizer:
    """Ten sam kontrakt co oryginał: ta sama wartość zawsze dostaje ten sam token."""

    def __init__(self):
        self._regex = _regex_mod.Anonymizer()
        self._map: dict[str, str] = {}
        self._rev: dict[str, str] = {}
        self._cnt: dict[str, int] = {}
        self._lock = Lock()

    def _token(self, category: str, value: str) -> str:
        with self._lock:
            norm = re.sub(r"\s*(?:S\.\s?A\.|Sp\.\s*z\s*o\.\s?o\.|z\s*o\.\s?o\.|sp\.\s*k\.)\s*$", "", value, flags=re.IGNORECASE)
            key = f"{category}:{norm.lower()}"
            if key in self._rev:
                return self._rev[key]
            # kontynuuj numerację po regexie, żeby [OSOBA_N] się nie dublowały
            base = self._regex.stats().get(category, 0)
            n = self._cnt.get(category, base) + 1
            self._cnt[category] = n
            tok = f"[{category}_{n}]"
            self._map[tok] = value
            self._rev[key] = tok
            return tok

    def _presidio_pass(self, text: str) -> str:
        if not _PRESIDIO_OK or not text.strip():
            return text
        results = _analyzer.analyze(text=text, language=_LANG, entities=[e for e in _ENTITY_TOKEN if e in _ENABLED],
                                    score_threshold=_SCORE)
        # od końca, żeby indeksy nie przesuwały się po podmianie
        for r in sorted(results, key=lambda x: x.start, reverse=True):
            start, end = r.start, r.end
            # nie dotykaj wnętrza istniejących tokenów [XXX_N]
            if start > 0 and text[start - 1] == "[" and end < len(text) and text[end] == "]":
                continue
            m = _RE_SUFFIX.match(text[end:])            # dociągnij „S.A.”, „Sp. z o.o.”
            if m:
                end += m.end()
            frag = text[start:end]
            if _is_noise(frag):
                continue
            tok = self._token(_ENTITY_TOKEN[r.entity_type], frag.strip(" „”\"'"))
            text = text[:start] + tok + text[end:]
        return text

    def _propagate(self, text: str) -> str:
        """Raz rozpoznana wartość jest maskowana wszędzie (NER bywa niespójny między zdaniami)."""
        for tok, val in sorted(self._map.items(), key=lambda kv: len(kv[1]), reverse=True):
            if len(val) >= 4:
                text = re.sub(re.escape(val), tok, text)
        return text

    # ── API ──
    def anonymize(self, text: str) -> str:
        if not text:
            return text
        text = self._regex.anonymize(text)      # 1. walidowane numery, e-maile, pary Imię Nazwisko
        text = self._presidio_pass(text)        # 2. NER: odmiana, same imiona, organizacje, miejsca
        text = self._propagate(text)            # 3. spójność: ta sama nazwa -> ten sam token wszędzie
        return text

    def deanonymize_text(self, text: str) -> str:
        text = self._regex.deanonymize_text(text)
        for tok, val in list(self._map.items()):
            text = text.replace(tok, val)
        return text

    def deanonymize_value(self, token: str) -> str:
        return self._map.get(token) or self._regex.deanonymize_value(token)

    def get_map(self) -> dict:
        m = self._regex.get_map()
        m.update(self._map)
        return m

    def reset(self):
        self._regex.reset()
        with self._lock:
            self._map.clear(); self._rev.clear(); self._cnt.clear()

    def stats(self) -> dict:
        s = dict(self._regex.stats())
        for k, v in self._cnt.items():
            s[k] = max(s.get(k, 0), v)
        s["_engine"] = "regex+presidio" if _PRESIDIO_OK else "regex"
        return s


_global: Anonymizer | None = None
_glock = Lock()


def get_global() -> Anonymizer:
    global _global
    with _glock:
        if _global is None:
            _global = Anonymizer()
        return _global


if __name__ == "__main__":
    import json
    src = sys.stdin.read()
    a = Anonymizer()
    print(a.anonymize(src))
    print("\n--- stats:", json.dumps(a.stats(), ensure_ascii=False), file=sys.stderr)
