import { getKmouProgramOffering, type KmouProgramId } from "./kmou-program-catalog";
import type { OfficialSource, RuleKey } from "./types";

interface GeneralEducationDocument {
  id: string;
  title: string;
  organization: string;
  updatedAt: string;
  url: string;
  fileHash: string;
}

export interface KmouGeneralEducationLocator {
  documentId: string;
  page?: number;
  sheet?: string;
  row?: number;
}

const documents: Record<string, GeneralEducationDocument> = {
  "kmou-2020-ocean-science-general-education-system": {
    id: "kmou-2020-ocean-science-general-education-system",
    title: "2020학년도 해양과학기술대학 학부(과)별 교양교육이수체계",
    organization: "국립한국해양대학교 교양교육원",
    updatedAt: "2020. 2. 27.",
    url: "https://www.kmou.ac.kr/common/nttFileDownload.do?fileKey=d8662cc93d0719ba29b6813a99c1d75d",
    fileHash: "42f2313be875f52ae7cc8581e2e7e2635a3ca8881516470edfa1fe5a2629374c",
  },
  "kmou-2020-engineering-general-education-system": {
    id: "kmou-2020-engineering-general-education-system",
    title: "2020학년도 공과대학 학부(과)별 교양교육이수체계",
    organization: "국립한국해양대학교 교양교육원",
    updatedAt: "2020. 2. 27.",
    url: "https://www.kmou.ac.kr/common/nttFileDownload.do?fileKey=30bd9392241ee3bfb969cbc3f355eb98",
    fileHash: "46b9a1471858bfbb1d58ea597406b24134f39b71bc240a87475a388e0c6e9079",
  },
  "kmou-2021-convergence-general-education-system": {
    id: "kmou-2021-convergence-general-education-system",
    title: "2021학년도 해양과학기술융합대학 학부(과)별 교양교육이수체계",
    organization: "국립한국해양대학교 교양교육원",
    updatedAt: "2021. 2. 24.",
    url: "https://www.kmou.ac.kr/common/nttFileDownload.do?fileKey=541da33f864139115f3c332cd337c3ed",
    fileHash: "889529cb7ee8939e47d955ec3b310d356c43f54251e037eaeef37f4ee508c775",
  },
  "kmou-2022-general-education-course-catalog": {
    id: "kmou-2022-general-education-course-catalog",
    title: "2022학년도 교양교육과정표와 학부(과)별 교양교육이수체계",
    organization: "국립한국해양대학교 교양교육원",
    updatedAt: "2022. 2. 3.",
    url: "https://www.kmou.ac.kr/common/nttFileDownload.do?fileKey=e7d75658e9d5c39f2a732369e3c8a447",
    fileHash: "3629aefd5e5be0c8053d82121bd4799c273b719b613420b704f7b136aa7a9de3",
  },
  "kmou-2023-general-education-system": {
    id: "kmou-2023-general-education-system",
    title: "2023학년도 학부(과)별 교양교육이수체계",
    organization: "국립한국해양대학교 교양교육원",
    updatedAt: "2023. 2. 14.",
    url: "https://www.kmou.ac.kr/common/nttFileDownload.do?fileKey=b961249f4526a05f3bae523cf17ce8e0",
    fileHash: "f2c20bc4875403346bef188965fdf344021484b929f72d254f58b636e0739ac8",
  },
  "kmou-2024-general-education-course-catalog": {
    id: "kmou-2024-general-education-course-catalog",
    title: "2024학년도 교양교육과정표와 학부(과)별 교양교육이수체계",
    organization: "국립한국해양대학교 교양교육원",
    updatedAt: "2024. 2. 8.",
    url: "https://www.kmou.ac.kr/common/nttFileDownload.do?fileKey=1ca877580e768174698feb26fb6badd9",
    fileHash: "85b56a3ccdbaa41bda0cc8437da4d4c85d7a7794b4f72e34bd4a74a18a7f8635",
  },
  "kmou-2025-general-education-system": {
    id: "kmou-2025-general-education-system",
    title: "2025학년도 학부(과)별 교양교육이수체계",
    organization: "국립한국해양대학교 교양교육원",
    updatedAt: "2025. 4. 14.",
    url: "https://www.kmou.ac.kr/common/nttFileDownload.do?fileKey=98b74edc2b85b4f5760b66891b9bbcb2",
    fileHash: "0f44e5df17d145107ad9d6f2708dc777f305ef9f9ebe4e17184f5fb985a4c4a8",
  },
  "kmou-2026-general-education-system": {
    id: "kmou-2026-general-education-system",
    title: "2026학년도 학부(과)별 교양교육이수체계",
    organization: "국립한국해양대학교 교양교육원",
    updatedAt: "2026. 2. 19.",
    url: "https://www.kmou.ac.kr/common/nttFileDownload.do?fileKey=c8836264ffb9d08411a145ad8295f35a",
    fileHash: "ab2e1a45c518d361442b0eaff4c95b187286af852d25a6a78cb64b0d73438516",
  },
};

const locator = (
  documentId: string,
  location: Omit<KmouGeneralEducationLocator, "documentId">,
): KmouGeneralEducationLocator => ({ documentId, ...location });

const locators: Record<number, Partial<Record<KmouProgramId, KmouGeneralEducationLocator>>> = {
  2020: {
    "ship-ocean-systems-engineering": locator("kmou-2020-ocean-science-general-education-system", { sheet: "2020학년도 교양교육과정", row: 3 }),
    "ocean-engineering": locator("kmou-2020-ocean-science-general-education-system", { sheet: "2020학년도 교양교육과정", row: 31 }),
    "energy-resources-engineering": locator("kmou-2020-ocean-science-general-education-system", { sheet: "2020학년도 교양교육과정", row: 60 }),
    "marine-architecture-disaster-prevention": locator("kmou-2020-ocean-science-general-education-system", { sheet: "2020학년도 교양교육과정", row: 92 }),
    "marine-spatial-design": locator("kmou-2020-ocean-science-general-education-system", { sheet: "2020학년도 교양교육과정", row: 92 }),
    "ocean-environment-science": locator("kmou-2020-ocean-science-general-education-system", { sheet: "2020학년도 교양교육과정", row: 120 }),
    "marine-biotechnology": locator("kmou-2020-ocean-science-general-education-system", { sheet: "2020학년도 교양교육과정", row: 149 }),
    "fisheries-bioscience": locator("kmou-2020-ocean-science-general-education-system", { sheet: "2020학년도 교양교육과정", row: 149 }),
    "marine-sports-science": locator("kmou-2020-ocean-science-general-education-system", { sheet: "2020학년도 교양교육과정", row: 176 }),
    "mechanical-systems-engineering": locator("kmou-2020-engineering-general-education-system", { sheet: "2020학년도 교양교육과정", row: 3 }),
    "refrigeration-air-conditioning-engineering": locator("kmou-2020-engineering-general-education-system", { sheet: "2020학년도 교양교육과정", row: 34 }),
    "marine-advanced-materials-engineering": locator("kmou-2020-engineering-general-education-system", { sheet: "2020학년도 교양교육과정", row: 66 }),
    "electrical-electronics-engineering": locator("kmou-2020-engineering-general-education-system", { sheet: "2020학년도 교양교육과정", row: 98 }),
    "electronic-communications-engineering": locator("kmou-2020-engineering-general-education-system", { sheet: "2020학년도 교양교육과정", row: 130 }),
    "nano-semiconductor-engineering": locator("kmou-2020-engineering-general-education-system", { sheet: "2020학년도 교양교육과정", row: 163 }),
    "intelligent-control-systems-engineering": locator("kmou-2020-engineering-general-education-system", { sheet: "2020학년도 교양교육과정", row: 195 }),
    "computer-engineering": locator("kmou-2020-engineering-general-education-system", { sheet: "2020학년도 교양교육과정", row: 195 }),
    "logistics-systems-engineering": locator("kmou-2020-engineering-general-education-system", { sheet: "2020학년도 교양교육과정", row: 226 }),
    "radio-mobility-convergence-engineering": locator("kmou-2020-engineering-general-education-system", { sheet: "2020학년도 교양교육과정", row: 255 }),
    "data-science": locator("kmou-2020-engineering-general-education-system", { sheet: "2020학년도 교양교육과정", row: 286 }),
    "environmental-engineering": locator("kmou-2020-engineering-general-education-system", { sheet: "2020학년도 교양교육과정", row: 315 }),
    "civil-engineering": locator("kmou-2020-engineering-general-education-system", { sheet: "2020학년도 교양교육과정", row: 348 }),
  },
  2021: {
    "ship-ocean-systems-engineering": locator("kmou-2021-convergence-general-education-system", { sheet: "2020학년도 교양교육과정", row: 1 }),
    "ocean-engineering": locator("kmou-2021-convergence-general-education-system", { sheet: "2020학년도 교양교육과정", row: 31 }),
    "energy-resources-engineering": locator("kmou-2021-convergence-general-education-system", { sheet: "2020학년도 교양교육과정", row: 62 }),
    "marine-architecture-disaster-prevention": locator("kmou-2021-convergence-general-education-system", { sheet: "2020학년도 교양교육과정", row: 95 }),
    "marine-spatial-design": locator("kmou-2021-convergence-general-education-system", { sheet: "2020학년도 교양교육과정", row: 95 }),
    "ocean-environment-science": locator("kmou-2021-convergence-general-education-system", { sheet: "2020학년도 교양교육과정", row: 124 }),
    "marine-biotechnology": locator("kmou-2021-convergence-general-education-system", { sheet: "2020학년도 교양교육과정", row: 157 }),
    "fisheries-bioscience": locator("kmou-2021-convergence-general-education-system", { sheet: "2020학년도 교양교육과정", row: 157 }),
    "marine-sports-science": locator("kmou-2021-convergence-general-education-system", { sheet: "2020학년도 교양교육과정", row: 190 }),
    "mechanical-systems-engineering": locator("kmou-2021-convergence-general-education-system", { sheet: "2020학년도 교양교육과정", row: 221 }),
    "refrigeration-air-conditioning-engineering": locator("kmou-2021-convergence-general-education-system", { sheet: "2020학년도 교양교육과정", row: 257 }),
    "marine-advanced-materials-engineering": locator("kmou-2021-convergence-general-education-system", { sheet: "2020학년도 교양교육과정", row: 293 }),
    "electrical-electronics-engineering": locator("kmou-2021-convergence-general-education-system", { sheet: "2020학년도 교양교육과정", row: 327 }),
    "electronic-communications-engineering": locator("kmou-2021-convergence-general-education-system", { sheet: "2020학년도 교양교육과정", row: 363 }),
    "nano-semiconductor-engineering": locator("kmou-2021-convergence-general-education-system", { sheet: "2020학년도 교양교육과정", row: 400 }),
    "radio-mobility-convergence-engineering": locator("kmou-2021-convergence-general-education-system", { sheet: "2020학년도 교양교육과정", row: 436 }),
    "data-science": locator("kmou-2021-convergence-general-education-system", { sheet: "2020학년도 교양교육과정", row: 471 }),
    "intelligent-control-systems-engineering": locator("kmou-2021-convergence-general-education-system", { sheet: "2020학년도 교양교육과정", row: 505 }),
    "computer-engineering": locator("kmou-2021-convergence-general-education-system", { sheet: "2020학년도 교양교육과정", row: 505 }),
    "logistics-systems-engineering": locator("kmou-2021-convergence-general-education-system", { sheet: "2020학년도 교양교육과정", row: 539 }),
    "environmental-engineering": locator("kmou-2021-convergence-general-education-system", { sheet: "2020학년도 교양교육과정", row: 572 }),
    "civil-engineering": locator("kmou-2021-convergence-general-education-system", { sheet: "2020학년도 교양교육과정", row: 609 }),
  },
  2022: {},
  2023: {},
  2024: {},
  2025: {},
  2026: {},
};

const pageOrder2022: Array<[KmouProgramId[], number]> = [
  [["ship-ocean-systems-engineering"], 11], [["ocean-engineering"], 12], [["energy-resources-engineering"], 13],
  [["marine-architecture-disaster-prevention", "marine-spatial-design"], 14], [["ocean-environment-science"], 15],
  [["marine-biotechnology", "fisheries-bioscience"], 16], [["marine-sports-science"], 17], [["mechanical-systems-engineering"], 18],
  [["refrigeration-air-conditioning-engineering"], 19], [["electrical-electronics-engineering"], 20],
  [["electronic-communications-engineering"], 21], [["nano-semiconductor-engineering"], 22],
  [["radio-mobility-convergence-engineering"], 23], [["data-science"], 24],
  [["intelligent-control-systems-engineering", "computer-engineering"], 25], [["logistics-systems-engineering"], 26],
  [["environmental-engineering"], 27], [["civil-engineering"], 28], [["marine-advanced-materials-engineering"], 29],
];

const pageOrder2023And2024: KmouProgramId[][] = [
  ["ship-ocean-systems-engineering"], ["ocean-engineering"], ["energy-resources-engineering"],
  ["marine-architecture-disaster-prevention", "marine-spatial-design"], ["ocean-environment-science"],
  ["marine-biotechnology", "fisheries-bioscience"], ["marine-sports-science"], ["mechanical-systems-engineering"],
  ["refrigeration-air-conditioning-engineering"], ["electrical-electronics-engineering"],
  ["electronic-communications-engineering"], ["nano-semiconductor-engineering"], ["radio-mobility-convergence-engineering"],
  ["data-science"], ["intelligent-control-systems-engineering", "computer-engineering"], ["logistics-systems-engineering"],
  ["environmental-engineering"], ["civil-engineering"], ["marine-advanced-materials-engineering"],
];

const pageOrder2025: KmouProgramId[][] = [
  ["ship-ocean-systems-engineering"], ["ocean-engineering"], ["energy-resources-engineering"], ["marine-architecture-engineering"],
  ["ocean-environment-science"], ["marine-biotechnology", "fisheries-bioscience"], ["marine-sports-science"],
  ["mechanical-systems-engineering"], ["refrigeration-air-conditioning-engineering"], ["electrical-electronics-engineering"],
  ["electronic-communications-engineering"], ["nano-semiconductor-engineering"], ["radio-mobility-convergence-engineering"],
  ["data-science"], ["intelligent-control-systems-engineering"], ["computer-engineering"], ["logistics-systems-engineering"],
  ["environmental-engineering"], ["civil-engineering"], ["marine-advanced-materials-engineering"],
];

const addPdfLocators = (year: number, documentId: string, firstPage: number, order: KmouProgramId[][]) => {
  order.forEach((programIds, index) => {
    for (const programId of programIds) locators[year][programId] = locator(documentId, { page: firstPage + index });
  });
};

for (const [programIds, page] of pageOrder2022) {
  for (const programId of programIds) locators[2022][programId] = locator("kmou-2022-general-education-course-catalog", { page });
}
addPdfLocators(2023, "kmou-2023-general-education-system", 9, pageOrder2023And2024);
addPdfLocators(2024, "kmou-2024-general-education-course-catalog", 16, pageOrder2023And2024);
addPdfLocators(2025, "kmou-2025-general-education-system", 9, pageOrder2025);
addPdfLocators(2026, "kmou-2026-general-education-system", 12, pageOrder2025.slice(0, 17));
locators[2026]["environmental-engineering"] = locator("kmou-2026-general-education-system", { page: 30 });
locators[2026]["civil-engineering"] = locator("kmou-2026-general-education-system", { page: 31 });
locators[2026]["marine-advanced-materials-engineering"] = locator("kmou-2026-general-education-system", { page: 32 });

export function getKmouGeneralEducationLocator(key: RuleKey): KmouGeneralEducationLocator | null {
  return locators[key.admissionYear]?.[key.departmentId as KmouProgramId] ?? null;
}

export function getKmouProgramGeneralEducationRequirementSource(key: RuleKey): OfficialSource | null {
  const offering = getKmouProgramOffering(key.admissionYear, key.departmentId);
  const evidence = getKmouGeneralEducationLocator(key);
  if (!offering || !evidence) return null;
  const document = documents[evidence.documentId];
  if (!document) return null;
  const locatorParts = [
    evidence.page ? `PDF ${evidence.page}쪽` : undefined,
    evidence.sheet ? `시트 ${evidence.sheet}` : undefined,
    evidence.row ? `${evidence.row}행부터` : undefined,
  ].filter(Boolean);
  return {
    id: `kmou-${key.admissionYear}-${key.departmentId}-general-education-requirement`,
    documentId: document.id,
    title: `${key.admissionYear}학년도 ${offering.displayName} 교양교육이수체계`,
    organization: document.organization,
    updatedAt: document.updatedAt,
    url: document.url,
    fileHash: document.fileHash,
    documentVersionId: `${document.id}@${document.fileHash.slice(0, 12)}`,
    role: "cohort-requirement",
    documentYear: key.admissionYear,
    appliesToAdmissionYears: [key.admissionYear],
    appliesToDepartmentIds: [key.departmentId],
    documentScope: "program-row",
    evidenceScope: {
      departmentId: key.departmentId,
      departmentName: offering.displayName,
      locator: locatorParts.join(" · "),
      page: evidence.page,
      sheet: evidence.sheet,
      row: evidence.row,
    },
  };
}

export const KMOU_GENERAL_EDUCATION_LOCATORS = locators;
