import test from "node:test";
import assert from "node:assert/strict";

import {
  chronoStatusLabel,
  eventTargetsStation,
  formatChrono,
  remainingForTick
} from "./chrono.mjs";

test("formatChrono handles empty and zero values", () => {
  assert.equal(formatChrono(null), "--:--");
  assert.equal(formatChrono(undefined), "--:--");
  assert.equal(formatChrono(0), "00:00");
});

test("formatChrono rounds up partial seconds", () => {
  assert.equal(formatChrono(419.2), "07:00");
  assert.equal(formatChrono(65), "01:05");
});

test("remainingForTick subtracts elapsed local time", () => {
  const tick = { duration: 420, t: 60, receivedAt: 1000, paused: false };
  assert.equal(remainingForTick(tick, 6000), 355);
});

test("remainingForTick does not advance while paused", () => {
  const tick = { duration: 420, t: 60, receivedAt: 1000, paused: true };
  assert.equal(remainingForTick(tick, 60000), 360);
});

test("remainingForTick never goes below zero", () => {
  const tick = { duration: 10, t: 10, receivedAt: 0, paused: false };
  assert.equal(remainingForTick(tick, 5000), 0);
});

test("eventTargetsStation understands all-stations and lists", () => {
  assert.equal(eventTargetsStation("0,13,14", 13), true);
  assert.equal(eventTargetsStation("13,14", 15), false);
  assert.equal(eventTargetsStation("0", 99), true);
  assert.equal(eventTargetsStation("", 13), false);
  assert.equal(eventTargetsStation(null, 13), false);
});

test("chronoStatusLabel shows finished and offline states", () => {
  assert.equal(chronoStatusLabel("finished"), "Tiempo terminado");
  assert.equal(chronoStatusLabel("offline"), "Sin cronómetro · usa el audio");
  assert.equal(chronoStatusLabel("synced", "Entrada"), "Entrada");
});
