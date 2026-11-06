# Design

health version 2 (November 2026). The thinking behind the app: the job it does, the line it never crosses, the frameworks that decided what goes where, and how each decision is checked. Check every change against this page.

## The job

> When something is not right, I want to show my GP what has been happening, clearly, in the ten minutes I get.

The evidence is in `RESEARCH.md`: most GP appointments are about 10 minutes, and the NHS's own advice is to write down your symptoms, when they started and what makes them better or worse, your medicines, and your 2 or 3 most important questions. Those are exactly the parts of the GP summary.

## The line it never crosses

health organises what you tell it. It never scores, rates, interprets, warns or advises. This is also the MHRA's line between a symptom diary and a medical device (see `RESEARCH.md`). In practice:

- How bad something is, is the person's own word (mild, moderate or bad), never a number the app works out.
- The summary only orders and groups the person's entries, and counts the days something was written down, which anyone could do with a paper diary.
- Every summary ends: "These are my own words, written down using health. Your GP decides what this means."
- The front page says what health is not, and points to NHS 111 or 999 for anything urgent.
- A unit test fails if the summary ever adds words such as "serious", "risk" or "you should".

## The frameworks

| Framework | What it decides | Where it shows |
| --- | --- | --- |
| Jobs to be Done | What is core and what is extra | Today opens on "Anything going on today?"; the menu is Today, How I feel, For my GP, Log, More |
| The NHS's own advice | The fields and the order of the summary | How I feel and For my GP |
| Progressive disclosure | Simple without losing features | Train, Trends, Family and Settings are one tap away under More, each with one sentence saying what it is for |
| Privacy by default (UK GDPR special category data) | What anyone else can see | Nothing shared until switched on; notes never shared; a separate agreement before anything is saved |
| Nielsen's 10 usability heuristics | The review checklist | The review below |
| WCAG 2.2 AA | Access for everyone | axe checks on every main screen, light and dark |
| Guild UK Skeleton v2 | The look | Below |

## Screens

| Screen | What it does |
| --- | --- |
| Front page | Says the job in one line, shows a sample GP summary, how it works in three steps, privacy, and what health is not |
| Today | "Anything going on today?" first, with Add how you feel and See it for my GP; then the day's logs and the streak |
| How I feel | What, where, when, how bad (the person's word), what makes it better or worse, and a note. Private always |
| For my GP | My appointment (date, questions, medicines), then the one-page summary for 2, 4 or 8 weeks: show it, print it, download a PDF, or download the entries in FHIR |
| Log | Sleep, water, weight, cardio, meals, mood and the journal |
| More | Train, Trends, Family, and Settings and help |
| First time | A health data agreement, then a four-step guide shown once ever; after that, Help is at the top of Settings |

## Usability review (Nielsen's 10 heuristics)

| Heuristic | Version 1 | Version 2 |
| --- | --- | --- |
| Visibility of system status | Streaks and checklists everywhere | Clear saves ("Saved. Only you can see this."), and Today says how many things are written down, ready for the GP |
| Match with the real world | Fitness language ("etched", "show up") | The NHS's own words and order |
| User control and freedom | Entries could be edited or deleted | Same; the summary period can be changed |
| Consistency and standards | Mixed outlined and filled boxes, capital headings | One system: filled panels, flat buttons, sentence-case headings |
| Error prevention | Some free text | Plain choices for how bad; dates cannot be in the future; a made-up severity is refused by the server |
| Recognition rather than recall | Five fitness tabs | Five places named after what they do |
| Flexibility and efficiency | Many shortcuts | Same, plus print, PDF and FHIR from one screen |
| Aesthetic and minimalist design | A crowded Today and a busy front page | One job first; extras one tap away; a plain front page |
| Help users recover from errors | Mixed | Plain messages; internal errors never shown as raw text |
| Help and documentation | A set-up checklist | A guide once, then Help in Settings |

This review is a judgement, made on 6 November 2026. Real users, and GPs, may disagree; their feedback wins.

## The look (Guild UK Skeleton v2)

- **Colours** from the Guild Design kit tokens: white ground, ink text, forest `#174131` for headers and the main action, soft green for panels and secondary buttons. Coral only for focus on forest and the end of the logo's pulse line. Dark mode uses the kit's agreed dark tokens.
- **Type:** DM Sans for text and headings, weight 500 for headings with tight tracking, no capital-letter headings or spaced-out labels. The PDF uses Helvetica, because fonts are embedded differently in PDFs.
- **Shapes:** square corners, filled panels, flat filled buttons, underlined links. Lines only for tables and form fields.
- **Icon:** the Guild UK octagon with health's own symbol, a pulse line ending in a coral dot (`app/icon.svg`; `scripts/make-icons.mjs` renders the app icons from it).
- **Name:** written "health", in small letters, like the sister app "here".

## Writing

UK spelling, short sentences, everyday words. No long dashes, no exclamation marks, no medical claims. Buttons say what happens: "Add how you feel", "See it for my GP", "Download PDF".

## Built on

Next.js, React, Kinde (sign-in), Neon Postgres with Drizzle ORM, Tailwind CSS, Radix UI, Lucide icons, Sonner, SWR, Recharts, react-pdf (the PDF), Vitest (privacy tests), Playwright and axe-core by Deque (browser and accessibility tests), and DM Sans (SIL Open Font Licence). The look comes from the Guild Design kit (github.com/guilduk/design). FHIR resources follow HL7 FHIR R4 and the NHS England UK Core profiles; codes are from LOINC.
