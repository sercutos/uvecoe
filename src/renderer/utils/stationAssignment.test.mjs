import test from "node:test";
import assert from "node:assert/strict";

import { isEvaluatorAssigned } from "./stationAssignment.mjs";

const evaluators = [{ id: 7, email: "evaluator01@uv.es" }];

test("the evaluator assigned to the station can enter", () => {
  assert.equal(
    isEvaluatorAssigned({
      isAdmin: false,
      email: "evaluator01@uv.es",
      id: 7,
      evaluators
    }),
    true
  );
});

test("another evaluator cannot enter", () => {
  assert.equal(
    isEvaluatorAssigned({
      isAdmin: false,
      email: "evaluator02@uv.es",
      id: 8,
      evaluators
    }),
    false
  );
});

test("with no assignments no evaluator can enter", () => {
  assert.equal(
    isEvaluatorAssigned({
      isAdmin: false,
      email: "evaluator01@uv.es",
      id: 7,
      evaluators: []
    }),
    false
  );
});

test("administrators can always enter to configure the laptop", () => {
  assert.equal(
    isEvaluatorAssigned({
      isAdmin: true,
      email: "admin@uv.es",
      id: 1,
      evaluators: []
    }),
    true
  );
});
