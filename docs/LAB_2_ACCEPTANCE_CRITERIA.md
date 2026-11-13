# Laboratorium 2: mapa wymagań, plików i funkcji

Dokument do prezentacji etapów 2.1–2.3 prowadzącej. Projekt używa NestJS/TypeORM zamiast FastAPI/SQLAlchemy. Moduł powiadomień dotyczy produktów i jest osobnym feature’em `backend/src/features/notifications`, obok `products`, `categories` i `product-history`, zgodnie z vertical slicing. Odpowiednikiem katalogów `model/`, `data/`, `service/` i `web/` z instrukcji są pliki w tym folderze: encja i DTO, repozytorium, serwis oraz kontroler z opisem OpenAPI.

## Etap 2.1

| Wymaganie | Gdzie pokazać | Konkretna funkcja / element |
| --- | --- | --- |
| Osobny moduł `notifications` obok modułu produktów | [notifications.module.ts](../backend/src/features/notifications/notifications.module.ts), [app.module.ts](../backend/src/app.module.ts) | `NotificationsModule` rejestruje encję, repozytorium, serwis, kontroler i filtr błędów; `AppModule` importuje go obok `ProductsModule`. |
| Statusy powiadomienia (Oczekujące/Wysłane/Nieudane/Anulowane) | [notification-status.ts](../backend/src/features/notifications/notification-status.ts) | Enum `NotificationStatus`: `PENDING`, `SENT`, `FAILED`, `CANCELLED`. |
| Maszyna stanów | [notification-state-machine.ts](../backend/src/features/notifications/notification-state-machine.ts) | `ALLOWED_TRANSITIONS`: z `PENDING` do `SENT`, `FAILED` lub `CANCELLED`; stany końcowe nie mają przejść. `canTransition()` zwraca `true`/`false`. |
| Zmiana statusu zgodna z maszyną stanów | [notifications.controller.ts](../backend/src/features/notifications/notifications.controller.ts), [notifications.service.ts](../backend/src/features/notifications/notifications.service.ts), [notifications.repository.ts](../backend/src/features/notifications/notifications.repository.ts) | `PATCH /api/v1/notifications/{id}/status`: `updateStatus()` w kontrolerze → `updateStatus()` w serwisie → `findById(..., lock)` i `save()` w repozytorium. Niedozwolone przejście: 422. Odczyt i zapis są w jednej transakcji z blokadą wiersza. |
| Kanały komunikacji | [notification-channel.ts](../backend/src/features/notifications/notification-channel.ts) | Enum `NotificationChannel`: `EMAIL`, `PUSH`. |
| Trwałe przechowywanie w bazie | [1790000003000-create-notifications.ts](../backend/src/infrastructure/database/migrations/1790000003000-create-notifications.ts), [notification.entity.ts](../backend/src/features/notifications/notification.entity.ts) | `CreateNotifications1790000003000.up()` tworzy tabelę `notifications` (`scheduled_at TIMESTAMPTZ`, `status` domyślnie `PENDING`, CHECK dla kanału i statusu). Encja `Notification` mapuje tabelę. |
| `POST /api/v1/notifications` | [notifications.controller.ts](../backend/src/features/notifications/notifications.controller.ts), [notifications.service.ts](../backend/src/features/notifications/notifications.service.ts), [notifications.repository.ts](../backend/src/features/notifications/notifications.repository.ts) | `create()` w kontrolerze → `create()` w serwisie (walidacja, konwersja do UTC, status `PENDING`) → `create()` w repozytorium; sukces: 201. |
| `GET` listy i pojedynczego powiadomienia | Te same trzy pliki | `findAll()` i `findById()` w kontrolerze, serwisie i repozytorium. Brak rekordu: 404, ID spoza zakresu: 400. |
| Dane wejściowe z czasem i strefą | [notification-create.dto.ts](../backend/src/features/notifications/notification-create.dto.ts) | `NotificationCreateDto`: `content`, `channel`, `recipient`, `scheduledAt` (ISO 8601), `timezone`. Brak pola, zły typ, nieznany kanał lub data nie w formacie ISO: 400. |
| Walidacja czasu i strefy | [notifications.service.ts](../backend/src/features/notifications/notifications.service.ts), [notification-time.ts](../backend/src/features/notifications/notification-time.ts) | `validate()`: niepusta treść i odbiorca, strefa wymagana i poprawna (`isValidTimezone()`), data w przyszłości. Naruszenie reguły: 422. |
| Konwersja do UTC | [notification-time.ts](../backend/src/features/notifications/notification-time.ts) | `toUtc()`: czas bez przesunięcia jest czasem lokalnym w `timezone` (np. 09:00 Europe/Warsaw → 08:00Z zimą, 07:00Z latem); czas z `Z` lub przesunięciem to już konkretny moment. Do bazy trafia UTC, a `timezone` zostaje zapisana obok. |
| Osobna dokumentacja produktów i powiadomień | [openapi.service.ts](../backend/src/infrastructure/openapi/openapi.service.ts), [notifications.openapi.ts](../backend/src/features/notifications/notifications.openapi.ts) | `OpenApiService.setup()` publikuje trzy strony: `/docs` (całe API), `/products-docs` (produkty i historia) oraz `/notifications-docs` (powiadomienia). `ApiNotifications()` nadaje tag `notifications`. |

Warto powiedzieć: „Klient podaje godzinę w swojej strefie, a system zapisuje jeden wspólny punkt odniesienia, czyli UTC. Dzięki temu worker z etapu 2.2 może porównywać daty wszystkich powiadomień z bieżącym czasem UTC”.

Przykładowe żądanie (Swagger: http://127.0.0.1:8000/notifications-docs):

```json
{
  "content": "Produkt Keyboard1 znów dostępny",
  "channel": "EMAIL",
  "recipient": "klient@example.com",
  "scheduledAt": "2027-01-15T09:00:00",
  "timezone": "Europe/Warsaw"
}
```

Odpowiedź zawiera `"scheduledAt": "2027-01-15T08:00:00.000Z"` i `"status": "PENDING"`. Nazwy pól są w camelCase, tak jak w API produktów (`categoryId`), a nie w snake_case jak w przykładzie z instrukcji.

## Etap 2.2

| Wymaganie | Gdzie pokazać | Konkretna funkcja / element |
| --- | --- | --- |
| Kontenery MailHog i ntfy | [docker-compose.yml](../docker-compose.yml) | Usługi `mailhog` (UI http://localhost:8025, SMTP 1025) i `ntfy` (http://localhost:8088) przeniesione bez zmian z `docker-compose.yml` etapu 2.2. Startują razem z bazą: `npm run db:up`. |
| Konfiguracja kanałów i workera | [environment.ts](../backend/src/config/environment.ts), [.env.example](../backend/.env.example) | `validateEnvironment()` dodaje `SMTP_HOST`, `SMTP_PORT`, `MAIL_FROM`, `NTFY_URL`, `NOTIFICATION_WORKER_ENABLED`, `NOTIFICATION_WORKER_INTERVAL_MS` (domyślnie 5000 ms). |
| Delivery: kanał EMAIL (MailHog) | [notification-delivery.service.ts](../backend/src/features/notifications/notification-delivery.service.ts) | `NotificationDeliveryService.sendEmail()` wysyła wiadomość przez SMTP (nodemailer) na MailHog. |
| Delivery: kanał PUSH (ntfy) | Ten sam plik | `sendPush()` wykonuje `POST` na `NTFY_URL/<recipient>`; `recipient` jest nazwą topicu. Odpowiedź inna niż 2xx lub przekroczenie 5 s jest błędem. |
| Dispatcher wybierający kanał | [notification-dispatcher.ts](../backend/src/features/notifications/notification-dispatcher.ts) | `NotificationDispatcher.dispatch()`: `switch` po `channel` → `sendEmail()` lub `sendPush()`; nieznany kanał rzuca błąd. |
| Wykonanie pojedynczego powiadomienia | [notifications.service.ts](../backend/src/features/notifications/notifications.service.ts) | `execute()`: `dispatcher.dispatch()`, potem status `SENT`, a przy błędzie `FAILED` (przejście sprawdza `canTransition()`), zapis w tej samej transakcji. |
| `POST /api/v1/notifications/{id}/send-now` | [notifications.controller.ts](../backend/src/features/notifications/notifications.controller.ts), [notifications.service.ts](../backend/src/features/notifications/notifications.service.ts), [notifications.repository.ts](../backend/src/features/notifications/notifications.repository.ts) | `sendNow()` w kontrolerze → `sendNow()` w serwisie → `findById(id, manager, 'wait')` (blokada wiersza) → `execute()`. Sukces: 200 i `SENT`/`FAILED`; status inny niż `PENDING`: 422; brak rekordu: 404. |
| `POST /api/v1/notifications/process-ready` | Te same trzy pliki | `processReady()` w kontrolerze → `processReady()` w serwisie → `findReadyIds()` (status `PENDING` i `scheduled_at <= now`), potem dla każdego `findById(id, manager, 'skip')` i `execute()`. Odpowiedź: `{ "processedCount": n }`. |
| Worker cykliczny w tle aplikacji | [notification-worker.ts](../backend/src/features/notifications/notification-worker.ts), [notifications.module.ts](../backend/src/features/notifications/notifications.module.ts) | `NotificationWorker.onApplicationBootstrap()` uruchamia pętlę `setTimeout` co `NOTIFICATION_WORKER_INTERVAL_MS`; `run()` wywołuje `processReady()`. Kolejny przebieg startuje dopiero po zakończeniu poprzedniego. `onModuleDestroy()` zatrzymuje pętlę i czeka na trwający przebieg przed zamknięciem bazy. |
| Brak podwójnej wysyłki | [notifications.service.ts](../backend/src/features/notifications/notifications.service.ts), [notifications.repository.ts](../backend/src/features/notifications/notifications.repository.ts) | Wysyłka odbywa się przy zablokowanym wierszu (`SELECT ... FOR UPDATE`). Worker używa `SKIP LOCKED`, więc pomija rekord obsługiwany właśnie przez `send-now`, i ponownie sprawdza status `PENDING`. |
| Indeks dla zapytania workera | [1790000004000-index-ready-notifications.ts](../backend/src/infrastructure/database/migrations/1790000004000-index-ready-notifications.ts) | Indeks częściowy `notifications_pending_scheduled_idx` na `(scheduled_at, id)` dla `status = 'PENDING'`. |
| Testy integracyjne (POST, GET, send-now, walidacja, process-ready) | [notifications.e2e.test.mjs](../backend/test/notifications.e2e.test.mjs) | 8 testów na osobnej bazie `ztp_test_<UUID>`: lista, POST z konwersją do UTC, 404/400, walidacja (422/400), `send-now` PUSH i EMAIL z odczytem wiadomości z ntfy i MailHog, ponowny `send-now` → 422, `process-ready` wysyła tylko zaległe `PENDING`. Worker jest w tym pliku wyłączony. |

Warto powiedzieć: „Worker robi cyklicznie to samo co `process-ready`. Wysyłka trwa przy zablokowanym wierszu, więc nawet gdy `send-now` i worker trafią na to samo powiadomienie, zostanie ono wysłane tylko raz”.

Podgląd wysłanych wiadomości: MailHog http://localhost:8025, ntfy http://localhost:8088/<topic> (np. `test`).

## Etap 2.3

| Wymaganie | Gdzie pokazać | Konkretna funkcja / element |
| --- | --- | --- |
| Pole `idempotency_key` w modelu | [1790000005000-add-notification-idempotency-key.ts](../backend/src/infrastructure/database/migrations/1790000005000-add-notification-idempotency-key.ts), [notification.entity.ts](../backend/src/features/notifications/notification.entity.ts) | `AddNotificationIdempotencyKey1790000005000.up()` dodaje kolumnę `idempotency_key VARCHAR(255) NOT NULL UNIQUE`; istniejącym rekordom nadaje klucze `notif_<uuid>`. Encja: `Notification.idempotencyKey`. |
| Klucz generowany przez serwer, zwracany w odpowiedzi | [notifications.service.ts](../backend/src/features/notifications/notifications.service.ts), [notification-response.dto.ts](../backend/src/features/notifications/notification-response.dto.ts) | `generateIdempotencyKey()` zwraca `notif_` + 24 losowe bajty (base64url), jak `secrets.token_urlsafe(24)` w instrukcji. `NotificationCreateDto` nie zawiera klucza, a `NotificationResponseDto.idempotencyKey` go zwraca. |
| Ponowienie żądania nie tworzy nowego rekordu | [notifications.controller.ts](../backend/src/features/notifications/notifications.controller.ts), [notifications.service.ts](../backend/src/features/notifications/notifications.service.ts), [idempotency-key.ts](../backend/src/features/notifications/idempotency-key.ts) | Opcjonalny nagłówek `Idempotency-Key`: `create()` w kontrolerze → `create(payload, key)` w serwisie → `findByIdempotencyKey()`. Ten sam klucz i te same dane: 200 z istniejącym powiadomieniem i nagłówkiem `Idempotent-Replayed: true`. Ten sam klucz, inne dane: 409. Niepoprawny klucz: 400. Równoczesne żądania rozstrzyga ograniczenie `UNIQUE` (`replay()` po błędzie 23505). |
| Endpoint `/metrics` w formacie Prometheus | [notifications-metrics.controller.ts](../backend/src/features/notifications/notifications-metrics.controller.ts), [notifications.service.ts](../backend/src/features/notifications/notifications.service.ts), [notifications.repository.ts](../backend/src/features/notifications/notifications.repository.ts), [app.ts](../backend/src/app.ts) | `GET /metrics`, poza prefiksem `/api/v1` (`setGlobalPrefix(..., { exclude: ['metrics'] })`): `NotificationsMetricsController.metrics()` → `NotificationsService.metrics()` → `countByStatusAndChannel()` (jedno zapytanie `GROUP BY status, channel`). Metryki: `notifications_{sent,failed,pending,cancelled}_total` i `notifications_by_channel{status,channel}`, także z zerami. |
| Integracja z Prometheusem | [docker-compose.yml](../docker-compose.yml), [prometheus.yml](../.config/prometheus.yml) | Usługa `prometheus` (http://localhost:9090) z `docker-compose.yml` etapu 2.3; dodano `extra_hosts`, by `host.docker.internal` działał też na Linuksie. `prometheus.yml` z etapu 2.3: scrape co 5 s celu `host.docker.internal:8000`; zmieniona tylko nazwa joba (`nestjs_notifications`). |
| Przykładowe powiadomienia do obserwacji metryk | [seed-notifications.mjs](../backend/scripts/seed-notifications.mjs) | `npm run notifications:seed` tworzy przez API 8 powiadomień: 5 z terminem za 10–35 s (EMAIL i PUSH), 1 PUSH na niepoprawny topic (→ `FAILED`), 1 na za godzinę (`PENDING`), 1 anulowane (`CANCELLED`). Wysyła też jedno żądanie dwa razy z tym samym `Idempotency-Key` (201, potem 200). W ciągu minuty worker zmienia wartości metryk. |

Warto powiedzieć: „Klucz z instrukcji jest generowany po stronie serwera, więc sam nie chroni przed ponowieniem żądania. Dlatego klient może przekazać własny klucz w nagłówku `Idempotency-Key`: to samo żądanie z tym samym kluczem zwraca istniejące powiadomienie, zamiast tworzyć drugie”.

Zapytania do sprawdzenia w Prometheusie (zakładki Table i Graph): `notifications_pending_total`, `notifications_sent_total`, `notifications_cancelled_total`, `notifications_by_channel`, `notifications_by_channel{status="SENT"}`.

## Uruchomienie aplikacji do prezentacji

PowerShell, początkowo katalog główny `ZTP`:

```powershell
cd backend
npm ci
npm run db:up
npm run start:dev
```

`npm run db:up` uruchamia PostgreSQL, MailHog, ntfy i Prometheusa. Migracje wykonują się przy starcie aplikacji, a worker zaczyna działać razem z nią.

| Adres | Zawartość |
| --- | --- |
| http://127.0.0.1:8000/docs | Pełna dokumentacja API |
| http://127.0.0.1:8000/products-docs | Dokumentacja produktów i historii |
| http://127.0.0.1:8000/notifications-docs | Dokumentacja powiadomień |
| http://127.0.0.1:8000/metrics | Metryki w formacie Prometheus |
| http://localhost:8025 | MailHog: wysłane e-maile |
| http://localhost:8088/ztp-demo | ntfy: powiadomienia PUSH z przykładowych danych |
| http://localhost:9090 | Prometheus |

Przykładowe dane do obserwacji metryk, w drugim terminalu w `ZTP/backend`, przy działającej aplikacji:

```powershell
npm run notifications:seed
```

Podgląd tabeli powiadomień, z katalogu głównego `ZTP`:

```powershell
docker compose exec postgres psql -U appuser -d appdb -c "SELECT id, channel, recipient, scheduled_at, timezone, status, idempotency_key FROM notifications ORDER BY id;"
```

## Testy naszej aplikacji — skrypty package.json

Wszystkie poniższe komendy wykonuj w `ZTP/backend`, po `npm ci` i `npm run db:up`.

| Komenda | Zakres |
| --- | --- |
| `npm test` lub `npm run test:all` | Wszystkie testy NestJS: produkty, historia, lifecycle i powiadomienia. |
| `npm run test:notifications` | Testy integracyjne etapu 2.2: POST z konwersją do UTC, GET, 404/400, walidacja, `send-now` PUSH i EMAIL z odczytem wiadomości z ntfy i MailHog, ponowny `send-now` → 422, `process-ready`. |
| `npm run test:products` | CRUD produktów, walidacje, Swagger i CORS. |
| `npm run test:history` | Historia zmian produktów i rollback. |
| `npm run test:lifecycle` | Zamykanie HTTP i puli bazy oraz sygnały systemowe. |
| `npm run test:docker` | Cały zestaw w kontenerze z Linuksem, w sieci `ztp_default` (baza, MailHog i ntfy po nazwach usług). |

Każdy plik testów tworzy własną bazę `ztp_test_<UUID>` i ją usuwa, więc `appdb` pozostaje bez zmian. Testy powiadomień wymagają działających kontenerów MailHog i ntfy. W pliku testów powiadomień worker jest wyłączony, żeby nie konkurował z jawnymi wywołaniami `process-ready`.

## Oryginalne testy Python od prowadzącej

[test_notifications.py](../LABS/LAB2/2.2/tests/test_notifications.py) i [test_students_api.py](../LABS/LAB2/2.2/tests/test_students_api.py) testują **FastAPI i studentów** z kodu prowadzącej, a nie naszą aplikację NestJS. Uruchamiamy je z katalogu `2.2`. W `2.3` plik `main.py` dołącza routery bez prefiksu `/api/v1` (żeby `/metrics` był pod adresem głównym), a testy nadal wywołują `/api/v1/...`, więc tam wszystkie 14 testów kończy się kodem 404. Pliki testów w `2.2` i `2.3` są identyczne.

Dla oryginalnych testów dodany jest osobny [docker-compose.tests.yml](../LABS/LAB2/2.2/docker-compose.tests.yml): baza z SQL-em prowadzącej na porcie **5433**, z danymi w pamięci. MailHog i ntfy pochodzą z naszego `docker-compose.yml` (porty 1025 i 8088, których oczekuje kod prowadzącej), więc najpierw trzeba wykonać `npm run db:up` w `ZTP/backend`.

PowerShell, od katalogu głównego `ZTP`:

```powershell
cd LABS/LAB2/2.2
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r .\requirements.txt
docker compose -p ztp-lab22-tests -f .\docker-compose.tests.yml up -d --wait

$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '5433'

.\.venv\Scripts\python.exe -m pytest -v .\tests
```

Wynik sprawdzony 14.11.2026: 14 passed. Testy `send-now` faktycznie wysyłają wiadomości do MailHog i ntfy.

Po zakończeniu, nadal w `ZTP/LABS/LAB2/2.2`:

```powershell
docker compose -p ztp-lab22-tests -f .\docker-compose.tests.yml down
Remove-Item Env:DB_HOST, Env:DB_PORT
```
