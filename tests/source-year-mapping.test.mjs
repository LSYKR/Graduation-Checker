import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  KMOU_CREDIT_AUDIT_RULES,
  KMOU_PROGRAM_OFFERINGS,
} from "../lib/kmou-program-catalog.ts";
import { getKmouGeneralEducationLocator } from "../lib/kmou-general-education-sources.ts";
import { DEFAULT_RULE, bundledRuleRegistry } from "../lib/rule-registry.ts";
import { getVerifiedGeneralEducationPack } from "../lib/verified-general-education.ts";
import {
  CURRENT_MAJOR_CLASSIFICATION_CATALOGS,
  getBundledMajorCourseCatalog,
  getCurrentMajorClassificationCatalog,
  getVerifiedRequiredCourseOverlay,
} from "../lib/verified-major-curricula.ts";
import { auditTranscript } from "../lib/graduation-engine.ts";

const manifest = JSON.parse(await readFile(
  new URL("../data/sources/kmou/source-manifest.json", import.meta.url),
  "utf8",
));
const manifestById = new Map(manifest.documents.map((source) => [source.documentId, source]));

function assertApplicableRequirementSource(source, admissionYear, departmentId, context) {
  assert.notEqual(source.role, "classification-reference", `${context}: 분류 보조자료가 졸업요건 원본에 혼입됨`);
  assert.ok(source.appliesToAdmissionYears?.includes(admissionYear), `${context}: ${source.id} 적용 학번 불일치`);
  if (source.role === "cohort-requirement") {
    assert.equal(source.documentYear, admissionYear, `${context}: ${source.id} 문서연도 불일치`);
  }
  if (source.appliesToDepartmentIds) assert.ok(source.appliesToDepartmentIds.includes(departmentId), `${context}: ${source.id} 적용 학과 불일치`);
  if (source.evidenceScope) assert.equal(source.evidenceScope.departmentId, departmentId, `${context}: ${source.id} 근거 학과 불일치`);
  if (source.documentScope === "program-row") {
    assert.deepEqual(source.appliesToDepartmentIds, [departmentId], `${context}: ${source.id} 학과 범위 미고정`);
    assert.equal(source.evidenceScope?.departmentId, departmentId, `${context}: ${source.id} 학과별 근거 위치 미고정`);
  }
  const manifestId = source.documentId ?? source.id;
  const manifestSource = manifestById.get(manifestId);
  assert.ok(manifestSource, `${context}: ${manifestId}가 공식 원본 manifest에 없음`);
  assert.ok(manifestSource.admissionYears.includes(admissionYear), `${context}: manifest의 ${source.id} 적용 학번 불일치`);
}

test("152개 학번·전공 규칙은 입학학년도와 선택 전공 행이 모두 일치하는 편제표만 선택한다", () => {
  assert.equal(KMOU_CREDIT_AUDIT_RULES.length, 152);
  for (const rule of KMOU_CREDIT_AUDIT_RULES) {
    const context = `${rule.key.admissionYear}:${rule.key.departmentId}`;
    const cohortSources = rule.sources.filter((source) => source.role === "cohort-requirement");
    const source = cohortSources.find((candidate) => candidate.id === `kmou-${rule.key.admissionYear}-${rule.key.departmentId}-credit-requirement`);
    assert.ok(source, `${context}: 학점 편제 원본 없음`);
    assert.equal(source.id, `kmou-${rule.key.admissionYear}-${rule.key.departmentId}-credit-requirement`, context);
    assert.equal(source.documentScope, "program-row", context);
    assert.equal(source.evidenceScope?.departmentId, rule.key.departmentId, context);
    assert.ok(source.evidenceScope?.departmentName, context);
    assert.ok(source.title.includes(source.evidenceScope.departmentName) || rule.key.departmentId === "environmental-engineering", context);
    const expectedDocumentId = rule.key.admissionYear === 2022 && rule.key.departmentId === "environmental-engineering"
      ? "kmou-2022-environmental-engineering-credit-table"
      : `kmou-${rule.key.admissionYear}-new-student-course-guide`;
    assert.equal(source.documentId, expectedDocumentId, context);
    for (const candidate of rule.sources) assertApplicableRequirementSource(candidate, rule.key.admissionYear, rule.key.departmentId, context);
  }
});

test("152개 학번·전공 교양 규칙은 선택 전공의 공식 쪽·시트·행으로 다시 고정된다", () => {
  for (const offering of KMOU_PROGRAM_OFFERINGS) {
    const key = {
      universityId: "kmou",
      admissionYear: offering.admissionYear,
      departmentId: offering.programId,
    };
    const pack = getVerifiedGeneralEducationPack(key);
    assert.ok(pack, `${offering.admissionYear}:${offering.programId}`);
    const locator = getKmouGeneralEducationLocator(key);
    assert.ok(locator, `${offering.admissionYear}:${offering.programId}:근거 위치 없음`);
    const scopedSource = pack.rule.sources.find((source) => source.id === `kmou-${offering.admissionYear}-${offering.programId}-general-education-requirement`);
    assert.ok(scopedSource, `${offering.admissionYear}:${offering.programId}:학과별 교양 원본 없음`);
    assert.equal(scopedSource.documentId, locator.documentId);
    assert.equal(scopedSource.evidenceScope?.page, locator.page);
    assert.equal(scopedSource.evidenceScope?.sheet, locator.sheet);
    assert.equal(scopedSource.evidenceScope?.row, locator.row);
    assert.equal(scopedSource.evidenceScope?.departmentId, offering.programId);
    for (const area of pack.rule.generalEducationAreas) assert.equal(area.evidence.requirementSourceId, scopedSource.id);
    for (const requirement of pack.rule.generalEducationCombinedRequirements) assert.equal(requirement.evidence.requirementSourceId, scopedSource.id);
    for (const source of pack.rule.sources) {
      assertApplicableRequirementSource(source, offering.admissionYear, offering.programId, `${offering.admissionYear}:${offering.programId}:교양`);
    }
  }
});

test("2020·2021·2023·2024 상세 전공표는 선택 학번·전공의 공식 원본만 연결한다", () => {
  for (const offering of KMOU_PROGRAM_OFFERINGS.filter((item) => [2020, 2021, 2023, 2024].includes(item.admissionYear))) {
    const key = {
      universityId: "kmou",
      admissionYear: offering.admissionYear,
      departmentId: offering.programId,
    };
    const catalog = getBundledMajorCourseCatalog(key);
    assert.ok(catalog, `${offering.admissionYear}:${offering.programId}`);
    const source = catalog.sources.find((candidate) => candidate.id === catalog.sourceId);
    assert.ok(source, `${offering.admissionYear}:${offering.programId}:상세 원본 없음`);
    assert.equal(source.documentId, `kmou-${offering.admissionYear}-university-major-curriculum-table`);
    if (offering.admissionYear === 2020) {
      assert.ok(source.evidenceScope?.locator.includes(offering.curriculumCollegeName), `${offering.programId}: 2020 당시 단과대 근거 누락`);
    }
    assertApplicableRequirementSource(source, offering.admissionYear, offering.programId, `${offering.admissionYear}:${offering.programId}:전공`);
  }
});

test("2025·2026 신입생 1학기 부분표도 선택 학번·전공 행으로만 고정한다", () => {
  for (const offering of KMOU_PROGRAM_OFFERINGS.filter((item) => [2025, 2026].includes(item.admissionYear))) {
    const key = { universityId: "kmou", admissionYear: offering.admissionYear, departmentId: offering.programId };
    const overlay = getVerifiedRequiredCourseOverlay(key);
    assert.ok(overlay, `${offering.admissionYear}:${offering.programId}`);
    assert.equal(overlay.sources.length, 1);
    const [source] = overlay.sources;
    assert.equal(source.documentId, `kmou-${offering.admissionYear}-first-semester-required-courses`);
    assert.equal(source.documentYear, offering.admissionYear);
    assert.deepEqual(source.appliesToAdmissionYears, [offering.admissionYear]);
    assert.deepEqual(source.appliesToDepartmentIds, [offering.programId]);
    assert.equal(source.evidenceScope?.departmentId, offering.programId);
    assert.ok(source.evidenceScope?.page);
    assertApplicableRequirementSource(source, offering.admissionYear, offering.programId, `${offering.admissionYear}:${offering.programId}:1학기부분표`);
  }
});

test("상세 2022 컴퓨터공학 규칙도 2022 적용 원본과 대학 공통 규정만 포함한다", () => {
  for (const source of DEFAULT_RULE.sources) assertApplicableRequirementSource(source, 2022, "computer-engineering", "2022:computer-engineering");
  assert.ok(DEFAULT_RULE.sources.every((source) => !source.id.includes("opened-courses-2024") && !source.id.includes("opened-courses-2025")));
  assert.deepEqual(
    DEFAULT_RULE.sources.filter((source) => source.role === "cohort-requirement").map((source) => source.documentYear),
    [2022, 2022, 2022],
  );
});

test("교차연도 전공표는 분류 보조자료로만 격리하고 환경공학에는 연결하지 않는다", () => {
  assert.equal(CURRENT_MAJOR_CLASSIFICATION_CATALOGS.length, 1);
  const [catalog] = CURRENT_MAJOR_CLASSIFICATION_CATALOGS;
  assert.equal(catalog.role, "current-classification");
  assert.equal(catalog.referenceYear, 2024);
  assert.equal(catalog.requiredCourseSetStatus, "review");
  assert.ok(catalog.sources?.length);
  assert.ok(catalog.sources.every((source) => source.role === "classification-reference" && source.documentYear === catalog.referenceYear));

  const environmentalRule = bundledRuleRegistry.find({
    universityId: "kmou",
    admissionYear: 2022,
    departmentId: "environmental-engineering",
  });
  assert.ok(environmentalRule);
  assert.equal(getCurrentMajorClassificationCatalog(environmentalRule), null);
});

test("실제 감사 결과의 공식 원본에는 다른 연도 분류자료가 들어갈 수 없다", () => {
  const environmentalRule = bundledRuleRegistry.find({
    universityId: "kmou",
    admissionYear: 2022,
    departmentId: "environmental-engineering",
  });
  assert.ok(environmentalRule);
  const course = {
    rowNumber: 1,
    year: "2022",
    semester: "1학기",
    code: "50363",
    name: "환경공학개론",
    rawCategory: "전공필수",
    category: "majorRequired",
    credits: 3,
    grade: "A0",
    professor: "",
    englishName: "",
    passed: true,
    transferCredit: false,
    reclassified: false,
  };
  const audit = auditTranscript([course], environmentalRule, {
    universityId: "kmou",
    admissionYear: 2022,
    departmentId: "environmental-engineering",
    department: "환경공학전공",
    studentType: "freshman",
    studentTypeLabel: "신입생",
  });
  assert.ok(audit.officialSources.every((source) => source.role !== "classification-reference"));
  assert.ok(audit.officialSources.every((source) => source.appliesToAdmissionYears?.includes(2022)));
  assert.ok(audit.officialSources.every((source) => !source.title.includes("2024학년도 환경공학")));
  assert.ok(audit.officialSources.every((source) => source.evidenceScope?.departmentId === undefined || source.evidenceScope.departmentId === "environmental-engineering"));
  assert.ok(audit.officialSources.every((source) => !`${source.title} ${source.organization} ${source.url}`.includes("인공지능공학부")));
  assert.ok(audit.officialSources.every((source) => !source.url.includes("/ca/")));
  assert.ok(audit.officialSources.some((source) => source.documentId === "kmou-2022-environmental-engineering-credit-table"));
  assert.ok(audit.officialSources.some((source) => source.documentId === "kmou-2022-general-education-course-catalog" && source.evidenceScope?.page === 27));
});
