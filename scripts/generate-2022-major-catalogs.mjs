import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { KMOU_PROGRAM_OFFERINGS } from "../lib/kmou-program-catalog.ts";

const ROOT = resolve(import.meta.dirname, "..");
const SOURCE_PDF = resolve(ROOT, "data/sources/kmou/2022/2022_university_curriculum_table.pdf");
const SOURCE_TEXT = resolve(ROOT, "data/extracted/kmou/2022/2022_university_curriculum_table.txt");
const OUTPUT = resolve(ROOT, "data/course-catalogs/kmou/2022/official-university-catalogs/1.0.0.json");
const EXPECTED_HASH = "1682b2410b14c70f939855eda8ee99a85e3b634928cd7489187579855efbf16a";

const categoryMap = {
  전공기초: "majorFoundation",
  전공필수: "majorRequired",
  전공선택: "majorElective",
};

// The four department-level catalogs remain the primary sources for these programs.
const existingDepartmentCatalogs = new Set([
  "computer-engineering",
  "electronic-communications-engineering",
  "intelligent-control-systems-engineering",
  "radio-mobility-convergence-engineering",
]);

const programs = [
  { programId: "ship-ocean-systems-engineering", labels: [{ name: "조선해양시스템공학전공", pageRanges: [[38, 40]] }] },
  { programId: "ocean-engineering", labels: [{ name: "해양공학전공" }] },
  { programId: "energy-resources-engineering", labels: [{ name: "에너지자원공학전공" }] },
  {
    programId: "marine-architecture-disaster-prevention",
    labels: [{ name: "해양건축·에너지자원공학부" }, { name: "건축방재공학전공" }],
  },
  {
    programId: "marine-spatial-design",
    labels: [{ name: "해양건축·에너지자원공학부" }, { name: "공간디자인전공" }],
  },
  { programId: "ocean-environment-science", labels: [{ name: "해양환경학전공" }] },
  { programId: "marine-biotechnology", labels: [{ name: "해양과학융합학부" }, { name: "해양생물공학전공" }] },
  { programId: "fisheries-bioscience", labels: [{ name: "해양과학융합학부" }, { name: "수산바이오공학전공" }] },
  {
    programId: "marine-sports-science",
    labels: [{ name: "해양스포츠과학과" }],
    requiredCodes: ["90542"],
    supportingSources: [{
      id: "kmou-2022-marine-sports-science-new-student-required-courses",
      documentId: "kmou-2022-marine-sports-science-new-student-required-courses",
      title: "2022학년도 해양스포츠과학과 제1학기 신입생 수강신청 필요 교과목",
      organization: "국립한국해양대학교 해양스포츠과학과",
      updatedAt: "2022-02-22",
      url: "https://www.kmou.ac.kr/ocean-ope/na/ntt/selectNttInfo.do?currPage=1&mi=1784&nttSn=10311325",
      fileHash: "sha256:6ab714f22cb6658a614ef88077864c224c6414cf458696ded294684b207c1a5e",
      documentVersionId: "kmou-2022-marine-sports-new-student-required@6ab714f22cb6",
      role: "cohort-requirement",
      documentYear: 2022,
      appliesToAdmissionYears: [2022],
      appliesToDepartmentIds: ["marine-sports-science"],
      documentScope: "department",
      evidenceScope: {
        departmentId: "marine-sports-science",
        departmentName: "해양스포츠과학과",
        locator: "첨부 PDF 1쪽 · 수강신청 필요 교과목 표",
        page: 1,
      },
    }],
    supportingNote: "신입생 필수 신청표로 스포츠과학의이해(90542)를 개별 필수로 추가 확인했습니다.",
    selectiveFoundationPoolResolved: true,
  },
  { programId: "mechanical-systems-engineering", labels: [{ name: "기계시스템공학전공" }] },
  { programId: "refrigeration-air-conditioning-engineering", labels: [{ name: "냉동공조공학전공" }] },
  { programId: "marine-advanced-materials-engineering", labels: [{ name: "해양신소재융합공학과" }] },
  { programId: "electrical-electronics-engineering", labels: [{ name: "전기전자공학전공" }] },
  { programId: "nano-semiconductor-engineering", labels: [{ name: "나노반도체공학전공" }] },
  { programId: "data-science", labels: [{ name: "데이터사이언스전공" }] },
  { programId: "logistics-systems-engineering", labels: [{ name: "물류시스템공학전공" }] },
  {
    programId: "environmental-engineering",
    labels: [{ name: "환경공학전공" }],
    requiredCodes: ["53390", "40710", "50174", "50267", "52580", "53393"],
    supportingSources: [{
      id: "kmou-2022-environmental-engineering-credit-table",
      documentId: "kmou-2022-environmental-engineering-credit-table",
      title: "2022학년도 환경공학전공 신입생 적용 교육과정 편제학점표",
      organization: "국립한국해양대학교 환경공학과",
      updatedAt: "2022-02-03",
      url: "https://www.kmou.ac.kr/common/nttFileDownload.do?fileKey=e39ec8adf729a7c307c7a6f11a965930",
      fileHash: "sha256:4e8473cb9d86e9bde79dbd9804abef1c5c9baf3d5d192ccb40f38e996ebb457a",
      documentVersionId: "kmou-2022-environmental-engineering-credit-table@4e8473cb9d86",
      role: "cohort-requirement",
      documentYear: 2022,
      appliesToAdmissionYears: [2022],
      appliesToDepartmentIds: ["environmental-engineering"],
      documentScope: "department",
      evidenceScope: {
        departmentId: "environmental-engineering",
        departmentName: "환경공학전공",
        locator: "첨부 PDF 1쪽 · 필수이수 전공선택(심화전공) 교과목 표",
        page: 1,
      },
    }],
    supportingNote: "환경공학과 편제표의 필수이수 심화전공 전공선택 6과목을 개별 필수로 추가 확인했습니다.",
  },
  { programId: "civil-engineering", labels: [{ name: "건설공학전공" }] },
];

const courseNameOverrides = new Map([
  ["55023", "AI 프로그래밍 및 데이터 활용"],
  ["71321", "글로벌스포츠영어&커뮤니케이션"],
  ["90573", "컴퓨터프로그래밍과실무적문제해결"],
  ["52672", "선박전기전자시스템및승선실습"],
  ["55158", "반도체 장비 보드 설계 및 검증"],
  ["52320", "환경공학자를위한캡스톤디자인"],
  ["53102", "환경공학자를위한캡스톤디자인Ⅱ"],
]);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function includesPage(page, ranges) {
  return !ranges || ranges.some(([start, end]) => page >= start && page <= end);
}

function compactPages(pages) {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const ranges = [];
  for (const page of sorted) {
    const last = ranges.at(-1);
    if (last && page === last[1] + 1) last[1] = page;
    else ranges.push([page, page]);
  }
  return ranges.map(([start, end]) => start === end ? `${start}쪽` : `${start}-${end}쪽`).join(", ");
}

function normalizeName(value) {
  return value.replace(/\s+/g, " ").trim();
}

function parseRows(pageTexts, label) {
  const escaped = escapeRegExp(label.name);
  const rowPattern = new RegExp(
    `^\\s*${escaped}\\s+(전공기초|전공필수|전공선택)\\s+([A-Z0-9]+)\\s+([1-4])\\s+(1학기|2학기)\\s*(.*?)\\s+(\\d+(?:\\.\\d+)?)\\/\\s*(\\d+(?:\\.\\d+)?)\\/\\s*(\\d+(?:\\.\\d+)?)`,
  );
  const rows = [];
  pageTexts.forEach((pageText, index) => {
    const page = index + 1;
    if (!includesPage(page, label.pageRanges)) return;
    for (const line of pageText.split(/\r?\n/)) {
      const match = line.match(rowPattern);
      if (!match) continue;
      const [, rawCategory, code, yearText, semesterText, extractedName, creditsText] = match;
      const name = normalizeName(extractedName) || courseNameOverrides.get(code);
      if (!name) throw new Error(`${label.name} ${code}: PDF 줄바꿈 과목명 보정값이 없습니다.`);
      rows.push({
        code,
        name,
        category: categoryMap[rawCategory],
        credits: Number(creditsText),
        required: rawCategory === "전공필수",
        recommendedYear: Number(yearText),
        recommendedSemester: Number(semesterText[0]),
        page,
        sourceLabel: label.name,
      });
    }
  });
  if (!rows.length) throw new Error(`${label.name}: 과목 행을 추출하지 못했습니다.`);
  return rows;
}

function deduplicateRows(rows, programId) {
  const byCode = new Map();
  for (const row of rows) {
    if (row.credits <= 0) continue;
    const previous = byCode.get(row.code);
    if (!previous) {
      byCode.set(row.code, { ...row, pages: [row.page] });
      continue;
    }
    if (previous.name !== row.name || previous.category !== row.category || previous.credits !== row.credits) {
      throw new Error(`${programId} ${row.code}: 중복 코드의 과목명·이수구분·학점이 다릅니다.`);
    }
    previous.pages.push(row.page);
    if (previous.recommendedYear !== row.recommendedYear) delete previous.recommendedYear;
    if (previous.recommendedSemester !== row.recommendedSemester) delete previous.recommendedSemester;
  }
  return [...byCode.values()].sort((a, b) =>
    (a.recommendedYear ?? 9) - (b.recommendedYear ?? 9)
    || (a.recommendedSemester ?? 9) - (b.recommendedSemester ?? 9)
    || a.category.localeCompare(b.category)
    || a.code.localeCompare(b.code));
}

function sumCredits(entries, category) {
  return entries.filter((entry) => entry.category === category).reduce((total, entry) => total + entry.credits, 0);
}

function catalogSource(programId, displayName, pages) {
  const id = `kmou-2022-${programId}-university-major-curriculum-table`;
  return {
    id,
    documentId: "kmou-2022-university-major-curriculum-table",
    title: `2022학년도 교육과정표 · ${displayName}`,
    organization: "국립한국해양대학교 학사과",
    updatedAt: "2024-02-05",
    url: "https://www.kmou.ac.kr/common/nttFileDownload.do?fileKey=10a4e53fd8a65f435c7fbb6c1fbe4b78",
    fileHash: `sha256:${EXPECTED_HASH}`,
    documentVersionId: `kmou-2022-university-major-curriculum-table@${EXPECTED_HASH.slice(0, 12)}`,
    role: "cohort-requirement",
    documentYear: 2022,
    appliesToAdmissionYears: [2022],
    appliesToDepartmentIds: [programId],
    documentScope: "program-row",
    evidenceScope: {
      departmentId: programId,
      departmentName: displayName,
      locator: `첨부 PDF ${compactPages(pages)} · 전공기초·전공필수·전공선택 행`,
      page: Math.min(...pages),
    },
  };
}

const sourceBytes = await readFile(SOURCE_PDF);
const actualHash = createHash("sha256").update(sourceBytes).digest("hex");
if (actualHash !== EXPECTED_HASH) throw new Error(`공식 PDF SHA-256 불일치: ${actualHash}`);

const pageTexts = (await readFile(SOURCE_TEXT, "utf8")).split("\f");
const offerings = new Map(KMOU_PROGRAM_OFFERINGS
  .filter((offering) => offering.admissionYear === 2022)
  .map((offering) => [offering.programId, offering]));

const catalogs = programs.map((definition) => {
  if (existingDepartmentCatalogs.has(definition.programId)) throw new Error(`${definition.programId}: 학과별 원본 카탈로그를 덮어쓸 수 없습니다.`);
  const offering = offerings.get(definition.programId);
  if (!offering) throw new Error(`${definition.programId}: 2022 편제학점 행이 없습니다.`);
  const rows = deduplicateRows(definition.labels.flatMap((label) => parseRows(pageTexts, label)), definition.programId);
  const foundationCredits = sumCredits(rows, "majorFoundation");
  const requiredCredits = sumCredits(rows, "majorRequired");
  const expectedRequiredCredits = offering.creditSummary.minimumMajorRequired + offering.creditSummary.advancedMajorRequired;
  if (foundationCredits < offering.creditSummary.majorFoundation) {
    throw new Error(`${definition.programId}: 전공기초 과목 풀 ${foundationCredits} < 편제 ${offering.creditSummary.majorFoundation}`);
  }
  if (requiredCredits !== expectedRequiredCredits) {
    throw new Error(`${definition.programId}: 전공필수 과목 합계 ${requiredCredits} != 편제 ${expectedRequiredCredits}`);
  }
  const sourcePages = rows.flatMap((row) => row.pages);
  const source = catalogSource(definition.programId, offering.displayName, sourcePages);
  const foundationSetResolved = foundationCredits === offering.creditSummary.majorFoundation;
  if (foundationSetResolved) {
    for (const row of rows) {
      if (row.category === "majorFoundation") row.required = true;
    }
  }
  for (const code of definition.requiredCodes ?? []) {
    const row = rows.find((entry) => entry.code === code);
    if (!row) throw new Error(`${definition.programId} ${code}: 보조 원본의 필수과목이 전체 교육과정표에 없습니다.`);
    row.required = true;
  }
  const sources = [source, ...(definition.supportingSources ?? [])];
  const requiredCourseSetVerified = foundationSetResolved || definition.selectiveFoundationPoolResolved === true;
  return {
    id: `kmou-2022-${definition.programId}-major-catalog`,
    version: "1.0.0",
    status: "verified",
    sourceId: source.id,
    sourceIds: sources.map((item) => item.id),
    matchPolicy: "exact-course-code",
    role: "cohort-catalog",
    activation: {
      minimumTranscriptMatches: 5,
      minimumMatchedCredits: 12,
      minimumCategoryAgreementRatio: 0,
    },
    requiredCourseSetStatus: requiredCourseSetVerified ? "verified" : "review",
    ...(definition.selectiveFoundationPoolResolved ? {
      categoryRequirementModes: { majorFoundation: "minimum-from-pool" },
    } : {}),
    requiredCourseSetNote: `${foundationSetResolved
      ? `학사과 2022학년도 교육과정표의 전공기초 ${foundationCredits}학점과 전공필수 ${requiredCredits}학점을 편제학점과 대조했습니다.`
      : `전공필수 ${requiredCredits}학점은 편제와 일치합니다. 전공기초는 공식 과목 풀 ${foundationCredits}학점 중 ${offering.creditSummary.majorFoundation}학점을 이수하는 구조여서 개별 미이수 확정 대신 영역 부족학점으로 표시합니다.`}${definition.supportingNote ? ` ${definition.supportingNote}` : ""}`,
    sources,
    entries: rows.map((row) => ({
      code: row.code,
      name: row.name,
      category: row.category,
      credits: row.credits,
      required: row.required,
      ...(row.recommendedYear ? { recommendedYear: row.recommendedYear } : {}),
      ...(row.recommendedSemester ? { recommendedSemester: row.recommendedSemester } : {}),
    })),
  };
});

await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify({
  schemaVersion: 1,
  generatedFrom: "data/extracted/kmou/2022/2022_university_curriculum_table.txt",
  sourceSha256: EXPECTED_HASH,
  catalogs,
}, null, 2)}\n`);

for (const catalog of catalogs) {
  const foundation = sumCredits(catalog.entries, "majorFoundation");
  const required = sumCredits(catalog.entries, "majorRequired");
  console.log(`${catalog.sources[0].appliesToDepartmentIds[0]}\t${catalog.entries.length}\t전공기초 ${foundation}\t전공필수 ${required}`);
}
