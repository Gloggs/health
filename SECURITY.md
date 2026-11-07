# Security

## Reporting a problem

If you find a security issue, please do not open a public issue. Email michael@guilduk.com with steps to reproduce it. You will get a reply within a week.

## How the app keeps data private

health is a personal app: only the person who wrote something can see it. [docs/PRIVACY.md](./docs/PRIVACY.md) covers the data protection side in full.

- **Sign-in:** handled by Kinde. The app never sees or stores passwords.
- **Two checks on every request:** `middleware.js` turns away pages with no session, and every API route checks the session again through `withFamily` or `withFamilyWrite` in `lib/auth.js`.
- **One person per space:** every health table has a `family_id` column that cannot be empty. Each account gets its own private space, and every query filters by that space and by the person's own user id. Both come from the server's own lookup of the session, never from the browser.
- **No sharing:** family sharing is switched off in `lib/features.js`. The family routes return 404 and the `?viewing=` parameter is ignored. The family code is still in the repository and still tested, with sharing switched on, in `tests/privacy/privacy.test.mjs`.
- **Encrypted words:** free-text fields are encrypted with AES-256-GCM before they reach the database (`lib/crypt.js`). The key, `HEALTH_DATA_KEY`, is kept in the host's settings. Without it, the app refuses to save or read words rather than storing them unprotected.
- **Errors:** database and library errors reach the browser only as "Something went wrong" (`safeMessage` in `lib/auth.js`), and log lines carry no personal data.
- **Secrets:** kept in the host's environment settings only. `.env.example` holds placeholders, and `.gitignore` keeps every other `.env` file out of git.

## Tests

`npm run test:privacy` runs the real route handlers against a real Postgres on every pull request, as several pretend people, and fails if anyone can read someone else's entries, if the database holds readable words, or if "Delete everything" leaves anything behind. See [docs/TESTING.md](./docs/TESTING.md).

## Planned

A Next.js 15 upgrade, security headers (Content Security Policy, HSTS and others), and removing the switched-off family code.
