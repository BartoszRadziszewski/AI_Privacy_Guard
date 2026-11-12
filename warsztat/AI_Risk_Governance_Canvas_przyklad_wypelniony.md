# AI Risk & Governance Canvas: przykład wypełniony

Zespół: przykład prowadzącego (plan B na warsztat 12.11.2026)

Projekt: Asystent produkcyjny „Klaps” (produkcja filmowa)

Data: 12.11.2026

Przykład oparty na przypadku zgłoszonym w poniedziałek 9.11.2026 (produkcja filmowa: AI ma wspierać opis, precyzowanie i procedury, nie generować obrazu). Wszystkie nazwy, liczby i osoby są przykładowe. Celem jest pokazanie, jak wygląda Canvas wypełniony konkretnie, a nie ogólnikami.

Zasada: puste pole jest uczciwsze niż pole zapełnione ogólnikiem. Jeśli czegoś nie wiesz, wpisz „nie wiemy” i dopisz, kto to ustali.

## 0. Projekt

| Lp | Pole | Wpis zespołu |
| --- | --- | --- |
| 0.1 | Nazwa projektu | Asystent produkcyjny „Klaps” |
| 0.2 | Cel biznesowy w jednym zdaniu | Skrócić przygotowanie dokumentacji produkcyjnej (breakdown scenariusza, plan dnia zdjęciowego, listy rekwizytów, raporty z planu) z 3 dni do 1 dnia na odcinek. |
| 0.3 | Co robi AI w tym projekcie | Czyta scenariusz i notatki z planu, generuje breakdown scen, propozycje harmonogramu, listy kontrolne ciągłości (kostium, rekwizyt, światło), odpowiada na pytania ekipy o procedury. Nie generuje obrazu ani dźwięku do filmu. |
| 0.4 | Narzędzie lub model, dostawca | Model LLM przez API dostawcy z USA (wersja biznesowa z umową), interfejs własny; transkrypcja nagrań z planu lokalnie (Whisper on-premise). |
| 0.5 | Użytkownicy i osoby, których dotyczą wyniki | Użytkownicy: kierownik produkcji, II reżyser, skryptka, asystenci (ok. 12 osób). Dotknięci: aktorzy, statyści, ekipa (dane osobowe, stawki), autorzy scenariusza (prawa autorskie). |
| 0.6 | Etap (pomysł, pilotaż, produkcja) | Pilotaż na jednym serialu (8 odcinków), decyzja o produkcji w styczniu 2027. |

## 1. GOVERN: kto odpowiada i jakie są zasady

| Lp | Pytanie | Wpis zespołu |
| --- | --- | --- |
| 1.1 | Właściciel projektu i osoba zatwierdzająca ryzyko | Właściciel: kierownik produkcji. Ryzyko zatwierdza producent wykonawczy. |
| 1.2 | Czy istnieje polityka AI, która obejmuje ten projekt? | Nie. Jest regulamin ochrony danych na planie (RODO) i umowy z aktorami z klauzulą wizerunku. Politykę AI trzeba napisać przed produkcją; minimum: lista narzędzi, klasyfikacja danych, zakaz wklejania scenariusza do narzędzi konsumenckich. |
| 1.3 | Rola firmy w AI Act: dostawca, podmiot stosujący (deployer), importer czy dystrybutor? | Podmiot stosujący (deployer): używamy modelu dostawcy przez API we własnej produkcji. Nie jesteśmy importerem ani dystrybutorem. |
| 1.4 | Wstępna klasyfikacja zastosowania: zakazane / wysokiego ryzyka / podlegające obowiązkom przejrzystości / pozostałe. Wskaż podstawę kwalifikacji (AI Act: art. 5; art. 6 i zał. I, III; art. 50). | Pozostałe (minimalne ryzyko). Podstawa: nie jest praktyką z art. 5 i nie mieści się w zał. I ani III, bo nie ocenia aktorów ani ekipy i nie decyduje o zatrudnieniu. Przejrzystość (art. 50): ekipa ma wiedzieć, że odpowiedzi i listy kontrolne pochodzą z AI (oznaczenie w interfejsie i dokumentach, patrz 2.14). Uwaga: jeśli narzędzie zacznie „rekomendować obsadę”, wchodzi w zatrudnienie (zał. III pkt 4) i staje się systemem wysokiego ryzyka. |
| 1.5 | Kto w zarządzie dostaje raport o tym projekcie i jak często? | Producent wykonawczy: raport miesięczny z rejestru użyć i incydentów. |
| 1.6 | Czy nie stajemy się dostawcą: własna marka na systemie, istotna zmiana, zmiana przeznaczenia (AI Act, art. 25)? | Nie. Nie firmujemy modelu własną marką, nie dostrajamy go na własnych danych i nie zmieniamy przeznaczenia; interfejs własny nie czyni nas dostawcą, ale do potwierdzenia z prawnikiem. Czerwona linia: nie sprzedajemy narzędzia innym produkcjom bez ponownej oceny. |
| 1.7 | Czy osoby obsługujące system mają udokumentowane szkolenie z AI? Kto i kiedy je przeprowadził? | Nie. Plan: 2-godzinne szkolenie dla 12 użytkowników przed pilotażem, lista obecności w dokumentacji. Kto poprowadzi: nie wiemy, ustali kierownik produkcji do 20.11.2026. |
| 1.8 | Czy narzędzie jest na liście zatwierdzonych narzędzi? Jeśli nie, kto uzupełni listę lub politykę AI? | Nie ma listy. Pierwszym wpisem będzie to narzędzie; narzędzia konsumenckie (prywatne konta) zakazane dla materiałów produkcji. Listę i politykę AI przygotuje kierownik produkcji, zatwierdzi producent wykonawczy. |

## 2. MAP: gdzie jest ryzyko

Najpierw opisz kontekst danych, potem oceń obszary.

| Lp | Pytanie o dane | Wpis zespołu |
| --- | --- | --- |
| 2.1 | Jakie dane wchodzą do modelu? | Scenariusz (utwór chroniony), notatki z planu, transkrypty odpraw, harmonogramy, listy rekwizytów i lokacji. |
| 2.2 | Czy są wśród nich dane osobowe lub szczególnych kategorii? | Tak: nazwiska aktorów i ekipy, telefony, czasem dane zdrowotne (alergie, ograniczenia kaskaderskie) w notatkach z planu. Dane zdrowotne nie mogą trafić do modelu. |
| 2.3 | Czy są tajemnica przedsiębiorstwa lub dane klientów? | Tak: scenariusz przed premierą (spoilery = strata komercyjna), budżet, stawki aktorów, lokacje przed ogłoszeniem. |
| 2.4 | Gdzie dane są przetwarzane (EOG czy poza) i na jakiej umowie? | Transkrypcja lokalnie. LLM: serwery dostawcy w EOG (do potwierdzenia na przykładzie, nie z deklaracji), umowa powierzenia, opt-out z treningu włączony i zweryfikowany w panelu. |
| 2.5 | Jeśli system jest wysokiego ryzyka: czy podlegamy obowiązkowi FRIA (ocena skutków dla praw podstawowych; AI Act, art. 27: podmioty publiczne i prywatne świadczące usługi publiczne, ocena zdolności kredytowej, ubezpieczenia na życie i zdrowotne)? Może być połączona z DPIA. | Nie dotyczy: system nie jest wysokiego ryzyka (1.4). DPIA robimy niezależnie od tego (4.15 i 4b). |
| 2.6 | Do której kategorii z klasyfikacji należą dane projektu: zielone, żółte, czerwone? Co z tego wynika dla wyboru narzędzia? | Scenariusz i stawki: czerwone (tylko po separacji nazw i kwot). Notatki z planu: żółte (narzędzie firmowe z umową, po anonimizacji osób). Procedury i listy kontrolne: zielone. |
| 2.7 | Jeśli dane wychodzą poza EOG: jaka jest podstawa transferu (decyzja o adekwatności, standardowe klauzule umowne), czy jest ocena transferu i kto ją podpisał? | Według umowy dane nie wychodzą z EOG; dowód: raport z konfiguracji regionu i potwierdzenie prawnika, podpis producenta, przegląd co 6 miesięcy. Dostawca jest z USA: czy umowa powierzenia obejmuje standardowe klauzule umowne na wypadek dostępu spoza EOG, nie wiemy; ustali prawnik do 5.12.2026. |

Ocena ryzyka: prawdopodobieństwo i skutek w skali 1–3, wynik to ich iloczyn. Wynik 6–9 wymaga kontroli przed startem; skutek 3 także, niezależnie od wyniku.

| Lp | Obszar | Gdzie w projekcie | Prawdopodobieństwo (1–3) | Skutek (1–3) | Wynik |
| --- | --- | --- | --- | --- | --- |
| 2.8 | Halucynacje | Breakdown pomija scenę lub rekwizyt; harmonogram z błędną dostępnością aktora; wymyślona procedura BHP | 3 | 3 | 9 |
| 2.9 | Bias | Propozycje harmonogramu systematycznie skracają sceny z określonymi aktorami lub lokacjami; niskie, bo człowiek układa plan | 1 | 2 | 2 |
| 2.10 | Prywatność i RODO | Dane zdrowotne i kontaktowe ekipy w notatkach z planu trafiają do modelu | 3 | 3 | 9 |
| 2.11 | Własność intelektualna | Scenariusz (cudzy utwór) jako wejście; wygenerowane opisy scen jako „własne” IP bez wkładu człowieka | 2 | 3 | 6 |
| 2.12 | Bezpieczeństwo (prompt injection, nadmierna sprawczość) | Prompt injection przez notatkę od osoby trzeciej (np. plik od agencji statystów); małe, bo brak agenta z uprawnieniami | 2 | 2 | 4 |
| 2.13 | Łańcuch dostawców i zależność od jednego modelu | Zmiana warunków API w trakcie produkcji; drugi dostawca wytypowany, ale nieprzetestowany | 2 | 2 | 4 |
| 2.14 | Przejrzystość wobec klienta (bot, treści generowane, deepfake) | Ekipa nie wie, które listy kontrolne wygenerował model; brak oznaczenia w dokumentach | 3 | 1 | 3 |

## 3. MEASURE: jak sprawdzamy, że działa

| Lp | Pytanie | Wpis zespołu |
| --- | --- | --- |
| 3.1 | Jaka jest miara jakości wyniku (np. odsetek poprawnych odpowiedzi w próbce)? | Odsetek scen z poprawnym breakdownem względem ręcznego (cel ≥ 95%); liczba poprawek skryptki na odcinek. |
| 3.2 | Kto i jak często weryfikuje losową próbkę wyników? | Skryptka: 100% breakdownów w pilotażu, potem losowe 20% tygodniowo; II reżyser: każdy harmonogram przed publikacją. |
| 3.3 | Jak testujemy różnice wyników między grupami (bias)? | Raz na odcinek: porównanie czasu scen w propozycji i w planie ręcznym według aktorów i lokacji; odchylenie > 15% = analiza. |
| 3.4 | Jaki próg akceptacji uznajemy za bezpieczny? | Harmonogram: zero konfliktów dostępności. Breakdown: ≤ 1 pominięty element na odcinek. |
| 3.5 | Jak mierzymy wartość projektu (czas, koszt, jakość)? | Czas przygotowania dokumentacji na odcinek (3 dni → 1 dzień), koszt roboczogodzin, liczba „wpadek ciągłości” na planie. |
| 3.6 | Czy liczby w wyniku liczy kod lub arkusz, a nie model? Jak to sprawdzamy? | Tak: sumy czasu scen i koszty dnia zdjęciowego liczy arkusz; model tylko proponuje układ. Sprawdzenie: skryptka porównuje sumy z arkusza z propozycją modelu przy każdym harmonogramie. |

## 4. MANAGE: co robimy, gdy coś zawiedzie

| Lp | Pytanie | Wpis zespołu |
| --- | --- | --- |
| 4.1 | Trzy główne kontrole dla ryzyk z wynikiem 6–9 | (1) Halucynacje (2.8): każdy breakdown i harmonogram zatwierdza człowiek przed publikacją; lista kontrolna porównania ze scenariuszem. Właściciel: II reżyser. (2) Prywatność i RODO (2.10): separacja przed wysłaniem – nazwiska → tokeny, dane zdrowotne usuwane (warstwa 0), notatki z planu przechodzą przez hook. Właściciel: kierownik produkcji. (3) Własność intelektualna (2.11): scenariusz wysyłany w częściach i po tokenizacji nazw; wygenerowane opisy oznaczone jako „szkic AI”, nie jako utwór. Właściciel: producent wykonawczy. |
| 4.2 | Gdzie człowiek zatwierdza decyzję przed skutkiem? | Publikacja planu dnia i rozesłanie call sheet: tylko po akceptacji II reżysera. |
| 4.3 | Jakie uprawnienia ma agent lub narzędzie i czy są najmniejsze potrzebne? | Tylko odczyt i generowanie dokumentów do folderu roboczego. Brak dostępu do poczty, kalendarza ekipy i systemu płac. |
| 4.4 | Jak wygląda procedura incydentu: kto, w jakim czasie, co zgłasza? | Zgłoszenie do kierownika produkcji w 24 h; wyciek danych osobowych: IOD i ocena zgłoszenia do UODO w 72 h; wyciek scenariusza: producent i dział prawny. |
| 4.5 | Plan wyjścia: co robimy, gdy dostawca zmieni warunki lub zniknie? | Drugi dostawca wytypowany; test na 2 odcinkach zaplanowany w pilotażu. Prompty i formaty trzymane niezależnie od dostawcy. |
| 4.6 | Rejestr użycia i ślad decyzji: gdzie są zapisywane? | Rejestr hooka (events.jsonl) + log aplikacji: kto, kiedy, jaki dokument, czy zatwierdzono. |
| 4.7 | Kto informuje dostawcę o poważnym incydencie (AI Act, art. 26 ust. 5), kto zgłasza naruszenie danych do UODO (RODO, art. 33: 72 godziny) i kto odpowiada, gdy sami jesteśmy dostawcą (AI Act, art. 73)? | Art. 26 ust. 5 i art. 73 nie dotyczą: system nie jest wysokiego ryzyka i nie jesteśmy dostawcą. Mimo to o poważnym błędzie modelu dostawcę informuje kierownik produkcji. Naruszenie danych do UODO zgłasza IOD w 72 h od stwierdzenia. Rejestr prowadzimy, żeby móc odpowiedzieć KRiBSI na pytanie. |
| 4.8 | Jeśli agent wykonuje operacje (płatności, maile, zmiany danych): gdzie dokładnie człowiek zatwierdza i czy zmiana danych kontrahenta idzie osobnym kanałem? | Brak agenta wykonującego operacje. Jeśli dojdzie wysyłka call sheet, wymagana akceptacja II reżysera przed wysyłką. Danych kontrahentów narzędzie nie zmienia. |

### 4a. Checklista dostawcy AI

Odpowiedz TAK / NIE / NIE WIEMY. Wpisz, czy element jest opisany i gdzie jest dokument. Każde NIE w pierwszych pięciu wierszach (4.9–4.13) to kryterium dyskwalifikacji dostawcy.

| Lp | Pytanie | TAK / NIE / NIE WIEMY | Gdzie to sprawdziliśmy (umowa, DPA, panel) |
| --- | --- | --- | --- |
| 4.9 | Czy nasze dane wejściowe i wyjściowe są wyłączone z treningu i ulepszania modelu (domyślnie albo po wyłączeniu, które sami możemy ustawić)? | TAK | Umowa biznesowa § 7, ustawienie w panelu, zrzut ekranu w dokumentacji |
| 4.10 | Czy retencja danych jest jasno określona i czy środowiska są odseparowane? | NIE WIEMY | Dokumentacja mówi „30 dni, chyba że prawo wymaga dłużej”; pytanie do dostawcy wysłane |
| 4.11 | Czy dostawca przejmuje odpowiedzialność (indemnifikacja) za roszczenia osób trzecich? | NIE | Standardowa umowa wyłącza. To kryterium dyskwalifikacji: negocjujemy indemnifikację albo zmieniamy dostawcę (warunek w 5.2) |
| 4.12 | Czy warunki pozwalają na użycie komercyjne w naszym modelu biznesowym? | TAK | Warunki biznesowe |
| 4.13 | Czy możemy wymusić przetwarzanie danych w EOG? | TAK | Region EU w konfiguracji; do potwierdzenia na przykładzie |
| 4.14 | Czy zawarliśmy umowę powierzenia przetwarzania danych (Data Processing Agreement, DPA) i znamy listę subprocesorów? | TAK | DPA podpisane; lista subprocesorów otwarta, bez powiadomień o zmianach (ryzyko) |
| 4.15 | Czy zrobiliśmy DPIA dla tego zastosowania (elementy w 4b)? | NIE | Do zrobienia przed pilotażem; dane zdrowotne w notatkach to przesłanka |
| 4.16 | Czy ustawienia opt-out na trening i retencja są skonfigurowane w panelu, a nie tylko zadeklarowane? | TAK | Zrzuty ekranu z datą |
| 4.17 | Czy plan wyjścia z 4.5 wskazuje alternatywnego dostawcę lub inną wersję produktu? | TAK | Plan wyjścia (4.5): drugi dostawca wytypowany, jeszcze nieprzetestowany |

### 4b. DPIA

Najpierw ustal z inspektorem ochrony danych, czy DPIA jest wymagana. Jest obowiązkowa m.in. przy systematycznej ocenie osób, przetwarzaniu danych szczególnych kategorii na dużą skalę i systematycznym monitorowaniu (RODO, art. 35 ust. 3) oraz dla operacji z wykazu UODO. Jeśli tak, odpowiedz TAK / NIE / NIE WIEMY: czy DPIA zawiera dany element.

| Lp | Element DPIA (RODO, art. 35 ust. 7) | Odpowiedź |
| --- | --- | --- |
| 4.18 | Opis operacji: systematyczny opis planowanych operacji i celów przetwarzania, w tym prawnie uzasadnionych interesów administratora, jeśli są podstawą przetwarzania. | NIE. DPIA jeszcze nie ma; IOD zalecił ją ze względu na dane o zdrowiu w notatkach z planu (termin: 5.12.2026). Materiał wyjściowy: sekcja 0 i pola 2.1–2.4. |
| 4.19 | Ocena konieczności: analiza, czy przetwarzanie jest niezbędne i proporcjonalne do celów. | NIE. Do opisania: czy do breakdownu potrzebne są nazwiska i telefony (wstępnie: nie, wystarczą tokeny). |
| 4.20 | Ocena ryzyka: oszacowanie konkretnych ryzyk dla praw i wolności osób, których dane dotyczą (np. ryzyko wycieku danych, kradzieży tożsamości, dyskryminacji). | NIE. Wstępnie z 2.10: dane zdrowotne i kontaktowe ekipy w notatkach z planu, wynik 9. |
| 4.21 | Środki zaradcze: opis zabezpieczeń oraz środków technicznych (np. szyfrowanie) i organizacyjnych, które wdrożymy, aby zminimalizować to ryzyko i wykazać zgodność z RODO. | NIE. Planowane środki z 4.1: separacja przed wysłaniem, usunięcie danych zdrowotnych z przepływu, hook na stanowiskach użytkowników. |

## 5. Decyzja zespołu

| Lp | Pytanie | Wpis zespołu |
| --- | --- | --- |
| 5.1 | Decyzja: Go, Go z warunkami, No-go | Go z warunkami |
| 5.2 | Warunki, które muszą być spełnione przed startem | DPIA; usunięcie danych zdrowotnych z przepływu (warstwa 0); hook separacji na stanowiskach użytkowników; szkolenie 12 osób; odpowiedź dostawcy o retencji (4.10); indemnifikacja wynegocjowana w umowie albo zmiana dostawcy (4.11). |
| 5.3 | Najbliższe trzy kroki: kto, co, do kiedy | (1) Kierownik produkcji: lista danych w notatkach z planu i co z niej wypada, do 20.11.2026. (2) IOD: DPIA, do 5.12.2026. (3) II reżyser: test breakdownu na 2 odcinkach z pomiarem poprawek, do 15.12.2026. |
| 5.4 | Jedno zdanie dla zarządu: co zdecydować, kto odpowiada, ile kosztuje. | Narzędzie oszczędza ok. 2 dni pracy na odcinek, ale bez separacji danych i DPIA wysyłamy dostawcy scenariusz i dane zdrowotne ekipy; prosimy o 3 tygodnie i budżet na szkolenie przed pilotażem. |

## Kryteria przeglądu

Oceń Canvas w skali 1–5 i dopisz jedno zdanie uzasadnienia.

| Lp | Kryterium | Ocena (1–5) | Uzasadnienie |
| --- | --- | --- | --- |
| P1 | Konkretność: nazwy, liczby, osoby zamiast ogólników |   |   |
| P2 | Kompletność: oceniono wszystkie siedem obszarów ryzyka |   |   |
| P3 | Kontrole: powiązane z wynikiem ryzyka i mają właściciela |   |   |
| P4 | Weryfikowalność: wiadomo, jak zmierzyć sukces i wykryć błąd |   |   |
| P5 | Realizm decyzji i kroków |   |   |

## Pomoce
- Slajdy keynote'u (6, 12, 13, 15, 23, 26, 27, 33, 34).
- Szkielet Govern / Map / Measure / Manage: NIST AI RMF 1.0: https://www.nist.gov/itl/ai-risk-management-framework
- Mapa ryzyk GenAI: NIST AI 600-1, Generative AI Profile: https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf
- Bezpieczeństwo aplikacji LLM: OWASP Top 10 for LLM Applications 2026: https://genai.owasp.org/llm-top-10/
- Wzorce błędów modeli: Ramos H., Fluent and wrong (AI and Ethics 2026): https://doi.org/10.1007/s43681-026-01478-5
- AI Act po Omnibusie: https://artificialintelligenceact.eu/ai-act-explorer/digital-omnibus/
- Harmonogram stosowania AI Act (AI Act Service Desk Komisji Europejskiej): https://ai-act-service-desk.ec.europa.eu/en/ai-act/timeline/timeline-implementation-eu-ai-act
- Komunikat Komisji Europejskiej o wejściu w życie Omnibusa AI: https://digital-strategy.ec.europa.eu/pl/news/ai-omnibus-enters-force
- Polska ustawa z 3.07.2026 o systemach sztucznej inteligencji (Dz.U. 2026 poz. 1003; w mocy od 11.08.2026, KRiBSI od 28.10.2026): https://eli.gov.pl/eli/DU/2026/1003/ogl (ISAP: https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20260001003)
- RODO: https://eur-lex.europa.eu/eli/reg/2016/679/oj; standardowe klauzule umowne, decyzja 2021/914: https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj
- System zarządzania AI: ISO/IEC 42001: https://www.iso.org/standard/81230.html
- Rama Adopt, Defend, Govern i 12 kontroli minimalnych: whitepaper EC-Council https://www.eccouncil.org/adgframework/
- Ocena skutków dla praw podstawowych (AI Act, art. 27): https://www.regulation-ai.eu/pl/articles/article-27/ oraz https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-27
- Ocena skutków dla ochrony danych (RODO, art. 35): https://sip.lex.pl/akty-prawne/dzienniki-UE/rozporzadzenie-2016-679-w-sprawie-ochrony-osob-fizycznych-w-zwiazku-z-68636690/art-35

## Jak użyć tego przykładu na warsztacie
- Jeśli zespoły mają własne projekty: pokaż tylko sekcję 2 (ocena ryzyka) jako wzór konkretności i przejdź do pracy.
- Jeśli projektów brak: wypełniaj ten Canvas wspólnie na ekranie, ale zacznij od pustych pól w sekcjach 2 i 4 i pozwól sali je zaproponować; dopiero potem odkryj wersję wypełnioną.
- Pytania, które zwykle otwierają dyskusję: czy dane zdrowotne w notatkach z planu to problem (tak, i zwykle nikt o nich nie myśli); czy scenariusz można wysłać do modelu (w częściach, po tokenizacji, pod umową z opt-out); czy „rekomendacja obsady” zmienia poziom ryzyka (tak, na wysokie).
