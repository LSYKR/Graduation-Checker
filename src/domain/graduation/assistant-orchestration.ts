import { classifyQuestion, deterministicAnswer } from "./assistant-engine";
import { makeAssistantSummary } from "./assistant-summary";
import type { DetailedAudit, EvidenceChunk, OfficialSource, RuleKey } from "../../shared/types/graduation";

export interface AssistantReply { answer: string; mode: string; tools: string[]; evidence: EvidenceChunk[]; citations: OfficialSource[]; }
export type AssistantFetch = (input: string, init: RequestInit) => Promise<Response>;
export async function answerAssistantQuestion(question: string, audit: DetailedAudit, key: RuleKey | null, fetcher: AssistantFetch, evidence: EvidenceChunk[] = [], citations: OfficialSource[] = []): Promise<AssistantReply> {
  const intent = classifyQuestion(question);
  if (intent === "course-planning") return { answer: "개설 분반과 현재 진단을 확인해 시간표를 구성합니다.", mode: "기본 안내", tools: [], evidence: [], citations: [] };
  if (key) {
    try {
      const response = await fetcher("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, key, summary: makeAssistantSummary(audit, key) }) });
      if (!response.ok) throw new Error("Assistant unavailable");
      const data = await response.json() as AssistantReply;
      if (typeof data.answer !== "string" || !["grounded-llm", "deterministic-fallback"].includes(data.mode)) throw new Error("Invalid assistant response");
      return { ...data, mode: data.mode === "grounded-llm" ? "로컬 AI 상담" : "기본 안내" };
    } catch { /* Show locally computed result. */ }
  }
  if (!key && (intent === "requirements" || intent === "early-graduation")) return { answer: "이 학교·학번·전공에 맞는 확인된 규칙을 찾지 못했습니다. 정확한 졸업요건은 학과나 학사과에 확인해 주세요.", mode: "기본 안내", tools: [], evidence: [], citations: [] };
  const localEvidence = intent === "requirements" || intent === "early-graduation" ? evidence : [];
  return { answer: deterministicAnswer(question, audit, localEvidence), mode: "기본 안내", tools: [], evidence: localEvidence, citations: localEvidence.length ? citations : [] };
}
