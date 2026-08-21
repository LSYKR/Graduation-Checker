import type { CategoryKey, GraduationRuleSet } from "./types";
import { validateMajorCourseCatalogForActivation } from "./major-curriculum-readiness";
const CATEGORY_KEYS = new Set<CategoryKey>([
  "generalRequired",
  "generalElective",
  "majorFoundation",
  "majorRequired",
  "majorElective",
  "freeElective",
]);
const MAJOR_CATEGORY_KEYS = new Set<CategoryKey>([
  "majorFoundation",
  "majorRequired",
  "majorElective",
]);
export function validateRuleSet(value: unknown): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== "object") return ["규칙셋은 객체여야 합니다."];
  const rule = value as Partial<GraduationRuleSet>;
  if (rule.schemaVersion !== "1.0")
    errors.push("schemaVersion은 1.0이어야 합니다.");
  if (!rule.version) errors.push("version이 필요합니다.");
  if (
    !rule.status ||
    !["draft", "reviewed", "provisional", "approved"].includes(rule.status)
  )
    errors.push("지원하지 않는 운영 규칙 상태입니다.");
  if (
    !rule.key?.universityId ||
    !rule.key.departmentId ||
    !rule.key.admissionYear
  )
    errors.push("학교·적용 교육과정·학과 키가 필요합니다.");
  const legacyKey = rule.key as typeof rule.key & {
    studentType?: string;
    transferEntryYear?: number;
  };
  if (
    legacyKey.studentType !== undefined ||
    legacyKey.transferEntryYear !== undefined
  )
    errors.push(
      "공통 졸업요건 규칙 키에는 학생유형이나 편입 처리 연도를 둘 수 없습니다.",
    );
  if (!Number.isFinite(rule.requiredTotal) || Number(rule.requiredTotal) <= 0)
    errors.push("총 졸업학점은 양수여야 합니다.");
  if (!Array.isArray(rule.credits) || !rule.credits.length)
    errors.push("영역별 학점 기준이 필요합니다.");
  for (const item of rule.credits ?? []) {
    if (!CATEGORY_KEYS.has(item.key))
      errors.push(`지원하지 않는 영역 키: ${item.key}`);
    if (!Number.isFinite(item.required) || item.required < 0)
      errors.push(`${item.label || item.key} 학점 기준이 잘못되었습니다.`);
  }
  if (!Array.isArray(rule.sources) || !rule.sources.length)
    errors.push("공식 출처가 최소 1개 필요합니다.");
  for (const source of rule.sources ?? []) {
    try {
      const url = new URL(source.url);
      if (url.protocol !== "https:")
        errors.push(`${source.title} 출처는 HTTPS여야 합니다.`);
    } catch {
      errors.push(`${source.title || "출처"} URL이 잘못되었습니다.`);
    }
    if (
      ["approved", "provisional"].includes(rule.status ?? "") &&
      !source.fileHash &&
      !source.documentVersionId
    )
      errors.push(
        `${source.title || "출처"} 원본 해시 또는 문서 버전이 필요합니다.`,
      );
    if (source.role === "classification-reference")
      errors.push(`${source.title || source.id}는 과목분류 보조자료이므로 졸업요건 적용 원본에 둘 수 없습니다.`);
    if (rule.key?.admissionYear && source.appliesToAdmissionYears
      && !source.appliesToAdmissionYears.includes(rule.key.admissionYear))
      errors.push(`${source.title || source.id}는 ${rule.key.admissionYear}학번 적용 원본이 아닙니다.`);
    if (rule.key?.admissionYear && source.role === "cohort-requirement"
      && source.documentYear !== undefined && source.documentYear !== rule.key.admissionYear)
      errors.push(`${source.title || source.id}의 문서연도와 입학학년도가 다릅니다.`);
    if (rule.key?.departmentId && source.appliesToDepartmentIds
      && !source.appliesToDepartmentIds.includes(rule.key.departmentId))
      errors.push(`${source.title || source.id}는 ${rule.key.departmentId} 적용 원본이 아닙니다.`);
    if (rule.key?.departmentId && source.evidenceScope?.departmentId
      && source.evidenceScope.departmentId !== rule.key.departmentId)
      errors.push(`${source.title || source.id}의 근거 학과와 규칙 학과가 다릅니다.`);
    if (source.documentScope === "program-row" && rule.key?.departmentId) {
      if (!source.appliesToDepartmentIds?.includes(rule.key.departmentId))
        errors.push(`${source.title || source.id}의 적용 학과 범위가 고정되지 않았습니다.`);
      if (source.evidenceScope?.departmentId !== rule.key.departmentId)
        errors.push(`${source.title || source.id}의 학과별 근거 위치가 고정되지 않았습니다.`);
    }
  }
  if (
    rule.status === "provisional" &&
    rule.assurance?.overall !== "provisional"
  )
    errors.push("임시 승인 규칙에는 provisional assurance가 필요합니다.");
  if (!Array.isArray(rule.evidence) || !rule.evidence.length)
    errors.push("검색 가능한 근거 청크가 필요합니다.");
  if (rule.majorCourseCatalog) {
    const catalog = rule.majorCourseCatalog;
    if (rule.key) errors.push(...validateMajorCourseCatalogForActivation(rule.key, catalog, rule.sources ?? []));
    if (catalog.status !== "verified" && catalog.status !== "review")
      errors.push("전공 교육과정표 상태가 잘못되었습니다.");
    if (catalog.matchPolicy !== "exact-course-code")
      errors.push("전공과목은 교과목번호 정확 일치 정책만 사용할 수 있습니다.");
    if (catalog.requiredCourseSetStatus !== "verified" && catalog.requiredCourseSetStatus !== "review")
      errors.push("전공필수 전체 목록의 검수 상태가 필요합니다.");
    if (!(rule.sources ?? []).some((source) => source.id === catalog.sourceId))
      errors.push("전공 교육과정표가 참조한 공식 출처를 규칙에서 찾을 수 없습니다.");
    if (!Array.isArray(catalog.entries) || !catalog.entries.length)
      errors.push("전공 교육과정표에는 과목이 최소 1개 필요합니다.");
    const courseCodes = new Set<string>();
    for (const entry of catalog.entries ?? []) {
      const code = entry.code?.trim().toUpperCase();
      if (!code) errors.push("전공과목 교과목번호가 비어 있습니다.");
      else if (courseCodes.has(code)) errors.push(`전공과목 교과목번호가 중복되었습니다: ${code}`);
      else courseCodes.add(code);
      if (!MAJOR_CATEGORY_KEYS.has(entry.category))
        errors.push(`전공 교육과정표에 지원하지 않는 이수구분이 있습니다: ${entry.category}`);
      if (!Number.isFinite(entry.credits) || entry.credits < 0)
        errors.push(`${entry.name || code} 학점이 잘못되었습니다.`);
    }
    if (catalog.requiredCourseSetStatus === "verified") {
      for (const category of ["majorFoundation", "majorRequired"] as const) {
        const requiredEntryCredits = catalog.entries
          .filter((entry) => entry.required && entry.category === category)
          .reduce((sum, entry) => sum + entry.credits, 0);
        const catalogCredits = catalog.entries
          .filter((entry) => entry.category === category)
          .reduce((sum, entry) => sum + entry.credits, 0);
        const requirement = rule.credits?.find((item) => item.key === category)?.required;
        const mode = catalog.categoryRequirementModes?.[category] ?? "all-listed";
        if (mode === "minimum-from-pool") {
          if (requirement === undefined || catalogCredits < requirement || requiredEntryCredits > requirement) {
            errors.push(`${category} 선택 과목 풀(${catalogCredits})·개별필수(${requiredEntryCredits})와 편제 최소학점(${requirement ?? "없음"})을 조정할 수 없습니다.`);
          }
        } else if (requirement !== requiredEntryCredits) {
          errors.push(`${category} 필수과목 합계(${requiredEntryCredits})와 편제 최소학점(${requirement ?? "없음"})이 다릅니다.`);
        }
      }
    }
  }
  return [...new Set(errors)];
}
export function assertValidRuleSet(
  value: unknown,
): asserts value is GraduationRuleSet {
  const errors = validateRuleSet(value);
  if (errors.length)
    throw new Error(`졸업요건 규칙 검증 실패: ${errors.join(" / ")}`);
}
