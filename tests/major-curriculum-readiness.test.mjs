import assert from "node:assert/strict";
import test from "node:test";
import {
  MAJOR_CURRICULUM_READINESS,
  getMajorCurriculumReadiness,
  validateMajorCourseCatalogForActivation,
} from "../lib/major-curriculum-readiness.ts";
import { KMOU_PROGRAM_OFFERINGS } from "../lib/kmou-program-catalog.ts";
import { bundledRuleRegistry } from "../lib/rule-registry.ts";
import { getBundledMajorCourseCatalog, getVerifiedRequiredCourseOverlay } from "../lib/verified-major-curricula.ts";
import { getRuleAvailability } from "../lib/rule-availability.ts";

const keyOf = (programId, admissionYear = 2022) => ({ universityId: "kmou", admissionYear, departmentId: programId });

test("2020~2024 상세 110개와 2025~2026 신입생 1학기 부분 42개 조합을 분리 추적한다", () => {
  assert.equal(MAJOR_CURRICULUM_READINESS.length, 152);
  assert.equal(new Set(MAJOR_CURRICULUM_READINESS.map((item) => `${item.admissionYear}:${item.programId}`)).size, 152);
  for (const admissionYear of [2020, 2021, 2022, 2023, 2024]) {
    assert.equal(MAJOR_CURRICULUM_READINESS.filter((item) => item.admissionYear === admissionYear).length, 22);
  }
  for (const admissionYear of [2025, 2026]) {
    assert.equal(MAJOR_CURRICULUM_READINESS.filter((item) => item.admissionYear === admissionYear).length, 21);
  }
  assert.deepEqual(
    Object.fromEntries(["exact-catalog", "partial-required-courses", "source-needed"].map((status) => [status, MAJOR_CURRICULUM_READINESS.filter((item) => item.status === status).length])),
    { "exact-catalog": 110, "partial-required-courses": 42, "source-needed": 0 },
  );
});

test("상세·부분 상태는 실제 번들 카탈로그 및 부분 오버레이와 과목 수까지 일치한다", () => {
  for (const record of MAJOR_CURRICULUM_READINESS) {
    const key = keyOf(record.programId, record.admissionYear);
    const catalog = getBundledMajorCourseCatalog(key);
    const overlay = getVerifiedRequiredCourseOverlay(key);
    if (record.status === "exact-catalog") {
      assert.ok(catalog, record.programId);
      assert.equal(catalog.entries.length, record.courseCount, record.programId);
      assert.equal(catalog.requiredCourseSetStatus, record.requiredCourseSetStatus, record.programId);
      assert.equal(overlay, null, record.programId);
    } else if (record.status === "partial-required-courses") {
      assert.equal(catalog, null, record.programId);
      assert.ok(overlay, record.programId);
      assert.equal(overlay.classificationEntries.length, record.courseCount, record.programId);
      assert.equal(overlay.courses.length, record.requiredCourseCount, record.programId);
    } else {
      assert.equal(catalog, null, record.programId);
      assert.equal(overlay, null, record.programId);
      assert.deepEqual(bundledRuleRegistry.find(key)?.requiredCourses, [], record.programId);
    }
  }
});

test("상세 전공표 승격 검증기는 정확 학번·전공·원본해시와 과목 필드를 모두 강제한다", () => {
  for (const record of MAJOR_CURRICULUM_READINESS.filter((item) => item.status === "exact-catalog")) {
    const key = keyOf(record.programId, record.admissionYear);
    const rule = bundledRuleRegistry.find(key);
    assert.ok(rule?.majorCourseCatalog, record.programId);
    assert.deepEqual(validateMajorCourseCatalogForActivation(key, rule.majorCourseCatalog, rule.sources), [], record.programId);
  }

  const sourceRule = bundledRuleRegistry.find(keyOf("electronic-communications-engineering"));
  const unsafe = structuredClone(sourceRule.majorCourseCatalog);
  unsafe.entries[0].code = "";
  unsafe.entries[1].name = "";
  unsafe.sources[0].appliesToDepartmentIds = ["computer-engineering"];
  unsafe.sources[0].fileHash = "missing";
  const errors = validateMajorCourseCatalogForActivation(keyOf("electronic-communications-engineering"), unsafe, []);
  assert.ok(errors.some((item) => item.includes("과목코드")));
  assert.ok(errors.some((item) => item.includes("과목명이")));
  assert.ok(errors.some((item) => item.includes("적용 전공")));
  assert.ok(errors.some((item) => item.includes("SHA-256")));
});

test("학과 커버리지 표시는 2020~2024 상세와 2025~2026 부분표를 구분한다", () => {
  for (const admissionYear of [2020, 2021, 2022, 2023, 2024]) {
    const offerings = KMOU_PROGRAM_OFFERINGS.filter((item) => item.admissionYear === admissionYear);
    assert.equal(offerings.filter((item) => item.support === "detailed-provisional").length, 22);
    assert.equal(offerings.filter((item) => item.support === "partial-course-audit").length, 0);
    assert.equal(offerings.filter((item) => item.support === "credit-audit").length, 0);
  }
  for (const admissionYear of [2025, 2026]) {
    const offerings = KMOU_PROGRAM_OFFERINGS.filter((item) => item.admissionYear === admissionYear);
    assert.equal(offerings.filter((item) => item.support === "detailed-provisional").length, 0);
    assert.equal(offerings.filter((item) => item.support === "partial-course-audit").length, 21);
    assert.equal(offerings.filter((item) => item.support === "credit-audit").length, 0);
  }
  assert.equal(getMajorCurriculumReadiness(keyOf("computer-engineering"))?.status, "exact-catalog");
  assert.equal(getMajorCurriculumReadiness(keyOf("computer-engineering", 2020))?.status, "exact-catalog");
  assert.equal(getMajorCurriculumReadiness(keyOf("computer-engineering", 2023))?.status, "exact-catalog");
  assert.equal(getMajorCurriculumReadiness(keyOf("computer-engineering", 2025))?.status, "partial-required-courses");
});

test("2025·2026 부분표는 정확한 학번·전공 코드만 분류하고 전공필수 행만 미이수 규칙으로 올린다", () => {
  for (const admissionYear of [2025, 2026]) {
    const environmental = bundledRuleRegistry.find(keyOf("environmental-engineering", admissionYear));
    const computer = bundledRuleRegistry.find(keyOf("computer-engineering", admissionYear));
    assert.ok(environmental && computer);
    assert.deepEqual(environmental.requiredCourses.map((course) => course.code), ["50363"]);
    assert.deepEqual(computer.requiredCourses.map((course) => course.code), ["55260"]);
    assert.ok(environmental.courseOverrides.some((item) => item.courseCode === "40595" && item.category === "majorFoundation"));
    assert.ok(computer.courseOverrides.every((item) => item.courseCode !== "50363"));
    assert.ok(environmental.sources.some((source) => source.documentId === `kmou-${admissionYear}-first-semester-required-courses`
      && source.documentYear === admissionYear
      && source.appliesToDepartmentIds?.[0] === "environmental-engineering"
      && source.evidenceScope?.departmentId === "environmental-engineering"));
  }
});

test("교양 세부영역 과목코드는 타과에도 검증 완료로 표시하고 전공별 특수 인정은 분리한다", () => {
  const environmental = getRuleAvailability(2022, "environmental-engineering", "freshman");
  assert.equal(environmental.generalEducationAreaMapping, "verified");
  assert.equal(environmental.generalEducationSpecialRecognition, "review");
  const computer = getRuleAvailability(2022, "computer-engineering", "freshman");
  assert.equal(computer.generalEducationAreaMapping, "verified");
  assert.equal(computer.generalEducationSpecialRecognition, "verified");
});
