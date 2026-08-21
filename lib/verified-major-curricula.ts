import computerEngineering2022Catalog from "@/data/course-catalogs/kmou/2022/computer-engineering/1.0.0.json";
import computerEngineering2022CurrentClassification from "@/data/course-catalogs/kmou/2022/computer-engineering/current-classification-2024/1.0.0.json";
import electronicCommunicationsEngineering2022Catalog from "@/data/course-catalogs/kmou/2022/electronic-communications-engineering/1.0.0.json";
import intelligentControlSystemsEngineering2022Catalog from "@/data/course-catalogs/kmou/2022/intelligent-control-systems-engineering/1.0.0.json";
import radioConvergenceEngineering2022Catalog from "@/data/course-catalogs/kmou/2022/radio-mobility-convergence-engineering/1.0.0.json";
import officialUniversityCatalogs2020 from "@/data/course-catalogs/kmou/2020/official-university-catalogs/1.0.0.json";
import officialUniversityCatalogs2021 from "@/data/course-catalogs/kmou/2021/official-university-catalogs/1.0.0.json";
import officialUniversityCatalogs2022 from "@/data/course-catalogs/kmou/2022/official-university-catalogs/1.0.0.json";
import officialUniversityCatalogs2023 from "@/data/course-catalogs/kmou/2023/official-university-catalogs/1.0.0.json";
import officialUniversityCatalogs2024 from "@/data/course-catalogs/kmou/2024/official-university-catalogs/1.0.0.json";
import firstSemesterOverlay2025 from "@/data/course-overlays/kmou/2025/official-first-semester/1.0.0.json";
import firstSemesterOverlay2026 from "@/data/course-overlays/kmou/2026/official-first-semester/1.0.0.json";
import { detectKmouProgramSignatureMismatch } from "./kmou-program-signatures";
import { isMajorCourseCatalogActivatable } from "./major-curriculum-readiness";
import type {
  GraduationRuleSet,
  MajorCourseCatalogEntry,
  MajorCourseCatalog,
  MissingCourse,
  OfficialSource,
  ProgramProfileMismatch,
  TranscriptCourse,
} from "./types";

const computerEngineeringCatalog = computerEngineering2022Catalog as MajorCourseCatalog;
const computerEngineeringCurrentClassification = computerEngineering2022CurrentClassification as MajorCourseCatalog;
const electronicCommunicationsEngineeringCatalog = electronicCommunicationsEngineering2022Catalog as MajorCourseCatalog;
const intelligentControlSystemsEngineeringCatalog = intelligentControlSystemsEngineering2022Catalog as MajorCourseCatalog;
const radioConvergenceEngineeringCatalog = radioConvergenceEngineering2022Catalog as MajorCourseCatalog;
const generatedUniversityCatalogs = [
  officialUniversityCatalogs2020,
  officialUniversityCatalogs2021,
  officialUniversityCatalogs2022,
  officialUniversityCatalogs2023,
  officialUniversityCatalogs2024,
].flatMap((batch) => (batch as unknown as { catalogs: MajorCourseCatalog[] }).catalogs);

const verifiedCatalogs = new Map<string, MajorCourseCatalog>([
  ["kmou:2022:computer-engineering", computerEngineeringCatalog],
  ["kmou:2022:electronic-communications-engineering", electronicCommunicationsEngineeringCatalog],
  ["kmou:2022:intelligent-control-systems-engineering", intelligentControlSystemsEngineeringCatalog],
  ["kmou:2022:radio-mobility-convergence-engineering", radioConvergenceEngineeringCatalog],
  ...generatedUniversityCatalogs.map((catalog): [string, MajorCourseCatalog] => {
    const primarySource = catalog.sources?.find((source) => source.id === catalog.sourceId);
    const departmentId = primarySource?.appliesToDepartmentIds?.[0];
    const admissionYear = primarySource?.appliesToAdmissionYears?.[0];
    if (!departmentId || !admissionYear) throw new Error(`${catalog.id}: 적용 학번·전공 키가 없습니다.`);
    return [`kmou:${admissionYear}:${departmentId}`, catalog];
  }),
]);

const currentClassificationCatalogs = new Map<string, MajorCourseCatalog>([
  ["kmou:2022:computer-engineering", computerEngineeringCurrentClassification],
]);

export interface VerifiedRequiredCourseOverlay {
  courses: MissingCourse[];
  classificationEntries: MajorCourseCatalogEntry[];
  sources: OfficialSource[];
  policy: string;
  verifiedScope: string;
  completeness: "partial";
}

interface FirstSemesterOverlayBatch {
  admissionYear: number;
  policy: string;
  source: {
    documentId: string;
    title: string;
    organization: string;
    updatedAt: string;
    attachmentUrl: string;
    fileHash: string;
  };
  records: Array<{
    programId: string;
    displayName: string;
    page: number;
    entries: Array<Pick<MajorCourseCatalogEntry, "code" | "name" | "category" | "credits">>;
  }>;
}

const firstSemesterOverlayBatches = [firstSemesterOverlay2025, firstSemesterOverlay2026] as unknown as FirstSemesterOverlayBatch[];

const verifiedRequiredCourseOverlays = new Map<string, VerifiedRequiredCourseOverlay>(
  firstSemesterOverlayBatches.flatMap((batch) => batch.records.map((record): [string, VerifiedRequiredCourseOverlay] => {
    const classificationEntries: MajorCourseCatalogEntry[] = record.entries.map((entry) => ({
      ...entry,
      required: entry.category === "majorRequired",
      recommendedYear: 1,
      recommendedSemester: 1,
    }));
    const source: OfficialSource = {
      id: `kmou-${batch.admissionYear}-${record.programId}-first-semester-major-courses`,
      documentId: batch.source.documentId,
      title: `${batch.source.title} · ${record.displayName}`,
      organization: batch.source.organization,
      updatedAt: batch.source.updatedAt,
      url: batch.source.attachmentUrl,
      fileHash: batch.source.fileHash,
      documentVersionId: `${batch.source.documentId}@${batch.source.fileHash.replace(/^sha256:/, "").slice(0, 12)}`,
      role: "cohort-requirement",
      documentYear: batch.admissionYear,
      appliesToAdmissionYears: [batch.admissionYear],
      appliesToDepartmentIds: [record.programId],
      documentScope: "program-row",
      evidenceScope: {
        departmentId: record.programId,
        departmentName: record.displayName,
        locator: `${record.page}쪽 '${record.displayName}' 신입생 1학기 표`,
        page: record.page,
      },
    };
    return [`kmou:${batch.admissionYear}:${record.programId}`, {
      courses: classificationEntries
        .filter((entry) => entry.category === "majorRequired")
        .map((entry) => ({
          code: entry.code,
          name: entry.name,
          credits: entry.credits,
          category: "전공필수",
          priority: "필수",
          note: `${batch.admissionYear}학년도 신입생 1학기 공식표에서 전공필수로 명시`,
        })),
      classificationEntries,
      sources: [source],
      policy: batch.policy,
      verifiedScope: `${batch.admissionYear}학년도 ${record.displayName} 신입생 1학기 전공 교과목 코드·이수구분(부분 범위)`,
      completeness: "partial",
    }];
  })),
);

function keyOf(rule: GraduationRuleSet): string {
  return `${rule.key.universityId}:${rule.key.admissionYear}:${rule.key.departmentId}`;
}

export function getBundledMajorCourseCatalog(key: {
  universityId: string;
  admissionYear: number;
  departmentId: string;
}): MajorCourseCatalog | null {
  return verifiedCatalogs.get(`${key.universityId}:${key.admissionYear}:${key.departmentId}`) ?? null;
}

export function getVerifiedMajorCourseCatalog(rule: GraduationRuleSet): MajorCourseCatalog | null {
  const embedded = rule.majorCourseCatalog;
  if (embedded?.status === "verified" && isMajorCourseCatalogActivatable(rule.key, embedded, rule.sources)) return embedded;
  const bundled = verifiedCatalogs.get(keyOf(rule));
  return bundled
    && rule.sources.some((source) => source.id === bundled.sourceId)
    && isMajorCourseCatalogActivatable(rule.key, bundled, [...rule.sources, ...(bundled.sources ?? [])])
    ? bundled
    : null;
}

export function getVerifiedRequiredCourseOverlay(key: {
  universityId: string;
  admissionYear: number;
  departmentId: string;
}): VerifiedRequiredCourseOverlay | null {
  return verifiedRequiredCourseOverlays.get(`${key.universityId}:${key.admissionYear}:${key.departmentId}`) ?? null;
}

export function getCurrentMajorClassificationCatalog(rule: GraduationRuleSet): MajorCourseCatalog | null {
  return currentClassificationCatalogs.get(keyOf(rule)) ?? null;
}

export function attachVerifiedMajorCourseCatalog(rule: GraduationRuleSet): GraduationRuleSet {
  const key = keyOf(rule);
  const catalog = verifiedCatalogs.get(key);
  const requiredCourseOverlay = verifiedRequiredCourseOverlays.get(key);
  if (!catalog && !requiredCourseOverlay) return rule;

  let updatedRule = rule;
  if (requiredCourseOverlay) {
    const requiredCourses = new Map(rule.requiredCourses.map((course) => [course.code.toUpperCase(), course]));
    for (const course of requiredCourseOverlay.courses) requiredCourses.set(course.code.toUpperCase(), course);
    const courseOverrides = new Map(rule.courseOverrides.map((override) => [override.courseCode.toUpperCase(), override]));
    for (const entry of requiredCourseOverlay.classificationEntries) {
      courseOverrides.set(entry.code.toUpperCase(), {
        courseCode: entry.code,
        category: entry.category,
        reason: "입학학년도의 공식 신입생 1학기 표에서 확인한 교과목번호·이수구분",
      });
    }
    const sources = new Map(rule.sources.map((source) => [source.id, source]));
    for (const source of requiredCourseOverlay.sources) sources.set(source.id, source);
    updatedRule = {
      ...rule,
      requiredCourses: [...requiredCourses.values()],
      courseOverrides: [...courseOverrides.values()],
      sources: [...sources.values()],
      policies: [...rule.policies, requiredCourseOverlay.policy],
      assurance: rule.assurance ? {
        ...rule.assurance,
        verifiedScopes: [...rule.assurance.verifiedScopes, requiredCourseOverlay.verifiedScope],
      } : rule.assurance,
    };
  }
  if (!catalog) return updatedRule;

  const catalogSources = catalog.sources ?? [];
  const hasPrimarySource = updatedRule.sources.some((source) => source.id === catalog.sourceId)
    || catalogSources.some((source) => source.id === catalog.sourceId);
  if (!hasPrimarySource) return updatedRule;

  if (!isMajorCourseCatalogActivatable(updatedRule.key, catalog, [...updatedRule.sources, ...catalogSources])) return updatedRule;

  const sources = new Map(updatedRule.sources.map((source) => [source.id, source]));
  for (const source of catalogSources) sources.set(source.id, source);
  return { ...updatedRule, sources: [...sources.values()], majorCourseCatalog: catalog };
}

export function detectKnownProgramMismatch(
  courses: TranscriptCourse[],
  selectedProgramId: string,
): ProgramProfileMismatch | undefined {
  const strongest = detectKmouProgramSignatureMismatch(courses, selectedProgramId);
  if (!strongest) return undefined;
  return {
    detected: true,
    inferredProgramId: strongest.programId,
    inferredProgramLabel: strongest.label,
    matchedCourses: strongest.evidence.matchedCourses,
    matchedCredits: strongest.evidence.matchedCredits,
    message: `선택한 전공과 달리 ${strongest.label} 전공 과목 지문이 ${strongest.evidence.matchedCourses}개(${strongest.evidence.matchedCredits}학점) 일치합니다. 전공 선택을 다시 확인해주세요.`,
  };
}

export const VERIFIED_MAJOR_COURSE_CATALOGS = [...verifiedCatalogs.values()];
export const CURRENT_MAJOR_CLASSIFICATION_CATALOGS = [...currentClassificationCatalogs.values()];
