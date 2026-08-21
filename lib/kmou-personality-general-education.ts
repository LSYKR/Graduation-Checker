import type {
  GeneralEducationAreaRequirement,
  GeneralEducationCourseRef,
} from "./rule-model";
import type { OfficialSource, RuleKey } from "./types";
import type { KmouProgramId } from "./kmou-program-catalog";

interface PersonalityYearDefinition {
  anchor: GeneralEducationCourseRef;
  electives: GeneralEducationCourseRef[];
  optionalPrograms: ReadonlySet<KmouProgramId>;
  requirementSource: OfficialSource;
  requirementSheet?: string;
}

export interface KmouPersonalityGeneralEducationPack {
  areas: GeneralEducationAreaRequirement[];
  sources: OfficialSource[];
  knownNonTargetCourseCodes: string[];
  note: string;
}

const optionalPrograms2020 = new Set<KmouProgramId>([
  "marine-biotechnology",
  "fisheries-bioscience",
  "marine-sports-science",
  "mechanical-systems-engineering",
  "refrigeration-air-conditioning-engineering",
  "electrical-electronics-engineering",
  "electronic-communications-engineering",
  "nano-semiconductor-engineering",
  "data-science",
  "logistics-systems-engineering",
  "environmental-engineering",
  "civil-engineering",
]);

const optionalPrograms2021To2024 = new Set<KmouProgramId>([
  "ocean-environment-science",
  "marine-biotechnology",
  "fisheries-bioscience",
  "marine-sports-science",
  "mechanical-systems-engineering",
  "refrigeration-air-conditioning-engineering",
  "electrical-electronics-engineering",
  "electronic-communications-engineering",
  "nano-semiconductor-engineering",
  "radio-mobility-convergence-engineering",
  "data-science",
  "logistics-systems-engineering",
  "environmental-engineering",
  "civil-engineering",
]);

const sources = {
  oceanScience2020: {
    id: "kmou-2020-ocean-science-general-education-system",
    title: "2020학년도 해양과학기술대학 학부(과)별 교양교육이수체계",
    organization: "국립한국해양대학교 교양교육원",
    updatedAt: "2020. 2. 27.",
    url: "https://www.kmou.ac.kr/common/nttFileDownload.do?fileKey=d8662cc93d0719ba29b6813a99c1d75d",
    fileHash: "42f2313be875f52ae7cc8581e2e7e2635a3ca8881516470edfa1fe5a2629374c",
    documentVersionId: "kmou-2020-ocean-science-general-education-system@42f2313be875",
  },
  engineering2020: {
    id: "kmou-2020-engineering-general-education-system",
    title: "2020학년도 공과대학 학부(과)별 교양교육이수체계",
    organization: "국립한국해양대학교 교양교육원",
    updatedAt: "2020. 2. 27.",
    url: "https://www.kmou.ac.kr/common/nttFileDownload.do?fileKey=30bd9392241ee3bfb969cbc3f355eb98",
    fileHash: "46b9a1471858bfbb1d58ea597406b24134f39b71bc240a87475a388e0c6e9079",
    documentVersionId: "kmou-2020-engineering-general-education-system@46b9a1471858",
  },
  convergence2021: {
    id: "kmou-2021-convergence-general-education-system",
    title: "2021학년도 해양과학기술융합대학 학부(과)별 교양교육이수체계",
    organization: "국립한국해양대학교 교양교육원",
    updatedAt: "2021. 2. 24.",
    url: "https://www.kmou.ac.kr/common/nttFileDownload.do?fileKey=541da33f864139115f3c332cd337c3ed",
    fileHash: "889529cb7ee8939e47d955ec3b310d356c43f54251e037eaeef37f4ee508c775",
    documentVersionId: "kmou-2021-convergence-general-education-system@889529cb7ee8",
  },
  catalog2022: {
    id: "kmou-2022-general-education-course-catalog",
    title: "2022학년도 교양교육과정표와 학부(과)별 교양교육이수체계",
    organization: "국립한국해양대학교 교양교육원",
    updatedAt: "2022학년도",
    url: "https://www.kmou.ac.kr/common/nttFileDownload.do?fileKey=e7d75658e9d5c39f2a732369e3c8a447",
    fileHash: "3629aefd5e5be0c8053d82121bd4799c273b719b613420b704f7b136aa7a9de3",
    documentVersionId: "kmou-2022-general-education-course-catalog@3629aefd5e5b",
  },
  system2023: {
    id: "kmou-2023-general-education-system",
    title: "2023학년도 학부(과)별 교양교육이수체계",
    organization: "국립한국해양대학교 교양교육원",
    updatedAt: "2023. 2. 14.",
    url: "https://www.kmou.ac.kr/common/nttFileDownload.do?fileKey=b961249f4526a05f3bae523cf17ce8e0",
    fileHash: "f2c20bc4875403346bef188965fdf344021484b929f72d254f58b636e0739ac8",
    documentVersionId: "kmou-2023-general-education-system@f2c20bc48754",
  },
  catalog2024: {
    id: "kmou-2024-general-education-course-catalog",
    title: "2024학년도 교양교육과정표와 학부(과)별 교양교육이수체계",
    organization: "국립한국해양대학교 교양교육원",
    updatedAt: "2024학년도",
    url: "https://www.kmou.ac.kr/common/nttFileDownload.do?fileKey=1ca877580e768174698feb26fb6badd9",
    fileHash: "85b56a3ccdbaa41bda0cc8437da4d4c85d7a7794b4f72e34bd4a74a18a7f8635",
    documentVersionId: "kmou-2024-general-education-course-catalog@85b56a3ccdba",
  },
} satisfies Record<string, OfficialSource>;

const course = (
  code: string,
  name: string,
  credits: number,
  courseType: GeneralEducationCourseRef["courseType"] = "elective",
): GeneralEducationCourseRef => ({ code, name, credits, courseType });

const definitions = new Map<number, PersonalityYearDefinition>([
  [2020, {
    anchor: course("L4109", "앵커스피릿", 2, "required"),
    electives: [
      course("L3001", "윤리와 인간", 2),
      course("L3002", "공학윤리", 3),
      course("L3003", "정보와 윤리", 2),
      course("L4120", "인성과사회적가치", 2),
      course("L4104", "글로벌 리더십", 2),
      course("L4105", "인성과토론", 1),
      course("L4110", "사회봉사Ⅰ", 1),
      course("L4111", "사회봉사Ⅱ", 1),
      course("L4112", "자성(自省)창의", 2),
      course("L4113", "대학생을 위한 정신건강론", 2),
    ],
    optionalPrograms: optionalPrograms2020,
    requirementSource: sources.oceanScience2020,
    requirementSheet: "2020학년도 교양교육과정",
  }],
  [2021, {
    anchor: course("L4109", "앵커스피릿", 2, "required"),
    electives: [
      course("L3001", "윤리와 인간", 2),
      course("L3002", "공학윤리", 3),
      course("L3003", "정보와 윤리", 2),
      course("L4120", "인성과사회적가치", 2),
      course("L4104", "글로벌 리더십", 2),
      course("L4105", "인성과토론", 1),
      course("L4110", "사회봉사Ⅰ", 1),
      course("L4111", "사회봉사Ⅱ", 1),
      course("L4112", "자성(自省)창의", 2),
      course("L4121", "인성과선원인권", 2),
      course("L4122", "역사속의리더를만나다", 2),
    ],
    optionalPrograms: optionalPrograms2021To2024,
    requirementSource: sources.convergence2021,
    requirementSheet: "2021학년도 교양교육과정",
  }],
  [2022, {
    anchor: course("L4109", "앵커스피릿", 2, "required"),
    electives: [
      course("L3001", "윤리와인간", 2),
      course("L3003", "정보와윤리", 2),
      course("L4120", "인성과사회적가치", 2),
      course("L4104", "글로벌리더십", 2),
      course("L4105", "인성과토론", 1),
      course("L4110", "사회봉사Ⅰ", 1),
      course("L4111", "사회봉사Ⅱ", 1),
      course("L4121", "인성과선원인권", 2),
      course("L4122", "역사속의리더를만나다", 2),
      course("L4114", "세계시민으로서의나", 2),
    ],
    optionalPrograms: optionalPrograms2021To2024,
    requirementSource: sources.catalog2022,
  }],
  [2023, {
    anchor: course("L4115", "앵커스피릿과기업가정신", 1, "required"),
    electives: [
      course("L3001", "윤리와인간", 2),
      course("L3003", "정보와윤리", 2),
      course("L4120", "인성과사회적가치", 2),
      course("L4104", "글로벌리더십", 2),
      course("L4110", "사회봉사Ⅰ", 1),
      course("L4111", "사회봉사Ⅱ", 1),
      course("L4121", "인성과선원인권", 2),
      course("L4122", "역사속의리더를만나다", 2),
      course("L4114", "세계시민으로서의나", 2),
      course("L4125", "성인지감수성의이해", 3),
    ],
    optionalPrograms: optionalPrograms2021To2024,
    requirementSource: sources.system2023,
  }],
  [2024, {
    anchor: course("L4115", "앵커스피릿과기업가정신", 1, "required"),
    electives: [
      course("L3001", "윤리와인간", 2),
      course("L3003", "정보와윤리", 2),
      course("L4120", "인성과사회적가치", 2),
      course("L4104", "글로벌리더십", 2),
      course("L4110", "사회봉사Ⅰ", 1),
      course("L4111", "사회봉사Ⅱ", 1),
      course("L4121", "인성과선원인권", 2),
      course("L4122", "역사속의리더를만나다", 2),
      course("L4125", "성인지감수성의이해", 3),
      course("L4130", "고사성어로배우는인문학", 2),
      course("L4131", "인간관계심리와의사소통", 2),
      course("L4132", "에티켓과매너있는해대인", 2),
    ],
    optionalPrograms: optionalPrograms2021To2024,
    requirementSource: sources.catalog2024,
  }],
]);

const oceanScienceTechnology2020 = new Set<KmouProgramId>([
  "ship-ocean-systems-engineering",
  "ocean-engineering",
  "energy-resources-engineering",
  "marine-architecture-disaster-prevention",
  "marine-spatial-design",
  "ocean-environment-science",
  "marine-biotechnology",
  "fisheries-bioscience",
  "marine-sports-science",
]);

function requirementSourceFor(key: RuleKey, definition: PersonalityYearDefinition): OfficialSource {
  if (key.admissionYear !== 2020) return definition.requirementSource;
  return oceanScienceTechnology2020.has(key.departmentId as KmouProgramId)
    ? sources.oceanScience2020
    : sources.engineering2020;
}

function evidence(source: OfficialSource, definition: PersonalityYearDefinition, courseCatalogSourceId: string) {
  return {
    requirementSourceId: source.id,
    courseCatalogSourceId,
    sheet: definition.requirementSheet,
    matchPolicy: "exact-course-code" as const,
  };
}

export function getKmouPersonalityGeneralEducationPack(
  key: RuleKey,
  courseCatalogSourceId: string,
  scopedRequirementSource?: OfficialSource,
): KmouPersonalityGeneralEducationPack | null {
  if (key.universityId !== "kmou") return null;
  const definition = definitions.get(key.admissionYear);
  if (!definition) return null;
  const programId = key.departmentId as KmouProgramId;
  const source = scopedRequirementSource ?? requirementSourceFor(key, definition);
  const requiresElective = definition.optionalPrograms.has(programId);
  const areas: GeneralEducationAreaRequirement[] = [{
    id: "personality-required",
    label: "인성 필수(앵커스피릿)",
    parentArea: "인성교양",
    creditCategory: "generalRequired",
    minimumCredits: definition.anchor.credits,
    eligibleCourses: [definition.anchor],
    evidence: evidence(source, definition, courseCatalogSourceId),
  }];
  if (requiresElective) {
    areas.push({
      id: "personality-elective",
      label: "인성 선택(윤리 포함)",
      parentArea: "인성교양",
      creditCategory: "generalElective",
      minimumCredits: 2,
      eligibleCourses: definition.electives,
      evidence: evidence(source, definition, courseCatalogSourceId),
    });
  }
  return {
    areas,
    sources: [source],
    knownNonTargetCourseCodes: requiresElective ? [] : definition.electives.map((item) => item.code),
    note: requiresElective
      ? "공식 학과별 이수체계에 따라 앵커스피릿 필수와 인성 선택 2학점(윤리 교과 포함)을 각각 판정합니다."
      : "공식 학과별 이수체계에는 앵커스피릿 필수만 있으며 별도의 윤리 또는 인성 선택 최소학점은 없습니다.",
  };
}

export function getKmouPersonalityOptionalProgramIds(admissionYear: number): string[] {
  return [...(definitions.get(admissionYear)?.optionalPrograms ?? [])];
}
