import {
  deterministicAnswer,
  toolsForQuestion,
  type AssistantTool,
} from "../assistant-engine";
import { retrieveEvidence } from "../retrieval";
import { bundledRuleRegistry } from "../rule-registry";
import type { DetailedAudit, GraduationRuleSet, RuleKey } from "../types";
import { createLocalLLMProvider } from "./local-llm-provider";
import { getActiveRule } from "./rule-repository";
const ALLOWED_TOOLS = new Set<AssistantTool>([
  "loadStudentContext",
  "auditGraduation",
  "recommendCourses",
  "checkCertification",
  "explainRequirement",
]);
async function resolveRule(key: RuleKey): Promise<GraduationRuleSet> {
  let stored: GraduationRuleSet | null = null;
  try {
    stored = await getActiveRule(key);
  } catch {
    stored = null;
  }
  const rule = stored ?? bundledRuleRegistry.find(key);
  if (!rule || !["approved", "provisional"].includes(rule.status))
    throw new Error(
      "이 프로필에 승인 또는 임시 승인된 졸업요건 규칙이 없어 AI 상담을 시작할 수 없습니다.",
    );
  return rule;
}
function toolResult(tool: AssistantTool, audit: DetailedAudit) {
  const detailedCourseAudit = audit.courseMatch?.status === "verified"
    && ["cohort-catalog", "current-classification"].includes(audit.courseMatch.classificationSource ?? "");
  if (tool === "auditGraduation")
    return {
      earned: audit.earnedTotal,
      required: audit.requiredTotal,
      missingCourses: audit.missingCourses,
      categories: audit.categories,
      detailedCourseAudit,
      unevaluated: detailedCourseAudit ? [] : ["상세 필수과목", "대체·폐지과목", "교양 세부영역", "졸업인증"],
    };
  if (tool === "recommendCourses" && !detailedCourseAudit)
    return {
      recommended: [],
      blocked: true,
      reason: "정확한 학번·전공의 상세 필수·대체과목 규칙이 아직 승인되지 않았습니다.",
      categoryShortages: audit.categories.filter((item) => item.earned < item.required),
    };
  if (tool === "recommendCourses")
    return {
      recommended: audit.missingCourses.slice(0, 5),
      forecastCredits: audit.forecastCredits,
    };
  if (tool === "checkCertification") return audit.certification;
  if (tool === "loadStudentContext") return audit.profile;
  return {
    ruleVersion: audit.ruleVersion,
    caution: "최종 졸업사정은 학교 확인이 필요합니다.",
  };
}
export async function runAssistantAgent(
  question: string,
  audit: DetailedAudit,
  key: RuleKey,
) {
  const rule = await resolveRule(key);
  const evidence = retrieveEvidence(rule, question, 3);
  const provider = createLocalLLMProvider();
  let tools = toolsForQuestion(question);
  let mode: "local-llm" | "deterministic-fallback" = "deterministic-fallback";
  if (provider.configured) {
    try {
      const plan = JSON.parse(
        await provider.chat(
          [
            {
              role: "system",
              content: `허용 도구 ${[...ALLOWED_TOOLS].join(", ")} 중 필요한 것만 JSON {"tools":[]}로 고르라. 웹 검색 도구는 없다.`,
            },
            { role: "user", content: question },
          ],
          { json: true },
        ),
      ) as { tools?: string[] };
      const validated = (plan.tools ?? [])
        .filter((tool): tool is AssistantTool =>
          ALLOWED_TOOLS.has(tool as AssistantTool),
        )
        .slice(0, 3);
      if (validated.length) tools = validated;
      mode = "local-llm";
    } catch {}
  }
  const toolResults = Object.fromEntries(
    tools.map((tool) => [tool, toolResult(tool, audit)]),
  );
  let answer = deterministicAnswer(question, audit, evidence);
  if (mode === "local-llm") {
    try {
      answer = await provider.chat([
        {
          role: "system",
          content:
            "제공된 저장 규칙 근거와 도구 결과만 사용해 한국어로 답하라. verifiedScopes는 확정, provisionalScopes는 임시 판정으로 명확히 구분하라. 도구 결과에 blocked가 있거나 상세요건이 미검수이면 과목명을 추천하거나 충족으로 추정하지 마라. 편입생도 동일 교육과정의 졸업요건을 적용한다. 학생 정책 오버레이가 입력에 없으면 편입 인정 한도·최소 이수학기·조기졸업 가능 여부를 확정하지 말고 학교 확인이 필요하다고 알리라.",
        },
        {
          role: "user",
          content: JSON.stringify({
            question,
            profile: audit.profile,
            assurance: rule.assurance,
            evidence,
            toolResults,
          }),
        },
      ]);
    } catch {
      mode = "deterministic-fallback";
    }
  }
  const sourceIds = [...new Set(evidence.map((item) => item.sourceId))];
  return {
    answer,
    mode,
    provider: provider.name,
    tools,
    evidence,
    citations: rule.sources.filter((source) => sourceIds.includes(source.id)),
    ruleVersion: rule.version,
  };
}
