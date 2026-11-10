# AI Risk & Governance Canvas

Zespół:

Projekt:

Data:

Zasada: puste pole jest uczciwsze niż pole zapełnione ogólnikiem. Jeśli czegoś nie wiesz, wpisz „nie wiemy” i dopisz, kto to ustali.

## 0. Projekt

| Lp | Pole | Wpis zespołu |
| --- | --- | --- |
| 0.1 | Nazwa projektu |   |
| 0.2 | Cel biznesowy w jednym zdaniu |   |
| 0.3 | Co robi AI w tym projekcie |   |
| 0.4 | Narzędzie lub model, dostawca |   |
| 0.5 | Użytkownicy i osoby, których dotyczą wyniki |   |
| 0.6 | Etap (pomysł, pilotaż, produkcja) |   |

## 1. GOVERN: kto odpowiada i jakie są zasady

| Lp | Pytanie | Wpis zespołu |
| --- | --- | --- |
| 1.1 | Właściciel projektu i osoba zatwierdzająca ryzyko |   |
| 1.2 | Czy istnieje polityka AI, która obejmuje ten projekt? |   |
| 1.3 | Kto jest dostawcą modelu i narzędzia, a kto użytkownikiem (my jako podmiot stosujący)? Szczegóły roli: 1.6 |   |
| 1.4 | Wstępna hipoteza poziomu ryzyka wg AI Act: zakazane (art. 5), wysokie (art. 6 i zał. III), obowiązki przejrzystości (art. 50), minimalne |   |
| 1.5 | Kto w zarządzie dostaje raport o tym projekcie i jak często? |   |
| 1.6 | Rola w AI Act: dostawca, podmiot stosujący, importer, dystrybutor? Czy nie stajemy się dostawcą: własna marka na systemie, istotna zmiana, zmiana przeznaczenia (art. 25)? |   |
| 1.7 | Czy osoby obsługujące system mają udokumentowane szkolenie z AI? Kto i kiedy je przeprowadził? |   |
| 1.8 | Czy projekt mieści się w polityce AI firmy i na liście zatwierdzonych narzędzi? Jeśli nie, kto ją uzupełni? |   |

## 2. MAP: gdzie jest ryzyko

Najpierw opisz kontekst danych, potem oceń obszary.

| Lp | Pytanie o dane | Wpis zespołu |
| --- | --- | --- |
| 2.1 | Jakie dane wchodzą do modelu? |   |
| 2.2 | Czy są wśród nich dane osobowe lub szczególnych kategorii? |   |
| 2.3 | Czy są tajemnica przedsiębiorstwa lub dane klientów? |   |
| 2.4 | Gdzie dane są przetwarzane (EOG czy poza) i na jakiej umowie? |   |
| 2.5 | Jeśli system jest wysokiego ryzyka: czy jako deployer zrobimy FRIA (ocena skutków dla praw podstawowych, art. 27)? Może być połączona z DPIA. Elementy DPIA: sekcja 4b. |   |
| 2.6 | Do której kategorii z klasyfikacji należą dane projektu: zielone, żółte, czerwone? Co z tego wynika dla wyboru narzędzia? |   |
| 2.7 | Dostawca poza EOG: czy dane wychodzą z EOG, czy mamy umowę i ocenę transferu, kto to podpisał? |   |

Ocena ryzyka: prawdopodobieństwo i skutek w skali 1–3, wynik to ich iloczyn. Wynik 6–9 wymaga kontroli przed startem.

| Lp | Obszar | Gdzie w projekcie | Prawdopodobieństwo (1–3) | Skutek (1–3) | Wynik |
| --- | --- | --- | --- | --- | --- |
| 2.8 | Halucynacje |   |   |   |   |
| 2.9 | Bias |   |   |   |   |
| 2.10 | Prywatność i RODO |   |   |   |   |
| 2.11 | Własność intelektualna |   |   |   |   |
| 2.12 | Bezpieczeństwo (prompt injection, nadmierna sprawczość) |   |   |   |   |
| 2.13 | Łańcuch dostawców i zależność od jednego modelu |   |   |   |   |
| 2.14 | Przejrzystość wobec klienta (bot, treści generowane, deepfake) |   |   |   |   |

## 3. MEASURE: jak sprawdzamy, że działa

| Lp | Pytanie | Wpis zespołu |
| --- | --- | --- |
| 3.1 | Jaka jest miara jakości wyniku (np. odsetek poprawnych odpowiedzi w próbce)? |   |
| 3.2 | Kto i jak często weryfikuje losową próbkę wyników? |   |
| 3.3 | Jak testujemy różnice wyników między grupami (bias)? |   |
| 3.4 | Jaki próg akceptacji uznajemy za bezpieczny? |   |
| 3.5 | Jak mierzymy wartość projektu (czas, koszt, jakość)? |   |
| 3.6 | Czy liczby w wyniku liczy kod lub arkusz, a nie model? Jak to sprawdzamy? |   |

## 4. MANAGE: co robimy, gdy coś zawiedzie

| Lp | Pytanie | Wpis zespołu |
| --- | --- | --- |
| 4.1 | Trzy główne kontrole dla ryzyk z wynikiem 6–9 |   |
| 4.2 | Gdzie człowiek zatwierdza decyzję przed skutkiem? |   |
| 4.3 | Jakie uprawnienia ma agent lub narzędzie i czy są najmniejsze potrzebne? |   |
| 4.4 | Jak wygląda procedura incydentu: kto, w jakim czasie, co zgłasza? |   |
| 4.5 | Plan wyjścia: co robimy, gdy dostawca zmieni warunki lub zniknie? |   |
| 4.6 | Rejestr użycia i ślad decyzji: gdzie są zapisywane? |   |
| 4.7 | Kto informuje dostawcę o poważnym incydencie (art. 26 ust. 5), kto zgłasza naruszenie danych do UODO i kto odpowiada, gdy sami jesteśmy dostawcą (art. 73)? |   |
| 4.8 | Jeśli agent wykonuje operacje (płatności, maile, zmiany danych): gdzie dokładnie człowiek zatwierdza i czy zmiana danych kontrahenta idzie osobnym kanałem? |   |

### 4a. Checklista dostawcy AI

Odpowiedz TAK / NIE / NIE WIEMY. Każde NIE w pierwszych pięciu wierszach (4.9–4.13) to kryterium dyskwalifikacji dostawcy.

| Lp | Pytanie do dostawcy | TAK / NIE / NIE WIEMY | Gdzie to sprawdziliśmy (umowa, DPA, panel) |
| --- | --- | --- | --- |
| 4.9 | Czy nasze dane wejściowe i wyjściowe są wyłączone z treningu i ulepszania modelu, i czy możemy to skutecznie wyłączyć? |   |   |
| 4.10 | Czy retencja danych jest jasno określona i czy środowiska są odseparowane? |   |   |
| 4.11 | Czy dostawca przejmuje odpowiedzialność (indemnifikacja) za roszczenia osób trzecich? |   |   |
| 4.12 | Czy warunki pozwalają na użycie komercyjne w naszym modelu biznesowym? |   |   |
| 4.13 | Czy możemy wymusić przetwarzanie danych w EOG? |   |   |
| 4.14 | Czy zawarliśmy umowę powierzenia (DPA) i znamy listę subprocesorów? |   |   |
| 4.15 | Czy zrobiliśmy DPIA dla tego zastosowania? |   |   |
| 4.16 | Czy ustawienia opt-out na trening i retencja są skonfigurowane w panelu, a nie tylko zadeklarowane? |   |   |
| 4.17 | Czy mamy plan wyjścia: alternatywny dostawca lub inna wersja produktu? |   |   |

### 4b. DPIA

Wpisz, czy element jest opisany i gdzie jest dokument. DPIA jest obowiązkowa m.in. przy systematycznej ocenie osób, przetwarzaniu danych szczególnych kategorii na dużą skalę i systematycznym monitorowaniu (art. 35 ust. 3 RODO) oraz dla operacji z wykazu UODO; cztery elementy poniżej odpowiadają art. 35 ust. 7.

| Lp | Wymaganie | Opisane? Gdzie dokument |
| --- | --- | --- |
| 4.18 | Opis operacji: Systematyczny opis planowanych operacji i celów przetwarzania (w tym uzasadnienie realizowanego interesu). |   |
| 4.19 | Ocena konieczności: Analiza, czy przetwarzanie jest niezbędne i proporcjonalne do celów, które chcesz osiągnąć. |   |
| 4.20 | Ocena ryzyka: Oszacowanie konkretnych ryzyk dla praw i wolności osób, których dane dotyczą (np. ryzyko wycieku danych, kradzieży tożsamości, dyskryminacji). |   |
| 4.21 | Środki zaradcze: Opis zabezpieczeń, środków technicznych (np. szyfrowanie) i organizacyjnych, które wdrożysz, aby to ryzyko zminimalizować i udowodnić zgodność z RODO. |   |

## 5. Decyzja zespołu

| Lp | Pytanie | Wpis zespołu |
| --- | --- | --- |
| 5.1 | Decyzja: Go, Go z warunkami, No-go |   |
| 5.2 | Warunki, które muszą być spełnione przed startem |   |
| 5.3 | Najbliższe trzy kroki: kto, co, do kiedy |   |
| 5.4 | Jedno zdanie dla zarządu: co zdecydować, kto odpowiada, ile kosztuje. |   |

## Kryteria przeglądu

Oceń Canvas w skali 1–5 i dopisz jedno zdanie uzasadnienia.

| Lp | Kryterium | Ocena (1–5) | Uzasadnienie |
| --- | --- | --- | --- |
| P1 | Konkretność: nazwy, liczby, osoby zamiast ogólników |   |   |
| P2 | Kompletność: wszystkie siedem obszarów ryzyka ocenione |   |   |
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
- https://ai-act-service-desk.ec.europa.eu/en/ai-act/timeline/timeline-implementation-eu-ai-act
- https://digital-strategy.ec.europa.eu/pl/news/ai-omnibus-enters-force
- Polska ustawa z 3.07.2026 o systemach sztucznej inteligencji (Dz.U. 2026 poz. 1003; w mocy od 11.08.2026, KRiBSI od 28.10.2026): https://eli.gov.pl/eli/DU/2026/1003/ogl (ISAP: https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20260001003)
- RODO: https://eur-lex.europa.eu/eli/reg/2016/679/oj; standardowe klauzule umowne, decyzja 2021/914: https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj
- System zarządzania AI: ISO/IEC 42001: https://www.iso.org/standard/81230.html
- Rama Adopt, Defend, Govern i 12 kontroli minimalnych: whitepaper EC-Council https://www.eccouncil.org/adgframework/
- Ocena skutków praw podstawowych https://www.regulation-ai.eu/pl/articles/article-27/ https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-27
- Ocena skutków dla ochrony danych https://sip.lex.pl/akty-prawne/dzienniki-UE/rozporzadzenie-2016-679-w-sprawie-ochrony-osob-fizycznych-w-zwiazku-z-68636690/art-35
