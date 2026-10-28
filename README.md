# Health

A health log for families. Log sleep, water, weight, workouts, meals and mood in a tap or two, see whether the week is on track, and share with your family only what you choose to.

Live at [health.guilduk.com](https://health.guilduk.com). The [demo](https://health.guilduk.com/demo) runs the real app on sample data, with no sign-up and nothing saved. Real accounts are invite only, because the data is health data.

A personal project by Michael Ijisonuwe. Not a registered company.

> The app is being redesigned. The plan, the screens and the order of work are in [docs/DESIGN.md](./docs/DESIGN.md). Until each part lands, some screens still show the older look and the old working name, Etch.

## What it does

- **Today:** what is still to log, your streak, today's workout and who in the family has logged.
- **Log:** sleep, water, weight and body, cardio, meals, mood, and a private journal. Every past entry can be edited or deleted.
- **Train:** weekly plans, a workout screen that logs sets and reps, a rest timer and personal bests.
- **Trends:** averages, this week against last week, and charts for each area.
- **Family:** who has logged today, a family chat, leaderboards, and a read-only view of each person's week.
- **Privacy:** each person chooses what the family can see. The journal is never shared. Data exports in one file.

## Built with

Next.js 14 (App Router), React 18, Kinde for sign-in, Neon Postgres with Drizzle ORM, Tailwind CSS, Recharts and SWR. Hosted on Vercel.

## Run it yourself

You need Node.js 18.18 or newer, a free [Kinde](https://kinde.com) application and a free [Neon](https://neon.tech) database.

```bash
npm install
cp .env.example .env.local   # then fill in your own values
npm run db:migrate
npm run dev
```

Open http://localhost:3000. In Kinde, allow `http://localhost:3000/api/auth/kinde_callback` as a callback URL and `http://localhost:3000/signed-out` as a logout URL.

| Variable | What it is for |
| --- | --- |
| `KINDE_CLIENT_ID`, `KINDE_CLIENT_SECRET`, `KINDE_ISSUER_URL` | From your Kinde application |
| `KINDE_SITE_URL`, `KINDE_POST_LOGIN_REDIRECT_URL`, `KINDE_POST_LOGOUT_REDIRECT_URL` | Your site address, `/dashboard` and `/signed-out` on it |
| `DATABASE_URL` | Your Neon connection string |
| `FAMILY_EMAILS` | Optional allow-list, comma separated |
| `APP_URL` | Public address used in invite links |
| `RESEND_API_KEY`, `EMAIL_FROM` | Optional, for sending invites by email |

Secrets only ever go in `.env.local` or your host's settings. Never commit them.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run db:generate -- --name <name>` | Write a new migration from changes to `utils/schema.jsx` |
| `npm run db:migrate` | Apply new migrations to the database in `DATABASE_URL` |
| `npm run db:studio` | Browse the database |

## Documentation

- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md): how the app is put together and where things live.
- [docs/DECISIONS.md](./docs/DECISIONS.md): the main choices and why.
- [docs/DESIGN.md](./docs/DESIGN.md): the redesign, colours, type and rules.
- [SECURITY.md](./SECURITY.md): how data is kept separate, and how to report a problem.

## Licence

[MIT](./LICENSE).
