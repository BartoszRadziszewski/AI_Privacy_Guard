#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PII Anonymizer — wspolny modul anonimizacji danych osobowych (v2).

Uzycie (API bez zmian wzgledem v1):
    from pii_anonymizer import Anonymizer, get_global

    anon = get_global()           # singleton per proces
    clean = anon.anonymize(text)  # tekst z tokenami
    orig  = anon.deanonymize_text(clean)  # przywrocenie (tylko lokalnie)
    anon.stats()                  # {kategoria: liczba unikalnych wartosci}

Tokeny:
    [EMAIL_N]   adresy e-mail
    [OSOBA_N]   osoby: z naglowkow e-mail ("Imie Nazwisko <adres>") oraz
                heurystyka "Imie Nazwisko" (slownik imion PL + odmiana)
    [TEL_N]     numery telefonow PL
    [PESEL_N]   PESEL (suma kontrolna)
    [NIP_N]     NIP (suma kontrolna, takze z myslnikami)
    [REGON_N]   REGON 9 i 14 cyfr (suma kontrolna)
    [NRB_N]     NRB / IBAN PL (kontrola mod 97)
    [KARTA_N]   numery kart platniczych 13-19 cyfr (Luhn)
    [DOWOD_N]   dowod osobisty AAA999999 (cyfra kontrolna)
    [PASZPORT_N] paszport AA9999999 (cyfra kontrolna)

Kolejnosc wykrywania ma znaczenie: najpierw dlugie i walidowane numery,
na koncu telefony (9 cyfr bez separatora) – walidowany REGON nie staje sie telefonem.

Ograniczenia heurystyki osob: wykrywa tylko pare "Imie Nazwisko" (imie ze slownika,
nazwisko wielka litera); nie wykrywa samego nazwiska, imion spoza slownika ani
kolejnosci "Nazwisko Imie". Odmiana imion przyblizona (koncowki), np. Marek->Marka
i Pawel->Pawla obslugiwane osobno.
"""

import re
from threading import Lock

# ── Walidatory ────────────────────────────────────────────────────────────────


def _digits(s: str) -> str:
    return re.sub(r"\D", "", s)


def pesel_valid(s: str) -> bool:
    d = _digits(s)
    if len(d) != 11:
        return False
    w = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3]
    if (10 - sum(int(d[i]) * w[i] for i in range(10)) % 10) % 10 != int(d[10]):
        return False
    month = int(d[2:4]) % 20
    day = int(d[4:6])
    return 1 <= month <= 12 and 1 <= day <= 31


def nip_valid(s: str) -> bool:
    d = _digits(s)
    if len(d) != 10:
        return False
    w = [6, 5, 7, 2, 3, 4, 5, 6, 7]
    c = sum(int(d[i]) * w[i] for i in range(9)) % 11
    return c != 10 and c == int(d[9])


def regon_valid(s: str) -> bool:
    d = _digits(s)
    if len(d) == 9:
        w = [8, 9, 2, 3, 4, 5, 6, 7]
    elif len(d) == 14:
        w = [2, 4, 8, 5, 0, 9, 7, 3, 6, 1, 2, 4, 8]
    else:
        return False
    if len(set(d)) == 1:
        return False
    c = sum(int(d[i]) * w[i] for i in range(len(w))) % 11 % 10
    return c == int(d[-1])


def nrb_valid(s: str) -> bool:
    raw = re.sub(r"[\s\-]", "", s).upper()
    if raw.startswith("PL"):
        raw = raw[2:]
    if not re.fullmatch(r"\d{26}", raw):
        return False
    rearranged = raw[2:] + "2521" + raw[:2]  # P=25, L=21
    return int(rearranged) % 97 == 1


def luhn_valid(s: str) -> bool:
    d = _digits(s)
    if not 13 <= len(d) <= 19 or len(set(d)) == 1:
        return False
    total, alt = 0, False
    for ch in reversed(d):
        n = int(ch)
        if alt:
            n *= 2
            if n > 9:
                n -= 9
        total += n
        alt = not alt
    return total % 10 == 0


def _char_val(ch: str) -> int:
    return int(ch) if ch.isdigit() else ord(ch.upper()) - 55  # A=10 ... Z=35


def id_card_valid(s: str) -> bool:
    v = re.sub(r"\s", "", s).upper()
    if not re.fullmatch(r"[A-Z]{3}\d{6}", v):
        return False
    w = [7, 3, 1, 9, 7, 3, 1, 7, 3]  # cyfra kontrolna na pozycji 4 (waga 9)
    return sum(_char_val(c) * w[i] for i, c in enumerate(v)) % 10 == 0


def passport_valid(s: str) -> bool:
    v = re.sub(r"\s", "", s).upper()
    if not re.fullmatch(r"[A-Z]{2}\d{7}", v):
        return False
    w = [7, 3, 9, 1, 7, 3, 1, 7, 3]  # cyfra kontrolna na pozycji 3 (waga 9)
    return sum(_char_val(c) * w[i] for i, c in enumerate(v)) % 10 == 0


# ── Slownik imion PL (najczestsze, PESEL/GUS) ─────────────────────────────────

_FIRST_NAMES = """
Adam Adrian Aleksander Andrzej Antoni Arkadiusz Artur Bartłomiej Bartosz Bogdan Bogusław
Cezary Czesław Damian Daniel Dariusz Dawid Dominik Edward Emil Eugeniusz Filip Franciszek
Gabriel Grzegorz Henryk Hubert Ignacy Igor Jacek Jakub Jan Janusz Jarosław Jerzy Józef
Julian Kacper Kamil Karol Kazimierz Konrad Krystian Krzysztof Leszek Łukasz Maciej Maksymilian
Marcin Marek Marian Mariusz Mateusz Michał Mieczysław Mikołaj Miłosz Norbert Oliwer Oskar
Patryk Paweł Piotr Przemysław Radosław Rafał Robert Roman Ryszard Sebastian Szymon Sławomir
Stanisław Stefan Sylwester Szczepan Tadeusz Tomasz Tymon Waldemar Wiesław Wiktor Witold
Władysław Wojciech Zbigniew Zdzisław Zenon Zygmunt
Agata Agnieszka Aleksandra Alicja Amelia Aneta Angelika Anna Antonina Barbara Beata Bożena
Danuta Dominika Dorota Edyta Elżbieta Emilia Ewa Ewelina Gabriela Grażyna Halina Hanna
Helena Irena Iwona Izabela Jadwiga Janina Joanna Jolanta Julia Justyna Kamila Karolina
Katarzyna Kinga Klaudia Krystyna Lena Lucyna Magdalena Maja Małgorzata Maria Marianna
Marta Martyna Marzena Monika Natalia Nikola Oliwia Patrycja Paulina Renata Sabina Sandra
Stanisława Sylwia Teresa Urszula Wanda Weronika Wiesława Wiktoria Zofia Zuzanna
""".split()

# Nieregularne formy (wymiana tematu): mianownik -> temat odmiany
_IRREGULAR_STEMS = {"Marek": "Mark", "Paweł": "Pawł", "Jacek": "Jack", "Leszek": "Leszk"}
_SUFFIXES = {"", "a", "y", "i", "ie", "ę", "ą", "em", "owi", "u", "o", "e"}
# Celownik/miejscownik imion zenskich: -ka -> -ce (Agnieszce), -ta -> -cie (Marcie)
_SOFT_SUFFIXES = {"ka": "ce", "ta": "cie"}

# Wyrazy zaczynajace sie wielka litera, ktore nie sa nazwiskami (redukcja falszywych trafien)
_NOT_SURNAMES = {
    "Polska", "Polski", "Polsce", "Warszawa", "Warszawie", "Kraków", "Krakowie", "Gdańsk",
    "Poznań", "Wrocław", "Łódź", "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
    "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień", "Pan", "Pani",
    "Państwo", "Dyrektor", "Prezes", "Spółka", "Sp", "SA", "S.A", "PDF", "Excel", "Word",
}


def _build_name_index():
    stems = {}
    for name in _FIRST_NAMES:
        stem = _IRREGULAR_STEMS.get(name)
        if stem is None:
            stem = name[:-1] if name.endswith("a") else name
        stems.setdefault(stem.lower(), name)
    return stems


_NAME_STEMS = _build_name_index()
_NAME_SET = {n.lower() for n in _FIRST_NAMES}
_SOFT_FORMS = {
    n[:-2].lower() + _SOFT_SUFFIXES[n[-2:]]
    for n in _FIRST_NAMES if n[-2:] in _SOFT_SUFFIXES
}


def is_first_name(token: str) -> bool:
    t = token.lower()
    if t in _NAME_SET or t in _SOFT_FORMS:
        return True
    for i in range(len(t), max(len(t) - 4, 1) - 1, -1):
        stem, suffix = t[:i], t[i:]
        if stem in _NAME_STEMS and suffix in _SUFFIXES:
            return True
    return False


class Anonymizer:
    """
    Zamienia PII na tokeny (w pamieci, per instancja).
    Ta sama wartosc zawsze dostaje ten sam token.
    """

    _UP = "A-ZĄĆĘŁŃÓŚŹŻ"
    _LOW = "a-ząćęłńóśźż"

    # Osoba z adresem: Imie Nazwisko <adres>
    _RE_NAMED_EMAIL = re.compile(r'([^\n<>]{2,60}?)\s*<([\w.+\-]+@[\w\-]+\.[\w.]+)>')
    # Goly adres e-mail
    _RE_BARE_EMAIL = re.compile(r'[\w.+\-]+@[\w\-]+\.[\w.]+')
    # NRB / IBAN PL: 26 cyfr, opcjonalnie PL, grupy po 4 ze spacjami
    _RE_NRB = re.compile(r'(?<![\w])(?:PL\s?)?\d{2}(?:[ \-]?\d{4}){6}(?!\d)', re.IGNORECASE)
    # Karta: 13-19 cyfr, opcjonalnie spacje/myslniki
    _RE_CARD = re.compile(r'(?<![0-9A-Za-z])\d(?:[ \-]?\d){12,18}(?![0-9A-Za-z])')
    _RE_PESEL = re.compile(r'(?<![0-9A-Za-z])\d{11}(?![0-9A-Za-z])')
    # NIP: 10 cyfr lub 3-3-2-2 / 3-2-2-3 z myslnikami
    _RE_NIP = re.compile(r'(?<![0-9A-Za-z])(?:\d{3}-\d{3}-\d{2}-\d{2}|\d{3}-\d{2}-\d{2}-\d{3}|\d{10})(?![0-9A-Za-z])')
    _RE_REGON14 = re.compile(r'(?<![0-9A-Za-z])\d{14}(?![0-9A-Za-z])')
    _RE_REGON9 = re.compile(r'(?<![0-9A-Za-z])\d{9}(?![0-9A-Za-z])')
    _RE_ID_CARD = re.compile(r'\b[A-Z]{3}\s?\d{6}\b')
    _RE_PASSPORT = re.compile(r'\b[A-Z]{2}\s?\d{7}\b')
    # Telefony PL: +48..., 3x3 z separatorem, 9 cyfr
    _RE_PHONE = re.compile(
        r'(?:\+48[\s\-]?)?\d{3}[\s\-]\d{3}[\s\-]\d{3}'
        r'|\+48\d{9}'
        r'|\b\d{9}\b'
    )
    # Para "Imie Nazwisko" (nazwisko moze byc dwuczlonowe z myslnikiem)
    _RE_NAME_PAIR = re.compile(
        rf'\b([{_UP}][{_LOW}]{{1,14}})(?=(\s+)([{_UP}][{_LOW}]{{1,24}}(?:-[{_UP}][{_LOW}]{{1,24}})?)\b)'
    )

    def __init__(self):
        self._map: dict[str, str] = {}   # token  -> wartosc
        self._rev: dict[str, str] = {}   # wartosc -> token
        self._cnt: dict[str, int] = {}
        self._lock = Lock()

    # ── wewnetrzne ────────────────────────────────────────────────────────────

    def _token(self, category: str, value: str) -> str:
        with self._lock:
            key = f'{category}:{value}'
            if key in self._rev:
                return self._rev[key]
            n = self._cnt.get(category, 0) + 1
            self._cnt[category] = n
            tok = f'[{category}_{n}]'
            self._map[tok] = value
            self._rev[key] = tok
            return tok

    def _sub_valid(self, text, regex, category, validator):
        def repl(m):
            value = m.group(0)
            return self._token(category, value.strip()) if validator(value) else value
        return regex.sub(repl, text)

    def _sub_names(self, text):
        # Dopasowania nakladajace sie ("Przekaz Agnieszce Zielinskiej"): nazwisko w lookahead,
        # wiec kazde slowo z wielkiej litery jest sprawdzane jako potencjalne imie.
        out, pos = [], 0
        for m in self._RE_NAME_PAIR.finditer(text):
            if m.start() < pos:
                continue
            first, gap, last = m.group(1), m.group(2), m.group(3)
            if not is_first_name(first) or last in _NOT_SURNAMES or is_first_name(last):
                continue
            end = m.end() + len(gap) + len(last)
            out.append(text[pos:m.start()])
            out.append(self._token('OSOBA', f'{first} {last}'))
            pos = end
        out.append(text[pos:])
        return ''.join(out)

    # ── publiczne ─────────────────────────────────────────────────────────────

    def anonymize(self, text: str) -> str:
        """Zwraca tekst z tokenami zamiast PII."""
        if not text:
            return text

        # 1. Osoba z adresem e-mail
        def sub_named(m):
            name = m.group(1).strip()
            email = m.group(2).strip()
            et = self._token('EMAIL', email)
            nt = self._token('OSOBA', name) if name else ''
            return f'{nt} <{et}>' if nt else f'<{et}>'
        text = self._RE_NAMED_EMAIL.sub(sub_named, text)

        # 2. Gole adresy e-mail
        text = self._RE_BARE_EMAIL.sub(lambda m: self._token('EMAIL', m.group(0)), text)

        # 3. Numery walidowane – od najdluzszych
        text = self._sub_valid(text, self._RE_NRB, 'NRB', nrb_valid)
        text = self._sub_valid(text, self._RE_REGON14, 'REGON', regon_valid)  # przed karta (14 cyfr)
        text = self._sub_valid(text, self._RE_CARD, 'KARTA', luhn_valid)
        text = self._sub_valid(text, self._RE_PESEL, 'PESEL', pesel_valid)
        text = self._sub_valid(text, self._RE_NIP, 'NIP', nip_valid)
        text = self._sub_valid(text, self._RE_REGON9, 'REGON', regon_valid)
        text = self._sub_valid(text, self._RE_ID_CARD, 'DOWOD', id_card_valid)
        text = self._sub_valid(text, self._RE_PASSPORT, 'PASZPORT', passport_valid)

        # 4. Numery telefonow
        text = self._RE_PHONE.sub(lambda m: self._token('TEL', m.group(0).strip()), text)

        # 5. Osoby "Imie Nazwisko"
        text = self._sub_names(text)

        return text

    def deanonymize_text(self, text: str) -> str:
        """Przywraca oryginalne wartosci w tekscie z tokenami."""
        with self._lock:
            items = list(self._map.items())
        for tok, val in items:
            text = text.replace(tok, val)
        return text

    def deanonymize_value(self, token: str) -> str:
        """Przywraca jedna wartosc po tokenie."""
        return self._map.get(token, f'NIEZNANY_TOKEN:{token}')

    def get_map(self) -> dict:
        with self._lock:
            return dict(self._map)

    def reset(self):
        with self._lock:
            self._map.clear()
            self._rev.clear()
            self._cnt.clear()

    def stats(self) -> dict:
        with self._lock:
            return {k: v for k, v in self._cnt.items()}


# ── Singleton per proces ──────────────────────────────────────────────────────

_global_anon: Anonymizer | None = None
_global_lock = Lock()


def get_global() -> Anonymizer:
    """Zwraca globalna instancje Anonymizer (singleton)."""
    global _global_anon
    with _global_lock:
        if _global_anon is None:
            _global_anon = Anonymizer()
        return _global_anon
