import type { OfficialSource } from "./types";

const KMOU_SUPPORTED_ADMISSION_YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026] as const;

function uniqueYears(years: number[]): number[] {
  return [...new Set(years)].sort((a, b) => a - b);
}

function rangeFromSourceId(sourceId: string): [number, number] | null {
  const match = sourceId.match(/(?:^|\D)(20\d{2})-(20\d{2})(?:\D|$)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2])];
}

export function withRequirementSourceApplicability(
  source: OfficialSource,
  admissionYear: number,
): OfficialSource {
  if (source.role === "classification-reference") return source;
  if (source.role === "university-policy") {
    return {
      ...source,
      appliesToAdmissionYears: source.appliesToAdmissionYears ?? [...KMOU_SUPPORTED_ADMISSION_YEARS],
    };
  }

  const range = rangeFromSourceId(source.id);
  if (range && admissionYear >= range[0] && admissionYear <= range[1]) {
    return {
      ...source,
      role: "multi-year-requirement",
      appliesToAdmissionYears: source.appliesToAdmissionYears
        ?? Array.from({ length: range[1] - range[0] + 1 }, (_, index) => range[0] + index),
    };
  }

  return {
    ...source,
    role: source.role ?? "cohort-requirement",
    documentYear: source.documentYear ?? admissionYear,
    appliesToAdmissionYears: source.appliesToAdmissionYears ?? [admissionYear],
  };
}

export function assertRequirementSourcesApplicable(
  sources: OfficialSource[],
  admissionYear: number,
  departmentId?: string,
): OfficialSource[] {
  const deduped = sources.filter(
    (source, index, all) => all.findIndex((candidate) => candidate.id === source.id) === index,
  );

  for (const source of deduped) {
    if (source.role === "classification-reference") {
      throw new Error(`현행 과목분류 보조자료는 졸업요건 적용 원본에 포함할 수 없습니다: ${source.id}`);
    }
    if (source.appliesToAdmissionYears && !source.appliesToAdmissionYears.includes(admissionYear)) {
      throw new Error(`${source.id}는 ${admissionYear}학번 졸업요건에 적용할 수 없는 원본입니다.`);
    }
    if (source.role === "cohort-requirement" && source.documentYear !== undefined && source.documentYear !== admissionYear) {
      throw new Error(`${source.id}의 문서연도(${source.documentYear})와 입학학년도(${admissionYear})가 다릅니다.`);
    }
    if (departmentId && source.appliesToDepartmentIds && !source.appliesToDepartmentIds.includes(departmentId)) {
      throw new Error(`${source.id}는 ${departmentId} 졸업요건에 적용할 수 없는 학과 원본입니다.`);
    }
    if (departmentId && source.evidenceScope?.departmentId && source.evidenceScope.departmentId !== departmentId) {
      throw new Error(`${source.id}의 근거 학과(${source.evidenceScope.departmentId})와 선택 학과(${departmentId})가 다릅니다.`);
    }
  }

  return deduped.map((source) => ({
    ...source,
    appliesToAdmissionYears: source.appliesToAdmissionYears
      ? uniqueYears(source.appliesToAdmissionYears)
      : source.appliesToAdmissionYears,
  }));
}
