#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
separacja.py — separacja danych przed wysłaniem do modelu (demo warsztatowe).

Trzy warstwy, w tej kolejności:
  1. PII            -> pii_anonymizer.py z AI_Privacy_Guard (tokeny [OSOBA_N], [NIP_N], [NRB_N], [PESEL_N]...)
                       lub --engine presidio: ten sam regex + NER Presidio/spaCy (odmiana imion, organizacje, miejsca)
  2. Tajemnice      -> frazy_poufne.json: nazwy kodowe projektów, firm, kancelarii -> [PROJEKT_1], [FIRMA_1]...
  3. Liczby wrażliwe-> opcjonalnie: kwoty zaokrąglane do przedziałów (--kwoty=przedzialy), marże/procenty -> [PROC]

Klucz sesji (mapa token -> wartość) zapisywany jest TYLKO lokalnie (klucz_sesji.csv) i służy
do przywrócenia danych w odpowiedzi modelu. Nigdy nie wysyłaj klucza razem z danymi.

Użycie:
  python separacja.py --in przed --out po --hooks <repo>/.claude/hooks [--kwoty=przedzialy]
"""
import argparse, csv, json, os, re, sys

ap = argparse.ArgumentParser()
ap.add_argument("--in", dest="src", default="przed")
ap.add_argument("--out", dest="dst", default="po")
ap.add_argument("--hooks", default=os.path.join(os.path.dirname(__file__), "..", ".claude", "hooks"))
ap.add_argument("--frazy", default=os.path.join(os.path.dirname(__file__), "frazy_poufne.json"))
ap.add_argument("--kwoty", choices=["zachowaj", "przedzialy"], default="zachowaj")
ap.add_argument("--engine", choices=["regex", "presidio"], default="regex",
                help="regex = pii_anonymizer.py z hooków; presidio = demo/presidio (NER + regex)")
a = ap.parse_args()

import importlib.util  # noqa: E402
if a.engine == "presidio":
    os.environ.setdefault("PII_REGEX_ANONYMIZER", os.path.join(os.path.abspath(a.hooks), "pii_anonymizer.py"))
    _p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "presidio", "pii_anonymizer.py")
else:
    _p = os.path.join(os.path.abspath(a.hooks), "pii_anonymizer.py")
_spec = importlib.util.spec_from_file_location("pii_anonymizer_impl", _p)
_mod = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(_mod)
Anonymizer = _mod.Anonymizer

anon = Anonymizer()
frazy = json.load(open(a.frazy, encoding="utf-8")) if os.path.exists(a.frazy) else {}
custom_map = {}


def mask_custom(text: str) -> str:
    """Warstwa 2: własne frazy (tajemnica przedsiębiorstwa). Najdłuższe najpierw."""
    for cat, entries in frazy.items():
        for i, entry in enumerate(entries, 1):
            aliases = entry if isinstance(entry, list) else [entry]
            tok = f"[{cat}_{i}]"
            for v in sorted(aliases, key=len, reverse=True):   # najdłuższy alias najpierw
                if re.search(re.escape(v), text, flags=re.IGNORECASE):
                    custom_map[tok] = aliases[0]
                    text = re.sub(re.escape(v), tok, text, flags=re.IGNORECASE)
    return text


_RE_PROC = re.compile(r"\b\d{1,2}(?:[.,]\d)?\s?%")
_RE_KWOTA = re.compile(r"\b(\d{1,3}(?:[ \u00a0]\d{3})+|\d{4,}|\d{1,3})(?:[.,]\d+)?\s?(mln zł|tys\. zł|zł|PLN)\b")


def bucket(amount: float) -> str:
    for lo, hi in [(0, 1e4), (1e4, 5e4), (5e4, 1e5), (1e5, 5e5), (5e5, 1e6), (1e6, 1e7), (1e7, 1e8)]:
        if lo <= amount < hi:
            return f"[KWOTA {int(lo):,}–{int(hi):,} zł]".replace(",", " ")
    return "[KWOTA >100 mln zł]"


def mask_numbers(text: str) -> str:
    """Warstwa 3 (opcjonalna): marże -> [PROC], kwoty -> przedziały."""
    text = _RE_PROC.sub("[PROC]", text)

    def repl(m):
        raw = m.group(1).replace(" ", "").replace(" ", "")
        mult = {"mln zł": 1e6, "tys. zł": 1e3}.get(m.group(2), 1)
        try:
            return bucket(float(raw) * mult)
        except ValueError:
            return m.group(0)
    return _RE_KWOTA.sub(repl, text)


def process_text(text: str) -> str:
    text = anon.anonymize(text)          # 1. PII
    text = mask_custom(text)             # 2. tajemnice
    if a.kwoty == "przedzialy":
        text = mask_numbers(text)        # 3. liczby
    return text


os.makedirs(a.dst, exist_ok=True)
report = []
for name in sorted(os.listdir(a.src)):
    p = os.path.join(a.src, name)
    if name.endswith(".csv"):
        with open(p, encoding="utf-8", newline="") as fh:
            rows = list(csv.DictReader(fh, delimiter=";"))
        drop = {"REGON"}  # kolumny zbędne do analizy: usuwamy zamiast maskować (minimalizacja)
        out_rows = []
        for r in rows:
            o = {}
            for k, v in r.items():
                if k in drop:
                    continue
                if k == "kwota_brutto_PLN" and a.kwoty == "przedzialy":
                    o[k] = bucket(float(v))
                else:
                    o[k] = process_text(v)
            out_rows.append(o)
        with open(os.path.join(a.dst, name), "w", encoding="utf-8", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=list(out_rows[0].keys()), delimiter=";")
            w.writeheader(); w.writerows(out_rows)
        report.append((name, f"{len(rows)} wierszy, usunięto kolumny: {', '.join(drop)}"))
    else:
        txt = open(p, encoding="utf-8").read()
        open(os.path.join(a.dst, name), "w", encoding="utf-8").write(process_text(txt))
        report.append((name, "tekst"))

# klucz sesji: lokalnie, poza katalogiem wysyłanym do modelu
key_path = os.path.join(a.dst, "..", "klucz_sesji.csv")
with open(key_path, "w", encoding="utf-8", newline="") as fh:
    w = csv.writer(fh, delimiter=";")
    w.writerow(["token", "wartosc_oryginalna"])
    for tok, val in {**anon.get_map(), **custom_map}.items():
        w.writerow([tok, val])

print("Separacja zakończona.")
for n, info in report:
    print(f"  {n}: {info}")
print("Statystyka PII:", anon.stats())
print("Frazy poufne:", len(custom_map))
print(f"Klucz sesji: {os.path.abspath(key_path)}  (NIE wysyłaj do modelu)")
