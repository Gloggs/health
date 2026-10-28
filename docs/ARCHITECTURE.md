# Architecture

## The pieces

| Part | Tool | Notes |
| --- | --- | --- |
| Pages and API | Next.js 14, App Router | Pages are mostly client components, API routes run as Vercel functions |
| Sign-in | Kinde | Hosted sign-in. The app stores the Kinde user id, never a password |
| Database | Neon Postgres | Reached over HTTP with the Neon serverless driver |
| Queries and schema | Drizzle ORM | Schema in `utils/schema.jsx`, versioned migrations in `drizzle/` |
| Data on the page | SWR | Caches responses and updates the screen straight away when you log something |
| Email (optional) | Resend | Invites. Without a key, the app shows a link to copy instead |

## Families

Everything belongs to a family. `families` holds the family, `memberships` links people to it, and every health table carries `family_id` and `user_id`. Invites (`invites`) create a membership when accepted at `/join/<token>`.

Each person's sharing choices live in `users.visibility` (see `lib/visibility.js`). The streak, the number of workouts this week and Daily 4 totals are always shared. Everything else can be hidden, and the journal is always private.

## A request, start to finish

1. `middleware.js` checks the Kinde session for `/dashboard` and `/onboarding`, and sends people without a family to onboarding.
2. The page calls an API route through `app/_services/GlobalApi.js`.
3. The route is wrapped in `withFamily` (read) or `withFamilyWrite` (write) from `lib/auth.js`. These check the session again and work out `{ userId, familyId, viewingId, vieweeVisibility }` on the server.
4. Every query includes `familyFilter(table, familyId)` and a user filter.
5. `/api/dashboard` gathers everything the Today screen needs in one trip, rather than many small requests.

## Where things live

```
app/
  api/                 One folder per resource (sleep, water, sessions, family, invites ...)
  dashboard/           The signed-in app: Today, Log, Train, Trends, Family, settings
  demo/                The same pages running on sample data, with no network calls
  onboarding/          First-run steps
  join/[token]/        Accepting an invite
lib/
  auth.js              Session and family checks used by every API route
  exercises.js         Which exercises a family may use
  visibility.js        Sharing settings
  streak.js            What counts towards the streak
  format.js            One place for how numbers, times and amounts are shown
utils/
  schema.jsx           Every table
  dbConfig.jsx         Database connection
drizzle/               Migrations, applied in order with npm run db:migrate
```

## The demo

`/demo` reuses the real pages. `app/demo/_mock/MockProvider.jsx` swaps the network layer for an in-memory store (`app/demo/_mock/store.js`), so visitors can tap through everything without an account and nothing is saved.
