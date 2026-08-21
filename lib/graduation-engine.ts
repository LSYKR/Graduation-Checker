import { demoAudit } from "./demo";
import { evaluateGeneralEducation } from "./general-education-engine";
import { DEFAULT_PROFILE, DEFAULT_RULE } from "./rule-registry";
import { getTranscriptAdapter, kmouTranscriptAdapter } from "./transcript-adapters";
import { getVerifiedGeneralEducationPack } from "./verified-general-education";
import { assertRequirementSourcesApplicable } from "./source-applicability";
import {
  getKmouProgramIdentitySignature,
  measureKmouProgramIdentity,
} from "./kmou-program-signatures";
import {
  detectKnownProgramMismatch,
  getCurrentMajorClassificationCatalog,
  getVerifiedMajorCourseCatalog,
} from "./verified-major-curricula";
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
  ParseResult,
  ResidualCreditAudit,
  StudentProfile,
  TranscriptCourse,
} from "./types";

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
  const overrides = new Map(rule.courseOverrides.map((item) => [item.courseCode.toUpperCase(), item.category]));
  if (!overrides.size) return courses;
  return courses.map((course) => {
    const category = overrides.get(course.code.toUpperCase());
    if (!category || (category === course.category && course.categoryRecognition !== "unrecognized")) return course;
    return {
      ...course,
      category,
      categoryRecognition: "recognized" as const,
      reclassified: true,
    };
  });
}

function assertProfileMatchesRule(profile: StudentProfile, rule: GraduationRuleSet): void {
  if (profile.universityId !== rule.key.universityId
    || profile.admissionYear !== rule.key.admissionYear
    || profile.departmentId !== rule.key.departmentId) {
    throw new Error("학생 프로필과 졸업요건 규칙의 학교·학번·전공 키가 일치하지 않습니다.");
  }
}

export function normalizeTranscriptRows(rows: Record<string, unknown>[], rule: GraduationRuleSet = DEFAULT_RULE) {
  return kmouTranscriptAdapter.normalizeRows(rows, rule);
}

export function parseTranscriptBuffer(buffer: ArrayBuffer, rule: GraduationRuleSet = DEFAULT_RULE): ParseResult {
  return getTranscriptAdapter(rule.key.universityId).parse(buffer, rule);
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
      note: catalog.role === "current-classification"
        ? "공식 현행 전공표의 이수구분과 교과목번호 정확 일치"
        : "공식 전공 교육과정표 교과목번호 정확 일치",
    }));
}

function measureProgramEvidence(
  courses: TranscriptCourse[],
  catalog: MajorCourseCatalog | null,
): MajorProgramEvidence {
  const transcriptMajorCourses = dedupePassed(courses).filter((course) => isMajorCategory(course.category));
  if (!catalog) {
    return { level: "insufficient", matchedCourses: 0, matchedCredits: 0, transcriptMajorCourses: transcriptMajorCourses.length, matchRatio: 0, method: "none" };
  }

  const catalogByCode = new Map(catalog.entries.map((entry) => [entry.code.toUpperCase(), entry]));
  const matched = transcriptMajorCourses
    .map((course) => ({ course, entry: catalogByCode.get(course.code.toUpperCase()) }))
    .filter((item): item is { course: TranscriptCourse; entry: MajorCourseCatalog["entries"][number] } => Boolean(item.entry));
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

function annotateMajorCourseMatches(
  courses: TranscriptCourse[],
  primaryCatalog: MajorCourseCatalog | null,
  fallbackCatalog: MajorCourseCatalog | null,
  programEvidence: MajorProgramEvidence,
): TranscriptCourse[] {
  const catalogByCode = new Map(fallbackCatalog?.entries.map((entry) => [entry.code.toUpperCase(), entry]) ?? []);
  for (const entry of primaryCatalog?.entries ?? []) catalogByCode.set(entry.code.toUpperCase(), entry);
  return courses.map((course) => {
    if (!course.passed) return { ...course, majorCourseMatchStatus: "not-applicable" };
    const catalogEntry = course.code ? catalogByCode.get(course.code.toUpperCase()) : undefined;
    if (catalogEntry) {
      if (isMajorCategory(course.category) && course.category !== catalogEntry.category && programEvidence.level === "strong") {
        return {
          ...course,
          catalogCategory: catalogEntry.category,
          majorCourseMatchStatus: "institution-recognized",
        };
      }
      return {
        ...course,
        category: catalogEntry.category,
        catalogCategory: catalogEntry.category,
        reclassified: course.reclassified || course.category !== catalogEntry.category,
        majorCourseMatchStatus: "matched",
      };
    }
    if (!isMajorCategory(course.category)) {
      return { ...course, majorCourseMatchStatus: "not-applicable" };
    }
    return {
      ...course,
      majorCourseMatchStatus: programEvidence.level === "strong"
        ? "institution-recognized"
        : primaryCatalog ? "unmatched" : "not-evaluable",
    };
  });
}

interface RequiredCourseResolution {
  confirmedMissing: MissingCourse[];
  transitionReview: MissingCourse[];
  pendingRecognitions: PendingCourseRecognition[];
}

function resolveRequiredCourses(
  courses: TranscriptCourse[],
  rule: GraduationRuleSet,
  catalog: MajorCourseCatalog | null,
): RequiredCourseResolution {
  const courseByCode = new Map(courses.map((course) => [course.code.toUpperCase(), course]));
  const confirmedByCode = new Map<string, MissingCourse>();
  const reviewByCode = new Map<string, MissingCourse>();
  for (const required of rule.requiredCourses) confirmedByCode.set(required.code.toUpperCase(), required);
  if (catalog) {
    const target = catalog.requiredCourseSetStatus === "verified" ? confirmedByCode : reviewByCode;
    for (const required of catalogRequiredCourses(catalog)) {
      if (!confirmedByCode.has(required.code.toUpperCase())) target.set(required.code.toUpperCase(), required);
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

  return {
    confirmedMissing: unresolved([...confirmedByCode.values()], true),
    transitionReview: unresolved([...reviewByCode.values()], false),
    pendingRecognitions,
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
): MajorCourseMatchAudit {
  const matchedMajorCourses = courses
    .filter((course) => course.majorCourseMatchStatus === "matched")
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
    .filter((course) => course.majorCourseMatchStatus === "institution-recognized")
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
    .filter((course) => course.majorCourseMatchStatus === "unmatched" || course.majorCourseMatchStatus === "not-evaluable")
    .map((course) => ({
      code: course.code,
      name: course.name,
      credits: course.credits,
      transcriptCategory: course.category,
    }));
  const profileMismatch = detectKnownProgramMismatch(courses, selectedProgramId);
  return {
    status: majorEvaluationAvailable && !profileMismatch?.detected ? "verified" : "not-evaluable",
    selectedProgramId,
    sourceId: catalog?.sourceId ?? (usingProgramSignature ? "kmou-program-identity-signature-v1" : undefined),
    sourceIds: catalog?.sourceIds,
    classificationSources: catalog?.role === "current-classification" ? catalog.sources ?? [] : [],
    classificationReferenceYear: catalog?.role === "current-classification" ? catalog.referenceYear : undefined,
    classificationSource: catalog?.role ?? (usingProgramSignature ? "transcript-program-signature" : "cohort-catalog"),
    currentClassificationApplied: catalog?.role === "current-classification",
    requiredCourseSetStatus: catalog?.requiredCourseSetStatus ?? (usingProgramSignature ? "review" : undefined),
    requiredCourseSetNote: catalog?.requiredCourseSetNote ?? (usingProgramSignature
      ? `${programSignatureLabel ?? "선택 전공"} 과목명 지문으로 성적표 소속과 영역별 학점은 검증했지만, 학번별 전공필수 전체 과목표는 추가 확인 중입니다.`
      : undefined),
    matchedMajorCourses,
    institutionallyRecognizedMajorCourses,
    unmatchedTranscriptMajorCourses,
    matchedCredits: matchedMajorCourses.reduce((sum, course) => sum + course.credits, 0),
    institutionallyRecognizedCredits: institutionallyRecognizedMajorCourses.reduce((sum, course) => sum + course.credits, 0),
    unmatchedCredits: unmatchedTranscriptMajorCourses.reduce((sum, course) => sum + course.credits, 0),
    programEvidence,
    transitionReviewCourses: requiredResolution.transitionReview,
    pendingCourseRecognitions: requiredResolution.pendingRecognitions,
    requiredCreditShortage,
    potentialRequiredCredits,
    profileMismatch,
    note: catalog?.role === "current-classification"
      ? `입학학년도 졸업요건은 해당 학년도 원본으로 유지하고, ${catalog.referenceYear ?? "현행"} 전공표는 개인 성적표의 전공 이수구분을 교차검증하는 보조자료로만 사용했습니다. 학번별 전환표가 없는 충돌 과목은 성적표의 확정 이수구분을 보존합니다.`
      : usingProgramSignature
        ? `${programSignatureLabel ?? "선택 전공"}의 고유 과목명 지문이 ${programEvidence.matchedCourses}개(${programEvidence.matchedCredits}학점) 일치해 종합정보시스템의 전공기초·전공필수·전공선택 학점을 반영했습니다. 전공필수 개별 미이수 목록은 학번별 상세 과목표가 연결될 때까지 확정하지 않습니다.`
      : catalog
      ? "선택 전공의 공식 교육과정표 코드 지문이 충분히 일치한 경우에만 개인 성적표의 전공 이수구분을 함께 반영합니다."
      : "선택 전공의 학번별 상세 교육과정표가 아직 검증되지 않아 성적표의 전공 표기만으로는 전공학점을 인정하지 않습니다.",
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
  const currentClassificationEvidence = measureProgramEvidence(ruleAdjustedCourses, currentClassificationCatalog);
  const currentClassificationApplied = currentClassificationEvidence.level === "strong";
  const cohortEvidence = measureProgramEvidence(ruleAdjustedCourses, cohortCatalog);
  const programSignature = getKmouProgramIdentitySignature(rule.key.departmentId);
  const signatureEvidence = measureKmouProgramIdentity(ruleAdjustedCourses, rule.key.departmentId);
  const majorCourseCatalog = currentClassificationApplied
    ? currentClassificationCatalog
    : cohortEvidence.level === "strong" ? cohortCatalog : null;
  const usingProgramSignature = !majorCourseCatalog && signatureEvidence.level === "strong";
  const programEvidence = currentClassificationApplied
    ? currentClassificationEvidence
    : cohortEvidence.level === "strong" ? cohortEvidence : signatureEvidence;
  const majorEvaluationAvailable = programEvidence.level === "strong";
  const annotatedCourses = annotateMajorCourseMatches(
    ruleAdjustedCourses,
    majorCourseCatalog,
    cohortCatalog,
    programEvidence,
  );
  const passedCourses = dedupePassed(annotatedCourses);
  const selectedProgramMismatch = detectKnownProgramMismatch(passedCourses, rule.key.departmentId);
  const majorCreditEvaluationAvailable = majorEvaluationAvailable && !selectedProgramMismatch?.detected;
  const reportedEarned = new Map<CategoryKey, number>();
  for (const course of dedupePassed(ruleAdjustedCourses)) {
    if (course.categoryRecognition === "unrecognized") continue;
    reportedEarned.set(course.category, (reportedEarned.get(course.category) ?? 0) + course.credits);
  }
  const earned = new Map<CategoryKey, number>();
  for (const course of passedCourses) {
    if (course.categoryRecognition === "unrecognized") continue;
    if (isMajorCategory(course.category) && !["matched", "institution-recognized"].includes(course.majorCourseMatchStatus ?? "")) continue;
    earned.set(course.category, (earned.get(course.category) ?? 0) + course.credits);
  }
  const baseCategories = rule.credits.map((meta) => {
    const majorCategory = isMajorCategory(meta.key);
    const evaluationStatus = majorCategory && !majorCreditEvaluationAvailable ? "not-evaluable" as const : "evaluated" as const;
    return {
      ...meta,
      earned: evaluationStatus === "evaluated" ? earned.get(meta.key) ?? 0 : 0,
      reportedEarned: majorCategory ? reportedEarned.get(meta.key) ?? 0 : undefined,
      evaluationStatus,
      note: evaluationStatus === "not-evaluable"
        ? "성적표 표기 학점은 확인했지만 선택 전공을 뒷받침하는 과목코드 지문이 충분하지 않아 자동 인정하지 않았습니다."
        : undefined,
    };
  });
  const residualCreditResult = applyResidualFreeElectivePolicy(baseCategories);
  const categories = residualCreditResult.categories;
  const requiredResolution = resolveRequiredCourses(passedCourses, rule, majorCourseCatalog);
  const missingCourses = majorCreditEvaluationAvailable ? requiredResolution.confirmedMissing : [];
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
  );
  const overallStatus = courseMatch.status === "verified" && transcriptClassification.status === "verified" ? "evaluated" as const : "not-evaluable" as const;
  const applicableEarnedTotal = Math.max(0, earnedTotal - courseMatch.unmatchedCredits);
  const classifiedApplicableEarnedTotal = Math.max(0, applicableEarnedTotal - unclassifiedCredits);
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
    forecastCredits: overallStatus === "evaluated"
      ? minimumGraduationCreditShortage
      : Math.max(0, rule.requiredTotal - Math.max(0, earnedTotal - unclassifiedCredits)),
    generalEducation,
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
