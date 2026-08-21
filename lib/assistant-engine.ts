import type {
  AssistantAuditContext,
  DetailedAudit,
  EvidenceChunk,
  StudentProfile,
} from "./types";
export type AssistantTool =
  | "loadStudentContext"
  | "auditGraduation"
  | "recommendCourses"
  | "checkCertification"
  | "explainRequirement";
export type AssistantIntent =
  | "early-graduation"
  | "course-planning"
  | "certification"
  | "audit";
export function classifyQuestion(question: string): AssistantIntent {
  const normalized = question.replace(/\s/g, "");
  if (/조기졸업|빨리.*졸업|졸업.*빨리/.test(normalized))
    return "early-graduation";
  if (/공강|추천|수강|다음학기|시간표/.test(normalized))
    return "course-planning";
  if (/봉사|자격|기사|토익|어학|인증/.test(normalized)) return "certification";
  return "audit";
}
export function toolsForQuestion(question: string): AssistantTool[] {
  const intent = classifyQuestion(question);
  if (intent === "early-graduation") return ["explainRequirement"];
  if (intent === "course-planning")
    return ["auditGraduation", "recommendCourses"];
  if (intent === "certification")
    return ["checkCertification", "explainRequirement"];
  return ["auditGraduation", "explainRequirement"];
}
export function makeAssistantAuditContext(
  profile: StudentProfile,
  audit: DetailedAudit,
): AssistantAuditContext {
  return { profile, audit, ruleVersion: audit.ruleVersion ?? "unknown" };
}
export function deterministicAnswer(
  question: string,
  audit: DetailedAudit,
  evidence: EvidenceChunk[],
): string {
  const intent = classifyQuestion(question);
  const detailedCourseAudit = audit.courseMatch?.status === "verified"
    && ["cohort-catalog", "current-classification"].includes(audit.courseMatch.classificationSource ?? "");
  if (intent === "early-graduation")
    return audit.profile.studentTypeCode === "transfer"
      ? "편입생도 같은 공통 졸업요건을 적용받지만 조기졸업 가능 여부는 별도 학생 정책입니다. 승인된 편입 정책 오버레이와 학과 확인 없이 가능·불가를 확정하지 않습니다."
      : "조기졸업은 공통 졸업요건 외에 별도 신청 자격과 성적 기준을 확인해야 합니다. 승인된 학생 정책과 학과 안내를 확인하세요.";
  if (intent === "course-planning" && !detailedCourseAudit) {
    const shortages = audit.categories
      .filter((item) => item.earned < item.required)
      .map((item) => `${item.label} ${item.required - item.earned}학점`)
      .join(", ");
    return `현재 공식 편제학점 기준 부족 영역은 ${shortages || "없음"}입니다. 하지만 이 학번·전공의 상세 필수·대체과목과 개설학기가 아직 검수되지 않아 과목명을 추천하지 않습니다. 학과사무실 확인 후 상세 규칙이 승인되어야 수강 추천을 열 수 있습니다.`;
  }
  if (intent === "course-planning")
    return `현재 임시 필수 ${audit.missingCourses.reduce((sum, course) => sum + course.credits, 0)}학점과 부족한 영역 학점을 우선 보완해야 합니다. ${audit.missingCourses
      .slice(0, 4)
      .map((course) => course.name)
      .join(
        ", ",
      )}을 먼저 검토하고 실제 분반 시간표가 공개되면 공강 조건으로 최적화하세요.`;
  if (intent === "certification")
    return audit.certificationEvidence === "unknown"
      ? "성적표에는 어학·봉사·자격증 증빙이 없어 졸업인증 충족 여부를 판정할 수 없습니다. 별도 입력 또는 증빙 확인이 필요합니다."
      : `어학 인증은 ${audit.certification.language ? "충족" : "미충족"}, 활동·자격 인증은 ${audit.certification.activity ? "충족" : "미충족"}입니다. 봉사·현장실습·기사 자격의 인정 범위는 졸업인증 지침과 학과 확인이 필요합니다.`;
  return detailedCourseAudit
    ? `현재 ${audit.earnedTotal}/${audit.requiredTotal}학점이며 임시 규칙상 필수 교과목 ${audit.missingCourses.length}개가 남았습니다. 권장 보완량은 약 ${audit.forecastCredits}학점입니다.${evidence[0]?.title ? ` 근거로 '${evidence[0].title}' 항목을 확인했습니다.` : ""}`
    : `현재 공식 편제표 기준 ${audit.earnedTotal}/${audit.requiredTotal}학점입니다. 영역별 부족학점은 계산했지만 상세 필수과목·교양 세부영역·졸업인증은 아직 판정하지 않았습니다.${evidence[0]?.title ? ` 근거로 '${evidence[0].title}' 항목을 확인했습니다.` : ""}`;
}
