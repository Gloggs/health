// lib/crypt.js: people's words are encrypted before they are saved.
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.HEALTH_DATA_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="; // test-only key (32 zero bytes)
const { encryptText, decryptText, isEncrypted } = await import("../lib/crypt.js");

test("words go in and come back out the same, and the stored form shows none of them", () => {
  const words = "Headache behind my eyes, worse after screens. Ibuprofen 200mg, £3 a box, ✓";
  const stored = encryptText(words);
  assert.ok(isEncrypted(stored));
  assert.ok(!stored.includes("Headache"));
  assert.equal(decryptText(stored), words);
});

test("the same words never look the same twice (a fresh random nonce each time)", () => {
  assert.notEqual(encryptText("same"), encryptText("same"));
});

test("empty values stay empty, and older plain-text rows are still readable", () => {
  assert.equal(encryptText(null), null);
  assert.equal(decryptText(undefined), undefined);
  assert.equal(decryptText("written before encryption"), "written before encryption");
});

test("a changed value is refused instead of shown", () => {
  const stored = encryptText("my words");
  const body = stored.slice("enc:v1:".length);
  const changed = "enc:v1:" + (body[20] === "A" ? body.slice(0, 20) + "B" + body.slice(21) : body.slice(0, 20) + "A" + body.slice(21));
  assert.throws(() => decryptText(changed));
});

test("a missing or wrong-sized key stops the app instead of saving words unprotected", () => {
  const keep = process.env.HEALTH_DATA_KEY;
  process.env.HEALTH_DATA_KEY = "";
  assert.throws(() => encryptText("x"), /HEALTH_DATA_KEY is not set/);
  process.env.HEALTH_DATA_KEY = "c2hvcnQ=";
  assert.throws(() => encryptText("x"), /32 random bytes/);
  process.env.HEALTH_DATA_KEY = keep;
});
