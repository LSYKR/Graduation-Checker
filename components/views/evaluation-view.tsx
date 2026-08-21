"use client";

import {
  Activity,
  Bot,
  Braces,
  CheckCircle2,
  Cpu,
  DatabaseZap,
  FileText,
  Gauge,
  GitCompareArrows,
  LockKeyhole,
  Network,
  Scale,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

const metrics = [
  { label: "합성 판정 검증", value: "45,296+", detail: "152개 학번·전공 조합", icon: Gauge, tone: "teal" },
  { label: "의도 라우팅", value: "12 / 12", detail: "평가 질문 세트", icon: GitCompareArrows, tone: "blue" },
  { label: "근거 포함률", value: "100%", detail: "답변별 공식 출처", icon: DatabaseZap, tone: "purple" },
  { label: "개인정보 전송", value: "0건", detail: "브라우저 로컬 분석", icon: LockKeyhole, tone: "navy" },
];

const risks = [
  { risk: "졸업 가능 여부를 확정적으로 표현", mitigation: "조건부 판정 문구와 학과 확인 항목을 분리", status: "적용" },
  { risk: "오래된 교육과정 인용", mitigation: "입학년도별 버전·원문 URL·검수일 저장", status: "적용" },
  { risk: "LLM의 학점 산술 오류", mitigation: "결정형 규칙 엔진만 학점 계산 가능", status: "적용" },
  { risk: "성적·학번 등 개인정보 노출", mitigation: "클라이언트 파싱, 학번 열 미수집, 로그 비식별화", status: "적용" },
];

export default function EvaluationView() {
  return (
    <section className="workspace-view evaluation-view">
      <div className="view-heading"><div><span className="eyebrow">COURSE PROJECT · LLM LIFECYCLE</span><h1>모델 설계, 평가, 책임 있는 AI</h1><p>승인 문서 RAG·로컬 LLM 도구 호출·결정형 판정·GPT 관리자 구조화를 하나의 서비스로 연결했습니다.</p></div><span className="local-badge ai"><Activity size={14} /> Evaluation v1.0</span></div>

      <div className="metric-grid">{metrics.map(({ label, value, detail, icon: Icon, tone }) => <article className={`card eval-metric ${tone}`} key={label}><span><Icon size={18} /></span><div><small>{label}</small><strong>{value}</strong><p>{detail}</p></div></article>)}</div>

      <article className="card architecture-card">
        <div className="section-title"><div><span className="card-kicker">DOMAIN LLM ARCHITECTURE</span><h2>신뢰 가능한 졸업 상담 파이프라인</h2></div><Network size={20} /></div>
        <div className="architecture-flow">
          <div><span><FileText size={20} /></span><strong>공식 문서</strong><small>Excel · 공지</small></div><i>→</i>
          <div><span><DatabaseZap size={20} /></span><strong>RAG 검색</strong><small>입학년도 필터</small></div><i>→</i>
          <div><span><Bot size={20} /></span><strong>로컬 LLM</strong><small>의도 · 설명</small></div><i>→</i>
          <div><span><Braces size={20} /></span><strong>도구 호출</strong><small>판정 · 추천</small></div><i>→</i>
          <div><span><CheckCircle2 size={20} /></span><strong>근거 응답</strong><small>출처 · 주의</small></div>
        </div>
      </article>

      <div className="evaluation-layout">
        <div className="evaluation-primary">
          <article className="card lifecycle-card">
            <div className="section-title"><div><span className="card-kicker">FULL LIFECYCLE</span><h2>수업 학습성과 반영</h2></div><Sparkles size={19} /></div>
            <div className="lifecycle-list">
              <div><span>01</span><div><strong>문제 정의·데이터</strong><p>복잡한 졸업요건을 구조화하고 실제 TIS 파일 형식을 정규화</p></div><em>완료</em></div>
              <div><span>02</span><div><strong>RAG·프롬프트·Agent</strong><p>질문 의도에 따라 검색과 판정·추천 도구를 선택</p></div><em>구현</em></div>
              <div><span>03</span><div><strong>PEFT 미세조정</strong><p>Qwen 계열 모델용 QLoRA 학습 스크립트와 의도 데이터셋 제공</p></div><em className="planned">선택 실험</em></div>
              <div><span>04</span><div><strong>평가·서빙 최적화</strong><p>정확도·근거성·안전성 평가, 결정형 fallback으로 안정적 데모</p></div><em>완료</em></div>
            </div>
          </article>
          <article className="card risk-card">
            <div className="section-title"><div><span className="card-kicker">RESPONSIBLE AI</span><h2>위험과 완화조치</h2></div><Scale size={20} /></div>
            <div className="table-scroll"><table><thead><tr><th>위험</th><th>완화조치</th><th>상태</th></tr></thead><tbody>{risks.map((item) => <tr key={item.risk}><td><ShieldAlert size={13} /> {item.risk}</td><td>{item.mitigation}</td><td><span className="verified"><CheckCircle2 size={12} /> {item.status}</span></td></tr>)}</tbody></table></div>
          </article>
        </div>
        <aside className="evaluation-side">
          <article className="card model-card"><div className="model-card-head"><span><Cpu size={22} /></span><div><small>MODEL CARD</small><strong>GradCompass Local Agent</strong></div></div><dl><div><dt>학생 상담</dt><dd>Qwen3.6 16B 등 로컬 LLM</dd></div><div><dt>문서 수집</dt><dd>관리자 GPT 구조화</dd></div><div><dt>판정</dt><dd>결정형 규칙 엔진</dd></div><div><dt>미연결 시</dt><dd>근거 기반 fallback</dd></div><div><dt>제한</dt><dd>최종 졸업사정 불가</dd></div></dl></article>
          <article className="card eval-dataset-card"><span className="card-kicker">EVALUATION SET</span><h2>테스트 구성</h2><div><span>6,384</span><p>전 학과 판정 시나리오</p></div><div><span>38,912</span><p>잔여학점 회계 불변식</p></div><div><span>04</span><p>개인정보·안전성</p></div><small>개인정보 없는 고정 시드 합성 데이터 · 테스트 코드는 evaluation 폴더에 포함</small></article>
        </aside>
      </div>
    </section>
  );
}
