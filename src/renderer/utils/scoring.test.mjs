import test from "node:test";
import assert from "node:assert/strict";

import {
  pointsForToggle,
  reorderStudentsForStation
} from "./scoring.mjs";

const students = Array.from({ length: 12 }, (_, index) => ({
  id_estudiante: index + 1
}));

function orderFor(stationOrder) {
  return reorderStudentsForStation(students, stationOrder).map(
    (student) => student.id_estudiante
  );
}

test("station 1 starts with student 1 and rotates backwards", () => {
  assert.deepEqual(orderFor(1), [1, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
});

test("station 2 starts with student 2", () => {
  assert.deepEqual(orderFor(2), [2, 1, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
});

test("last station starts with the last student", () => {
  assert.deepEqual(orderFor(12), [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
});

test("station order wraps around and empty lists are safe", () => {
  assert.deepEqual(orderFor(13), orderFor(1));
  assert.deepEqual(reorderStudentsForStation([], 1), []);
});

test("unchecked answers are worth 0", () => {
  assert.equal(pointsForToggle({ options: [{ points: "0.5" }] }, false), 0);
});

test("checked answers use the option points", () => {
  assert.equal(pointsForToggle({ options: [{ points: "0.5" }] }, true), 0.5);
});

test("checked answers without options stay at 0", () => {
  assert.equal(pointsForToggle({ options: [] }, true), 0);
});

test("invalid option points stay at 0", () => {
  assert.equal(
    pointsForToggle({ options: [{ points: "no-es-un-numero" }] }, true),
    0
  );
});
