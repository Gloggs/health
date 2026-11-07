import LegalPage from "../_components/LegalPage";

export const metadata = {
  title: "Privacy",
  description: "What health collects, why, who can see it, and your rights.",
};

// Kept in step with docs/PRIVACY.md, which has the full detail and the tests behind each promise.
const SECTIONS = [
  {
    heading: "The short version",
    body: [
      "health is a personal app. Nobody else can see what you write down: not other people using health, and not anyone looking at the database.",
      "What you write is encrypted before it is saved. You can download or delete everything at any time.",
    ],
  },
  {
    heading: "What we collect",
    body: [
      "Your account: your name and email address, through our sign-in provider, Kinde.",
      "What you choose to write down: how you feel, your GP questions and medicines, sleep, water, mood, meals, weight, workouts and your journal. This is health data, which UK GDPR calls special category data.",
      "Basic technical logs, such as errors, needed to keep the service running and secure. They never contain what you wrote.",
    ],
  },
  {
    heading: "Why we use it, and our legal basis",
    body: [
      "Only to run the app for you: save your entries, show them back to you, and build the page for your GP.",
      "Your health data is used only with your explicit consent, which you give on a separate screen before anything is saved (UK GDPR Article 9(2)(a)). Your account is used to provide the service you asked for (Article 6(1)(b)).",
      "We do not sell your data, show you adverts, or use your data to train AI. health sends your data nowhere unless you download it yourself.",
    ],
  },
  {
    heading: "Who can see it",
    body: [
      "Only you, when signed in. Every request is checked on the server against your account, and automated tests prove that one person can never read another person's entries.",
      "The words you write (how you feel, notes, your journal, questions, medicines and goals) are encrypted with AES-256 before they are saved. The key is kept apart from the database, so the database and its backups hold only scrambled text.",
      "To be clear about the limit: the app's server holds the key, so it can read your words in order to show them to you. We do not look at people's entries. If we ever had to, for example because the law required it, we would tell you unless the law stopped us.",
    ],
  },
  {
    heading: "Who helps us run health",
    body: [
      "Kinde (sign-in), Neon (the database) and Vercel (hosting). They process data only on our instructions, under data processing agreements. health sends no emails.",
    ],
  },
  {
    heading: "Keeping your data, and your rights",
    body: [
      "We keep your data while your account is open. Delete your account in Settings and your entries are deleted straight away.",
      "You have the right to see, download, correct and delete your data, and to withdraw your consent at any time. Download and delete are in Settings. For anything else, email michael@guilduk.com.",
      "If you are unhappy with how we handle your data, you can complain to the Information Commissioner's Office (ico.org.uk).",
    ],
  },
  {
    heading: "Not medical advice",
    body: [
      "health keeps your own words in order. It never scores, rates or diagnoses anything. If you need help urgently, call NHS 111, or 999 in an emergency.",
    ],
  },
  {
    heading: "Changes and contact",
    body: [
      "If this notice changes, we will say so here with the date. Questions? Email michael@guilduk.com.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      updated="6 November 2026"
      intro="health helps you get ready for your GP appointment. This notice explains what it collects, why, who can see it, and your rights. health is an open source project by Michael Ijisonuwe, who is responsible for your data."
      sections={SECTIONS}
    />
  );
}
