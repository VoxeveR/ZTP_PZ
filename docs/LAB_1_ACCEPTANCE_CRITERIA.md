# Laboratorium 1: mapa wymagań, plików i funkcji

Dokument do prezentacji etapów 1.1–1.3 prowadzącej. Projekt używa NestJS/TypeORM zamiast FastAPI/SQLAlchemy. Frontend React nie jest jeszcze implementowany. Kod jest podzielony na osobne feature’y `backend/src/features/products`, `categories` i `product-history`, zgodnie z vertical slicing.

## Etap 1.1

| Wymaganie | Gdzie pokazać | Konkretna funkcja / element |
| --- | --- | --- |
| Własny projekt w VS Code | [package.json](../package.json), [main.ts](../src/main.ts), [launch.json](../../.vscode/launch.json) | Zależności NestJS, skrypty npm, `bootstrap()`, konfiguracja debugowania. |
| PostgreSQL w kontenerze Dockera | [docker-compose.yml](../docker-compose.yml) | Usługa `postgres`: obraz PostgreSQL 16, port 5432, dane dostępowe, wolumen `pgdata`, healthcheck. |
| Połączenie aplikacji z PostgreSQL | [database.module.ts](../src/infrastructure/database/database.module.ts), [environment.ts](../src/config/environment.ts) | `TypeOrmModule.forRootAsync()` i jego `useFactory`; `validateEnvironment()` dostarcza parametry `DB_*`. |
| Baza z produktami, kategoriami i cenami | [1790000000000-create-products.ts](../src/infrastructure/database/migrations/1790000000000-create-products.ts) | `CreateProducts1790000000000.up()` tworzy `products`, `categories`, relację i przykładowe dane. `Product` i `Category` w plikach encji mapują tabele na klasy TypeORM. |
| `GET /api/v1/products` | [products.controller.ts](../src/features/products/products.controller.ts), [products.service.ts](../src/features/products/products.service.ts), [products.repository.ts](../src/features/products/products.repository.ts) | Kolejno `ProductsController.findAll()` → `ProductsService.findAll()` → `ProductsRepository.findAll()`. |
| `GET /api/v1/products/{id}` | Te same trzy pliki | Kolejno `ProductsController.findById()` → `ProductsService.findById()` → `ProductsRepository.findById()`. Brak produktu kończy się 404. |
| Prefiks i dokumentacja REST | [app.ts](../src/app.ts), [openapi.service.ts](../src/infrastructure/openapi/openapi.service.ts), [products.openapi.ts](../src/features/products/products.openapi.ts) | `createApplication()` ustawia `api/v1`; `OpenApiService.setup()` publikuje Swagger; `ApiListProducts()` i `ApiGetProduct()` opisują odczyty. |

Warto powiedzieć: „Kontroler odbiera HTTP, serwis realizuje logikę, repozytorium odpytuje PostgreSQL, a encje i DTO opisują dane. Pliki są zgrupowane według funkcjonalności, ale odpowiedzialności pozostają rozdzielone”.

## Etap 1.2

| Wymaganie | Gdzie pokazać | Konkretna funkcja / element |
| --- | --- | --- |
| Kategorie i tabela zakazanych nazw | [1790000001000-extend-products.ts](../src/infrastructure/database/migrations/1790000001000-extend-products.ts), [category.entity.ts](../src/features/categories/category.entity.ts), [forbidden-product-name.entity.ts](../src/features/products/forbidden-product-name.entity.ts) | `ExtendProducts1790000001000.up()` dodaje `min_price`, `max_price`, `quantity`, ograniczenia i `forbidden_product_names`. Kategorie mają własny feature; zakazane nazwy należą do produktów. |
| `GET` listy i produktu | [products.controller.ts](../src/features/products/products.controller.ts) | `findAll()` i `findById()`, jak w etapie 1.1. |
| `POST /api/v1/products` | [products.controller.ts](../src/features/products/products.controller.ts), [products.service.ts](../src/features/products/products.service.ts), [products.repository.ts](../src/features/products/products.repository.ts) | `create()` w kontrolerze → `create()` w serwisie → `create()` w repozytorium; sukces: 201. |
| `PUT /api/v1/products/{id}` | Te same trzy pliki | `replace()` w kontrolerze → `replace()` / `change()` w serwisie → `replace()` w repozytorium; sukces: 200. PUT wymaga wszystkich czterech pól. |
| `DELETE /api/v1/products/{id}` | Te same trzy pliki | `delete()` w kontrolerze → `delete()` w serwisie → `delete()` w repozytorium; sukces: 204 bez body. |
| Nazwa: 3–20 liter/cyfr | [products.service.ts](../src/features/products/products.service.ts) | `validate()`: normalizacja NFC i wyrażenie `/^[\p{L}\p{Nd}]{3,20}$/u`. Obsługiwane są polskie litery. |
| Unikalna nazwa | [products.service.ts](../src/features/products/products.service.ts), [products.repository.ts](../src/features/products/products.repository.ts), druga migracja | `validate()` → `nameExists()`; porównanie `lower(name)`. Indeks `products_name_lower_unique` chroni też przed równoczesnymi zapisami. `persist()` mapuje konflikt z bazy na błąd domenowy. |
| Zakazane nazwy | Te same pliki | `findForbiddenNames()` pobiera frazy z tabeli; `validate()` odrzuca nazwę zawierającą taką frazę, bez rozróżniania wielkości liter. |
| Cena w widełkach kategorii | [products.service.ts](../src/features/products/products.service.ts), [categories.service.ts](../src/features/categories/categories.service.ts), [categories.repository.ts](../src/features/categories/categories.repository.ts) | `CategoriesService.findById()` pobiera kategorię przez własne repozytorium w tej samej transakcji; `ProductsService.validate()` porównuje cenę z `minPrice` i `maxPrice`, z uwzględnieniem granic. |
| Liczba dostępnych sztuk ≥ 0 | [product-write.dto.ts](../src/features/products/product-write.dto.ts), [products.service.ts](../src/features/products/products.service.ts), [product-response.dto.ts](../src/features/products/product-response.dto.ts) | `ProductWriteDto.quantity` wymaga liczby całkowitej; `validate()` sprawdza zakres 0–2147483647; `buildProductSnapshot()` / `toResponse()` dodają `quantity` do odpowiedzi. Dodatkowo istnieje CHECK w bazie. |
| Walidacja techniczna i obsługa błędów | [body-validation.pipe.ts](../src/infrastructure/http/body-validation.pipe.ts), [product.errors.ts](../src/features/products/product.errors.ts), [product-exception.filter.ts](../src/features/products/product-exception.filter.ts) | `BodyValidationPipe.transform()` sprawdza body. Serwis rzuca wyjątki domenowe; `ProductExceptionFilter.catch()` mapuje je na 400 / 404 / 409 / 422. |

Przykładowe widełki zapisane w bazie: Electronics 10.00–100000.00, Books 1.00–1000.00, Food 0.01–500.00. Są to wartości przykładowe, ponieważ instrukcja nie określa konkretnych kwot.

## Etap 1.3

| Wymaganie | Gdzie pokazać | Konkretna funkcja / element |
| --- | --- | --- |
| Struktura pod dalsze etapy | [app.module.ts](../src/app.module.ts), [products.module.ts](../src/features/products/products.module.ts), [categories.module.ts](../src/features/categories/categories.module.ts), [product-history.module.ts](../src/features/product-history/product-history.module.ts) | `AppModule` składa trzy feature’y: produkty, kategorie i historię. Każdy ma własne encje, repozytorium, serwis i DTO. Feature’y z endpointami mają też kontroler i dokumentację OpenAPI. |
| Historia w bazie | [1790000002000-create-product-history.ts](../src/infrastructure/database/migrations/1790000002000-create-product-history.ts), [product-history.entity.ts](../src/features/product-history/product-history.entity.ts) | `CreateProductHistory1790000002000.up()` tworzy `product_history`; encja `ProductHistory` zawiera `productId`, `action`, `previousState`, `currentState`, `changedAt`. Stany to JSONB, czas to TIMESTAMPTZ. |
| Stan przed i po zmianie | [product.snapshot.ts](../src/features/products/product.snapshot.ts), [products.service.ts](../src/features/products/products.service.ts) | `buildProductSnapshot()` tworzy pełny, niezależny obraz produktu z kategorią. `toResponse()` używa tego samego formatu dla odpowiedzi i historii. |
| Zapis historii POST | [products.service.ts](../src/features/products/products.service.ts) | `create()` zapisuje akcję `CREATE`: `previousState = {}`, `currentState = utworzony produkt`. |
| Zapis historii PUT | Ten sam plik | `replace()` → `change()` zapisuje `REPLACE`, ze stanem przed i po zastąpieniu. |
| Zapis historii PATCH | [product-patch.dto.ts](../src/features/products/product-patch.dto.ts), serwis | `patch()` scala przesłane pola z bieżącym stanem; `change()` zapisuje `UPDATE`. Zmiana samej kategorii również powoduje ponowną walidację ceny. |
| Zapis historii DELETE | [products.service.ts](../src/features/products/products.service.ts), [product-history.service.ts](../src/features/product-history/product-history.service.ts), [product-history.repository.ts](../src/features/product-history/product-history.repository.ts) | `delete()` zapisuje `DELETE`: stan przed usunięciem i `{}` po usunięciu. Serwis produktów wywołuje `ProductHistoryService.append()` z menedżerem bieżącej transakcji; repozytorium historii wykonuje INSERT. |
| Atomowość i równoległe aktualizacje | [products.repository.ts](../src/features/products/products.repository.ts), serwis | `transaction()` otacza obydwa zapisy. `findById(..., manager, true)` zakłada blokadę `pessimistic_write`. Błąd historii wycofuje również zmianę produktu. |
| Odczyt historii | [product-history.controller.ts](../src/features/product-history/product-history.controller.ts), [product-history.service.ts](../src/features/product-history/product-history.service.ts), [product-history.openapi.ts](../src/features/product-history/product-history.openapi.ts) | `ProductHistoryController.findByProductId()` → `ProductHistoryService.findByProductId()` → `ProductHistoryRepository.findByProductId()`. Sortowanie: `changedAt DESC`, potem `id DESC`. W Swaggerze osobna grupa `product-history`. |
| Historia po usunięciu | Encja/migracja historii i serwis historii | `product_id` nie jest kluczem obcym. `ProductHistoryService.findByProductId()` może zwrócić historię usuniętego produktu. |
| Testy wymagane przez prowadzącą dla produktów | [product-history.e2e.test.mjs](../test/product-history.e2e.test.mjs) | Test `POST, PUT, PATCH and DELETE persist complete before/after snapshots, including after deletion` obejmuje poprawny POST, PUT i odczyt historii. Test `a validation error in POST leaves both products and history unchanged` obejmuje błędny POST. Pozostałe scenariusze rozszerzają te wymagania. |
| Izolacja testów | [test-database.mjs](../test/support/test-database.mjs), hooki `after()` w plikach testów | `prepareTestDatabase()` tworzy bazę `ztp_test_<UUID>`; zwracane `cleanup()` ją usuwa. Dane produktów w `appdb` nie są modyfikowane przez testy. |

Endpoint historii ma w naszej aplikacji pełny adres **`GET /api/v1/products/{id}/history`**. W instrukcji `/products/{id}/history` jest podany bez prefiksu, który ustawiamy globalnie w `createApplication()`.

## Uruchomienie aplikacji do prezentacji

PowerShell, początkowo katalog główny `ZTP`:

```powershell
cd backend
npm ci
npm run db:up
npm run start:dev
```

Swagger: http://127.0.0.1:8000/docs. Do testów automatycznych serwer `start:dev` nie musi być uruchomiony: testy tworzą własne aplikacje na wolnych portach. Baza PostgreSQL musi działać.

Podgląd bazy, z katalogu `backend`:

```powershell
docker compose exec postgres psql -U appuser -d appdb -c "SELECT p.id, p.name, p.price, p.quantity, c.name AS category, c.min_price, c.max_price FROM products p JOIN categories c ON c.id = p.category_id ORDER BY p.id;"
docker compose exec postgres psql -U appuser -d appdb -c "SELECT * FROM forbidden_product_names;"
docker compose exec postgres psql -U appuser -d appdb -c "SELECT product_id, action, previous_state, current_state, changed_at FROM product_history ORDER BY changed_at DESC, id DESC;"
```

## Testy naszej aplikacji — skrypty package.json

Wszystkie poniższe komendy wykonuj w `ZTP/backend`, po `npm ci` i `npm run db:up`.

| Komenda | Zakres |
| --- | --- |
| `npm test` lub `npm run test:all` | Wszystkie testy NestJS: produkty, historia i lifecycle. |
| `npm run test:required` | Plik testów historii: scenariusze wymagane w etapie 1.3 dla produktów oraz dodatkowe przypadki transakcji/PATCH/historii. |
| `npm run test:products` | CRUD, walidacje, granice cen, unikalność, błędy HTTP, Swagger i CORS. |
| `npm run test:history` | Historia, poprawny/błędny POST, PUT, PATCH, DELETE, izolacja historii i rollback. |
| `npm run test:lifecycle` | Zamykanie HTTP i puli bazy oraz sygnały systemowe. |
| `npm run test:docker` | Budowa obrazu testowego i cały zestaw w Linuxie, również rzeczywiste SIGINT/SIGTERM. |

Pierwsze komendy same kompilują backend. `test:required` jest aliasem `test:history`; nie jest to plik Python od prowadzącej. Na Windows dwa testy rzeczywistego dostarczania sygnałów są pomijane. `test:docker` uruchamia je w Linuxie; Docker Desktop musi działać. Skrypt zakłada sieć `ztp_default`, tworzoną przez główny Compose w tym repozytorium.

Jeśli kod obrazu nie zmienił się od poprzedniej budowy, można wykonać samo `npm run test:docker:run`. Po zmianie kodu używaj `npm run test:docker`, żeby obraz zawierał aktualne źródła.

## Oryginalne testy Python od prowadzącej

[1.3/tests/test_students_api.py](../../1.3/tests/test_students_api.py) testuje **FastAPI i studentów**, a nie naszą aplikację NestJS z produktami. Testy używają `TestClient` i oryginalnego kodu w `1.3/app/REST`. Nie kieruje się ich na uruchomiony backend NestJS. Odpowiednik scenariuszy dla produktów to `npm run test:required`.

Dla oryginalnych testów dodany jest osobny [docker-compose.tests.yml](../../1.3/docker-compose.tests.yml). Tworzy bazę na porcie **5433**, z oryginalnym SQL-em prowadzącej i ulotnym katalogiem danych. Nie koliduje z PostgreSQL aplikacji na 5432. Nie zmienia plików testów od prowadzącej.

PowerShell, od katalogu głównego `ZTP`:

```powershell
cd 1.3
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r .\requirements.txt
docker compose -p ztp-lab13-tests -f .\docker-compose.tests.yml up -d --wait

$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '5433'
$env:DB_NAME = 'appdb'
$env:DB_USER = 'appuser'
$env:DB_PASSWORD = 'apppassword'

.\.venv\Scripts\python.exe -m pytest -v .\tests
```

Nie trzeba aktywować venv ani uruchamiać Uvicorna. Żeby uruchomić tylko oryginalny test POST i historii:

```powershell
.\.venv\Scripts\python.exe -m pytest -v .\tests\test_students_api.py::test_post_students_creates_student_and_history_entry
```

Po zakończeniu, nadal w `ZTP/1.3`, usuń tylko środowisko tych testów i ich ustawienia bieżącej sesji PowerShell:

```powershell
docker compose -p ztp-lab13-tests -f .\docker-compose.tests.yml down
Remove-Item Env:DB_HOST, Env:DB_PORT, Env:DB_NAME, Env:DB_USER, Env:DB_PASSWORD
```

Usunięcie ustawień `DB_*` jest istotne przed powrotem do testów NestJS, żeby nie używały portu 5433. Oryginalne fixture `db_session()` i `client()` w `1.3/tests/conftest.py` izolują zmiany przez transakcje/savepointy i rollback; nasza aplikacja zamiast tego używa osobnych tymczasowych baz.
