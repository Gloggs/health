# Contributing

This is a personal project, but issues and suggestions are welcome.

- Open an issue before a large change, so we can agree the approach first.
- Keep each pull request to one feature.
- Schema changes need a migration: edit `utils/schema.jsx`, then run `npm run db:generate -- --name <short-name>` and commit the new file in `drizzle/`.
- Every API route that touches health data must use `withFamily` or `withFamilyWrite`, and every query must include `familyFilter` and a user filter. See [SECURITY.md](./SECURITY.md).
- Follow [docs/DESIGN.md](./docs/DESIGN.md) for look and wording.
- Never commit secrets or real people's data.
