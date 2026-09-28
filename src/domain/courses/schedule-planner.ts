import type { DetailedAudit, GraduationRuleSet, RuleKey } from "../../shared/types/graduation";
import { getKmouProgramOffering, getKmouProgramSearchAliases } from "../curriculum/kmou-program-catalog";
import type { OfferingSection, OfferingSnapshot } from "./offering-snapshot";

export interface SchedulePreferences { dayOff?: string; onlineCountsAsDayOff?: boolean; lateStart?: boolean; preferOnline?: boolean; maxCredits?: number; requestedCodes?: string[] }
export interface SchedulePlan {
  term: string;
  sections: OfferingSection[];
  alternatives: OfferingSection[];
  notes: string[];
  clarification?: string;
  sourceHash?: string;
  updatedAt?: string;
  retrievedAt?: string;
  retrievedAtBasis?: string;
  unavailableRequired?: string[];
  unmetConditions?: string[];
  shortages: { label: string; credits: number; review: boolean }[];
}
const days: Record<string, string> = { 월: "월", 화: "화", 수: "수", 목: "목", 금: "금", 토: "토", 일: "일" };
export function parseSchedulePreferences(question: string): SchedulePreferences {
  const day = question.match(/([월화수목금토일])요일\s*(?:공강|쉬|비워|없)/)?.[1];
  return {
    dayOff: day && days[day],
    onlineCountsAsDayOff: /온라인.*(?:공강|괜찮)|비대면.*(?:공강|괜찮)/.test(question) ? true : /수업 자체|수업도 제외|온라인도 제외/.test(question) ? false : undefined,
    lateStart: /늦게|늦은 시작|오전.*피/.test(question),
    preferOnline: /온라인|비대면|원격/.test(question),
    requestedCodes: [...new Set(question.match(/(?<!\d)\d{5}(?!\d)/g) ?? [])],
    maxCredits: Number(question.match(/(\d{1,2})\s*학점\s*(?:이하|까지|한도)/)?.[1]) || undefined,
  };
}
export function parseScheduleTerm(question: string): string | undefined {
  const match = question.match(/(?<!\d)(20\d{2}|\d{2})\s*[-년]\s*([12])\s*(?:학기)?/);
  return match ? `${match[1].length === 2 ? `20${match[1]}` : match[1]}-${match[2]}` : undefined;
}
const sameRule = (a: RuleKey, b: RuleKey) => a.universityId === b.universityId && a.admissionYear === b.admissionYear && a.departmentId === b.departmentId;
const overlaps = (a: {start:number;end:number}[], b: {start:number;end:number}[]) => a.some(x => b.some(y => x.start <= y.end && y.start <= x.end));
export function sectionsConflict(a: OfferingSection, b: OfferingSection): boolean {
  if (a.courseCode === b.courseCode) return true;
  return a.meetings.some(x => b.meetings.some(y => x.day === y.day && x.startPeriod <= y.endPeriod && y.startPeriod <= x.endPeriod && overlaps(x.weeks.length ? x.weeks : a.weeks, y.weeks.length ? y.weeks : b.weeks)));
}
function meetsDay(section: OfferingSection, day: string, onlineCountsAsDayOff: boolean) {
  return section.meetings.some(meeting => meeting.day === day) && !(onlineCountsAsDayOff && section.remote);
}
function preferenceScore(sections: OfferingSection[], preference: SchedulePreferences, department: string | undefined) {
  const dayPenalty = preference.dayOff ? sections.filter(x => meetsDay(x, preference.dayOff!, !!preference.onlineCountsAsDayOff)).length : 0;
  const start = preference.lateStart ? sections.flatMap(x => x.meetings.map(m => m.startPeriod)).reduce((sum, x) => sum + x, 0) : 0;
  const online = preference.preferOnline ? sections.filter(x => x.remote).length : 0;
  const target = department ? sections.filter(x => x.targets.some(t => t.department === department)).length : 0;
  return -dayPenalty * 1000 + target * 100 + start * 10 + online;
}
function compareChoices(a: OfferingSection[], b: OfferingSection[], preference: SchedulePreferences, department: string | undefined, exactCodes: Set<string>) {
  const requiredDifference = b.filter(x => exactCodes.has(x.courseCode)).length - a.filter(x => exactCodes.has(x.courseCode)).length;
  if (requiredDifference) return requiredDifference;
  if (a.length !== b.length) return b.length - a.length;
  return preferenceScore(b, preference, department) - preferenceScore(a, preference, department);
}
export function planSchedule(audit: DetailedAudit, rule: GraduationRuleSet | null, snapshot: Pick<OfferingSnapshot, "term" | "status" | "sections" | "provenance"> | null, term: string, preference: SchedulePreferences): SchedulePlan {
  const shortages = [
    ...(audit.categories ?? []).filter(x => x.required > x.earned).map(x => ({ label: x.label, credits: x.required - x.earned, review: x.evaluationStatus !== "evaluated" })),
    ...(audit.generalEducation?.areas ?? []).filter(x => x.required > x.earned).map(x => ({ label: x.label, credits: x.required - x.earned, review: x.status === "needs-review" || x.status === "not-evaluable" })),
  ];
  const result: SchedulePlan = { term, sections: [], alternatives: [], notes: [], shortages };

  if (!snapshot || snapshot.status !== "active" || snapshot.term !== term) {
    result.notes.push(`${term} 학기 검수·활성화된 개설강좌가 없어 시간표를 만들 수 없습니다.`);
    return result;
  }
  result.sourceHash = snapshot.provenance.sha256;
  result.updatedAt = snapshot.provenance.importedAt;
  result.retrievedAt = snapshot.provenance.retrievedAt;
  result.retrievedAtBasis = snapshot.provenance.retrievedAtBasis;
  if (!rule || !sameRule(rule.key, { universityId: audit.profile.universityId ?? "", admissionYear: audit.profile.admissionYear, departmentId: audit.profile.departmentId ?? "" })) {
    result.notes.push("현재 학번·전공에 적용되는 규칙을 확인할 수 없어 시간표를 만들 수 없습니다.");
    return result;
  }
  const partialScope = audit.courseMatch?.reviewCauses?.some(x => x.kind === "curriculum-outside-verified-scope") || audit.overallStatus === "not-evaluable";
  const confirmedRequired = !partialScope && rule.status === "approved" && audit.ruleStatus === "approved" && audit.courseMatch?.status === "verified";
  if (!confirmedRequired && !audit.courseGuidance?.remaining.length) result.notes.push("졸업 규칙 또는 개인 이수 판정이 검수 중입니다. 다음 분반은 과목코드로 연결한 검토용 후보이며 확정 필수과목으로 판정하지 않습니다.");
  else if (audit.courseMatch?.requiredCourseSetStatus === "review") result.notes.push("전공필수 전체 목록은 검수 중입니다. 공식 근거가 확인된 개별 미이수 과목만 필수 후보로 연결합니다.");
  const guidance = audit.courseGuidance?.mode === "personal" && sameRule(audit.courseGuidance.key, rule.key) && audit.courseGuidance.ruleVersion === rule.version ? audit.courseGuidance : undefined;
  const passed = new Set([...audit.courses.filter(x => x.passed).map(x => x.code), ...(guidance?.completed.map(x => x.code) ?? []), ...(guidance?.completedCodes ?? [])]);
  const reviewCodes = new Set([...(audit.courseMatch?.transitionReviewCourses?.map(x => x.code) ?? []), ...(audit.courseMatch?.requiredCourseAssessments?.filter(x => x.status === "needs-review" || x.status === "pending-substitution" || x.status === "confirmed-missing" && (x.classification !== "official-row" || !!x.reviewCause)).map(x => x.code) ?? [])]);
  for (const item of guidance?.remaining ?? []) if (item.planningBasis === "student-confirmed-uncompleted" && item.requirementDesignation === "confirmed" && item.recognitionKind === "transfer-recognition-unresolved" && audit.studentCourseDeclarations?.[item.code.toUpperCase()] === "student-confirmed-uncompleted" && (!audit.courseMatch?.requiredCourseAssessments?.some(a => a.code.toUpperCase() === item.code.toUpperCase()) || audit.courseMatch?.requiredCourseAssessments?.find(a => a.code.toUpperCase() === item.code.toUpperCase())?.reviewCause?.kind === "transfer-recognition-unresolved")) reviewCodes.delete(item.code);
  for (const item of guidance?.recognitionReview ?? []) reviewCodes.add(item.code);
  const confirmedCodes = new Set(audit.courseMatch?.requiredCourseAssessments?.filter(x => x.status === "confirmed-missing" && x.classification === "official-row" && !x.reviewCause).map(x => x.code) ?? []);
  const missing = new Set(audit.missingCourses.filter(x => x.priority === "필수" && x.code && !passed.has(x.code) && !reviewCodes.has(x.code) && (x.category === "교양필수" || (audit.courseMatch?.requiredCourseAssessments ? confirmedCodes.has(x.code) : confirmedRequired))).map(x => x.code));
  for (const item of guidance?.remaining ?? []) if (!passed.has(item.code) && !reviewCodes.has(item.code)) missing.add(item.code);
  const requested = (preference.requestedCodes ?? []).filter(code => !passed.has(code) && !reviewCodes.has(code) && (!partialScope || confirmedCodes.has(code) || guidance?.remaining.some(x => x.code === code) || guidance?.pools.some(pool => !pool.review && pool.candidates.some(x => x.code === code))));
  const codes = preference.requestedCodes?.length ? requested : [...missing];

  if (preference.requestedCodes?.length && codes.length) {
    result.notes.push("요청한 과목코드로 시간표를 구성했습니다.");
    const otherRequired = [...missing].filter(code => !codes.includes(code));
    if (otherRequired.length) result.notes.push(`별도로 남은 필수 요건: ${otherRequired.map(code => guidance?.remaining.find(x => x.code === code)?.name ?? audit.missingCourses.find(x => x.code === code)?.name ?? code).join(", ")}.`);
  }
  const eligible = (x: OfferingSection) => x.state !== "cancelled" && !x.reviewFlags.length && Number.isFinite(x.credits) && x.credits >= 0 && !passed.has(x.courseCode);
  const groups = codes.map(code => snapshot.sections.filter(x => x.courseCode === code && eligible(x)));
  result.unavailableRequired = codes.filter((_, i) => !groups[i].length);
  if (result.unavailableRequired.length) result.notes.push(`이번 학기 개설 분반 미연결: ${result.unavailableRequired.map(code => guidance?.remaining.find(x => x.code === code)?.name ?? audit.missingCourses.find(x => x.code === code)?.name ?? code).join(", ")}.`);
  const offering = getKmouProgramOffering(rule.key.admissionYear, rule.key.departmentId);
  const ownNames = new Set([audit.profile.department, ...(offering ? getKmouProgramSearchAliases(offering).filter(name => name !== offering.currentUnit) : [])]);
  // The current unit can contain sibling majors; only this program's own names are eligible.
  const ownTarget = (x: OfferingSection, label: string) => x.targets.some(t => ownNames.has(t.department) && t.category === label);
  const pools: { label: string; credits: number; codes: Set<string> }[] = (preference.requestedCodes?.length ? [] : guidance?.pools ?? []).filter(x => !x.review).map(x => ({ label: x.label, credits: x.minimumCredits, codes: new Set(x.candidates.map(c => c.code).filter(code => !passed.has(code) && !reviewCodes.has(code))) }));
  const categoryShortages = (preference.requestedCodes?.length ? [] : shortages).filter(x => !x.review && ["교양필수", "교양선택", "전공필수", "전공선택", "전공기초"].includes(x.label));
  for (const shortage of categoryShortages) {
    if (guidance && shortage.label !== "전공선택") continue;
    const candidateCodes = snapshot.sections.filter(x => eligible(x) && ownTarget(x, shortage.label) && !reviewCodes.has(x.courseCode) && (shortage.label !== "전공필수" || confirmedCodes.has(x.courseCode)) && !audit.courseMatch?.requiredCourseAssessments?.some(a => a.code === x.courseCode && a.status !== "confirmed-missing")).map(x => x.courseCode);
    pools.push({ label: shortage.label, credits: shortage.credits, codes: new Set(candidateCodes) });
  }
  const poolCodes = new Set(pools.flatMap(pool => [...pool.codes]));
  const distinct = new Map<string, OfferingSection[]>();
  for (const section of snapshot.sections) {
    if (!eligible(section) || !poolCodes.has(section.courseCode) || missing.has(section.courseCode) || reviewCodes.has(section.courseCode)) continue;
    if (!distinct.has(section.courseCode)) distinct.set(section.courseCode, []);
    distinct.get(section.courseCode)!.push(section);
  }
  groups.push(...distinct.values());
  const coverage = (picked: OfferingSection[]) => pools.reduce((sum, pool) => sum + Math.min(pool.credits, picked.filter(x => pool.codes.has(x.courseCode)).reduce((n, x) => n + x.credits, 0)), 0);
  const compare = (a: OfferingSection[], b: OfferingSection[]) => {
    const required = b.filter(x => codes.includes(x.courseCode)).length - a.filter(x => codes.includes(x.courseCode)).length;
    if (required) return required;
    const difference = coverage(b) - coverage(a);
    if (difference) return difference;
    if (pools.length) {
      const extra = a.reduce((n, x) => n + x.credits, 0) - b.reduce((n, x) => n + x.credits, 0);
      if (extra) return extra;
    }
    return compareChoices(a, b, preference, audit.profile.department, missing);
  };
  const available = groups.filter(x => x.length);
  if (!available.length) {
    result.notes.push(preference.requestedCodes?.length ? "요청한 과목코드의 검수된 개설 분반이 없습니다." : "현재 학기에 연결 가능한 미이수 과목 또는 부족 영역의 개설 분반이 없습니다.");
    return result;
  }
  const cap = preference.maxCredits;
  const choices: OfferingSection[][] = [[]];
  for (const group of available) {
    const expanded = choices.flatMap(picked => [picked, ...group.filter(section => (!cap || picked.reduce((n, x) => n + x.credits, 0) + section.credits <= cap) && picked.every(x => !sectionsConflict(x, section))).map(section => [...picked, section])]);
    expanded.sort((a, b) => compare(a, b));
    choices.splice(0, choices.length, ...expanded.slice(0, 1000));
  }
  choices.sort((a, b) => compare(a, b));
  result.sections = choices[0] ?? [];
  result.alternatives = choices.find(x => preference.dayOff && x.length && x.every(section => !meetsDay(section, preference.dayOff!, false))) ?? [];
  result.unmetConditions = pools.flatMap(pool => {
    const credits = result.sections.filter(x => pool.codes.has(x.courseCode)).reduce((n, x) => n + x.credits, 0);
    return credits < pool.credits ? [`${pool.label} ${pool.credits - credits}학점 남음`] : [];
  });
  const omittedRequired = codes.filter(code => !result.sections.some(x => x.courseCode === code) && !result.unavailableRequired?.includes(code));
  if (omittedRequired.length) result.notes.push(`시간 충돌·학점 조건으로 미배치: ${omittedRequired.join(", ")}.`);
  if (preference.dayOff && result.sections.some(x => meetsDay(x, preference.dayOff!, !!preference.onlineCountsAsDayOff))) result.notes.push(`${preference.dayOff}요일 공강보다 졸업요건 후보를 우선했습니다. 공강을 지키려면 일부 과목을 다른 학기에 이수해야 합니다.`);
  if (!cap) result.notes.push("개인 수강 학점 한도가 확인되지 않아 신청 가능 여부는 별도 확인이 필요합니다.");
  if (result.sections.some(x => x.restrictionStatus === "unknown")) result.notes.push("수강 대상·정원·신청 제한은 확인되지 않았습니다. 실제 수강 가능 여부를 확인하세요.");
  if (result.sections.some(x => x.cancellationStatus === "unknown")) result.notes.push("폐강 여부와 시간·강의실 변경 여부는 확인되지 않았습니다.");
  if (preference.dayOff && preference.onlineCountsAsDayOff === undefined && snapshot.sections.some(x => x.remote && x.meetings.some(m => m.day === preference.dayOff))) {
    const onlineAllowed = planSchedule(audit, rule, snapshot, term, { ...preference, onlineCountsAsDayOff: true });
    const onlineExcluded = planSchedule(audit, rule, snapshot, term, { ...preference, onlineCountsAsDayOff: false });
    if (onlineAllowed.sections.map(x => x.id).join("|") !== onlineExcluded.sections.map(x => x.id).join("|")) result.clarification = "정해진 시간이 있는 온라인 수업도 공강으로 볼까요, 아니면 그 요일에는 수업 자체를 제외할까요?";
  }
  return result;
}
