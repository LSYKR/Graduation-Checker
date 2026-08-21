"use client";
import { FormEvent, useMemo, useRef, useState } from "react";
import {
  Bot,
  Braces,
  CheckCircle2,
  ExternalLink,
  FileSearch,
  LoaderCircle,
  Send,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { deterministicAnswer } from "@/lib/assistant-engine";
import { DEFAULT_RULE, bundledRuleRegistry } from "@/lib/rule-registry";
import { retrieveEvidence } from "@/lib/retrieval";
import type { DetailedAudit, EvidenceChunk, OfficialSource } from "@/lib/types";
interface Message {
  id: number;
  role: "assistant" | "user";
  text: string;
  tools?: string[];
  evidence?: EvidenceChunk[];
  citations?: OfficialSource[];
  mode?: string;
}
const quickQuestions = [
  "졸업하려면 지금 뭘 해야 해?",
  "다음 학기 과목을 추천해줘",
  "편입생도 조기졸업할 수 있어?",
  "금요일 공강을 만들고 싶어",
];
export default function AssistantView({ audit }: { audit: DetailedAudit }) {
  const rule = useMemo(() => bundledRuleRegistry.find({
    universityId: audit.profile.universityId ?? "kmou",
    admissionYear: audit.profile.admissionYear,
    departmentId: audit.profile.departmentId ?? "computer-engineering",
  }) ?? DEFAULT_RULE, [audit.profile.admissionYear, audit.profile.departmentId, audit.profile.universityId]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const nextId = useRef(2);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: "assistant",
      text: "안녕하세요. 검증된 교양영역과 임시 승인된 분석 결과의 범위를 구분해 답합니다. 인터넷 검색 없이 저장된 규칙을 검색하고 계산은 결정형 엔진에 맡깁니다.",
      tools: ["loadStudentContext"],
      evidence: rule.evidence.slice(0, 1),
      citations: rule.sources.slice(0, 1),
      mode: "준비됨",
    },
  ]);
  const latestEvidence = useMemo(
    () =>
      [...messages].reverse().find((message) => message.evidence?.length)
        ?.evidence ?? rule.evidence.slice(0, 3),
    [messages, rule],
  );
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
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          audit,
          key: rule.key,
        }),
      });
      if (!response.ok) throw new Error();
      const data = (await response.json()) as {
        answer: string;
        mode: string;
        provider: string;
        tools: string[];
        evidence: EvidenceChunk[];
        citations: OfficialSource[];
      };
      setMessages((current) => [
        ...current,
        {
          id: nextId.current++,
          role: "assistant",
          text: data.answer,
          tools: data.tools,
          evidence: data.evidence,
          citations: data.citations,
          mode:
            data.mode === "local-llm"
              ? `로컬 LLM · ${data.provider}`
              : "결정형 fallback",
        },
      ]);
    } catch {
      const evidence = retrieveEvidence(rule, trimmed, 3);
      setMessages((current) => [
        ...current,
        {
          id: nextId.current++,
          role: "assistant",
          text: deterministicAnswer(trimmed, audit, evidence),
          tools: ["auditGraduation", "explainRequirement"],
          evidence,
          citations: rule.sources.filter((source) =>
            evidence.some((item) => item.sourceId === source.id),
          ),
          mode: "브라우저 fallback",
        },
      ]);
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
          <span className="eyebrow">LOCAL LLM · GROUNDED AGENT</span>
          <h1>저장된 근거만 사용하는 AI 졸업 상담</h1>
          <p>
            로컬 모델이 질문 의도와 도구를 고르고, 검증·임시 승인 범위를 표시한
            규칙 엔진이 계산합니다. 실행 중 웹 검색은 하지 않습니다.
          </p>
        </div>
        <span className="local-badge ai">
          <Bot size={14} /> Local-first
        </span>
      </div>
      <div className="assistant-layout">
        <article className="card chat-card">
          <div className="chat-toolbar">
            <div>
              <span className="bot-orb">
                <Sparkles size={16} />
              </span>
              <div>
                <strong>GradCompass Agent</strong>
                <small>
                  <i /> 규칙 {audit.ruleVersion ?? DEFAULT_RULE.version}
                </small>
              </div>
            </div>
            <span className="agent-runtime">
              <ShieldCheck size={13} /> 저장 근거 전용
            </span>
          </div>
          <div className="message-list">
            {messages.map((message) => (
              <div className={`message ${message.role}`} key={message.id}>
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
                  {message.tools && (
                    <div className="tool-row">
                      {message.tools.map((tool) => (
                        <span key={tool}>
                          <Braces size={10} /> {tool}
                        </span>
                      ))}
                    </div>
                  )}
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
                    <LoaderCircle className="spin" size={14} /> 저장된 근거와
                    판정 도구를 확인하고 있어요.
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
          <form className="chat-input" onSubmit={submit}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="졸업요건이나 다음 학기 계획을 물어보세요"
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
        <aside className="assistant-side">
          <article className="card retrieval-card">
            <span className="card-kicker">RETRIEVED EVIDENCE</span>
            <h2>실제 검색된 규칙 근거</h2>
            {latestEvidence.map((item, index) => (
              <div className="retrieval-item" key={item.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.sourceId}</small>
                  <p>{item.text}</p>
                </div>
              </div>
            ))}
          </article>
          <article className="card trust-card">
            <FileSearch size={20} />
            <h2>역할 분리</h2>
            <ol>
              <li>
                <span>1</span>로컬 LLM: 의도·도구 선택
              </li>
              <li>
                <span>2</span>규칙 엔진: 학점·충족 판정
              </li>
              <li>
                <span>3</span>RAG: 저장 문서 근거 검색
              </li>
              <li>
                <span>4</span>GPT: 관리자 문서 구조화만
              </li>
            </ol>
            <p>
              <CheckCircle2 size={14} /> 학생 상담 단계에는 GPT API가 필요하지
              않습니다.
            </p>
          </article>
        </aside>
      </div>
    </section>
  );
}
