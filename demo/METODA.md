# Metoda separacji danych: trzy warstwy

Zasada: **do modelu idzie minimum, które wystarcza do zadania**. Reszta zostaje w firmie,
a to, co musi iść, idzie pod tokenem, który da się odwrócić tylko lokalnie.

## Warstwa 0: minimalizacja (zanim cokolwiek zamaskujemy)

Pytanie: czy ta kolumna lub akapit jest potrzebny do zadania? Jeśli nie, usuń.
W demo kolumna `REGON` jest usuwana, bo analiza windykacji jej nie potrzebuje.
Usunięcie jest lepsze od maskowania: nie ma czego odwrócić ani wyciec.

## Warstwa 1: dane osobowe (PII) → tokeny z walidacją

Realizuje `pii_anonymizer.py` z AI Privacy Guard. Wykrywa i zamienia na stały token
(ta sama wartość zawsze dostaje ten sam numer, więc model zachowuje relacje między wierszami):

| Kategoria | Token | Jak wykrywa |
|---|---|---|
| e-mail | `[EMAIL_N]` | wzorzec adresu; para „Imię Nazwisko <adres>” daje też `[OSOBA_N]` |
| osoba | `[OSOBA_N]` | słownik imion PL z odmianą + nazwisko wielką literą |
| telefon | `[TEL_N]` | +48, 3×3 cyfry, 9 cyfr |
| PESEL | `[PESEL_N]` | 11 cyfr + suma kontrolna + poprawna data |
| NIP | `[NIP_N]` | 10 cyfr lub z myślnikami + suma kontrolna |
| REGON | `[REGON_N]` | 9 lub 14 cyfr + suma kontrolna |
| rachunek | `[NRB_N]` | 26 cyfr, opcjonalnie PL, kontrola mod 97 |
| karta | `[KARTA_N]` | 13–19 cyfr, Luhn |
| dowód, paszport | `[DOWOD_N]`, `[PASZPORT_N]` | format + cyfra kontrolna |

Walidacja sum kontrolnych ogranicza fałszywe trafienia: numer faktury czy zamówienia
nie stanie się „NIP-em”, chyba że przypadkiem przejdzie test.

## Warstwa 2: tajemnica przedsiębiorstwa → tokeny z listy

Hook nie wie, że „Sokół” to przejęcie, a „Delta Energia” to cel transakcji. Tę wiedzę ma firma,
więc utrzymuje ją w pliku `frazy_poufne.json`:

```json
{
  "PROJEKT":    [["Sokół"]],
  "FIRMA":      [["Delta Energia S.A.", "Delta Energia"], ["Betonex Północ S.A.", "Betonex Północ"]],
  "KANCELARIA": [["Lex-Demo"]]
}
```

Każda pozycja to lista aliasów jednej rzeczy; wszystkie aliasy dostają jeden token.
Najdłuższy alias jest podmieniany pierwszy, żeby „Delta Energia S.A.” nie zostawiło sierocego „S.A.”.
Lista jest własnością biznesu (nie IT): aktualizuje ją ten, kto wie, co jest poufne.

## Warstwa 3: liczby wrażliwe → przedziały (opcjonalnie)

Kiedy liczba sama jest tajemnicą (cena oferty, marża), a model potrzebuje tylko rzędu wielkości:

- kwoty → przedziały logarytmiczne: `[KWOTA 10 000–50 000 zł]`, `[KWOTA 10 mln–100 mln zł]`;
- procenty (marże, rabaty) → `[PROC]`.

Tryb `--kwoty=przedzialy`. Nie używaj go, gdy model ma liczyć: wtedy liczby zostają,
a maskujesz tylko to, co je identyfikuje (kontrahenta, projekt).

## Klucz sesji i powrót

`klucz_sesji.csv` zawiera pary token → wartość. Zostaje na komputerze użytkownika.
Odpowiedź modelu zawiera tokeny; podstawiasz je lokalnie. W hooku `guard.py` mapa żyje tylko
w procesie hooka, więc przy wersji „blokuj i pokaż” podstawienie robisz ręcznie.

## Co to daje z perspektywy zarządu

| Ryzyko z keynote’u | Warstwa, która je adresuje |
|---|---|
| Dane osobowe w promptach (RODO, art. 6/9, Shadow AI) | 1 |
| Tajemnica przedsiębiorstwa u dostawcy, trening na danych | 2 |
| Wyciek warunków transakcji, marż, cen | 3 |
| Brak śladu, kto co wysłał | rejestr zdarzeń hooka (`logs/events.jsonl`) |
| „Czy można wysłać?” zadane po fakcie | hook blokuje przed wysłaniem; decyzja `[PII-OK]` jest zapisana |

## Czego metoda nie robi

- Nie rozumie znaczenia tekstu: zdanie „zwolnienia grupowe w oddziale Gdańsk: 14 osób” przechodzi, bo nie ma w nim PII ani frazy z listy. Jeśli to tajemnica, trafia na listę albo do warstwy 0.
- Nie wykrywa adresów pocztowych ani samych nazwisk.
- Nie zastępuje umowy powierzenia, oceny transferu ani polityki. Zmniejsza ekspozycję, nie legalizuje przetwarzania.
