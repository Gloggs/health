# Decisions

Short records of the main choices, newest first.

## October 2026: one log sheet for everything

Each kind of log used to have its own controls: fixed +250 and +500 buttons for water, time boxes for sleep, a typed number for weight, and so on. They now share one sheet (`components/log/`): a title, a date that can be changed, the value in big numbers, your usuals, one control, and Save. Usuals come from your own history (`lib/usuals.js`, covered by tests) rather than fixed amounts: your water containers, your normal bedtime, your usual run. Numbers use a swipe ruler that is a real slider to screen readers; feelings and quality use a five-step scale. Every save and delete shows Undo instead of asking "are you sure". The pattern follows the apps that do each part best: WaterMinder and Waterllama for containers, Hevy and Strong for last time's numbers, Daylio for two-tap moods.

## October 2026: Harbour colours, Barlow, and a new mark

Health needed its own look, distinct from the sister app Here., while keeping the same black and white skeleton. Harbour (navy ink, chalk, harbour blue, sky, flame) came from a sports palette, so it reads as fitness without shouting. Barlow Condensed gives numbers a scoreboard feel, and Barlow keeps body text plain. The mark is a pulse line on a flame square. Every colour is a CSS variable, so light and dark use the same names, and corners and shadows are switched off in the Tailwind theme itself rather than screen by screen.

## October 2026: redesign for everyday use

The first version worked, but in daily use it was not polished. Logging took too many taps, useful screens were buried, and there was decoration that got in the way: mini-games on the landing page, a handwriting font, personality and typeface presets, and animations on every tap. The redesign keeps the features and cuts the noise. Today becomes a short list of what is left to log. Every screen is reachable from five tabs, a search box and one "You" menu. The plan is in [DESIGN.md](./DESIGN.md).

## October 2026: five tabs, search and one You menu

The old sidebar had seven items plus Settings, while the phone tabs had five different ones, so some screens could only be reached on one device. Now both show the same five places: Today, Log, Train, Trends and Family. Chat moved under Family, the journal under Log, and settings, goals, export and sign out under You. A search box finds any page, setting, log action, exercise, plan or family member.

## October 2026: reminders removed until they can send

The reminders screen saved schedules, but nothing ever delivered them. A setting that does nothing is worse than no setting, so it goes until there is a real way to send reminders.

## October 2026: one exercise library per family

The exercise table used to be shared by every account, so one person could rename or delete an exercise for everybody, and deleting it removed other families' logged sets. Starter exercises are now shared and read-only, and each family's own exercises belong to that family alone (migration `0006`).

## October 2026: family filter always on

Filtering by family used to depend on a setting in the host. If the setting was missing, the family chat showed every family's messages. The filter is now always applied in code.

## October 2026: public repository with fresh history

The code moved from a private repository to this public one, starting from a clean history. Old planning documents and the earlier "Etch" brand material stayed behind.

## October 2026: demo for visitors, invites for real accounts

Visitors and recruiters use `/demo`, which runs the real pages on sample data with nothing saved. Real accounts stay invite only, because they hold health data.

## May 2026: one app for a whole family

The app started as a one-person workout tracker and became a multi-family app. Every health table gained `family_id`, and access moved from an email allow-list to memberships and invites.

## May 2026: versioned migrations

Schema changes ship as numbered SQL files in `drizzle/`, applied with `npm run db:migrate`, instead of pushing the schema straight to the database.
