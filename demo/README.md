# Demo: separacja danych przed wysłaniem do modelu

Materiał do warsztatu „AI Risk & Governance Canvas” (AI Summer Academy 2026, 12.11.2026).
Pokazuje, jak hooki **AI Privacy Guard** zatrzymują dane osobowe w Claude Code i jak
**separować** dane finansowe i teksty poufne, zanim trafią do jakiegokolwiek modelu.

> Wszystkie dane są **syntetyczne**. Osoby, firmy, numery NIP/PESEL/IBAN zostały wygenerowane
> z poprawnymi sumami kontrolnymi, ale nie należą do nikogo. Domeny e-mail używają `.example`.

## Co jest w folderze

```
demo/
├── przed/                        # dane „jak z firmy” – NIE wysyłaj do modelu
│   ├── rozrachunki_kontrahenci.csv   18 faktur: NIP, REGON, IBAN, osoby, e-maile, telefony, uwagi z marżą i PESEL
│   ├── mail_wezwanie_do_zaplaty.md   mail windykacyjny z danymi osobowymi i rachunkiem
│   ├── notatka_zarzad_poufne.md      notatka zarządu: projekt M&A „Sokół”, marże, zwolnienia
│   ├── umowa_doradcza_fragment.md    fragment umowy: PESEL, adres, wynagrodzenie, premia
│   └── prompt_do_modelu.md           prompt, jaki użytkownik chciałby wkleić do czatu
├── po/                           # to samo po separacji (warstwa 1 + 2) – można wysłać
├── po_przedzialy/                # jak wyżej + kwoty w przedziałach, marże ukryte (warstwa 3)
├── klucz_sesji.csv               # powstaje po uruchomieniu; token -> wartość; lokalnie, w .gitignore, NIGDY do modelu
├── frazy_poufne.json             # tajemnice przedsiębiorstwa: nazwy kodowe, firmy, kancelarie
├── separacja.py                  # skrypt separacji (używa pii_anonymizer.py z repo)
└── METODA.md                     # opis metody: co usuwamy, co pseudonimizujemy, co agregujemy
```

## Uruchomienie (2 minuty)

```bash
git clone https://github.com/BartoszRadziszewski/AI_Privacy_Guard.git
cd AI_Privacy_Guard/demo
python separacja.py --in przed --out po                      # warstwa 1 (PII) + 2 (tajemnice)
python separacja.py --in przed --out po_przedzialy --kwoty=przedzialy   # + warstwa 3 (liczby)
```

Skrypt korzysta wyłącznie z biblioteki standardowej i z `../.claude/hooks/pii_anonymizer.py`.
Nie wymaga modelu Bielik-Guard ani `transformers`.

## Wariant z Presidio (NER): mocniejsza warstwa 1

Regex z sumami kontrolnymi nie widzi imienia w odmianie, samego imienia ani adresu. Tę lukę
zamyka [Presidio](https://presidio.dataprivacystack.org/) (projekt przeniesiony z Microsoftu do
organizacji data-privacy-stack) z polskim modelem spaCy. W folderze `presidio/` jest zamiennik
`pii_anonymizer.py` o tym samym interfejsie: najpierw Twój regex, potem NER, potem propagacja
(raz rozpoznana nazwa jest maskowana wszędzie).

```bash
pip install presidio-analyzer spacy
python -m spacy download pl_core_news_lg          # ~500 MB, ładowanie ~2–3 s na wywołanie
python separacja.py --in przed --out po_presidio --engine presidio
```

**Jako hook, obok Bielik-Guarda** (bez zmian w kodzie hooków): w `~/.claude/settings.json`
dodaj zmienną środowiskową, a `guard.py`, `pre_tool_hook.py` i `outbound_pii_hook.py` zaczną
używać wariantu Presidio:

```json
{
  "env": {
    "PII_ANONYMIZER_PATH": "<repo>/demo/presidio",
    "PII_REGEX_ANONYMIZER": "<repo>/.claude/hooks/pii_anonymizer.py",
    "PRESIDIO_ENTITIES": "PERSON,ORGANIZATION,LOCATION",
    "PRESIDIO_SCORE_THRESHOLD": "0.4"
  }
}
```

Jeśli Presidio nie jest zainstalowane, moduł działa jak dotychczasowy regex i wypisuje ostrzeżenie;
zasada fail-closed zostaje po stronie hooków. Co daje w demo: „Szanowny Panie Janie” → `[OSOBA_12]`,
„Bartosza Przykładowego” → `[OSOBA_N]`, „Delta Energia S.A.” i „Delta Energia” → jeden `[FIRMA_N]`,
„Gdańsk” → `[MIEJSCE_1]`. Czego nadal nie daje: NER bywa niespójny (Lex-Demo raz wykryte, raz nie),
więc lista `frazy_poufne.json` zostaje jako warstwa deterministyczna.

## Scenariusz pokazu na żywo (Claude Code z zainstalowanymi hookami)

1. **Prompt z danymi.** Wklej treść `przed/prompt_do_modelu.md` do Claude Code.
   Hook `guard.py` blokuje prompt i pokazuje wersję z tokenami `[OSOBA_11]`, `[EMAIL_2]`, `[TEL_1]`.
   Decyzja należy do użytkownika: wysłać wersję zanonimizowaną albo oryginał z `[PII-OK]` (trafia do rejestru).
2. **Odczyt pliku.** Poproś Claude: „przeczytaj `demo/przed/rozrachunki_kontrahenci.csv`”.
   Hook `pre_tool_hook.py` odmawia odczytu i pokazuje zawartość z tokenami.
3. **Plik po separacji.** Poproś o odczyt `demo/po/rozrachunki_kontrahenci.csv`. Przechodzi bez uwag.
4. **Czego hook nie widzi.** Otwórz `po/notatka_zarzad_poufne.md` obok `przed/`: hook zatrzymał PII,
   ale nazwę projektu „Sokół”, marżę 31% i kwotę oferty 38 mln zł zatrzymał dopiero `separacja.py`
   (warstwy 2 i 3). To jest sedno: **PII to nie jedyna tajemnica w firmie**.
5. **Powrót.** Odpowiedź modelu z tokenami podstaw ręcznie lub skryptem według `klucz_sesji.csv`.
6. **Rejestr.** `node .claude/hooks/log-event.js tail` pokazuje wpisy: co zablokowano, co przeszło z `[PII-OK]`.

## Gdzie wziąć własne dane do ćwiczeń: Hugging Face Datasets

Zestaw w `przed/` jest mały z premedytacją. Do własnych testów hooka i separacji użyj
publicznych zbiorów z https://huggingface.co/datasets (filtr: *Languages → Polish*, tag *pii*).
Zasady doboru: **tylko dane syntetyczne**, z licencją na użycie, którego potrzebujesz; nigdy zbiory
scrapowane z realnymi osobami. Kandydaci (stan na 10.11.2026, licencję sprawdź na karcie zbioru):

| Zbiór / model | Co zawiera | Uwagi |
|---|---|---|
| `ai4privacy/pii-masking-300k` i nowsze (seria do 3M, 30 języków, w tym polski) | tekst z PII i wersja zamaskowana, etykiety spanów | syntetyczne; licencja własna (`license.md`), część zbiorów tylko niekomercyjnie |
| `emgiezet/piitier` (model) + jego syntetyczny korpus | polskie dokumenty ubezpieczeniowe, bankowe, medyczne; 39 typów encji | korpus CC BY 4.0; kandydat na silnik NER w Presidio zamiast spaCy |
| `gretelai/synthetic_pii_finance_multilingual` | ~100 formatów dokumentów finansowych, 29 typów PII, wiele języków | syntetyczne; do testów skanerów PII |
| FATURA (zbiór obrazów faktur) | 10 000 syntetycznych faktur, 50 układów, adnotacje pól | do testów OCR i ekstrakcji; treść losowa |
| `v2run/invoices-donut-data-v1` (Sparrow) | 500 faktur z adnotacjami | **uwaga:** pochodzą z próbek e-faktur (Mendeley), sprawdź, czy dane są fikcyjne |

Jak użyć w demo: pobierz próbkę (`datasets.load_dataset(..., split="train[:200]")`), zapisz teksty do
`przed/`, uruchom `separacja.py` i porównaj `privacy_mask` ze zbioru z tokenami z hooka. Różnica
pokazuje, czego regex i NER nie łapią w polskim tekście.

## Ograniczenia, które warto pokazać, a nie ukrywać

- Imię bez nazwiska („Szanowny Panie Janie”) zostaje; heurystyka wykrywa pary Imię Nazwisko.
- Adres pocztowy („ul. Przykładowa 12/4, 80-001 Gdańsk”) nie jest wykrywany.
- Liczby 9-cyfrowe bywają brane za telefon (numery zamówień).
- Hook nie zna kontekstu biznesowego: nazwa projektu i marża to dla niego zwykły tekst; stąd `frazy_poufne.json`.
- Hooki chronią Claude Code, nie czat na claude.ai.
- Presidio: model ładuje się przy każdym wywołaniu hooka (~2–3 s), podobnie jak Bielik-Guard.
