# Testing

## Unit tests (`npm test`)

Pure logic (usuals, dates) with Node's own test runner.

## Privacy tests (`npm run test:privacy`)

The privacy promise, tested: **nobody sees another person's details unless that person chose to share them.**

They call the app's real API route handlers (Vitest), against a real Postgres, as several pretend signed-in people:

| Person | Who they are |
| --- | --- |
| A | Writes private things: sleep, mood, meals, weight, cardio, a journal, a training day, each with a unique marker |
| A2 | In A's family |
| B | A stranger in another family |
| U | Signed in, but has not confirmed their email |

| Test | What it proves |
| --- | --- |
| A stranger sees nothing | B asks 16 routes for A's data, directly and with `?viewing=A`, and none of A's markers or weight comes back |
| Training days stay private | B points a session at A's training day; its name never comes back |
| Private by default | With no choices made, A2 sees none of A's health data, streak or activity |
| Numbers, never notes | With everything switched on, A2 sees the numbers but never a note, tag or description |
| The journal is never shared | Whatever the switches say |
| Confirmed email | U cannot start a family (or accept an invite) |
| Invite limit | A family cannot send more than 10 invites a day |
| Your own family only | Recording a profile view for someone outside your family fails |
| Safe errors | Database errors never reach the browser as raw text |

### How the database works in tests

The app talks to Neon over HTTP. The tests use a throwaway Postgres instead, with `scripts/neon-local.mjs` standing in for Neon's SQL endpoint (the same approach as the here app). The app only uses it when `NEON_LOCAL_SQL_URL` is set, which production never does. Sign-in (Kinde) is replaced in the tests by `tests/privacy/setup.mjs`, which only chooses who is signed in; every other line is the real code.

### Run them on your computer

1. A throwaway Postgres on port 6543, for example `docker run -d -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=health_test -p 6543:5432 postgres:17`
2. `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:6543/health_test npx drizzle-kit push --force`
3. `npm run test:privacy`

In GitHub Actions the same runs against a Postgres service (`.github/workflows/ci.yml`).
