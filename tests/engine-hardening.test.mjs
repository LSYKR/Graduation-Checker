import assert from "node:assert/strict";
import test from "node:test";
import { auditTranscript, normalizeTranscriptRows } from "../lib/graduation-engine.ts";
import { bundledRuleRegistry } from "../lib/rule-registry.ts";

const key = { universityId: "kmou", admissionYear: 2022, departmentId: "environmental-engineering" };
const rule = bundledRuleRegistry.find(key);
assert.ok(rule);
const profile = {
  ...key,
  department: "환경공학전공",
  studentType: "freshman",
  studentTypeLabel: "신입학",
};

function row({ code, name, category, credits, grade = "A+" }) {
  return {
    교과목번호: code,
    교과목명: name,
    "교과목구분▼": category,
    학점: credits,
    등급: grade,
    년도: "2026",
    학기: "1학기",
  };
}

test("알 수 없는 이수구분은 일반선택으로 임의 합산하지 않고 판정 가능 총학점에서 격리한다", () => {
  const courses = normalizeTranscriptRows([
    row({ code: "L3245", name: "AI기초코딩", category: "교양선택", credits: 2 }),
    row({ code: "X-UNKNOWN", name: "이수구분 확인 과목", category: "기타선택", credits: 3 }),
    row({ code: "X-W", name: "수강취소 과목", category: "일반선택", credits: 2, grade: "W" }),
    row({ code: "X-NEG", name: "음수학점 행", category: "일반선택", credits: -1 }),
  ], rule);
  assert.equal(courses.find((course) => course.code === "X-UNKNOWN")?.categoryRecognition, "unrecognized");
  assert.equal(courses.find((course) => course.code === "X-W")?.passed, false);
  assert.equal(courses.find((course) => course.code === "X-NEG")?.passed, false);

  const audit = auditTranscript(courses, rule, profile);
  assert.equal(audit.earnedTotal, 5);
  assert.equal(audit.applicableEarnedTotal, 2);
  assert.equal(audit.transcriptClassification?.status, "needs-review");
  assert.equal(audit.transcriptClassification?.unclassifiedCredits, 3);
  assert.deepEqual(audit.transcriptClassification?.issues.map((issue) => issue.code), ["X-UNKNOWN"]);
  assert.equal(audit.residualCredits?.rawFreeElectiveCredits, 0);
  assert.equal(audit.overallStatus, "not-evaluable");
});

test("명시적 과목 오버라이드는 알 수 없는 원본 이수구분을 안전하게 복구한다", () => {
  const overrideRule = {
    ...rule,
    courseOverrides: [
      ...rule.courseOverrides,
      { courseCode: "X-OVERRIDE", category: "freeElective", reason: "관리자 검증 매핑" },
    ],
  };
  const courses = normalizeTranscriptRows([
    row({ code: "X-OVERRIDE", name: "검증 완료 일반선택", category: "기타선택", credits: 3 }),
  ], overrideRule);
  assert.equal(courses[0].categoryRecognition, "recognized");
  assert.equal(courses[0].category, "freeElective");
  const audit = auditTranscript(courses, overrideRule, profile);
  assert.equal(audit.transcriptClassification?.status, "verified");
  assert.equal(audit.residualCredits?.rawFreeElectiveCredits, 3);
});

test("학생 프로필과 규칙의 학교·학번·전공 키가 다르면 판정을 시작하지 않는다", () => {
  assert.throws(
    () => auditTranscript([], rule, { ...profile, admissionYear: 2024 }),
    /학교·학번·전공 키가 일치하지 않습니다/,
  );
  assert.throws(
    () => auditTranscript([], rule, { ...profile, departmentId: "mechanical-engineering" }),
    /학교·학번·전공 키가 일치하지 않습니다/,
  );
});
