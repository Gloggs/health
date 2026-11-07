# health

Get ready for your GP appointment. Write down what is going on, in your own words, and health turns it into one clear page for your GP: what is happening and since when, what helps, your medicines and your questions. Show it, print it, save it as a PDF, or download your entries in FHIR, the data format the NHS uses.

Most GP appointments are about 10 minutes, and the NHS advises writing down your symptoms, when they started and what makes them better or worse, your medicines and your questions. health does exactly that, and nothing more: it keeps your words in order and never scores, rates or diagnoses anything. Your GP decides what it means. The evidence, with sources, is in [docs/RESEARCH.md](./docs/RESEARCH.md).

Live at [health.guilduk.com](https://health.guilduk.com). The [demo](https://health.guilduk.com/demo) runs the real app on sample data, with no sign-up and nothing saved. Anyone can create a free account.

An open source project by Michael Ijisonuwe. Not a registered company.

## Private to you

health is a personal app. Only you can see what you write down.

- **No sharing.** There are no families, followers or public profiles. Every request is checked on the server against the signed-in person, and automated tests prove one person can never read another's entries.
- **Encrypted before it is saved.** The words you write (how you feel, notes, your journal, GP questions, medicines and goals) are encrypted with AES-256-GCM before they reach the database. The key is kept in the hosting settings, apart from the database, so the database, its backups and anyone looking at it see only scrambled text. A test reads the database directly to prove it.
- **The honest limit.** The app's server holds the key, so the running app can read your words in order to show them to you and build your GP page. That is how any app that shows you your data on more than one device works. The person running health does not look at entries.
- **Your consent, your rights.** Nothing is saved until you agree, on a separate screen, to health storing health information. You can download everything or delete everything at any time in Settings.

[docs/PRIVACY.md](./docs/PRIVACY.md) explains how health handles personal data under UK GDPR and the ICO's guidance: what it holds and why, the legal basis, who processes it, how long it is kept, the risk assessment, what happens if something goes wrong, and the test behind each promise.

## What it does

- **Today:** "Anything going on today?" first, then the day's logs.
- **How I feel:** what, where, when, how bad in your own word, and what helps or makes it worse.
- **For my GP:** your appointment, questions and medicines, and the one-page summary for the last 2, 4 or 8 weeks. Print it, save a PDF, or download FHIR.
- **Log:** sleep, water, weight, cardio, meals, mood and a private journal, if you want to keep track of the everyday too.
- **More:** Train (workout plans and personal bests), Trends (charts), and Settings, with help and your data.

## What this project shows

- **Health data handled properly:** UK GDPR special category data, explicit consent, field-level encryption, and the rights to access and erasure built in and tested.
- **Knowing the regulatory line:** the MHRA's line between a symptom diary and a medical device, built into the code and tested.
- **Health data standards:** a FHIR R4 export following NHS England UK Core, with checked LOINC codes.
- **Documents from data:** one pure function builds the summary for the screen, the printer, the PDF (react-pdf) and FHIR.
- **Testing:** unit tests, privacy tests against a real Postgres (Vitest), and browser and accessibility tests (Playwright and axe) on every pull request.
- **Design:** Jobs to be Done, progressive disclosure, a Nielsen heuristics review and Guild UK Skeleton v2 ([docs/DESIGN.md](./docs/DESIGN.md)).

## Built with

Next.js 14 (App Router), React 18, Kinde for sign-in, Neon Postgres with Drizzle ORM, @noble/ciphers for encryption, Tailwind CSS on the Guild Design kit, react-pdf, Recharts and SWR; Vitest, Playwright and axe-core for tests. Hosted on Vercel.

## Run it yourself

This repository holds no data and no keys. To run your own copy you need Node.js 18.18 or newer, a free [Kinde](https://kinde.com) application for sign-in, and a free [Neon](https://neon.tech) database (any Postgres 15 or newer works).

1. Get the code and install it:

   ```bash
   git clone https://github.com/Gloggs/health.git
   cd health
   npm install
   cp .env.example .env.local
   ```

2. Make your own encryption key and put it in `.env.local` as `HEALTH_DATA_KEY`. Keep a safe copy: without it, saved words cannot be read.

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

3. In Kinde, create a "Back-end web" application. Allow `http://localhost:3000/api/auth/kinde_callback` as a callback URL and `http://localhost:3000/signed-out` as a logout URL, then copy its details into `.env.local`.

4. Put your database's connection string in `.env.local` as `DATABASE_URL`, then build the tables in the empty database:

   ```bash
   npm run db:push
   ```

5. Start it, and open http://localhost:3000:

   ```bash
   npm run dev
   ```

| Variable | What it is for |
| --- | --- |
| `KINDE_CLIENT_ID`, `KINDE_CLIENT_SECRET`, `KINDE_ISSUER_URL` | From your Kinde application |
| `KINDE_SITE_URL`, `KINDE_POST_LOGIN_REDIRECT_URL`, `KINDE_POST_LOGOUT_REDIRECT_URL` | Your site address, `/dashboard` and `/signed-out` on it |
| `DATABASE_URL` | Your database connection string |
| `HEALTH_DATA_KEY` | Your own 32-byte encryption key, in base64 |
| `APP_URL` | Your site's address |

Secrets only ever go in `.env.local` or your host's settings. `.gitignore` keeps every `.env` file except the example out of git.

Why `db:push` and not the migrations: the files in `drizzle/` are the history of the live database, which existed before migrations were used, so they cannot build an empty one. `db:push` builds the current schema from `utils/schema.jsx`, which is also what the tests do.

## Tests

| Script | What it does |
| --- | --- |
| `npm test` | Unit tests: the summary, FHIR and encryption |
| `npm run test:privacy` | Privacy tests: the real route handlers against a real Postgres. Needs a test database: see [docs/TESTING.md](./docs/TESTING.md) |
| `npm run test:e2e` | Browser and accessibility tests on a production build |

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run db:push` | Build or update the tables in the database in `DATABASE_URL` |
| `npm run db:generate -- --name <name>` | Write a new migration from changes to `utils/schema.jsx` |
| `npm run db:migrate` | Apply new migrations to a database that already has the tables |
| `npm run db:studio` | Browse the database |

## Documentation

- [docs/PRIVACY.md](./docs/PRIVACY.md): personal data, UK GDPR and the ICO's guidance.
- [docs/RESEARCH.md](./docs/RESEARCH.md): the evidence behind the design, with sources.
- [docs/DESIGN.md](./docs/DESIGN.md): the job, the frameworks, the screens and the look.
- [docs/TESTING.md](./docs/TESTING.md): what is tested, and what is not.
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md): how the app is put together and where things live.
- [docs/DECISIONS.md](./docs/DECISIONS.md): the main choices and why.
- [SECURITY.md](./SECURITY.md): how to report a security problem.

## Licence

[MIT](./LICENSE).
