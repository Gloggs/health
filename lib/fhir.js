// The person's own entries as an HL7 FHIR R4 Bundle, the data standard the NHS uses (docs/RESEARCH.md).
// It is a download for the person: health never sends it anywhere.
//
// Codes are only used where the meaning is exact, and each was checked on loinc.org (6 November 2026):
//   93832-4 Sleep duration, 29463-7 Body weight. Everything else (symptoms, mood) is the person's own
//   words in code.text, with no code invented for it. Observations claim the UK Core Observation profile
//   (https://fhir.hl7.org.uk/StructureDefinition/UKCore-Observation); not yet checked in an official validator.
//
// No email, date of birth or other identifier is included: only the display name the person chose.

const UKCORE_OBSERVATION = "https://fhir.hl7.org.uk/StructureDefinition/UKCore-Observation";
const PATIENT_REF = { reference: "Patient/me" };
const categoryOf = (code, display) => [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code, display }] }];
const lines = (text) => String(text ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

function observation(id, { category, code, date, value, extra = {} }) {
  return {
    resourceType: "Observation",
    id,
    meta: { profile: [UKCORE_OBSERVATION] },
    status: "final",
    category,
    code,
    subject: PATIENT_REF,
    effectiveDateTime: date,
    ...value,
    ...extra,
  };
}

export function buildFhirBundle({ name, generatedAt, feelings = [], sleep = [], body = [], mood = [], appointment = null }) {
  const entries = [];
  const add = (resource) => entries.push({ fullUrl: `urn:health:${resource.resourceType}/${resource.id}`, resource });

  add({ resourceType: "Patient", id: "me", name: [{ text: name || "Me" }] });

  for (const f of feelings) {
    if (!f?.what) continue;
    const notes = [f.better ? `Better with: ${f.better}` : null, f.worse ? `Worse with: ${f.worse}` : null, f.note || null].filter(Boolean);
    add(observation(`feeling-${f.id}`, {
      category: categoryOf("survey", "Survey"),
      code: { text: String(f.what) },
      date: f.date,
      value: f.howBad ? { valueString: f.howBad } : {},
      extra: {
        ...(f.whereOnBody ? { bodySite: { text: f.whereOnBody } } : {}),
        ...(notes.length ? { note: notes.map((text) => ({ text })) } : {}),
      },
    }));
  }

  for (const s of sleep) {
    if (s?.hours == null) continue;
    add(observation(`sleep-${s.id}`, {
      category: categoryOf("activity", "Activity"),
      code: { coding: [{ system: "http://loinc.org", code: "93832-4", display: "Sleep duration" }], text: "Sleep duration" },
      date: s.date,
      value: { valueQuantity: { value: Number(s.hours), unit: "h", system: "http://unitsofmeasure.org", code: "h" } },
    }));
  }

  for (const b of body) {
    if (b?.weightKg == null) continue;
    add(observation(`weight-${b.id}`, {
      category: categoryOf("vital-signs", "Vital Signs"),
      code: { coding: [{ system: "http://loinc.org", code: "29463-7", display: "Body weight" }], text: "Body weight" },
      date: b.date,
      value: { valueQuantity: { value: Number(b.weightKg), unit: "kg", system: "http://unitsofmeasure.org", code: "kg" } },
    }));
  }

  for (const m of mood) {
    if (!m?.mood) continue;
    add(observation(`mood-${m.id}`, {
      category: categoryOf("survey", "Survey"),
      code: { text: "Mood, my own rating from 1 (low) to 5 (great)" },
      date: m.date,
      value: { valueInteger: Number(m.mood) },
    }));
  }

  lines(appointment?.medicines).forEach((text, i) => add({
    resourceType: "MedicationStatement",
    id: `medicine-${i + 1}`,
    status: "active",
    medicationCodeableConcept: { text },
    subject: PATIENT_REF,
    informationSource: PATIENT_REF,
  }));

  return { resourceType: "Bundle", type: "collection", timestamp: generatedAt, entry: entries };
}
