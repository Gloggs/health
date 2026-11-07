import LegalPage from "../_components/LegalPage";

export const metadata = {
  title: "Terms",
  description: "The terms that cover your use of health.",
};

const SECTIONS = [
  {
    heading: "The service",
    body: [
      "health is a free personal app that helps you get ready for your GP appointment. It is an open source project by Michael Ijisonuwe, provided on an “as is” basis. Features may change as it develops.",
    ],
  },
  {
    heading: "Not medical advice",
    body: [
      "health keeps your own words in order. It is not a medical device, and it never scores, rates or diagnoses anything. Your GP or another qualified professional decides what it means. If you need help urgently, call NHS 111, or 999 in an emergency.",
    ],
  },
  {
    heading: "Your account",
    body: [
      "Anyone can create a free account. Keep your sign-in secure; you are responsible for activity under your account.",
    ],
  },
  {
    heading: "Acceptable use",
    body: [
      "Please don't misuse health: no attempts to break security, disrupt the service, or upload unlawful or harmful content.",
    ],
  },
  {
    heading: "Your content",
    body: [
      "You own what you enter. You allow us to store it and show it back to you, only to run the service. You can download or delete all of it at any time in Settings.",
    ],
  },
  {
    heading: "What to expect",
    body: [
      "health is run by one person. Expect the occasional bug or downtime, and keep your own copy of anything important: you can download everything in Settings.",
    ],
  },
  {
    heading: "Liability",
    body: [
      "To the fullest extent the law allows, health is not liable for indirect or consequential losses arising from your use of the service.",
    ],
  },
  {
    heading: "Ending your use",
    body: [
      "You can stop using health whenever you like. We may suspend or end access for accounts that misuse the service.",
    ],
  },
  {
    heading: "Changes and governing law",
    body: [
      "We may update these terms as health develops. These terms are governed by the laws of England and Wales.",
    ],
  },
  {
    heading: "Contact",
    body: ["Questions about these terms? Email michael@guilduk.com."],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms"
      updated="6 November 2026"
      intro="These terms cover your use of health. By using health, you agree to them."
      sections={SECTIONS}
    />
  );
}
