import evidenceIndex from "../../../data/extracted/kmou/major-course-evidence-index-2020-2024.json";
import { bundledRuleRegistry } from './rule-registry';
import { getBundledMajorCourseCatalog, getVerifiedRequiredCourseOverlay } from './verified-major-curricula';
import { getVerifiedGeneralEducationPack } from './verified-general-education';

/** Exact-key inventory; current classification references never supply cohort requirements. */
export function courseRequirementInventory() {
  return bundledRuleRegistry.list().sort((a, b) => `${a.key.admissionYear}:${a.key.departmentId}`.localeCompare(`${b.key.admissionYear}:${b.key.departmentId}`)).map(rule => {
    const catalog = getBundledMajorCourseCatalog(rule.key);
    const overlay = getVerifiedRequiredCourseOverlay(rule.key);
    const general = getVerifiedGeneralEducationPack(rule.key);
    return {
      key: rule.key, ruleVersion: rule.version, catalogStatus: catalog?.status ?? 'unavailable',
      requiredDesignation: catalog?.requiredCourseSetStatus ?? 'review', modes: catalog?.categoryRequirementModes ?? {},
      majorCourses: catalog?.entries ?? overlay?.classificationEntries ?? [], overlayEntrySourceIds: overlay?.entrySourceIds ?? {}, individualRequirements: rule.requiredCourses, rowEvidence: Object.fromEntries(Object.entries(evidenceIndex.records).filter(([key]) => key.startsWith(`${rule.key.admissionYear}/${rule.key.departmentId}/`))),
      overlayScope: overlay?.verifiedScope ?? null, overlayCompleteness: overlay?.completeness ?? null,
      generalAreas: general?.rule.generalEducationAreas ?? [], combinedRequirements: general?.rule.generalEducationCombinedRequirements ?? [],
      substitutions: rule.substitutions, recognitionOverlay: general?.recognitionOverlay ?? null,
      sources: [...new Map([...rule.sources, ...(catalog?.sources ?? []), ...(overlay?.sources ?? []), ...(general?.rule.sources ?? [])].map(s => [s.id, s])).values()],
      unknowns: [ ...(catalog?.requiredCourseSetStatus !== 'verified' ? ['전공 개별 필수 지정 또는 전체 목록 완전성 미확인'] : []), '이번 학기 개설·분반 미확인', '편입 인정 총량으로 개별 과목 면제 불가'],
    };
  });
}
