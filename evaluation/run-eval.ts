import assert from "node:assert/strict";
import { classifyQuestion, toolsForQuestion, type AssistantIntent } from "../lib/assistant-engine";
import { auditTranscript, normalizeTranscriptRows } from "../lib/graduation-engine";
import { DEFAULT_RULE, RuleRegistry } from "../lib/rule-registry";
import { validateRuleSet } from "../lib/rule-validator";
import { retrieveEvidence } from "../lib/retrieval";

const syntheticRows = [
  { No: 1, 년도: 2024, 학기: "1학기", 교과목번호: "L1512", 교과목명: "대학생활과진로설계", "교과목구분▼": "교양선택", 학점: 2, 등급: "A+", 학번: "PRIVATE-ID", 성명: "PRIVATE-NAME" },
  { No: 2, 년도: 2024, 학기: "1학기", 교과목번호: "51177", 교과목명: "자동제어", "교과목구분▼": "전공선택", 학점: 3, 등급: "B+" },
  { No: 3, 년도: 2025, 학기: "2학기", 교과목번호: "55249", 교과목명: "고급심층학습및응용", "교과목구분▼": "전공선택", 학점: 3, 등급: "A0" },
  { No: 4, 년도: 2024, 학기: "2학기", 교과목번호: "MF001", 교과목명: "공학수학", "교과목구분▼": "전공기초", 학점: 3, 등급: "A0" },
  { No: 5, 년도: 2024, 학기: "2학기", 교과목번호: "GE001", 교과목명: "인문학", "교과목구분▼": "교양선택", 학점: 3, 등급: "B0" },
  { No: 6, 년도: 2025, 학기: "1학기", 교과목번호: "ME001", 교과목명: "클라우드컴퓨팅", "교과목구분▼": "전공선택", 학점: 3, 등급: "C+" },
  { No: 7, 년도: 2025, 학기: "1학기", 교과목번호: "FREE1", 교과목명: "자유선택", "교과목구분▼": "일반선택", 학점: 3, 등급: "C0" },
  { No: 8, 년도: 2025, 학기: "2학기", 교과목번호: "FAIL1", 교과목명: "미이수과목", "교과목구분▼": "전공선택", 학점: 3, 등급: "F" },
  { No: 9, 년도: 2024, 학기: "편입생 인정학점", 교과목번호: "TR001", 교과목명: "편입인정", "교과목구분▼": "전공필수", 학점: 2, 등급: "" },
];

const courses = normalizeTranscriptRows(syntheticRows);
const audit = auditTranscript(courses);
const courseMatch = audit.courseMatch;
assert.ok(courseMatch);
const byCategory = Object.fromEntries(audit.categories.map((item) => [item.key, item.earned]));

const ruleAssertions: Array<[string, () => void]> = [
  ["모든 교과목 행 정규화", () => assert.equal(courses.length, 9)],
  ["L1512 교양필수 재분류", () => assert.equal(courses.find((course) => course.code === "L1512")?.category, "generalRequired")],
  ["51177 자동제어 전공필수 재분류", () => assert.equal(courses.find((course) => course.code === "51177")?.category, "majorRequired")],
  ["55249 고급심층학습및응용 전공필수 단일 분류", () => assert.equal(courses.find((course) => course.code === "55249")?.category, "majorRequired")],
  ["F학점 취득학점 제외", () => assert.equal(courses.find((course) => course.code === "FAIL1")?.passed, false)],
  ["편입 인정학점 등급 공란 허용", () => assert.equal(courses.find((course) => course.code === "TR001")?.passed, true)],
  ["전공 지문 부족 시 전공학점 판정 보류", () => assert.equal(courseMatch.status, "not-evaluable")],
  ["안전 모드 영역별 집계 일치", () => assert.deepEqual(byCategory, { generalRequired: 2, generalElective: 3, majorFoundation: 0, majorRequired: 0, majorElective: 0, freeElective: 3 })],
];

const intentCases: Array<[string, AssistantIntent, string]> = [
  ["편입생도 조기졸업할 수 있어?", "early-graduation", "explainRequirement"],
  ["졸업을 빨리 하고 싶어", "early-graduation", "explainRequirement"],
  ["다음 학기 과목을 추천해줘", "course-planning", "recommendCourses"],
  ["금요일 공강을 만들고 싶어", "course-planning", "recommendCourses"],
  ["수강신청 계획을 짜줘", "course-planning", "recommendCourses"],
  ["시간표 후보를 알려줘", "course-planning", "recommendCourses"],
  ["봉사시간은 몇 시간 필요해?", "certification", "checkCertification"],
  ["토익 점수 기준이 뭐야?", "certification", "checkCertification"],
  ["기사 필기 합격도 인정돼?", "certification", "checkCertification"],
  ["졸업 요건을 충족했어?", "audit", "auditGraduation"],
  ["무엇이 부족해?", "audit", "auditGraduation"],
  ["내 학점 상태를 설명해줘", "audit", "auditGraduation"],
];

for (const [label, assertion] of ruleAssertions) {
  try { assertion(); } catch (error) { throw new Error(`규칙 평가 실패: ${label}`, { cause: error }); }
}

for (const [question, expectedIntent, expectedTool] of intentCases) {
  assert.equal(classifyQuestion(question), expectedIntent, question);
  assert.ok(toolsForQuestion(question).includes(expectedTool as ReturnType<typeof toolsForQuestion>[number]), question);
}

const serialized = JSON.stringify(courses);
const privacyAssertions = [
  !serialized.includes("PRIVATE-ID"),
  !serialized.includes("PRIVATE-NAME"),
  !serialized.includes("학번"),
  !serialized.includes("성명"),
];
assert.ok(privacyAssertions.every(Boolean), "개인 식별 열이 파서 결과에 포함되지 않아야 합니다.");

const registry = new RuleRegistry([DEFAULT_RULE]);
const transferStudentContext = { ...DEFAULT_RULE.key, transferEntryYear: 2024, studentType: "transfer" as const };
const sourceWithoutHashRule = {
  ...DEFAULT_RULE,
  status: "approved" as const,
  sources: DEFAULT_RULE.sources.map((source, index) => index === 0
    ? { ...source, fileHash: undefined, documentVersionId: undefined }
    : source),
};
const ingestionAndRegistry: Array<[string, () => void]> = [
  ["번들 규칙 스키마 검증", () => assert.deepEqual(validateRuleSet(DEFAULT_RULE), [])],
  ["원본 해시 없는 승인 규칙 차단", () => assert.ok(validateRuleSet(sourceWithoutHashRule).some((message) => message.includes("원본 해시 또는 문서 버전")))],
  ["프로필 키로 규칙 선택", () => assert.equal(registry.find(DEFAULT_RULE.key)?.version, DEFAULT_RULE.version)],
  ["질문 기반 근거 검색", () => assert.equal(retrieveEvidence(DEFAULT_RULE, "졸업학점과 부족한 전공 학점을 알려줘")[0]?.id, "ev-credit")],
  ["학생 유형과 무관한 공통 규칙 선택", () => assert.equal(registry.find(transferStudentContext)?.version, DEFAULT_RULE.version)],
  ["공통 규칙 키에 학생 유형 미포함", () => assert.deepEqual(Object.keys(DEFAULT_RULE.key).sort(), ["admissionYear", "departmentId", "universityId"])],
  ["지원하지 않는 학교 격리", () => assert.equal(registry.find({ ...DEFAULT_RULE.key, universityId: "other-university" }), null)],
];
for (const [label, assertion] of ingestionAndRegistry) { try { assertion(); } catch (error) { throw new Error(`수집·레지스트리 평가 실패: ${label}`, { cause: error }); } }

console.log(JSON.stringify({
  status: "passed",
  ruleEngine: `${ruleAssertions.length}/${ruleAssertions.length}`,
  intentRouting: `${intentCases.length}/${intentCases.length}`,
  ingestionAndRegistry: `${ingestionAndRegistry.length}/${ingestionAndRegistry.length}`,
  privacy: `${privacyAssertions.length}/${privacyAssertions.length}`,
  citationPolicy: "assistant responses require at least one official source",
}, null, 2));
