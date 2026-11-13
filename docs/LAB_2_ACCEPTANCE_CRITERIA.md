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
