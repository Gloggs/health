# Architecture

## The pieces

| Part | Tool | Notes |
| --- | --- | --- |
| Pages and API | Next.js 14, App Router | Pages are mostly client components, API routes run as Vercel functions |
| Sign-in | Kinde | Hosted sign-in. The app stores the Kinde user id, never a password |
| Database | Neon Postgres | Reached over HTTP with the Neon serverless driver |
| Queries and schema | Drizzle ORM | Schema in `utils/schema.jsx`, versioned migrations in `drizzle/` |
| Data on the page | SWR | Caches responses and updates the screen straight away when you log something |
| Encryption | @noble/ciphers | AES-256-GCM for people's words, in `lib/crypt.js`, applied by Drizzle column types |
| Email (optional) | Resend | Only for family invites, which are switched off |

## One person, one private space

health started as a family app, so every health table carries `family_id` as well as `user_id`, and `families` and `memberships` link people to a space. Family sharing is now switched off (`lib/features.js`): each account gets a private space of its own after the health data agreement, and the family pages, chat, invites and viewing another person are blocked in `middleware.js`. The family model will be removed in a later change.

## People's words are encrypted

Columns declared with `encryptedText` in `utils/schema.jsx` are encrypted on the way into the database and decrypted on the way out (`lib/crypt.js`). Postgres sees plain `text` columns holding `enc:v1:...` values, so SQL cannot search or sort them: the journal search reads the person's entries and searches them after decryption.

## A request, start to finish

1. `middleware.js` checks the Kinde session for `/dashboard` and `/onboarding`, and sends people without a private space, a name or the health data agreement to onboarding.
2. The page calls an API route through `app/_services/GlobalApi.js`.
3. The route is wrapped in `withFamily` (read) or `withFamilyWrite` (write) from `lib/auth.js`. These check the session again and work out `{ userId, familyId, viewingId, vieweeVisibility }` on the server.
4. Every query includes `familyFilter(table, familyId)` and a user filter.
5. `/api/dashboard` gathers everything the Today screen needs in one trip, rather than many small requests.

## Where things live

```
app/
  api/                 One folder per resource (sleep, water, sessions, family, invites ...)
  dashboard/           The signed-in app: Today, How I feel, For my GP, Log, More (Train, Trends, Settings)
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
