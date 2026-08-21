import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { auditTranscript } from "../lib/graduation-engine.ts";
import { evaluateGeneralEducation, matchGeneralEducationAreas } from "../lib/general-education-engine.ts";
import { KMOU_PROGRAM_OFFERINGS } from "../lib/kmou-program-catalog.ts";
import { bundledRuleRegistry } from "../lib/rule-registry.ts";
import { getVerifiedGeneralEducationPack } from "../lib/verified-general-education.ts";

const recognitionOverlay = JSON.parse(await readFile(new URL(
  "../data/policy-overlays/kmou/general-education/2022/computer-engineering/1.0.0.json",
  import.meta.url,
), "utf8"));
const catalogCodeIndex = JSON.parse(await readFile(new URL(
  "../data/extracted/kmou/general-education-catalog-code-index-2020-2026.json",
  import.meta.url,
), "utf8"));

const categoryByLabel = {
  교양필수: "generalRequired",
  교양선택: "generalElective",
  전공기초: "majorFoundation",
  전공필수: "majorRequired",
  전공선택: "majorElective",
  일반선택: "freeElective",
};

async function loadCandidate(year) {
  return JSON.parse(await readFile(new URL(`../data/rule-candidates/kmou/${year}/computer-engineering/curriculum/0.2.0.json`, import.meta.url), "utf8"));
}

function normalizeRows(rows, rule) {
  return rows.map((row, index) => {
    const ids = matchGeneralEducationAreas(row.교과목번호, rule);
    return {
      rowNumber: index + 1,
      year: row.년도,
      semester: row.학기,
      code: row.교과목번호,
      name: row.교과목명,
      rawCategory: row.교과목구분,
      category: categoryByLabel[row.교과목구분] ?? "freeElective",
      credits: row.학점,
      grade: row.등급,
      professor: "",
      englishName: "",
      passed: true,
      transferCredit: row.학기.includes("편입생 인정학점"),
      reclassified: false,
      generalEducationAreaIds: ids,
      generalEducationMatchStatus: ids.length ? "matched" : "unmapped",
    };
  });
}

function rowsForMinimum(area, minimum) {
  const rows = [];
  let credits = 0;
  for (const course of area.eligibleCourses) {
    rows.push({
      교과목번호: course.code,
      교과목명: course.name,
      교과목구분: "교양선택",
      학점: course.credits,
      등급: "A+",
      년도: "2026",
      학기: "1학기",
    });
    credits += course.credits;
    if (credits >= minimum) break;
  }
  assert.ok(credits >= minimum, `${area.label} 공식 과목 목록으로 최소학점을 구성할 수 있어야 함`);
  return rows;
}

function area(rule, id) {
  const found = rule.generalEducationAreas.find((item) => item.id === id);
  assert.ok(found, `${id} 영역이 존재해야 함`);
  return found;
}

function getProgramIdForYear(year) {
  const offering = KMOU_PROGRAM_OFFERINGS.find((item) => item.admissionYear === year);
  assert.ok(offering, `${year}: 지원 전공`);
  return offering.programId;
}

test("2020과 2021~2024는 사회·경제 및 역사·문화 기준을 학번별로 분리한다", async () => {
  const y2020 = await loadCandidate(2020);
  const y2021 = await loadCandidate(2021);
  assert.equal(area(y2020, "social-economy").minimumCredits, 3);
  assert.equal(area(y2020, "history-culture").minimumCredits, 3);
  assert.equal(y2020.generalEducationCombinedRequirements[0].minimumCredits, 8);
  assert.equal(area(y2021, "social-economy").minimumCredits, 4);
  assert.equal(area(y2021, "history-culture").minimumCredits, 4);
  assert.equal(y2021.generalEducationCombinedRequirements[0].minimumCredits, 9);
});

test("2020~2026 공식 교양 전체 코드 색인은 원본 해시·개수·세부영역 코드를 보존한다", async () => {
  assert.equal(catalogCodeIndex.universityId, "kmou");
  for (let year = 2020; year <= 2026; year += 1) {
    const indexed = catalogCodeIndex.years[String(year)];
    assert.ok(indexed, String(year));
    assert.ok(indexed.courseCount > 200, `${year}: 교양 코드 수`);
    assert.equal(indexed.courseCodes.length, indexed.courseCount, `${year}: 코드 개수`);
    assert.equal(new Set(indexed.courseCodes).size, indexed.courseCount, `${year}: 코드 중복`);
    const sourceBytes = await readFile(new URL(`../${indexed.sourcePath}`, import.meta.url));
    assert.equal(createHash("sha256").update(sourceBytes).digest("hex"), indexed.sourceSha256, `${year}: 원본 해시`);
    const pack = getVerifiedGeneralEducationPack({
      universityId: "kmou",
      admissionYear: year,
      departmentId: getProgramIdForYear(year),
    });
    assert.ok(pack);
    const indexedCodes = new Set(indexed.courseCodes);
    for (const course of pack.rule.generalEducationAreas.flatMap((item) => item.eligibleCourses)) {
      assert.ok(indexedCodes.has(course.code), `${year}:${course.code}`);
    }
  }
});

test("2022 공식 비대상 교양코드는 미등록 과목으로 오판하지 않는다", () => {
  const key = { universityId: "kmou", admissionYear: 2022, departmentId: "environmental-engineering" };
  const pack = getVerifiedGeneralEducationPack(key);
  assert.ok(pack);
  for (const code of ["L3245", "L1105", "09234", "09235", "09236"]) {
    assert.ok(pack.verifiedNonTargetCourseCodes.includes(code), code);
  }
  const courses = normalizeRows([
    { 교과목번호: "L3245", 교과목명: "AI기초코딩", 교과목구분: "교양선택", 학점: 2, 등급: "A+", 년도: "2022", 학기: "1학기" },
    { 교과목번호: "L1105", 교과목명: "기초일본어", 교과목구분: "교양선택", 학점: 2, 등급: "A+", 년도: "2022", 학기: "1학기" },
  ], pack.rule);
  const audit = evaluateGeneralEducation(courses, pack.rule, { verifiedNonTargetCourseCodes: pack.verifiedNonTargetCourseCodes });
  assert.deepEqual(audit.unmappedGeneralElectives, []);
  assert.equal(audit.conclusive, true);
  assert.ok(audit.areas.some((item) => item.status === "missing"));
});

test("152개 학번·전공 조합에 학년도 공통 교양영역을 제공하고 학과 전용 오버레이는 격리한다", () => {
  for (const offering of KMOU_PROGRAM_OFFERINGS) {
    const pack = getVerifiedGeneralEducationPack({
      universityId: "kmou",
      admissionYear: offering.admissionYear,
      departmentId: offering.programId,
    });
    assert.ok(pack, `${offering.admissionYear}:${offering.programId}`);
    assert.deepEqual(pack.rule.selector, {
      universityId: "kmou",
      admissionYear: offering.admissionYear,
      departmentId: offering.programId,
    });
    assert.ok(pack.rule.generalEducationAreas.length > 0);
    const specialRecognition = pack.recognitionOverlay?.rules.length ?? 0;
    assert.equal(specialRecognition > 0, offering.admissionYear === 2022 && offering.programId === "computer-engineering");
  }
  assert.equal(getVerifiedGeneralEducationPack({ universityId: "kmou", admissionYear: 2022, departmentId: "control-engineering" }), null);
  assert.equal(getVerifiedGeneralEducationPack({ universityId: "other", admissionYear: 2022, departmentId: "computer-engineering" }), null);
});

test("2022 타과도 사회경제·역사문화·해양 특성화 이수현황을 계산하되 컴공 전용 이중설강은 상속하지 않는다", async () => {
  const pack = getVerifiedGeneralEducationPack({
    universityId: "kmou",
    admissionYear: 2022,
    departmentId: "environmental-engineering",
  });
  assert.ok(pack);
  const rows = pack.rule.generalEducationAreas.flatMap((requirement) => rowsForMinimum(
    requirement,
    requirement.id === "social-economy" ? 5 : requirement.minimumCredits,
  ));
  const courses = normalizeRows(rows, pack.rule);
  const audit = evaluateGeneralEducation(courses, pack.rule, {
    verifiedNonTargetCourseCodes: pack.verifiedNonTargetCourseCodes,
    recognitionRules: pack.recognitionOverlay?.rules ?? [],
  });
  assert.ok(audit.areas.every((item) => item.status === "satisfied"));
  assert.ok(audit.combinedRequirements.every((item) => item.status === "satisfied"));

  const doubleListed = normalizeRows([{
    교과목번호: "31187",
    교과목명: "동아시아의이해",
    교과목구분: "전공기초",
    학점: 2,
    등급: "A+",
    년도: "2024",
    학기: "편입생 인정학점",
  }], pack.rule);
  const isolated = evaluateGeneralEducation(doubleListed, pack.rule, {
    recognitionRules: pack.recognitionOverlay?.rules ?? [],
  });
  assert.equal(isolated.areas.find((item) => item.id === "history-culture").earned, 0);
});

test("실제 졸업진단 파이프라인에서도 2022 환경공학에 교양 세부영역 결과를 연결한다", () => {
  const key = { universityId: "kmou", admissionYear: 2022, departmentId: "environmental-engineering" };
  const pack = getVerifiedGeneralEducationPack(key);
  const rule = bundledRuleRegistry.find(key);
  assert.ok(pack);
  assert.ok(rule);
  const marine = pack.rule.generalEducationAreas.find((item) => item.id === "marine-culture");
  assert.ok(marine);
  const courses = normalizeRows(rowsForMinimum(marine, marine.minimumCredits), pack.rule);
  const audit = auditTranscript(courses, rule, {
    ...key,
    department: "환경공학전공",
    studentType: "freshman",
    studentTypeLabel: "신입생",
  });
  assert.ok(audit.generalEducation);
  assert.equal(audit.generalEducation.areas.find((item) => item.id === "marine-culture").status, "satisfied");
});

test("2022 공식 과목코드로 해양·사회경제·역사문화 충족 여부를 계산한다", async () => {
  const rule = await loadCandidate(2022);
  const marineCulture = area(rule, "marine-culture");
  const marineSports = area(rule, "marine-sports-art");
  const history = area(rule, "history-culture");
  const social = area(rule, "social-economy");
  const rows = [
    ...rowsForMinimum(marineCulture, marineCulture.minimumCredits),
    ...rowsForMinimum(marineSports, marineSports.minimumCredits),
    ...rowsForMinimum(history, history.minimumCredits),
    ...rowsForMinimum(social, 5),
  ];
  const courses = normalizeRows(rows, rule);
  const audit = evaluateGeneralEducation(courses, rule);
  const progress = Object.fromEntries(audit.areas.map((item) => [item.id, item]));
  assert.equal(progress["marine-culture"].status, "satisfied");
  assert.equal(progress["marine-sports-art"].status, "satisfied");
  assert.equal(progress["history-culture"].status, "satisfied");
  assert.equal(progress["social-economy"].status, "satisfied");
  assert.equal(audit.combinedRequirements[0].status, "satisfied");
  assert.equal(audit.conclusive, true);
});

test("과목명 유사 일치가 아니라 교과목번호 정확 일치만 허용한다", async () => {
  const rule = await loadCandidate(2022);
  const official = area(rule, "social-economy").eligibleCourses[0];
  const courses = normalizeRows([{
    교과목번호: "UNKNOWN-001",
    교과목명: official.name,
    교과목구분: "교양선택",
    학점: official.credits,
    등급: "A+",
    년도: "2026",
    학기: "1학기",
  }], rule);
  assert.deepEqual(courses[0].generalEducationAreaIds, []);
  assert.equal(courses[0].generalEducationMatchStatus, "unmapped");
  const audit = evaluateGeneralEducation(courses, rule);
  assert.equal(audit.areas.find((item) => item.id === "social-economy").status, "needs-review");
  assert.equal(audit.conclusive, false);
});

test("2022 실제 편입 성적표는 이중설강 31187을 포함해 모든 교양 세부영역을 충족한다", async () => {
  const rule = await loadCandidate(2022);
  const rows = [
    { 교과목번호: "L2020", 교과목명: "해양문학입문", 교과목구분: "교양선택", 학점: 2, 등급: "C+", 년도: "2024", 학기: "1학기" },
    { 교과목번호: "L2101", 교과목명: "생존수영", 교과목구분: "교양선택", 학점: 2, 등급: "A", 년도: "2024", 학기: "겨울계절학기" },
    { 교과목번호: "L3045", 교과목명: "한국의세계문화유산", 교과목구분: "교양선택", 학점: 3, 등급: "", 년도: "2024", 학기: "편입생 인정학점" },
    { 교과목번호: "31187", 교과목명: "동아시아의이해", 교과목구분: "전공기초", 학점: 2, 등급: "", 년도: "2024", 학기: "편입생 인정학점" },
    { 교과목번호: "L3169", 교과목명: "법률지식의이해", 교과목구분: "교양선택", 학점: 3, 등급: "", 년도: "2024", 학기: "편입생 인정학점" },
    { 교과목번호: "L9521", 교과목명: "현대사회와법", 교과목구분: "교양선택", 학점: 3, 등급: "", 년도: "2024", 학기: "편입생 인정학점" },
    { 교과목번호: "L1102", 교과목명: "영어회화", 교과목구분: "교양선택", 학점: 2, 등급: "", 년도: "2024", 학기: "편입생 인정학점" },
    { 교과목번호: "L1112", 교과목명: "토익", 교과목구분: "교양선택", 학점: 2, 등급: "", 년도: "2024", 학기: "편입생 인정학점" },
    { 교과목번호: "L3229", 교과목명: "공학자를위한논리와사고", 교과목구분: "교양선택", 학점: 2, 등급: "", 년도: "2024", 학기: "편입생 인정학점" },
  ];
  const courses = normalizeRows(rows, rule);
  const audit = evaluateGeneralEducation(courses, rule, {
    verifiedNonTargetCourseCodes: ["L1102", "L1112", "L3229"],
    recognitionRules: recognitionOverlay.rules,
  });
  const progress = Object.fromEntries(audit.areas.map((item) => [item.id, item]));
  assert.deepEqual([progress["marine-culture"].earned, progress["marine-culture"].status], [2, "satisfied"]);
  assert.deepEqual([progress["marine-sports-art"].earned, progress["marine-sports-art"].status], [2, "satisfied"]);
  assert.deepEqual([progress["history-culture"].earned, progress["history-culture"].status], [5, "satisfied"]);
  assert.deepEqual([progress["social-economy"].earned, progress["social-economy"].status], [6, "satisfied"]);
  assert.deepEqual([audit.combinedRequirements[0].earned, audit.combinedRequirements[0].status], [11, "satisfied"]);
  const doubleListed = progress["history-culture"].matchedCourses.find((course) => course.code === "31187");
  assert.equal(doubleListed.recognitionMode, "double-listed");
  assert.equal(doubleListed.transferCredit, true);
  assert.equal(doubleListed.transcriptCategory, "전공기초");
  assert.equal(doubleListed.categoryDifference, true);
  assert.equal(doubleListed.evidence.cellRange, "E160:M160");
  assert.deepEqual(audit.unmappedGeneralElectives, []);
  assert.equal(audit.conclusive, true);
});

test("이중설강은 과목명이 아니라 정확한 코드로만 인정하고 재수강 행을 중복 합산하지 않는다", async () => {
  const rule = await loadCandidate(2022);
  const sameNameWrongCode = normalizeRows([{
    교과목번호: "WRONG-31187",
    교과목명: "동아시아의이해",
    교과목구분: "전공기초",
    학점: 2,
    등급: "A+",
    년도: "2025",
    학기: "1학기",
  }], rule);
  const wrongAudit = evaluateGeneralEducation(sameNameWrongCode, rule, { recognitionRules: recognitionOverlay.rules });
  assert.equal(wrongAudit.areas.find((item) => item.id === "history-culture").earned, 0);

  const duplicateRows = normalizeRows([
    { 교과목번호: "31187", 교과목명: "동아시아의이해", 교과목구분: "전공기초", 학점: 2, 등급: "B+", 년도: "2024", 학기: "1학기" },
    { 교과목번호: "31187", 교과목명: "동아시아의이해", 교과목구분: "전공기초", 학점: 2, 등급: "A", 년도: "2025", 학기: "1학기" },
  ], rule);
  const duplicateAudit = evaluateGeneralEducation(duplicateRows, rule, { recognitionRules: recognitionOverlay.rules });
  assert.equal(duplicateAudit.areas.find((item) => item.id === "history-culture").earned, 2);
  assert.equal(duplicateAudit.combinedRequirements[0].earned, 2);
});

test("성적표 학점이 공식 코드 맵과 다르면 합산하지 않고 확인 필요로 중단한다", async () => {
  const rule = await loadCandidate(2022);
  const malformed = normalizeRows([{
    교과목번호: "31187",
    교과목명: "동아시아의이해",
    교과목구분: "전공기초",
    학점: 3,
    등급: "A+",
    년도: "2025",
    학기: "1학기",
  }], rule);
  const audit = evaluateGeneralEducation(malformed, rule, { recognitionRules: recognitionOverlay.rules });
  assert.equal(audit.areas.find((item) => item.id === "history-culture").earned, 0);
  assert.deepEqual(audit.mappingConflicts, [{
    code: "31187",
    name: "동아시아의이해",
    credits: 3,
    areaIds: ["history-culture"],
    reason: "credit-mismatch",
    expectedCredits: 2,
  }]);
  assert.equal(audit.conclusive, false);
});

test("2025~2026은 과거 사회·경제 규칙을 적용하지 않고 해양기초 선택교양만 검사한다", async () => {
  for (const year of [2025, 2026]) {
    const rule = await loadCandidate(year);
    assert.deepEqual(rule.generalEducationAreas.map((item) => item.id), ["marine-basic"]);
    assert.equal(rule.generalEducationCombinedRequirements.length, 0);
    const marine = area(rule, "marine-basic");
    const courses = normalizeRows(rowsForMinimum(marine, 2), rule);
    const audit = evaluateGeneralEducation(courses, rule);
    assert.equal(audit.areas[0].status, "satisfied");
  }
});
