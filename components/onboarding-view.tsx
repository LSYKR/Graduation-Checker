"use client";

import * as XLSXModule from "xlsx";
import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  FileCheck2,
  FileSpreadsheet,
  GraduationCap,
  Info,
  LockKeyhole,
  ShieldCheck,
  UploadCloud,
  UserRound,
} from "lucide-react";
import {
  AUDIT_ENGINE_VERSION,
  GRADUATION_GOAL_OPTIONS,
  GRADUATION_INTEREST_OPTIONS,
  SCHOOL_OPTIONS,
  STUDENT_TYPE_OPTIONS,
  SUPPORTED_ADMISSION_YEARS,
  isSupportedAdmissionYear,
  studentTypeLabel,
  type OnboardingProfile,
  type OnboardingTranscriptMetadata,
  type GraduationGoal,
  type GraduationInterest,
  type SupportedStudentType,
} from "@/lib/onboarding";
import { auditTranscript, normalizeTranscriptRows } from "@/lib/graduation-engine";
import { bundledRuleRegistry } from "@/lib/rule-registry";
import { getKmouProgramOffering } from "@/lib/kmou-program-catalog";
import {
  formatTransferCategoryCredits,
  summarizeTranscriptRows,
  type TranscriptRawRow,
  type TransferRecognitionSummary,
} from "@/lib/transcript-profile";
import ProgramSearchSelect from "@/components/program-search-select";

type Step = 1 | 2 | 3;

interface OnboardingViewProps {
  onComplete: (profile: OnboardingProfile) => void;
}

const XLSX = XLSXModule;

const HEADER_GROUPS = [
  { label: "년도", aliases: ["년도", "연도", "year"] },
  { label: "학기", aliases: ["학기", "semester"] },
  { label: "교과목번호", aliases: ["교과목번호", "과목번호", "courseCode"] },
  { label: "교과목명", aliases: ["교과목명", "과목명", "courseName"] },
  { label: "교과목구분", aliases: ["교과목구분▼", "교과목구분", "이수구분", "category"] },
  { label: "학점", aliases: ["학점", "credits"] },
] as const;

async function sha256(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function inspectTranscript(
  file: File,
  admissionYear: number,
  departmentId: string,
  studentType: SupportedStudentType,
): Promise<OnboardingTranscriptMetadata> {
  if (!/\.(xlsx|xls)$/i.test(file.name)) {
    throw new Error(".xlsx 또는 .xls 형식의 전체 성적표만 선택할 수 있습니다.");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("성적표 파일은 10MB 이하만 선택할 수 있습니다.");
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Excel 파일에서 첫 번째 시트를 찾지 못했습니다.");
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<TranscriptRawRow>(sheet, { defval: "", raw: false });
  if (!rows.length) throw new Error("성적표에 교과목 데이터가 없습니다.");

  const headers = new Set(Object.keys(rows[0]));
  const missing = HEADER_GROUPS.filter((group) => !group.aliases.some((alias) => headers.has(alias)));
  if (missing.length) {
    throw new Error(`한국해양대학교 전체 성적표 형식과 다릅니다: ${missing.map((item) => item.label).join(", ")} 열이 필요합니다.`);
  }

  const summary = summarizeTranscriptRows(rows);
  if (!summary.recognizedRows) throw new Error("인식할 수 있는 교과목 행이 없습니다.");
  const offering = getKmouProgramOffering(admissionYear, departmentId);
  const rule = bundledRuleRegistry.find({ universityId: "kmou", admissionYear, departmentId });
  if (!offering || !rule) throw new Error("선택한 학번·전공의 정확한 편제학점 규칙을 찾지 못했습니다.");
  const provisionalAudit = auditTranscript(
    normalizeTranscriptRows(rows, rule),
    rule,
    {
      universityId: "kmou",
      admissionYear,
      departmentId,
      department: offering.displayName,
      studentType,
      studentTypeLabel: studentTypeLabel(studentType),
      transferEntryYear: studentType === "transfer" && summary.transferRecognition.status === "detected"
        ? summary.transferRecognition.years[0]
        : undefined,
    },
  );

  return {
    fileName: file.name,
    fileSize: file.size,
    fileHash: await sha256(buffer),
    sheetName,
    recognizedRows: summary.recognizedRows,
    latestAcademicTerm: summary.latestAcademicTerm,
    transferRecognition: summary.transferRecognition,
    provisionalAudit: {
      overallStatus: provisionalAudit.overallStatus,
      earnedTotal: provisionalAudit.earnedTotal,
      applicableEarnedTotal: provisionalAudit.applicableEarnedTotal,
      requiredTotal: provisionalAudit.requiredTotal,
      categories: provisionalAudit.categories,
      residualCredits: provisionalAudit.residualCredits,
      generalEducationCreditShortage: provisionalAudit.generalEducationCreditShortage,
      transcriptClassification: provisionalAudit.transcriptClassification,
      missingCourses: provisionalAudit.missingCourses,
      certification: provisionalAudit.certification,
      certificationEvidence: provisionalAudit.certificationEvidence,
      ruleVersion: provisionalAudit.ruleVersion,
      ruleStatus: provisionalAudit.ruleStatus,
      officialSources: provisionalAudit.officialSources,
      courseMatch: provisionalAudit.courseMatch,
      reclassifiedCount: provisionalAudit.reclassifiedCount,
      passedCourseCount: provisionalAudit.passedCourseCount,
      forecastCredits: provisionalAudit.forecastCredits,
      generalEducation: provisionalAudit.generalEducation,
    },
    auditEngineVersion: AUDIT_ENGINE_VERSION,
    inspectedAt: new Date().toISOString(),
  };
}

function recognitionTitle(summary: TransferRecognitionSummary): string {
  if (summary.status === "detected") return `${summary.years[0]}년 편입 인정 처리 내역을 찾았습니다`;
  if (summary.status === "ambiguous") return "편입 인정 처리 연도를 하나로 확정할 수 없습니다";
  return "편입 인정학점 행을 찾지 못했습니다";
}

export default function OnboardingView({ onComplete }: OnboardingViewProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>(1);
  const [universityId, setUniversityId] = useState<string>("kmou");
  const [admissionYear, setAdmissionYear] = useState<number | null>(null);
  const [departmentId, setDepartmentId] = useState<string>("");
  const [studentType, setStudentType] = useState<SupportedStudentType | "">("");
  const [graduationGoal, setGraduationGoal] = useState<GraduationGoal | "">("");
  const [primaryInterest, setPrimaryInterest] = useState<GraduationInterest | "">("");
  const [transcript, setTranscript] = useState<OnboardingTranscriptMetadata | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);

  const selectedOffering = useMemo(
    () => admissionYear === null ? undefined : getKmouProgramOffering(admissionYear, departmentId),
    [admissionYear, departmentId],
  );
  const selectedMajorCatalog = useMemo(
    () => admissionYear === null ? undefined : bundledRuleRegistry.find({ universityId: "kmou", admissionYear, departmentId })?.majorCourseCatalog,
    [admissionYear, departmentId],
  );
  const profileSupported = universityId === "kmou"
    && admissionYear !== null
    && Boolean(selectedOffering)
    && Boolean(studentType)
    && isSupportedAdmissionYear(admissionYear);
  const stepLabels = ["학생 정보", "성적표 확인", "목표·최종 확인"];
  const selectedSummary = useMemo(() => [
    "한국해양대학교",
    admissionYear === null ? null : `${admissionYear}학번`,
    selectedOffering?.displayName,
    selectedOffering && selectedOffering.curriculumCollegeName !== "해양과학기술융합대학" ? `${selectedOffering.curriculumCollegeName} 편제` : null,
    studentType ? studentTypeLabel(studentType) : null,
  ].filter(Boolean).join(" · "), [admissionYear, selectedOffering, studentType]);

  async function processFile(file?: File) {
    if (!file || admissionYear === null || !departmentId || !studentType) return;
    setBusy(true);
    setError("");
    try {
      setTranscript(await inspectTranscript(file, admissionYear, departmentId, studentType));
    } catch (caught) {
      setTranscript(null);
      setError(caught instanceof Error ? caught.message : "성적표 형식을 확인하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    void processFile(event.target.files?.[0]);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void processFile(event.dataTransfer.files[0]);
  }

  function complete() {
    if (!transcript || !accepted || !profileSupported || admissionYear === null || !studentType || !graduationGoal || !primaryInterest || !isSupportedAdmissionYear(admissionYear) || !selectedOffering) return;
    onComplete({
      schemaVersion: 9,
      universityId: "kmou",
      universityName: "한국해양대학교",
      collegeId: "ocean-science-technology-convergence",
      collegeName: "해양과학기술융합대학",
      curriculumCollegeName: selectedOffering.curriculumCollegeName,
      admissionYear,
      curriculumYear: admissionYear,
      transferEntryYear: studentType === "transfer" && transcript.transferRecognition.status === "detected"
        ? transcript.transferRecognition.years[0]
        : null,
      departmentId: selectedOffering.programId,
      departmentName: selectedOffering.displayName,
      currentDepartmentUnit: selectedOffering.currentUnit,
      studentType,
      graduationGoal,
      primaryInterest,
      transcript,
      completedAt: new Date().toISOString(),
    });
  }

  return (
    <main className="onboarding-shell">
      <section className="onboarding-brand-panel">
        <div className="onboarding-brand">
          <span><GraduationCap size={25} /></span>
          <div><strong>졸업나침반</strong><small>KMOU · ONBOARDING</small></div>
        </div>
        <div className="onboarding-copy">
          <span className="onboarding-eyebrow">TRUSTED GRADUATION GUIDE</span>
          <div className="onboarding-workflow" aria-label="졸업요건 확인 과정">
            <div><span><UserRound size={19} /><small>1</small></span><strong>학생 정보 입력</strong></div>
            <div><span><FileSpreadsheet size={19} /><small>2</small></span><strong>성적표 업로드</strong></div>
            <div><span><ShieldCheck size={19} /><small>3</small></span><strong>졸업요건 대조</strong></div>
            <div><span><CheckCircle2 size={19} /><small>4</small></span><strong>결과 확인</strong></div>
          </div>
        </div>
        <div className="onboarding-trust-list">
          <div><ShieldCheck size={22} /><span><strong>전공별 요건 분리</strong><small>2020~2026학번 지원</small></span></div>
          <div><LockKeyhole size={22} /><span><strong>학번 최소 수집</strong><small>입학년도만 사용</small></span></div>
          <div><FileSpreadsheet size={22} /><span><strong>기기 안에서 분석</strong><small>성적표 원본 저장 안 함</small></span></div>
        </div>
      </section>

      <section className="onboarding-form-panel">
        <div className="onboarding-progress" aria-label="온보딩 진행 단계">
          {stepLabels.map((label, index) => {
            const number = (index + 1) as Step;
            return (
              <div className={`${step === number ? "active" : ""} ${step > number ? "done" : ""}`} key={label}>
                <span>{step > number ? <Check size={14} /> : number}</span>
                <small>{label}</small>
              </div>
            );
          })}
        </div>

        {step === 1 && (
          <div className="onboarding-step-card">
            <div className="onboarding-heading">
              <span><UserRound size={21} /></span>
              <div><small>STEP 1</small><h2>학생 정보를 선택해주세요</h2><p>학번·전공별 공식 요건을 연결합니다.</p></div>
            </div>

            <div className="onboarding-fields">
              <label>
                학교
                <select value={universityId} onChange={(event) => setUniversityId(event.target.value)}>
                  {SCHOOL_OPTIONS.map((option) => <option key={option.id} value={option.id} disabled={!option.supported}>{option.name}</option>)}
                </select>
              </label>
              <label>
                단과대학
                <select value="ocean-science-technology-convergence" disabled>
                  <option value="ocean-science-technology-convergence">해양과학기술융합대학</option>
                </select>
              </label>
              <label>
                {studentType === "transfer" ? "적용 교육과정 학번" : "입학년도"} <em>학번 앞 4자리</em>
                <select value={admissionYear ?? ""} onChange={(event) => {
                  const year = Number(event.target.value);
                  setAdmissionYear(year);
                  setDepartmentId("");
                  setTranscript(null);
                  setAccepted(false);
                }}>
                  <option value="" disabled>학번 선택</option>
                  <option disabled value={2019}>2019학번 이전 · 준비 중</option>
                  {SUPPORTED_ADMISSION_YEARS.map((year) => <option key={year} value={year}>{year}학번</option>)}
                  <option disabled value={2027}>2027학번 이후 · 준비 중</option>
                </select>
              </label>
              <div className="onboarding-field">
                <span className="onboarding-field-label">학부(과)·전공 <em>이름·과거 명칭 검색</em></span>
                <ProgramSearchSelect admissionYear={admissionYear} value={departmentId} onChange={(programId) => {
                  setDepartmentId(programId);
                  setTranscript(null);
                  setAccepted(false);
                }} />
              </div>
              <label>
                입학 구분
                <select value={studentType} onChange={(event) => {
                  const nextStudentType = event.target.value as SupportedStudentType;
                  setStudentType(nextStudentType);
                  if (nextStudentType === "transfer" && graduationGoal === "early-graduation") setGraduationGoal("");
                  setTranscript(null);
                  setAccepted(false);
                }}>
                  <option value="" disabled>입학 구분 선택</option>
                  {STUDENT_TYPE_OPTIONS.map((option) => <option key={option.id} value={option.id} disabled={!option.supported}>{option.name}</option>)}
                </select>
              </label>
            </div>

            <div className={`onboarding-scope-box ${profileSupported ? "" : "pending"}`}>
              {profileSupported ? <CheckCircle2 size={18} /> : <Info size={18} />}
              <div><strong>{profileSupported ? "지원 조건입니다" : "조건을 모두 선택해주세요"}</strong><p>{profileSupported ? selectedSummary : "학번 · 전공 · 입학 구분"}</p></div>
            </div>
            {profileSupported && <div className="onboarding-note"><Info size={15} /><span>{selectedMajorCatalog?.requiredCourseSetStatus === "verified"
              ? "공식 전공표의 과목코드로 이수·미이수 과목을 대조합니다."
              : selectedMajorCatalog
                ? "전공 과목은 분류하고, 미확정 필수과목은 ‘확인 필요’로 분리합니다."
                : selectedOffering?.support === "partial-course-audit"
                  ? "공식 1학기 표 범위만 판정하고, 나머지는 확정하지 않습니다."
                : "영역별 학점만 조회하고, 미확정 과목은 생성하지 않습니다."}</span></div>}
            {studentType === "transfer" && (
              <div className="onboarding-note transfer"><Info size={15} /><span>편입 인정학점은 같은 교육과정에 합산합니다. 인정 한도는 별도로 확인합니다.</span></div>
            )}

            <div className="onboarding-actions single">
              <button className="onboarding-primary" disabled={!profileSupported} onClick={() => setStep(2)}>성적표 확인으로 <ArrowRight size={16} /></button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="onboarding-step-card">
            <div className="onboarding-heading">
              <span><FileSpreadsheet size={21} /></span>
              <div><small>STEP 2</small><h2>전체 성적표를 선택해주세요</h2><p>파일 형식과 인정학점을 기기 안에서 확인합니다.</p></div>
            </div>

            <input ref={inputRef} type="file" accept=".xlsx,.xls" hidden onChange={handleInput} />
            <div
              className={`onboarding-dropzone ${dragging ? "dragging" : ""} ${transcript ? "success" : ""}`}
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              {transcript ? <FileCheck2 size={41} /> : <UploadCloud size={41} />}
              <strong>{transcript ? "성적표 형식을 확인했습니다" : "Excel 성적표를 여기에 놓아주세요"}</strong>
              <p>{transcript ? transcript.fileName : "종합정보시스템에서 내려받은 원본 파일을 수정하지 않고 선택해주세요."}</p>
              <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}>{busy ? "확인 중…" : transcript ? "다른 파일 선택" : "Excel 파일 선택"}</button>
              <small>.xlsx · .xls / 최대 10MB / 원본 파일 서버 저장 안 함</small>
            </div>

            {error && <div className="onboarding-error"><Info size={16} /><span>{error}</span></div>}
            {transcript && (
              <div className="onboarding-file-summary">
                <div><span>첫 시트</span><strong>{transcript.sheetName}</strong></div>
                <div><span>인식 교과목</span><strong>{transcript.recognizedRows}개</strong></div>
                <div><span>최신 학기</span><strong>{transcript.latestAcademicTerm}</strong></div>
                <div><span>파일 해시</span><strong>{transcript.fileHash.slice(0, 12)}…</strong></div>
              </div>
            )}
            {studentType === "transfer" && transcript && (
              <div className={`onboarding-transfer-summary status-${transcript.transferRecognition.status}`}>
                {transcript.transferRecognition.status === "detected" ? <CheckCircle2 size={18} /> : <Info size={18} />}
                <div>
                  <strong>{recognitionTitle(transcript.transferRecognition)}</strong>
                  {transcript.transferRecognition.status === "detected" ? (
                    <p>{transcript.transferRecognition.recognizedRows}개 교과목 · {transcript.transferRecognition.recognizedCredits}학점<br />{formatTransferCategoryCredits(transcript.transferRecognition)}</p>
                  ) : (
                    <p>{transcript.transferRecognition.years.length ? `확인된 연도: ${transcript.transferRecognition.years.join(", ")}` : "종합정보시스템 성적표의 학기 열에서 ‘편입생 인정학점’을 확인할 수 있어야 합니다."} 운영 판정은 계속 차단됩니다.</p>
                  )}
                </div>
              </div>
            )}

            <div className="onboarding-actions">
              <button className="onboarding-secondary" onClick={() => setStep(1)}><ArrowLeft size={16} /> 이전</button>
              <button className="onboarding-primary" disabled={!transcript || busy} onClick={() => setStep(3)}>선택 내용 확인 <ArrowRight size={16} /></button>
            </div>
          </div>
        )}

        {step === 3 && transcript && (
          <div className="onboarding-step-card">
            <div className="onboarding-heading">
              <span><ShieldCheck size={21} /></span>
              <div><small>STEP 3</small><h2>선택 내용을 확인해주세요</h2><p>선택한 학번·전공의 공식 표와 대조합니다.</p></div>
            </div>

            <section className="onboarding-preferences" aria-label="이용 목표 설정">
              <div className="onboarding-preference-group">
                <div><strong>졸업 목표</strong><small>판정 결과와 수강설계의 기준으로 사용합니다.</small></div>
                <div className="onboarding-choice-grid goal-grid">
                  {GRADUATION_GOAL_OPTIONS.map((option) => {
                    const disabled = option.id === "early-graduation" && studentType === "transfer";
                    return (
                      <button
                        type="button"
                        key={option.id}
                        className={graduationGoal === option.id ? "selected" : ""}
                        disabled={disabled}
                        aria-pressed={graduationGoal === option.id}
                        onClick={() => setGraduationGoal(option.id)}
                      >
                        <strong>{option.label}</strong><small>{disabled ? "편입학은 선택할 수 없습니다." : option.description}</small>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="onboarding-preference-group">
                <div><strong>가장 먼저 알고 싶은 내용</strong><small>완료 후 처음 열 화면을 결정합니다.</small></div>
                <div className="onboarding-choice-grid interest-grid">
                  {GRADUATION_INTEREST_OPTIONS.map((option) => (
                    <button
                      type="button"
                      key={option.id}
                      className={primaryInterest === option.id ? "selected" : ""}
                      aria-pressed={primaryInterest === option.id}
                      onClick={() => setPrimaryInterest(option.id)}
                    >
                      <strong>{option.label}</strong><small>{option.description}</small>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <div className="onboarding-review">
              <div className="review-row"><span><Building2 size={16} /> 학교</span><strong>한국해양대학교 · 해양과학기술융합대학</strong></div>
              <div className="review-row"><span><UserRound size={16} /> 학생 정보</span><strong>{admissionYear}학번 · {selectedOffering?.displayName} · {studentType ? studentTypeLabel(studentType) : ""}</strong></div>
              <div className="review-row"><span><FileSpreadsheet size={16} /> 성적표</span><strong>{transcript.fileName}</strong></div>
              <div className="review-row"><span><CheckCircle2 size={16} /> 파일 확인</span><strong>{transcript.recognizedRows}개 교과목 · {transcript.latestAcademicTerm}</strong></div>
              <div className="review-row"><span><GraduationCap size={16} /> 이용 목적</span><strong>{GRADUATION_GOAL_OPTIONS.find((option) => option.id === graduationGoal)?.label ?? "선택 필요"} · {GRADUATION_INTEREST_OPTIONS.find((option) => option.id === primaryInterest)?.label ?? "선택 필요"}</strong></div>
              {studentType === "transfer" && (
                <div className="review-row"><span><ShieldCheck size={16} /> 편입 인정 처리</span><strong>{transcript.transferRecognition.status === "detected" ? `${transcript.transferRecognition.years[0]}년 · ${transcript.transferRecognition.recognizedRows}개 · ${transcript.transferRecognition.recognizedCredits}학점` : "확인 필요 · 운영 판정 차단"}</strong></div>
              )}
            </div>

            <label className="onboarding-consent">
              <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
              <span><strong>브라우저 저장에 동의합니다.</strong><small>학생 프로필, 파일명·해시·행 수와 파생된 학점·교양영역 요약만 저장합니다. Excel 원본, 성적·담당교수와 전체 학번은 저장하지 않습니다.</small></span>
            </label>

            <div className="onboarding-safety-message">
              <ShieldCheck size={18} />
              <p><strong>판정 범위</strong> 모든 지원 전공은 선택 전공의 고유 과목 지문이 충분히 일치할 때만 공식 편제표의 영역별 학점을 진단합니다. 2020~2024학번은 각 학번 22개 전공을 학사과 공식 4년 교육과정표의 과목코드·이수구분·학점으로 상세 대조합니다. 2020학번은 당시 해양과학기술대학·공과대학 구분과 전공별 PDF 쪽까지 함께 고정합니다. 2025·2026학번은 공식 신입생 1학기 표 범위만 적용하고 그 밖의 개별 미이수 과목은 확정하지 않습니다.</p>
            </div>

            <div className="onboarding-actions">
              <button className="onboarding-secondary" onClick={() => setStep(2)}><ArrowLeft size={16} /> 이전</button>
              <button className="onboarding-primary" disabled={!accepted || !graduationGoal || !primaryInterest} onClick={complete}>온보딩 완료 <Check size={16} /></button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
