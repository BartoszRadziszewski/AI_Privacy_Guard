# AI Risk & Governance Canvas: przykład wypełniony

**Projekt plan B na warsztat 12.11.2026.** Oparty na przypadku zgłoszonym w poniedziałek (produkcja filmowa: AI ma wspierać opis, precyzowanie i procedury, nie generować obrazu). Wszystkie nazwy, liczby i osoby są przykładowe. Celem jest pokazanie, jak wygląda Canvas wypełniony konkretnie, a nie ogólnikami.

## 0. Projekt

| Pole | Wpis zespołu |
|----|----|
| Nazwa projektu | Asystent produkcyjny „Klaps” |
| Cel biznesowy w jednym zdaniu | Skrócić przygotowanie dokumentacji produkcyjnej (breakdown scenariusza, plan dnia zdjęciowego, listy rekwizytów, raporty z planu) z 3 dni do 1 dnia na odcinek. |
| Co robi AI w tym projekcie | Czyta scenariusz i notatki z planu, generuje breakdown scen, propozycje harmonogramu, listy kontrolne ciągłości (kostium, rekwizyt, światło), odpowiada na pytania ekipy o procedury. Nie generuje obrazu ani dźwięku do filmu. |
| Narzędzie lub model, dostawca | Model LLM przez API dostawcy z USA (wersja biznesowa z umową), interfejs własny; transkrypcja nagrań z planu lokalnie (Whisper on-premise). |
| Użytkownicy i osoby, których dotyczą wyniki | Użytkownicy: kierownik produkcji, II reżyser, skryptka, asystenci (ok. 12 osób). Dotknięci: aktorzy, statyści, ekipa (dane osobowe, stawki), autorzy scenariusza (prawa autorskie). |
| Etap | Pilotaż na jednym serialu (8 odcinków), decyzja o produkcji w styczniu 2027. |

## 1. GOVERN: kto odpowiada i jakie są zasady

| Pytanie | Wpis zespołu |
|----|----|
| Właściciel projektu i osoba zatwierdzająca ryzyko | Właściciel: kierownik produkcji. Ryzyko zatwierdza producent wykonawczy. |
| Czy istnieje polityka AI, która obejmuje ten projekt? | Nie. Jest regulamin ochrony danych na planie (RODO) i umowy z aktorami z klauzulą wizerunku. Politykę AI trzeba napisać przed produkcją; minimum: lista narzędzi, klasyfikacja danych, zakaz wklejania scenariusza do narzędzi konsumenckich. |
| Rola firmy w AI Act | Podmiot stosujący (deployer). Nie firmujemy modelu własną marką i nie zmieniamy przeznaczenia; interfejs własny nie czyni nas dostawcą, ale do potwierdzenia z prawnikiem (art. 25). |
| Wstępna hipoteza poziomu ryzyka wg AI Act | Minimalne ryzyko. Nie podejmuje decyzji o ludziach (nie ocenia aktorów, nie decyduje o zatrudnieniu). Uwaga: jeśli kiedyś będzie „rekomendował obsadę”, wchodzi w rekrutację = wysokie ryzyko. |
| Kto w zarządzie dostaje raport i jak często? | Producent wykonawczy: raport miesięczny z rejestru użyć i incydentów. |
| Rola w AI Act i pułapka art. 25 | Deployer. Czerwona linia: nie dostrajamy modelu na własnych danych i nie sprzedajemy narzędzia innym produkcjom bez ponownej oceny. |
| Udokumentowane szkolenie z AI (art. 4) | Brak. Plan: 2-godzinne szkolenie dla 12 użytkowników przed pilotażem, lista obecności w dokumentacji. |
| Czy projekt mieści się w polityce AI i liście narzędzi? | Nie ma listy. Pierwszym wpisem będzie to narzędzie; narzędzia konsumenckie (prywatne konta) zakazane dla materiałów produkcji. |

## 2. MAP: gdzie jest ryzyko

| Pytanie o dane | Wpis zespołu |
|----|----|
| Jakie dane wchodzą do modelu? | Scenariusz (utwór chroniony), notatki z planu, transkrypty odpraw, harmonogramy, listy rekwizytów i lokacji. |
| Dane osobowe lub szczególnych kategorii? | Tak: nazwiska aktorów i ekipy, telefony, czasem dane zdrowotne (alergie, ograniczenia kaskaderskie) w notatkach z planu. Dane zdrowotne nie mogą trafić do modelu. |
| Tajemnica przedsiębiorstwa lub dane klientów? | Tak: scenariusz przed premierą (spoilery = strata komercyjna), budżet, stawki aktorów, lokacje przed ogłoszeniem. |
| Gdzie dane są przetwarzane i na jakiej umowie? | Transkrypcja lokalnie. LLM: serwery dostawcy w EOG (do potwierdzenia na przykładzie, nie z deklaracji), umowa powierzenia, opt-out z treningu włączony i zweryfikowany w panelu. |
| Kategoria kolorów (slajd 34 keynote’u) | Scenariusz i stawki: czerwone (tylko po separacji nazw i kwot). Notatki z planu: żółte (narzędzie firmowe z umową, po anonimizacji osób). Procedury i listy kontrolne: zielone. |
| Dostawca poza EOG | Dane nie wychodzą z EOG wg umowy; dowód: raport z konfiguracji regionu + potwierdzenie prawnika, podpis producenta, przegląd co 6 miesięcy. |

Ocena ryzyka: prawdopodobieństwo i skutek 1–3, wynik to iloczyn. 6–9 wymaga kontroli przed startem.

| Obszar | Gdzie w projekcie | P (1–3) | S (1–3) | Wynik |
|----|----|----|----|----|
| Halucynacje | Breakdown pomija scenę lub rekwizyt; harmonogram z błędną dostępnością aktora; wymyślona procedura BHP | 3 | 3 | 9 |
| Bias | Propozycje harmonogramu systematycznie skracają sceny z określonymi aktorami lub lokacjami; niskie, bo człowiek układa plan | 1 | 2 | 2 |
| Prywatność i RODO | Dane zdrowotne i kontaktowe ekipy w notatkach z planu trafiają do modelu | 3 | 3 | 9 |
| Własność intelektualna | Scenariusz (cudzy utwór) jako wejście; wygenerowane opisy scen jako „własne” IP bez wkładu człowieka | 2 | 3 | 6 |
| Bezpieczeństwo | Prompt injection przez notatkę od osoby trzeciej (np. plik od agencji statystów); małe, bo brak agenta z uprawnieniami | 2 | 2 | 4 |
| Łańcuch dostawców | Zmiana warunków API w trakcie produkcji; brak drugiego dostawcy | 2 | 2 | 4 |
| Przejrzystość wobec klienta | Ekipa nie wie, które listy kontrolne wygenerował model; brak oznaczenia w dokumentach | 3 | 1 | 3 |

## 3. MEASURE: jak sprawdzamy, że działa

| Pytanie | Wpis zespołu |
|----|----|
| Miara jakości wyniku | Odsetek scen z poprawnym breakdownem względem ręcznego (cel ≥ 95%); liczba poprawek skryptki na odcinek. |
| Kto i jak często weryfikuje próbkę? | Skryptka: 100% breakdownów w pilotażu, potem losowe 20% tygodniowo; II reżyser: każdy harmonogram przed publikacją. |
| Test różnic między grupami (bias) | Raz na odcinek: porównanie czasu scen w propozycji vs. w planie ręcznym wg aktorów i lokacji; odchylenie \> 15% = analiza. |
| Próg akceptacji | Harmonogram: zero konfliktów dostępności. Breakdown: ≤ 1 pominięty element na odcinek. |
| Miara wartości | Czas przygotowania dokumentacji na odcinek (3 dni → 1 dzień), koszt roboczogodzin, liczba „wpadek ciągłości” na planie. |
| Czy liczby liczy kod, nie model? | Tak: sumy czasu scen i koszty dnia zdjęciowego liczy arkusz; model tylko proponuje układ. |

## 4. MANAGE: co robimy, gdy coś zawiedzie

| Pytanie | Wpis zespołu |
|----|----|
| Trzy główne kontrole dla ryzyk 6–9 | \(1\) Halucynacje: każdy breakdown i harmonogram zatwierdza człowiek przed publikacją; lista kontrolna porównania ze scenariuszem. (2) RODO: separacja przed wysłaniem – nazwiska → tokeny, dane zdrowotne usuwane (warstwa 0), notatki z planu przechodzą przez hook. (3) IP: scenariusz wysyłany w częściach i po tokenizacji nazw; wygenerowane opisy oznaczone jako „szkic AI”, nie jako utwór. |
| Gdzie człowiek zatwierdza decyzję przed skutkiem? | Publikacja planu dnia i rozesłanie call sheet: tylko po akceptacji II reżysera. |
| Uprawnienia narzędzia | Tylko odczyt i generowanie dokumentów do folderu roboczego. Brak dostępu do poczty, kalendarza ekipy i systemu płac. |
| Procedura incydentu | Zgłoszenie do kierownika produkcji w 24 h; wyciek danych osobowych: IOD i ocena zgłoszenia do UODO w 72 h; wyciek scenariusza: producent i dział prawny. |
| Plan wyjścia | Drugi dostawca przetestowany na 2 odcinkach; prompty i formaty trzymane niezależnie od dostawcy. |
| Rejestr użycia | Rejestr hooka (events.jsonl) + log aplikacji: kto, kiedy, jaki dokument, czy zatwierdzono. |
| Zgłaszanie incydentów (art. 73) | Nie dotyczy (minimalne ryzyko), ale rejestr prowadzony, żeby móc odpowiedzieć KRiBSI na pytanie. |
| Operacje agenta | Brak agenta wykonującego operacje; jeśli dojdzie wysyłka call sheet, wymagana akceptacja człowieka. |

### 4a. Checklista dostawcy AI

| Pytanie do dostawcy | TAK / NIE / NIE WIEMY | Gdzie sprawdziliśmy |
|----|----|----|
| Dane wyłączone z treningu, skuteczny opt-out | TAK | Umowa biznesowa § 7, ustawienie w panelu, zrzut ekranu w dokumentacji |
| Retencja jasna, środowiska odseparowane | NIE WIEMY | Dokumentacja mówi „30 dni, chyba że prawo wymaga dłużej”; pytanie do dostawcy wysłane |
| Indemnifikacja za roszczenia osób trzecich | NIE | Standardowa umowa wyłącza; negocjacja albo akceptacja ryzyka przez producenta |
| Użycie komercyjne dozwolone | TAK | Warunki biznesowe |
| Przetwarzanie w EOG wymuszalne | TAK | Region EU w konfiguracji; do potwierdzenia na przykładzie |
| DPA i lista subprocesorów | TAK | DPA podpisane; lista subprocesorów otwarta, bez powiadomień o zmianach (ryzyko) |
| DPIA zrobiona | NIE | Do zrobienia przed pilotażem; dane zdrowotne w notatkach to przesłanka |
| Opt-out i retencja skonfigurowane w panelu, nie tylko zadeklarowane | TAK | Zrzuty ekranu z datą |
| Plan wyjścia | CZĘŚCIOWO | Drugi dostawca wytypowany, nie przetestowany |

## 5. Decyzja zespołu

| Pytanie | Wpis zespołu |
|----|----|
| Decyzja | Go z warunkami |
| Warunki przed startem | DPIA; usunięcie danych zdrowotnych z przepływu (warstwa 0); hook separacji na stanowiskach użytkowników; szkolenie 12 osób; odpowiedź dostawcy o retencji; decyzja producenta o braku indemnifikacji. |
| Najbliższe trzy kroki | \(1\) Kierownik produkcji: lista danych w notatkach z planu i co z niej wypada, do 20.11. (2) IOD: DPIA, do 5.12. (3) II reżyser: test breakdownu na 2 odcinkach z pomiarem poprawek, do 15.12. |
| Jedno zdanie dla zarządu | Narzędzie oszczędza ok. 2 dni pracy na odcinek, ale bez separacji danych i DPIA wysyłamy dostawcy scenariusz i dane zdrowotne ekipy; prosimy o 3 tygodnie i budżet na szkolenie przed pilotażem. |

## Jak użyć tego przykładu na warsztacie

- Jeśli zespoły mają własne projekty: pokaż tylko sekcję 2 (ocena ryzyka) jako wzór konkretności i przejdź do pracy.

- Jeśli projektów brak: wypełniaj ten Canvas wspólnie na ekranie, ale zacznij od pustych pól w sekcjach 2 i 4 i pozwól sali je zaproponować; dopiero potem odkryj wersję wypełnioną.

- Pytania, które zwykle otwierają dyskusję: czy dane zdrowotne w notatkach z planu to problem (tak, i zwykle nikt o nich nie myśli); czy scenariusz można wysłać do modelu (w częściach, po tokenizacji, pod umową z opt-out); czy „rekomendacja obsady” zmienia poziom ryzyka (tak, na wysokie).
