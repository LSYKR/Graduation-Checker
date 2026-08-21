import assert from "node:assert/strict";
import {
  DUMMY_CATEGORY_KEYS,
  RANDOM_STABILITY_ITERATIONS_PER_OFFERING,
  buildRequirementDummyTranscript,
  buildSeededDummyTranscript,
} from "./dummy-transcripts";
import { auditTranscript } from "@/lib/graduation-engine";
import {
  KMOU_CREDIT_AUDIT_RULES,
  KMOU_CURRENT_UNIT_COUNT,
  KMOU_PROGRAM_DEFINITIONS,
  KMOU_PROGRAM_OFFERINGS,
} from "@/lib/kmou-program-catalog";
import { bundledRuleRegistry } from "@/lib/rule-registry";
import type { CategoryKey, DetailedAudit, GraduationRuleSet, TranscriptCourse } from "@/lib/types";

export interface ProgramStabilitySummary {
  currentUnits: number;
  stableProgramIds: number;
  offerings: number;
  admissionYears: number[];
  deterministicScenariosPerOffering: number;
  seededIterationsPerOffering: number;
  deterministicAudits: number;
  seededAudits: number;
  totalAudits: number;
  exactRegistryChecks: number;
  isolationChecks: number;
}

function dedupePassed(courses: TranscriptCourse[]): TranscriptCourse[] {
  const seen = new Map<string, TranscriptCourse>();
  for (const course of courses.filter((item) => item.passed)) {
    const key = course.code ? `code:${course.code.toUpperCase()}` : `name:${course.name}`;
    const previous = seen.get(key);
    if (!previous || course.credits > previous.credits) seen.set(key, course);
  }
  return [...seen.values()];
}

function expectedByCategory(courses: TranscriptCourse[]): Record<CategoryKey, number> {
  const expected = Object.fromEntries(DUMMY_CATEGORY_KEYS.map((key) => [key, 0])) as Record<CategoryKey, number>;
  for (const course of dedupePassed(courses)) expected[course.category] += course.credits;
  return expected;
}

function validateAudit(
  rule: GraduationRuleSet,
  courses: TranscriptCourse[],
  audit: DetailedAudit,
  scenario: string,
): void {
  const context = `${rule.key.admissionYear}:${rule.key.departmentId}:${scenario}`;
  const passed = dedupePassed(courses);
  const expected = expectedByCategory(courses);
  const expectedTotal = passed.reduce((sum, course) => sum + course.credits, 0);
  const majorKeys = new Set<CategoryKey>(["majorFoundation", "majorRequired", "majorElective"]);
  const expectedApplicable = DUMMY_CATEGORY_KEYS
    .filter((category) => !majorKeys.has(category))
    .reduce((sum, category) => sum + expected[category], 0);
  const freeRequirement = rule.credits.find((category) => category.key === "freeElective")?.required ?? 0;
  const verifiedNonMajorSurplus = (["generalRequired", "generalElective"] as const).reduce((sum, key) => {
    const required = rule.credits.find((category) => category.key === key)?.required ?? 0;
    return sum + Math.max(0, expected[key] - required);
  }, 0);
  const expectedEffectiveFreeElective = expected.freeElective + verifiedNonMajorSurplus;
  const expectedFreeElectiveStatus = expectedEffectiveFreeElective >= freeRequirement ? "evaluated" : "not-evaluable";

  assert.equal(audit.profile.admissionYear, rule.key.admissionYear, context);
  assert.equal(audit.profile.departmentId, rule.key.departmentId, context);
  assert.equal(audit.requiredTotal, rule.requiredTotal, context);
  assert.equal(audit.earnedTotal, expectedTotal, context);
  assert.equal(audit.applicableEarnedTotal, expectedApplicable, context);
  assert.equal(audit.passedCourseCount, passed.length, context);
  assert.equal(audit.overallStatus, "not-evaluable", context);
  assert.equal(audit.courseMatch?.status, "not-evaluable", context);
  assert.equal(audit.categories.length, rule.credits.length, context);
  assert.equal(audit.residualCredits?.transferredSurplusCredits, verifiedNonMajorSurplus, `${context}:residual-transfer`);
  assert.equal(audit.residualCredits?.effectiveFreeElectiveCredits, expectedEffectiveFreeElective, `${context}:residual-effective`);
  for (const category of audit.categories) {
    const expectedEarned = majorKeys.has(category.key) ? 0 : category.key === "freeElective" ? expectedEffectiveFreeElective : expected[category.key];
    const expectedStatus = majorKeys.has(category.key) ? "not-evaluable" : category.key === "freeElective" ? expectedFreeElectiveStatus : "evaluated";
    assert.equal(category.earned, expectedEarned, `${context}:${category.key}`);
    assert.equal(category.evaluationStatus, expectedStatus, `${context}:${category.key}:status`);
    if (majorKeys.has(category.key)) assert.equal(category.reportedEarned, expected[category.key], `${context}:${category.key}:reported`);
    assert.ok(Number.isFinite(category.earned), `${context}:${category.key}:finite`);
    assert.ok(category.earned >= 0, `${context}:${category.key}:nonnegative`);
  }
  assert.equal(audit.missingCourses.length, 0, context);
  assert.equal(
    audit.forecastCredits,
    Math.max(0, rule.requiredTotal - expectedTotal),
    context,
  );
}

function auditDummy(rule: GraduationRuleSet, courses: TranscriptCourse[], scenario: string): DetailedAudit {
  const audit = auditTranscript(courses, rule, {
    universityId: "kmou",
    admissionYear: rule.key.admissionYear,
    departmentId: rule.key.departmentId,
    department: rule.profileLabel,
    studentType: "freshman",
    studentTypeLabel: "신입학",
  });
  validateAudit(rule, courses, audit, scenario);
  return audit;
}

export function runAllProgramStability(
  seededIterations = RANDOM_STABILITY_ITERATIONS_PER_OFFERING,
): ProgramStabilitySummary {
  assert.equal(KMOU_CREDIT_AUDIT_RULES.length, KMOU_PROGRAM_OFFERINGS.length);
  const rules = new Map(KMOU_CREDIT_AUDIT_RULES.map((rule) => [
    `${rule.key.admissionYear}:${rule.key.departmentId}`,
    rule,
  ]));
  let deterministicAudits = 0;
  let seededAudits = 0;
  let exactRegistryChecks = 0;
  let isolationChecks = 0;

  for (const offering of KMOU_PROGRAM_OFFERINGS) {
    const key = `${offering.admissionYear}:${offering.programId}`;
    const rule = rules.get(key);
    assert.ok(rule, `${key}:credit-rule`);
    assert.deepEqual(rule.key, {
      universityId: "kmou",
      admissionYear: offering.admissionYear,
      departmentId: offering.programId,
    });
    assert.equal(rule.requiredCourses.length, 0, `${key}:credit-only-rule`);

    const registered = bundledRuleRegistry.find(rule.key);
    assert.ok(registered, `${key}:registry`);
    assert.deepEqual(registered.key, rule.key, `${key}:registry-exact-key`);
    exactRegistryChecks += 1;
    assert.equal(bundledRuleRegistry.find({ ...rule.key, departmentId: `${rule.key.departmentId}-unknown` }), null);
    isolationChecks += 1;

    const required = Object.fromEntries(rule.credits.map((item) => [item.key, item.required])) as Record<CategoryKey, number>;
    const exact = buildRequirementDummyTranscript(rule);
    const exactAudit = auditDummy(rule, exact, "exact-minimum");
    deterministicAudits += 1;
    assert.equal(exactAudit.earnedTotal, rule.requiredTotal, `${key}:exact-total`);
    assert.equal(exactAudit.forecastCredits, 0, `${key}:exact-forecast`);

    for (const category of DUMMY_CATEGORY_KEYS) {
      const target = Math.max(0, (required[category] ?? 0) - 1);
      const boundary = buildRequirementDummyTranscript(rule, { [category]: target });
      const boundaryAudit = auditDummy(rule, boundary, `one-credit-boundary:${category}`);
      deterministicAudits += 1;
      const progress = boundaryAudit.categories.find((item) => item.key === category);
      assert.ok(progress, `${key}:${category}:progress`);
      assert.equal(progress.earned, ["majorFoundation", "majorRequired", "majorElective"].includes(category) ? 0 : target, `${key}:${category}:earned`);
      if (["majorFoundation", "majorRequired", "majorElective"].includes(category)) {
        assert.equal(progress.reportedEarned, target, `${key}:${category}:reported-earned`);
      }
      assert.equal(boundaryAudit.forecastCredits, required[category] > 0 ? 1 : 0, `${key}:${category}:forecast`);
    }

    const duplicated = exact.length ? [
      ...exact,
      { ...exact[0], rowNumber: exact.length + 2, code: exact[0].code.toLowerCase(), grade: "B0" },
    ] : exact;
    const duplicateAudit = auditDummy(rule, duplicated, "duplicate-retake");
    deterministicAudits += 1;
    assert.equal(duplicateAudit.earnedTotal, rule.requiredTotal, `${key}:duplicate-total`);

    const failed = [
      ...exact,
      {
        ...exact[0],
        rowNumber: exact.length + 3,
        code: `${exact[0].code}-FAILED`,
        name: "합성 낙제 제외 과목",
        credits: 3,
        grade: "F",
        passed: false,
      },
    ];
    const failedAudit = auditDummy(rule, failed, "failed-course-excluded");
    deterministicAudits += 1;
    assert.equal(failedAudit.earnedTotal, rule.requiredTotal, `${key}:failed-total`);

    const overflowCategory = rule.credits[0].key;
    const overflow = buildRequirementDummyTranscript(rule, { [overflowCategory]: required[overflowCategory] + 3 });
    const overflowAudit = auditDummy(rule, overflow, "three-credit-overflow");
    deterministicAudits += 1;
    assert.equal(overflowAudit.earnedTotal, rule.requiredTotal + 3, `${key}:overflow-total`);
    assert.equal(overflowAudit.forecastCredits, 0, `${key}:overflow-forecast`);

    for (let iteration = 0; iteration < seededIterations; iteration += 1) {
      auditDummy(rule, buildSeededDummyTranscript(rule, iteration), `seeded-${iteration}`);
      seededAudits += 1;
    }
  }

  return {
    currentUnits: KMOU_CURRENT_UNIT_COUNT,
    stableProgramIds: KMOU_PROGRAM_DEFINITIONS.length,
    offerings: KMOU_PROGRAM_OFFERINGS.length,
    admissionYears: [...new Set(KMOU_PROGRAM_OFFERINGS.map((item) => item.admissionYear))].sort(),
    deterministicScenariosPerOffering: 10,
    seededIterationsPerOffering: seededIterations,
    deterministicAudits,
    seededAudits,
    totalAudits: deterministicAudits + seededAudits,
    exactRegistryChecks,
    isolationChecks,
  };
}
