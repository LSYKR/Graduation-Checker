"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  FileCheck2,
  FileSpreadsheet,
  Info,
  LockKeyhole,
  UploadCloud,
} from "lucide-react";
import { auditTranscript, categoryLabel, parseTranscriptBuffer } from "@/lib/graduation-engine";
import { DEFAULT_RULE, bundledRuleRegistry, fetchActiveRule } from "@/lib/rule-registry";
import type { DetailedAudit, GraduationRuleSet, StudentProfile } from "@/lib/types";

interface UploadViewProps {
  audit: DetailedAudit;
  onAudit: (audit: DetailedAudit) => void;
  onShowDashboard: () => void;
}

interface FileInfo {
  name: string;
  size: number;
  rows: number;
  excluded: number;
  warnings: string[];
}

export default function UploadView({ audit, onAudit, onShowDashboard }: UploadViewProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const profile: StudentProfile = {
    universityId: audit.profile.universityId ?? "kmou",
    admissionYear: audit.profile.admissionYear,
    transferEntryYear: audit.profile.transferEntryYear,
    departmentId: audit.profile.departmentId ?? "computer-engineering",
    department: audit.profile.department,
    studentType: audit.profile.studentTypeCode ?? "freshman",
    studentTypeLabel: audit.profile.studentType,
  };
  const [activeRule, setActiveRule] = useState<GraduationRuleSet>(() => bundledRuleRegistry.find(profile) ?? DEFAULT_RULE);

  async function processFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      if (!/\.(xlsx|xls)$/i.test(file.name)) {
        throw new Error(".xlsx 또는 .xls 형식의 성적 파일만 업로드할 수 있습니다.");
      }
      const rule = await fetchActiveRule(profile);
      setActiveRule(rule);
      const parsed = parseTranscriptBuffer(await file.arrayBuffer(), rule);
      const nextAudit = auditTranscript(parsed.courses, rule, profile);
      onAudit(nextAudit);
      setFileInfo({
        name: file.name,
        size: file.size,
        rows: parsed.recognizedRows,
        excluded: parsed.excludedRows,
        warnings: parsed.warnings,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "파일을 분석하지 못했습니다.");
      setFileInfo(null);
    } finally {
      setBusy(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void processFile(event.dataTransfer.files[0]);
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    void processFile(event.target.files?.[0]);
    event.target.value = "";
  }

  return (
    <section className="workspace-view upload-view">
      <div className="view-heading">
        <div>
          <span className="eyebrow">LOCAL TRANSCRIPT ANALYSIS</span>
          <h1>성적표를 올리면 바로 진단해드려요</h1>
          <p>종합정보시스템에서 내려받은 파일을 브라우저 안에서만 읽습니다. 원본 파일과 성적은 서버로 전송하지 않습니다.</p>
        </div>
        <span className="local-badge"><LockKeyhole size={14} /> 기기 내 처리</span>
      </div>

      <div className="upload-layout">
        <div className="upload-primary">
          <article className="card profile-form-card">
            <div className="step-heading"><span>1</span><div><strong>학생 유형 확인</strong><small>적용할 교육과정을 선택합니다.</small></div><em>확인됨 <Check size={12} /></em></div>
            <div className="profile-fields">
              <label>입학년도<select value={profile.admissionYear} disabled><option value={profile.admissionYear}>{profile.admissionYear}</option></select></label>
              <label>학부(과)·전공<select value={profile.departmentId} disabled><option value={profile.departmentId}>{profile.department}</option></select></label>
              <label>학생 구분<select value={profile.studentType} disabled><option value={profile.studentType}>{profile.studentTypeLabel}</option></select></label>
            </div>
            <p className="form-note"><Info size={13} /> 현재 {activeRule.status === "provisional" ? "임시 승인" : "승인"} 규칙: {activeRule.profileLabel} · {activeRule.version}</p>
          </article>

          <article className="card upload-card">
            <div className="step-heading"><span>2</span><div><strong>성적 파일 업로드</strong><small>Excel 파일의 첫 번째 시트를 자동으로 인식합니다.</small></div></div>
            <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={handleInput} hidden />
            <div
              className={`dropzone ${dragging ? "dragging" : ""} ${fileInfo ? "success" : ""}`}
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              {fileInfo ? <FileCheck2 size={38} /> : <UploadCloud size={38} />}
              <strong>{fileInfo ? "파일 분석이 끝났습니다" : "성적 파일을 여기에 놓아주세요"}</strong>
              <span>{fileInfo ? `${fileInfo.name} · ${(fileInfo.size / 1024).toFixed(1)} KB` : "또는 아래 버튼으로 파일을 선택하세요"}</span>
              <button onClick={() => inputRef.current?.click()} disabled={busy}>{busy ? "분석 중…" : fileInfo ? "다른 파일 선택" : "Excel 파일 선택"}</button>
              <small>.xlsx · .xls / 파일은 업로드되지 않습니다</small>
            </div>
            {error && <div className="inline-alert error"><AlertTriangle size={16} /><span>{error}</span></div>}
            {fileInfo && (
              <div className="parse-summary">
                <div><span>인식 행</span><strong>{fileInfo.rows}</strong></div>
                <div><span>취득학점</span><strong>{audit.earnedTotal}</strong></div>
                <div><span>재분류</span><strong>{audit.reclassifiedCount}</strong></div>
                <div><span>제외 행</span><strong>{fileInfo.excluded}</strong></div>
              </div>
            )}
            {fileInfo?.warnings.map((warning) => <div className="inline-alert" key={warning}><Info size={15} /><span>{warning}</span></div>)}
          </article>

          {fileInfo && (
            <article className="card parsed-table-card">
              <div className="section-title"><div><span className="card-kicker">PARSE PREVIEW</span><h2>인식한 교과목</h2></div><span>상위 8개 표시</span></div>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>년도/학기</th><th>과목번호</th><th>교과목명</th><th>원 구분</th><th>판정 구분</th><th>학점</th><th>등급</th></tr></thead>
                  <tbody>
                    {audit.courses.slice(0, 8).map((course) => (
                      <tr key={`${course.rowNumber}-${course.code}`}>
                        <td>{course.year} {course.semester}</td><td>{course.code || "—"}</td><td>{course.name}</td><td>{course.rawCategory || "—"}</td>
                        <td><span className={course.categoryRecognition === "unrecognized" || course.majorCourseMatchStatus === "unmatched" || course.majorCourseMatchStatus === "not-evaluable" ? "pending-tag" : course.reclassified || course.majorCourseMatchStatus === "matched" ? "changed-tag" : "plain-tag"}>{course.categoryRecognition === "unrecognized" ? "이수구분 확인" : course.majorCourseMatchStatus === "unmatched" ? "전공 인정 보류" : course.majorCourseMatchStatus === "not-evaluable" ? "과목목록 검수 대기" : categoryLabel[course.category]}</span></td>
                        <td>{course.credits}</td><td>{course.grade || (course.transferCredit ? "편입인정" : "—")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button className="primary-button result-button" onClick={onShowDashboard}>진단 결과 확인 <ChevronRight size={16} /></button>
            </article>
          )}
        </div>

        <aside className="upload-side">
          <article className="card guide-card">
            <span className="card-kicker">DOWNLOAD GUIDE</span>
            <h2>성적 파일 받는 방법</h2>
            <ol>
              <li><span>01</span><div><strong>종합정보시스템 로그인</strong><small>학교 계정으로 접속합니다.</small></div></li>
              <li><span>02</span><div><strong>학사 → 성적 → 전체성적조회</strong><small>전체 학기 성적을 엽니다.</small></div></li>
              <li><span>03</span><div><strong>상세정보 선택</strong><small>교과목별 표가 보이는지 확인합니다.</small></div></li>
              <li><span>04</span><div><strong>Excel 다운로드</strong><small>파일을 수정하지 않고 그대로 저장합니다.</small></div></li>
            </ol>
            <a href="https://tis.kmou.ac.kr" target="_blank" rel="noreferrer">종합정보시스템 열기 <ChevronRight size={14} /></a>
          </article>
          <article className="card format-card">
            <FileSpreadsheet size={21} />
            <div><strong>인식하는 열</strong><p>No · 년도 · 학기 · 교과목번호 · 교과목명 · 교과목구분 · 학점 · 등급</p></div>
          </article>
          <article className="card privacy-detail-card">
            <LockKeyhole size={19} />
            <div><strong>개인정보 보호 설계</strong><p>파일을 네트워크로 보내지 않고 메모리에서 분석한 뒤, 페이지를 닫으면 원본 데이터는 사라집니다.</p></div>
          </article>
        </aside>
      </div>
    </section>
  );
}
