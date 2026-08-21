import assert from "node:assert/strict";
import test from "node:test";
import { auditTranscript } from "../lib/graduation-engine.ts";
import { bundledRuleRegistry, DEFAULT_RULE } from "../lib/rule-registry.ts";
import { validateRuleSet } from "../lib/rule-validator.ts";
import { getCurrentMajorClassificationCatalog } from "../lib/verified-major-curricula.ts";

function transcriptCourse(rowNumber, code, name, category, credits = 3) {
  const rawCategory = {
    majorFoundation: "전공기초",
    majorRequired: "전공필수",
    majorElective: "전공선택",
    generalRequired: "교양필수",
    generalElective: "교양선택",
    freeElective: "일반선택",
  }[category];
  return {
    rowNumber,
    year: "2025",
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

function profile(admissionYear, departmentId, department) {
  return {
    universityId: "kmou",
    admissionYear,
    departmentId,
    department,
    studentType: "freshman",
    studentTypeLabel: "신입생",
  };
}

function environmentalEngineeringTranscript() {
  const rows = [
    ["40595", "일반생물학", "majorFoundation", 2],
    ["50897", "정역학", "majorFoundation", 3],
    ["90536", "기초물리학", "majorFoundation", 2],
    ["90939", "일반화학심화", "majorFoundation", 3],
    ["40277", "환경화학", "majorFoundation", 3],
    ["53391", "환경유체역학", "majorFoundation", 3],
    ["40086", "수치해석", "majorFoundation", 3],
    ["50762", "열역학", "majorFoundation", 3],
    ["50363", "환경공학개론", "majorRequired", 3],
    ["40323", "환경생태학", "majorRequired", 3],
    ["90621", "환경어드벤처디자인", "majorRequired", 2],
    ["50172", "대기오염", "majorRequired", 3],
    ["50266", "하폐수처리공학 I", "majorRequired", 3],
    ["52578", "환경CAD", "majorRequired", 2],
    ["52941", "수질분석실험", "majorRequired", 3],
    ["40321", "환경미생물학", "majorRequired", 3],
    ["50191", "상하수도공학", "majorRequired", 3],
    ["50210", "수질관리", "majorRequired", 3],
    ["55084", "최신폐기물처리공학", "majorRequired", 3],
    ["40662", "환경에너지공학", "majorRequired", 3],
  ];
  return rows.map(([code, name, category, credits], index) => transcriptCourse(index + 1, code, name, category, credits));
}

test("2022 컴퓨터공학 전공 카탈로그는 공식 코드 48개를 중복 없이 고정한다", () => {
  const catalog = DEFAULT_RULE.majorCourseCatalog;
  assert.ok(catalog);
  assert.equal(catalog.status, "verified");
  assert.equal(catalog.matchPolicy, "exact-course-code");
  assert.equal(catalog.entries.length, 48);
  assert.equal(new Set(catalog.entries.map((entry) => entry.code.toUpperCase())).size, 48);
  assert.equal(catalog.entries.filter((entry) => entry.category === "majorFoundation" && entry.required).reduce((sum, entry) => sum + entry.credits, 0), 15);
  assert.equal(catalog.entries.filter((entry) => entry.category === "majorRequired" && entry.required).reduce((sum, entry) => sum + entry.credits, 0), 58);
  assert.equal(catalog.requiredCourseSetStatus, "review");
  assert.deepEqual(validateRuleSet(DEFAULT_RULE), []);
});

test("2022 환경공학은 2024 교차검증표를 활성 규칙으로 연결하지 않는다", () => {
  const rule = bundledRuleRegistry.find({
    universityId: "kmou",
    admissionYear: 2022,
    departmentId: "environmental-engineering",
  });
  assert.ok(rule);
  const catalog = getCurrentMajorClassificationCatalog(rule);
  assert.equal(catalog, null);
  assert.ok(rule.sources.some((source) => source.documentId === "kmou-2022-environmental-engineering-credit-table"));
  assert.ok(rule.sources.every((source) => !source.id.includes("2024") && !source.title.includes("2024학년도")));
});

test("2022 전파융합공학은 공식 상세표 47과목과 필수학점 합계를 정확 키에만 연결한다", () => {
  const rule = bundledRuleRegistry.find({
    universityId: "kmou",
    admissionYear: 2022,
    departmentId: "radio-mobility-convergence-engineering",
  });
  assert.ok(rule);
  const catalog = rule.majorCourseCatalog;
  assert.ok(catalog);
  assert.equal(catalog.status, "verified");
  assert.equal(catalog.requiredCourseSetStatus, "verified");
  assert.equal(catalog.entries.length, 47);
  assert.equal(new Set(catalog.entries.map((entry) => entry.code.toUpperCase())).size, 47);
  assert.equal(catalog.entries.filter((entry) => entry.category === "majorFoundation" && entry.required).reduce((sum, entry) => sum + entry.credits, 0), 18);
  assert.equal(catalog.entries.filter((entry) => entry.category === "majorRequired" && entry.required).reduce((sum, entry) => sum + entry.credits, 0), 60);
  assert.ok(rule.sources.some((source) => source.id === catalog.sourceId
    && source.documentYear === 2022
    && source.evidenceScope?.departmentId === "radio-mobility-convergence-engineering"));
  assert.deepEqual(validateRuleSet(rule), []);
});

test("2022 전자통신공학은 공식 4년 교육과정 44과목과 필수학점 합계를 연결한다", () => {
  const rule = bundledRuleRegistry.find({
    universityId: "kmou",
    admissionYear: 2022,
    departmentId: "electronic-communications-engineering",
  });
  assert.ok(rule);
  const catalog = rule.majorCourseCatalog;
  assert.ok(catalog);
  assert.equal(catalog.requiredCourseSetStatus, "verified");
  assert.equal(catalog.entries.length, 44);
  assert.equal(new Set(catalog.entries.map((entry) => entry.code.toUpperCase())).size, 44);
  assert.equal(catalog.entries.filter((entry) => entry.category === "majorFoundation" && entry.required).reduce((sum, entry) => sum + entry.credits, 0), 12);
  assert.equal(catalog.entries.filter((entry) => entry.category === "majorRequired" && entry.required).reduce((sum, entry) => sum + entry.credits, 0), 64);
  assert.ok(rule.sources.some((source) => source.id === catalog.sourceId
    && source.documentYear === 2022
    && source.evidenceScope?.departmentId === "electronic-communications-engineering"));
  assert.deepEqual(validateRuleSet(rule), []);
});

test("2022 지능제어시스템공학은 컴퓨터공학과 분리된 공식 원표 48과목을 정확 키에만 연결한다", () => {
  const rule = bundledRuleRegistry.find({
    universityId: "kmou",
    admissionYear: 2022,
    departmentId: "intelligent-control-systems-engineering",
  });
  const computerRule = bundledRuleRegistry.find({
    universityId: "kmou",
    admissionYear: 2022,
    departmentId: "computer-engineering",
  });
  assert.ok(rule);
  assert.ok(computerRule);
  const catalog = rule.majorCourseCatalog;
  assert.ok(catalog);
  assert.equal(catalog.status, "verified");
  assert.equal(catalog.requiredCourseSetStatus, "review");
  assert.equal(catalog.entries.length, 48);
  assert.equal(new Set(catalog.entries.map((entry) => entry.code.toUpperCase())).size, 48);
  assert.equal(catalog.entries.filter((entry) => entry.category === "majorFoundation" && entry.required).reduce((sum, entry) => sum + entry.credits, 0), 15);
  assert.equal(catalog.entries.filter((entry) => entry.category === "majorRequired" && entry.required).reduce((sum, entry) => sum + entry.credits, 0), 60);
  assert.ok(rule.sources.some((source) => source.id === catalog.sourceId
    && source.documentYear === 2022
    && source.evidenceScope?.departmentId === "intelligent-control-systems-engineering"));
  assert.ok(computerRule.sources.every((source) => source.id !== catalog.sourceId));
  assert.notEqual(computerRule.majorCourseCatalog?.sourceId, catalog.sourceId);
  assert.deepEqual(validateRuleSet(rule), []);
});

test("2022 지능제어시스템공학 성적표는 해당 전공 원표로 이수·확인필요 과목을 분리한다", () => {
  const rule = bundledRuleRegistry.find({
    universityId: "kmou",
    admissionYear: 2022,
    departmentId: "intelligent-control-systems-engineering",
  });
  assert.ok(rule);
  const courses = [
    transcriptCourse(1, "53581", "컴퓨터언어및실습 II", "majorFoundation"),
    transcriptCourse(2, "51147", "운영체제", "majorRequired"),
    transcriptCourse(3, "52262", "알고리즘설계및실습", "majorRequired"),
    transcriptCourse(4, "53018", "데이터베이스응용및실습", "majorRequired"),
    transcriptCourse(5, "54940", "컴퓨터네트워크및실습", "majorRequired"),
    transcriptCourse(6, "53536", "계산이론", "majorElective"),
  ];
  const audit = auditTranscript(courses, rule, profile(2022, "intelligent-control-systems-engineering", "지능제어시스템공학전공"));

  assert.equal(audit.overallStatus, "evaluated");
  assert.equal(audit.courseMatch.status, "verified");
  assert.equal(audit.courseMatch.classificationSource, "cohort-catalog");
  assert.equal(audit.courseMatch.requiredCourseSetStatus, "review");
  assert.equal(audit.courseMatch.matchedMajorCourses.length, 6);
  assert.equal(audit.courseMatch.unmatchedTranscriptMajorCourses.length, 0);
  assert.equal(audit.courseMatch.transitionReviewCourses.length, 22);
  assert.equal(audit.courseMatch.transitionReviewCourses.some((course) => course.code === "51147"), false);
  assert.equal(audit.courseMatch.transitionReviewCourses.some((course) => course.code === "51480"), true);
  assert.equal(audit.categories.find((item) => item.key === "majorFoundation").earned, 3);
  assert.equal(audit.categories.find((item) => item.key === "majorRequired").earned, 12);
  assert.equal(audit.categories.find((item) => item.key === "majorElective").earned, 3);
  assert.equal(audit.courseMatch.profileMismatch, undefined);
  assert.deepEqual(audit.missingCourses, []);
});

test("2022 전자통신공학 성적표도 이수·미이수 전공과목을 과목번호로 분리한다", () => {
  const rule = bundledRuleRegistry.find({
    universityId: "kmou",
    admissionYear: 2022,
    departmentId: "electronic-communications-engineering",
  });
  assert.ok(rule);
  const courses = [
    transcriptCourse(1, "40770", "응용미적분학", "majorFoundation"),
    transcriptCourse(2, "40914", "기초물리학", "majorFoundation"),
    transcriptCourse(3, "51338", "전자기학 I", "majorRequired"),
    transcriptCourse(4, "51358", "전자회로 I", "majorRequired"),
    transcriptCourse(5, "51482", "회로이론 I", "majorRequired"),
    transcriptCourse(6, "52159", "전자통신개론", "majorElective"),
  ];
  const audit = auditTranscript(courses, rule, profile(2022, "electronic-communications-engineering", "전자통신공학전공"));

  assert.equal(audit.overallStatus, "evaluated");
  assert.equal(audit.courseMatch.requiredCourseSetStatus, "verified");
  assert.equal(audit.courseMatch.matchedMajorCourses.length, 6);
  assert.equal(audit.missingCourses.length, 21);
  assert.equal(audit.missingCourses.filter((course) => course.category === "전공기초").length, 2);
  assert.equal(audit.missingCourses.filter((course) => course.category === "전공필수").length, 19);
  assert.equal(audit.missingCourses.some((course) => course.code === "51338"), false);
  assert.equal(audit.missingCourses.some((course) => course.code === "51132"), true);
});

test("2022 전파융합공학 성적표는 과목번호로 이수·미이수 전공과목을 세분화한다", () => {
  const rule = bundledRuleRegistry.find({
    universityId: "kmou",
    admissionYear: 2022,
    departmentId: "radio-mobility-convergence-engineering",
  });
  assert.ok(rule);
  const courses = [
    transcriptCourse(1, "40345", "벡터해석", "majorFoundation"),
    transcriptCourse(2, "53582", "전파전자개론", "majorFoundation"),
    transcriptCourse(3, "51338", "전자기학 I", "majorRequired"),
    transcriptCourse(4, "51482", "회로이론 I", "majorRequired"),
    transcriptCourse(5, "52304", "안테나설계공학", "majorRequired"),
    transcriptCourse(6, "52553", "RF회로이론", "majorElective"),
  ];
  const audit = auditTranscript(courses, rule, profile(2022, "radio-mobility-convergence-engineering", "전파융합공학전공"));

  assert.equal(audit.overallStatus, "evaluated");
  assert.equal(audit.courseMatch.status, "verified");
  assert.equal(audit.courseMatch.classificationSource, "cohort-catalog");
  assert.equal(audit.courseMatch.requiredCourseSetStatus, "verified");
  assert.equal(audit.courseMatch.matchedMajorCourses.length, 6);
  assert.equal(audit.courseMatch.unmatchedTranscriptMajorCourses.length, 0);
  assert.equal(audit.missingCourses.length, 21);
  assert.equal(audit.missingCourses.filter((course) => course.category === "전공기초").length, 4);
  assert.equal(audit.missingCourses.filter((course) => course.category === "전공필수").length, 17);
  assert.equal(audit.missingCourses.some((course) => course.code === "51338"), false);
  assert.equal(audit.missingCourses.some((course) => course.code === "51357"), true);
});

test("컴퓨터공학 성적표를 2022 전파융합공학으로 선택하면 상세 카탈로그도 오적용하지 않는다", () => {
  const rule = bundledRuleRegistry.find({
    universityId: "kmou",
    admissionYear: 2022,
    departmentId: "radio-mobility-convergence-engineering",
  });
  assert.ok(rule);
  const courses = [
    transcriptCourse(1, "51411", "컴퓨터구조론", "majorRequired"),
    transcriptCourse(2, "54937", "자료구조및실습", "majorRequired"),
    transcriptCourse(3, "51147", "운영체제", "majorElective"),
    transcriptCourse(4, "53018", "데이터베이스응용및실습", "majorElective"),
    transcriptCourse(5, "54940", "컴퓨터네트워크및실습", "majorElective"),
  ];
  const audit = auditTranscript(courses, rule, profile(2022, "radio-mobility-convergence-engineering", "전파융합공학전공"));

  assert.equal(audit.overallStatus, "not-evaluable");
  assert.equal(audit.courseMatch.status, "not-evaluable");
  assert.equal(audit.courseMatch.profileMismatch?.inferredProgramId, "computer-engineering");
  assert.deepEqual(audit.missingCourses, []);
  assert.ok(audit.categories.filter((item) => item.key.startsWith("major")).every((item) => item.evaluationStatus === "not-evaluable"));
});

test("정확 코드가 일부만 맞으면 이름 유사도를 쓰지 않고 전체 전공 판정을 보류한다", () => {
  const courses = [
    transcriptCourse(1, "51411", "이름이 달라도 코드는 같은 과목", "majorElective"),
    transcriptCourse(2, "51411", "재수강 중복", "majorRequired", 2),
    transcriptCourse(3, "X51411", "컴퓨터구조론", "majorRequired"),
    transcriptCourse(4, "53581", "컴퓨터언어및실습 II", "generalElective"),
  ];
  const audit = auditTranscript(courses, DEFAULT_RULE, profile(2022, "computer-engineering", "IT융합전공"));
  const majorRequired = audit.categories.find((item) => item.key === "majorRequired");
  const majorFoundation = audit.categories.find((item) => item.key === "majorFoundation");

  assert.equal(audit.overallStatus, "not-evaluable");
  assert.equal(audit.courseMatch.status, "not-evaluable");
  assert.equal(audit.courseMatch.programEvidence.level, "insufficient");
  assert.equal(audit.courseMatch.matchedMajorCourses.length, 2);
  assert.equal(audit.courseMatch.unmatchedTranscriptMajorCourses.length, 1);
  assert.equal(audit.courseMatch.matchedCredits, 6);
  assert.equal(audit.courseMatch.unmatchedCredits, 3);
  assert.equal(audit.earnedTotal, 9);
  assert.equal(audit.applicableEarnedTotal, 6);
  assert.equal(majorRequired.earned, 0);
  assert.equal(majorFoundation.earned, 0);
  assert.equal(audit.courses.find((course) => course.code === "51411").category, "majorRequired");
  assert.equal(audit.courses.find((course) => course.code === "X51411").majorCourseMatchStatus, "not-evaluable");
  assert.equal(audit.missingCourses.some((course) => course.code === "51411"), false);
  assert.equal(audit.missingCourses.some((course) => course.code === "53581"), false);
});

test("컴퓨터공학 성적표를 2024 기계시스템공학으로 선택하면 전공학점과 전체 퍼센트를 닫고 불일치 경고를 낸다", () => {
  const mechanicalRule = bundledRuleRegistry.find({
    universityId: "kmou",
    admissionYear: 2024,
    departmentId: "mechanical-systems-engineering",
  });
  assert.ok(mechanicalRule);
  const courses = [
    transcriptCourse(1, "51411", "컴퓨터구조론", "majorRequired"),
    transcriptCourse(2, "54937", "자료구조및실습", "majorRequired"),
    transcriptCourse(3, "51147", "운영체제", "majorElective"),
    transcriptCourse(4, "53018", "데이터베이스응용및실습", "majorElective"),
    transcriptCourse(5, "54940", "컴퓨터네트워크및실습", "majorElective"),
    transcriptCourse(6, "L0002", "대학생을위한글쓰기", "generalRequired", 2),
  ];
  const audit = auditTranscript(courses, mechanicalRule, profile(2024, "mechanical-systems-engineering", "기계시스템공학전공"));

  assert.equal(audit.overallStatus, "not-evaluable");
  assert.equal(audit.courseMatch.status, "not-evaluable");
  assert.equal(audit.courseMatch.profileMismatch?.detected, true);
  assert.equal(audit.courseMatch.profileMismatch?.inferredProgramId, "computer-engineering");
  assert.equal(audit.applicableEarnedTotal, 2);
  for (const category of audit.categories.filter((item) => item.key.startsWith("major"))) {
    assert.equal(category.evaluationStatus, "not-evaluable");
    assert.equal(category.earned, 0);
  }
  assert.equal(audit.categories.find((item) => item.key === "majorRequired").reportedEarned, 6);
  assert.equal(audit.categories.find((item) => item.key === "majorElective").reportedEarned, 9);
  assert.equal(audit.categories.find((item) => item.key === "generalRequired").earned, 2);
  assert.deepEqual(audit.missingCourses, []);
});

test("상세표가 있어도 선택 전공 지문이 없으면 전체 판정과 전공학점을 닫는다", () => {
  const audit = auditTranscript([
    transcriptCourse(1, "MECH-001", "기계설계", "majorRequired", 60),
    transcriptCourse(2, "MECH-002", "열역학", "majorElective", 45),
    transcriptCourse(3, "GEN-001", "공통교양", "generalElective", 30),
  ], DEFAULT_RULE, profile(2022, "computer-engineering", "IT융합전공"));

  assert.equal(audit.overallStatus, "not-evaluable");
  assert.equal(audit.earnedTotal, 135);
  assert.equal(audit.courseMatch.unmatchedCredits, 105);
  assert.equal(audit.applicableEarnedTotal, 30);
  assert.ok(Math.round((audit.applicableEarnedTotal / audit.requiredTotal) * 100) < 25);
});

test("2022 편입 컴퓨터공학 회귀는 확정 대체과목을 전필에 한 번만 합산한다", () => {
  const rows = [
    ["52127", "디지털회로및실습", "majorRequired", 3, true],
    ["53371", "공학개론", "majorRequired", 3, true],
    ["54621", "Adventure Design", "majorRequired", 2, true],
    ["54936", "인공지능코딩기초및실습", "majorRequired", 3, true],
    ["54937", "자료구조및실습", "majorRequired", 3, true],
    ["51147", "운영체제", "majorRequired", 3, false],
    ["52262", "알고리즘설계및실습", "majorRequired", 3, false],
    ["52569", "해양데이터통신", "majorRequired", 3, false],
    ["51480", "회로이론", "majorRequired", 3, false],
    ["51554", "디지털신호처리", "majorRequired", 3, false],
    ["52600", "임베디드시스템설계및실습", "majorRequired", 3, false],
    ["53367", "캡스톤디자인Ⅰ", "majorRequired", 2, false],
    ["54940", "컴퓨터네트워크및실습", "majorRequired", 3, false],
    ["53018", "데이터베이스응용및실습", "majorRequired", 3, false],
    ["53368", "캡스톤디자인Ⅱ", "majorRequired", 2, false],
    ["53534", "네트워크보안", "majorRequired", 3, false],
    ["90584", "영상처리및실습", "majorRequired", 3, false],
    ["53015", "JAVA프로그래밍", "majorElective", 3, false],
    ["55172", "시스템디자인Ⅱ", "majorElective", 2, false],
    ["51177", "자동제어", "majorElective", 3, false],
    ["55249", "고급심층학습및응용", "majorElective", 3, false],
    ["55244", "웹프로그래밍및실습", "majorElective", 3, false],
    ["31187", "동아시아의이해", "majorFoundation", 2, true],
    ["53531", "전자회로및실험Ⅰ", "majorFoundation", 3, true],
    ["53535", "컴퓨터언어및실습Ⅲ", "majorFoundation", 3, true],
    ["53581", "컴퓨터언어및실습Ⅱ", "majorFoundation", 3, true],
    ["53532", "전자회로및실험Ⅱ", "majorFoundation", 3, false],
    ["90536", "기초물리학", "majorFoundation", 2, false],
  ];
  const courses = rows.map(([code, name, category, credits, transferCredit], index) => ({
    ...transcriptCourse(index + 1, code, name, category, credits),
    semester: transferCredit ? "편입생 인정학점" : "1학기",
    transferCredit,
  }));
  const audit = auditTranscript(courses, DEFAULT_RULE, {
    ...profile(2022, "computer-engineering", "컴퓨터공학전공"),
    transferEntryYear: 2024,
    studentType: "transfer",
    studentTypeLabel: "편입생",
  });

  assert.equal(audit.overallStatus, "evaluated");
  assert.equal(audit.courseMatch.currentClassificationApplied, true);
  assert.equal(audit.courseMatch.programEvidence.level, "strong");
  assert.equal(audit.courseMatch.unmatchedCredits, 0);
  assert.equal(audit.applicableEarnedTotal, 78);
  assert.equal(audit.categories.find((item) => item.key === "majorFoundation").earned, 16);
  assert.equal(audit.categories.find((item) => item.key === "majorRequired").earned, 54);
  assert.equal(audit.categories.find((item) => item.key === "majorElective").earned, 8);
  assert.equal(audit.courses.find((course) => course.code === "51177").category, "majorRequired");
  assert.equal(audit.courses.find((course) => course.code === "55249").category, "majorRequired");
  assert.deepEqual(audit.missingCourses.filter((course) => course.category === "전공필수").map((course) => course.code), []);
  assert.deepEqual(audit.missingCourses.map((course) => course.code), ["L1513"]);
  assert.deepEqual(audit.courseMatch.transitionReviewCourses.map((course) => course.code), ["90537", "51411", "54943"]);
  assert.equal(audit.courseMatch.classificationReferenceYear, 2024);
  assert.equal(audit.courseMatch.classificationSources.length, 2);
  assert.ok(audit.courseMatch.classificationSources.every((source) => source.role === "classification-reference" && source.documentYear === 2024));
  assert.ok(audit.officialSources.every((source) => source.role !== "classification-reference"));
  assert.ok(audit.officialSources.every((source) => !source.id.includes("opened-courses-2024")));
  assert.deepEqual(audit.courseMatch.pendingCourseRecognitions, []);
  assert.equal(audit.courseMatch.requiredCreditShortage, 6);
  assert.equal(audit.courseMatch.potentialRequiredCredits, 54);
});

test("2022 환경공학 신입생은 2022 요건과 전공 지문으로 영역별 학점을 판정한다", () => {
  const rule = bundledRuleRegistry.find({
    universityId: "kmou",
    admissionYear: 2022,
    departmentId: "environmental-engineering",
  });
  assert.ok(rule);
  const audit = auditTranscript(
    environmentalEngineeringTranscript(),
    rule,
    profile(2022, "environmental-engineering", "환경공학전공"),
  );

  assert.equal(audit.overallStatus, "evaluated");
  assert.equal(audit.courseMatch.status, "verified");
  assert.equal(audit.courseMatch.currentClassificationApplied, false);
  assert.equal(audit.courseMatch.classificationSource, "cohort-catalog");
  assert.equal(audit.courseMatch.sourceId, "kmou-2022-environmental-engineering-university-major-curriculum-table");
  assert.equal(audit.courseMatch.programEvidence.method, "exact-course-code");
  assert.equal(audit.courseMatch.requiredCourseSetStatus, "verified");
  assert.equal(audit.courseMatch.unmatchedCredits, 0);
  assert.equal(audit.categories.find((item) => item.key === "majorFoundation").earned, 22);
  assert.equal(audit.categories.find((item) => item.key === "majorRequired").earned, 34);
  assert.equal(audit.categories.find((item) => item.key === "majorElective").earned, 0);
  assert.equal(audit.courseMatch.requiredCreditShortage, 3);
  assert.deepEqual(new Set(audit.missingCourses.map((course) => course.code)), new Set(["52320", "53390", "40710", "50174", "50267", "52580", "53393"]));
  assert.ok(audit.missingCourses.every((course) => course.priority === "필수"));
  assert.deepEqual(audit.courseMatch.transitionReviewCourses, []);
  assert.deepEqual(audit.courseMatch.classificationSources, []);
  assert.ok(audit.officialSources.some((source) => source.documentId === "kmou-2022-environmental-engineering-credit-table"));
  assert.ok(audit.officialSources.some((source) => source.evidenceScope?.departmentId === "environmental-engineering"));
  assert.ok(audit.officialSources.every((source) => source.evidenceScope?.departmentId === undefined || source.evidenceScope.departmentId === "environmental-engineering"));
  assert.ok(audit.officialSources.every((source) => source.role !== "classification-reference"));
  assert.ok(audit.officialSources.every((source) => !source.id.includes("2024") && !source.title.includes("2024학년도")));
});

test("2022 환경공학 필수이수 심화전공 6과목은 이수 시 누락목록에서 정확히 제외된다", () => {
  const rule = bundledRuleRegistry.find({
    universityId: "kmou",
    admissionYear: 2022,
    departmentId: "environmental-engineering",
  });
  assert.ok(rule);
  const mandatoryElectives = [
    ["53390", "조선해양환경공학"],
    ["40710", "토양오염"],
    ["50174", "대기오염제어공학"],
    ["50267", "하폐수처리공학Ⅱ"],
    ["52580", "환경정보공학"],
    ["53393", "환경웰빙공학"],
  ].map(([code, name], index) => transcriptCourse(100 + index, code, name, "majorElective"));
  const audit = auditTranscript(
    [...environmentalEngineeringTranscript(), ...mandatoryElectives],
    rule,
    profile(2022, "environmental-engineering", "환경공학전공"),
  );

  assert.equal(audit.overallStatus, "evaluated");
  assert.equal(audit.categories.find((item) => item.key === "majorElective").earned, 18);
  assert.deepEqual(audit.missingCourses.map((course) => course.code), ["52320"]);
});

test("2022 토목공학은 공식 4년 교육과정표 전체를 과목코드로 상세 판정한다", () => {
  const rule = bundledRuleRegistry.find({
    universityId: "kmou",
    admissionYear: 2022,
    departmentId: "civil-engineering",
  });
  assert.ok(rule);
  assert.ok(rule.majorCourseCatalog);
  assert.equal(rule.majorCourseCatalog.entries.length, 55);
  assert.ok(rule.sources.some((source) => source.documentId === "kmou-2022-university-major-curriculum-table"));

  const signatureCourses = rule.majorCourseCatalog.entries
    .filter((entry) => entry.code !== "53583")
    .slice(0, 6)
    .map((entry, index) => transcriptCourse(index + 1, entry.code, entry.name, entry.category, entry.credits));
  const missingAudit = auditTranscript(
    signatureCourses,
    rule,
    profile(2022, "civil-engineering", "건설공학전공"),
  );
  assert.equal(missingAudit.overallStatus, "evaluated");
  assert.equal(missingAudit.courseMatch.classificationSource, "cohort-catalog");
  assert.ok(missingAudit.missingCourses.some((course) => course.code === "53583"));

  const completedAudit = auditTranscript(
    [...signatureCourses, transcriptCourse(4, "53583", "토목과방재", "majorFoundation", 2)],
    rule,
    profile(2022, "civil-engineering", "건설공학전공"),
  );
  assert.equal(completedAudit.missingCourses.some((course) => course.code === "53583"), false);
});

test("2022 해양스포츠과학은 전체 과목표와 신입생 필수표를 결합해 상세 판정한다", () => {
  const rule = bundledRuleRegistry.find({
    universityId: "kmou",
    admissionYear: 2022,
    departmentId: "marine-sports-science",
  });
  assert.ok(rule);
  assert.ok(rule.majorCourseCatalog);
  assert.equal(rule.majorCourseCatalog.entries.length, 53);
  assert.equal(rule.majorCourseCatalog.requiredCourseSetStatus, "verified");
  assert.ok(rule.majorCourseCatalog.entries.find((entry) => entry.code === "90542")?.required);
  assert.ok(rule.majorCourseCatalog.entries.find((entry) => entry.code === "60024")?.required);
  assert.ok(rule.sources.some((source) => source.documentId === "kmou-2022-marine-sports-science-new-student-required-courses"));

  const signatureCourses = rule.majorCourseCatalog.entries
    .filter((entry) => !["90542", "60024"].includes(entry.code))
    .slice(0, 6)
    .map((entry, index) => transcriptCourse(index + 1, entry.code, entry.name, entry.category, entry.credits));
  const missingAudit = auditTranscript(
    signatureCourses,
    rule,
    profile(2022, "marine-sports-science", "해양스포츠과학과"),
  );
  assert.equal(missingAudit.overallStatus, "evaluated");
  assert.equal(missingAudit.courseMatch.classificationSource, "cohort-catalog");
  assert.ok(missingAudit.missingCourses.some((course) => course.code === "90542"));
  assert.ok(missingAudit.missingCourses.some((course) => course.code === "60024"));

  const completedAudit = auditTranscript(
    [
      ...signatureCourses,
      transcriptCourse(4, "90542", "스포츠과학의이해", "majorFoundation", 3),
      transcriptCourse(5, "60024", "수영Ⅰ", "majorRequired", 2),
    ],
    rule,
    profile(2022, "marine-sports-science", "해양스포츠과학과"),
  );
  assert.equal(completedAudit.missingCourses.some((course) => course.code === "90542"), false);
  assert.equal(completedAudit.missingCourses.some((course) => course.code === "60024"), false);
});

test("부분 확인 필수과목은 다른 학번·다른 전공 규칙에 절대 상속되지 않는다", () => {
  const civil2023 = bundledRuleRegistry.find({ universityId: "kmou", admissionYear: 2023, departmentId: "civil-engineering" });
  const marineSports2023 = bundledRuleRegistry.find({ universityId: "kmou", admissionYear: 2023, departmentId: "marine-sports-science" });
  const mechanical2022 = bundledRuleRegistry.find({ universityId: "kmou", admissionYear: 2022, departmentId: "mechanical-systems-engineering" });
  assert.ok(civil2023 && marineSports2023 && mechanical2022);
  assert.deepEqual(civil2023.requiredCourses, []);
  assert.deepEqual(marineSports2023.requiredCourses, []);
  assert.deepEqual(mechanical2022.requiredCourses, []);
  assert.ok(civil2023.sources.every((source) => source.evidenceScope?.departmentId !== "marine-sports-science"));
  assert.ok(marineSports2023.sources.every((source) => source.evidenceScope?.departmentId !== "civil-engineering"));
});

test("환경공학 성적표로 컴퓨터공학을 선택하면 타 전공 적용을 차단한다", () => {
  const audit = auditTranscript(
    environmentalEngineeringTranscript(),
    DEFAULT_RULE,
    profile(2022, "computer-engineering", "IT융합전공"),
  );

  assert.equal(audit.overallStatus, "not-evaluable");
  assert.equal(audit.courseMatch.status, "not-evaluable");
  assert.equal(audit.courseMatch.profileMismatch?.inferredProgramId, "environmental-engineering");
  assert.ok(audit.categories.filter((item) => item.key.startsWith("major")).every((item) => item.evaluationStatus === "not-evaluable"));
});

test("상세 전공표가 없는 규칙은 같은 이름의 과목이나 큰 전공학점 숫자만으로 충족 처리하지 않는다", () => {
  const rule = bundledRuleRegistry.find({
    universityId: "kmou",
    admissionYear: 2026,
    departmentId: "ocean-engineering",
  });
  assert.ok(rule);
  const audit = auditTranscript([
    transcriptCourse(1, "DUMMY-001", "해양공학개론", "majorRequired", 60),
    transcriptCourse(2, "DUMMY-002", "해양공학설계", "majorElective", 30),
  ], rule, profile(2026, "ocean-engineering", "해양공학과"));

  assert.equal(audit.overallStatus, "not-evaluable");
  assert.ok(audit.categories.filter((item) => item.key.startsWith("major")).every((item) => item.earned === 0));
  assert.ok(audit.categories.filter((item) => item.key.startsWith("major")).every((item) => item.evaluationStatus === "not-evaluable"));
});
