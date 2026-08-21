import kmou2020Candidate from "@/data/rule-candidates/kmou/2020/computer-engineering/curriculum/0.2.0.json";
import kmou2021Candidate from "@/data/rule-candidates/kmou/2021/computer-engineering/curriculum/0.2.0.json";
import kmou2022Candidate from "@/data/rule-candidates/kmou/2022/computer-engineering/curriculum/0.2.0.json";
import kmou2023Candidate from "@/data/rule-candidates/kmou/2023/computer-engineering/curriculum/0.2.0.json";
import kmou2024Candidate from "@/data/rule-candidates/kmou/2024/computer-engineering/curriculum/0.2.0.json";
import kmou2025Candidate from "@/data/rule-candidates/kmou/2025/computer-engineering/curriculum/0.2.0.json";
import kmou2026Candidate from "@/data/rule-candidates/kmou/2026/computer-engineering/curriculum/0.2.0.json";
import kmou2022RecognitionOverlay from "@/data/policy-overlays/kmou/general-education/2022/computer-engineering/1.0.0.json";
import catalogCodeIndex from "@/data/extracted/kmou/general-education-catalog-code-index-2020-2026.json";
import verification from "@/data/extracted/kmou/general-education-area-verification-2020-2026.json";
import { getKmouProgramOffering } from "./kmou-program-catalog";
import { getKmouProgramGeneralEducationRequirementSource } from "./kmou-general-education-sources";
import { getKmouPersonalityGeneralEducationPack } from "./kmou-personality-general-education";
import { withRequirementSourceApplicability } from "./source-applicability";
import type {
  GeneralEducationRecognitionOverlay,
  GraduationRuleSet as CurriculumRuleSet,
} from "./rule-model";
import type { OfficialSource, RuleKey } from "./types";

export interface VerifiedGeneralEducationPack {
  status: "verified-final";
  rule: CurriculumRuleSet;
  recognitionOverlay?: GeneralEducationRecognitionOverlay;
  verifiedNonTargetCourseCodes: string[];
  verifiedAt: string;
}

function assertRecognitionOverlay(
  rule: CurriculumRuleSet,
  overlay: GeneralEducationRecognitionOverlay,
): void {
  if (overlay.status !== "verified-final" || overlay.matchPolicy !== "exact-course-code-only") {
    throw new Error("검증 완료된 과목코드 정확 일치 오버레이만 운영에 사용할 수 있습니다.");
  }
  const selectorMatches = overlay.selector.universityId === rule.selector.universityId
    && overlay.selector.admissionYear === rule.selector.admissionYear
    && overlay.selector.departmentId === rule.selector.departmentId;
  if (!selectorMatches) throw new Error("교양 인정 오버레이의 대학·학번·학과 범위가 규칙과 다릅니다.");

  const areaIds = new Set(rule.generalEducationAreas.map((area) => area.id));
  const courseCodes = new Set<string>();
  for (const recognition of overlay.rules) {
    const code = recognition.courseCode.trim().toUpperCase();
    if (!code || courseCodes.has(code)) throw new Error(`교양 인정 오버레이 과목코드가 비어 있거나 중복되었습니다: ${code}`);
    if (!areaIds.has(recognition.targetAreaId)) throw new Error(`교양 인정 오버레이가 알 수 없는 영역을 참조합니다: ${recognition.targetAreaId}`);
    if (!recognition.acceptedTranscriptKinds.length) throw new Error(`${code} 인정 가능한 성적표 행 유형이 없습니다.`);
    courseCodes.add(code);
  }
}

const rulesByAdmissionYear = new Map<number, CurriculumRuleSet>([
  [2020, kmou2020Candidate as CurriculumRuleSet],
  [2021, kmou2021Candidate as CurriculumRuleSet],
  [2022, kmou2022Candidate as CurriculumRuleSet],
  [2023, kmou2023Candidate as CurriculumRuleSet],
  [2024, kmou2024Candidate as CurriculumRuleSet],
  [2025, kmou2025Candidate as CurriculumRuleSet],
  [2026, kmou2026Candidate as CurriculumRuleSet],
]);

const computerEngineering2022Overlay = kmou2022RecognitionOverlay as GeneralEducationRecognitionOverlay;

function scopeRuleToProgram(baseRule: CurriculumRuleSet, key: RuleKey): CurriculumRuleSet {
  if (baseRule.selector.universityId !== key.universityId || baseRule.selector.admissionYear !== key.admissionYear) {
    throw new Error("교양 공통 규칙의 학교·학번 범위가 요청 범위와 다릅니다.");
  }
  const offering = getKmouProgramOffering(key.admissionYear, key.departmentId);
  const requirementSource = getKmouProgramGeneralEducationRequirementSource(key);
  if (!offering || !requirementSource) throw new Error("선택 전공의 교양교육이수체계 근거 위치를 찾을 수 없습니다.");
  const courseCatalogSourceId = `kmou-${key.admissionYear}-general-education-course-catalog`;
  const rawCourseCatalogSource = baseRule.sources.find((source) => source.id === courseCatalogSourceId);
  if (!rawCourseCatalogSource) throw new Error("학년도별 교양교육과정표 원본을 찾을 수 없습니다.");
  const courseCatalogSource: OfficialSource = {
    ...withRequirementSourceApplicability(rawCourseCatalogSource, key.admissionYear),
    documentId: rawCourseCatalogSource.documentId ?? rawCourseCatalogSource.id,
    documentScope: "university-wide",
  };
  const scopedRule: CurriculumRuleSet = {
    ...baseRule,
    id: `kmou-${key.admissionYear}-${key.departmentId}-general-education`,
    selector: { ...baseRule.selector, departmentId: key.departmentId },
    generalEducationAreas: baseRule.generalEducationAreas.map((area) => ({
      ...area,
      evidence: {
        ...area.evidence,
        requirementSourceId: requirementSource.id,
        courseCatalogSourceId: courseCatalogSource.id,
        page: requirementSource.evidenceScope?.page,
        sheet: requirementSource.evidenceScope?.sheet,
      },
    })),
    generalEducationCombinedRequirements: baseRule.generalEducationCombinedRequirements.map((requirement) => ({
      ...requirement,
      evidence: {
        ...requirement.evidence,
        requirementSourceId: requirementSource.id,
        page: requirementSource.evidenceScope?.page,
        sheet: requirementSource.evidenceScope?.sheet,
      },
    })),
    sources: [requirementSource, courseCatalogSource],
    notes: [
      ...baseRule.notes,
      `${offering.displayName}의 학번별 교양교육이수체계 행·쪽을 선택해 세부영역 기준을 적용합니다.`,
      "학과별 이중설강·교차강의는 검증된 전공 전용 오버레이가 있을 때만 추가 인정합니다.",
    ],
  };
  const personality = getKmouPersonalityGeneralEducationPack(key, courseCatalogSource.id, requirementSource);
  if (!personality) return scopedRule;
  return {
    ...scopedRule,
    generalEducationAreas: [...scopedRule.generalEducationAreas, ...personality.areas],
    notes: [...scopedRule.notes, personality.note],
  };
}

function withRecognitionSource(
  rule: CurriculumRuleSet,
  overlay: GeneralEducationRecognitionOverlay,
  key: RuleKey,
): CurriculumRuleSet {
  const offering = getKmouProgramOffering(key.admissionYear, key.departmentId);
  if (!offering) return rule;
  const source: OfficialSource = {
    ...withRequirementSourceApplicability(overlay.source, key.admissionYear),
    documentId: overlay.source.documentId ?? overlay.source.id,
    appliesToDepartmentIds: [key.departmentId],
    documentScope: "department",
    evidenceScope: {
      departmentId: key.departmentId,
      departmentName: offering.displayName,
      locator: "전공별 교양 이중설강·교차강의 표",
      sheet: overlay.rules[0]?.evidence.sheet,
    },
  };
  return rule.sources.some((candidate) => candidate.id === source.id)
    ? rule
    : { ...rule, sources: [...rule.sources, source] };
}

function verifiedNonTargetCodes(admissionYear: number, rule: CurriculumRuleSet): string[] {
  const year = verification.years[String(admissionYear) as keyof typeof verification.years] as {
    verifiedNonTargetTranscriptCodes?: string[];
  } | undefined;
  const catalogYear = catalogCodeIndex.years[String(admissionYear) as keyof typeof catalogCodeIndex.years] as {
    courseCodes?: string[];
  } | undefined;
  const targetCodes = new Set(
    rule.generalEducationAreas.flatMap((area) => area.eligibleCourses.map((course) => course.code.trim().toUpperCase())),
  );
  return [
    ...new Set([
      ...(year?.verifiedNonTargetTranscriptCodes ?? []),
      ...(catalogYear?.courseCodes ?? []).filter((code) => !targetCodes.has(code.trim().toUpperCase())),
    ]),
  ];
}

export function getVerifiedGeneralEducationPack(key: RuleKey): VerifiedGeneralEducationPack | null {
  if (key.universityId !== "kmou" || !getKmouProgramOffering(key.admissionYear, key.departmentId)) return null;
  const baseRule = rulesByAdmissionYear.get(key.admissionYear);
  if (!baseRule) return null;

  let rule = scopeRuleToProgram(baseRule, key);
  const requirementSource = getKmouProgramGeneralEducationRequirementSource(key);
  const personality = getKmouPersonalityGeneralEducationPack(
    key,
    `kmou-${key.admissionYear}-general-education-course-catalog`,
    requirementSource ?? undefined,
  );
  const recognitionOverlay = key.admissionYear === 2022 && key.departmentId === "computer-engineering"
    ? computerEngineering2022Overlay
    : undefined;
  if (recognitionOverlay) {
    assertRecognitionOverlay(rule, recognitionOverlay);
    rule = withRecognitionSource(rule, recognitionOverlay, key);
  }

  return {
    status: "verified-final",
    rule,
    recognitionOverlay,
    verifiedNonTargetCourseCodes: [
      ...new Set([
        ...verifiedNonTargetCodes(key.admissionYear, rule),
        ...(personality?.knownNonTargetCourseCodes ?? []),
      ]),
    ],
    verifiedAt: verification.verifiedAt,
  };
}
