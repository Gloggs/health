# Privacy and data protection

How health handles personal data, written against UK GDPR, the Data Protection Act 2018 and the Information Commissioner's Office (ICO) guidance. Each promise points to the code and the test that keeps it true. Written 6 November 2026.

This page describes what health does. It is not legal advice, and it does not claim that health is "certified" or "approved": no such certificate exists for an app like this. The section "Still to confirm" lists what has not been checked yet.

## Who is responsible

Michael Ijisonuwe runs health and is the controller of the personal data in it. Contact: michael@guilduk.com. If you run your own copy of health, you are the controller for that copy.

## What health holds, and why

| Data | Why | Legal basis (UK GDPR) |
| --- | --- | --- |
| Name and email address (from Kinde, the sign-in provider) | To give you an account | Article 6(1)(b), providing the service you asked for |
| What you write down: how you feel, GP questions and medicines, sleep, water, mood, meals, weight, workouts, the journal | To show it back to you and build your GP page | Article 6(1)(b), and Article 9(2)(a), explicit consent, because it is health data (special category data) |
| The date and time you agreed to health storing health data | To show consent was given, as Article 7(1) requires | Article 6(1)(c), a legal obligation |
| Basic technical logs (errors, request status) | To keep the service working and secure | Article 6(1)(f), legitimate interests. Logs never contain what you wrote (`lib/auth.js` `safeMessage`, and no personal data in log lines) |

health collects nothing else: no adverts, no tracking scripts, no analytics on what you write, and no data sold or used to train AI.

## Consent for health data

The ICO expects explicit consent for special category data to be separate from other terms, specific about the kind of data, and as easy to withdraw as to give.

- **Separate and specific:** the first screen after sign-up is only the health data agreement, naming the kinds of data (`app/onboarding/page.js`, `StepConsent`). The box is not ticked for you.
- **Nothing before consent:** every route that saves data refuses until consent is recorded (`lib/auth.js`, `withFamilyWrite`), and the app's screens stay closed until then (`middleware.js`). Tested in `tests/privacy/privacy.test.mjs` ("health data needs the person's agreement first") and `tests/privacy/gate.test.mjs`.
- **Withdrawing:** "Delete everything" in Settings removes the data and the consent record together.

## Who can see it

- **Only the person who wrote it.** Every API route runs through one server-side check (`lib/auth.js`) that resolves the signed-in person and filters every query by them. Family sharing is switched off (`lib/features.js`), so there is no way to view another person: the old family routes return 404 and any "viewing" parameter is ignored. Tested in `tests/privacy/standalone.test.mjs` and `tests/privacy/privacy.test.mjs`, which seed secret entries for one person and check that no route ever shows them to anyone else.
- **Encrypted in the database.** The free-text fields (how you feel, where, how bad, what helps, notes, the journal, GP questions, medicines, goals) are encrypted with AES-256-GCM before they are written (`lib/crypt.js`, used through the column types in `utils/schema.jsx`). Each value has its own random nonce, and any change to a stored value is detected and refused. The key (`HEALTH_DATA_KEY`) is kept in the hosting provider's settings, never in the database or the repository. `tests/privacy/standalone.test.mjs` reads the database directly and checks that it holds only `enc:v1:` values. `tests/crypt.test.mjs` checks the encryption itself.
- **What is not encrypted at the field level:** numbers and dates (sleep hours, weight, water, mood rating, dates of entries), your display name and email, and short labels you choose (mood tags, meal slot). These are still protected by the same access checks, by Neon's encryption of stored data, and by TLS on every connection.
- **The limit, stated plainly:** the app's server needs the key to show you your words and build your GP page, so someone with access to both the hosting settings and the database could read them. Only Michael has that access. He does not look at people's entries, and would only ever do so if the law required it, telling the person unless the law forbade that.

Why not end-to-end encryption, where only your device holds the key? Because the GP page, the PDF and the FHIR export are built from your words, and because a forgotten passphrase would lose everything with no way back. For an app meant for anyone, that trade-off was judged worse. This is recorded in `docs/DECISIONS.md`.

## Who processes it

| Processor | What it does | Personal data it handles |
| --- | --- | --- |
| Kinde | Sign-in | Name, email address, sign-in records |
| Neon | The Postgres database | Everything in the table above; the words are encrypted |
| Vercel | Hosting | Requests passing through, and technical logs |

health sends no email: Resend, the email provider in the code, is used only by the family invites, which are switched off. Each processor works under its own data processing agreement. See "Still to confirm" for where each one stores data.

## How long data is kept

- While your account is open, everything you saved is kept.
- "Delete everything" (Settings, `app/api/account/route.js`) deletes every row you own, your profile and your settings straight away. Your private space goes too. `tests/privacy/account.test.mjs` checks the database afterwards for any row that still mentions you, and checks that every table with a `user_id` column is on the delete list, so a new table cannot be forgotten.
- Your sign-in account at Kinde is separate. Deleting it needs Kinde's management API, which health does not use yet, so it is removed on request by email.
- Journal entries can also be removed automatically after a period you choose (Settings, Goals).
- Copies in Neon's backups expire on Neon's schedule (see "Still to confirm").

## Your rights

| Right (UK GDPR) | How |
| --- | --- |
| To be informed (Articles 13 and 14) | The privacy page, `/privacy`, and this page |
| Of access and to data portability (Articles 15 and 20) | Settings > Your data > Download everything (a JSON file). For my GP also downloads your entries in FHIR. |
| To rectification (Article 16) | Every entry can be edited |
| To erasure (Article 17) | Settings > Your data > Delete everything |
| To withdraw consent (Article 7(3)) | The same: deleting everything withdraws it |
| To complain | To the ICO, at ico.org.uk |

## Data protection by design

- **Data minimisation:** no date of birth or height is required, the GP page shows only the chosen name, and the FHIR export contains no email or date of birth (`lib/fhir.js`, tested in `tests/fhir.test.mjs`).
- **Private by default:** there is nothing to switch off, because nothing is shared.
- **Fail closed:** without the encryption key, the app refuses to save or read words instead of saving them unprotected (`tests/crypt.test.mjs`).
- **Errors say nothing about the system:** database and library errors reach the browser only as "Something went wrong" (`lib/auth.js` `safeMessage`).
- **Not a medical device:** health never scores, rates, interprets or advises (`docs/DESIGN.md`, "The line it never crosses"), which keeps it on the MHRA's symptom-diary side of the line.

## Data protection impact assessment (short form)

The ICO expects a DPIA before processing special category data on a large scale or in a new way. health is small, but it holds health data from anyone who signs up, so the assessment is written down here.

| Risk | Likelihood before | Measures | Remaining |
| --- | --- | --- | --- |
| One person sees another's entries | Medium (it happened in other apps through a missing filter) | One server-side check on every route; sharing switched off; privacy tests on every change | Low |
| A database leak or a stolen backup exposes what people wrote | Low | Field-level AES-256-GCM encryption, key kept apart; TLS; Neon's encryption at rest | Low: the words are unreadable without the key; numbers and dates would be exposed |
| The operator reads people's entries | Low | Only Michael has access; stated policy; the database holds only scrambled words | Low, and stated honestly to users |
| Someone relies on health as medical advice | Medium | No scores or advice anywhere; every page says the GP decides; NHS 111 and 999 on the front page | Low |
| The encryption key is lost | Low | A copy kept safely by Michael, outside the hosting provider | Low; loss would make the words unreadable, not public |
| Data kept longer than needed | Medium | Delete everything at any time; optional automatic journal deletion | Low |

Review this assessment when anything about how data is handled changes, for example if sharing is switched back on.

## If something goes wrong

1. Contain it: rotate the affected secrets (Kinde, Neon, `HEALTH_DATA_KEY`) and take the app offline if needed.
2. Work out what was exposed, for whom, and since when.
3. If it is likely to put people's rights at risk, report it to the ICO within 72 hours of becoming aware (Article 33).
4. If the risk to people is high, tell the people affected without undue delay (Article 34).
5. Record what happened and what was changed, even when it does not need reporting.

Security problems can be reported privately as described in `SECURITY.md`.

## Still to confirm

These have not been checked yet, so nothing on the privacy page depends on them.

- **Where each processor stores data.** The Neon project's region (shown in the Neon console), the region Vercel runs the app's functions in (Vercel's default is in the United States), and Kinde's data region. If any is outside the UK, the privacy page should say so and name the safeguard, such as the UK-US data bridge or the ICO's international data transfer agreement.
- **Neon's backup window** for this plan, so "How long data is kept" can give a number.
- **The ICO data protection fee.** Whether Michael needs to pay it for health. The ICO has a short self-assessment on its website.
- **A minimum age.** Whether health should say it is for people aged 16 or 18 and over. Health data from children needs extra care under the ICO's Children's Code.
- **Kinde account deletion.** Whether to add Kinde's management API, so "Delete everything" also removes the sign-in account.
