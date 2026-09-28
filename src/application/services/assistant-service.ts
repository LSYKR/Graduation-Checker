import { createLLMProvider } from "../../infrastructure/llm/providers";
import type { LLMProvider } from "../ports/llm-provider";
import { bundledRuleRegistry } from "../../domain/curriculum/rule-registry";
import { retrieveEvidence } from "../../domain/curriculum/retrieval";
import { classifyQuestion } from "../../domain/graduation/assistant-engine";
import { assistantGuidanceText } from "../../domain/graduation/assistant-summary";
import type { AssistantSummary } from "../../domain/graduation/assistant-summary";
import type { RuleKey } from "../../shared/types/graduation";
import { loadEnvironment } from "../../shared/config/environment";
import { RequestError } from "../../infrastructure/http/request-utils";
import { routeQuestion } from "./llm-router";

const prefix = /^(?:먼저, |또한, |이어서, |함께 살펴보면, )?\{\{([a-zA-Z]+)\}\}\.$/;
export function renderGroundedExplanation(content: string, facts: Record<string, string>, required: string[] = ["scope", "total"]): string | null {
  let parsed: unknown;
  try { parsed = JSON.parse(content); } catch { return null; }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const value = parsed as Record<string, unknown>;
  if (Object.keys(value).length !== 1 || !Array.isArray(value.sentences) || value.sentences.length < 1 || value.sentences.length > 6) return null;
  const seen = new Set<string>();
  const rendered: string[] = [];
  for (const sentence of value.sentences) {
    if (typeof sentence !== "string" || sentence.length > 400) return null;
    const clauses = sentence.split(". ");
    if (clauses.length > 6 || seen.size + clauses.length > 6) return null;
    const parts: string[] = [];
    for (const [index, part] of clauses.entries()) {
      const clause = index < clauses.length - 1 ? `${part}.` : part;
      const match = prefix.exec(clause);
      if (!match || !Object.hasOwn(facts, match[1]) || typeof facts[match[1]] !== "string" || !facts[match[1]] || seen.has(match[1])) return null;
      seen.add(match[1]);
      parts.push(clause.replace(`{{${match[1]}}}`, facts[match[1]]));
    }
    rendered.push(parts.join("\n\n"));
  }
  return required.every(id => seen.has(id)) ? rendered.join("\n\n") : null;
}

function personalFacts(summary: AssistantSummary, conciseCourses = false) {
  const totalGap = Math.max(0, summary.requiredTotal - summary.earnedTotal);
  const applicableGap = Math.max(0, summary.requiredTotal - summary.applicableEarnedTotal);
  const course = summary.courseGuidance ? assistantGuidanceText(summary.courseGuidance) : summary.missingCourses.length ? `확인된 미이수 후보는 ${summary.missingCourses.map(x => `${x.name} ${x.credits}학점${x.required ? "(필수)" : "(권장)"}`).join(", ")}입니다` : "확인된 남은 필수과목 없음. 전체 과목 요건 목록은 미확인입니다";
  const shortages = [...summary.categories, ...summary.generalEducation].filter(x => x.shortage > 0);
  const area = shortages.length ? `영역별 학점 현황은 ${shortages.map(x => x.review ? `${x.label} 기준과의 차이 ${x.shortage}학점(판정 보류 · 확정 부족량 아님)` : `${x.label} ${x.shortage}학점`).join(", ")}입니다` : "확인된 영역별 부족학점은 없습니다";
  const notes: string[] = [];
  if (summary.caveats.futureHistoryUnverified) notes.push("미래 학기 행은 가상·미검증 이수내역이며 실제 취득학점으로 확인한 것이 아닙니다");
  if (!conciseCourses) for (const category of summary.categories) notes.push(`${category.label}: 공식 확인 ${category.confirmed}학점 · 성적표 보고 ${category.reported}학점 · 인정 대기 ${category.pending}학점`);
  if (summary.ruleStatus === "draft" || summary.ruleStatus === "provisional") notes.push("적용 규칙이 잠정 상태입니다");
  if (summary.caveats.requiredCourseSetReview || summary.caveats.programEvidenceInsufficient) notes.push("전체 전공 필수과목 목록은 검토 중이며 공식 근거가 확인된 개별 과목의 판정은 유지합니다");
  if (summary.caveats.pendingRecognition) notes.push("대체과목 인정은 승인 전까지 확정할 수 없습니다");
  if (summary.caveats.certificationUnverified) notes.push("졸업인증은 별도 증빙 확인이 필요합니다");
  if (summary.caveats.generalEducationInconclusive) notes.push("교양 세부영역 판정은 보류될 수 있습니다");
  return {
    status: `현재 총 ${summary.earnedTotal}/${summary.requiredTotal}학점이며 적용 가능 학점은 ${summary.applicableEarnedTotal}학점입니다`,
    gap: `총학점 차이는 ${totalGap}학점이고 적용 가능 학점 기준 부족은 ${applicableGap}학점입니다`,
    forecast: summary.overallStatus === "evaluated" ? `필수과목과 영역을 함께 고려한 최소 보완량은 ${summary.forecastCredits}학점입니다` : (summary.creditEvaluationStatus ?? summary.overallStatus) === "evaluated" ? `확인된 영역과 학점 기준 최소 보완량은 ${summary.forecastCredits}학점입니다. 전체 필수과목과 졸업인증의 최종 확인은 별도입니다` : `판정이 보류되어 예상 보완량 약 ${summary.forecastCredits}학점은 거친 추정입니다`,
    courses: course, areas: area,
    caveat: notes.length ? (conciseCourses ? notes.filter(n => /미래|승인|전체 전공/.test(n)).slice(0, 2) : notes).join(". ") || "최종 졸업사정은 학과와 학사과에서 확인해야 합니다" : "최종 졸업사정은 학과와 학사과에서 확인해야 합니다",
  };
}

export async function runGeneralAssistant(question: string, key: RuleKey, summary: AssistantSummary | null = null, provider: LLMProvider | null = createLLMProvider(), largeProvider?: LLMProvider | null) {
  const rule = bundledRuleRegistry.find(key);
  if (!rule) throw new RequestError("지원하는 학년도·전공 규칙을 찾지 못했습니다.", 404);
  if (summary && summary.requiredTotal !== rule.requiredTotal) throw new RequestError("선택한 규칙과 진단 요약이 일치하지 않습니다.");
  const intent = classifyQuestion(question);
  const sources = rule.sources.filter(x => (!x.appliesToAdmissionYears || x.appliesToAdmissionYears.includes(key.admissionYear)) && (!x.appliesToDepartmentIds || x.appliesToDepartmentIds.includes(key.departmentId)) && (!x.evidenceScope || x.evidenceScope.departmentId === key.departmentId));
  const evidence = retrieveEvidence(rule, question, 3).filter(x => sources.some(s => s.id === x.sourceId));
  const config = loadEnvironment();
  const large = largeProvider === undefined && arguments.length < 4 && config.largeModel ? createLLMProvider({ ...config, baseUrl: config.largeBaseUrl, model: config.largeModel }) : largeProvider;
  let selectedProvider = provider;
  let model = config.model;
  if (provider && large) {
    const routing = await routeQuestion(question, provider, large);
    if (routing.provider === "large") { selectedProvider = large; model = config.largeModel ?? "추가 로컬"; }
    else if (routing.provider === "disabled") selectedProvider = null;
  }
  const facts: Record<string, string> = {};
  let required: string[];
  let selected: string[];
  if (intent === "greeting") { facts.greeting = "안녕하세요. 졸업요건과 현재 진단, 부족한 과목을 물어보세요"; selected = required = ["greeting"]; }
  else if (intent === "model") { facts.model = selectedProvider ? `이 상담은 이 PC에 설정된 로컬 ${model} 모델을 사용해 검증된 규칙과 진단 결과를 설명합니다` : "현재 모델 응답 없이 검증된 규칙과 진단 결과로 기본 안내를 제공합니다"; facts.role = "학점 계산과 졸업 판정은 결정형 진단 엔진이 담당합니다"; selected = required = ["model", "role"]; }
  else if (intent === "system") { facts.system = selectedProvider ? "질문과 최소 진단 요약은 이 PC의 로컬 앱 서버와 로컬 모델에서 처리됩니다. 성적표 원본은 브라우저에서 분석합니다" : "질문과 최소 진단 요약은 이 PC의 로컬 앱 서버에서 처리됩니다. 현재 모델 응답은 사용하지 않습니다. 성적표 원본은 브라우저에서 분석합니다"; selected = required = ["system"]; }
  else if (intent === "general") { facts.clarify = "졸업요건, 현재 학점, 부족 과목, 시간표 중 어떤 내용을 알고 싶은지 구체적으로 알려주세요"; selected = required = ["clarify"]; }
  else if (intent === "course-planning") { facts.schedule = "검수된 2026-2 개설강좌 스냅샷으로 대시보드에서 시간표 후보를 구성할 수 있습니다. 상담 답변만으로 시간표나 공강을 확정하지 않습니다"; facts.scheduleHelp = "2026-2 외 학기와 스냅샷에 없는 분반의 개설 여부는 확인되지 않았습니다"; selected = required = ["schedule", "scheduleHelp"]; }
  else if (["requirements", "early-graduation", "certification"].includes(intent)) {
    facts.scope = `${rule.profileLabel}에 적용되는 자료입니다`;
    facts.total = `총 필요학점은 ${rule.requiredTotal}학점입니다`;
    facts.categories = `영역별 필요학점은 ${rule.credits.map(x => `${x.label} ${x.required}학점`).join(", ")}입니다`;
    facts.limits = rule.assurance?.warning || "세부 과목과 개인 이수 현황은 별도 확인이 필요합니다";
    if (evidence[0]) facts.evidence = `관련 근거에는 ${evidence[0].text.replace(/[.!?]+$/, "")}라고 적혀 있습니다`;
    facts.early = "조기졸업은 별도 신청 자격과 성적 기준을 학과에서 확인해야 합니다";
    facts.certification = rule.certifications.length ? `규칙에 ${rule.certifications.map(x => x.label).join(", ")} 항목이 있으며 개인 충족 여부는 증빙을 확인해야 합니다` : "이 규칙만으로 인증 충족 여부를 판단할 수 없습니다";
    const topic = intent === "early-graduation" ? "early" : intent === "certification" ? "certification" : "categories";
    required = ["scope", "total", topic, "limits"]; selected = [...required, ...(facts.evidence ? ["evidence"] : [])];
  } else if (summary) {
    Object.assign(facts, personalFacts(summary, intent === "missing-courses" || intent === "recognition"));
    if (intent === "recognition") {
      facts.recognition = "질문하신 개별 과목이 전공필수 등으로 인정되는지는 이 진단 요약만으로 판단할 수 없습니다. 같은 학번·전공의 공식 교육과정과 승인된 대체과목 내역을 확인해야 합니다";
      required = ["recognition", "courses", "caveat"];
    }
    else if (intent === "missing-courses") required = ["courses", "caveat"];
    else if (intent === "missing-areas") required = ["areas", "caveat"];
    else if (intent === "priority") required = ["courses", "areas", "caveat"];
    else required = ["status", "gap", "forecast", "caveat"];
    selected = [...required, ...(intent === "audit" ? ["courses", "areas"] : [])];
  } else { facts.unavailable = "진단 요약이 없어 개인 이수 현황을 설명할 수 없습니다"; selected = required = ["unavailable"]; }
  const fallback = required.map(id => /[.!?]$/.test(facts[id]) ? facts[id] : `${facts[id]}.`).join("\n\n");
  let answer = fallback;
  let mode = "deterministic-fallback";
  if (selectedProvider) {
    const selectedFacts = Object.fromEntries(selected.map(id => [id, facts[id]]));
    const example = JSON.stringify({ sentences: required.map(id => `{{${id}}}.`) });
    const instructions = `자리표시자 ID만 골라 JSON으로 답하세요. 자리표시자 안의 실제 문구는 서버가 나중에 채웁니다. 사실, 설명, ID 이름 자체, 새 자리표시자를 출력하지 마세요. JSON 객체의 sentences 배열에 1~6개 문자열만 넣으세요. 각 문자열은 '{{id}}.' 형태로 쓰고, 선택적으로 '먼저, ', '또한, ', '이어서, ', '함께 살펴보면, '를 앞에 붙일 수 있습니다. 필수 ID는 모두 한 번씩 포함하세요: ${required.join(", ")}. 사용 가능한 ID: ${selected.join(", ")}. 정확한 유효 응답 예시: ${example} 다른 텍스트나 마크다운 없이 JSON만 반환하세요. /no_think`;
    try {
      const response = await selectedProvider.chat({ messages: [{ role: "system", content: instructions }, { role: "user", content: question }], structured: true, maxOutputTokens: 320 });
      const rendered = renderGroundedExplanation(response.content, selectedFacts, required);
      if (rendered) { answer = rendered; mode = "grounded-llm"; }
    } catch { /* Return verified deterministic facts. */ }
  }
  if (intent === "model" && mode === "deterministic-fallback") answer = "현재 모델 응답 없이 검증된 규칙과 진단 결과로 기본 안내를 제공합니다.\n\n학점 계산과 졸업 판정은 결정형 진단 엔진이 담당합니다.";
  const citedEvidence = facts.evidence && answer.includes(facts.evidence) ? evidence.slice(0, 1) : [];
  return { answer, mode, provider: selectedProvider ? "local" : "disabled", tools: [], evidence: citedEvidence, citations: sources.filter(s => citedEvidence.some(e => e.sourceId === s.id)), ruleVersion: rule.version };
}
