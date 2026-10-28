import LegalPage from "../_components/LegalPage";

export const metadata = {
  title: "Terms",
  description: "The terms that cover your use of Health during the private beta.",
};

const SECTIONS = [
  {
    heading: "The service",
    body: [
      "Health is a family health-tracking app, offered in a private beta and provided on an “as is” basis. Features may change as we develop it.",
    ],
  },
  {
    heading: "Not medical advice",
    body: [
      "Health helps you record and reflect on your habits. It is not a medical device and does not provide medical advice. Please talk to a qualified professional for health decisions.",
    ],
  },
  {
    heading: "Your account",
    body: [
      "Full accounts are invite-only during the beta. Keep your sign-in secure; you are responsible for activity under your account.",
    ],
  },
  {
    heading: "Acceptable use",
    body: [
      "Please don't misuse Health: no attempts to break security, disrupt the service, or upload unlawful or harmful content.",
    ],
  },
  {
    heading: "Your content",
    body: [
      "You own what you enter. You grant us the permissions needed to store it and show it to the people you choose, purely to run the service. You can delete your content at any time.",
    ],
  },
  {
    heading: "Beta expectations",
    body: [
      "This is an early beta. Expect the occasional bug or downtime, and please keep your own copy of anything important, we can't guarantee against data loss during the beta.",
    ],
  },
  {
    heading: "Liability",
    body: [
      "To the fullest extent the law allows, Health is not liable for indirect or consequential losses arising from your use of the service.",
    ],
  },
  {
    heading: "Ending your use",
    body: [
      "You can stop using Health whenever you like. We may suspend or end access for accounts that misuse the service.",
    ],
  },
  {
    heading: "Changes and governing law",
    body: [
      "We may update these terms as Health develops. These terms are governed by the laws of England and Wales.",
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
      updated="2 June 2026"
      intro="These terms cover your use of Health during our private beta. By using Health, you agree to them."
      sections={SECTIONS}
    />
  );
}
