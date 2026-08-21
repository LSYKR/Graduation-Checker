import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { KMOU_PROGRAM_OFFERINGS } from "../lib/kmou-program-catalog.ts";

const ROOT = resolve(import.meta.dirname, "..");

const categoryMap = {
  전공기초: "majorFoundation",
  전공필수: "majorRequired",
  전공선택: "majorElective",
};

const sourceByYear = {
  2020: {
    hash: "52de906635231bf119dc45e4a1ed6b12313e76e447fafec73c47a9c4ed11d2ca",
    attachmentUrl: "https://www.kmou.ac.kr/common/nttFileDownload.do?fileKey=7dfe64544b0d29a90dfcd5dafdbe7e34",
    noticeUrl: "https://www.kmou.ac.kr/onestop/na/ntt/selectNttInfo.do?nttSn=10324211&mi=561",
    updatedAt: "2023-01-11",
  },
  2021: {
    hash: "9877d5051f7ab5ca07b7cb205205c7e90c4d57bfd1a15d0c991ba3f3e7029ff4",
    attachmentUrl: "https://www.kmou.ac.kr/common/nttFileDownload.do?fileKey=dd47fe2d5135cc975dec70f1f46bdc98",
    noticeUrl: "https://www.kmou.ac.kr/onestop/na/ntt/selectNttInfo.do?nttSn=10341685&mi=561",
    updatedAt: "2024-02-05",
  },
  2023: {
    hash: "995d6740747731cda2f067e6fcf01f0862088d2b63dbf274927488ce2daa6a3e",
    attachmentUrl: "https://www.kmou.ac.kr/common/nttFileDownload.do?fileKey=0777d6cd88ffc911c3b899158088c511",
    noticeUrl: "https://www.kmou.ac.kr/onestop/na/ntt/selectNttInfo.do?nttSn=10341685&mi=561",
    updatedAt: "2024-02-05",
  },
  2024: {
    hash: "7c5b0e672ba2c89db0e364b3b51fdd077feef1dcfb871ad7d60ce538ed2ef54a",
    attachmentUrl: "https://www.kmou.ac.kr/common/nttFileDownload.do?fileKey=9f823b786b400022f2c1db7edaca7df5",
    noticeUrl: "https://www.kmou.ac.kr/onestop/na/ntt/selectNttInfo.do?nttSn=10341685&mi=561",
    updatedAt: "2024-02-05",
  },
};

const commonProgramDefinitions = [
  { programId: "ship-ocean-systems-engineering", labelKey: "ship" },
  { programId: "ocean-engineering", labelKey: "ocean" },
  { programId: "energy-resources-engineering", labelKey: "energy" },
  { programId: "marine-architecture-disaster-prevention", labelKeys: ["architectureCommon", "disaster"] },
  { programId: "marine-spatial-design", labelKeys: ["architectureCommon", "spatial"] },
  { programId: "ocean-environment-science", labelKey: "oceanEnvironment" },
  { programId: "marine-biotechnology", labelKeys: ["marineScienceCommon", "bio"] },
  { programId: "fisheries-bioscience", labelKeys: ["marineScienceCommon", "fisheries"] },
  { programId: "marine-sports-science", labelKey: "sports", selectiveFoundationPool: true },
  { programId: "mechanical-systems-engineering", labelKey: "mechanical" },
  { programId: "refrigeration-air-conditioning-engineering", labelKey: "refrigeration" },
  { programId: "marine-advanced-materials-engineering", labelKey: "materials" },
  { programId: "electrical-electronics-engineering", labelKey: "electrical" },
  { programId: "electronic-communications-engineering", labelKey: "communications" },
  { programId: "nano-semiconductor-engineering", labelKey: "nano" },
  { programId: "radio-mobility-convergence-engineering", labelKey: "radio" },
  { programId: "data-science", labelKey: "data" },
  { programId: "intelligent-control-systems-engineering", labelKey: "control" },
  { programId: "computer-engineering", labelKey: "computer" },
  { programId: "logistics-systems-engineering", labelKey: "logistics" },
  { programId: "environmental-engineering", labelKey: "environment" },
  { programId: "civil-engineering", labelKey: "civil" },
];

const reviewedRequiredCreditMismatches2020 = new Set([
  "marine-advanced-materials-engineering",
  "electrical-electronics-engineering",
  "nano-semiconductor-engineering",
  "intelligent-control-systems-engineering",
  "computer-engineering",
  "civil-engineering",
]);

const labelSets = {
  2020: {
    ship: ["조선해양시스템공학부", 58, 60, true],
    ocean: ["해양공학과", 74, 76, true],
    energy: ["에너지자원공학과", 61, 63, true],
    architectureCommon: ["해양공간건축학부", 54, 54, true],
    disaster: ["건축방재공학전공", 55, 55, true],
    spatial: ["공간디자인전공", 56, 57, true],
    marineScienceCommon: ["해양생명과학부", 67, 67, true],
    oceanEnvironment: ["해양환경학과", 64, 66, true],
    bio: ["해양생물공학전공", 68, 69, true],
    fisheries: ["수산바이오공학전공", 70, 71, true],
    sports: ["해양체육학과", 51, 53, true],
    mechanical: ["기계시스템공학전공", 77, 79, true],
    refrigeration: ["냉동공조·에너지시스템공학전공", 80, 82, true],
    materials: ["해양신소재융합공학과", 120, 123, true],
    electrical: ["전기전자공학전공", 102, 104, true],
    communications: ["전자통신공학전공", 105, 107, true],
    nano: ["전자소재공학전공", 108, 110, true],
    radio: ["전파공학과", 89, 91, true],
    data: ["데이터정보학과", 95, 97, true],
    control: ["제어계측공학전공", 114, 116, true],
    computer: ["IT융합전공", 117, 119, true],
    logistics: ["물류시스템공학과", 92, 94, true],
    environment: ["환경공학과", 86, 88, true],
    civil: ["건설공학과", 98, 101, true],
  },
  2021: {
    ship: ["조선해양시스템공학전공", 60, 62],
    ocean: ["해양공학전공", 63, 65],
    energy: ["에너지자원공학전공", 67, 69],
    architectureCommon: ["해양건축·에너지자원공학부", 66, 66],
    disaster: ["건축방재공학전공", 72, 73],
    spatial: ["공간디자인전공", 70, 71],
    marineScienceCommon: ["해양과학융합학부", 74, 74],
    oceanEnvironment: ["해양환경학전공", 75, 77],
    bio: ["해양생물공학전공", 78, 79],
    fisheries: ["수산바이오공학전공", 80, 81],
    sports: ["해양스포츠과학과", 82, 84],
    mechanical: ["기계시스템공학전공", 85, 87],
    refrigeration: ["냉동공조공학전공", 88, 90],
    materials: ["해양신소재융합공학과", 94, 96],
    electrical: ["전기전자공학전공", 97, 99],
    communications: ["전자통신공학전공", 100, 102],
    nano: ["전자소재공학전공", 103, 105],
    radio: ["전파융합공학전공", 106, 108],
    data: ["데이터사이언스전공", 109, 111],
    control: ["제어계측공학전공", 115, 117],
    computer: ["IT융합전공", 118, 120],
    logistics: ["물류시스템공학전공", 121, 123],
    environment: ["환경공학전공", 124, 126],
    civil: ["건설공학전공", 127, 129],
  },
  2023: {
    ship: ["조선해양시스템공학전공", 71, 73],
    ocean: ["해양공학과", 74, 76],
    energy: ["에너지자원공학과", 77, 79],
    architectureCommon: ["해양공간건축학부", 80, 80],
    disaster: ["건축방재공학전공", 81, 82],
    spatial: ["공간디자인전공", 83, 84],
    marineScienceCommon: ["해양과학융합학부", 36, 36],
    oceanEnvironment: ["해양환경학전공", 37, 39],
    bio: ["해양생물공학전공", 40, 41],
    fisheries: ["수산바이오공학전공", 42, 43],
    sports: ["해양스포츠과학과", 44, 46],
    mechanical: ["기계시스템공학전공", 47, 49],
    refrigeration: ["냉동공조공학전공", 50, 52],
    materials: ["해양신소재융합공학과", 53, 55],
    electrical: ["전기전자공학전공", 56, 58],
    communications: ["전자정보통신공학전공", 68, 70],
    nano: ["나노반도체공학전공", 65, 67],
    radio: ["전파융합공학전공", 59, 61],
    data: ["데이터사이언스전공", 62, 64],
    control: ["지능제어시스템공학전공", 117, 119],
    computer: ["컴퓨터공학전공", 120, 122],
    logistics: ["물류시스템공학과", 85, 87],
    environment: ["환경공학과", 90, 92],
    civil: ["토목공학과", 93, 95],
  },
  2024: {
    ship: ["조선해양시스템공학전공", 68, 70],
    ocean: ["해양공학과", 71, 73],
    energy: ["에너지자원공학과", 74, 76],
    architectureCommon: ["해양공간건축학부", 77, 77],
    disaster: ["건축방재공학전공", 78, 79],
    spatial: ["공간디자인전공", 80, 81],
    marineScienceCommon: ["해양과학융합학부", 33, 33],
    oceanEnvironment: ["해양환경학전공", 34, 36],
    bio: ["해양생물공학전공", 37, 38],
    fisheries: ["수산바이오공학전공", 39, 40],
    sports: ["해양스포츠과학과", 41, 43],
    mechanical: ["기계시스템공학전공", 44, 46],
    refrigeration: ["냉동공조공학전공", 47, 49],
    materials: ["해양신소재융합공학과", 50, 52],
    electrical: ["전기전자공학전공", 53, 55],
    communications: ["전자정보통신공학전공", 65, 67],
    nano: ["나노반도체공학전공", 62, 64],
    radio: ["전파융합공학전공", 56, 58],
    data: ["데이터사이언스전공", 59, 61],
    control: ["지능제어시스템공학전공", 111, 113],
    computer: ["컴퓨터공학전공", 114, 116],
    logistics: ["물류시스템공학과", 82, 84],
    environment: ["환경공학과", 87, 89],
    civil: ["토목공학과", 90, 92],
  },
};

const courseNameOverrides = new Map([
  ["55023", "AI 프로그래밍 및 데이터 활용"],
  ["71321", "글로벌스포츠영어&커뮤니케이션"],
  ["90573", "컴퓨터프로그래밍과실무적문제해결"],
  ["52672", "선박전기전자시스템및승선실습"],
  ["55158", "반도체 장비 보드 설계 및 검증"],
  ["55149", "친환경해양시스템및선박의이해"],
  ["55183", "에너지자원 Project Financing"],
  ["55169", "HDL를 이용한 디지털순차회로 설계"],
  ["52320", "환경공학자를위한캡스톤디자인"],
  ["53102", "환경공학자를위한캡스톤디자인Ⅱ"],
]);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function parseRows(pageTexts, [label, startPage, endPage, pageScoped = false]) {
  const prefix = pageScoped ? "(?:.*?\\s+)?" : `${escapeRegExp(label)}\\s+`;
  const pattern = new RegExp(
    `^\\s*${prefix}(전공기초|전공필수|전공선택)\\s+([A-Z0-9]+)\\s+([1-4])\\s+(1학기|2학기)\\s*(.*?)\\s+(\\d+(?:\\.\\d+)?)\\/\\s*(\\d+(?:\\.\\d+)?)\\/\\s*(\\d+(?:\\.\\d+)?)`,
  );
  const rows = [];
  for (let page = startPage; page <= endPage; page += 1) {
    for (const line of pageTexts[page - 1].split(/\r?\n/)) {
      const match = line.match(pattern);
      if (!match) continue;
      const [, rawCategory, code, yearText, semesterText, extractedName, creditsText] = match;
      const name = normalizeName(extractedName) || courseNameOverrides.get(code);
      if (!name) throw new Error(`${label} ${code}: PDF 줄바꿈 과목명 보정값이 없습니다.`);
      rows.push({
        code,
        name,
        category: categoryMap[rawCategory],
        credits: Number(creditsText),
        required: rawCategory === "전공필수",
        recommendedYear: Number(yearText),
        recommendedSemester: Number(semesterText[0]),
        page,
      });
    }
  }
  if (!rows.length) throw new Error(`${label} ${startPage}-${endPage}쪽: 과목 행을 추출하지 못했습니다.`);
  return rows;
}

function deduplicateRows(rows, key) {
  const byCode = new Map();
  for (const row of rows) {
    if (row.credits <= 0) continue;
    const previous = byCode.get(row.code);
    if (!previous) {
      byCode.set(row.code, { ...row, pages: [row.page] });
      continue;
    }
    if (previous.name !== row.name || previous.category !== row.category || previous.credits !== row.credits) {
      throw new Error(`${key} ${row.code}: 중복 코드의 과목명·이수구분·학점이 다릅니다.`);
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

function makeSource(year, programId, displayName, curriculumCollegeName, pages) {
  const source = sourceByYear[year];
  return {
    id: `kmou-${year}-${programId}-university-major-curriculum-table`,
    documentId: `kmou-${year}-university-major-curriculum-table`,
    title: `${year}학년도 교육과정표 · ${displayName}`,
    organization: "국립한국해양대학교 학사과",
    updatedAt: source.updatedAt,
    url: source.attachmentUrl,
    fileHash: `sha256:${source.hash}`,
    documentVersionId: `kmou-${year}-university-major-curriculum-table@${source.hash.slice(0, 12)}`,
    role: "cohort-requirement",
    documentYear: year,
    appliesToAdmissionYears: [year],
    appliesToDepartmentIds: [programId],
    documentScope: "program-row",
    evidenceScope: {
      departmentId: programId,
      departmentName: displayName,
      locator: `첨부 PDF ${compactPages(pages)} · ${curriculumCollegeName} · 전공기초·전공필수·전공선택 행`,
      page: Math.min(...pages),
    },
  };
}

for (const year of Object.keys(sourceByYear).map(Number)) {
  const source = sourceByYear[year];
  const pdfPath = resolve(ROOT, `data/sources/kmou/${year}/${year}_university_curriculum_table.pdf`);
  const textPath = resolve(ROOT, `data/extracted/kmou/${year}/${year}_university_curriculum_table.txt`);
  const outputPath = resolve(ROOT, `data/course-catalogs/kmou/${year}/official-university-catalogs/1.0.0.json`);
  const readinessPath = resolve(ROOT, `data/rule-candidates/kmou/major-curriculum-readiness-${year}.json`);
  const sourceBytes = await readFile(pdfPath);
  const actualHash = createHash("sha256").update(sourceBytes).digest("hex");
  if (actualHash !== source.hash) throw new Error(`${year}: 공식 PDF SHA-256 불일치: ${actualHash}`);
  const pageTexts = (await readFile(textPath, "utf8")).split("\f");
  const offerings = new Map(KMOU_PROGRAM_OFFERINGS
    .filter((offering) => offering.admissionYear === year)
    .map((offering) => [offering.programId, offering]));
  const labels = labelSets[year];

  const catalogs = commonProgramDefinitions.map((definition) => {
    const offering = offerings.get(definition.programId);
    if (!offering) throw new Error(`${year} ${definition.programId}: 편제학점 행이 없습니다.`);
    const labelKeys = definition.labelKeys ?? [definition.labelKey];
    const rows = deduplicateRows(
      labelKeys.flatMap((key) => parseRows(pageTexts, labels[key])),
      `${year} ${definition.programId}`,
    );
    const foundationCredits = sumCredits(rows, "majorFoundation");
    const requiredCredits = sumCredits(rows, "majorRequired");
    const expectedFoundation = offering.creditSummary.majorFoundation;
    const expectedRequired = offering.creditSummary.minimumMajorRequired + offering.creditSummary.advancedMajorRequired;
    if (foundationCredits < expectedFoundation) {
      throw new Error(`${year} ${definition.programId}: 전공기초 과목 풀 ${foundationCredits} < 편제 ${expectedFoundation}`);
    }
    const reviewedRequiredCreditMismatch = year === 2020
      && reviewedRequiredCreditMismatches2020.has(definition.programId)
      && requiredCredits !== expectedRequired;
    if (requiredCredits !== expectedRequired && !reviewedRequiredCreditMismatch) {
      throw new Error(`${year} ${definition.programId}: 전공필수 과목 합계 ${requiredCredits} != 편제 ${expectedRequired}`);
    }
    if (reviewedRequiredCreditMismatch) {
      console.warn(`${year} ${definition.programId}: 전공필수 과목 합계 ${requiredCredits} != 편제 ${expectedRequired}`);
    }
    const foundationSetResolved = foundationCredits === expectedFoundation && !definition.selectiveFoundationPool;
    if (foundationSetResolved) {
      for (const row of rows) if (row.category === "majorFoundation") row.required = true;
    }
    const pages = rows.flatMap((row) => row.pages);
    const catalogSource = makeSource(year, definition.programId, offering.displayName, offering.curriculumCollegeName, pages);
    return {
      id: `kmou-${year}-${definition.programId}-major-catalog`,
      version: "1.0.0",
      status: "verified",
      sourceId: catalogSource.id,
      sourceIds: [catalogSource.id],
      matchPolicy: "exact-course-code",
      role: "cohort-catalog",
      activation: {
        minimumTranscriptMatches: 5,
        minimumMatchedCredits: 12,
        minimumCategoryAgreementRatio: 0,
      },
      requiredCourseSetStatus: "review",
      ...(!foundationSetResolved ? {
        categoryRequirementModes: { majorFoundation: "minimum-from-pool" },
      } : {}),
      requiredCourseSetNote: reviewedRequiredCreditMismatch
        ? `학사과 ${year}학년도 교육과정표의 전공필수 표시 합계는 ${requiredCredits}학점이고 편제표 요구는 ${expectedRequired}학점으로 ${expectedRequired - requiredCredits}학점 차이가 있습니다. 학과별 추가 필수선택·대체 규칙을 확보하기 전까지 개별 미이수 과목은 확인 필요로 유지합니다.`
        : `학사과 ${year}학년도 교육과정표의 전공기초 ${foundationCredits}학점 과목 풀과 전공필수 ${requiredCredits}학점을 편제학점과 대조했습니다. 학과별 대체·별도 필수이수 전공선택은 추가 공식자료 검수 전까지 확인 필요로 유지합니다.`,
      sources: [catalogSource],
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

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify({
    schemaVersion: 1,
    generatedFrom: `data/extracted/kmou/${year}/${year}_university_curriculum_table.txt`,
    sourceSha256: source.hash,
    catalogs,
  }, null, 2)}\n`);
  await writeFile(readinessPath, `${JSON.stringify({
    schemaVersion: 1,
    generatedAt: "2026-08-15T18:30:00+09:00",
    universityId: "kmou",
    admissionYear: year,
    collegeId: "ocean-science-technology-convergence",
    promotionPolicy: {
      matchPolicy: "exact-course-code",
      requiredSourceFields: ["official-url", "local-sha256", "admission-year", "program-id", "source-locator"],
      requiredCourseFields: ["course-code", "course-name", "course-category", "course-credits"],
      exactCatalogAdditionalChecks: [
        "four-year-course-table",
        "required-credit-reconciliation",
        "duplicate-course-code-check",
        "substitution-rules-reviewed-separately",
      ],
      failClosed: true,
    },
    records: catalogs.map((catalog) => ({
      programId: catalog.sources[0].appliesToDepartmentIds[0],
      status: "exact-catalog",
      courseCount: catalog.entries.length,
      requiredCourseSetStatus: catalog.requiredCourseSetStatus,
    })),
    reviewNotes: [
      `${year}학번 22개 전공은 학사과 공식 교육과정표의 과목번호·이수구분·학점과 로컬 SHA-256을 연결했습니다.`,
      ...(year === 2020 ? ["2020학년도 당시 해양과학기술대학·공과대학 구분과 각 전공의 PDF 쪽 범위를 함께 고정했습니다."] : []),
      "전공기초 과목 풀이 편제 요구학점보다 큰 경우 개별 미이수 확정 대신 영역 부족학점으로 표시합니다.",
      "학과별 대체과목과 별도 필수이수 전공선택은 추가 공식자료 검수 전까지 확인 필요로 유지합니다.",
    ],
  }, null, 2)}\n`);

  console.log(`\n${year}학년도 ${catalogs.length}개 전공`);
  for (const catalog of catalogs) {
    const foundation = sumCredits(catalog.entries, "majorFoundation");
    const required = sumCredits(catalog.entries, "majorRequired");
    const programId = catalog.sources[0].appliesToDepartmentIds[0];
    console.log(`${programId}\t${catalog.entries.length}\t전공기초 ${foundation}\t전공필수 ${required}`);
  }
}
