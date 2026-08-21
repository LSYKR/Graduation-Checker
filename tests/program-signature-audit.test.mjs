import assert from "node:assert/strict";
import test from "node:test";
import { auditTranscript } from "../lib/graduation-engine.ts";
import {
  KMOU_PROGRAM_DEFINITIONS,
  KMOU_PROGRAM_OFFERINGS,
} from "../lib/kmou-program-catalog.ts";
import { KMOU_PROGRAM_IDENTITY_SIGNATURES } from "../lib/kmou-program-signatures.ts";
import { bundledRuleRegistry } from "../lib/rule-registry.ts";

function transcriptCourse(rowNumber, code, name, category = "majorRequired", credits = 3) {
  const rawCategory = {
    majorFoundation: "전공기초",
    majorRequired: "전공필수",
    majorElective: "전공선택",
    generalRequired: "교양필수",
  }[category];
  return {
    rowNumber,
    year: "2026",
    semester: "1학기",
    code,
    name,
    rawCategory,
    category,
    credits,
    grade: "A0",
    professor: "합성데이터",
    englishName: "",
    passed: true,
    transferCredit: false,
    reclassified: false,
  };
}

function signatureTranscript(programId) {
  const signature = KMOU_PROGRAM_IDENTITY_SIGNATURES.find((item) => item.programId === programId);
  assert.ok(signature, programId);
  return [
    ...signature.keywords.slice(0, 4).map((keyword, index) => transcriptCourse(
      index + 1,
      `SIGNATURE-${programId}-${index + 1}`,
      `${keyword} 실습`,
      index === 0 ? "majorFoundation" : index === 3 ? "majorElective" : "majorRequired",
    )),
    transcriptCourse(5, `GENERAL-${programId}`, "대학생을 위한 글쓰기", "generalRequired", 2),
  ];
}

function profile(rule) {
  return {
    universityId: "kmou",
    admissionYear: rule.key.admissionYear,
    departmentId: rule.key.departmentId,
    department: rule.profileLabel,
    studentType: "freshman",
    studentTypeLabel: "신입생",
  };
}

test("단과대 23개 안정 전공 ID마다 중복되지 않는 전공 지문 정의가 있다", () => {
  const definitionIds = KMOU_PROGRAM_DEFINITIONS.map((item) => item.id).sort();
  const signatureIds = KMOU_PROGRAM_IDENTITY_SIGNATURES.map((item) => item.programId).sort();
  assert.equal(new Set(signatureIds).size, 23);
  assert.deepEqual(signatureIds, definitionIds);
  assert.ok(KMOU_PROGRAM_IDENTITY_SIGNATURES.every((item) => item.keywords.length >= 6));
});

test("152개 학번·전공 조합은 충분한 전공 지문이 있을 때만 영역별 전공학점을 연다", () => {
  for (const offering of KMOU_PROGRAM_OFFERINGS) {
    const rule = bundledRuleRegistry.find({
      universityId: "kmou",
      admissionYear: offering.admissionYear,
      departmentId: offering.programId,
    });
    assert.ok(rule, `${offering.admissionYear}:${offering.programId}`);
    const audit = auditTranscript(signatureTranscript(offering.programId), rule, profile(rule));
    const context = `${offering.admissionYear}:${offering.programId}`;

    assert.equal(audit.overallStatus, "evaluated", context);
    assert.equal(audit.courseMatch.status, "verified", context);
    assert.equal(audit.courseMatch.classificationSource, "transcript-program-signature", context);
    assert.equal(audit.courseMatch.programEvidence.method, "course-name-signature", context);
    assert.equal(audit.courseMatch.programEvidence.matchedCourses, 4, context);
    assert.equal(audit.courseMatch.requiredCourseSetStatus, "review", context);
    assert.equal(audit.courseMatch.unmatchedCredits, 0, context);
    assert.ok(audit.categories.filter((item) => item.key.startsWith("major")).every((item) => item.evaluationStatus === "evaluated"), context);
    assert.equal(audit.applicableEarnedTotal, 14, context);
  }
});

test("23×22 타 전공 조합은 영역별 전공학점과 전체 퍼센트를 열지 않는다", () => {
  for (const selected of KMOU_PROGRAM_DEFINITIONS) {
    const offering = KMOU_PROGRAM_OFFERINGS.find((item) => item.programId === selected.id);
    assert.ok(offering, selected.id);
    const rule = bundledRuleRegistry.find({
      universityId: "kmou",
      admissionYear: offering.admissionYear,
      departmentId: offering.programId,
    });
    assert.ok(rule, selected.id);

    for (const actual of KMOU_PROGRAM_DEFINITIONS.filter((item) => item.id !== selected.id)) {
      const audit = auditTranscript(signatureTranscript(actual.id), rule, profile(rule));
      const context = `selected=${selected.id}:actual=${actual.id}`;
      assert.equal(audit.overallStatus, "not-evaluable", context);
      assert.equal(audit.courseMatch.status, "not-evaluable", context);
      assert.ok(audit.categories.filter((item) => item.key.startsWith("major")).every((item) => item.evaluationStatus === "not-evaluable"), context);
    }
  }
});

test("같은 두 과목의 재수강 중복은 세 과목 지문으로 부풀리지 않는다", () => {
  const offering = KMOU_PROGRAM_OFFERINGS.find((item) => item.programId === "environmental-engineering");
  assert.ok(offering);
  const rule = bundledRuleRegistry.find({
    universityId: "kmou",
    admissionYear: offering.admissionYear,
    departmentId: offering.programId,
  });
  assert.ok(rule);
  const twoCourses = signatureTranscript("environmental-engineering").slice(0, 2);
  const duplicated = [
    ...twoCourses,
    { ...twoCourses[0], rowNumber: 10, code: twoCourses[0].code.toLowerCase(), grade: "B0" },
    { ...twoCourses[1], rowNumber: 11, grade: "C+" },
  ];
  const audit = auditTranscript(duplicated, rule, profile(rule));

  assert.equal(audit.courseMatch.programEvidence.matchedCourses, 2);
  assert.equal(audit.courseMatch.programEvidence.level, "partial");
  assert.equal(audit.overallStatus, "not-evaluable");
});
