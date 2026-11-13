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
