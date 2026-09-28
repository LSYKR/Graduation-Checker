import { conciseGuidanceText } from "./guidance-presentation";
import type { CourseGuidance, CourseGuidanceItem, DetailedAudit, GraduationRuleSet } from '../../shared/types/graduation';
import { getVerifiedGeneralEducationPack } from '../curriculum/verified-general-education';
import evidenceIndex from '../../../data/extracted/kmou/major-course-evidence-index-2020-2024.json';
import { getVerifiedRequiredCourseOverlay, getVerifiedMajorCourseCatalog } from '../curriculum/verified-major-curricula';

export function makeCourseGuidance(rule: GraduationRuleSet, audit?: Pick<DetailedAudit, 'courses' | 'categories' | 'courseMatch' | 'generalEducation'>): CourseGuidance {
  const result: CourseGuidance = { key: rule.key, ruleVersion: rule.version, mode: audit ? 'personal' : 'curriculum', completed: [], remaining: [], recognitionReview: [], pools: [], dataGaps: [], offeringStatus: 'unknown' };
  const done = new Set((audit?.courses ?? []).filter(c => c.passed).map(c => c.code.toUpperCase()));
  result.completedCodes = [...done];
  const excluded = new Set(done);
  for (const sub of rule.substitutions) if (sub.substituteCodes.some(code => done.has(code.toUpperCase()))) excluded.add(sub.requiredCode.toUpperCase());
  const transferReview = new Set(audit?.courseMatch?.transferRecognitionReviewCourses?.map(c => c.code.toUpperCase()) ?? []);
  const assessments = audit?.courseMatch?.requiredCourseAssessments ?? [];
  const mismatch = audit?.courseMatch?.profileMismatch?.detected;
  const item = (c: { code: string; name: string; credits: number; category: string; recommendedYear?: number; recommendedSemester?: 1 | 2 }, reason: string, sourceId?: string): CourseGuidanceItem => ({ ...c, reason, sourceId });
  for (const a of assessments) {
    const entry = { ...item(a, a.reason, a.sourceId), locator: a.locator, requirementDesignation: a.requirementDesignation, recognitionKind: a.status === "pending-substitution" ? "substitution-approval-missing" as const : a.reviewCause?.kind === "transfer-recognition-unresolved" ? "transfer-recognition-unresolved" as const : a.reviewCause?.kind === "substitution-approval-missing" ? "substitution-approval-missing" as const : undefined };
    if (a.status === 'completed') { result.completed.push(entry); done.add(a.code.toUpperCase()); excluded.add(a.code.toUpperCase()); }
    else if (!mismatch && a.status === 'confirmed-missing' && a.requirementDesignation === 'confirmed') result.remaining.push(entry);
    else if (a.status === 'pending-substitution' || a.reviewCause?.kind === 'transfer-recognition-unresolved' || a.reviewCause?.kind === 'substitution-approval-missing') result.recognitionReview.push(entry);
    else if (a.status === "needs-review") result.dataGaps.push(`${a.name}: ${a.reason}`);
  }
  const catalog = getVerifiedMajorCourseCatalog(rule);
  const overlay = getVerifiedRequiredCourseOverlay(rule.key);
  const records = evidenceIndex.records as Record<string, { status: string; sourceId?: string; locator?: string; reason?: string }>;
  if (!audit && catalog) for (const c of catalog.entries) if ((c.category === 'majorRequired' || c.required && catalog.requiredCourseSetStatus === 'verified') && records[`${rule.key.admissionYear}/${rule.key.departmentId}/${c.code.toUpperCase()}`]?.status === 'exact-source-row' && !rule.requiredCourses.some(r => r.code.toUpperCase() === c.code.toUpperCase())) result.remaining.push(item(c, `검증된 교육과정 개별 필수 요건 · ${records[`${rule.key.admissionYear}/${rule.key.departmentId}/${c.code.toUpperCase()}`]?.locator ?? ''}`, records[`${rule.key.admissionYear}/${rule.key.departmentId}/${c.code.toUpperCase()}`]?.sourceId ?? catalog.sourceId));
  if (!catalog || catalog.requiredCourseSetStatus !== 'verified') result.dataGaps.push(catalog?.requiredCourseSetNote ?? '전공 필수과목 전체 목록·개별 필수 지정 미확인');
  if (mismatch) result.dataGaps.push('선택 전공과 성적표 불일치: 개인 수강 필요 여부 확인 보류');
  for (const c of rule.requiredCourses) {
    if (c.category.startsWith('전공') || ['majorRequired', 'majorFoundation', 'majorElective'].includes(c.category)) {
      if (!audit) {
        const e = records[`${rule.key.admissionYear}/${rule.key.departmentId}/${c.code.toUpperCase()}`];
        if (e?.status === 'conflict') result.dataGaps.push(`${c.name}: ${e.reason ?? '공식 원본 간 충돌'}`);
        else result.remaining.push(item({ ...c, recommendedYear: catalog?.entries.find(e => e.code === c.code)?.recommendedYear ?? overlay?.classificationEntries.find(e => e.code === c.code)?.recommendedYear, recommendedSemester: catalog?.entries.find(e => e.code === c.code)?.recommendedSemester ?? overlay?.classificationEntries.find(e => e.code === c.code)?.recommendedSemester }, `해당 학과·교육과정의 개별 필수 요건${e?.locator ? ' · ' + e.locator : ''}`, e?.sourceId ?? overlay?.entrySourceIds?.[c.code.toUpperCase()] ?? overlay?.sources[0]?.id));
      }
      continue;
    }
    const substitute = rule.substitutions.find(s => s.requiredCode.toUpperCase() === c.code.toUpperCase() && s.substituteCodes.some(code => done.has(code.toUpperCase())));
    const geArea = getVerifiedGeneralEducationPack(rule.key)?.rule.generalEducationAreas.find(a => a.eligibleCourses.some(entry => entry.code.toUpperCase() === c.code.toUpperCase()));
    const entry = item(c, c.note ?? '교양 개별 필수 요건', geArea?.evidence.requirementSourceId);
    if (!entry.sourceId) result.dataGaps.push(`${c.name}: 개별 필수 요건 근거 위치 미연결`);
    if (done.has(c.code.toUpperCase()) || substitute && !substitute.requiresApproval) { result.completed.push(entry); done.add(c.code.toUpperCase()); }
    else if (transferReview.has(c.code.toUpperCase())) result.recognitionReview.push({ ...entry, requirementDesignation: 'confirmed', recognitionKind: 'transfer-recognition-unresolved', reason: '개별 과목별 편입 인정·대체 매핑 확인 필요; 면제·미이수 확정 보류' });
    else if (substitute?.requiresApproval) result.recognitionReview.push({ ...entry, recognitionKind: 'substitution-approval-missing', reason: substitute.note });
    else if (!audit || !mismatch) result.remaining.push(entry);
  }
  if (catalog && !mismatch) for (const category of ['majorFoundation', 'majorRequired'] as const) {
    if (catalog.categoryRequirementModes?.[category] !== 'minimum-from-pool') continue;
    const progress = audit?.categories.find(c => c.key === category);
    const shortage = progress ? Math.max(0, progress.required - progress.earned) : rule.credits.find(c => c.key === category)?.required ?? 0;
    if (!shortage) continue;
    result.pools.push({ id: category, label: progress?.label ?? category, minimumCredits: shortage, review: progress?.evaluationStatus === 'not-evaluable', condition: `${shortage}학점 이상 선택 (후보 전체 이수 의무 아님)`, candidates: catalog.entries.filter(c => c.category === category && !excluded.has(c.code.toUpperCase())).map(c => item(c, '영역 최소학점 선택 후보', catalog.sourceId)) });
  }
  const general = getVerifiedGeneralEducationPack(rule.key);
  if (!general) result.dataGaps.push('교양 세부 이수체계 미연결');
  for (const area of general?.rule.generalEducationAreas ?? []) {
    const progress = audit?.generalEducation?.areas.find(a => a.id === area.id);
    const shortage = progress ? Math.max(0, progress.required - progress.earned) : area.minimumCredits;
    if (!shortage) continue;
    result.pools.push({ id: area.id, label: area.label, minimumCredits: shortage, review: progress?.status === 'needs-review' || progress?.status === 'not-evaluable', condition: `${area.label} ${shortage}학점 이상 선택 (후보 전체 이수 의무 아님)`, candidates: area.eligibleCourses.filter(c => !excluded.has(c.code.toUpperCase())).map(c => item({ ...c, category: area.creditCategory ?? 'generalElective' }, `${area.label} 영역 최소학점 충족 후보`, area.evidence.requirementSourceId)) });
  }
  for (const combined of general?.rule.generalEducationCombinedRequirements ?? []) {
    const p = audit?.generalEducation?.combinedRequirements.find(a => a.id === combined.id);
    if (!p || p.required > p.earned) {
      const shortage = p ? p.required - p.earned : combined.minimumCredits;
      const candidates = [...new Map((general?.rule.generalEducationAreas ?? []).filter(a => combined.areaIds.includes(a.id)).flatMap(a => a.eligibleCourses).filter(c => !excluded.has(c.code.toUpperCase())).map(c => [c.code, item({ ...c, category: 'generalElective' }, `${combined.label} 합산 선택 후보`, combined.evidence.requirementSourceId)])).values()];
      result.pools.push({ id: combined.id, label: combined.label, minimumCredits: shortage, review: p?.status === 'needs-review' || p?.status === 'not-evaluable', condition: `${combined.label} 연결 영역 합산 ${shortage}학점 이상 선택 (개별 영역과 공유; 부족학점 중복 합산 금지, 후보 전체 이수 의무 아님)`, candidates });
    }
    if (!p || p.required > p.earned) result.dataGaps.push(`${p?.status === 'needs-review' || p?.status === 'not-evaluable' ? '인정 검토 중; 기준 차이는 확정 부족량 아님 · ' : ''}${combined.label}: 연결 영역 ${combined.areaIds.join(', ')} 합산 기준 차이 ${p ? p.required - p.earned : combined.minimumCredits}학점; 영역별 후보와 중복 합산하지 않음`);
  }
  if (audit?.courseMatch?.transferRecognitionReviewCourses?.length) result.dataGaps.push('편입 인정학점 총량은 개별 필수과목 면제 근거가 아닙니다. 과목별 인정 연결을 확인하세요.');
  return result;
}

export function courseGuidanceText(g: Pick<CourseGuidance, 'remaining' | 'pools' | 'recognitionReview' | 'dataGaps'>): string {
  return conciseGuidanceText(g);
}

/** Enrich old saved guidance from its audit evidence without retaining transcript rows. */
export function enrichRecognitionGuidance(audit: DetailedAudit): DetailedAudit {
  if (!audit.courseGuidance) return audit;
  const recognitionReview = audit.courseGuidance.recognitionReview.map(c => {
    const a = audit.courseMatch?.requiredCourseAssessments.find(a => a.code.toUpperCase() === c.code.toUpperCase());
    const pending = audit.courseMatch?.pendingCourseRecognitions.some(p => p.requiredCode.toUpperCase() === c.code.toUpperCase());
    if (pending || a?.status === 'pending-substitution') return { ...c, recognitionKind: 'substitution-approval-missing' as const };
    const transfer = a ? a.status === 'needs-review' && a.classification === 'official-row' && a.requirementDesignation === 'confirmed' && a.reviewCause?.kind === 'transfer-recognition-unresolved' : c.recognitionKind === 'transfer-recognition-unresolved' && c.requirementDesignation === 'confirmed' || audit.courseMatch?.transferRecognitionReviewCourses?.some(r => r.code.toUpperCase() === c.code.toUpperCase() && (r.category === '교양필수' || r.category === 'generalRequired'));
    return transfer ? { ...c, requirementDesignation: 'confirmed' as const, recognitionKind: 'transfer-recognition-unresolved' as const } : { ...c, recognitionKind: undefined, requirementDesignation: a?.requirementDesignation };
  });
  return { ...audit, courseGuidance: { ...audit.courseGuidance, recognitionReview } };
}

export function applyStudentUncompleted(audit: DetailedAudit, codes: string[]): DetailedAudit {
  const enriched = enrichRecognitionGuidance(audit);
  const g = enriched.courseGuidance;
  if (!g || g.mode !== 'personal' || g.key.universityId !== enriched.profile.universityId || g.key.departmentId !== enriched.profile.departmentId || g.key.admissionYear !== enriched.profile.admissionYear || g.ruleVersion !== enriched.ruleVersion || enriched.profile.studentTypeCode !== 'transfer' || enriched.courseMatch?.profileMismatch?.detected) return enriched;
  const requested = new Set(codes.map(c => c.toUpperCase()));
  const completed = new Set([...(g.completedCodes ?? []), ...g.completed.map(c => c.code), ...enriched.courses.filter(c => c.passed).map(c => c.code)].map(c => c.toUpperCase()));
  const selected = g.recognitionReview.filter(c => requested.has(c.code.toUpperCase()) && !completed.has(c.code.toUpperCase()) && c.requirementDesignation === 'confirmed' && c.recognitionKind === 'transfer-recognition-unresolved');
  const selectedCodes = new Set(selected.map(c => c.code.toUpperCase()));
  const declarations = { ...enriched.studentCourseDeclarations };
  for (const c of selected) declarations[c.code.toUpperCase()] = 'student-confirmed-uncompleted';
  return { ...enriched, studentCourseDeclarations: declarations, courseGuidance: { ...g, recognitionReview: g.recognitionReview.filter(c => !selectedCodes.has(c.code.toUpperCase())), remaining: [...g.remaining, ...selected.map(c => ({ ...c, planningBasis: 'student-confirmed-uncompleted' as const, reason: `학생 직접 미이수 확인 · 수강 필요로 개인 계획에 반영 (공식 인정 판정 아님). ${c.reason}` }))] } };
}
