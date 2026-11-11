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
| 1.3 | Rola firmy w AI Act: dostawca, podmiot stosujący (deployer), importer czy dystrybutor? |   |
| 1.4 | Wstępna klasyfikacja zastosowania: zakazane / wysokiego ryzyka / podlegające obowiązkom przejrzystości / pozostałe. Wskaż podstawę kwalifikacji (AI Act: art. 5; art. 6 i zał. I, III; art. 50). |   |
| 1.5 | Kto w zarządzie dostaje raport o tym projekcie i jak często? |   |
| 1.6 | Czy nie stajemy się dostawcą: własna marka na systemie, istotna zmiana, zmiana przeznaczenia (AI Act, art. 25)? |   |
| 1.7 | Czy osoby obsługujące system mają udokumentowane szkolenie z AI? Kto i kiedy je przeprowadził? |   |
| 1.8 | Czy narzędzie jest na liście zatwierdzonych narzędzi? Jeśli nie, kto uzupełni listę lub politykę AI? |   |

## 2. MAP: gdzie jest ryzyko

Najpierw opisz kontekst danych, potem oceń obszary.

| Lp | Pytanie o dane | Wpis zespołu |
| --- | --- | --- |
| 2.1 | Jakie dane wchodzą do modelu? |   |
| 2.2 | Czy są wśród nich dane osobowe lub szczególnych kategorii? |   |
| 2.3 | Czy są tajemnica przedsiębiorstwa lub dane klientów? |   |
| 2.4 | Gdzie dane są przetwarzane (EOG czy poza) i na jakiej umowie? |   |
| 2.5 | Jeśli system jest wysokiego ryzyka: czy podlegamy obowiązkowi FRIA (ocena skutków dla praw podstawowych; AI Act, art. 27: podmioty publiczne i prywatne świadczące usługi publiczne, ocena zdolności kredytowej, ubezpieczenia na życie i zdrowotne)? Może być połączona z DPIA. |   |
| 2.6 | Do której kategorii z klasyfikacji należą dane projektu: zielone, żółte, czerwone? Co z tego wynika dla wyboru narzędzia? |   |
| 2.7 | Jeśli dane wychodzą poza EOG: jaka jest podstawa transferu (decyzja o adekwatności, standardowe klauzule umowne), czy jest ocena transferu i kto ją podpisał? |   |

Ocena ryzyka: prawdopodobieństwo i skutek w skali 1–3, wynik to ich iloczyn. Wynik 6–9 wymaga kontroli przed startem; skutek 3 także, niezależnie od wyniku.

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
| 4.7 | Kto informuje dostawcę o poważnym incydencie (AI Act, art. 26 ust. 5), kto zgłasza naruszenie danych do UODO (RODO, art. 33: 72 godziny) i kto odpowiada, gdy sami jesteśmy dostawcą (AI Act, art. 73)? |   |
| 4.8 | Jeśli agent wykonuje operacje (płatności, maile, zmiany danych): gdzie dokładnie człowiek zatwierdza i czy zmiana danych kontrahenta idzie osobnym kanałem? |   |

### 4a. Checklista dostawcy AI

Odpowiedz TAK / NIE / NIE WIEMY. Wpisz, czy element jest opisany i gdzie jest dokument. Każde NIE w pierwszych pięciu wierszach (4.9–4.13) to kryterium dyskwalifikacji dostawcy.

| Lp | Pytanie | TAK / NIE / NIE WIEMY | Gdzie to sprawdziliśmy (umowa, DPA, panel) |
| --- | --- | --- | --- |
| 4.9 | Czy nasze dane wejściowe i wyjściowe są wyłączone z treningu i ulepszania modelu (domyślnie albo po wyłączeniu, które sami możemy ustawić)? |   |   |
| 4.10 | Czy retencja danych jest jasno określona i czy środowiska są odseparowane? |   |   |
| 4.11 | Czy dostawca przejmuje odpowiedzialność (indemnifikacja) za roszczenia osób trzecich? |   |   |
| 4.12 | Czy warunki pozwalają na użycie komercyjne w naszym modelu biznesowym? |   |   |
| 4.13 | Czy możemy wymusić przetwarzanie danych w EOG? |   |   |
| 4.14 | Czy zawarliśmy umowę powierzenia przetwarzania danych (Data Processing Agreement, DPA) i znamy listę subprocesorów? |   |   |
| 4.15 | Czy zrobiliśmy DPIA dla tego zastosowania (elementy w 4b)? |   |   |
| 4.16 | Czy ustawienia opt-out na trening i retencja są skonfigurowane w panelu, a nie tylko zadeklarowane? |   |   |
| 4.17 | Czy plan wyjścia z 4.5 wskazuje alternatywnego dostawcę lub inną wersję produktu? |   |   |

### 4b. DPIA

Najpierw ustal z inspektorem ochrony danych, czy DPIA jest wymagana. Jest obowiązkowa m.in. przy systematycznej ocenie osób, przetwarzaniu danych szczególnych kategorii na dużą skalę i systematycznym monitorowaniu (RODO, art. 35 ust. 3) oraz dla operacji z wykazu UODO. Jeśli tak, odpowiedz TAK / NIE / NIE WIEMY: czy DPIA zawiera dany element.

| Lp | Element DPIA (RODO, art. 35 ust. 7) | Odpowiedź |
| --- | --- | --- |
| 4.18 | Opis operacji: systematyczny opis planowanych operacji i celów przetwarzania, w tym prawnie uzasadnionych interesów administratora, jeśli są podstawą przetwarzania. |   |
| 4.19 | Ocena konieczności: analiza, czy przetwarzanie jest niezbędne i proporcjonalne do celów. |   |
| 4.20 | Ocena ryzyka: oszacowanie konkretnych ryzyk dla praw i wolności osób, których dane dotyczą (np. ryzyko wycieku danych, kradzieży tożsamości, dyskryminacji). |   |
| 4.21 | Środki zaradcze: opis zabezpieczeń oraz środków technicznych (np. szyfrowanie) i organizacyjnych, które wdrożymy, aby zminimalizować to ryzyko i wykazać zgodność z RODO. |   |

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
