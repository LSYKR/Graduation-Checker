import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getRuleAvailability } from "../lib/rule-availability.ts";
import { summarizeTransferRecognition } from "../lib/transcript-profile.ts";
import { selectorKey, transferOverlayKey, validateRuleSet, validateTransferPolicyOverlay } from "../lib/rule-model.ts";

const curriculumCandidate = JSON.parse(await readFile(
  new URL("../data/rule-candidates/kmou/2022/computer-engineering/curriculum/0.2.0.json", import.meta.url),
  "utf8",
));
const transferOverlay = JSON.parse(await readFile(
  new URL("../data/policy-overlays/kmou/transfer/2024/0.1.0.json", import.meta.url),
  "utf8",
));
const extractedPolicy = JSON.parse(await readFile(
  new URL("../data/extracted/kmou/verified-transfer-policy-2022-cohort-2024-entry.json", import.meta.url),
  "utf8",
));

const recognizedRows = [
  { 년도: 2024, 학기: "편입생 인정학점", 교과목번호: "L0002", 교과목명: "글쓰기", 교과목구분: "교양필수", 학점: 2, 등급: "" },
  { 년도: 2024, 학기: "편입생 인정학점", 교과목번호: "52127", 교과목명: "디지털회로", 교과목구분: "전공필수", 학점: 3, 등급: "" },
  { 년도: 2024, 학기: "편입생 인정학점", 교과목번호: "99999", 교과목명: "일반선택", 교과목구분: "일반선택", 학점: 15, 등급: "" },
  { 년도: 2025, 학기: "1학기", 교과목번호: "REG01", 교과목명: "본교수강", 교과목구분: "전공선택", 학점: 3, 등급: "A+" },
];

test("성적표의 편입 인정 행에서 처리 연도·행 수·학점·영역 집계를 분리한다", () => {
  const summary = summarizeTransferRecognition(recognizedRows);
  assert.equal(summary.status, "detected");
  assert.deepEqual(summary.years, [2024]);
  assert.equal(summary.recognizedRows, 3);
  assert.equal(summary.recognizedCredits, 20);
  assert.deepEqual(summary.categoryCredits, {
    generalRequired: 2,
    majorRequired: 3,
    freeElective: 15,
  });
});

test("편입 인정 처리 연도가 여러 개면 임의로 하나를 선택하지 않는다", () => {
  const summary = summarizeTransferRecognition([
    recognizedRows[0],
    { ...recognizedRows[1], 년도: 2023 },
  ]);
  assert.equal(summary.status, "ambiguous");
  assert.deepEqual(summary.years, [2023, 2024]);
});

test("신입학·편입학 모두 2022 공통 졸업요건 근거를 사용한다", () => {
  const recognition = summarizeTransferRecognition(recognizedRows);
  const freshman = getRuleAvailability(2022, "computer-engineering", "freshman");
  const transfer = getRuleAvailability(2022, "computer-engineering", "transfer", recognition);
  assert.equal(freshman.creditSummary, "provisional");
  assert.equal(transfer.creditSummary, "provisional");
  assert.equal(freshman.generalEducationAreaMapping, "verified");
  assert.equal(freshman.detailedCurriculum, transfer.detailedCurriculum);
  assert.deepEqual(curriculumCandidate.eligibilityRules.find((item) => item.goal === "regular")?.eligibleStudentTypes, ["freshman", "transfer"]);
  assert.equal(curriculumCandidate.selector.studentType, undefined);
});

test("2024 편입 오버레이는 공통 졸업요건을 복제하지 않고 제약만 보완한다", () => {
  const recognition = summarizeTransferRecognition(recognizedRows);
  const supported = getRuleAvailability(2022, "computer-engineering", "transfer", recognition);
  assert.equal(supported.transferOverlay, "provisional");
  assert.equal(supported.individualTransferRecognition, "verified");
  assert.equal(supported.operational, "provisional");

  const differentEntryYear = getRuleAvailability(2022, "computer-engineering", "transfer", { ...recognition, years: [2023] });
  assert.equal(differentEntryYear.transferOverlay, "pending");
  assert.equal(differentEntryYear.creditSummary, "provisional");
});

test("공통 규칙 키와 학생 정책 오버레이 키를 분리한다", () => {
  assert.equal(selectorKey(curriculumCandidate.selector), "kmou:2022:computer-engineering:default");
  assert.equal(transferOverlayKey(transferOverlay), "kmou:2024:transfer");
  assert.deepEqual(transferOverlay.composition.graduationRuleSelector, curriculumCandidate.selector);
  assert.equal(transferOverlay.composition.separateTransferGraduationRule, false);
});

test("2022 공통 후보와 2024 편입 오버레이는 각각 검증 가능한 review 상태다", () => {
  assert.equal(curriculumCandidate.status, "review");
  assert.equal(transferOverlay.status, "review");
  assert.equal(transferOverlay.creditRecognition.maximumRecognizedFraction, 0.5);
  assert.equal(transferOverlay.creditRecognition.minimumHostSemesters, 4);
  assert.equal(transferOverlay.creditRecognition.earlyGraduationAllowed, false);
  assert.equal(extractedPolicy.interpretation.separateTransferGraduationRequirements, false);
  assert.equal(extractedPolicy.interpretation.recognizedCoursesCountTowardSharedRequirements, true);
  assert.equal(extractedPolicy.creditRecognition.maximumRecognizedFraction, transferOverlay.creditRecognition.maximumRecognizedFraction);
  assert.ok(transferOverlay.sources.every((source) => source.fileHash.startsWith("sha256:")));
  assert.equal(validateRuleSet(curriculumCandidate).filter((issue) => issue.severity === "error").length, 0);
  assert.equal(validateTransferPolicyOverlay(transferOverlay).filter((issue) => issue.severity === "error").length, 0);
});
