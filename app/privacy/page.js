import LegalPage from "../_components/LegalPage";

export const metadata = {
  title: "Privacy · Etch",
  description: "What Etch collects, why, and the choices you have.",
};

const SECTIONS = [
  {
    heading: "What we collect",
    body: [
      "Account details: your name and email address, handled through our authentication provider, Kinde.",
      "What you log: the health information you choose to enter — workouts, sleep, water, mood, meals, body measurements and journal notes.",
      "Basic technical logs (such as error and access records) needed to keep the service running and secure.",
    ],
  },
  {
    heading: "Why we use it",
    body: [
      "To run the app: save your entries, show your trends, and share what you choose with the people in your household.",
      "To keep the service secure and working properly.",
      "We do not sell your data, and we do not use it to train AI.",
    ],
  },
  {
    heading: "What your household can see",
    body: [
      "A household shares one space. You decide what others see using eight per-person visibility settings. Your journal is always private and is never shared.",
    ],
  },
  {
    heading: "Who helps us run Etch",
    body: [
      "We use trusted providers to operate the service: Kinde (sign-in), Neon (database), Vercel (hosting) and Resend (email). They process data on our behalf, under their own terms.",
    ],
  },
  {
    heading: "Where your data lives, and security",
    body: [
      "Your data is stored in a managed Postgres database. It is encrypted in transit. Access is gated on the server and scoped to your household, so families cannot see each other's data.",
    ],
  },
  {
    heading: "Your choices and rights",
    body: [
      "You can view, export, correct or delete your data. To make a request, email michael@guilduk.com. If you are in the UK or EU, you have rights under data-protection law, including access and erasure.",
    ],
  },
  {
    heading: "Children",
    body: [
      "Etch is made for families. A parent or guardian is responsible for any information they choose to add about a child.",
    ],
  },
  {
    heading: "Keeping your data",
    body: [
      "We keep your information while your account is active. Delete your account and we remove your data.",
    ],
  },
  {
    heading: "Changes and contact",
    body: [
      "We will update this notice as Etch grows beyond the beta. Questions? Email michael@guilduk.com.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      updated="2 June 2026"
      intro="Etch is a health app for families, currently in a private beta. This notice explains what we collect, why, and the choices you have. It covers the beta and may evolve before public launch."
      sections={SECTIONS}
    />
  );
}
