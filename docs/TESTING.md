# Testing

## Unit tests (`npm test`)

Pure logic with Node's own test runner: usuals and dates, the GP summary builder (`lib/summary.js`: grouping, the period, what helps or worsens, sleep and mood on those days, the person's own lines, and a check that it adds no judgement words), and the FHIR export (`lib/fhir.js`: one Patient with only the chosen name, the person's words kept as text, checked LOINC codes for sleep and weight, UK Core profile on every Observation).

## Privacy tests (`npm run test:privacy`)

The privacy promise, tested: **nobody sees another person's details.** `standalone.test.mjs` and `account.test.mjs` test the app as it runs, with family sharing off. `privacy.test.mjs` switches sharing back on and keeps proving the family code never leaks, until that code is removed.

They call the app's real API route handlers (Vitest), against a real Postgres, as several pretend signed-in people:

| Person | Who they are |
| --- | --- |
| A | Writes private things: sleep, mood, meals, weight, cardio, a journal, a training day, each with a unique marker |
| A2 | In A's family |
| B | A stranger in another family |
| U | Signed in, but has not confirmed their email |
| N | New, and has not yet agreed to how health stores health information |

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
| How I feel, the summary, the appointment and the FHIR export | Private always: nobody but the person can get them, not even family, not by asking for them by name |
| A personal app | With family sharing off, someone in the same old family cannot view another person even with everything switched on; the family pages and routes return 404 or go back to Today; a new person gets a private space without naming a family (`standalone.test.mjs`) |
| Words encrypted | The database itself, read directly, holds only `enc:v1:` values for how you feel, the journal and the GP appointment; the person still reads their words, the summary and journal search still work, and Download everything has them readable (`standalone.test.mjs`) |
| Delete everything | Every row that mentions the person or their space is gone afterwards, nobody else's rows change, and every table with a `user_id` column is on the delete list (`account.test.mjs`) |
| Agreement first | Until the person agrees to how health stores their health information, nothing can be saved and no family started; once they agree, it works |

### How the database works in tests

The app talks to Neon over HTTP. The tests use a throwaway Postgres instead, with `scripts/neon-local.mjs` standing in for Neon's SQL endpoint (the same approach as the here app). The app only uses it when `NEON_LOCAL_SQL_URL` is set, which production never does. Sign-in (Kinde) is replaced in the tests by `tests/privacy/setup.mjs`, which only chooses who is signed in; every other line is the real code.

### Run them on your computer

1. A throwaway Postgres on port 6543, for example `docker run -d -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=health_test -p 6543:5432 postgres:17`
2. `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:6543/health_test npx drizzle-kit push --force`
3. `npm run test:privacy`

In GitHub Actions the same runs against a Postgres service (`.github/workflows/ci.yml`).


## Browser tests (`npm run test:e2e`)

Playwright runs the front page and the demo at phone (390px) and laptop (1280px) sizes. The demo uses sample data in the browser, so no database or sign-in is needed.

| Test | What it proves |
| --- | --- |
| The front page | Says the job, shows the sample summary and what health is not, and leads to the demo |
| The guide | Shows once, stays away after a reload, and opens again from Settings |
| The job end to end | Write down how you feel, find it on the page for the GP, download the PDF and the FHIR file (a Bundle containing the entry) |
| Accessibility, light and dark | axe finds no serious or critical WCAG 2.2 AA problems on the front page, Today, How I feel, For my GP, More and Settings, and nothing scrolls sideways |

Run them: `npm run build`, `npx playwright install chromium`, then `npm run test:e2e`. GitHub Actions runs all three kinds of test on every pull request.

## Not covered automatically

Signing in with Kinde, the real onboarding screens (they need a real sign-in), printing on paper, and real phones. These are checked by hand.
