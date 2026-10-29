# Design

Health follows a black and white skeleton first, with a small palette and one type family on top. Check every screen against this page before it ships.

## Direction

Health answers one question each day: what is left to log, and am I on track? It should be quick for everyday use, clear to someone opening it for the first time, and never nag.

## Colours (Harbour)

| Name | Hex | Use |
| --- | --- | --- |
| Ink | `#142B38` | Text, header bands, the main navigation |
| Chalk | `#F1F1EF` | Page background |
| White | `#FFFFFF` | Panels and tables |
| Harbour | `#2F6B8A` | Progress bars, links |
| Sky | `#70B2CE` | Done marks, logged days |
| Flame | `#EB6E3A` | The streak number, the main button, today |
| Stone | `#586068` | Labels, dates, captions |
| Line | `#D6D8D8` | Dividers and borders |

Bright colours fill shapes. Words always sit in ink, or in chalk on ink. Light by default, and dark follows the device.

## Type

- Numbers and headings: **Barlow Condensed**, bold. Headings in capitals.
- Everything else: **Barlow**.
- Numbers use tabular figures so columns line up.
- Form inputs are 16px so phones do not zoom in.

## Layout

- Sharp corners. No pill buttons.
- Thin 1px lines. No coloured stripes down the side of cards.
- No shadows, glows or gradients.
- No badges or labels sitting above a heading.
- Tap targets are at least 44px.
- The active tab is shown by a filled background, not an underline.

## Navigation

The same five places on phones (bottom tabs) and desktop (sidebar):

| Tab | Holds |
| --- | --- |
| Today | What is left to log, streak and week, quick logs, today's workout, Daily 4, meals, check-in, goals, family, month calendar |
| Log | Sleep, water, weight and body, cardio, meals, mood, journal, all past entries |
| Train | Start today's session, plans, exercise library, past sessions |
| Trends | Averages, this week against last week, charts, discipline score |
| Family | Who has logged today, family chat, leaderboards, each person's week, invites |

On every screen: search (logs, exercises, plans, family, settings), notifications, and **You** (profile, goals, targets, what the family sees, invites, export, delete, sign out).

Search opens from the top bar, or with `/` or Ctrl/Cmd + K. The tabs live in one list (`components/shell/nav.js`) shared by the real app and the demo, so the two cannot drift apart.

## Components

- Cards: a 1 px ink border on the card colour, `p-4` on phones and `p-5` from tablet up. No fills, rounding or shadows.
- Headings: Barlow Condensed, bold, uppercase. Page titles are `h1` (PageHero or PageHeader), card titles are `h2`.
- Body text: Barlow. Numbers that matter use Barlow Condensed.
- People are shown as a square of initials (`lib/initials.js`).
- Rows in lists are at least 48 px tall; buttons and links at least 44 px.

## Behaviour

- Logging takes one or two taps and starts from the last entry.
- Saving or deleting an entry shows one quiet line with Undo. No "are you sure" for everyday changes. Deleting a whole account or leaving a family still asks first.
- The workout screen fills in last session's weights and keeps working on a weak signal.
- No streak guilt, confetti, pop-ups or count-up animations. Motion only shows that something happened, and stops when the device asks for reduced motion.

## Writing

Plain language is part of the look, as much as the black and white skeleton.

- Headings are names, not slogans. "Health and fitness tracker", "Water", "Log sheet". Never "Log your day in ten seconds" or "Shared, not exposed".
- Say what something is or does, in the fewest everyday words. No sales talk, no clever phrasing.
- Buttons say what happens: "Save 250 ml", "Start workout", "Undo".
- UK spelling. Short sentences. No long dashes, no exclamation marks, no buzzwords.

## Order of work

Each step is one pull request on a `claude/*` branch.

1. Import into this repository
2. Rename to Health, Harbour colours and Barlow, sharp corners, copy pass
3. The log sheet: one way to log water, sleep, weight, mood, meals and cardio, with usuals, a ruler, Undo and mood tags
4. Five tabs, top bar, desktop sidebar, search, the You menu, and Today rebuilt around the log list
5. Landing page with a live log sheet, and the guided demo
6. Gym mode for workouts, with an offline queue and next-weight suggestions
7. Trends tab, family chat in Family, settings trimmed
8. Reminders that actually send, at most once a day
9. Hardening: Next.js 15, security headers, tests for the family checks against a real database, browser and accessibility tests, delete my data
