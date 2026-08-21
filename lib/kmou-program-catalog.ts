import type { CreditRequirement, GraduationRuleSet, OfficialSource } from "./types";
import { getMajorCurriculumReadiness } from "./major-curriculum-readiness";

export type KmouProgramId =
  | "ship-ocean-systems-engineering"
  | "ocean-engineering"
  | "energy-resources-engineering"
  | "marine-architecture-disaster-prevention"
  | "marine-spatial-design"
  | "marine-architecture-engineering"
  | "ocean-environment-science"
  | "marine-biotechnology"
  | "fisheries-bioscience"
  | "marine-sports-science"
  | "mechanical-systems-engineering"
  | "refrigeration-air-conditioning-engineering"
  | "marine-advanced-materials-engineering"
  | "electrical-electronics-engineering"
  | "electronic-communications-engineering"
  | "nano-semiconductor-engineering"
  | "radio-mobility-convergence-engineering"
  | "data-science"
  | "intelligent-control-systems-engineering"
  | "computer-engineering"
  | "logistics-systems-engineering"
  | "environmental-engineering"
  | "civil-engineering";

export type ExpansionBatch = "digital" | "ocean-development" | "ocean-science" | "infrastructure";

export interface KmouProgramDefinition {
  id: KmouProgramId;
  currentUnit: string;
  batch: ExpansionBatch;
  aliases: string[];
}

export interface KmouCreditSummary {
  generalElective: number;
  generalRequired: number;
  majorFoundation: number;
  minimumMajorElective: number;
  minimumMajorRequired: number;
  advancedMajorElective: number;
  advancedMajorRequired: number;
  freeElective: number;
  total: number;
}

export interface KmouProgramOffering {
  universityId: "kmou";
  collegeId: "ocean-science-technology-convergence";
  collegeName: "해양과학기술융합대학";
  admissionYear: number;
  programId: KmouProgramId;
  displayName: string;
  currentUnit: string;
  curriculumCollegeName: "해양과학기술대학" | "공과대학" | "해양과학기술융합대학";
  batch: ExpansionBatch;
  creditSummary: KmouCreditSummary;
  support: "credit-audit" | "partial-course-audit" | "detailed-provisional";
}

export const EXPANSION_BATCH_LABELS: Record<ExpansionBatch, string> = {
  digital: "1차 상세화 · 인공지능·전자전기정보",
  "ocean-development": "2차 상세화 · 조선·해양개발·건축·에너지",
  "ocean-science": "3차 상세화 · 해양과학·스포츠·신소재",
  infrastructure: "4차 상세화 · 기계·물류·환경·토목",
};

export const KMOU_PROGRAM_DEFINITIONS: KmouProgramDefinition[] = [
  { id: "ship-ocean-systems-engineering", currentUnit: "조선해양시스템공학부", batch: "ocean-development", aliases: ["조선해양시스템공학", "조선해양시스템공학전공"] },
  { id: "ocean-engineering", currentUnit: "해양공학과", batch: "ocean-development", aliases: ["해양공학", "해양공학전공"] },
  { id: "energy-resources-engineering", currentUnit: "에너지자원공학과", batch: "ocean-development", aliases: ["에너지자원공학", "에너지자원공학전공"] },
  { id: "marine-architecture-disaster-prevention", currentUnit: "해양건축공학과", batch: "ocean-development", aliases: ["해양공간건축학부 건축방재공학", "건축방재공학전공"] },
  { id: "marine-spatial-design", currentUnit: "해양건축공학과", batch: "ocean-development", aliases: ["해양공간건축학부 공간디자인", "공간디자인전공"] },
  { id: "marine-architecture-engineering", currentUnit: "해양건축공학과", batch: "ocean-development", aliases: ["해양건축공학"] },
  { id: "ocean-environment-science", currentUnit: "해양과학융합학부", batch: "ocean-science", aliases: ["해양환경학과", "해양환경학전공"] },
  { id: "marine-biotechnology", currentUnit: "해양과학융합학부", batch: "ocean-science", aliases: ["해양생물공학", "해양생물공학전공"] },
  { id: "fisheries-bioscience", currentUnit: "해양과학융합학부", batch: "ocean-science", aliases: ["수산바이오공학", "수산바이오공학전공"] },
  { id: "marine-sports-science", currentUnit: "해양스포츠과학과", batch: "ocean-science", aliases: ["해양체육학과", "해양스포츠과학"] },
  { id: "mechanical-systems-engineering", currentUnit: "기계공학부", batch: "infrastructure", aliases: ["기계시스템공학", "기계시스템공학전공"] },
  { id: "refrigeration-air-conditioning-engineering", currentUnit: "기계공학부", batch: "infrastructure", aliases: ["냉동공조에너지시스템공학", "냉동공조공학전공"] },
  { id: "marine-advanced-materials-engineering", currentUnit: "해양신소재융합공학과", batch: "ocean-science", aliases: ["해양신소재융합공학"] },
  { id: "electrical-electronics-engineering", currentUnit: "전자전기정보공학부", batch: "digital", aliases: ["전기전자공학", "전기전자공학전공"] },
  { id: "electronic-communications-engineering", currentUnit: "전자전기정보공학부", batch: "digital", aliases: ["전자통신공학", "전자통신공학전공", "전자정보통신공학전공"] },
  { id: "nano-semiconductor-engineering", currentUnit: "전자전기정보공학부", batch: "digital", aliases: ["전자소재공학", "나노반도체공학전공"] },
  { id: "radio-mobility-convergence-engineering", currentUnit: "전자전기정보공학부", batch: "digital", aliases: ["전파공학과", "전파융합공학전공", "전파모빌리티융합공학전공"] },
  { id: "data-science", currentUnit: "전자전기정보공학부", batch: "digital", aliases: ["데이터정보학과", "데이터사이언스전공"] },
  { id: "intelligent-control-systems-engineering", currentUnit: "인공지능공학부", batch: "digital", aliases: ["제어계측공학", "지능제어시스템공학전공", "자동제어공학과"] },
  { id: "computer-engineering", currentUnit: "인공지능공학부", batch: "digital", aliases: ["IT융합전공", "컴퓨터공학전공", "컴퓨터공학과"] },
  { id: "logistics-systems-engineering", currentUnit: "물류시스템공학과", batch: "infrastructure", aliases: ["물류시스템공학", "물류시스템공학전공"] },
  { id: "environmental-engineering", currentUnit: "환경공학과", batch: "infrastructure", aliases: ["환경공학", "환경공학전공"] },
  { id: "civil-engineering", currentUnit: "토목공학과", batch: "infrastructure", aliases: ["건설공학과", "건설공학전공", "토목공학"] },
];

const D = Object.fromEntries(KMOU_PROGRAM_DEFINITIONS.map((item) => [item.id, item])) as Record<KmouProgramId, KmouProgramDefinition>;
const oceanScienceTechnology2020 = new Set<KmouProgramId>([
  "ship-ocean-systems-engineering", "ocean-engineering", "energy-resources-engineering",
  "marine-architecture-disaster-prevention", "marine-spatial-design", "ocean-environment-science",
  "marine-biotechnology", "fisheries-bioscience", "marine-sports-science",
]);

const labels: Record<number, Partial<Record<KmouProgramId, string>>> = {
  2020: {
    "ship-ocean-systems-engineering": "조선해양시스템공학부",
    "ocean-engineering": "해양공학과",
    "energy-resources-engineering": "에너지자원공학과",
    "marine-architecture-disaster-prevention": "해양공간건축학부 · 건축방재공학",
    "marine-spatial-design": "해양공간건축학부 · 공간디자인",
    "ocean-environment-science": "해양환경학과",
    "marine-biotechnology": "해양생명과학부 · 해양생물공학",
    "fisheries-bioscience": "해양생명과학부 · 수산바이오공학",
    "marine-sports-science": "해양체육학과",
    "mechanical-systems-engineering": "기계공학부 · 기계시스템공학",
    "refrigeration-air-conditioning-engineering": "기계공학부 · 냉동공조에너지시스템공학",
    "marine-advanced-materials-engineering": "해양신소재융합공학과",
    "electrical-electronics-engineering": "전자전기정보공학부 · 전기전자공학",
    "electronic-communications-engineering": "전자전기정보공학부 · 전자통신공학",
    "nano-semiconductor-engineering": "전자전기정보공학부 · 전자소재공학",
    "radio-mobility-convergence-engineering": "전파공학과",
    "data-science": "데이터정보학과",
    "intelligent-control-systems-engineering": "제어자동화공학부 · 제어계측공학",
    "computer-engineering": "제어자동화공학부 · IT융합전공",
    "logistics-systems-engineering": "물류시스템공학과",
    "environmental-engineering": "환경공학과",
    "civil-engineering": "건설공학과",
  },
  2021: {
    "ship-ocean-systems-engineering": "조선·해양개발공학부 · 조선해양시스템공학",
    "ocean-engineering": "조선·해양개발공학부 · 해양공학",
    "energy-resources-engineering": "해양건축·에너지자원공학부 · 에너지자원공학",
    "marine-architecture-disaster-prevention": "해양건축·에너지자원공학부 · 건축방재공학",
    "marine-spatial-design": "해양건축·에너지자원공학부 · 공간디자인",
    "ocean-environment-science": "해양과학융합학부 · 해양환경학",
    "marine-biotechnology": "해양과학융합학부 · 해양생물공학",
    "fisheries-bioscience": "해양과학융합학부 · 수산바이오공학",
    "marine-sports-science": "해양스포츠과학과",
    "mechanical-systems-engineering": "기계공학부 · 기계시스템공학",
    "refrigeration-air-conditioning-engineering": "기계공학부 · 냉동공조공학",
    "marine-advanced-materials-engineering": "해양신소재융합공학과",
    "electrical-electronics-engineering": "전자전기정보공학부 · 전기전자공학",
    "electronic-communications-engineering": "전자전기정보공학부 · 전자통신공학",
    "nano-semiconductor-engineering": "전자전기정보공학부 · 전자소재공학",
    "radio-mobility-convergence-engineering": "전자전기정보공학부 · 전파융합공학",
    "data-science": "전자전기정보공학부 · 데이터사이언스",
    "intelligent-control-systems-engineering": "제어자동화공학부 · 제어계측공학",
    "computer-engineering": "제어자동화공학부 · IT융합전공",
    "logistics-systems-engineering": "물류·환경·도시인프라공학부 · 물류시스템공학",
    "environmental-engineering": "물류·환경·도시인프라공학부 · 환경공학",
    "civil-engineering": "물류·환경·도시인프라공학부 · 건설공학",
  },
};

labels[2022] = {
  ...labels[2021],
  "ship-ocean-systems-engineering": "조선·해양개발공학부 · 조선해양시스템공학전공",
  "ocean-engineering": "조선·해양개발공학부 · 해양공학전공",
  "energy-resources-engineering": "해양건축·에너지자원공학부 · 에너지자원공학전공",
  "marine-architecture-disaster-prevention": "해양건축·에너지자원공학부 · 건축방재공학전공",
  "marine-spatial-design": "해양건축·에너지자원공학부 · 공간디자인전공",
  "intelligent-control-systems-engineering": "인공지능공학부 · 지능제어시스템공학전공",
  "computer-engineering": "인공지능공학부 · IT융합전공(현 컴퓨터공학전공)",
};

const modernLabels: Partial<Record<KmouProgramId, string>> = {
  "ship-ocean-systems-engineering": "조선해양시스템공학부 · 조선해양시스템공학전공",
  "ocean-engineering": "해양공학과",
  "energy-resources-engineering": "에너지자원공학과",
  "marine-architecture-disaster-prevention": "해양공간건축학부 · 건축방재공학전공",
  "marine-spatial-design": "해양공간건축학부 · 공간디자인전공",
  "ocean-environment-science": "해양과학융합학부 · 해양환경학전공",
  "marine-biotechnology": "해양과학융합학부 · 해양생물공학전공",
  "fisheries-bioscience": "해양과학융합학부 · 수산바이오공학전공",
  "marine-sports-science": "해양스포츠과학과",
  "mechanical-systems-engineering": "기계공학부 · 기계시스템공학전공",
  "refrigeration-air-conditioning-engineering": "기계공학부 · 냉동공조공학전공",
  "marine-advanced-materials-engineering": "해양신소재융합공학과",
  "electrical-electronics-engineering": "전자전기정보공학부 · 전기전자공학전공",
  "electronic-communications-engineering": "전자전기정보공학부 · 전자정보통신공학전공",
  "nano-semiconductor-engineering": "전자전기정보공학부 · 나노반도체공학전공",
  "radio-mobility-convergence-engineering": "전자전기정보공학부 · 전파융합공학전공",
  "data-science": "전자전기정보공학부 · 데이터사이언스전공",
  "intelligent-control-systems-engineering": "인공지능공학부 · 지능제어시스템공학전공",
  "computer-engineering": "인공지능공학부 · 컴퓨터공학전공",
  "logistics-systems-engineering": "물류시스템공학과",
  "environmental-engineering": "환경공학과",
  "civil-engineering": "토목공학과",
};

labels[2023] = { ...modernLabels };
labels[2024] = { ...modernLabels };
labels[2025] = { ...modernLabels, "marine-architecture-engineering": "해양건축공학과", "marine-architecture-disaster-prevention": undefined, "marine-spatial-design": undefined, "radio-mobility-convergence-engineering": "전자전기정보공학부 · 전파모빌리티융합공학전공" };
labels[2026] = { ...labels[2025] };

type CreditTuple = [number, number, number, number, number, number, number, number, number];
const c = (value: CreditTuple): KmouCreditSummary => ({
  generalElective: value[0], generalRequired: value[1], majorFoundation: value[2],
  minimumMajorElective: value[3], minimumMajorRequired: value[4],
  advancedMajorElective: value[5], advancedMajorRequired: value[6],
  freeElective: value[7], total: value[8],
});

const credits: Record<number, Partial<Record<KmouProgramId, CreditTuple>>> = {
  2020: {
    "ship-ocean-systems-engineering": [15,22,15,0,45,30,0,13,140], "ocean-engineering": [15,24,11,0,42,36,0,12,140],
    "energy-resources-engineering": [13,29,8,0,42,7,21,20,140], "marine-architecture-disaster-prevention": [15,23,18,0,42,30,0,12,140], "marine-spatial-design": [15,23,18,0,42,30,0,12,140],
    "ocean-environment-science": [15,26,9,0,45,30,0,15,140], "marine-biotechnology": [15,20,9,0,44,21,0,21,130], "fisheries-bioscience": [15,20,9,0,44,21,0,21,130], "marine-sports-science": [21,11,9,10,34,35,0,10,130],
    "mechanical-systems-engineering": [17,20,12,0,52,21,0,18,140], "refrigeration-air-conditioning-engineering": [17,24,15,0,58,12,0,14,140], "marine-advanced-materials-engineering": [14,24,7,0,67,14,0,14,140],
    "electrical-electronics-engineering": [24,16,16,0,60,0,14,10,140], "electronic-communications-engineering": [16,27,12,0,67,9,0,9,140], "nano-semiconductor-engineering": [14,27,12,0,59,11,0,17,140], "radio-mobility-convergence-engineering": [17,24,15,0,84,0,0,0,140], "data-science": [17,21,23,0,46,24,0,9,140],
    "intelligent-control-systems-engineering": [16,23,15,0,72,0,0,14,140], "computer-engineering": [16,23,15,0,71,0,0,15,140], "logistics-systems-engineering": [17,21,14,0,42,21,2,13,130], "environmental-engineering": [17,27,25,5,37,18,0,11,140], "civil-engineering": [14,27,16,0,61,3,9,10,140],
  },
  2021: {
    "ship-ocean-systems-engineering": [17,23,12,0,45,30,0,13,140], "ocean-engineering": [17,25,8,0,42,36,0,12,140], "energy-resources-engineering": [17,27,20,0,42,13,6,15,140], "marine-architecture-disaster-prevention": [17,21,18,0,42,30,0,12,140], "marine-spatial-design": [17,21,18,0,42,30,0,12,140],
    "ocean-environment-science": [17,24,9,0,45,30,0,15,140], "marine-biotechnology": [17,21,9,0,44,21,0,18,130], "fisheries-bioscience": [17,21,9,0,44,21,0,18,130], "marine-sports-science": [21,11,9,10,34,35,0,10,130], "mechanical-systems-engineering": [17,27,9,0,51,22,0,14,140], "refrigeration-air-conditioning-engineering": [17,27,12,0,58,12,0,14,140],
    "marine-advanced-materials-engineering": [17,24,16,0,55,17,0,11,140], "electrical-electronics-engineering": [17,27,15,0,56,15,0,10,140], "electronic-communications-engineering": [17,30,12,0,58,9,6,8,140], "nano-semiconductor-engineering": [17,27,9,0,53,17,0,17,140], "radio-mobility-convergence-engineering": [17,27,18,9,60,4,0,5,140], "data-science": [17,24,20,0,46,24,0,9,140],
    "intelligent-control-systems-engineering": [17,26,12,0,61,11,0,13,140], "computer-engineering": [17,26,15,0,60,12,0,10,140], "logistics-systems-engineering": [17,21,14,0,42,21,2,13,130], "environmental-engineering": [17,30,22,5,37,18,0,11,140], "civil-engineering": [17,30,17,2,55,6,6,7,140],
  },
  2022: {
    "ship-ocean-systems-engineering": [17,23,12,0,45,30,0,13,140], "ocean-engineering": [17,25,8,0,42,36,0,12,140], "energy-resources-engineering": [17,27,20,0,42,13,6,15,140], "marine-architecture-disaster-prevention": [17,21,18,0,42,30,0,12,140], "marine-spatial-design": [17,21,18,0,42,30,0,12,140],
    "ocean-environment-science": [17,24,9,0,45,30,0,15,140], "marine-biotechnology": [19,21,9,0,44,21,0,16,130], "fisheries-bioscience": [19,21,9,0,44,21,0,16,130], "marine-sports-science": [23,11,9,10,34,35,0,8,130], "mechanical-systems-engineering": [17,27,9,0,51,22,0,14,140], "refrigeration-air-conditioning-engineering": [17,27,12,0,58,12,0,14,140],
    "marine-advanced-materials-engineering": [17,24,16,0,55,17,0,11,140], "electrical-electronics-engineering": [17,27,15,0,56,15,0,10,140], "electronic-communications-engineering": [17,27,12,0,58,9,6,11,140], "nano-semiconductor-engineering": [17,27,9,0,56,14,0,17,140], "radio-mobility-convergence-engineering": [17,27,18,9,60,4,0,5,140], "data-science": [17,24,20,0,46,24,0,9,140],
    "intelligent-control-systems-engineering": [17,26,12,0,61,11,0,13,140], "computer-engineering": [17,26,15,0,60,12,0,10,140], "logistics-systems-engineering": [17,21,14,0,42,24,4,8,130], "environmental-engineering": [17,30,22,5,37,18,0,11,140], "civil-engineering": [17,30,17,0,55,8,6,7,140],
  },
  2023: {}, 2024: {}, 2025: {}, 2026: {},
};

credits[2023] = {
  ...credits[2022],
  "mechanical-systems-engineering": [17,26,13,0,44,29,0,11,140],
  "refrigeration-air-conditioning-engineering": [17,27,13,0,49,24,0,10,140],
};
credits[2024] = {
  ...credits[2023],
  "marine-biotechnology": [19,21,9,0,44,18,0,19,130],
  "electrical-electronics-engineering": [17,27,15,0,56,14,0,11,140],
};
credits[2025] = {
  ...credits[2024],
  "marine-architecture-disaster-prevention": undefined,
  "marine-spatial-design": undefined,
  "marine-architecture-engineering": [21,18,21,0,42,33,0,5,140],
  "marine-advanced-materials-engineering": [17,24,16,0,55,15,0,13,140],
  "electrical-electronics-engineering": [15,27,15,0,56,14,0,13,140],
  "electronic-communications-engineering": [15,27,12,0,58,9,6,13,140],
  "nano-semiconductor-engineering": [15,27,9,0,56,14,0,19,140],
  "data-science": [17,24,18,0,46,24,0,11,140],
  "intelligent-control-systems-engineering": [17,26,12,0,46,15,0,24,140],
  "computer-engineering": [17,26,15,0,43,15,0,24,140],
};
credits[2026] = {
  "ship-ocean-systems-engineering": [16,23,12,0,45,30,0,11,137], "ocean-engineering": [17,22,11,0,42,33,0,12,137], "energy-resources-engineering": [17,27,20,0,42,10,6,15,137], "marine-architecture-engineering": [21,18,21,0,42,33,0,2,137],
  "ocean-environment-science": [17,24,9,0,45,27,0,15,137], "marine-biotechnology": [19,21,9,0,41,18,0,17,125], "fisheries-bioscience": [19,21,9,0,35,21,0,16,121], "marine-sports-science": [23,11,10,10,34,35,0,7,130], "mechanical-systems-engineering": [15,26,12,0,44,29,0,11,137], "refrigeration-air-conditioning-engineering": [15,27,12,0,46,27,0,10,137],
  "marine-advanced-materials-engineering": [12,24,16,0,48,15,0,22,137], "electrical-electronics-engineering": [11,24,15,0,47,14,0,26,137], "electronic-communications-engineering": [7,27,12,0,47,9,0,35,137], "nano-semiconductor-engineering": [7,27,9,0,45,15,0,27,130], "radio-mobility-convergence-engineering": [7,27,18,0,48,15,0,22,137], "data-science": [14,24,18,0,46,24,0,11,137],
  "intelligent-control-systems-engineering": [15,26,12,0,46,15,0,21,135], "computer-engineering": [15,26,12,0,43,15,0,24,135], "logistics-systems-engineering": [12,21,14,0,42,24,4,13,130], "environmental-engineering": [17,30,22,0,37,18,0,11,135], "civil-engineering": [4,30,17,0,47,22,0,17,137],
};

export const KMOU_PROGRAM_OFFERINGS: KmouProgramOffering[] = Object.entries(credits).flatMap(([yearText, rows]) => {
  const admissionYear = Number(yearText);
  return Object.entries(rows).flatMap(([programId, tuple]) => {
    if (!tuple) return [];
    const id = programId as KmouProgramId;
    const displayName = labels[admissionYear]?.[id];
    if (!displayName) throw new Error(`${admissionYear} ${id} 학과 표시명이 없습니다.`);
    const creditSummary = c(tuple);
    const sum = Object.entries(creditSummary).filter(([key]) => key !== "total").reduce((total, [, value]) => total + value, 0);
    if (sum !== creditSummary.total) throw new Error(`${admissionYear} ${id} 편제학점 합계(${sum})가 졸업학점(${creditSummary.total})과 다릅니다.`);
    return [{
      universityId: "kmou" as const,
      collegeId: "ocean-science-technology-convergence" as const,
      collegeName: "해양과학기술융합대학" as const,
      admissionYear,
      programId: id,
      displayName,
      currentUnit: D[id].currentUnit,
      curriculumCollegeName: admissionYear === 2020
        ? oceanScienceTechnology2020.has(id) ? "해양과학기술대학" as const : "공과대학" as const
        : "해양과학기술융합대학" as const,
      batch: D[id].batch,
      creditSummary,
      support: getMajorCurriculumReadiness({ universityId: "kmou", admissionYear, departmentId: id })?.status === "exact-catalog"
        ? "detailed-provisional" as const
        : getMajorCurriculumReadiness({ universityId: "kmou", admissionYear, departmentId: id })?.status === "partial-required-courses"
          ? "partial-course-audit" as const
          : "credit-audit" as const,
    }];
  });
});

export const KMOU_CURRENT_UNIT_COUNT = new Set(KMOU_PROGRAM_DEFINITIONS.map((item) => item.currentUnit)).size;

export function getKmouProgramOffering(admissionYear: number, programId: string): KmouProgramOffering | null {
  return KMOU_PROGRAM_OFFERINGS.find((item) => item.admissionYear === admissionYear && item.programId === programId) ?? null;
}

export function getKmouProgramOptions(admissionYear: number): KmouProgramOffering[] {
  return KMOU_PROGRAM_OFFERINGS
    .filter((item) => item.admissionYear === admissionYear)
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "ko"));
}

export function normalizeKmouProgramSearchText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export function getKmouProgramSearchAliases(offering: KmouProgramOffering): string[] {
  const definition = D[offering.programId];
  return [...new Set([
    offering.displayName,
    offering.currentUnit,
    ...definition.aliases,
  ])];
}

export function searchKmouProgramOptions(admissionYear: number, query: string): KmouProgramOffering[] {
  const options = getKmouProgramOptions(admissionYear);
  const normalizedQuery = normalizeKmouProgramSearchText(query);
  if (!normalizedQuery) return options;

  return options
    .map((offering) => {
      const normalizedTerms = getKmouProgramSearchAliases(offering).map(normalizeKmouProgramSearchText);
      const score = normalizedTerms.reduce((best, term) => {
        if (term === normalizedQuery) return Math.min(best, 0);
        if (term.startsWith(normalizedQuery)) return Math.min(best, 1);
        if (term.includes(normalizedQuery)) return Math.min(best, 2);
        return best;
      }, Number.POSITIVE_INFINITY);
      return { offering, score };
    })
    .filter((item) => Number.isFinite(item.score))
    .sort((a, b) => a.score - b.score || a.offering.displayName.localeCompare(b.offering.displayName, "ko"))
    .map((item) => item.offering);
}

function cohortRequirementSource(admissionYear: number, source: Omit<OfficialSource, "role" | "documentYear" | "appliesToAdmissionYears">): OfficialSource {
  return {
    ...source,
    role: "cohort-requirement",
    documentYear: admissionYear,
    appliesToAdmissionYears: [admissionYear],
  };
}

const sourceByYear: Record<number, OfficialSource> = {
  2020: cohortRequirementSource(2020, { id: "kmou-2020-new-student-course-guide", title: "2020학년도 신입생 수강신청 안내·교육과정표", organization: "한국해양대학교 학사과", updatedAt: "2020학년도", url: "https://www.kmou.ac.kr/common/nttFileDownload.do?fileKey=9b5e938459ad09469c0374c10e64073e", fileHash: "d0a90f8423c37c78bf2fe2867c87d1f115d0f0817534a31882a658c7adb1101a" }),
  2021: cohortRequirementSource(2021, { id: "kmou-2021-new-student-course-guide", title: "2021학년도 신입생 수강신청 안내·교육과정표", organization: "한국해양대학교 학사과", updatedAt: "2021학년도", url: "https://www.kmou.ac.kr/common/nttFileDownload.do?fileKey=7d20bf835ce72b4f63b4a32b9eb6759b", fileHash: "e514659ddfcf7ee20a30be73380dc8f2baaf98de78b13f8a151ec31a03550198" }),
  2022: cohortRequirementSource(2022, { id: "kmou-2022-new-student-course-guide", title: "2022학년도 신입생 수강신청 안내·교육과정표", organization: "한국해양대학교 학사과", updatedAt: "2022학년도", url: "https://www.kmou.ac.kr/common/nttFileDownload.do?fileKey=ebc85967f5098b5feff20c2ecd4ed44b", fileHash: "630fa6597fe252dc0055d660210894574cd31e481f4bfb46fc829d59c7f14675" }),
  2023: cohortRequirementSource(2023, { id: "kmou-2023-new-student-course-guide", title: "2023학년도 신입생 수강신청 안내·교육과정표", organization: "한국해양대학교 학사과", updatedAt: "2023학년도", url: "https://www.kmou.ac.kr/common/nttFileDownload.do?fileKey=80836c0a2a4f096dbe3ed9619b91cde4", fileHash: "f3c4331f1ca45be1fd1235f3c5f910245fc27b4f37800eb6d28c6d0ba8544162" }),
  2024: cohortRequirementSource(2024, { id: "kmou-2024-new-student-course-guide", title: "2024학년도 신입생 수강신청 안내·교육과정표", organization: "한국해양대학교 학사과", updatedAt: "2024학년도", url: "https://www.kmou.ac.kr/common/nttFileDownload.do?fileKey=1965cd5d03af675c7de4384c73c8cd94", fileHash: "daf7798efa854eb0ea2eb9aeeef4cd4d51415aa3a818f406930f3310b2fb3fd9" }),
  2025: cohortRequirementSource(2025, { id: "kmou-2025-new-student-course-guide", title: "2025학년도 신입생 수강신청 안내·교육과정표", organization: "한국해양대학교 학사과", updatedAt: "2025학년도", url: "https://www.kmou.ac.kr/onestop/na/ntt/selectNttInfo.do?mi=2294&nttSn=10356319", fileHash: "f101b592be7fcfe07f3037b63809b37ffc1e507aa6cc4d7377f3ba3492420734" }),
  2026: cohortRequirementSource(2026, { id: "kmou-2026-new-student-course-guide", title: "2026학년도 신입생 수강신청 안내·교육과정표", organization: "한국해양대학교 학사과", updatedAt: "2026학년도", url: "https://www.kmou.ac.kr/onestop/na/ntt/selectNttInfo.do?nttSn=10370928", fileHash: "199de99df355d940b3f80d8e04e75389ad39c5d7afa5ac82bfe3cbbbc326ef91" }),
};

const environmentalEngineering2022CreditDocument = cohortRequirementSource(2022, {
  id: "kmou-2022-environmental-engineering-credit-table",
  title: "2022학년도 환경공학전공 신입생 적용 교육과정 편제학점표",
  organization: "국립한국해양대학교 환경공학과",
  updatedAt: "2022. 2. 3.",
  url: "https://www.kmou.ac.kr/ene/na/ntt/selectNttInfo.do?nttSn=10310535",
  fileHash: "4e8473cb9d86e9bde79dbd9804abef1c5c9baf3d5d192ccb40f38e996ebb457a",
  documentVersionId: "kmou-2022-environmental-engineering-credit-table@4e8473cb9d86",
});

function creditRequirementSourceFor(offering: KmouProgramOffering): OfficialSource {
  const document = offering.admissionYear === 2022 && offering.programId === "environmental-engineering"
    ? environmentalEngineering2022CreditDocument
    : sourceByYear[offering.admissionYear];
  const page = document.id === environmentalEngineering2022CreditDocument.id ? 1 : undefined;
  return {
    ...document,
    id: `kmou-${offering.admissionYear}-${offering.programId}-credit-requirement`,
    documentId: document.id,
    title: document.id === environmentalEngineering2022CreditDocument.id
      ? document.title
      : `${document.title} · ${offering.displayName} 행`,
    appliesToDepartmentIds: [offering.programId],
    documentScope: "program-row",
    evidenceScope: {
      departmentId: offering.programId,
      departmentName: offering.displayName,
      locator: `학부(과)별 졸업 이수학점표 · ${offering.displayName} 행`,
      page,
    },
  };
}

const academicOperationRegulationsSource: OfficialSource = {
  id: "kmou-academic-operation-regulations-article-33",
  title: "한국해양대학교 학사운영규정 제33조(일반선택 이수학점)",
  organization: "국립한국해양대학교",
  updatedAt: "2018. 8. 31. 개정본",
  url: "https://www.kmou.ac.kr/common/nttFileDownload.do?fileKey=75f02a57ceca00179704d88dcb70c106",
  fileHash: "8dd14af05a471532db8d4cdb9892decee219257c59daa55d570551258e765cfa",
  documentVersionId: "kmou-academic-operation-regulations@8dd14af05a47",
  role: "university-policy",
  appliesToAdmissionYears: [2020, 2021, 2022, 2023, 2024, 2025, 2026],
};

const colors = { generalRequired: "#00a58e", generalElective: "#6f7ef7", majorFoundation: "#cf7b35", majorRequired: "#173f63", majorElective: "#a45ec6", freeElective: "#718096" } as const;

function creditRequirements(summary: KmouCreditSummary): CreditRequirement[] {
  return [
    { key: "generalRequired", label: "교양필수", shortLabel: "교필", required: summary.generalRequired, color: colors.generalRequired },
    { key: "generalElective", label: "교양선택", shortLabel: "교선", required: summary.generalElective, color: colors.generalElective },
    { key: "majorFoundation", label: "전공기초", shortLabel: "전기", required: summary.majorFoundation, color: colors.majorFoundation },
    { key: "majorRequired", label: "전공필수", shortLabel: "전필", required: summary.minimumMajorRequired + summary.advancedMajorRequired, color: colors.majorRequired },
    { key: "majorElective", label: "전공선택", shortLabel: "전선", required: summary.minimumMajorElective + summary.advancedMajorElective, color: colors.majorElective },
    { key: "freeElective", label: "일반선택", shortLabel: "일선", required: summary.freeElective, color: colors.freeElective },
  ];
}

export function createKmouCreditAuditRule(offering: KmouProgramOffering): GraduationRuleSet {
  const creditSource = creditRequirementSourceFor(offering);
  return {
    schemaVersion: "1.0",
    version: `KMOU-${offering.admissionYear}-${offering.programId}-CREDIT-v0.23.0-alpha.1`,
    status: "provisional",
    key: { universityId: "kmou", admissionYear: offering.admissionYear, departmentId: offering.programId },
    profileLabel: `한국해양대학교 ${offering.admissionYear} 적용 교육과정 · ${offering.displayName}`,
    requiredTotal: offering.creditSummary.total,
    credits: creditRequirements(offering.creditSummary),
    requiredCourses: [],
    courseOverrides: [],
    substitutions: [],
    certifications: [],
    policies: [
      "학부(과)별 졸업 이수학점 표의 총학점과 영역별 기준학점을 적용합니다.",
      "최소전공과 심화전공의 같은 이수구분은 합산해 전공필수·전공선택 기준으로 표시합니다.",
      "선택 전공의 고유 과목명 지문이 충분히 일치할 때만 종합정보시스템의 전공기초·전공필수·전공선택 이수구분을 영역별 학점에 반영합니다.",
      "다른 전공 지문이 더 강하거나 선택 전공 지문이 부족하면 전공학점과 전체 졸업 준비도 퍼센트를 판정하지 않습니다.",
      "일반선택은 학사운영규정 제33조에 따라 교양·전공 최소기준을 먼저 충족하고 남은 초과학점을 잔여 일반선택에 반영합니다.",
      "학번별 상세 전공필수 교과목, 대체·폐지 과목과 졸업인증은 후속 검수 전까지 개별 충족 여부를 확정하지 않습니다.",
    ],
    sources: [creditSource, academicOperationRegulationsSource],
    evidence: [{ id: `ev-credit-${offering.admissionYear}-${offering.programId}`, sourceId: creditSource.id, title: "학부(과)별 졸업 이수학점", text: `${offering.displayName}의 해당 행에서 총 졸업학점과 교양·전공·일반선택 영역별 학점을 확인합니다.`, keywords: [offering.displayName, "졸업학점", "교양", "전공", "일반선택"] }],
    reviewedAt: "2026-08-08",
    assurance: {
      overall: "provisional",
      verifiedScopes: ["학년도별 학부(과)·전공 명칭", "총 졸업학점", "교양·전공·일반선택 영역별 편제학점", "일반선택 잔여학점 산정", "선택 전공 과목명 지문을 이용한 타 전공 오적용 차단"],
      provisionalScopes: ["전공 지문 일치 후 종합정보시스템 이수구분을 반영한 영역별 전공학점"],
      warning: "전공 지문이 충분히 일치할 때 영역별 전공학점을 표시합니다. 학번별 전공필수 전체 과목표가 검증되기 전에는 개별 전공필수 미이수 과목을 확정하지 않습니다.",
    },
  };
}

export const KMOU_CREDIT_AUDIT_RULES = KMOU_PROGRAM_OFFERINGS.map(createKmouCreditAuditRule);
