# Research

Why health is changing from a family fitness log into a way to get ready for a GP appointment, who it is for, the line it must never cross, and what is still not known. Every fact has a source and the date it was checked. Checked 6 November 2026.

## The problem

GP appointments are short, and people forget the details that matter.

- "Most GP appointments are just 10 minutes long… go prepared" ([Healthwatch England, 26 September 2025](https://www.healthwatch.co.uk/advice-and-information/2025-09-26/how-get-most-out-your-gp-appointment)).
- "Many GPs limit appointments to 10 minutes. There may also be a limit on the number of issues you can discuss" ([The Patients Association](https://www.patients-association.org.uk/make-the-most-of-your-gp-appointment)).

The NHS's own advice, before an appointment ([NHS website, What to ask your doctor, last reviewed 12 January 2023](https://www.nhs.uk/nhs-services/gps/what-to-ask-your-doctor/)):

> Write down details of your symptoms, including when they started and what makes them better or worse.

It also says to write down your 2 or 3 most important questions, and to list or bring all your medicines, including vitamins and supplements.

That advice is the design. The one-page summary has exactly those parts: what is happening, since when, what makes it better or worse, your medicines, and your questions, with the sleep, mood and other logs around it.

## Who it is for

Anyone who has something going on and a GP appointment coming up, and anyone helping a family member get ready for one. Health keeps its family sharing, so a parent can help a teenager, or an adult child can help a parent, with only what the person chooses to share.

## The line it never crosses

Health organises what you tell it. It never diagnoses, scores, interprets or advises.

This is also the legal line. The MHRA's guidance on apps ([Medical device stand-alone software including apps, GOV.UK, page last updated 1 July 2023](https://www.gov.uk/government/publications/medical-devices-software-applications-apps)) says:

- **Unlikely to be a medical device:** "Apps and software that simply replace a written diary/log of symptoms that can be used when consulting with the patient's doctor."
- **Not usually a medical purpose:** "The monitoring of general fitness, general health and general wellbeing."
- **Likely to be a medical device:** decision support that "applies automated reasoning such as a simple calculation, an algorithm or a more complex series of calculations", including "symptom tracking"; and "apps and software that provide medical condition advice based on user entered data".

So the summary lists what was entered, in order, with dates. It does not add risk scores, flags such as "this may be serious", or suggestions. The wording on every screen says the same: it helps you tell your GP what happened; your GP decides what it means.

## Health data is special

Health data is special category data under UK GDPR. The usual condition for an app like this is explicit consent, which the ICO says should be a clear statement, should name the kind of special category data, and should be separate from any other consent ([ICO, Article 9 conditions for processing special category data](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/guidance-tool-article-9-conditions-for-processing-special-category-data/); summary of the ICO guidance by [Covington, Inside Privacy, 2019](https://www.insideprivacy.com/eu-data-protection/uk-ico-publishes-new-guidance-on-special-category-data/)).

What health does about it:

- Private by default: nothing is shared with family until the person switches it on, and notes are never shared (tested on every change; see `TESTING.md`).
- A separate, plain consent step for health data when an account is made, before anything is logged. (To build, with the public sign-up.)
- Download everything, or delete everything, from Settings.

## The health data standard

The NHS exchanges health data in HL7 FHIR, using the UK Core profiles ([FHIR UK Core API standards, NHS England Digital](https://digital.nhs.uk/developer/api-catalogue/fhir-uk-core-standards); [UK Core Observation profile, Simplifier](https://simplifier.net/hl7fhirukcorer4/ukcore-observation)). Health will offer an export of a person's entries as FHIR Observations, so the data is in a form the NHS recognises. It will not send anything to the NHS: the person downloads it and decides what to do with it.

## Outside tools chosen

| Tool | What for | Checked |
| --- | --- | --- |
| react-pdf (`@react-pdf/renderer` 4.9.0, MIT) | The one-page summary as a PDF to print or bring | Supports React 18; updated August 2026 |
| FHIR type definitions (`@types/fhir`, MIT) | Building correct FHIR Observations for the export | Updated October 2026 |
| Vitest | The privacy tests | In use |

## Not verified

- How many people already keep a symptom diary before a GP visit, and what they use. No survey was found.
- Whether GPs find a one-page summary helpful. This needs asking real GPs; the plan is to show a sample to two or three before calling the feature done.
- Named symptom-diary apps and how they compare. Not checked yet, so none are named.
- Whether the FHIR export validates against UK Core in an official validator. To check when it is built.
