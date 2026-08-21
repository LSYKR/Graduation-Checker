"use client";
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  GitBranch,
  Globe2,
  History,
  Info,
  Layers3,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  UploadCloud,
  XCircle,
} from "lucide-react";
import {
  DEFAULT_RULE,
  transcriptAdapterRegistry,
} from "@/lib/rule-registry";
import type { IngestionDocument } from "@/lib/types";
import {
  EXPANSION_BATCH_LABELS,
  KMOU_CURRENT_UNIT_COUNT,
  KMOU_PROGRAM_OFFERINGS,
  getKmouProgramOptions,
} from "@/lib/kmou-program-catalog";
import { MAJOR_CURRICULUM_READINESS } from "@/lib/major-curriculum-readiness";
const stageLabels = {
  uploaded: "업로드",
  extracting: "구조화 중",
  review_pending: "검수 대기",
  approved: "승인·활성",
  rejected: "반려",
  gpt_pending: "GPT 설정 대기",
  failed: "검증 실패",
} as const;
const coverageByYear = [2020, 2021, 2022, 2023, 2024, 2025, 2026].map((year) => ({
  year,
  count: KMOU_PROGRAM_OFFERINGS.filter((item) => item.admissionYear === year).length,
  detailed: KMOU_PROGRAM_OFFERINGS.filter((item) => item.admissionYear === year && item.support === "detailed-provisional").length,
  partial: KMOU_PROGRAM_OFFERINGS.filter((item) => item.admissionYear === year && item.support === "partial-course-audit").length,
}));
const readiness2022ByBatch = Object.entries(EXPANSION_BATCH_LABELS).map(([id, label]) => {
  const programIds = new Set<string>(KMOU_PROGRAM_OFFERINGS.filter((item) => item.admissionYear === 2022 && item.batch === id).map((item) => item.programId));
  const records = MAJOR_CURRICULUM_READINESS.filter((item) => programIds.has(item.programId));
  return {
    id,
    label,
    exact: records.filter((item) => item.status === "exact-catalog").length,
    partial: records.filter((item) => item.status === "partial-required-courses").length,
    needed: records.filter((item) => item.status === "source-needed").length,
  };
});
export default function AdminView() {
  const [documents, setDocuments] = useState<IngestionDocument[]>([]);
  const [sourceUrl, setSourceUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [targetYear, setTargetYear] = useState(2022);
  const [targetProgramId, setTargetProgramId] = useState("computer-engineering");
  const targetPrograms = useMemo(() => getKmouProgramOptions(targetYear), [targetYear]);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/documents", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("문서 목록을 불러오지 못했습니다.");
      setDocuments(
        ((await response.json()) as { documents: IngestionDocument[] })
          .documents,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "문서 목록 오류");
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);
  async function collect() {
    if (!sourceUrl.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl, key: { universityId: "kmou", admissionYear: targetYear, departmentId: targetProgramId, studentType: "freshman" } }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "수집 실패");
      setNotice("공식 원본을 저장하고 규칙 후보 생성 단계로 보냈습니다.");
      setSourceUrl("");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "수집 실패");
    } finally {
      setBusy(false);
    }
  }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("universityId", "kmou");
      form.append("admissionYear", String(targetYear));
      form.append("departmentId", targetProgramId);
      form.append("studentType", "freshman");
      const response = await fetch("/api/admin/documents", {
        method: "POST",
        body: form,
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "업로드 실패");
      setNotice("공식 문서를 원본 그대로 저장했습니다.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "업로드 실패");
    } finally {
      setBusy(false);
    }
  }
  async function review(documentId: string, decision: "approve" | "reject") {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/documents/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, decision }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "검수 실패");
      setNotice(
        decision === "approve"
          ? "검수 승인한 규칙을 활성화했습니다."
          : "규칙 후보를 반려했습니다.",
      );
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "검수 실패");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="workspace-view admin-view">
      <div className="view-heading">
        <div>
          <span className="eyebrow">HOST INGESTION CONSOLE</span>
          <h1>공식 졸업요건 수집·구조화·승인</h1>
          <p>
            원본과 GPT 규칙 후보를 분리 저장하고 승인 상태와 임시 승인 상태를
            명확히 구분합니다.
          </p>
        </div>
        <span className="local-badge">
          <Database size={14} /> D1 + R2
        </span>
      </div>
      {error && (
        <div className="inline-alert error">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}
      {notice && (
        <div className="inline-alert">
          <CheckCircle2 size={16} />
          {notice}
        </div>
      )}
      <div className="admin-summary-grid">
        <article className="card admin-stat">
          <Building2 />
          <div>
            <span>대학 레지스트리</span>
            <strong>1</strong>
            <small>학교별 확장</small>
          </div>
        </article>
        <article className="card admin-stat">
          <Layers3 />
          <div>
            <span>정확 키 학점 규칙</span>
            <strong>{KMOU_PROGRAM_OFFERINGS.length}</strong>
            <small>{KMOU_CURRENT_UNIT_COUNT}개 현행 학부(과) · 23개 전공 이력</small>
          </div>
        </article>
        <article className="card admin-stat">
          <FileSpreadsheet />
          <div>
            <span>수집 원본</span>
            <strong>{documents.length}</strong>
            <small>해시 중복 방지</small>
          </div>
        </article>
        <article className="card admin-stat">
          <History />
          <div>
            <span>검수 대기</span>
            <strong>
              {
                documents.filter((item) => item.status === "review_pending")
                  .length
              }
            </strong>
            <small>승인 전 미사용</small>
          </div>
        </article>
      </div>
      <article className="card pipeline-card">
        <div className="section-title">
          <div><span className="card-kicker">COVERAGE MATRIX</span><h2>해양과학기술융합대학 2020~2026</h2></div>
          <span className="rule-chip">fail-closed</span>
        </div>
        <div className="ingestion-flow">
          {coverageByYear.map((item) => <span key={item.year}><strong>{item.year}</strong><small>{item.count}개 조합 · 상세 {item.detailed} · 부분 {item.partial}</small></span>)}
        </div>
        <div className="document-list">
          {readiness2022ByBatch.map((item) => (
            <div className="document-row" key={item.id}>
              <div><strong>{item.label}</strong><small>2022학번 · 전체표 {item.exact} · 부분표 {item.partial} · 원본 필요 {item.needed}</small></div>
              <span className={item.needed === 0 ? "status-approved" : "status-review_pending"}>{item.needed === 0 ? "완료" : `${item.needed}개 대기`}</span>
            </div>
          ))}
        </div>
      </article>
      <article className="card pipeline-card">
        <div className="section-title">
          <div>
            <span className="card-kicker">CONTROLLED PIPELINE</span>
            <h2>호스트 데이터 파이프라인</h2>
          </div>
          <ShieldCheck size={20} />
        </div>
        <div className="ingestion-flow">
          <span>공식 도메인</span>
          <i>→</i>
          <span>R2·SHA-256</span>
          <i>→</i>
          <span>GPT 후보</span>
          <i>→</i>
          <span>스키마 검증</span>
          <i>→</i>
          <span>관리자 승인</span>
          <i>→</i>
          <span>D1 활성화</span>
        </div>
        <p className="pipeline-note">과목코드·과목명·이수구분·학점과 정확한 입학학번·전공·원본 SHA-256·표 위치가 모두 있어야 상세 규칙으로 승격됩니다.</p>
      </article>
      <div className="admin-layout">
        <div className="admin-primary">
          <article className="card requirements-card">
            <div className="section-title">
              <div>
                <span className="card-kicker">INGESTION QUEUE</span>
                <h2>공식 문서와 규칙 후보</h2>
              </div>
              <button className="icon-button" onClick={() => void refresh()}>
                <RefreshCw size={15} />
              </button>
            </div>
            {documents.length === 0 ? (
              <div className="empty-queue">
                <FileSpreadsheet size={28} />
                <strong>저장된 공식 원본이 없습니다</strong>
                <p>오른쪽에서 공지 URL이나 파일을 추가하세요.</p>
              </div>
            ) : (
              <div className="document-list">
                {documents.map((document) => (
                  <div className="document-row" key={document.id}>
                    <div>
                      <strong>{document.fileName}</strong>
                      <small>
                        {document.admissionYear} 적용 ·{" "}
                        {document.transferEntryYear
                          ? `${document.transferEntryYear} 편입 · `
                          : ""}
                        {document.departmentId} · SHA{" "}
                        {document.sha256.slice(0, 10)}
                      </small>
                      {document.validationErrors.map((item) => (
                        <p key={item}>{item}</p>
                      ))}
                    </div>
                    <span className={`status-${document.status}`}>
                      {stageLabels[document.status]}
                    </span>
                    {document.status === "review_pending" && (
                      <div className="review-actions">
                        <button
                          onClick={() => void review(document.id, "approve")}
                        >
                          <CheckCircle2 size={13} /> 승인
                        </button>
                        <button
                          onClick={() => void review(document.id, "reject")}
                        >
                          <XCircle size={13} /> 반려
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </article>
          <article className="card override-card">
            <div className="section-title">
              <div>
                <span className="card-kicker">REVIEW REFERENCE ONLY</span>
                <h2>{DEFAULT_RULE.version}</h2>
              </div>
              <GitBranch size={19} />
            </div>
            <div className="rule-note-list">
              {DEFAULT_RULE.policies.map((note, index) => (
                <div key={note}>
                  <span>R-{index + 1}</span>
                  <p>{note}</p>
                  <em>임시 활성</em>
                </div>
              ))}
            </div>
          </article>
        </div>
        <aside className="admin-side">
          <article className="card collect-card">
            <Globe2 size={22} />
            <h2>학교 공식 URL 수집</h2>
            <p>kmou.ac.kr의 HTTPS 첨부만 수집합니다.</p>
            <select value={targetYear} onChange={(event) => {
              const year = Number(event.target.value);
              const options = getKmouProgramOptions(year);
              setTargetYear(year);
              setTargetProgramId(options.some((item) => item.programId === targetProgramId) ? targetProgramId : options[0]?.programId ?? "");
            }}>
              {[2020, 2021, 2022, 2023, 2024, 2025, 2026].map((year) => <option key={year} value={year}>{year} 적용</option>)}
            </select>
            <select value={targetProgramId} onChange={(event) => setTargetProgramId(event.target.value)}>
              {targetPrograms.map((item) => <option key={item.programId} value={item.programId}>{item.displayName}</option>)}
            </select>
            <input
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://www.kmou.ac.kr/..."
            />
            <button
              onClick={() => void collect()}
              disabled={busy || !sourceUrl.trim()}
            >
              {busy ? (
                <LoaderCircle className="spin" size={15} />
              ) : (
                <Globe2 size={15} />
              )}{" "}
              수집·구조화
            </button>
          </article>
          <article className="card rule-upload-card">
            <UploadCloud size={22} />
            <h2>공식 파일 직접 추가</h2>
            <p>
              PDF·Excel·DOCX·JSON 원본을 보관하며 GPT 결과는 자동 게시되지
              않습니다.
            </p>
            <label>
              <input
                type="file"
                accept=".pdf,.xlsx,.xls,.docx,.json"
                onChange={upload}
                hidden
              />
              파일 선택
            </label>
          </article>
          <article className="card expansion-card">
            <span className="card-kicker">EXTENSION CONTRACTS</span>
            <h2>다른 학교 확장 구조</h2>
            <code>공통 규칙: university → curriculumYear → department</code>
            <code>학생 오버레이: studentType → transferEntryYear</code>
            <p>
              <Info size={13} /> TranscriptAdapter·공통 규칙 JSON·학생 정책
              오버레이를 독립적으로 추가할 수 있습니다.
            </p>
            {transcriptAdapterRegistry.map((item) => (
              <small key={item.id}>
                {item.id} · {item.label}
              </small>
            ))}
          </article>
        </aside>
      </div>
    </section>
  );
}
