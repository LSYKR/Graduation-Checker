import readiness2020 from "@/data/rule-candidates/kmou/major-curriculum-readiness-2020.json";
import readiness2021 from "@/data/rule-candidates/kmou/major-curriculum-readiness-2021.json";
import readiness2022 from "@/data/rule-candidates/kmou/major-curriculum-readiness-2022.json";
import readiness2023 from "@/data/rule-candidates/kmou/major-curriculum-readiness-2023.json";
import readiness2024 from "@/data/rule-candidates/kmou/major-curriculum-readiness-2024.json";
import readiness2025 from "@/data/rule-candidates/kmou/major-curriculum-readiness-2025.json";
import readiness2026 from "@/data/rule-candidates/kmou/major-curriculum-readiness-2026.json";
import type { MajorCourseCatalog, OfficialSource, RuleKey } from "./types";

export type MajorCurriculumReadinessStatus =
  | "exact-catalog"
  | "partial-required-courses"
  | "source-needed";

export interface MajorCurriculumReadinessRecord {
  admissionYear: number;
  programId: string;
  status: MajorCurriculumReadinessStatus;
  courseCount?: number;
  requiredCourseCount?: number;
  requiredCourseSetStatus?: "verified" | "review";
}

const rawReadinessFiles = [readiness2020, readiness2021, readiness2022, readiness2023, readiness2024, readiness2025, readiness2026] as Array<{
  admissionYear: number;
  records: Array<Omit<MajorCurriculumReadinessRecord, "admissionYear">>;
}>;

export const MAJOR_CURRICULUM_READINESS: MajorCurriculumReadinessRecord[] = rawReadinessFiles.flatMap((raw) =>
  raw.records.map((record) => ({ ...record, admissionYear: raw.admissionYear })),
);

const readinessByKey = new Map(
  MAJOR_CURRICULUM_READINESS.map((record) => [`kmou:${record.admissionYear}:${record.programId}`, record]),
);

export function getMajorCurriculumReadiness(key: Pick<RuleKey, "universityId" | "admissionYear" | "departmentId">): MajorCurriculumReadinessRecord | null {
  return readinessByKey.get(`${key.universityId}:${key.admissionYear}:${key.departmentId}`) ?? null;
}

function normalizeHash(value: string | undefined): string {
  return (value ?? "").replace(/^sha256:/i, "").toLowerCase();
}

function isOfficialKmouUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "kmou.ac.kr" || host.endsWith(".kmou.ac.kr");
  } catch {
    return false;
  }
}

function validateCatalogSource(source: OfficialSource | undefined, key: RuleKey): string[] {
  if (!source) return ["상세 전공표의 주 원본을 찾을 수 없습니다."];
  const errors: string[] = [];
  if (!isOfficialKmouUrl(source.url)) errors.push("상세 전공표 URL이 학교 공식 도메인이 아닙니다.");
  if (!/^[a-f0-9]{64}$/.test(normalizeHash(source.fileHash))) errors.push("상세 전공표의 로컬 SHA-256이 없습니다.");
  if (source.role !== "cohort-requirement") errors.push("상세 전공표가 입학학번 졸업요건 원본으로 고정되지 않았습니다.");
  if (source.documentYear !== key.admissionYear) errors.push("상세 전공표 문서연도와 입학학번이 다릅니다.");
  if (!source.appliesToAdmissionYears?.includes(key.admissionYear)) errors.push("상세 전공표의 적용 학번이 규칙 키와 다릅니다.");
  if (!source.appliesToDepartmentIds?.includes(key.departmentId)) errors.push("상세 전공표의 적용 전공이 규칙 키와 다릅니다.");
  if (source.evidenceScope?.departmentId !== key.departmentId) errors.push("상세 전공표의 근거 위치가 선택 전공에 고정되지 않았습니다.");
  if (!source.evidenceScope?.locator?.trim()) errors.push("상세 전공표의 시트·쪽·표 위치가 없습니다.");
  return errors;
}

export function validateMajorCourseCatalogForActivation(
  key: RuleKey,
  catalog: MajorCourseCatalog,
  ruleSources: OfficialSource[] = [],
): string[] {
  const errors: string[] = [];
  if (key.universityId !== "kmou") errors.push("현재 상세 전공표 검증기는 한국해양대학교 키만 허용합니다.");
  if (catalog.matchPolicy !== "exact-course-code") errors.push("전공과목은 교과목번호 정확 일치 방식이어야 합니다.");
  if (!catalog.entries.length) errors.push("상세 전공표에 과목이 없습니다.");

  const allSources = [...ruleSources, ...(catalog.sources ?? [])];
  const primarySource = allSources.find((source) => source.id === catalog.sourceId);
  errors.push(...validateCatalogSource(primarySource, key));

  const seen = new Set<string>();
  for (const entry of catalog.entries) {
    const code = entry.code?.trim().toUpperCase();
    if (!code) errors.push("과목코드가 없는 전공과목은 활성화할 수 없습니다.");
    else if (seen.has(code)) errors.push(`전공과목 코드가 중복되었습니다: ${code}`);
    else seen.add(code);
    if (!entry.name?.trim()) errors.push(`${code || "코드 없음"} 과목명이 비어 있습니다.`);
    if (!Number.isFinite(entry.credits) || entry.credits <= 0) errors.push(`${entry.name || code || "전공과목"} 학점이 올바르지 않습니다.`);
    if (!new Set(["majorFoundation", "majorRequired", "majorElective"]).has(entry.category)) {
      errors.push(`${entry.name || code || "전공과목"} 이수구분이 올바르지 않습니다.`);
    }
  }
  return [...new Set(errors)];
}

export function isMajorCourseCatalogActivatable(
  key: RuleKey,
  catalog: MajorCourseCatalog,
  ruleSources: OfficialSource[] = [],
): boolean {
  return validateMajorCourseCatalogForActivation(key, catalog, ruleSources).length === 0;
}
