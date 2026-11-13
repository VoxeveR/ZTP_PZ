# ZTP

Student project for the ZTP course. For each lab the teacher provides a reference solution in Python/FastAPI
("wirtualny dziekanat", students domain) in `LABS/LAB<N>/` (git-ignored). This repo re-implements the same
requirements in NestJS for a products domain, so match the requirements in spirit and don't port the Python code line by line.
Reuse Docker files the teacher provides (Dockerfiles, docker-compose files) instead of writing your own, and adapt
them to this project as needed. For any other teacher file (SQL, seed data, configs, ...), ask before reusing it.
To solve a whole lab, use the `/lab <N>` skill.

## Layout
- `backend/`: NestJS API (its own `package.json`, `Dockerfile`, `src/`, `test/`)
- `docker-compose.yml`: shared services for the whole stack (PostgreSQL now, a frontend later)
- `docs/`: per-lab acceptance criteria (`LAB_<N>_ACCEPTANCE_CRITERIA.md`) and reports (`reports/`)
- `LABS/`: teacher materials, local only

## Commands (run in `backend/`)
- Services first: `npm run db:up` (Postgres, MailHog, ntfy via `../docker-compose.yml`, network `ztp_default`);
  `npm run db:down` to stop
- Test: `npm test` (builds first; tests import from `dist/`)
- Single file: `npm run test:products` / `test:history` / `test:lifecycle` / `test:notifications`
- Container tests: `npm run test:docker` (needs `db:up`)
- Always run `npm run typecheck` and `npm run lint` after changes (`npm run lint:fix` fixes formatting)

## Hooks
- Git pre-commit (husky, `.husky/pre-commit`): `npm run lint` in `backend/`. Root `npm install` sets it up.
- Claude PreToolUse (`.claude/hooks/test-before-push.mjs`): before a `git push` to `main`/`master`, runs lint,
  typecheck and tests in `backend/` and blocks the push if any fail. Keep the DB up (`npm run db:up`) before pushing.

## Backend architecture: vertical slicing
- Each feature lives in `backend/src/features/<feature>/` and owns its full slice: controller, service, repository,
  entity, DTOs, errors, exception filter, `*.openapi.ts` decorators and module.
- Feature models (entities, request/response DTOs, snapshots) stay in their feature folder. A model used only by
  one feature belongs to it, e.g. `forbidden-product-name.entity.ts` lives in `products`.
- A model shared between features gets its own feature (`categories`) and is exported through its module. It is not moved to a shared folder.
- Cross-cutting code that is not a domain model goes in `backend/src/infrastructure/` (database, migrations, HTTP pipes,
  lifecycle, OpenAPI). Env config goes in `backend/src/config/`.
- Layers inside a slice: controller (HTTP only) → service (business rules, validation, transactions) → repository (TypeORM).

## Conventions
- New tables and columns need a new migration in `backend/src/infrastructure/database/migrations/`
  (timestamp-prefixed, registered in `database.module.ts`). `synchronize` is off.
- A product write and its history entry go in one transaction (`repository.transaction(...)`).
- Domain errors are thrown by the service and mapped in the feature's exception filter: validation 422,
  conflict 409, missing related entity 400, not found 404. Malformed body or missing fields: 400.
- All routes go under the `api/v1` prefix and need Swagger decorators.
- Add tests only when the lab instruction asks for them. When it does, put them in `backend/test/*.e2e.test.mjs`
  and use `prepareTestDatabase()`. Existing tests must always keep passing.
- Code and identifiers are in English. Acceptance criteria and reports are in Polish.

## Gotchas
- Tests create a random `ztp_test_*` DB per file and drop it, so never point them at `appdb`
- 2 lifecycle tests skip on Windows (POSIX signals) and run only in Docker
- `reject_history_write` errors in test logs are intentional (rollback test)
- Notification tests really deliver through MailHog and ntfy, so those containers must be up
- Config is read once per process: a second `createApplication()` in the same process ignores changed env vars

## Don't
- Commit `.env`
- Edit finished reports in `docs/reports/` unless asked
