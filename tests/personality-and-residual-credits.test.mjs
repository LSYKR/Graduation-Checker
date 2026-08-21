import assert from "node:assert/strict";
import test from "node:test";
import { applyResidualFreeElectivePolicy, calculateGeneralEducationCreditShortage, calculateMinimumGraduationCreditShortage } from "../lib/graduation-engine.ts";
import { evaluateGeneralEducation } from "../lib/general-education-engine.ts";
import { KMOU_PROGRAM_OFFERINGS } from "../lib/kmou-program-catalog.ts";
import { getKmouPersonalityOptionalProgramIds } from "../lib/kmou-personality-general-education.ts";
import { getVerifiedGeneralEducationPack } from "../lib/verified-general-education.ts";

const colors = { generalRequired: "#00a58e", generalElective: "#6f7ef7", majorFoundation: "#cf7b35", majorRequired: "#173f63", majorElective: "#a45ec6", freeElective: "#718096" };
const labels = { generalRequired: ["교양필수", "교필"], generalElective: ["교양선택", "교선"], majorFoundation: ["전공기초", "전기"], majorRequired: ["전공필수", "전필"], majorElective: ["전공선택", "전선"], freeElective: ["일반선택", "일선"] };
function category(key, earned, required, evaluationStatus = "evaluated") { return { key, label: labels[key][0], shortLabel: labels[key][1], earned, required, color: colors[key], evaluationStatus }; }
function creditRows({ generalRequired = [0, 0, "evaluated"], generalElective = [0, 0, "evaluated"], majorFoundation = [0, 0, "evaluated"], majorRequired = [0, 0, "evaluated"], majorElective = [0, 0, "evaluated"], freeElective = [0, 0, "evaluated"] } = {}) {
  return [category("generalRequired", ...generalRequired), category("generalElective", ...generalElective), category("majorFoundation", ...majorFoundation), category("majorRequired", ...majorRequired), category("majorElective", ...majorElective), category("freeElective", ...freeElective)];
}
function transcriptCourse(code, name, credits, category = "generalElective") { return { rowNumber: 1, year: "2024", semester: "1학기", code, name, rawCategory: category === "generalRequired" ? "교양필수" : "교양선택", category, credits, grade: "A+", professor: "", englishName: "", passed: true, transferCredit: false, reclassified: false }; }

test("2020~2024 모든 유효 전공에는 앵커스피릿을, 학과별 적용군에만 인성 선택을 붙인다", () => {
  const optionalCounts = { 2020: 12, 2021: 14, 2022: 14, 2023: 14, 2024: 14 };
  for (const year of [2020, 2021, 2022, 2023, 2024]) {
    assert.equal(getKmouPersonalityOptionalProgramIds(year).length, optionalCounts[year]);
    for (const offering of KMOU_PROGRAM_OFFERINGS.filter((item) => item.admissionYear === year)) {
      const pack = getVerifiedGeneralEducationPack({ universityId: "kmou", admissionYear: year, departmentId: offering.programId });
      assert.ok(pack);
      const required = pack.rule.generalEducationAreas.find((area) => area.id === "personality-required");
      const elective = pack.rule.generalEducationAreas.find((area) => area.id === "personality-elective");
      assert.ok(required, `${year}:${offering.programId}`);
      assert.deepEqual(required.eligibleCourses.map((item) => item.code), [year <= 2022 ? "L4109" : "L4115"]);
      assert.equal(required.minimumCredits, year <= 2022 ? 2 : 1);
      assert.equal(Boolean(elective), getKmouPersonalityOptionalProgramIds(year).includes(offering.programId));
      if (elective) { assert.equal(elective.minimumCredits, 2); assert.ok(elective.eligibleCourses.some((item) => item.code === "L3001")); assert.ok(elective.eligibleCourses.some((item) => item.code === "L3003")); }
    }
  }
});

test("2022 컴퓨터공학은 앵커스피릿만 요구하고 윤리 과목을 별도 필수로 오판하지 않는다", () => {
  const pack = getVerifiedGeneralEducationPack({ universityId: "kmou", admissionYear: 2022, departmentId: "computer-engineering" }); assert.ok(pack);
  assert.equal(pack.rule.generalEducationAreas.some((area) => area.id === "personality-elective"), false);
  assert.ok(pack.verifiedNonTargetCourseCodes.includes("L3001"));
  const audit = evaluateGeneralEducation([transcriptCourse("L4109", "앵커스피릿", 2, "generalRequired"), transcriptCourse("L3001", "윤리와인간", 2)], pack.rule, { verifiedNonTargetCourseCodes: pack.verifiedNonTargetCourseCodes });
  assert.equal(audit.areas.find((area) => area.id === "personality-required").status, "satisfied");
  assert.equal(audit.unmappedGeneralElectives.some((course) => course.code === "L3001"), false);
});

test("2022 환경공학은 앵커스피릿과 인성 선택 2학점을 각각 충족해야 한다", () => {
  const pack = getVerifiedGeneralEducationPack({ universityId: "kmou", admissionYear: 2022, departmentId: "environmental-engineering" }); assert.ok(pack);
  const anchorOnly = evaluateGeneralEducation([transcriptCourse("L4109", "앵커스피릿", 2, "generalRequired")], pack.rule);
  assert.equal(anchorOnly.areas.find((area) => area.id === "personality-required").status, "satisfied");
  assert.equal(anchorOnly.areas.find((area) => area.id === "personality-elective").status, "missing");
  const complete = evaluateGeneralEducation([transcriptCourse("L4109", "앵커스피릿", 2, "generalRequired"), transcriptCourse("L3001", "윤리와인간", 2)], pack.rule);
  assert.equal(complete.areas.find((area) => area.id === "personality-required").status, "satisfied");
  assert.equal(complete.areas.find((area) => area.id === "personality-elective").status, "satisfied");
});

test("2025~2026 개편 교육과정에는 과거 인성·윤리 세부영역을 자동 상속하지 않는다", () => {
  for (const year of [2025, 2026]) for (const offering of KMOU_PROGRAM_OFFERINGS.filter((item) => item.admissionYear === year)) {
    const pack = getVerifiedGeneralEducationPack({ universityId: "kmou", admissionYear: year, departmentId: offering.programId }); assert.ok(pack);
    assert.equal(pack.rule.generalEducationAreas.some((area) => area.id.startsWith("personality-")), false);
  }
});

test("세부영역이 초과돼도 교양선택 전체 최소학점 미달이면 일반선택으로 넘기지 않는다", () => {
  const r = applyResidualFreeElectivePolicy(creditRows({ generalRequired: [26, 26], generalElective: [15, 17], majorFoundation: [15, 15], majorRequired: [60, 60], majorElective: [12, 12], freeElective: [5, 10] }));
  assert.equal(r.residualCredits.verifiedSurplusCredits, 0); assert.equal(r.residualCredits.appliedSurplusCredits, 0); assert.equal(r.residualCredits.effectiveFreeElectiveCredits, 5); assert.equal(r.residualCredits.remainingFreeElectiveCredits, 5);
});

test("교양·전공 전체 기준을 넘긴 학점은 일반선택 잔여학점으로 전부 보존한다", () => {
  const r = applyResidualFreeElectivePolicy(creditRows({ generalRequired: [26, 26], generalElective: [20, 17], majorFoundation: [16, 15], majorRequired: [60, 60], majorElective: [12, 12], freeElective: [5, 10] }));
  const free = r.categories.find((item) => item.key === "freeElective"); assert.equal(r.residualCredits.verifiedSurplusCredits, 4); assert.equal(r.residualCredits.appliedSurplusCredits, 4); assert.equal(r.residualCredits.effectiveFreeElectiveCredits, 9); assert.equal(r.residualCredits.remainingFreeElectiveCredits, 1); assert.equal(free.earned, 9); assert.equal(free.reportedEarned, 5);
});

test("직접 일반선택이 이미 충분해도 초과 이동학점을 숨기지 않고 별도 보존한다", () => {
  const r = applyResidualFreeElectivePolicy(creditRows({ generalElective: [25, 17], freeElective: [10, 10] })); assert.equal(r.residualCredits.verifiedSurplusCredits, 8); assert.equal(r.residualCredits.transferredSurplusCredits, 8); assert.equal(r.residualCredits.effectiveFreeElectiveCredits, 18); assert.equal(r.residualCredits.excessFreeElectiveCredits, 8);
});

test("전공 검수 전에는 알려진 초과만 표시하고 일반선택 미달을 확정하지 않는다", () => {
  const r = applyResidualFreeElectivePolicy(creditRows({ generalElective: [19, 17], majorFoundation: [0, 15, "not-evaluable"], majorRequired: [0, 60, "not-evaluable"], majorElective: [0, 12, "not-evaluable"], freeElective: [5, 10] }));
  assert.equal(r.residualCredits.appliedSurplusCredits, 2); assert.equal(r.residualCredits.effectiveFreeElectiveCredits, 7); assert.equal(r.residualCredits.status, "not-evaluable"); assert.equal(r.categories.find((item) => item.key === "freeElective").evaluationStatus, "not-evaluable");
});

test("첨부 환경공학 성적표의 136학점은 일반선택 3 + 교선 초과 3 + 전선 초과 1 = 7학점으로 보존된다", () => {
  const r = applyResidualFreeElectivePolicy(creditRows({ generalRequired: [30, 30], generalElective: [20, 17], majorFoundation: [22, 22], majorRequired: [37, 37], majorElective: [24, 23], freeElective: [3, 11] }));
  assert.equal(r.residualCredits.rawFreeElectiveCredits, 3);
  assert.equal(r.residualCredits.transferredSurplusCredits, 4);
  assert.equal(r.residualCredits.effectiveFreeElectiveCredits, 7);
  assert.equal(r.residualCredits.remainingFreeElectiveCredits, 4);
  assert.equal(r.residualCredits.minimumAllocatedCredits, 129);
  assert.equal(r.residualCredits.reconciledKnownCredits, 136);
});

test("교양 개별영역과 결합영역의 부족학점은 같은 과목으로 채울 수 있는 부분을 중복 계산하지 않는다", () => {
  const audit = {
    areas: [
      { id: "history", earned: 5, required: 4, status: "satisfied", matchedCourses: [], label: "역사", parentArea: "균형" },
      { id: "social", earned: 2, required: 4, status: "missing", matchedCourses: [], label: "사회", parentArea: "균형" },
      { id: "marine", earned: 0, required: 2, status: "missing", matchedCourses: [], label: "해양", parentArea: "특화" },
    ],
    combinedRequirements: [{ id: "history-social", label: "역사+사회", areaIds: ["history", "social"], earned: 7, required: 9, status: "missing", matchedCourses: [] }],
    unmappedGeneralElectives: [], mappingConflicts: [], conclusive: true,
  };
  assert.equal(calculateGeneralEducationCreditShortage(audit), 4);
  assert.equal(calculateGeneralEducationCreditShortage({ ...audit, conclusive: false }), undefined);
});

test("서로 다른 교양필수·교양선택 부족은 전체학점이 겹쳐 보여도 각각 합산한다", () => {
  const categories = creditRows({
    generalRequired: [8, 10],
    generalElective: [10, 10],
  });
  const generalEducation = {
    areas: [
      { id: "social", earned: 2, required: 4, status: "missing", matchedCourses: [], label: "사회", parentArea: "균형", creditCategory: "generalElective" },
    ],
    combinedRequirements: [
      { id: "social-combined", label: "사회 합계", areaIds: ["social"], earned: 2, required: 4, status: "missing", matchedCourses: [] },
    ],
    unmappedGeneralElectives: [], mappingConflicts: [], conclusive: true,
  };
  assert.equal(calculateMinimumGraduationCreditShortage({
    categories,
    generalEducation,
    missingCourses: [],
    requiredTotal: 20,
    applicableEarnedTotal: 18,
  }), 4);
});

test("교양 세부영역 보완학점은 잔여 일반선택과 총학점 부족분도 함께 채운다", () => {
  const categories = creditRows({
    generalRequired: [30, 30],
    generalElective: [20, 17],
    majorFoundation: [22, 22],
    majorRequired: [37, 37],
    majorElective: [24, 23],
    freeElective: [7, 11],
  });
  const generalEducation = {
    areas: [
      { id: "history", earned: 5, required: 4, status: "satisfied", matchedCourses: [], label: "역사", parentArea: "균형", creditCategory: "generalElective" },
      { id: "social", earned: 2, required: 4, status: "missing", matchedCourses: [], label: "사회", parentArea: "균형", creditCategory: "generalElective" },
    ],
    combinedRequirements: [
      { id: "history-social", label: "역사+사회", areaIds: ["history", "social"], earned: 7, required: 9, status: "missing", matchedCourses: [] },
    ],
    unmappedGeneralElectives: [], mappingConflicts: [], conclusive: true,
  };
  assert.equal(calculateMinimumGraduationCreditShortage({
    categories,
    generalEducation,
    missingCourses: [],
    requiredTotal: 140,
    applicableEarnedTotal: 136,
  }), 4);
});
