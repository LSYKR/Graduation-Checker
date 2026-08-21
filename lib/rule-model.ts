import type { CategoryKey, GeneralEducationRecognitionMode, MissingCourse, OfficialSource } from "./types";

export type StudentType = "freshman" | "transfer" | "international" | "exchange" | "other";
export type RuleLifecycleStatus = "draft" | "review" | "approved" | "retired";
export type GraduationGoal = "regular" | "early" | "bachelor-master";

export interface UniversityDefinition {
  id: string;
  name: string;
  officialDomains: string[];
  locale: string;
}

export interface DepartmentDefinition {
  id: string;
  universityId: string;
  name: string;
  aliases: string[];
  college?: string;
  activeFrom?: number;
  activeTo?: number;
}

export interface RuleSelector {
  universityId: string;
  admissionYear: number;
  departmentId: string;
  curriculumTrack?: string;
}

export interface CreditRequirement {
  key: CategoryKey;
  label: string;
  shortLabel: string;
  minimum: number;
  color: string;
  allowOverflow?: boolean;
}

export interface CourseRequirement extends MissingCourse {
  validFrom?: string;
  validTo?: string;
  appliesToStudentTypes?: StudentType[];
}

export interface CourseSubstitution {
  requiredCourseCode: string;
  substituteCourseCodes: string[];
  approvalRequired: boolean;
  categoryOverride?: CategoryKey;
  note?: string;
}

export interface CategoryOverride {
  courseCode: string;
  category: CategoryKey;
  reason: string;
}


export interface GeneralEducationCourseRef {
  code: string;
  name: string;
  credits: number;
  courseType: "required" | "elective";
}

export interface RuleEvidencePointer {
  requirementSourceId: string;
  courseCatalogSourceId?: string;
  page?: number;
  sheet?: string;
  cellRange?: string;
  matchPolicy?: "exact-course-code";
}

export interface GeneralEducationAreaRequirement {
  id: string;
  label: string;
  parentArea: string;
  creditCategory?: Extract<CategoryKey, "generalRequired" | "generalElective">;
  minimumCredits: number;
  eligibleCourses: GeneralEducationCourseRef[];
  evidence: RuleEvidencePointer;
}

export interface GeneralEducationCombinedRequirement {
  id: string;
  label: string;
  areaIds: string[];
  minimumCredits: number;
  evidence: RuleEvidencePointer;
}

export interface GeneralEducationRecognitionRule {
  id: string;
  courseCode: string;
  courseName: string;
  credits: number;
  targetAreaId: string;
  mode: Exclude<GeneralEducationRecognitionMode, "direct">;
  categoryEffect: "area-only";
  acceptedTranscriptKinds: Array<"completed" | "transfer-recognized">;
  sourceCategory?: string;
  evidence: {
    sourceId: string;
    sheet: string;
    cellRange: string;
    note: string;
  };
}

export interface GeneralEducationRecognitionOverlay {
  schemaVersion: "1.0.0";
  id: string;
  version: string;
  status: "review" | "verified-final";
  selector: RuleSelector;
  matchPolicy: "exact-course-code-only";
  rules: GeneralEducationRecognitionRule[];
  source: OfficialSource & { fileName: string };
  verifiedAt: string;
  notes: string[];
}

export interface CertificationRequirement {
  id: string;
  label: string;
  kind: "language" | "volunteer" | "certificate" | "internship" | "portfolio" | "other";
  minimum?: number;
  unit?: string;
  acceptedValues?: string[];
  oneOfGroup?: string;
  note?: string;
}

export interface EligibilityRule {
  goal: GraduationGoal;
  eligibleStudentTypes: StudentType[];
  minimumGpa?: number;
  minimumEarnedCredits?: number;
  note?: string;
}

export interface GraduationRuleSet {
  id: string;
  version: string;
  status: RuleLifecycleStatus;
  selector: RuleSelector;
  effectiveFrom: string;
  effectiveTo?: string;
  requiredTotalCredits: number;
  creditRequirements: CreditRequirement[];
  requiredCourses: CourseRequirement[];
  substitutions: CourseSubstitution[];
  categoryOverrides: CategoryOverride[];
  generalEducationAreas: GeneralEducationAreaRequirement[];
  generalEducationCombinedRequirements: GeneralEducationCombinedRequirement[];
  certifications: CertificationRequirement[];
  eligibilityRules: EligibilityRule[];
  sources: OfficialSource[];
  notes: string[];
  approvedAt?: string;
  approvedBy?: string;
}

export interface TransferPolicyOverlay {
  id: string;
  version: string;
  status: RuleLifecycleStatus;
  selector: {
    universityId: string;
    transferEntryYear: number;
    studentType: "transfer";
  };
  curriculumResolution: {
    policy: "same-grade-cohort-at-transfer";
    entryGrade: number;
    resolvedCurriculumYear: number;
    sourceDocumentId: string;
    sourcePages: number[];
  };
  creditRecognition: {
    source: "transcript-recognized-rows";
    semesterLabel: string;
    requiresSingleRecognitionYear: boolean;
    maximumRecognizedFraction: number;
    minimumHostSemesters: number;
    earlyGraduationAllowed: boolean;
    unmatchedCreditsMayBeRecognizedAs: "freeElective";
    missingRequiredCoursesMustBeCompleted: boolean;
    departmentReviewRequired: boolean;
    sourceDocumentId: string;
    sourcePages: number[];
  };
  composition: {
    graduationRuleSelector: RuleSelector;
    principle: "shared-curriculum-rule-plus-recognized-credits";
    separateTransferGraduationRule: false;
  };
  sources: OfficialSource[];
  notes: string[];
}


export interface RuleChange {
  severity: "breaking" | "warning" | "info";
  code: string;
  path: string;
  before?: string | number | boolean;
  after?: string | number | boolean;
  message: string;
}

export interface RuleValidationIssue {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  path?: string;
}

const REQUIRED_SELECTOR_FIELDS: Array<keyof RuleSelector> = [
  "universityId",
  "admissionYear",
  "departmentId",
];

export function validateRuleSet(ruleSet: GraduationRuleSet): RuleValidationIssue[] {
  const issues: RuleValidationIssue[] = [];

  for (const field of REQUIRED_SELECTOR_FIELDS) {
    if (ruleSet.selector[field] === undefined || ruleSet.selector[field] === "") {
      issues.push({ severity: "error", code: "MISSING_SELECTOR", message: `selector.${field} 값이 필요합니다.`, path: `selector.${field}` });
    }
  }

  if (!ruleSet.id || !ruleSet.version) {
    issues.push({ severity: "error", code: "MISSING_IDENTITY", message: "규칙셋 id와 version이 필요합니다." });
  }
  if (ruleSet.requiredTotalCredits <= 0) {
    issues.push({ severity: "error", code: "INVALID_TOTAL", message: "총 졸업학점은 0보다 커야 합니다.", path: "requiredTotalCredits" });
  }

  const keys = new Set<string>();
  let minimumSum = 0;
  for (const [index, requirement] of ruleSet.creditRequirements.entries()) {
    minimumSum += requirement.minimum;
    if (keys.has(requirement.key)) {
      issues.push({ severity: "error", code: "DUPLICATE_AREA", message: `${requirement.key} 영역이 중복되었습니다.`, path: `creditRequirements.${index}` });
    }
    keys.add(requirement.key);
    if (requirement.minimum < 0) {
      issues.push({ severity: "error", code: "NEGATIVE_CREDIT", message: `${requirement.label} 최소학점이 음수입니다.`, path: `creditRequirements.${index}.minimum` });
    }
  }

  if (minimumSum > ruleSet.requiredTotalCredits) {
    issues.push({
      severity: "warning",
      code: "AREA_SUM_EXCEEDS_TOTAL",
      message: `영역별 최소학점 합계(${minimumSum})가 총 졸업학점(${ruleSet.requiredTotalCredits})보다 큽니다. 중복 인정 규칙인지 확인하세요.`,
    });
  }

  const requiredCodes = new Set<string>();
  for (const [index, course] of ruleSet.requiredCourses.entries()) {
    const code = course.code.toUpperCase();
    if (requiredCodes.has(code)) {
      issues.push({ severity: "error", code: "DUPLICATE_REQUIRED_COURSE", message: `${course.code} 필수과목이 중복되었습니다.`, path: `requiredCourses.${index}` });
    }
    requiredCodes.add(code);
  }

  for (const [index, substitution] of ruleSet.substitutions.entries()) {
    if (!requiredCodes.has(substitution.requiredCourseCode.toUpperCase())) {
      issues.push({
        severity: "warning",
        code: "ORPHAN_SUBSTITUTION",
        message: `${substitution.requiredCourseCode} 대체 규칙의 원 필수과목이 requiredCourses에 없습니다.`,
        path: `substitutions.${index}`,
      });
    }
  }

  const generalAreaIds = new Set<string>();
  for (const [index, area] of ruleSet.generalEducationAreas.entries()) {
    if (generalAreaIds.has(area.id)) {
      issues.push({ severity: "error", code: "DUPLICATE_GENERAL_EDUCATION_AREA", message: `${area.id} 교양 세부영역이 중복되었습니다.`, path: `generalEducationAreas.${index}` });
    }
    generalAreaIds.add(area.id);
    if (area.minimumCredits < 0) {
      issues.push({ severity: "error", code: "NEGATIVE_GENERAL_EDUCATION_MINIMUM", message: `${area.label} 최소학점이 음수입니다.`, path: `generalEducationAreas.${index}.minimumCredits` });
    }
    if (area.minimumCredits > 0 && area.eligibleCourses.length === 0) {
      issues.push({ severity: "error", code: "EMPTY_GENERAL_EDUCATION_COURSE_MAP", message: `${area.label} 영역에 공식 인정 과목코드가 없습니다.`, path: `generalEducationAreas.${index}.eligibleCourses` });
    }
    const courseCodes = new Set<string>();
    for (const [courseIndex, course] of area.eligibleCourses.entries()) {
      const code = course.code.toUpperCase();
      if (courseCodes.has(code)) {
        issues.push({ severity: "error", code: "DUPLICATE_GENERAL_EDUCATION_COURSE", message: `${area.label} 영역의 ${course.code} 과목코드가 중복되었습니다.`, path: `generalEducationAreas.${index}.eligibleCourses.${courseIndex}` });
      }
      courseCodes.add(code);
    }
    if (ruleSet.status === "approved" && area.evidence.matchPolicy !== "exact-course-code") {
      issues.push({ severity: "error", code: "UNSAFE_GENERAL_EDUCATION_MATCH_POLICY", message: `${area.label} 영역은 과목코드 정확 일치 정책이어야 합니다.`, path: `generalEducationAreas.${index}.evidence.matchPolicy` });
    }
  }

  for (const [index, combined] of ruleSet.generalEducationCombinedRequirements.entries()) {
    if (!combined.areaIds.length) {
      issues.push({ severity: "error", code: "EMPTY_COMBINED_GENERAL_EDUCATION_REQUIREMENT", message: `${combined.label} 결합 규칙에 영역이 없습니다.`, path: `generalEducationCombinedRequirements.${index}.areaIds` });
    }
    for (const areaId of combined.areaIds) {
      if (!generalAreaIds.has(areaId)) {
        issues.push({ severity: "error", code: "UNKNOWN_GENERAL_EDUCATION_AREA", message: `${combined.label} 결합 규칙이 존재하지 않는 ${areaId} 영역을 참조합니다.`, path: `generalEducationCombinedRequirements.${index}.areaIds` });
      }
    }
  }

  if (!ruleSet.sources.length) {
    issues.push({ severity: "error", code: "MISSING_SOURCE", message: "최소 1개의 공식 출처가 필요합니다.", path: "sources" });
  }
  for (const [index, source] of ruleSet.sources.entries()) {
    if (!source.url || !source.url.startsWith("https://")) {
      issues.push({ severity: "error", code: "INVALID_SOURCE_URL", message: `${source.title || "출처"} URL이 올바르지 않습니다.`, path: `sources.${index}.url` });
    }
    if (ruleSet.status === "approved" && !source.documentVersionId && !source.fileHash) {
      issues.push({ severity: "error", code: "UNPINNED_SOURCE", message: `${source.title} 출처가 저장된 원본 파일 버전에 고정되지 않았습니다.`, path: `sources.${index}` });
    }
  }

  if (ruleSet.status === "approved" && (!ruleSet.approvedAt || !ruleSet.approvedBy)) {
    issues.push({ severity: "error", code: "MISSING_APPROVAL_AUDIT", message: "승인 규칙셋에는 approvedAt과 approvedBy를 남기는 것이 좋습니다." });
  }

  return issues;
}

export function selectorKey(selector: RuleSelector): string {
  return [selector.universityId, selector.admissionYear, selector.departmentId, selector.curriculumTrack ?? "default"].join(":");
}

export function transferOverlayKey(overlay: TransferPolicyOverlay): string {
  return [overlay.selector.universityId, overlay.selector.transferEntryYear, overlay.selector.studentType].join(":");
}

export function validateTransferPolicyOverlay(overlay: TransferPolicyOverlay): RuleValidationIssue[] {
  const issues: RuleValidationIssue[] = [];
  if (!overlay.id || !overlay.version) {
    issues.push({ severity: "error", code: "MISSING_OVERLAY_IDENTITY", message: "편입 정책 오버레이 id와 version이 필요합니다." });
  }
  if (overlay.selector.studentType !== "transfer") {
    issues.push({ severity: "error", code: "INVALID_OVERLAY_STUDENT_TYPE", message: "편입 정책 오버레이는 transfer 학생에게만 적용합니다.", path: "selector.studentType" });
  }
  if (!Number.isInteger(overlay.selector.transferEntryYear) || overlay.selector.transferEntryYear < 1900) {
    issues.push({ severity: "error", code: "INVALID_TRANSFER_ENTRY_YEAR", message: "편입 처리 연도가 올바르지 않습니다.", path: "selector.transferEntryYear" });
  }
  if (overlay.composition.separateTransferGraduationRule !== false || overlay.composition.principle !== "shared-curriculum-rule-plus-recognized-credits") {
    issues.push({ severity: "error", code: "INVALID_COMPOSITION_MODEL", message: "편입생은 공통 교육과정 규칙과 개인별 인정학점을 합성해야 합니다.", path: "composition" });
  }
  const recognition = overlay.creditRecognition;
  if (recognition.maximumRecognizedFraction <= 0 || recognition.maximumRecognizedFraction > 1) {
    issues.push({ severity: "error", code: "INVALID_TRANSFER_RECOGNITION_LIMIT", message: "편입 인정학점 비율은 0 초과 1 이하여야 합니다.", path: "creditRecognition.maximumRecognizedFraction" });
  }
  if (!Number.isInteger(recognition.minimumHostSemesters) || recognition.minimumHostSemesters <= 0) {
    issues.push({ severity: "error", code: "INVALID_TRANSFER_MINIMUM_SEMESTERS", message: "편입생의 본교 최소 이수학기는 양의 정수여야 합니다.", path: "creditRecognition.minimumHostSemesters" });
  }
  const sourceIds = new Set(overlay.sources.map((source) => source.id));
  for (const sourceId of [overlay.curriculumResolution.sourceDocumentId, recognition.sourceDocumentId]) {
    if (!sourceIds.has(sourceId)) {
      issues.push({ severity: "error", code: "MISSING_OVERLAY_SOURCE", message: `${sourceId} 근거가 오버레이 sources에 없습니다.`, path: "sources" });
    }
  }
  if (overlay.status === "approved") {
    for (const source of overlay.sources) {
      if (!source.fileHash && !source.documentVersionId) {
        issues.push({ severity: "error", code: "UNPINNED_OVERLAY_SOURCE", message: `${source.title} 출처가 저장 원본에 고정되지 않았습니다.`, path: "sources" });
      }
    }
  }
  return issues;
}


export function compareRuleSets(previous: GraduationRuleSet, next: GraduationRuleSet): RuleChange[] {
  const changes: RuleChange[] = [];
  const previousSelector = selectorKey(previous.selector);
  const nextSelector = selectorKey(next.selector);
  if (previousSelector !== nextSelector) {
    changes.push({
      severity: "breaking",
      code: "SELECTOR_CHANGED",
      path: "selector",
      before: previousSelector,
      after: nextSelector,
      message: "규칙 선택키가 달라 동일 규칙의 새 버전으로 등록할 수 없습니다.",
    });
    return changes;
  }

  if (previous.requiredTotalCredits !== next.requiredTotalCredits) {
    changes.push({
      severity: "breaking",
      code: "TOTAL_CREDITS_CHANGED",
      path: "requiredTotalCredits",
      before: previous.requiredTotalCredits,
      after: next.requiredTotalCredits,
      message: `총 졸업학점이 ${previous.requiredTotalCredits}에서 ${next.requiredTotalCredits}(으)로 변경되었습니다.`,
    });
  }

  const previousAreas = new Map(previous.creditRequirements.map((item) => [item.key, item]));
  const nextAreas = new Map(next.creditRequirements.map((item) => [item.key, item]));
  for (const [key, area] of nextAreas) {
    const old = previousAreas.get(key);
    if (!old) {
      changes.push({ severity: "warning", code: "AREA_ADDED", path: `creditRequirements.${key}`, after: area.minimum, message: `${area.label} 영역이 새로 추가되었습니다.` });
    } else if (old.minimum !== area.minimum) {
      const delta = area.minimum - old.minimum;
      changes.push({
        severity: Math.abs(delta) >= 6 ? "breaking" : "warning",
        code: "AREA_MINIMUM_CHANGED",
        path: `creditRequirements.${key}.minimum`,
        before: old.minimum,
        after: area.minimum,
        message: `${area.label} 최소학점이 ${old.minimum}에서 ${area.minimum}(으)로 변경되었습니다.`,
      });
    }
  }
  for (const [key, area] of previousAreas) {
    if (!nextAreas.has(key)) changes.push({ severity: "breaking", code: "AREA_REMOVED", path: `creditRequirements.${key}`, before: area.minimum, message: `${area.label} 영역이 제거되었습니다.` });
  }

  const previousGeneralAreas = new Map(previous.generalEducationAreas.map((area) => [area.id, area]));
  const nextGeneralAreas = new Map(next.generalEducationAreas.map((area) => [area.id, area]));
  for (const [id, area] of nextGeneralAreas) {
    const old = previousGeneralAreas.get(id);
    if (!old) {
      changes.push({ severity: "warning", code: "GENERAL_EDUCATION_AREA_ADDED", path: `generalEducationAreas.${id}`, after: area.minimumCredits, message: `${area.label} 교양 세부영역이 추가되었습니다.` });
      continue;
    }
    if (old.minimumCredits !== area.minimumCredits) {
      changes.push({ severity: "breaking", code: "GENERAL_EDUCATION_MINIMUM_CHANGED", path: `generalEducationAreas.${id}.minimumCredits`, before: old.minimumCredits, after: area.minimumCredits, message: `${area.label} 최소학점이 ${old.minimumCredits}에서 ${area.minimumCredits}(으)로 변경되었습니다.` });
    }
    const oldCodes = [...new Set(old.eligibleCourses.map((course) => course.code.toUpperCase()))].sort().join(",");
    const nextCodes = [...new Set(area.eligibleCourses.map((course) => course.code.toUpperCase()))].sort().join(",");
    if (oldCodes !== nextCodes) {
      changes.push({ severity: "warning", code: "GENERAL_EDUCATION_COURSE_MAP_CHANGED", path: `generalEducationAreas.${id}.eligibleCourses`, message: `${area.label} 공식 인정 과목코드 목록이 변경되었습니다.` });
    }
  }
  for (const [id, area] of previousGeneralAreas) {
    if (!nextGeneralAreas.has(id)) {
      changes.push({ severity: "breaking", code: "GENERAL_EDUCATION_AREA_REMOVED", path: `generalEducationAreas.${id}`, before: area.minimumCredits, message: `${area.label} 교양 세부영역이 제거되었습니다.` });
    }
  }

  if (JSON.stringify(previous.generalEducationCombinedRequirements) !== JSON.stringify(next.generalEducationCombinedRequirements)) {
    changes.push({ severity: "warning", code: "GENERAL_EDUCATION_COMBINED_REQUIREMENTS_CHANGED", path: "generalEducationCombinedRequirements", message: "교양 세부영역 결합 최소학점 규칙이 변경되었습니다." });
  }

  const previousCourses = new Map(previous.requiredCourses.map((course) => [course.code.toUpperCase(), course]));
  const nextCourses = new Map(next.requiredCourses.map((course) => [course.code.toUpperCase(), course]));
  for (const [code, course] of nextCourses) {
    if (!previousCourses.has(code)) changes.push({ severity: "warning", code: "REQUIRED_COURSE_ADDED", path: `requiredCourses.${code}`, after: course.name, message: `${course.name}(${course.code})이 필수과목으로 추가되었습니다.` });
  }
  for (const [code, course] of previousCourses) {
    if (!nextCourses.has(code)) changes.push({ severity: "breaking", code: "REQUIRED_COURSE_REMOVED", path: `requiredCourses.${code}`, before: course.name, message: `${course.name}(${course.code}) 필수 규칙이 제거되었습니다.` });
  }

  const previousSubstitutions = JSON.stringify(previous.substitutions);
  const nextSubstitutions = JSON.stringify(next.substitutions);
  if (previousSubstitutions !== nextSubstitutions) {
    changes.push({ severity: "warning", code: "SUBSTITUTIONS_CHANGED", path: "substitutions", message: "대체과목 규칙이 변경되었습니다. 학과 승인 근거를 확인하세요." });
  }

  return changes;
}
