# ZTP_PZ

Projects for the ZTP course. Currently a REST API for managing products (create, read, update and delete, with input validation, categories and a transactional change history) and for scheduled notifications, which a background worker sends by e-mail or push. A frontend will be added later.

**Stack:** Node.js 22+ · TypeScript · NestJS · TypeORM · PostgreSQL · Swagger (OpenAPI) · Docker

```
backend/             NestJS API
docker-compose.yml   PostgreSQL, MailHog and ntfy (shared by the whole stack)
docs/                acceptance criteria and lab reports
```

- API: `http://127.0.0.1:8000/api/v1/products`, `http://127.0.0.1:8000/api/v1/notifications`
- Swagger UI: `/docs` (everything), `/products-docs`, `/notifications-docs`
- Sent notifications: MailHog `http://localhost:8025`, ntfy `http://localhost:8088/<topic>`

---

All commands below are run in `backend/`, except the first `npm install`.

## 1. Setup

```bash
npm install              # in the repo root: installs the husky git hooks
cd backend
npm install
cp .env.example .env
```

The pre-commit hook runs `npm run lint` in `backend/` and blocks the commit if it fails.

## Lint and format

ESLint (typescript-eslint, NestJS defaults) with Prettier.

```bash
npm run lint             # check
npm run lint:fix         # fix what can be fixed automatically
npm run format           # Prettier only
```

## 2. Services (PostgreSQL, MailHog, ntfy)

The app and the tests need PostgreSQL, plus MailHog (e-mail) and ntfy (push) for sending notifications. They run from the top-level `docker-compose.yml` on the `ztp_default` network. Database migrations run automatically when the app starts.

```bash
npm run db:up      # start all services and wait until they're ready
npm run db:down    # stop them (data stays in the ztp_pgdata volume)
```

## 3. Run locally

```bash
npm run start:dev                     # dev mode with watch
npm run build && npm run start:prod   # production build
```

## 4. Run in containers

```bash
docker build --target production -t ztp-products-api .
docker run --rm -p 8000:8000 --network ztp_default -e DB_HOST=postgres ztp-products-api
```

## 5. Tests

The tests are end-to-end tests that use `node --test`. Each test file creates its own temporary database and drops it afterwards.

**Locally** (needs the services from step 2):

```bash
npm test                    # all tests
npm run test:products       # products CRUD
npm run test:history        # product history
npm run test:lifecycle      # app lifecycle
npm run test:notifications  # notifications: POST, GET, send-now, validation, process-ready
npm run typecheck        # TypeScript check
```

**In a container:**

```bash
npm run test:docker      # builds the test image and runs it on the ztp_default network
```
