# Security

## Reporting a problem

If you find a security issue, please do not open a public issue. Email michael@guilduk.com with steps to reproduce it. You will get a reply within a week.

## How the app keeps data separate

- **Sign-in:** handled by Kinde. The app never sees or stores passwords.
- **Two checks on every request:** `middleware.js` turns away pages with no session, and every API route checks the session again through `withFamily` or `withFamilyWrite` in `lib/auth.js`.
- **Families are walled off:** every health table has a `family_id` column that cannot be empty. Every query filters by the signed-in person's family and, for personal data, by their own user id. The family id comes from the server's own lookup of the session, never from the browser.
- **Looking at a relative's week:** `?viewing=` is only honoured when that person is in the same family, and only for the sections they have chosen to share. Anything else quietly falls back to your own data. Writes always use your own id.
- **Exercise library:** starter exercises are shared and read-only. Exercises a family adds belong to that family, and only that family can see, change or delete them.
- **Journal:** private to its author. It is never shown to the family.
- **Secrets:** kept in the host's environment settings only. `.env.example` holds placeholders.

## Planned

A Next.js 15 upgrade, security headers (Content Security Policy, HSTS and others), automated tests for the family checks, and a Cloudflare review are part of the final hardening step in [docs/DESIGN.md](./docs/DESIGN.md).
