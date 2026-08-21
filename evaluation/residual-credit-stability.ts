import assert from "node:assert/strict";
import { applyResidualFreeElectivePolicy } from "@/lib/graduation-engine";
import { KMOU_PROGRAM_OFFERINGS } from "@/lib/kmou-program-catalog";
import { bundledRuleRegistry } from "@/lib/rule-registry";
import type { CategoryKey, CategoryProgress } from "@/lib/types";

export const RANDOM_RESIDUAL_ITERATIONS_PER_OFFERING = 256;
const SOURCE_KEYS: Array<Exclude<CategoryKey, "freeElective">> = ["generalRequired", "generalElective", "majorFoundation", "majorRequired", "majorElective"];

function randomFor(seedText: string): () => number {
  let state = 2166136261;
  for (const character of seedText) {
    state ^= character.codePointAt(0) ?? 0;
    state = Math.imul(state, 16777619);
  }
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function halfCredit(value: number): number {
  return Math.round(value * 2) / 2;
}

export function runResidualCreditStability(iterations = RANDOM_RESIDUAL_ITERATIONS_PER_OFFERING) {
  let audits = 0;
  let partialAudits = 0;
  for (const offering of KMOU_PROGRAM_OFFERINGS) {
    const rule = bundledRuleRegistry.find({ universityId: "kmou", admissionYear: offering.admissionYear, departmentId: offering.programId });
    assert.ok(rule);
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const random = randomFor(`${offering.admissionYear}:${offering.programId}:${iteration}:residual`);
      const categories = rule.credits.map((requirement): CategoryProgress => {
        const mayBeUnknown = ["majorFoundation", "majorRequired", "majorElective"].includes(requirement.key);
        const evaluationStatus = mayBeUnknown && random() < 0.22 ? "not-evaluable" as const : "evaluated" as const;
        const earned = halfCredit(random() * (requirement.required + 24));
        return { ...requirement, earned: evaluationStatus === "evaluated" ? earned : 0, reportedEarned: mayBeUnknown ? earned : undefined, evaluationStatus };
      });
      const free = categories.find((category) => category.key === "freeElective");
      assert.ok(free);
      const evaluatedSources = SOURCE_KEYS.map((key) => categories.find((category) => category.key === key))
        .filter((category): category is CategoryProgress => Boolean(category) && category.evaluationStatus === "evaluated");
      const knownSourceCredits = evaluatedSources.reduce((sum, category) => sum + category.earned, 0);
      const allocatedMinimum = evaluatedSources.reduce((sum, category) => sum + Math.min(category.earned, category.required), 0);
      const expectedResidual = free.earned + knownSourceCredits - allocatedMinimum;
      const unknownSources = SOURCE_KEYS.some((key) => categories.find((category) => category.key === key)?.evaluationStatus === "not-evaluable");
      const expectedStatus = expectedResidual >= free.required || !unknownSources ? "evaluated" : "not-evaluable";

      const result = applyResidualFreeElectivePolicy(categories);
      const residual = result.residualCredits;
      assert.ok(residual);
      assert.equal(residual.effectiveFreeElectiveCredits, expectedResidual);
      assert.equal(residual.minimumAllocatedCredits, allocatedMinimum);
      assert.equal(residual.reconciledKnownCredits, free.earned + knownSourceCredits);
      assert.equal(residual.remainingFreeElectiveCredits, Math.max(0, free.required - expectedResidual));
      assert.equal(residual.excessFreeElectiveCredits, Math.max(0, expectedResidual - free.required));
      assert.equal(residual.status, expectedStatus);
      assert.equal(residual.transferredSurplusCredits, residual.sources.reduce((sum, source) => sum + source.surplusCredits, 0));
      assert.ok(residual.effectiveFreeElectiveCredits >= residual.rawFreeElectiveCredits);
      assert.ok(Number.isFinite(residual.effectiveFreeElectiveCredits));
      audits += 1;
      if (unknownSources) partialAudits += 1;
    }
  }
  return { offerings: KMOU_PROGRAM_OFFERINGS.length, iterations, audits, partialAudits };
}
