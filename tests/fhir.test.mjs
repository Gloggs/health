import test from "node:test";
import assert from "node:assert/strict";
import { buildFhirBundle } from "../lib/fhir.js";

const input = {
  name: "Ada", generatedAt: "2026-11-06T21:00:00Z",
  feelings: [{ id: 7, date: "2026-11-05", what: "Headache", whereOnBody: "Forehead", howBad: "moderate", better: "Water", worse: "Screens", note: "Woke up with it" }],
  sleep: [{ id: 3, date: "2026-11-05", hours: "6.50" }, { id: 4, date: "2026-11-04", hours: null }],
  body: [{ id: 9, date: "2026-11-01", weightKg: "78.5" }],
  mood: [{ id: 2, date: "2026-11-05", mood: 2 }],
  appointment: { medicines: "Paracetamol\nVitamin D" },
};
const bundle = buildFhirBundle(input);
const of = (type) => bundle.entry.map((e) => e.resource).filter((r) => r.resourceType === type);

test("a FHIR R4 collection Bundle with one Patient carrying only the chosen name", () => {
  assert.equal(bundle.resourceType, "Bundle");
  assert.equal(bundle.type, "collection");
  assert.deepEqual(of("Patient"), [{ resourceType: "Patient", id: "me", name: [{ text: "Ada" }] }]);
  assert.equal(JSON.stringify(bundle).includes("@"), false, "no email anywhere");
});

test("a feeling keeps the person's words: what, where, how bad, and notes", () => {
  const f = of("Observation").find((o) => o.id === "feeling-7");
  assert.equal(f.code.text, "Headache");
  assert.equal(f.code.coding, undefined, "no invented code for a symptom");
  assert.equal(f.valueString, "moderate");
  assert.equal(f.bodySite.text, "Forehead");
  assert.deepEqual(f.note.map((n) => n.text), ["Better with: Water", "Worse with: Screens", "Woke up with it"]);
  assert.equal(f.effectiveDateTime, "2026-11-05");
});

test("sleep and weight use the checked LOINC codes and UCUM units; empty values are skipped", () => {
  const sleep = of("Observation").filter((o) => o.id.startsWith("sleep-"));
  assert.equal(sleep.length, 1);
  assert.equal(sleep[0].code.coding[0].code, "93832-4");
  assert.deepEqual(sleep[0].valueQuantity, { value: 6.5, unit: "h", system: "http://unitsofmeasure.org", code: "h" });
  const w = of("Observation").find((o) => o.id === "weight-9");
  assert.equal(w.code.coding[0].code, "29463-7");
  assert.equal(w.valueQuantity.value, 78.5);
});

test("every Observation claims UK Core and points at the person; medicines are statements", () => {
  for (const o of of("Observation")) {
    assert.deepEqual(o.meta.profile, ["https://fhir.hl7.org.uk/StructureDefinition/UKCore-Observation"]);
    assert.deepEqual(o.subject, { reference: "Patient/me" });
    assert.equal(o.status, "final");
  }
  assert.deepEqual(of("MedicationStatement").map((m) => m.medicationCodeableConcept.text), ["Paracetamol", "Vitamin D"]);
});
