import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const manifest = JSON.parse(await readFile(new URL("../data/sources/kmou/source-manifest.json", import.meta.url), "utf8"));
const coverage = JSON.parse(await readFile(new URL("../data/rule-candidates/kmou/coverage-2020-2026.json", import.meta.url), "utf8"));
const generalEducationVerification = JSON.parse(await readFile(new URL("../data/extracted/kmou/general-education-area-verification-2020-2026.json", import.meta.url), "utf8"));
const specialRecognitionOverlay = JSON.parse(await readFile(new URL(
  "../data/policy-overlays/kmou/general-education/2022/computer-engineering/1.0.0.json",
  import.meta.url,
), "utf8"));

function isOfficial(url) {
  if (!url) return true;
  const host = new URL(url).hostname.toLowerCase();
  return host === "kmou.ac.kr" || host.endsWith(".kmou.ac.kr");
}

test("모든 수집 URL은 한국해양대학교 공식 도메인이다", () => {
  for (const source of manifest.documents) {
    assert.ok(isOfficial(source.noticeUrl));
    assert.ok(isOfficial(source.attachmentUrl));
  }
});

test("로컬 원본 파일의 SHA-256과 크기가 manifest와 일치한다", async () => {
  for (const source of manifest.documents.filter((item) => item.localPath)) {
    const file = new URL(`../${source.localPath}`, import.meta.url);
    const bytes = await readFile(file);
    assert.equal((await stat(file)).size, source.byteSize);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), source.sha256);
  }
});

test("2020~2026 후보는 신입학·편입학 공통 규칙이며 2022만 임시 운영한다", async () => {
  for (let year = 2020; year <= 2026; year += 1) {
    const candidate = JSON.parse(await readFile(new URL(`../data/rule-candidates/kmou/${year}/computer-engineering/curriculum/0.2.0.json`, import.meta.url), "utf8"));
    assert.equal(candidate.status, "review");
    assert.equal(candidate.version, "0.2.0");
    assert.ok(candidate.generalEducationAreas.length >= 1);
    assert.equal(candidate.selector.admissionYear, year);
    assert.equal(candidate.selector.studentType, undefined);
    assert.equal(candidate.selector.transferEntryYear, undefined);
    assert.deepEqual(candidate.eligibilityRules.find((item) => item.goal === "regular")?.eligibleStudentTypes, ["freshman", "transfer"]);
    assert.equal(candidate.creditRequirements.reduce((sum, item) => sum + item.minimum, 0), candidate.requiredTotalCredits);
  }
  assert.equal(coverage.records.find((record) => record.curriculumYear === 2022).curriculumRule.operationalRule, "provisional");
  assert.ok(coverage.records.filter((record) => record.curriculumYear !== 2022).every((record) => record.curriculumRule.operationalRule === "blocked"));
  assert.ok(coverage.records.every((record) => record.transferApplication.usesSameCurriculumRule === true));
  assert.ok(coverage.records.every((record) => record.transferApplication.separateTransferGraduationRule === false));
});

test("2022 편입생은 별도 졸업요건 없이 같은 2022 공통 규칙과 인정내역을 사용한다", () => {
  const y2022 = coverage.records.find((record) => record.curriculumYear === 2022);
  assert.equal(y2022.transferApplication.usesSameCurriculumRule, true);
  assert.equal(y2022.transferApplication.separateTransferGraduationRule, false);
  assert.equal(y2022.transferApplication.recognition, "individual-transcript-record-detected");
  assert.equal(y2022.transferApplication.overlay, "verified-review-2024-entry");
  assert.equal(y2022.curriculumRule.operationalRule, "provisional");
  assert.equal(y2022.transferApplication.operationalOverlay, "provisional");
});

test("2024 편입 오버레이는 공식 정책 원본을 고정하고 공통 규칙을 참조한다", async () => {
  const overlay = JSON.parse(await readFile(new URL("../data/policy-overlays/kmou/transfer/2024/0.1.0.json", import.meta.url), "utf8"));
  const sourceIds = new Set(manifest.documents.map((source) => source.documentId));
  assert.equal(overlay.status, "review");
  assert.equal(overlay.selector.studentType, "transfer");
  assert.equal(overlay.selector.transferEntryYear, 2024);
  assert.deepEqual(overlay.composition.graduationRuleSelector, {
    universityId: "kmou",
    admissionYear: 2022,
    departmentId: "computer-engineering",
  });
  assert.equal(overlay.composition.separateTransferGraduationRule, false);
  assert.ok([overlay.curriculumResolution.sourceDocumentId, overlay.creditRecognition.sourceDocumentId].every((sourceId) => sourceIds.has(sourceId)));
  assert.ok(overlay.sources.every((source) => source.fileHash?.startsWith("sha256:")));
});

test("D1 승인본을 우선하고 번들 임시 규칙도 정확한 학번·전공 키로만 선택한다", async () => {
  const registrySource = await readFile(new URL("../lib/rule-registry.ts", import.meta.url), "utf8");
  const activeRouteSource = await readFile(new URL("../app/api/rules/active/route.ts", import.meta.url), "utf8");
  const repositorySource = await readFile(new URL("../lib/server/rule-repository.ts", import.meta.url), "utf8");
  const agentSource = await readFile(new URL("../lib/server/agent-service.ts", import.meta.url), "utf8");
  assert.match(registrySource, /KMOU_CREDIT_AUDIT_RULES/);
  assert.match(registrySource, /KMOU_CREDIT_AUDIT_RULES\.map\(attachVerifiedMajorCourseCatalog\)/);
  assert.match(registrySource, /\[\.\.\.rulesWithVerifiedCatalogs, DEFAULT_RULE\]/);
  assert.match(registrySource, /\["approved", "provisional"\]/);
  assert.match(activeRouteSource, /bundled-provisional/);
  assert.doesNotMatch(activeRouteSource, /transferEntryYear|studentType/);
  assert.match(repositorySource, /isNull\(ruleSets\.transferEntryYear\)/);
  assert.match(repositorySource, /eq\(ruleSets\.studentType, "all"\)/);
  assert.match(repositorySource, /status: "approved"/);
  assert.match(repositorySource, /assertValidRuleSet\(approvedRule\)/);
  assert.match(repositorySource, /rule\.status === "approved"/);
  assert.match(repositorySource, /rows\.length !== 1/);
  assert.match(agentSource, /bundledRuleRegistry\.find\(key\)/);
});

test("2022 번들 규칙은 검증 완료 교양 범위와 임시 범위를 분리한다", async () => {
  const rule = JSON.parse(await readFile(new URL("../rules/kmou/2022/computer-engineering/v1.3.0.json", import.meta.url), "utf8"));
  assert.equal(rule.status, "provisional");
  assert.equal(rule.assurance.overall, "provisional");
  assert.ok(rule.assurance.verifiedScopes.some((scope) => scope.includes("사회와 경제")));
  assert.ok(rule.assurance.verifiedScopes.some((scope) => scope.includes("해양 스포츠와 예술")));
  assert.ok(rule.assurance.provisionalScopes.some((scope) => scope.includes("대체")));
  assert.ok(rule.sources.every((source) => source.fileHash?.length === 64));
});

test("승인 DB를 사용할 수 없어도 2022 정확 키에는 임시 규칙 API가 응답한다", async () => {
  const { GET } = await import("../app/api/rules/active/route.ts");
  const response = await GET(new Request("http://localhost/api/rules/active?universityId=kmou&admissionYear=2022&departmentId=computer-engineering"));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.source, "bundled-provisional");
  assert.equal(body.rule.status, "provisional");
  assert.deepEqual(body.rule.key, { universityId: "kmou", admissionYear: 2022, departmentId: "computer-engineering" });
});

test("상세 규칙이 없는 조합에도 같은 키의 학점 전용 임시 규칙 API가 응답한다", async () => {
  const { GET } = await import("../app/api/rules/active/route.ts");
  const response = await GET(new Request("http://localhost/api/rules/active?universityId=kmou&admissionYear=2026&departmentId=ocean-engineering"));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.source, "bundled-provisional");
  assert.match(body.rule.version, /KMOU-2026-ocean-engineering-CREDIT-v0\.23\.0/);
  assert.equal(body.rule.requiredTotal, 137);
  assert.deepEqual(body.rule.requiredCourses, []);
});

test("교양 세부영역 전수 대조 결과의 개수·정렬 해시·최소학점이 후보와 일치한다", async () => {
  for (let year = 2020; year <= 2026; year += 1) {
    const candidate = JSON.parse(await readFile(new URL(`../data/rule-candidates/kmou/${year}/computer-engineering/curriculum/0.2.0.json`, import.meta.url), "utf8"));
    const verified = generalEducationVerification.years[String(year)];
    assert.equal(coverage.records.find((record) => record.curriculumYear === year).curriculumRule.generalEducationAreaMapping, "verified-final");
    for (const area of candidate.generalEducationAreas) {
      const expected = verified.areas[area.id];
      const payload = area.eligibleCourses.map((course) => `${course.code}|${course.name}|${course.credits}`).sort().join("\n");
      assert.equal(area.minimumCredits, verified.minimumCredits[area.id]);
      assert.equal(area.eligibleCourses.length, expected.count);
      assert.equal(createHash("sha256").update(payload).digest("hex"), expected.setSha256);
    }
    const combined = candidate.generalEducationCombinedRequirements[0];
    assert.equal(combined?.minimumCredits ?? null, verified.combinedMinimumCredits);
  }
});

test("교양 세부영역 후보는 공식 과목코드 정확 매칭과 고정된 근거를 사용한다", async () => {
  const sourceIds = new Set(manifest.documents.map((source) => source.documentId));
  for (let year = 2020; year <= 2026; year += 1) {
    const candidate = JSON.parse(await readFile(new URL(`../data/rule-candidates/kmou/${year}/computer-engineering/curriculum/0.2.0.json`, import.meta.url), "utf8"));
    const seenCodes = new Set();
    for (const area of candidate.generalEducationAreas) {
      assert.equal(area.evidence.matchPolicy, "exact-course-code");
      assert.ok(sourceIds.has(area.evidence.requirementSourceId));
      assert.ok(sourceIds.has(area.evidence.courseCatalogSourceId));
      assert.ok(area.eligibleCourses.length > 0);
      for (const course of area.eligibleCourses) {
        const code = course.code.toUpperCase();
        assert.ok(code.length > 0);
        assert.equal(seenCodes.has(code), false, `${year}학번 ${code}가 여러 교양 영역에 중복 매핑됨`);
        seenCodes.add(code);
      }
    }
  }
});

test("2022 이중설강·교차강의 오버레이는 학번·학과에 고정되고 코드 중복 없이 공식 원본을 참조한다", async () => {
  const candidate = JSON.parse(await readFile(new URL(
    "../data/rule-candidates/kmou/2022/computer-engineering/curriculum/0.2.0.json",
    import.meta.url,
  ), "utf8"));
  const source = manifest.documents.find((item) => item.documentId === specialRecognitionOverlay.source.id);
  assert.equal(specialRecognitionOverlay.status, "verified-final");
  assert.equal(specialRecognitionOverlay.matchPolicy, "exact-course-code-only");
  assert.deepEqual(specialRecognitionOverlay.selector, {
    universityId: "kmou",
    admissionYear: 2022,
    departmentId: "computer-engineering",
  });
  assert.ok(source);
  assert.equal(specialRecognitionOverlay.source.fileHash, `sha256:${source.sha256}`);

  const areaIds = new Set(candidate.generalEducationAreas.map((area) => area.id));
  const directCodes = new Set(candidate.generalEducationAreas.flatMap((area) => area.eligibleCourses.map((course) => course.code.toUpperCase())));
  const specialCodes = new Set();
  for (const recognition of specialRecognitionOverlay.rules) {
    const code = recognition.courseCode.toUpperCase();
    assert.equal(specialCodes.has(code), false, `${code} 특수 인정 코드가 중복됨`);
    assert.equal(directCodes.has(code), false, `${code}가 기본 목록과 특수 인정 목록에 동시에 존재함`);
    assert.ok(areaIds.has(recognition.targetAreaId));
    assert.ok(["double-listed", "cross-institution"].includes(recognition.mode));
    assert.equal(recognition.categoryEffect, "area-only");
    assert.deepEqual(recognition.acceptedTranscriptKinds, ["completed", "transfer-recognized"]);
    assert.equal(recognition.evidence.sourceId, source.documentId);
    assert.match(recognition.evidence.cellRange, /^[A-Z]+\d+:[A-Z]+\d+$/);
    specialCodes.add(code);
  }
  assert.equal(specialRecognitionOverlay.rules.length, 11);

  const eastAsia = specialRecognitionOverlay.rules.find((rule) => rule.courseCode === "31187");
  assert.deepEqual({
    targetAreaId: eastAsia.targetAreaId,
    mode: eastAsia.mode,
    sourceCategory: eastAsia.sourceCategory,
    cellRange: eastAsia.evidence.cellRange,
  }, {
    targetAreaId: "history-culture",
    mode: "double-listed",
    sourceCategory: "전공기초",
    cellRange: "E160:M160",
  });
});
