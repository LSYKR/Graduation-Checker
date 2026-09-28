import { courseGuidanceText } from "./course-guidance";
import type { AssistantAuditContext, DetailedAudit, EvidenceChunk, StudentProfile } from "../../shared/types/graduation";

export type AssistantTool = "loadStudentContext" | "auditGraduation" | "recommendCourses" | "checkCertification" | "explainRequirement";
export type AssistantIntent = "greeting" | "system" | "model" | "general" | "early-graduation" | "requirements" | "course-planning" | "certification" | "recognition" | "missing-courses" | "missing-areas" | "priority" | "audit";

export function classifyQuestion(question: string): AssistantIntent {
  const q = question.replace(/\s/g, "");
  if (/^(안녕(하세요)?|하이|ㅎㅇ|반가워|hello|hi)[!?.~]*$/i.test(q)) return "greeting";
  if (/모델|qwen|너는누구|정체|LLM/i.test(q)) return "model";
  if (/어떻게실행|어떻게작동|어떻게돌아|어떻게계산|무슨서비스|뭐하는|시스템|AI.*(사용|전송|처리)|개인정보|데이터.*(저장|전송)/i.test(q)) return "system";
  if (/졸업인증/.test(q)) return "certification";
  if (/대체|편입.*인정|면제|인정받|인정.*(과목|확인)|(?:전공|교양)(?:필수|선택)?.*인정/.test(q)) return "recognition";
  if (/봉사|자격|기사|토익|어학|인증/.test(q)) return "certification";
  if (/학점말고|뭘더들|무슨과목|어떤과목|교양필수.*(뭐|남)|전공필수.*(뭐|남)|과목추천|강의추천|부족.*(필수과목|과목)|남은.*(필수과목|과목)/.test(q)) return "missing-courses";
  if (/공강|시간표|요일|다음학기|수강신청|강의추천|과목추천|추천해/.test(q)) return "course-planning";
  if (/이수했|수강했|취득했|들었|받았|성적표|충족해|내가|나는|제가|저는|나의|내성적|내학점|제성적|제학점|\d+(?:\.\d+)?학점(?:인데|이고|이야|을?이수|을?취득|땄)/.test(q)) return "audit";
  if (/우선순위|우선.*(뭐|무엇|해야)|먼저.*(뭐|무엇|해야)|뭘먼저|최우선/.test(q)) return "priority";
  if (/부족.*(필수과목|과목)|남은.*(필수과목|과목)|필수과목.*(뭐|무엇)|무슨과목/.test(q)) return "missing-courses";
  if (/(영역|교양|전공).*(부족|남은|모자)|부족.*(영역|교양|전공)/.test(q)) return "missing-areas";
  if (/조기졸업|빨리.*졸업|졸업.*빨리/.test(q)) return /^(내|제|나의|현재|지금)/.test(q) ? "audit" : "early-graduation";
  if (/공식|요건|규정|규칙|기준|필요학점/.test(q) && !/(내|제|나의|현재|지금|성적표|부족|남은)/.test(q)) return "requirements";
  if (/(졸업|이수).*(필요한|요구|기준|최소).*학점|총.*(필요|요구).*학점/.test(q) && !/(내|제|나의|현재|지금|성적표|부족|남은)/.test(q)) return "requirements";
  if (/(내|제|나의|현재|지금|이수|성적표|학점|졸업할수|졸업가능|졸업하려면|무엇을해야|뭘해야)/.test(q)) return "audit";
  if (/요건|기준|규정|규칙|의무|필요학점/.test(q)) return "requirements";
  return "general";
}

export function toolsForQuestion(question: string): AssistantTool[] {
  const intent = classifyQuestion(question);
  if (intent === "early-graduation" || intent === "requirements") return ["explainRequirement"];
  if (intent === "course-planning") return ["auditGraduation", "recommendCourses"];
  if (intent === "certification") return ["checkCertification"];
  if (intent === "greeting" || intent === "system" || intent === "model" || intent === "general") return [];
  return ["auditGraduation"];
}

export function makeAssistantAuditContext(profile: StudentProfile, audit: DetailedAudit): AssistantAuditContext {
  return { profile, audit, ruleVersion: audit.ruleVersion ?? "unknown" };
}

function shortageLines(audit: DetailedAudit): string {
  const categories = audit.categories.filter((item) => item.earned < item.required)
    .map((item) => item.evaluationStatus === "not-evaluable" ? `${item.label} 판정 보류 (공식 확인 ${item.earned}학점 · 성적표 보고 ${item.reportedEarned ?? item.earned}학점 · 인정 대기 ${item.pendingEarned ?? 0}학점; 기준과의 차이 ${item.required - item.earned}학점은 확정 부족량 아님)` : `${item.label} ${item.required - item.earned}학점`);
  const areas = audit.generalEducation?.areas.filter((item) => item.earned < item.required)
    .map((item) => `${item.label} ${item.required - item.earned}학점${item.status === "needs-review" || item.status === "not-evaluable" ? "(인정 검토 필요)" : ""}`) ?? [];
  const combined = audit.generalEducation?.combinedRequirements.filter((item) => item.earned < item.required)
    .map((item) => `${item.label} ${item.required - item.earned}학점${item.status === "needs-review" || item.status === "not-evaluable" ? "(인정 검토 필요)" : ""}`) ?? [];
  return [categories.length ? `영역별 학점 현황: ${categories.join(", ")}.` : "영역별 학점 부족은 확인되지 않았습니다.",
    areas.length || combined.length ? `교양 세부영역 부족: ${[...areas, ...combined].join(", ")}.` : ""].filter(Boolean).join(" ");
}

function courseLines(audit: DetailedAudit): string {
  if (audit.courseGuidance) return courseGuidanceText(audit.courseGuidance);
  if (!audit.missingCourses.length) return "확인된 남은 필수과목 없음. 전체 과목 요건 목록은 미확인입니다.";
  return `미이수 과목: ${audit.missingCourses.map((course) => `${course.name} ${course.credits}학점${course.priority === "권장" ? "(권장)" : ""}`).join(", ")}.`;
}

function caveat(audit: DetailedAudit): string {
  const notes: string[] = [];
  if (audit.courses?.some(course => isFutureTranscriptTerm(course))) notes.push("업로드 내역에 미래 학기가 포함되어 있습니다. 해당 행은 가상·미검증 이수내역이며 실제 취득학점으로 확인한 것이 아닙니다.");
  if (audit.courseMatch?.requiredCourseSetStatus === "review") notes.push("전체 필수과목 목록의 완전성은 검토 중입니다. 같은 학번·전공 공식 행과 필수 지정 근거가 확인된 개별 과목의 판정은 유지합니다.");
  if (audit.ruleStatus === "draft" || audit.ruleStatus === "provisional") notes.push("적용 규칙은 잠정 상태입니다.");
  if (audit.courseMatch?.pendingCourseRecognitions.length) notes.push(`대체·인정 대기 ${audit.courseMatch.pendingCourseRecognitions.length}건은 승인 전까지 충족으로 보지 않습니다: ${audit.courseMatch.pendingCourseRecognitions.map((item) => `${item.substituteName} → ${item.requiredName}`).join(", ")}.`);
  if (audit.courseMatch?.transitionReviewCourses?.length) notes.push(`학번 전환 검토 과목: ${audit.courseMatch.transitionReviewCourses.map((item) => item.name).join(", ")}.`);
  if (audit.courseMatch?.profileMismatch?.detected) notes.push(`전공 프로필 불일치 가능성: ${audit.courseMatch.profileMismatch.message}`);
  if (audit.transcriptClassification?.status === "needs-review") notes.push(`성적표 분류 검토가 필요합니다: ${audit.transcriptClassification.note}`);
  if (audit.generalEducation && !audit.generalEducation.conclusive) notes.push("교양 세부영역 판정은 잠정적입니다.");
  if (!audit.generalEducation) notes.push("교양 세부영역은 이 진단에서 확인되지 않았습니다.");
  if (audit.generalEducation?.mappingConflicts.length) notes.push(`교양 인정 충돌 ${audit.generalEducation.mappingConflicts.length}건은 검토가 필요합니다.`);
  if (audit.certificationEvidence !== "verified") notes.push(audit.certificationEvidence === "demo" ? "예시 진단이며 졸업인증은 실제 증빙을 확인해야 합니다." : "어학·활동 등 졸업인증은 별도 증빙 확인이 필요합니다.");
  if ((audit.creditEvaluationStatus ?? audit.overallStatus) === "not-evaluable") notes.push("학점·분류 확인이 필요한 내역이 있어 학점 보완량은 확인 후 달라질 수 있습니다.");
  else if (audit.overallStatus === "not-evaluable") notes.push("이수 완료 학점은 반영했습니다. 필수과목 목록의 완전성과 최종 졸업 가능 여부는 별도 확인이 필요합니다.");
  return notes.join(" ");
}

function creditSummary(audit: DetailedAudit): string {
  const totalGap = Math.max(0, audit.requiredTotal - audit.earnedTotal);
  const applicableGap = Math.max(0, audit.requiredTotal - audit.applicableEarnedTotal);
  const forecast = (audit.creditEvaluationStatus ?? audit.overallStatus) === "evaluated"
    ? audit.overallStatus === "evaluated" ? `필수과목·영역 요건을 함께 고려한 최소 보완량은 ${audit.forecastCredits}학점입니다.` : `학점 기준 최소 보완량은 ${audit.forecastCredits}학점입니다.`
    : `학점 판정이 보류되어 예상 보완량 약 ${audit.forecastCredits}학점은 거친 추정입니다.`;
  return `현재 총 ${audit.earnedTotal}/${audit.requiredTotal}학점이며 적용 가능 학점은 ${audit.applicableEarnedTotal}학점입니다. 총학점 차이는 ${totalGap}학점${applicableGap !== totalGap ? `, 적용 가능 학점 기준 부족은 ${applicableGap}학점` : ""}입니다. ${forecast}`;
}

export function deterministicAnswer(question: string, audit: DetailedAudit, _evidence: EvidenceChunk[] = []): string {
  const intent = classifyQuestion(question);
  if (intent === "greeting") return "안녕하세요. 현재 이수 현황, 부족한 과목과 영역, 졸업요건을 물어보세요.";
  if (intent === "model") return "이 상담은 설정된 로컬 모델이 검증된 규칙과 진단 결과를 설명합니다. 학점 계산과 졸업 판정은 결정형 진단 엔진이 담당합니다.";
  if (intent === "system") return "성적표는 브라우저에서 분석합니다. 질문 문장과 최소 진단 요약은 이 PC의 로컬 앱 서버와 로컬 모델에서 처리됩니다.";
  if (intent === "general") return "졸업요건, 현재 학점, 부족 과목, 시간표 중 어떤 내용을 알고 싶은지 구체적으로 알려주세요.";
  if (intent === "early-graduation") return "조기졸업은 공통 졸업요건 외에 별도 신청 자격과 성적 기준을 확인해야 합니다. 승인된 학생 정책과 학과 안내를 확인하세요.";
  if (intent === "requirements") return `${audit.profile.admissionYear}학번 ${audit.profile.department}의 현재 진단에 적용된 총 졸업학점 기준은 ${audit.requiredTotal}학점입니다. 영역별 기준은 ${audit.categories.map(item => `${item.label} ${item.required}학점${item.evaluationStatus === "not-evaluable" ? "(판정 보류)" : ""}`).join(", ")}입니다. ${caveat(audit)}`.trim();
  if (intent === "certification") return audit.certificationEvidence !== "verified"
    ? "성적표만으로는 어학·봉사·자격증 증빙을 확인할 수 없어 졸업인증 충족 여부를 판정할 수 없습니다. 별도 증빙을 확인해 주세요."
    : `어학 인증은 ${audit.certification.language ? "충족" : "미충족"}, 활동·자격 인증은 ${audit.certification.activity ? "충족" : "미충족"}입니다.`;
  if (intent === "course-planning") {
    const day = question.match(/(월|화|수|목|금|토|일)요일/)?.[0];
    return `${creditSummary(audit)} ${shortageLines(audit)} ${courseLines(audit)} ${caveat(audit)} 실제 개설 여부와 분반 시간이 없어 시간표를 확정할 수 없습니다. ${day ? `${day} 공강` : "원하는 공강"}과 필수·졸업 보완 중 무엇을 우선할지 알려주세요.`.trim();
  }
  if (intent === "priority") return `우선 미이수 필수과목을 확인하세요. ${courseLines(audit)} 다음으로 부족 영역을 보완하세요. ${shortageLines(audit)} ${creditSummary(audit)} ${caveat(audit)}`.trim();
  if (intent === "recognition") return ["질문하신 개별 과목이 전공필수 등으로 인정되는지는 현재 진단 근거만으로 판단할 수 없습니다. 같은 학번·전공의 공식 교육과정과 승인된 대체과목 내역을 확인해야 합니다.", courseLines(audit), caveat(audit)].filter(Boolean).join("\n\n");
  if (intent === "missing-courses") return [courseLines(audit), audit.courses?.some(course => isFutureTranscriptTerm(course)) ? "미래 학기 행은 가상·미검증 이수내역이며 실제 취득학점으로 확인한 것이 아닙니다." : "", audit.courseMatch?.pendingCourseRecognitions.length ? "대체과목 인정은 승인 전까지 충족으로 확정하지 않습니다." : ""].filter(Boolean).join("\n\n");
  if (intent === "missing-areas") return `${shortageLines(audit)} ${caveat(audit)}`.trim();
  return [creditSummary(audit), shortageLines(audit), courseLines(audit), caveat(audit)].filter(Boolean).join("\n\n");
}

/** Calendar comparison labels uploaded future history without changing credit calculation. */
export function isFutureTranscriptTerm(course: { year: string; semester: string }, now = new Date()): boolean {
  const year = Number(course.year);
  const semester = /2|동계/.test(course.semester) ? 2 : /1|하계/.test(course.semester) ? 1 : 0;
  if (!Number.isInteger(year) || !semester) return false;
  const currentSemester = now.getMonth() >= 6 ? 2 : 1;
  return year > now.getFullYear() || year === now.getFullYear() && semester > currentSemester;
}
