import assert from "node:assert/strict";
import test from "node:test";
import {
  DUMMY_DATA_NOTICE,
  RANDOM_STABILITY_ITERATIONS_PER_OFFERING,
  buildSeededDummyTranscript,
} from "../evaluation/dummy-transcripts.ts";
import { runAllProgramStability } from "../evaluation/program-stability.ts";
import { RANDOM_RESIDUAL_ITERATIONS_PER_OFFERING, runResidualCreditStability } from "../evaluation/residual-credit-stability.ts";
import { KMOU_CREDIT_AUDIT_RULES } from "../lib/kmou-program-catalog.ts";

test("더미 성적표는 개인정보가 없는 결정론적 합성 데이터다", () => {
  assert.match(DUMMY_DATA_NOTICE, /합성 성적표/);
  const rule = KMOU_CREDIT_AUDIT_RULES[0];
  const first = buildSeededDummyTranscript(rule, 7);
  const repeated = buildSeededDummyTranscript(rule, 7);
  const different = buildSeededDummyTranscript(rule, 8);
  assert.deepEqual(first, repeated);
  assert.notDeepEqual(first, different);
  assert.ok(first.every((course) => course.professor === "합성데이터"));
});

test("152개 학번×전공 조합에 정상·경계·오류·반복 시나리오를 모두 통과한다", () => {
  const summary = runAllProgramStability();
  assert.deepEqual(summary.admissionYears, [2020, 2021, 2022, 2023, 2024, 2025, 2026]);
  assert.equal(summary.currentUnits, 13);
  assert.equal(summary.stableProgramIds, 23);
  assert.equal(summary.offerings, 152);
  assert.equal(summary.deterministicScenariosPerOffering, 10);
  assert.equal(summary.seededIterationsPerOffering, RANDOM_STABILITY_ITERATIONS_PER_OFFERING);
  assert.equal(summary.deterministicAudits, 1520);
  assert.equal(summary.seededAudits, 4864);
  assert.equal(summary.totalAudits, 6384);
  assert.equal(summary.exactRegistryChecks, 152);
  assert.equal(summary.isolationChecks, 152);
});

test("152개 학번×전공 조합의 잔여 일반선택 회계 불변식을 38,912회 교차검증한다", () => {
  const summary = runResidualCreditStability();
  assert.equal(summary.offerings, 152);
  assert.equal(summary.iterations, RANDOM_RESIDUAL_ITERATIONS_PER_OFFERING);
  assert.equal(summary.audits, 38912);
  assert.ok(summary.partialAudits > 0);
});
