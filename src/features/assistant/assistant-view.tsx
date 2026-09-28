"use client";
import { FormEvent, useMemo, useRef, useState } from "react";
import {
  Bot,
  ExternalLink,
  LoaderCircle,
  Send,
  ShieldCheck,
  User,
} from "lucide-react";
import { answerAssistantQuestion } from "@/domain/graduation/assistant-orchestration";
import { bundledRuleRegistry } from "@/domain/curriculum/rule-registry";
import { retrieveEvidence } from "@/domain/curriculum/retrieval";
import type { DetailedAudit, EvidenceChunk, OfficialSource } from "@/shared/types/graduation";
import { classifyQuestion } from "@/domain/graduation/assistant-engine";
import { parseSchedulePreferences, parseScheduleTerm, planSchedule, type SchedulePlan } from "@/domain/courses/schedule-planner";
import type { OfferingSnapshot } from "@/domain/courses/offering-snapshot";
import Timetable from "./timetable";
interface Message {
  id: number;
  role: "assistant" | "user";
  text: string;
  tools?: string[];
  evidence?: EvidenceChunk[];
  citations?: OfficialSource[];
  mode?: string;
  schedule?: SchedulePlan;
}
const quickQuestions = [
  "졸업하려면 지금 뭘 해야 해?",
  "아직 부족한 필수과목은 뭐야?",
  "편입생도 조기졸업할 수 있어?",
  "교양영역별 부족한 학점을 알려줘",
];
export default function AssistantView({ audit }: { audit: DetailedAudit }) {
  const rule = useMemo(() => audit.profile.universityId && audit.profile.departmentId
    ? bundledRuleRegistry.find({
      universityId: audit.profile.universityId,
      admissionYear: audit.profile.admissionYear,
      departmentId: audit.profile.departmentId,
    }) : null, [audit.profile.admissionYear, audit.profile.departmentId, audit.profile.universityId]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const nextId = useRef(2);
  const pendingScheduleQuestion = useRef<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: "assistant",
      text: "안녕하세요. 졸업요건이나 남은 학점에 관해 궁금한 점을 물어보세요. 확인된 자료를 바탕으로 답변하겠습니다.",


    },
  ]);
  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || busy) return;
    setInput("");
    setBusy(true);
    setMessages((current) => [
      ...current,
      { id: nextId.current++, role: "user", text: trimmed },
    ]);
    try {
      const clarificationReply = pendingScheduleQuestion.current && /^(?:온라인|원격|비대면).*(?:공강|괜찮|제외)|^(?:수업 자체|수업도 제외)/.test(trimmed);
      const scheduleQuestion = clarificationReply ? `${pendingScheduleQuestion.current} ${trimmed}` : trimmed;
      if (classifyQuestion(scheduleQuestion) === "course-planning") {
        const preference = parseSchedulePreferences(scheduleQuestion);
        const explicitTerm = parseScheduleTerm(scheduleQuestion);
        const now = new Date();
        const koreanMonth = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", month: "numeric" }).format(now));
        const koreanYear = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", year: "numeric" }).format(now));
        const term = explicitTerm ? explicitTerm : koreanMonth < 3 ? `${koreanYear - 1}-2` : `${koreanYear}-${koreanMonth < 9 ? 1 : 2}`;
        let snapshot: Pick<OfferingSnapshot, "term" | "status" | "sections" | "provenance"> | null = null;
        try {
          const response = await fetch(`/api/course-offerings?term=${encodeURIComponent(term)}`);
          if (response.ok) snapshot = ((await response.json()) as { snapshot: typeof snapshot }).snapshot;
        } catch { /* No verified snapshot available. */ }
        const plan = planSchedule(audit, rule, snapshot, term, preference);
        pendingScheduleQuestion.current = plan.clarification ? scheduleQuestion : null;
        const answer = [plan.sections.length ? `${plan.term} ${plan.sections.length}과목 · ${plan.sections.reduce((sum, section) => sum + section.credits, 0)}학점 시간표를 만들었습니다.` : "확인된 분반 시간표를 만들 수 없습니다.", ...plan.notes.filter(note => !/학점 한도|수강 대상|폐강 여부|졸업 규칙|전체 목록/.test(note)).slice(0, 2).map(note => `• ${note}`), ...(plan.unmetConditions?.length ? [`• 남은 조건: ${plan.unmetConditions.join(", ")}`] : []), plan.clarification, !preference.maxCredits && plan.sections.length ? "원하는 최대 학점을 알려주시면 그 한도에 맞춰 조정할게요. 현재 안에는 개인 수강 한도를 적용하지 않았습니다." : undefined].filter(Boolean).join("\n\n");
        setMessages(current => [...current, { id: nextId.current++, role: "assistant", text: answer, schedule: plan, mode: "검증된 강좌 안내" }]);
        return;
      }
      const evidence = rule ? retrieveEvidence(rule, trimmed, 3) : [];
      const citations = rule?.sources.filter((source) => evidence.some((item) => item.sourceId === source.id)) ?? [];
      const reply = await answerAssistantQuestion(trimmed, audit, rule?.key ?? null, fetch, evidence, citations);
      setMessages((current) => [...current, {
        id: nextId.current++, role: "assistant", text: reply.answer,
        tools: reply.tools, evidence: reply.evidence, citations: reply.citations, mode: reply.mode,
      }]);
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(input);
  }
  return (
    <section className="workspace-view assistant-view">
      <div className="view-heading">
        <div>
          <span className="eyebrow">AI 졸업 상담</span>
          <h1>궁금한 졸업요건을 물어보세요</h1>
          <p>내 성적표와 확인된 졸업요건을 바탕으로 필요한 과목과 학점을 설명해 드립니다.</p>
        </div>
        <span className="local-badge ai">
          <Bot size={14} /> 로컬 AI 상담
        </span>
      </div>
      <div className="assistant-layout">
        <article className="card chat-card">
          <div className="chat-toolbar">
            <div>
              <div>
                <strong>AI 졸업 상담</strong>
                <small>졸업요건과 이수 현황을 질문해 보세요</small>
              </div>
            </div>
            <span className="agent-runtime">
              <ShieldCheck size={13} /> 로컬 처리
            </span>
          </div>
          <div className="message-list">
            {messages.map((message) => (
              <div className={`message ${message.role}${message.schedule ? " has-schedule" : ""}`} key={message.id}>
                <span className="message-avatar">
                  {message.role === "assistant" ? (
                    <Bot size={15} />
                  ) : (
                    <User size={15} />
                  )}
                </span>
                <div className="message-content">
                  {message.mode && (
                    <small className="runtime-label">{message.mode}</small>
                  )}
                  <p>{message.text}</p>
                  {message.schedule && message.schedule.sections.length > 0 && <>
                    <Timetable plan={message.schedule} />
                    {message.schedule.alternatives.length > 0 && message.schedule.alternatives.map(x => x.id).join("|") !== message.schedule.sections.map(x => x.id).join("|") && <details className="schedule-alternative"><summary>공강 우선 대안 보기</summary>
                      <p>기본 안에서 빠진 분반: {message.schedule.sections.filter(x => !message.schedule!.alternatives.some(y => y.id === x.id)).map(x => `${x.title} ${x.section}분반 (${x.courseCode})`).join(", ") || "없음"}. 빠진 과목은 이 학기에 보완하지 못할 수 있습니다.</p>
                      <Timetable plan={{ ...message.schedule, sections: message.schedule.alternatives, alternatives: [] }} />
                    </details>}
                  </>}
                  {message.citations && (
                    <div className="citation-row">
                      {message.citations.map((source) => (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          key={source.id}
                        >
                          {source.title} <ExternalLink size={10} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="message assistant">
                <span className="message-avatar">
                  <Bot size={15} />
                </span>
                <div className="message-content">
                  <p>
                    <LoaderCircle className="spin" size={14} /> 진단 결과와 근거를 확인하고 있어요.
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="quick-questions">
            {quickQuestions.map((question) => (
              <button
                key={question}
                onClick={() => void ask(question)}
                disabled={busy}
              >
                {question}
              </button>
            ))}
          </div>
          <p className="ai-disclaimer">질문 문장(직접 적은 개인정보 포함)과 최소 진단 요약은 이 PC의 로컬 앱 서버와 로컬 모델에서 처리됩니다. 성적표 원본은 전송하지 않습니다.</p>
          <form className="chat-input" onSubmit={submit}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="졸업요건이나 부족한 학점을 물어보세요"
            />
            <button disabled={busy || !input.trim()} aria-label="질문 보내기">
              <Send size={17} />
            </button>
          </form>
          <p className="ai-disclaimer">
            <ShieldCheck size={12} /> 저장된 정확 학번·전공 규칙만 사용합니다. 미검수 상세요건은
            충족으로 추정하지 않으며 최종 졸업사정은 학사과·학과사무실 확인이 필요합니다.
          </p>
        </article>
      </div>
    </section>
  );
}
