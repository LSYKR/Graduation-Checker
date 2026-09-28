import { makeCourseGuidance } from "./course-guidance";
import { demoAudit } from "./demo";
import majorEvidenceIndex from "../../../data/extracted/kmou/major-course-evidence-index-2020-2024.json";
import { evaluateGeneralEducation } from "./general-education-engine";
import { DEFAULT_PROFILE, DEFAULT_RULE, bundledRuleRegistry } from "../curriculum/rule-registry";
import { getVerifiedGeneralEducationPack } from "../curriculum/verified-general-education";
import { assertRequirementSourcesApplicable } from "../curriculum/source-applicability";
import {
  getKmouProgramIdentitySignature,
  measureKmouProgramIdentity,
} from "../curriculum/kmou-program-signatures";
import {
  detectKnownProgramMismatch,
  getCurrentMajorClassificationCatalog,
  getVerifiedMajorCourseCatalog,
  getVerifiedRequiredCourseOverlay,
} from "../curriculum/verified-major-curricula";
import type {
  CategoryKey,
  DetailedAudit,
  GraduationRuleSet,
  GeneralEducationAudit,
  MajorCourseCatalog,
  MajorCourseMatchAudit,
  MajorProgramEvidence,
  MissingCourse,
  PendingCourseRecognition,
  RequiredCourseAssessment,
  MajorCourseCategory,
  ProgramProfileMismatch,
  ReviewCause,
  ResidualCreditAudit,
  StudentProfile,
  TranscriptCourse,
} from "../../shared/types/graduation";

const MAJOR_CATEGORY_KEYS = new Set<CategoryKey>([
  "majorFoundation",
  "majorRequired",
  "majorElective",
]);

function isMajorCategory(category: CategoryKey): boolean {
  return MAJOR_CATEGORY_KEYS.has(category);
}

const RESIDUAL_SOURCE_KEYS: Array<Exclude<CategoryKey, "freeElective">> = ["generalRequired", "generalElective", "majorFoundation", "majorRequired", "majorElective"];

const CATEGORY_KEY_BY_LABEL = new Map<string, CategoryKey>([
  ["교양필수", "generalRequired"],
  ["교필", "generalRequired"],
  ["교양선택", "generalElective"],
  ["교선", "generalElective"],
  ["전공기초", "majorFoundation"],
  ["전기", "majorFoundation"],
  ["전공필수", "majorRequired"],
  ["전필", "majorRequired"],
  ["전공선택", "majorElective"],
  ["전선", "majorElective"],
  ["일반선택", "freeElective"],
  ["일선", "freeElective"],
]);

export interface GeneralEducationCreditShortageBreakdown {
  generalRequired: number;
  generalElective: number;
  unassigned: number;
  total: number;
}

export function calculateGeneralEducationCreditShortageBreakdown(
  audit: GeneralEducationAudit | undefined,
): GeneralEducationCreditShortageBreakdown | undefined {
  if (!audit?.conclusive) return undefined;
  const result: GeneralEducationCreditShortageBreakdown = {
    generalRequired: 0,
    generalElective: 0,
    unassigned: 0,
    total: 0,
  };
  const areaDeficits = new Map<string, number>();
  const areaCategories = new Map<string, "generalRequired" | "generalElective">();
  for (const area of audit.areas) {
    const deficit = Math.max(0, area.required - area.earned);
    const creditCategory = area.creditCategory
      ?? (area.id === "personality-required" ? "generalRequired" : "generalElective");
    areaDeficits.set(area.id, deficit);
    areaCategories.set(area.id, creditCategory);
    result[creditCategory] += deficit;
  }
  for (const combined of audit.combinedRequirements) {
    const combinedDeficit = Math.max(0, combined.required - combined.earned);
    const coveredByAreaDeficits = combined.areaIds.reduce((sum, areaId) => sum + (areaDeficits.get(areaId) ?? 0), 0);
    const additionalDeficit = Math.max(0, combinedDeficit - coveredByAreaDeficits);
    if (!additionalDeficit) continue;
    const categories = new Set(combined.areaIds.map((areaId) => areaCategories.get(areaId)).filter(Boolean));
    if (categories.size === 1) {
      const [category] = [...categories];
      if (category) result[category] += additionalDeficit;
    } else {
      result.unassigned += additionalDeficit;
    }
  }
  result.total = result.generalRequired + result.generalElective + result.unassigned;
  return result;
}

export function calculateGeneralEducationCreditShortage(audit: GeneralEducationAudit | undefined): number | undefined {
  return calculateGeneralEducationCreditShortageBreakdown(audit)?.total;
}

export function calculateMinimumGraduationCreditShortage(input: {
  categories: DetailedAudit["categories"];
  generalEducation?: GeneralEducationAudit;
  missingCourses: MissingCourse[];
  requiredTotal: number;
  applicableEarnedTotal: number;
}): number {
  const categoryDeficits = new Map<CategoryKey, number>(input.categories.map((category) => [
    category.key,
    category.evaluationStatus === "evaluated" ? Math.max(0, category.required - category.earned) : 0,
  ]));
  const missingCourseCredits = new Map<CategoryKey, number>();
  let unassignedMissingCourseCredits = 0;
  for (const course of input.missingCourses) {
    const key = CATEGORY_KEY_BY_LABEL.get(course.category.replace(/\s/g, ""));
    if (key) missingCourseCredits.set(key, (missingCourseCredits.get(key) ?? 0) + course.credits);
    else unassignedMissingCourseCredits += course.credits;
  }
  const generalEducation = calculateGeneralEducationCreditShortageBreakdown(input.generalEducation);
  const categoryMinimum = ([
    "generalRequired",
    "generalElective",
    "majorFoundation",
    "majorRequired",
    "majorElective",
    "freeElective",
  ] as CategoryKey[]).reduce((sum, key) => {
    const detailedGeneralEducationCredits = key === "generalRequired"
      ? generalEducation?.generalRequired ?? 0
      : key === "generalElective" ? generalEducation?.generalElective ?? 0 : 0;
    const categoryDeficit = key === "freeElective" ? 0 : categoryDeficits.get(key) ?? 0;
    return sum + Math.max(
      categoryDeficit,
      missingCourseCredits.get(key) ?? 0,
      detailedGeneralEducationCredits,
    );
  }, 0) + unassignedMissingCourseCredits + (generalEducation?.unassigned ?? 0);
  return Math.max(
    Math.max(0, input.requiredTotal - input.applicableEarnedTotal),
    categoryMinimum,
  );
}

export function applyResidualFreeElectivePolicy(
  categoryRows: DetailedAudit["categories"],
): { categories: DetailedAudit["categories"]; residualCredits?: ResidualCreditAudit } {
  const freeElective = categoryRows.find((category) => category.key === "freeElective");
  if (!freeElective) return { categories: categoryRows };
  const evaluatedSources = RESIDUAL_SOURCE_KEYS.flatMap((key) => {
    const category = categoryRows.find((item) => item.key === key);
    return category?.evaluationStatus === "evaluated" ? [category] : [];
  });
  const sources = evaluatedSources.flatMap((category) => category.earned > category.required
    ? [{ key: category.key as Exclude<CategoryKey, "freeElective">, label: category.label, earned: category.earned, required: category.required, surplusCredits: category.earned - category.required }]
    : []);
  const rawFreeElectiveCredits = freeElective.earned;
  const verifiedSurplusCredits = sources.reduce((sum, source) => sum + source.surplusCredits, 0);
  const transferredSurplusCredits = verifiedSurplusCredits;
  const appliedSurplusCredits = transferredSurplusCredits;
  const effectiveFreeElectiveCredits = rawFreeElectiveCredits + transferredSurplusCredits;
  const minimumAllocatedCredits = evaluatedSources.reduce((sum, category) => sum + Math.min(category.earned, category.required), 0);
  const reconciledKnownCredits = minimumAllocatedCredits + effectiveFreeElectiveCredits;
  const directlyKnownCredits = rawFreeElectiveCredits + evaluatedSources.reduce((sum, category) => sum + category.earned, 0);
  const balanced = Math.abs(reconciledKnownCredits - directlyKnownCredits) < 0.001;
  const hasUnknownSourceCategory = RESIDUAL_SOURCE_KEYS.some((key) => categoryRows.find((category) => category.key === key)?.evaluationStatus === "not-evaluable");
  const status = balanced && (effectiveFreeElectiveCredits >= freeElective.required || !hasUnknownSourceCategory) ? "evaluated" as const : "not-evaluable" as const;
  const remainingFreeElectiveCredits = Math.max(0, freeElective.required - effectiveFreeElectiveCredits);
  const excessFreeElectiveCredits = Math.max(0, effectiveFreeElectiveCredits - freeElective.required);
  const note = status === "not-evaluable"
    ? `직접 일반선택 ${rawFreeElectiveCredits}학점과 확인된 초과 ${transferredSurplusCredits}학점은 반영했지만, 미검수 영역이 있어 남은 ${remainingFreeElectiveCredits}학점을 확정할 수 없습니다.`
    : transferredSurplusCredits > 0
      ? `직접 일반선택 ${rawFreeElectiveCredits}학점 + 교양·전공 최소기준 초과 ${transferredSurplusCredits}학점 = 판정 일반선택 ${effectiveFreeElectiveCredits}학점입니다.`
      : "교양·전공 최소기준을 넘은 학점이 있을 때만 일반선택 잔여학점에 반영합니다.";
  return {
    categories: categoryRows.map((category) => category.key === "freeElective" ? { ...category, earned: effectiveFreeElectiveCredits, reportedEarned: rawFreeElectiveCredits, evaluationStatus: status, note } : category),
    residualCredits: { policy: "residual-after-general-and-major", status, rawFreeElectiveCredits, verifiedSurplusCredits, transferredSurplusCredits, appliedSurplusCredits, effectiveFreeElectiveCredits, requiredFreeElectiveCredits: freeElective.required, remainingFreeElectiveCredits, excessFreeElectiveCredits, minimumAllocatedCredits, reconciledKnownCredits, sources, note },
  };
}

function applyRuleCourseOverrides(
  courses: TranscriptCourse[],
  rule: GraduationRuleSet,
): TranscriptCourse[] {
  const overrides = new Map(rule.courseOverrides.map((item) => [item.courseCode.toUpperCase(), item]));
  if (!overrides.size) return courses;
  return courses.map((course) => {
    const override = overrides.get(course.code.toUpperCase());
    // Allocation authority belongs to this exact rule key. Catalog overlays and
    // unknown transcript labels cannot establish an approved allocation.
    if (!override || course.categoryRecognition !== "recognized") return course;
    const curriculumAllocation = override.authority === "curriculum-requirement"
      && (course.category === "generalRequired" || course.category === "generalElective")
      && (override.category === "generalRequired" || override.category === "generalElective");
    const approvedSubstitution = override.authority === "approved-substitution"
      && isMajorCategory(course.category) && isMajorCategory(override.category)
      && rule.substitutions.some(substitution => !substitution.requiresApproval
        && substitution.substituteCodes.some(code => code.toUpperCase() === course.code.toUpperCase()));
    if ((!curriculumAllocation && !approvedSubstitution) || override.category === course.category) return course;
    return { ...course, category: override.category, reclassified: true, categoryAdjustment: {
      originalCategory: course.categoryAdjustment?.originalCategory ?? course.category,
      reason: override.reason, authority: override.authority!,
    } };
  });
}

function assertProfileMatchesRule(profile: StudentProfile, rule: GraduationRuleSet): void {
  if (profile.universityId !== rule.key.universityId
    || profile.admissionYear !== rule.key.admissionYear
    || profile.departmentId !== rule.key.departmentId) {
    throw new Error("학생 프로필과 졸업요건 규칙의 학교·학번·전공 키가 일치하지 않습니다.");
  }
}

function dedupePassed(courses: TranscriptCourse[]) {
  const map = new Map<string, TranscriptCourse>();
  for (const course of courses.filter((item) => item.passed)) {
    const key = course.code ? `code:${course.code.toUpperCase()}` : `name:${course.name}`;
    const previous = map.get(key);
    if (!previous || course.credits > previous.credits) map.set(key, course);
  }
  return [...map.values()];
}

function catalogRequiredCourses(catalog: MajorCourseCatalog): MissingCourse[] {
  return catalog.entries
    .filter((entry) => entry.required)
    .map((entry) => ({
      code: entry.code,
      name: entry.name,
      credits: entry.credits,
      category: categoryLabel[entry.category],
      priority: "필수" as const,
      recommendedYear: entry.recommendedYear,
      recommendedSemester: entry.recommendedSemester,
      note: catalog.role === "current-classification"
        ? `${catalog.referenceYear ?? "현행"} 전공표(${catalog.sourceId})의 필수 표기만 확인됨. 입학학년도 적용·대체 근거 미확인`
        : catalog.requiredCourseSetStatus === "review"
          ? `입학학년도 전공 교육과정표(${catalog.sourceId})의 코드·이수구분은 일치함. 별도 필수 지정·대체 인정 근거가 부족해 개인의 확정 미이수로 판정하지 않음`
          : `입학학년도 전공 교육과정표(${catalog.sourceId}) 교과목번호 정확 일치`,
    }));
}

function measureProgramEvidence(
  courses: TranscriptCourse[],
  catalog: MajorCourseCatalog | null,
  rule?: GraduationRuleSet,
): MajorProgramEvidence {
  const transcriptMajorCourses = dedupePassed(courses).filter((course) => isMajorCategory(course.category));
  if (!catalog) {
    return { level: "insufficient", matchedCourses: 0, matchedCredits: 0, transcriptMajorCourses: transcriptMajorCourses.length, matchRatio: 0, method: "none" };
  }

  const catalogByCode = new Map(catalog.entries.map((entry) => [entry.code.toUpperCase(), entry]));
  const matched = transcriptMajorCourses
    .map((course) => ({ course, entry: catalogByCode.get(course.code.toUpperCase()) }))
    .filter((item): item is { course: TranscriptCourse; entry: MajorCourseCatalog["entries"][number] } => Boolean(item.entry)
      && item.course.categoryRecognition !== "unrecognized"
      && item.course.credits === item.entry?.credits
      && item.course.category === item.entry?.category
      && (!rule || majorEvidenceRecords[`${catalog.referenceYear ?? rule.key.admissionYear}/${rule.key.departmentId}/${item.course.code.toUpperCase()}`]?.status !== "conflict"));
  const matchedCredits = matched.reduce((sum, item) => sum + item.course.credits, 0);
  const matchRatio = transcriptMajorCourses.length ? matched.length / transcriptMajorCourses.length : 0;
  const categoryAgreementRatio = matched.length
    ? matched.filter((item) => item.course.category === item.entry.category).length / matched.length
    : 0;
  const activation = catalog.activation ?? {
    minimumTranscriptMatches: 5,
    minimumMatchedCredits: 12,
    minimumCategoryAgreementRatio: 0,
  };
  const strong = matched.length >= activation.minimumTranscriptMatches
    && matchedCredits >= activation.minimumMatchedCredits
    && categoryAgreementRatio >= activation.minimumCategoryAgreementRatio;
  const partial = matched.length >= 2 && matchedCredits >= 3;

  return {
    level: strong ? "strong" : partial ? "partial" : "insufficient",
    matchedCourses: matched.length,
    matchedCredits,
    transcriptMajorCourses: transcriptMajorCourses.length,
    matchRatio: Math.round(matchRatio * 1000) / 1000,
    method: "exact-course-code",
    matchedCourseNames: matched.map((item) => item.course.name),
    distinctSignals: matched.length,
    confidenceScore: matched.length * 6 + Math.round(matchedCredits * 10) / 25,
  };
}

// Compare same-cohort official code sets before considering titles. Shared
// foundation codes can be recognized, but cannot establish the selected major.
function detectCodeProgramMismatch(courses: TranscriptCourse[], rule: GraduationRuleSet, selectedCatalog: MajorCourseCatalog | null): ProgramProfileMismatch | undefined {
  if (!selectedCatalog) return undefined;
  const selectedCodes = new Set(selectedCatalog.entries.map(entry => entry.code.toUpperCase()));
  const passed = dedupePassed(courses).filter(course => isMajorCategory(course.category));
  const candidates = bundledRuleRegistry.list().filter(candidate => candidate.key.admissionYear === rule.key.admissionYear
    && candidate.key.departmentId !== rule.key.departmentId)
    .flatMap(candidate => {
      const catalog = getVerifiedMajorCourseCatalog(candidate);
      return catalog ? [{ catalog, rule: candidate }] : [];
    });
  for (const candidate of candidates) {
    const foreign = candidate.catalog;
    const foreignCodes = new Set(foreign.entries.map(entry => entry.code.toUpperCase()));
    const foreignOnly = passed.filter(course => foreignCodes.has(course.code.toUpperCase()) && !selectedCodes.has(course.code.toUpperCase()));
    const selectedOnly = passed.filter(course => selectedCodes.has(course.code.toUpperCase()) && !foreignCodes.has(course.code.toUpperCase()));
    const foreignEvidence = measureProgramEvidence(passed, foreign, candidate.rule);
    if (foreignEvidence.level !== "strong" || foreignOnly.length < 3 || foreignOnly.length <= selectedOnly.length + 1) continue;
    const source = foreign.sources?.find(source => source.id === foreign.sourceId);
    return { detected: true, inferredProgramId: candidate.rule.key.departmentId,
      inferredProgramLabel: source?.evidenceScope?.departmentName ?? candidate.rule.profileLabel,
      matchedCourses: foreignEvidence.matchedCourses, matchedCredits: foreignEvidence.matchedCredits,
      message: `선택 전공보다 ${source?.evidenceScope?.departmentName ?? "다른 전공"}의 동일 학번 공식 전공 코드가 더 충분히 일치합니다. 선택 전공에 없는 고유 코드 ${foreignOnly.length}개를 확인하여 전공 소속 확인이 필요합니다.` };
  }
  return undefined;
}

let knownOfficialMajorCodes: Set<string> | undefined;
function isKnownOfficialMajorCode(code: string): boolean {
  knownOfficialMajorCodes ??= new Set(bundledRuleRegistry.list().flatMap(candidate =>
    (getVerifiedMajorCourseCatalog(candidate)?.entries ?? getVerifiedRequiredCourseOverlay(candidate.key)?.classificationEntries ?? [])
      .map(entry => entry.code.toUpperCase())));
  return knownOfficialMajorCodes.has(code.toUpperCase());
}

function annotateMajorCourseMatches(
  courses: TranscriptCourse[],
  fallbackCatalog: MajorCourseCatalog | null,
  rule: GraduationRuleSet,
  blockedCourseCodes: string[] = [],
): TranscriptCourse[] {
  // Recognized transcript categories and credits remain authoritative for accounting.
  const blockedCodes = new Set(blockedCourseCodes.map(code => code.toUpperCase()));
  const catalogByCode = new Map(fallbackCatalog?.entries.map((entry) => [entry.code.toUpperCase(), entry]) ?? []);
  return courses.map((course) => {
    if (!course.passed) return { ...course, majorCourseMatchStatus: "not-applicable" };
    const entry = catalogByCode.get(course.code.toUpperCase());
    const evidence = majorEvidenceRecords[`${rule.key.admissionYear}/${rule.key.departmentId}/${course.code.toUpperCase()}`];
    if (entry && !blockedCodes.has(course.code.toUpperCase()) && evidence?.status !== "conflict" && course.categoryRecognition !== "unrecognized" && course.credits === entry.credits && course.category === entry.category) {
      return { ...course, catalogCategory: entry.category, majorCourseMatchStatus: "matched" };
    }
    if (course.categoryRecognition === "recognized") {
      if (!isMajorCategory(course.category)) return { ...course, catalogCategory: undefined, majorCourseMatchStatus: "not-applicable" };
      return { ...course, catalogCategory: entry?.category, majorCourseMatchStatus: "institution-recognized" };
    }
    if (entry) return { ...course, catalogCategory: entry.category, majorCourseMatchStatus: "not-evaluable" };
    if (!isMajorCategory(course.category)) return { ...course, majorCourseMatchStatus: "not-applicable" };
    return { ...course, majorCourseMatchStatus: fallbackCatalog ? "unmatched" : "not-evaluable" };
  });
}

interface RequiredCourseResolution {
  confirmedMissing: MissingCourse[];
  transitionReview: MissingCourse[];
  requirementPolicyReview: MissingCourse[];
  transferRecognitionReview: MissingCourse[];
  mandatoryEvidenceUnresolved: boolean;
  pendingRecognitions: PendingCourseRecognition[];
  assessments: RequiredCourseAssessment[];
}

type MajorEvidenceRecord = {
  status: "exact-source-row" | "catalog-only" | "conflict" | "no-source";
  category?: string;
  credits?: number;
  sourceId?: string;
  sourceHash?: string;
  locator?: string;
  reason?: string;
};
const majorEvidenceRecords = majorEvidenceIndex.records as Record<string, MajorEvidenceRecord>;

function resolveRequiredCourses(
  courses: TranscriptCourse[],
  rule: GraduationRuleSet,
  catalog: MajorCourseCatalog | null,
  profile: StudentProfile,
  transcript: TranscriptCourse[],
): RequiredCourseResolution {
  const courseByCode = new Map(courses.map((course) => [course.code.toUpperCase(), course]));
  const confirmedByCode = new Map<string, MissingCourse>();
  const reviewByCode = new Map<string, MissingCourse>();
  const partialOverlay = getVerifiedRequiredCourseOverlay(rule.key);
  const hasPriorRecognition = profile.studentType === "transfer" && transcript.some(course => course.transferCredit && course.passed);
  const priorRecognitionUnresolved = (required: MissingCourse, entry?: MajorCourseCatalog["entries"][number]) =>
    hasPriorRecognition && !courseByCode.has(required.code.toUpperCase())
    && !transcript.some(course => course.code.toUpperCase() === required.code.toUpperCase() && !course.passed)
    && (entry?.recommendedYear === undefined || entry.recommendedYear <= 2);

  for (const required of rule.requiredCourses) {
    const code = required.code.toUpperCase();
    const entry = catalog?.entries.find(item => item.code.toUpperCase() === code);
    // An explicit mandate from a conflicting source still requires reconciliation.
    const evidence = majorEvidenceRecords[`${rule.key.admissionYear}/${rule.key.departmentId}/${code}`];
    const target = entry?.category === "majorElective" || evidence?.status === "conflict" ? reviewByCode : confirmedByCode;
    target.set(code, { ...required, ...(evidence?.status === "conflict" ? { note: evidence.reason } : {}), recommendedYear: entry?.recommendedYear, recommendedSemester: entry?.recommendedSemester });
  }
  if (catalog && catalog.role !== "current-classification") {
    for (const entry of catalog.entries) {
      const evidence = majorEvidenceRecords[`${rule.key.admissionYear}/${rule.key.departmentId}/${entry.code.toUpperCase()}`];
      if (evidence?.status === "conflict" && !confirmedByCode.has(entry.code.toUpperCase()) && !reviewByCode.has(entry.code.toUpperCase())) {
        reviewByCode.set(entry.code.toUpperCase(), { code: entry.code, name: entry.name, credits: entry.credits, category: categoryLabel[entry.category], priority: "필수", note: evidence.reason });
      }
    }
    for (const required of catalogRequiredCourses(catalog)) {
      if (confirmedByCode.has(required.code.toUpperCase()) || reviewByCode.has(required.code.toUpperCase())) continue;
      const entry = catalog.entries.find((item) => item.code.toUpperCase() === required.code.toUpperCase());
      const evidence = majorEvidenceRecords[`${rule.key.admissionYear}/${rule.key.departmentId}/${required.code.toUpperCase()}`];
      const exact = evidence?.status === "exact-source-row"
        && evidence.category === entry?.category && evidence.credits === entry?.credits;
      const categoryRequiresCourse = entry?.category === "majorRequired"
        || (entry?.category === "majorFoundation" && catalog.categoryRequirementModes?.majorFoundation === "all-listed" && catalog.requiredCourseSetStatus === "verified");
      if (exact && categoryRequiresCourse) confirmedByCode.set(required.code.toUpperCase(), { ...required, note: `입학학년도 공식 전공표 ${evidence.sourceId ?? catalog.sourceId} ${evidence.locator ?? ""}의 과목코드·학과·이수구분·학점 일치` });
      else reviewByCode.set(required.code.toUpperCase(), { ...required, note: entry?.category === "majorFoundation" && exact
        ? `입학학년도 공식 전공표 ${evidence.sourceId ?? catalog.sourceId} ${evidence.locator ?? ""}에서 전공기초 분류는 확인됨. 해당 학번·학과의 전공기초 전 과목 필수 지정 또는 이 과목의 개별 필수 지정 지침을 확인해야 합니다.`
        : evidence?.status === "catalog-only" || evidence?.status === "conflict"
          ? `${evidence.reason ?? "공식 원본 행 확인 필요"}. ${evidence.locator ?? "입학학년도 학과 전공표"}의 코드·이수구분·학점과 학과 필수 지정 지침을 확인해야 합니다.`
          : entry?.category === "majorFoundation"
            ? "전공기초 분류는 확인되지만 해당 학번·학과의 전 과목 또는 개별 필수 지정 지침이 필요합니다."
            : "입학학년도 학과 전공표의 코드·이수구분·학점과 필수 지정 지침을 확인해야 합니다." });
    }
  }

  const pendingRecognitions: PendingCourseRecognition[] = [];
  function unresolved(requirements: MissingCourse[], allowPending: boolean): MissingCourse[] {
    return requirements.filter((required) => {
      const requiredCode = required.code.toUpperCase();
      if (courseByCode.has(requiredCode)) return false;
      const substitution = rule.substitutions.find((item) => item.requiredCode.toUpperCase() === requiredCode);
      const substituteCode = substitution?.substituteCodes.find((code) => courseByCode.has(code.toUpperCase()));
      if (substitution && substituteCode) {
        if (substitution.requiresApproval && allowPending) {
          const substitute = courseByCode.get(substituteCode.toUpperCase());
          pendingRecognitions.push({
            requiredCode: required.code,
            requiredName: required.name,
            substituteCode,
            substituteName: substitute?.name ?? substituteCode,
            credits: required.credits,
            note: substitution.note,
          });
        }
        return substitution.requiresApproval ? !allowPending : false;
      }
      if (substitution?.substituteCodes.length) {
        required.alternative = `${substitution.substituteCodes.join(", ")} 대체 인정은 학과 확인`;
      }
      return true;
    });
  }

  const assessments: RequiredCourseAssessment[] = [...confirmedByCode.values(), ...reviewByCode.values()]
    .filter((required) => required.category === "전공기초" || required.category === "전공필수" || required.category === "전공선택"
      || catalog?.entries.some((entry) => entry.code.toUpperCase() === required.code.toUpperCase()))
    .map((required) => {
    const code = required.code.toUpperCase();
    const entry = catalog?.entries.find((item) => item.code.toUpperCase() === code);
    const evidence = majorEvidenceRecords[`${rule.key.admissionYear}/${rule.key.departmentId}/${code}`];
    const overlayEntry = partialOverlay?.classificationEntries.find((item) => item.code.toUpperCase() === code && item.category === "majorRequired" && item.credits === required.credits);
    const exact = catalog?.role !== "current-classification" && evidence?.status === "exact-source-row"
      && evidence.category === entry?.category && evidence.credits === entry?.credits;
    const substitution = rule.substitutions.find((item) => item.requiredCode.toUpperCase() === code);
    const substituteCode = substitution?.substituteCodes.find((item) => courseByCode.has(item.toUpperCase()));
    const confirmed = confirmedByCode.has(code);
    const transferUnresolved = confirmed && priorRecognitionUnresolved(required, entry) && !substituteCode;
    const directCourse = courseByCode.get(code);
    const recognizedDirect = directCourse?.categoryRecognition === "recognized";
    const expectedCategory = entry?.category ?? overlayEntry?.category ?? (required.category === "전공기초" ? "majorFoundation" : "majorRequired");
    const creditConflict = directCourse !== undefined && (directCourse.credits !== required.credits
      || directCourse.category !== expectedCategory || directCourse.categoryRecognition === "unrecognized" || evidence?.status === "conflict");
    const sourceId = evidence?.sourceId ?? (overlayEntry ? (partialOverlay?.entrySourceIds?.[code] ?? partialOverlay?.sources[0]?.id) : catalog?.sourceId);
    const source = [...rule.sources, ...(catalog?.sources ?? []), ...(partialOverlay?.sources ?? [])].find(item => item.id === sourceId);
    const sourceScope = overlayEntry ? partialOverlay!.verifiedScope
      : `${rule.key.admissionYear}학년도 ${rule.key.departmentId} 전공표`;
    const reviewCause: ReviewCause | undefined = recognizedDirect ? undefined : evidence?.status === "conflict"
      ? { kind: "source-row-unavailable", reason: evidence.reason ?? "동일 학번·전공의 공식 자료 간 충돌을 확인해야 합니다.", missingEvidence: "동일 학번·정확한 전공의 공식 자료 간 불일치를 해소하는 학과 확인 또는 정정 문서", courseCodes: [code], sourceScope }
      : creditConflict
      ? { kind: "credit-category-conflict", reason: "성적표와 공식 전공표의 학점 또는 분류가 일치하지 않습니다.", missingEvidence: "해당 학번·전공의 학점·이수구분 변경 또는 대체 인정 문서", courseCodes: [code], sourceScope }
      : !directCourse && confirmed && substituteCode && substitution?.requiresApproval
        ? { kind: "substitution-approval-missing", reason: "대체과목 이수는 확인했지만 승인 근거가 없습니다.", missingEvidence: "학생 개인 또는 해당 학번에 적용되는 학과 대체 인정 승인", courseCodes: [code, substituteCode], sourceScope }
        : transferUnresolved
          ? { kind: "transfer-recognition-unresolved", reason: entry?.recommendedYear === undefined ? "권장 이수시기와 전적대 인정학점의 개별 과목 매핑을 확인하지 못했습니다." : "전적대 인정학점 총량은 확인했지만 이 필수과목의 개별 인정 매핑은 확인하지 못했습니다.", missingEvidence: "개별 과목별 편입 인정·대체 매핑 또는 학과 승인 문서", courseCodes: [code], sourceScope }
        : !directCourse && !confirmed
          ? { kind: exact && entry?.category === "majorFoundation" ? "requirement-designation-missing" : "source-row-unavailable", reason: exact && entry?.category === "majorFoundation" ? "전공기초 분류는 확인했지만 개별 필수 지정 근거가 부족합니다." : "입학학년도 공식 원본 행의 필수 요건을 확인하지 못했습니다.", missingEvidence: exact && entry?.category === "majorFoundation" ? "해당 학번·전공의 전공기초 전 과목 또는 개별 필수 지정 지침" : "동일 학번·전공 공식 전공표의 과목코드·이수구분·학점 원본 행과 필수 지정 지침", courseCodes: [code], sourceScope }
          : undefined;
    if (reviewCause) Object.assign(reviewCause, { sourceId, sourceUrl: source?.url, locator: evidence?.locator ?? source?.evidenceScope?.locator });
    return {
      code: required.code, name: required.name, credits: required.credits,
      category: entry?.category ?? (required.category === "전공기초" ? "majorFoundation" : "majorRequired") as MajorCourseCategory,
      classification: creditConflict || evidence?.status === "conflict" ? "conflict" : exact || overlayEntry ? "official-row" : entry ? "catalog-only" : "unverified",
      status: recognizedDirect ? "completed" : creditConflict || evidence?.status === "conflict" ? "needs-review" : directCourse ? "completed"
        : !confirmed || transferUnresolved ? "needs-review"
        : confirmed && substituteCode && substitution?.requiresApproval ? "pending-substitution"
        : substituteCode && !substitution?.requiresApproval ? "completed"
        : confirmed ? "confirmed-missing" : "needs-review",
      reason: recognizedDirect ? "성적표에서 이수한 과목으로 확인했습니다." : evidence?.status === "conflict" ? evidence.reason ?? "공식 자료 간 충돌 확인 필요" : creditConflict ? `성적표의 학점·이수구분과 공식 전공표의 ${required.credits}학점·${categoryLabel[expectedCategory as MajorCourseCategory]} 근거가 일치하지 않습니다. 학과의 변경·대체 인정 문서를 확인해야 합니다.`
        : overlayEntry ? `${partialOverlay!.verifiedScope}. 공식 전공필수 행과 일치합니다.`
        : required.note ?? evidence?.reason ?? "공식 전공표와 개별 필수 지정 근거를 확인해야 합니다.",
      reviewCause,
      requirementDesignation: confirmed && evidence?.status !== "conflict" ? "confirmed" : "needs-review",
      recommendedYear: entry?.recommendedYear,
      recommendedSemester: entry?.recommendedSemester,
      sourceUrl: source?.url,
      sourceScope,
      sourceId,
      sourceHash: evidence?.sourceHash ?? (overlayEntry ? source?.fileHash : undefined),
      locator: evidence?.locator ?? (overlayEntry ? source?.evidenceScope?.locator : undefined),
      substituteCode,
    };
  });
  // Assessments are authoritative: uncertain or conflicting rows cannot also be missing.
  const unresolvedConfirmed = unresolved([...confirmedByCode.values()], true);
  const transferRecognitionReview = unresolvedConfirmed.filter(required => {
    const assessment = assessments.find(item => item.code.toUpperCase() === required.code.toUpperCase());
    return assessment ? assessment.reviewCause?.kind === "transfer-recognition-unresolved" : priorRecognitionUnresolved(required);
  });
  const transferReviewCodes = new Set(transferRecognitionReview.map(course => course.code.toUpperCase()));
  const assessmentByCode = new Map(assessments.map(item => [item.code.toUpperCase(), item]));
  const asCourse = (item: RequiredCourseAssessment): MissingCourse => ({
    code: item.code, name: item.name, credits: item.credits, category: categoryLabel[item.category],
    priority: "필수", note: item.reason, recommendedYear: item.recommendedYear, recommendedSemester: item.recommendedSemester,
  });
  const policyKinds = new Set(["requirement-designation-missing", "source-row-unavailable"]);
  return {
    confirmedMissing: unresolvedConfirmed.filter(course => {
      const assessment = assessmentByCode.get(course.code.toUpperCase());
      return !transferReviewCodes.has(course.code.toUpperCase()) && (!assessment || assessment.status === "confirmed-missing");
    }),
    transitionReview: assessments.filter(item => item.status === "needs-review" && !policyKinds.has(item.reviewCause?.kind ?? "") && item.reviewCause?.kind !== "transfer-recognition-unresolved").map(asCourse),
    requirementPolicyReview: assessments.filter(item => item.status === "needs-review" && policyKinds.has(item.reviewCause?.kind ?? "")).map(asCourse),
    transferRecognitionReview,
    mandatoryEvidenceUnresolved: pendingRecognitions.length > 0 || assessments.some(item => item.classification === "conflict" && item.status !== "completed") || assessments.some(item =>
      (confirmedByCode.has(item.code.toUpperCase()) || rule.requiredCourses.some(required => required.code.toUpperCase() === item.code.toUpperCase()) || item.category === "majorRequired" && policyKinds.has(item.reviewCause?.kind ?? ""))
      && (item.status === "needs-review" || item.status === "pending-substitution")),
    pendingRecognitions: pendingRecognitions.filter(item => {
      const assessment = assessmentByCode.get(item.requiredCode.toUpperCase());
      return !assessment || assessment.status === "pending-substitution";
    }),
    assessments,
  };
}

function buildCourseMatchAudit(
  courses: TranscriptCourse[],
  selectedProgramId: string,
  catalog: MajorCourseCatalog | null,
  programEvidence: MajorProgramEvidence,
  majorEvaluationAvailable: boolean,
  requiredResolution: RequiredCourseResolution,
  requiredCreditShortage: number,
  potentialRequiredCredits: number,
  usingProgramSignature: boolean,
  programSignatureLabel?: string,
  profileMismatch?: ProgramProfileMismatch,
  reviewCauses: ReviewCause[] = [],
  verifiedScope?: string,
): MajorCourseMatchAudit {
  const matchedMajorCourses = courses
    .filter((course) => !profileMismatch?.detected && course.majorCourseMatchStatus === "matched")
    .map((course) => ({
      code: course.code,
      name: course.name,
      credits: course.credits,
      transcriptCategory: course.category,
      recognizedCategory: course.category as "majorFoundation" | "majorRequired" | "majorElective",
      catalogCategory: course.catalogCategory,
      transferCredit: course.transferCredit,
      recognitionReason: "catalog" as const,
    }));
  const institutionallyRecognizedMajorCourses = courses
    .filter((course) => !profileMismatch?.detected && course.majorCourseMatchStatus === "institution-recognized")
    .map((course) => ({
      code: course.code,
      name: course.name,
      credits: course.credits,
      transcriptCategory: course.category,
      recognizedCategory: course.category as "majorFoundation" | "majorRequired" | "majorElective",
      catalogCategory: course.catalogCategory,
      transferCredit: course.transferCredit,
      recognitionReason: course.transferCredit
        ? "transfer-recognition" as const
        : course.catalogCategory && course.catalogCategory !== course.category
          ? "curriculum-transition" as const
          : "individual-transcript" as const,
    }));
  const unmatchedTranscriptMajorCourses = courses
    .filter((course) => profileMismatch?.detected ? Boolean(isMajorCategory(course.category) || course.catalogCategory) : course.majorCourseMatchStatus === "unmatched" || course.majorCourseMatchStatus === "not-evaluable")
    .map((course) => ({
      code: course.code,
      name: course.name,
      credits: course.credits,
      transcriptCategory: course.category,
    }));
  return {
    reviewCauses,
    verifiedScope,
    status: majorEvaluationAvailable && !profileMismatch?.detected ? "verified" : "not-evaluable",
    selectedProgramId,
    sourceId: catalog?.sourceId ?? (usingProgramSignature ? "kmou-program-identity-signature-v1" : undefined),
    sourceIds: catalog?.sourceIds,
    classificationSources: catalog?.role === "current-classification" ? catalog.sources ?? [] : [],
    classificationReferenceYear: catalog?.role === "current-classification" ? catalog.referenceYear : undefined,
    classificationSource: catalog ? (catalog.role ?? "cohort-catalog") : usingProgramSignature ? "transcript-program-signature" : undefined,
    currentClassificationApplied: catalog?.role === "current-classification",
    requiredCourseSetStatus: catalog?.requiredCourseSetStatus ?? (usingProgramSignature ? "review" : undefined),
    requiredCourseSetNote: catalog?.requiredCourseSetNote ?? (usingProgramSignature
      ? `${programSignatureLabel ?? "선택 전공"} 과목명 지문은 소속 확인의 보조 근거이며 학점을 확정하지 않습니다. 학번별 전공필수 전체 과목표는 추가 확인 중입니다.`
      : undefined),
    matchedMajorCourses,
    institutionallyRecognizedMajorCourses,
    unmatchedTranscriptMajorCourses,
    matchedCredits: matchedMajorCourses.reduce((sum, course) => sum + course.credits, 0),
    institutionallyRecognizedCredits: institutionallyRecognizedMajorCourses.reduce((sum, course) => sum + course.credits, 0),
    unmatchedCredits: unmatchedTranscriptMajorCourses.reduce((sum, course) => sum + course.credits, 0),
    programEvidence,
    transitionReviewCourses: requiredResolution.transitionReview,
    requirementPolicyReviewCourses: requiredResolution.requirementPolicyReview,
    transferRecognitionReviewCourses: requiredResolution.transferRecognitionReview,
    requiredCourseAssessments: requiredResolution.assessments,
    pendingCourseRecognitions: requiredResolution.pendingRecognitions,
    requiredCreditShortage,
    potentialRequiredCredits,
    profileMismatch,
    note: catalog?.role === "current-classification"
      ? `입학학년도 졸업요건은 해당 학년도 원본으로 유지하고, ${catalog.referenceYear ?? "현행"} 전공표는 개인 성적표의 전공 이수구분을 교차검증하는 보조자료로만 사용했습니다. 학번별 전환표가 없는 충돌 과목은 성적표의 확정 이수구분을 보존합니다.`
      : usingProgramSignature
        ? `${programSignatureLabel ?? "선택 전공"}의 고유 과목명 지문이 ${programEvidence.matchedCourses}개(${programEvidence.matchedCredits}학점) 일치합니다. 학교가 인정한 성적표 이수구분으로 학점을 계산하며 동일 학번·전공 공식 행의 충돌은 보류합니다. 전공필수 개별 미이수 목록은 학번별 상세 과목표가 연결될 때까지 확정하지 않습니다.`
      : catalog
      ? "공식 행 대조 및 학교가 인정한 성적표 이수구분으로 학점을 계산합니다. 전체 판정은 전공 소속과 교육과정 범위를 별도로 확인합니다."
      : "학교가 인정한 성적표 이수구분으로 학점을 계산했습니다. 선택 전공의 학번별 상세 교육과정 및 필수 지정 자료는 추가 확인 중입니다.",
  };
}

export function auditTranscript(
  courses: TranscriptCourse[],
  rule: GraduationRuleSet = DEFAULT_RULE,
  profile: StudentProfile = DEFAULT_PROFILE,
): DetailedAudit {
  assertProfileMatchesRule(profile, rule);
  const ruleAdjustedCourses = applyRuleCourseOverrides(courses, rule);
  const cohortCatalog = getVerifiedMajorCourseCatalog(rule);
  const currentClassificationCatalog = getCurrentMajorClassificationCatalog(rule);
  const currentClassificationEvidence = measureProgramEvidence(ruleAdjustedCourses, currentClassificationCatalog, rule);
  const cohortEvidence = measureProgramEvidence(ruleAdjustedCourses, cohortCatalog, rule);
  if (cohortCatalog) {
    const peers = bundledRuleRegistry.list().filter(candidate => candidate.key.admissionYear === rule.key.admissionYear)
      .flatMap(candidate => { const catalog = getVerifiedMajorCourseCatalog(candidate); return catalog ? [{ rule: candidate, catalog }] : []; });
    const exactCodes = new Set(dedupePassed(ruleAdjustedCourses)
      .filter(course => course.categoryRecognition !== "unrecognized" && cohortCatalog.entries.some(entry =>
        entry.code.toUpperCase() === course.code.toUpperCase() && entry.credits === course.credits && entry.category === course.category)
        && majorEvidenceRecords[`${rule.key.admissionYear}/${rule.key.departmentId}/${course.code.toUpperCase()}`]?.status !== "conflict")
      .map(course => course.code.toUpperCase()));
    const matches = [...exactCodes].map(code => {
      const selected = cohortCatalog.entries.find(entry => entry.code.toUpperCase() === code)!;
      const departmentIds = peers.filter(peer => peer.catalog.entries.some(entry =>
        entry.code.toUpperCase() === code && entry.credits === selected.credits && entry.category === selected.category))
        .map(peer => peer.rule.key.departmentId);
      return { code, departmentIds };
    });
    cohortEvidence.scopedCodeDiagnostics = {
      sourceScope: `${rule.key.admissionYear}/${rule.key.departmentId}; bundled same-cohort catalogs only`,
      uniqueCodes: matches.filter(match => match.departmentIds.length === 1).map(match => match.code),
      sharedCodes: matches.filter(match => match.departmentIds.length > 1).map(match => match.code),
      candidates: matches,
      jointCandidateDepartmentIds: matches.length ? peers.filter(peer => matches.every(match => match.departmentIds.includes(peer.rule.key.departmentId))).map(peer => peer.rule.key.departmentId) : [],
    };
  }
  const currentClassificationApplied = cohortEvidence.level !== "strong" && currentClassificationEvidence.level === "strong";
  const programSignature = getKmouProgramIdentitySignature(rule.key.departmentId);
  const signatureEvidence = measureKmouProgramIdentity(ruleAdjustedCourses, rule.key.departmentId);
  const majorCourseCatalog = cohortEvidence.level === "strong"
    ? cohortCatalog
    : currentClassificationApplied ? currentClassificationCatalog : null;
  const usingProgramSignature = !majorCourseCatalog && signatureEvidence.level === "strong";
  const programEvidence = cohortEvidence.level === "strong"
    ? cohortEvidence
    : cohortCatalog ? cohortEvidence : currentClassificationApplied ? currentClassificationEvidence : signatureEvidence;
  const partialRequiredCourseOverlay = getVerifiedRequiredCourseOverlay(rule.key);
  const partialCatalogOnly = !majorCourseCatalog && partialRequiredCourseOverlay?.completeness === "partial";
  // A course-name signature can identify a program, but a first-semester-only
  // overlay cannot support a complete graduation evaluation.
  const majorEvaluationAvailable = cohortEvidence.level === "strong" && Boolean(cohortCatalog) && !partialCatalogOnly;
  const codeMismatch = detectCodeProgramMismatch(ruleAdjustedCourses, rule, cohortCatalog);
  const hasScopedExactCourse = ruleAdjustedCourses.some(course => course.passed &&
    (cohortCatalog?.entries ?? partialRequiredCourseOverlay?.classificationEntries ?? []).some(entry =>
      entry.code.toUpperCase() === course.code.toUpperCase() && entry.credits === course.credits && entry.category === course.category));
  const selectedProgramMismatch = codeMismatch ?? (hasScopedExactCourse
    ? undefined : detectKnownProgramMismatch(ruleAdjustedCourses, rule.key.departmentId));
  const overlayCatalog = partialRequiredCourseOverlay ? {
    entries: partialRequiredCourseOverlay.classificationEntries,
  } as MajorCourseCatalog : null;
  const annotatedCourses = annotateMajorCourseMatches(
    ruleAdjustedCourses,
    cohortCatalog ?? overlayCatalog,
    rule,
    partialRequiredCourseOverlay?.blockedCourseCodes,
  );
  const passedCourses = dedupePassed(annotatedCourses);
  const majorCreditEvaluationAvailable = !selectedProgramMismatch?.detected;
  const reportedEarned = new Map<CategoryKey, number>();
  for (const course of dedupePassed(ruleAdjustedCourses)) {
    if (course.categoryRecognition === "unrecognized") continue;
    reportedEarned.set(course.category, (reportedEarned.get(course.category) ?? 0) + course.credits);
  }
  const earned = new Map<CategoryKey, number>();
  for (const course of passedCourses) {
    if (course.categoryRecognition === "unrecognized") continue;
    if ((isMajorCategory(course.category) || course.catalogCategory) && (selectedProgramMismatch?.detected || (course.majorCourseMatchStatus !== "matched" && course.majorCourseMatchStatus !== "institution-recognized"))) continue;
    earned.set(course.category, (earned.get(course.category) ?? 0) + course.credits);
  }
  const baseCategories = rule.credits.map((meta) => {
    const majorCategory = isMajorCategory(meta.key);
    const evaluationStatus = majorCategory && !majorCreditEvaluationAvailable ? "not-evaluable" as const : "evaluated" as const;
    return {
      ...meta,
      earned: earned.get(meta.key) ?? 0,
      pendingEarned: majorCategory || passedCourses.some(course => course.category === meta.key && course.catalogCategory && course.majorCourseMatchStatus === "not-evaluable") ? Math.max(0, (reportedEarned.get(meta.key) ?? 0) - (earned.get(meta.key) ?? 0)) : undefined,
      reportedEarned: majorCategory || passedCourses.some(course => course.category === meta.key && course.catalogCategory && course.majorCourseMatchStatus === "not-evaluable") ? reportedEarned.get(meta.key) ?? 0 : undefined,
      evaluationStatus,
      note: evaluationStatus === "not-evaluable"
        ? selectedProgramMismatch?.detected ? "다른 전공의 코드 근거가 확인되어 선택 전공 학점 인정을 보류합니다." : partialCatalogOnly ? "동일 학번·전공의 공식 행과 학점·이수구분이 일치한 학점만 확정했습니다. 전체 교육과정은 미확인입니다." : "공식 행과 일치한 학점은 확정했지만 전체 판정에 필요한 전공 소속 근거가 부족합니다."
        : undefined,
    };
  });
  const residualCreditResult = applyResidualFreeElectivePolicy(baseCategories);
  const categories = residualCreditResult.categories;
  const requiredResolution = resolveRequiredCourses(passedCourses, rule, majorCourseCatalog, profile, annotatedCourses);
  const missingCourses = majorEvaluationAvailable && majorCreditEvaluationAvailable ? requiredResolution.confirmedMissing : [];
  const earnedTotal = passedCourses.reduce((sum, course) => sum + course.credits, 0);
  const classificationIssues = passedCourses
    .filter((course) => course.categoryRecognition === "unrecognized" && course.credits > 0)
    .map((course) => ({ rowNumber: course.rowNumber, code: course.code, name: course.name, rawCategory: course.rawCategory, credits: course.credits }));
  const unclassifiedCredits = classificationIssues.reduce((sum, course) => sum + course.credits, 0);
  const transcriptClassification = {
    status: classificationIssues.length ? "needs-review" as const : "verified" as const,
    unclassifiedCredits,
    issues: classificationIssues,
    note: classificationIssues.length
      ? "알 수 없는 이수구분은 일반선택으로 임의 처리하지 않았습니다. 종합정보시스템 원본의 이수구분을 확인해야 합니다."
      : "모든 취득 교과목의 이수구분이 공식 지원 범위 안에서 인식됐습니다.",
  };
  const generalEducationPack = getVerifiedGeneralEducationPack(rule.key);
  const generalEducation = generalEducationPack
    ? evaluateGeneralEducation(passedCourses, generalEducationPack.rule, {
        verifiedNonTargetCourseCodes: generalEducationPack.verifiedNonTargetCourseCodes,
        recognitionRules: generalEducationPack.recognitionOverlay?.rules ?? [],
      })
    : undefined;
  const generalEducationCreditShortage = calculateGeneralEducationCreditShortage(generalEducation);
  const officialSources = assertRequirementSourcesApplicable(
    [...rule.sources, ...(generalEducationPack?.rule.sources ?? [])],
    rule.key.admissionYear,
    rule.key.departmentId,
  );

  const majorRequired = categories.find((item) => item.key === "majorRequired");
  const pendingMajorRequiredCredits = requiredResolution.pendingRecognitions.reduce((sum, item) => sum + item.credits, 0);
  const requiredCreditShortage = majorRequired?.evaluationStatus === "evaluated"
    ? Math.max(0, majorRequired.required - majorRequired.earned)
    : 0;
  const potentialRequiredCredits = majorRequired?.evaluationStatus === "evaluated"
    ? Math.min(majorRequired.required, majorRequired.earned + pendingMajorRequiredCredits)
    : 0;
  const verifiedScope = partialRequiredCourseOverlay
    ? partialRequiredCourseOverlay.majorTableComplete ? partialRequiredCourseOverlay.verifiedScope : `${rule.key.admissionYear}학년도 ${profile.department} 1학년 1학기 공식표만 확인 · 전체 4년 전공 교육과정은 미확인`
    : cohortCatalog ? `${rule.key.admissionYear}학년도 ${profile.department} 공식 전공 교육과정표` : undefined;
  const scope = verifiedScope ?? `${rule.key.admissionYear}학년도 ${profile.department} 상세 전공표 미확인`;
  const majorCodes = dedupePassed(ruleAdjustedCourses).filter(course => isMajorCategory(course.category)).map(course => course.code);
  const reviewCauses: ReviewCause[] = requiredResolution.assessments.flatMap(item => item.reviewCause ? [item.reviewCause] : []);
  const generalTransferReview = requiredResolution.transferRecognitionReview.filter(item => !requiredResolution.assessments.some(assessment => assessment.code.toUpperCase() === item.code.toUpperCase()));
  if (generalTransferReview.length) reviewCauses.push({ kind: "transfer-recognition-unresolved", reason: "교양 필수과목의 권장시기와 전적대 개별 인정 매핑을 확인하지 못했습니다. 면제 또는 미이수로 확정하지 않습니다.", missingEvidence: "개별 과목별 편입 인정·대체 매핑 또는 학과 승인 문서", courseCodes: generalTransferReview.map(course => course.code), sourceScope: `${rule.key.admissionYear}학년도 ${rule.key.departmentId} 교양 필수요건과 개인 편입 인정내역` });
  if (selectedProgramMismatch?.detected) reviewCauses.unshift({kind: "major-profile-mismatch", reason: selectedProgramMismatch.message, missingEvidence: "성적표 원본 소속 전공과 선택한 전공의 일치 확인", courseCodes: majorCodes, sourceScope: scope});
  else if (programEvidence.level !== "strong") reviewCauses.unshift({kind: "major-evidence-insufficient", reason: `선택 학번·전공의 교육과정 확인 근거가 부족합니다 (${programEvidence.matchedCourses}과목·${programEvidence.matchedCredits}학점 일치).`, missingEvidence: "선택 학번·전공의 공식 교육과정 및 필수 지정 자료", courseCodes: [], sourceScope: scope});
  if (partialRequiredCourseOverlay) reviewCauses.unshift({kind: "curriculum-outside-verified-scope", reason: "확인한 전공표 범위만으로 전체 전공 졸업요건은 판정할 수 없습니다.", missingEvidence: partialRequiredCourseOverlay.majorTableComplete ? `${rule.key.admissionYear}학년도 ${profile.department} 전체 졸업요건·필수 지정 지침·대체 폐지 및 전환 규칙` : `${rule.key.admissionYear}학년도 ${profile.department} 1학년 2학기부터 4학년까지의 공식 전공 교육과정표`, courseCodes: [], sourceScope: scope, sourceId: partialRequiredCourseOverlay.sources[0]?.id, sourceUrl: partialRequiredCourseOverlay.sources[0]?.url, locator: partialRequiredCourseOverlay.sources[0]?.evidenceScope?.locator});
  if (partialRequiredCourseOverlay?.blockedCourseCodes?.length) reviewCauses.push({
    kind: "credit-category-conflict", reason: "같은 학번·전공의 공식 원본 간 학점·이수구분 또는 필수 지정이 충돌합니다. 성적표의 인정 학점은 그대로 반영합니다.",
    missingEvidence: "시스템 교육과정 자료의 개정 및 필수 지정 우선 적용 근거",
    courseCodes: partialRequiredCourseOverlay.blockedCourseCodes, sourceScope: scope,
    sourceId: partialRequiredCourseOverlay.sources.at(-1)?.id, sourceUrl: partialRequiredCourseOverlay.sources.at(-1)?.url,
  });
  const scopedEntries = new Map((cohortCatalog?.entries ?? partialRequiredCourseOverlay?.classificationEntries ?? []).map(entry => [entry.code.toUpperCase(), entry]));
  const conflictingCourses = passedCourses.filter(course => scopedEntries.has(course.code.toUpperCase()) && course.majorCourseMatchStatus === "not-evaluable");
  if (conflictingCourses.length) reviewCauses.push({ kind: "credit-category-conflict", reason: "동일 코드의 성적표 학점 또는 이수구분이 공식 행과 다릅니다.", missingEvidence: "해당 학번·전공의 학점·이수구분 변경 또는 대체 인정 문서", courseCodes: conflictingCourses.map(course => course.code), sourceScope: scope });
  const outsideScopedCourses = passedCourses.filter(course => isMajorCategory(course.category) && course.majorCourseMatchStatus !== "institution-recognized" && !scopedEntries.has(course.code.toUpperCase()));
  const borrowedCodes = outsideScopedCourses.filter(course => isKnownOfficialMajorCode(course.code)).map(course => course.code);
  if (borrowedCodes.length && !partialRequiredCourseOverlay) reviewCauses.push({ kind: "curriculum-outside-verified-scope", reason: "공식 과목코드는 다른 학번 또는 전공의 자료에서 확인되지만 선택 학번·전공의 적용 근거가 없습니다.", missingEvidence: "선택 학번·전공의 해당 코드 원본 행 또는 전환·대체 인정 문서", courseCodes: borrowedCodes, sourceScope: scope });
  const unmatchedCodes = outsideScopedCourses.filter(course => !isKnownOfficialMajorCode(course.code)).map(course => course.code);
  if (unmatchedCodes.length) reviewCauses.push({kind: "unmatched-course-code", reason: "선택 학번·전공의 공식표에 연결되지 않은 전공 코드가 있습니다.", missingEvidence: "해당 코드의 동일 학번·전공 원본 행 또는 전환·대체 인정 문서", courseCodes: unmatchedCodes, sourceScope: scope});
  const courseMatch = buildCourseMatchAudit(
    passedCourses,
    rule.key.departmentId,
    majorCourseCatalog,
    programEvidence,
    majorEvaluationAvailable,
    requiredResolution,
    requiredCreditShortage,
    potentialRequiredCredits,
    usingProgramSignature,
    programSignature?.label,
    selectedProgramMismatch,
    reviewCauses,
    verifiedScope,
  );
  const overallStatus = courseMatch.status === "verified" && transcriptClassification.status === "verified" && requiredResolution.transferRecognitionReview.length === 0 && !requiredResolution.mandatoryEvidenceUnresolved ? "evaluated" as const : "not-evaluable" as const;
  const creditEvaluationStatus = !selectedProgramMismatch?.detected && transcriptClassification.status === "verified" && courseMatch.unmatchedCredits === 0 ? "evaluated" as const : "not-evaluable" as const;
  const applicableEarnedTotal = Math.max(0, earnedTotal - courseMatch.unmatchedCredits);
  // Unclassified rows can also be unresolved official-code conflicts. Count
  // their exclusion once when computing the conservative applicable total.
  const unclassifiedUnmatchedCredits = passedCourses.filter(course => course.categoryRecognition === "unrecognized"
    && (selectedProgramMismatch?.detected ? Boolean(isMajorCategory(course.category) || course.catalogCategory) : course.majorCourseMatchStatus === "unmatched" || course.majorCourseMatchStatus === "not-evaluable"))
    .reduce((sum, course) => sum + course.credits, 0);
  const classifiedApplicableEarnedTotal = Math.max(0, applicableEarnedTotal - unclassifiedCredits + unclassifiedUnmatchedCredits);
  const minimumGraduationCreditShortage = calculateMinimumGraduationCreditShortage({
    categories,
    generalEducation,
    missingCourses,
    requiredTotal: rule.requiredTotal,
    applicableEarnedTotal: classifiedApplicableEarnedTotal,
  });

  return {
    profile: {
      admissionYear: rule.key.admissionYear,
      transferEntryYear: profile.transferEntryYear,
      department: profile.department,
      studentType: profile.studentTypeLabel,
      universityId: rule.key.universityId,
      departmentId: rule.key.departmentId,
      studentTypeCode: profile.studentType,
    },
    overallStatus,
    creditEvaluationStatus,
    earnedTotal,
    applicableEarnedTotal: classifiedApplicableEarnedTotal,
    requiredTotal: rule.requiredTotal,
    categories,
    residualCredits: residualCreditResult.residualCredits,
    generalEducationCreditShortage,
    transcriptClassification,
    missingCourses,
    certification: { language: false, activity: false },
    certificationEvidence: "unknown",
    ruleVersion: rule.version,
    ruleStatus: rule.status,
    officialSources,
    courseMatch,
    courses: annotatedCourses,
    reclassifiedCount: annotatedCourses.filter((course) => course.reclassified).length,
    passedCourseCount: passedCourses.length,
    forecastCredits: creditEvaluationStatus === "evaluated"
      ? minimumGraduationCreditShortage
      : Math.max(0, rule.requiredTotal - Math.max(0, earnedTotal - unclassifiedCredits)),
    generalEducation,
    courseGuidance: makeCourseGuidance(rule, { courses: annotatedCourses, categories, courseMatch: { ...courseMatch, requiredCourseAssessments: resolveRequiredCourses(passedCourses, rule, cohortCatalog, profile, annotatedCourses).assessments }, generalEducation }),
  };
}

export function auditDemo(rule: GraduationRuleSet = DEFAULT_RULE, profile: StudentProfile = DEFAULT_PROFILE): DetailedAudit {
  return {
    ...demoAudit,
    profile: {
      admissionYear: rule.key.admissionYear,
      transferEntryYear: profile.transferEntryYear,
      department: profile.department,
      studentType: profile.studentTypeLabel,
      universityId: rule.key.universityId,
      departmentId: rule.key.departmentId,
      studentTypeCode: profile.studentType,
    },
    certificationEvidence: "demo",
    ruleVersion: rule.version,
    ruleStatus: rule.status,
    officialSources: rule.sources,
    overallStatus: "evaluated",
    residualCredits: demoAudit.residualCredits,
    courseMatch: {
      status: "verified",
      selectedProgramId: rule.key.departmentId,
      sourceId: rule.majorCourseCatalog?.sourceId,
      sourceIds: rule.majorCourseCatalog?.sourceIds,
      classificationSources: [],
      classificationReferenceYear: undefined,
      classificationSource: rule.majorCourseCatalog?.role ?? "cohort-catalog",
      currentClassificationApplied: false,
      requiredCourseSetStatus: rule.majorCourseCatalog?.requiredCourseSetStatus,
      requiredCourseSetNote: rule.majorCourseCatalog?.requiredCourseSetNote,
      matchedMajorCourses: [],
      institutionallyRecognizedMajorCourses: [],
      unmatchedTranscriptMajorCourses: [],
      matchedCredits: 0,
      institutionallyRecognizedCredits: 0,
      unmatchedCredits: 0,
      programEvidence: { level: "strong", matchedCourses: 0, matchedCredits: 0, transcriptMajorCourses: 0, matchRatio: 1 },
      transitionReviewCourses: [],
      requiredCourseAssessments: [],
      pendingCourseRecognitions: [],
      requiredCreditShortage: 9,
      potentialRequiredCredits: 51,
      note: "데모 화면용 예시 판정입니다.",
    },
    courses: [],
    reclassifiedCount: 5,
    passedCourseCount: 50,
    forecastCredits: 18,
  };
}

export const categoryLabel: Record<CategoryKey, string> = {
  generalRequired: "교양필수",
  generalElective: "교양선택",
  majorFoundation: "전공기초",
  majorRequired: "전공필수",
  majorElective: "전공선택",
  freeElective: "일반선택",
};
