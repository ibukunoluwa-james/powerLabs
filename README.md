# Task Management Application

A small task manager built for the Software Engineering Internship practical assessment.

- **Backend** — Express 5 + TypeScript REST API, Prisma ORM, SQLite.
- **Frontend** — Next.js (App Router) + TypeScript + Tailwind CSS.

A user can create a task, view the list of tasks, view an individual task, update a task and
delete a task. Tasks are persisted in a database, and invalid input and common errors return
structured JSON errors with appropriate HTTP status codes.

---

## Table of contents

1. [Requirements](#requirements)
2. [Quick start](#quick-start)
3. [Configuration](#configuration)
4. [Project structure](#project-structure)
5. [API reference](#api-reference)
6. [Error handling](#error-handling)
7. [Tests](#tests)
8. [Technical decisions](#technical-decisions)
9. [Assumptions](#assumptions)
10. [Not implemented / known limitations](#not-implemented--known-limitations)

---

## Requirements

- **Node.js 20 or newer** (developed on Node 24)
- **npm 10 or newer**

No database server is needed — SQLite runs as a file in the `backend/prisma` directory.

---

## Quick start

The backend and the frontend are two separate applications and each needs its own terminal.

### 1. Backend (http://localhost:4000)

```bash
cd backend
cp .env.example .env         # Windows PowerShell: copy .env.example .env
npm install
npm run prisma:migrate       # creates prisma/dev.db and applies the schema
npm run db:seed              # optional: inserts 5 sample tasks
npm run dev
```

The API is now at `http://localhost:4000`. Check it with:

```bash
curl http://localhost:4000/health
```

### 2. Frontend (http://localhost:3000)

```bash
cd frontend
cp .env.example .env.local   # Windows PowerShell: copy .env.example .env.local
npm install
npm run dev
```

Open <http://localhost:3000>.

> Start the backend first. The frontend calls it directly from the browser, so if the API is
> down the UI shows a "cannot reach the API" message rather than an empty list.

### Production build

```bash
# backend
cd backend && npm run build && npm run prisma:deploy && npm start

# frontend
cd frontend && npm run build && npm start
```

---

## Configuration

### `backend/.env`

| Variable       | Default                  | Description                                                        |
| -------------- | ------------------------ | ------------------------------------------------------------------ |
| `PORT`         | `4000`                   | Port the API listens on.                                            |
| `NODE_ENV`     | `development`            | `development` \| `test` \| `production`.                            |
| `DATABASE_URL` | `file:./dev.db`          | Prisma connection string. Relative paths resolve from `prisma/`.    |
| `CORS_ORIGIN`  | `http://localhost:3000`  | Comma-separated list of browser origins allowed to call the API.    |

Environment variables are validated with Zod at boot — a missing or malformed value stops the
process with a readable message instead of failing later inside a request.

### `frontend/.env.local`

| Variable                  | Default                     | Description                            |
| ------------------------- | --------------------------- | -------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL`| `http://localhost:4000`     | Base URL of the Express API.           |

---

## Project structure

```
PowerLabs/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Task model
│   │   ├── migrations/            # generated SQL migrations
│   │   └── seed.ts                # sample data
│   ├── src/
│   │   ├── config/env.ts          # validated environment configuration
│   │   ├── lib/prisma.ts          # shared PrismaClient
│   │   ├── middleware/
│   │   │   ├── errorHandler.ts    # single place that maps errors to responses
│   │   │   ├── notFound.ts
│   │   │   └── validate.ts        # Zod request validation
│   │   ├── modules/tasks/
│   │   │   ├── task.schema.ts     # request schemas + status enum
│   │   │   ├── task.service.ts    # database access & business rules
│   │   │   ├── task.controller.ts # HTTP in / HTTP out
│   │   │   └── task.routes.ts     # route table
│   │   ├── utils/
│   │   ├── app.ts                 # builds the Express app (used by tests too)
│   │   └── server.ts              # listens, handles shutdown
│   └── tests/
│       ├── tasks.test.ts          # API integration tests (real HTTP + real DB)
│       └── unit/                  # error handler, env validation, Zod formatting
└── frontend/
    ├── app/
    │   ├── layout.tsx             # shell + header
    │   ├── page.tsx               # task list: search, filter, sort, paging
    │   ├── tasks/new/page.tsx     # create
    │   └── tasks/[id]/            # detail (+ /edit)
    ├── components/
    │   ├── TaskForm.tsx           # shared create/edit form
    │   ├── TaskListItem.tsx       # row + inline actions
    │   └── ui.tsx                 # badges, spinner, error/empty states
    ├── lib/
    │   ├── api.ts                 # typed API client + error mapping
    │   ├── dates.ts               # UTC <-> local conversion
    │   ├── types.ts               # API contract types
    │   └── useTask.ts             # loads a single task (detail + edit)
    └── tests/                     # unit tests for api.ts and dates.ts
```

---

## API reference

Base URL: `http://localhost:4000`

Every successful response wraps the payload in `data`. List responses add `pagination`.

### The task object

```json
{
  "id": "0b8b2b1e-1c3f-4a9b-9a6a-91f0c5f9f1a2",
  "title": "Write the README",
  "description": "Setup instructions and the decisions log.",
  "status": "IN_PROGRESS",
  "dueDate": "2026-10-01T09:00:00.000Z",
  "createdAt": "2026-09-16T12:00:00.000Z",
  "updatedAt": "2026-09-16T12:30:00.000Z",
  "isOverdue": false
}
```

`status` is one of `TODO`, `IN_PROGRESS`, `DONE`.
`description` and `dueDate` are nullable. `isOverdue` is derived server-side (`dueDate` in the
past and `status` is not `DONE`).

### Endpoints

| Method   | Path              | Description                              | Success |
| -------- | ----------------- | ---------------------------------------- | ------- |
| `GET`    | `/health`         | Liveness probe.                           | 200     |
| `GET`    | `/api/tasks`      | List tasks (filter, search, sort, page).  | 200     |
| `POST`   | `/api/tasks`      | Create a task.                            | 201     |
| `GET`    | `/api/tasks/:id`  | Fetch one task.                           | 200     |
| `PATCH`  | `/api/tasks/:id`  | Partially update a task.                  | 200     |
| `PUT`    | `/api/tasks/:id`  | Alias of `PATCH`.                         | 200     |
| `DELETE` | `/api/tasks/:id`  | Delete a task.                            | 204     |
| `GET`    | `/api/tasks/meta` | Allowed status values (used by the UI).   | 200     |

### `GET /api/tasks` query parameters

| Parameter | Type   | Default     | Notes                                                             |
| --------- | ------ | ----------- | ----------------------------------------------------------------- |
| `status`  | enum   | —           | `TODO` \| `IN_PROGRESS` \| `DONE`.                                 |
| `search`  | string | —           | Case-insensitive substring match on title **and** description.     |
| `sortBy`  | enum   | `createdAt` | `createdAt` \| `updatedAt` \| `dueDate` \| `title` \| `status`.    |
| `order`   | enum   | `desc`      | `asc` \| `desc`.                                                   |
| `page`    | number | `1`         | 1-based.                                                           |
| `limit`   | number | `20`        | 1–100.                                                             |

```jsonc
// GET /api/tasks?status=TODO&sortBy=dueDate&order=asc&page=1&limit=20
{
  "data": [ /* task objects */ ],
  "pagination": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
}
```

### Examples

```bash
# Create
curl -X POST http://localhost:4000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Buy milk","description":"Semi-skimmed","dueDate":"2026-10-01T09:00:00.000Z"}'

# List the open tasks, soonest due first
curl "http://localhost:4000/api/tasks?status=TODO&sortBy=dueDate&order=asc"

# Read one
curl http://localhost:4000/api/tasks/<id>

# Mark it done
curl -X PATCH http://localhost:4000/api/tasks/<id> \
  -H "Content-Type: application/json" -d '{"status":"DONE"}'

# Clear the due date (null is a meaningful value, not "unchanged")
curl -X PATCH http://localhost:4000/api/tasks/<id> \
  -H "Content-Type: application/json" -d '{"dueDate":null}'

# Delete
curl -X DELETE http://localhost:4000/api/tasks/<id>
```

---

## Error handling

Errors share one shape, produced by a single Express error middleware:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [{ "field": "body.title", "message": "Title is required" }]
  }
}
```

| Status | Code                    | When                                                             |
| ------ | ----------------------- | ---------------------------------------------------------------- |
| 400    | `INVALID_JSON`          | Body is not parseable JSON.                                       |
| 403    | `CORS_FORBIDDEN`        | Request came from an origin that is not in `CORS_ORIGIN`.         |
| 404    | `NOT_FOUND`             | Unknown task id, or unmatched route.                              |
| 409    | `CONFLICT`              | Unique-constraint violation (Prisma `P2002`).                     |
| 413    | `PAYLOAD_TOO_LARGE`     | Body exceeded the 100 kB cap.                                     |
| 422    | `VALIDATION_ERROR`      | Body/query/params failed schema validation.                       |
| 500    | `INTERNAL_SERVER_ERROR` | Unexpected failure. Logged with a stack; not leaked to the client.|
| 503    | `DATABASE_UNAVAILABLE`  | Prisma could not reach the database.                              |

Validation covers: required and blank titles, length limits (title ≤ 200, description ≤ 2000),
unknown status values, unparseable dates, unknown/extra body fields, malformed UUIDs,
out-of-range pagination values, and empty update bodies.

---

## Tests

```bash
cd backend  && npm test          # 65 tests: API integration + unit
cd backend  && npm run test:coverage
cd frontend && npm test          # 40 tests: API client + date helpers
```

**105 tests total across both packages, 89% statement / 90% branch coverage.**

*Integration* (`backend/tests/tasks.test.ts`, 37 tests) drives the real Express app over HTTP
against a separate SQLite file (`prisma/test.db`), reset before the run and cleared between
tests. It covers the five required operations end to end plus validation, 404s, malformed JSON,
pagination bounds, oversized bodies and CORS.

*Unit* (`backend/tests/unit/`, 28 tests) covers the paths that are impractical to provoke over
HTTP: the error middleware's `P2002` → 409, Prisma-init → 503 and generic-500 branches (plus a
check that internal error text never reaches the client), environment validation, and the Zod
issue formatter.

*Frontend* (`frontend/tests/`, 40 tests) covers the two pieces of framework-independent logic:
the API client's error mapping (`body.title` → `title` field errors, network failure, 204
handling) and the UTC↔local date conversion. The date tests assert timezone-*independent*
properties — round trips and formats rather than hard-coded local strings — because Node on
Windows ignores the `TZ` variable, so exact-string assertions would pass on one machine and fail
on another.

Both suites were mutation-checked: injecting a UTC-vs-local getter bug into `dates.ts` fails 7
tests, and changing the `P2002` status from 409 to 400 fails its test.

**Not covered by the automated suites, deliberately:** `server.ts` (process wiring — `listen`
and the signal handlers) and React component rendering. See
[limitations](#not-implemented--known-limitations).

**Browser end-to-end.** Both apps were also driven through headless Chrome — against the dev
servers and again against the production builds (`npm start`) — covering all five required
operations through the UI plus search, filtering, sorting, pagination, the inline actions and
the delete confirmation, the not-found/404/validation states, and the backend-unreachable and
recovery paths. Two defects that only appear in a real browser were found and fixed that way
(see the note under [limitations](#not-implemented--known-limitations)). Those runs used a
throwaway CDP harness rather than a committed suite; Playwright is the productionised version.

---

## Technical decisions

**Express + TypeScript for the API, Next.js for the UI.** The brief asks for a working,
understandable solution, so the API is a plain layered Express app — routes → validation →
controller → service → Prisma. Each layer has one job, which keeps the request path easy to
follow and the service layer testable independently of HTTP.

**SQLite via Prisma.** It satisfies "persisted using a database" with zero setup for whoever
reviews this — clone, `npm install`, migrate, run. Prisma gives type-safe queries generated from
the schema, real migrations, and a one-line path to PostgreSQL later (change the `provider` and
the `DATABASE_URL`, then re-run the migration). The trade-off is that SQLite is single-writer
and has no native enum, which is why `status` is a validated string.

**Zod at the boundary.** Every request part (body, query, params) is parsed by a schema, and the
*parsed* value is what the controller reads — so dates arrive as `Date`, pagination as `number`,
and unknown fields are rejected rather than silently ignored. The same library validates the
environment at boot. Types are inferred from the schemas, so validation and the TypeScript types
cannot drift apart.

**One error middleware.** Controllers never build error responses; they throw (`ApiError`, Zod
errors) and one handler maps everything — including Prisma's `P2025`/`P2002` codes and
body-parser's `SyntaxError` — onto a consistent JSON shape. Unexpected errors log their stack
server-side and return a generic 500 so internals are not leaked.

**PATCH for updates, with PUT aliased to it.** Partial updates are what a task UI actually
needs (toggling a status shouldn't require resending the whole object). Only keys present in the
request are written, and `null` is treated as an explicit "clear this field" rather than as
"unchanged" — the difference between `undefined` and `null` is load-bearing in the service.

**`isOverdue` computed on the server.** Derived state lives in one place so the list, the detail
view and any future client agree.

**Frontend talks to Express directly.** The browser calls `http://localhost:4000` with CORS
restricted to the frontend origin. This keeps the Express API unambiguously the backend rather
than hiding it behind Next.js route handlers, which matters for a review.

**Stable sort tiebreaker.** List queries order by the requested column *and* `id`, so paging
cannot repeat or skip rows when several tasks share a sort value.

---

## Assumptions

- **Single user, no authentication.** The brief describes "a user" managing tasks and says
  nothing about accounts, so there is no auth, no ownership column and no per-user filtering.
  Adding one would mean a `User` model and a `userId` foreign key on `Task`.
- **Past due dates are allowed.** Rejecting them would make it impossible to edit a task that is
  already overdue, or to record something retrospectively.
- **Dates are stored and returned in UTC as ISO 8601 strings.** The form takes the due date in
  the user's own timezone and converts to UTC before sending; the UI converts back when
  displaying. All conversion lives in `frontend/lib/dates.ts`.
- **The time of day is optional, and a date without one is due at the end of that day** (23:59
  local). Midnight would make a task created for today instantly overdue. The due date is two
  controls — a date and an optional time — rather than one `datetime-local`; see the note in
  [limitations](#not-implemented--known-limitations) for why.
- **Deletes are permanent.** No soft-delete/archive, since nothing in the brief needs it.
- **Three statuses** (`TODO`, `IN_PROGRESS`, `DONE`) — enough to make the field meaningful
  without inventing a workflow.
- **Pagination defaults to 20 per page**, and the UI pages through the same endpoint.

---

## Not implemented / known limitations

These were deliberate scope calls for a 24–48 hour exercise, not oversights:

- **No authentication or multi-user support** (see assumptions above).
- **No committed component or end-to-end tests.** The frontend's framework-independent logic
  (API client, date conversion) is unit-tested, but React rendering is not, and the browser
  end-to-end pass described under [Tests](#tests) was driven by a throwaway harness rather than
  a suite in the repository. Porting those 27 checks to Playwright is the highest-value next
  addition; it would also cover `server.ts`, the only backend file with no coverage.

  That pass did earn its keep, though — it caught defects that neither unit nor API tests could
  see: the task list kept its subtitle on "Loading…" underneath the error notice when a load
  failed, and the create/edit form could be submitted *natively* before React hydrated, which
  reloaded the page, discarded what the user had typed and put the field values in the URL.
  Both are fixed (the submit button is now inert until hydration, via `useSyncExternalStore` in
  `TaskForm.tsx`), and the second is covered by an assertion on the server-rendered HTML.

  A third slipped past that pass and was caught in real use: the due date was a single
  `<input type="datetime-local">`, which reports an **empty** value until *both* the date and the
  time are filled in. Entering a date and leaving the time as `--:--` therefore saved no due date
  at all, with no error — the input was silently discarded. It is now a date input plus an
  optional time input (`combineDateAndTime` in `dates.ts`), a date on its own is due at the end
  of that day, and a time without a date is reported rather than dropped. The E2E run had missed
  it because it set the field programmatically with a complete value, which is precisely the case
  that worked; the regression test now enters a date and no time.
- **No Docker setup.** SQLite makes it unnecessary to run anything extra locally.
- **No rate limiting or request-id/structured logging.** `helmet`, a CORS allow-list and a 100 kB
  body cap are in place (an oversized body returns 413, not a 500); the rest is production
  hardening beyond this exercise.
- **On Windows, stop the API before running `npm run build`.** A running server keeps the Prisma
  query-engine DLL open, so `prisma generate` fails to replace it with `EPERM`. It is a file-lock
  quirk of the platform rather than a problem with the build.
- **Optimistic UI updates are not reconciled with a background refetch** — after a mutation the
  affected view refetches rather than patching a client-side cache.
- **Tasks with no due date sort first when sorting by due date ascending.** Prisma's
  `nulls: 'last'` ordering is not supported on SQLite, so the database's default (NULLs first)
  applies. It would be fixed by the move to PostgreSQL.
- **Delete uses the browser's native `confirm()`** rather than an accessible modal dialog.
