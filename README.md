# ZTP_PZ – Products API

A REST API for managing products: create, read, update and delete, with input validation, categories and a transactional change history. Built for the ZTP course.

**Stack:** Node.js 22+ · TypeScript · NestJS · TypeORM · PostgreSQL · Swagger (OpenAPI) · Docker

- API: `http://127.0.0.1:8000/api/v1/products`
- Swagger UI: `http://127.0.0.1:8000/docs`

---

## 1. Setup

```bash
npm install
cp .env.example .env
```

## 2. Database (PostgreSQL)

The app and the tests both need PostgreSQL. It runs from `docker-compose.yml` on the `ztp_default` network. Database migrations run automatically when the app starts.

```bash
npm run db:up      # start PostgreSQL and wait until it's healthy
npm run db:down    # stop it (data stays in the ztp_pgdata volume)
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

**Locally** (needs PostgreSQL from step 2):

```bash
npm test                 # all tests
npm run test:products    # products CRUD
npm run test:history     # product history
npm run test:lifecycle   # app lifecycle
npm run typecheck        # TypeScript check
```

**In a container:**

```bash
npm run test:docker      # builds the test image and runs it on the ztp_default network
```
