import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  KMOU_CREDIT_AUDIT_RULES,
  KMOU_CURRENT_UNIT_COUNT,
  KMOU_PROGRAM_DEFINITIONS,
  KMOU_PROGRAM_OFFERINGS,
  getKmouProgramOffering,
  getKmouProgramOptions,
  normalizeKmouProgramSearchText,
  searchKmouProgramOptions,
} from "../lib/kmou-program-catalog.ts";
import { bundledRuleRegistry } from "../lib/rule-registry.ts";

test("해양과학기술융합대학 전공 카탈로그는 13개 현행 학부(과), 23개 안정 ID, 152개 학번·전공 조합이다", () => {
  assert.equal(KMOU_CURRENT_UNIT_COUNT, 13);
  assert.equal(KMOU_PROGRAM_DEFINITIONS.length, 23);
  assert.equal(KMOU_PROGRAM_OFFERINGS.length, 152);
  assert.deepEqual(
    Object.fromEntries([2020, 2021, 2022, 2023, 2024, 2025, 2026].map((year) => [year, getKmouProgramOptions(year).length])),
    { 2020: 22, 2021: 22, 2022: 22, 2023: 22, 2024: 22, 2025: 21, 2026: 21 },
  );
});

test("모든 학번·전공 키는 유일하고 편제 영역 합계가 총 졸업학점과 일치한다", () => {
  const keys = new Set();
  for (const offering of KMOU_PROGRAM_OFFERINGS) {
    const key = `${offering.universityId}:${offering.admissionYear}:${offering.programId}`;
    assert.equal(keys.has(key), false, `${key} 중복`);
    keys.add(key);
    const sum = Object.entries(offering.creditSummary)
      .filter(([name]) => name !== "total")
      .reduce((total, [, value]) => total + value, 0);
    assert.equal(sum, offering.creditSummary.total, key);
  }
  assert.equal(KMOU_CREDIT_AUDIT_RULES.length, KMOU_PROGRAM_OFFERINGS.length);
  for (const rule of KMOU_CREDIT_AUDIT_RULES) {
    assert.equal(rule.credits.reduce((sum, item) => sum + item.required, 0), rule.requiredTotal, rule.version);
  }
});

test("2022 환경공학 편제는 공식 전기 22·전필 37·전선 23·총 140학점을 사용한다", () => {
  const offering = getKmouProgramOffering(2022, "environmental-engineering");
  assert.ok(offering);
  assert.equal(offering.creditSummary.majorFoundation, 22);
  assert.equal(offering.creditSummary.minimumMajorRequired + offering.creditSummary.advancedMajorRequired, 37);
  assert.equal(offering.creditSummary.minimumMajorElective + offering.creditSummary.advancedMajorElective, 23);
  assert.equal(offering.creditSummary.total, 140);
});

test("152개 편제학점 배열은 각 학년도 공식 교육과정 추출 원문에 존재한다", async () => {
  for (const year of [2020, 2021, 2022, 2023, 2024, 2025, 2026]) {
    const officialText = (await readFile(new URL(`../data/extracted/kmou/${year}/${year}_official_curriculum.txt`, import.meta.url), "utf8"))
      .replace(/\(\d+\)/g, "")
      .replace(/\s+/g, " ");
    for (const offering of KMOU_PROGRAM_OFFERINGS.filter((item) => item.admissionYear === year)) {
      const summary = offering.creditSummary;
      const sourceOrder = year <= 2021
        ? [summary.total, summary.generalRequired, summary.generalElective, summary.majorFoundation, summary.minimumMajorRequired, summary.minimumMajorElective, summary.advancedMajorRequired, summary.advancedMajorElective, summary.freeElective]
        : [summary.generalElective, summary.generalRequired, summary.majorFoundation, summary.minimumMajorElective, summary.minimumMajorRequired, summary.advancedMajorElective, summary.advancedMajorRequired, summary.freeElective, summary.total];
      assert.match(officialText, new RegExp(sourceOrder.join("\\s+")), `${year} ${offering.programId}`);
    }
  }
});

test("학제 개편 전후 이름과 유효 기간을 분리한다", () => {
  assert.match(getKmouProgramOffering(2020, "computer-engineering").displayName, /IT융합전공/);
  assert.equal(getKmouProgramOffering(2020, "computer-engineering").curriculumCollegeName, "공과대학");
  assert.equal(getKmouProgramOffering(2020, "ocean-engineering").curriculumCollegeName, "해양과학기술대학");
  assert.equal(getKmouProgramOffering(2021, "computer-engineering").curriculumCollegeName, "해양과학기술융합대학");
  assert.match(getKmouProgramOffering(2023, "computer-engineering").displayName, /컴퓨터공학전공/);
  assert.ok(getKmouProgramOffering(2024, "marine-architecture-disaster-prevention"));
  assert.equal(getKmouProgramOffering(2025, "marine-architecture-disaster-prevention"), null);
  assert.ok(getKmouProgramOffering(2025, "marine-architecture-engineering"));
  assert.equal(getKmouProgramOffering(2024, "marine-architecture-engineering"), null);
});

test("전공 검색은 당시 명칭·현행 학부(과)·과거 별칭을 찾되 선택 학번 범위를 넘지 않는다", () => {
  assert.equal(normalizeKmouProgramSearchText("  IT·융합 전공 "), "it융합전공");
  assert.deepEqual(searchKmouProgramOptions(2022, "컴퓨터").map((item) => item.programId), ["computer-engineering"]);
  assert.deepEqual(searchKmouProgramOptions(2022, "자동 제어").map((item) => item.programId), ["intelligent-control-systems-engineering"]);
  assert.deepEqual(searchKmouProgramOptions(2022, "전자소재").map((item) => item.programId), ["nano-semiconductor-engineering"]);
  assert.deepEqual(searchKmouProgramOptions(2020, "IT 융합").map((item) => item.programId), ["computer-engineering"]);
  assert.deepEqual(searchKmouProgramOptions(2025, "건축방재"), []);
  assert.deepEqual(searchKmouProgramOptions(2025, "해양건축").map((item) => item.programId), ["marine-architecture-engineering"]);
  assert.equal(searchKmouProgramOptions(2026, "").length, getKmouProgramOptions(2026).length);
});

test("규칙 레지스트리는 정확한 학교·학번·전공 키만 반환하고 다른 전공을 상속하지 않는다", () => {
  const detailed = bundledRuleRegistry.find({ universityId: "kmou", admissionYear: 2022, departmentId: "computer-engineering" });
  const intelligentControl = bundledRuleRegistry.find({ universityId: "kmou", admissionYear: 2022, departmentId: "intelligent-control-systems-engineering" });
  assert.equal(detailed.version, "KMOU-2022-CE-CURRICULUM-v1.7.0");
  assert.match(intelligentControl.version, /CREDIT-v0\.23\.0-alpha\.1$/);
  assert.equal(detailed.majorCourseCatalog?.status, "verified");
  assert.equal(intelligentControl.majorCourseCatalog?.sourceId, "kmou-2022-intelligent-control-systems-engineering-detailed-curriculum");
  assert.deepEqual(intelligentControl.requiredCourses, []);
  assert.equal(bundledRuleRegistry.find({ universityId: "kmou", admissionYear: 2025, departmentId: "marine-architecture-disaster-prevention" }), null);
  assert.equal(bundledRuleRegistry.find({ universityId: "other", admissionYear: 2022, departmentId: "computer-engineering" }), null);
});
