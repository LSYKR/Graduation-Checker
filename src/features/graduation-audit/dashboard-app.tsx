"use client";

import { applyStudentUncompleted, enrichRecognitionGuidance } from "@/domain/graduation/course-guidance";
import CourseGuidanceView from "./course-guidance-view";
import { useState } from "react";
import {
  AlertTriangle,
  BookOpenCheck,
  Bot,
  ChevronRight,
  CircleHelp,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  ExternalLink,
  FileSpreadsheet,
  Gauge,
  GraduationCap,
  Menu,
  Settings2,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { auditDemo } from "@/application/services/graduation-audit";
import { officialSources, RULESET_VERSION } from "@/domain/curriculum/rules";
import type { DetailedAudit } from "@/shared/types/graduation";
import UploadView from "@/features/transcript/upload-view";
import { isFutureTranscriptTerm } from "@/domain/graduation/assistant-engine";
import { getSystemCreditCheck } from "@/domain/graduation/system-credit-check";
import AssistantView from "@/features/assistant/assistant-view";

const navItems = [
  { id: "dashboard", label: "졸업 진단", icon: Gauge },
  { id: "upload", label: "성적표 업로드", icon: UploadCloud },
  { id: "assistant", label: "AI 졸업 상담", icon: Bot },
] as const;

type NavId = (typeof navItems)[number]["id"];

const recognitionLabel = {
  direct: "공식 교양",
  "double-listed": "이중설강",
  "cross-institution": "교차강의",
} as const;

const mappingConflictLabel = {
  "multiple-areas": "여러 영역 중복",
  "unknown-area": "존재하지 않는 영역",
  "credit-mismatch": "공식 학점 불일치",
} as const;

const sourceRoleLabel = {
  "cohort-requirement": "입학학년도 적용",
  "multi-year-requirement": "다년도 공통 적용",
  "university-policy": "대학 공통 규정",
  "classification-reference": "분류 보조자료",
} as const;

const majorCategoryMeta = [
  { key: "majorFoundation", label: "전공기초", shortLabel: "전기" },
  { key: "majorRequired", label: "전공필수", shortLabel: "전필" },
  { key: "majorElective", label: "전공선택", shortLabel: "전선" },
] as const;

const generalCategoryLabels: Record<string, string> = { generalRequired: "교양필수", generalElective: "교양선택", freeElective: "일반선택" };
const categoryLabel = (category: string) => generalCategoryLabels[category] ?? majorCategoryMeta.find((meta) => meta.key === category)?.label ?? category;

function ScoreRing({ value, creditOnly, passed }: { value: number; creditOnly: boolean; passed: boolean }) {
  return (
    <div className="score-ring" style={{ "--score": `${value * 3.6}deg` } as React.CSSProperties}>
      <div>
        <strong>{passed ? "PASS" : `${value}%`}</strong>
        <span>{passed ? "시스템 학점 검사" : creditOnly ? "학점 기준 준비도" : "판정 반영 이수율"}</span>
      </div>
    </div>
  );
}

interface DashboardAppProps {
  initialAudit?: DetailedAudit;
  onEditProfile?: () => void;
  onAuditChange?: (audit: DetailedAudit) => void;
}

export default function DashboardApp({ initialAudit, onEditProfile, onAuditChange }: DashboardAppProps) {
  const [active, setActive] = useState<NavId>("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [audit, setAudit] = useState<DetailedAudit>(() => enrichRecognitionGuidance(initialAudit ?? auditDemo()));
  const finalAuditEvaluable = audit.overallStatus === "evaluated";
  const creditEvaluable = (audit.creditEvaluationStatus ?? audit.overallStatus) === "evaluated";
  const systemCreditCheck = getSystemCreditCheck(audit);
  const systemPassed = systemCreditCheck === "passed";
  const progressCredits = creditEvaluable ? audit.requiredTotal - audit.forecastCredits : audit.applicableEarnedTotal;
  const progress = audit.requiredTotal > 0 ? Math.max(0, Math.min(100, Math.round((progressCredits / audit.requiredTotal) * 100))) : 0;
  const mandatoryCredits = audit.missingCourses.reduce((sum, course) => sum + course.credits, 0);
  const sources = audit.officialSources ?? officialSources;
  const ruleVersion = audit.ruleVersion ?? RULESET_VERSION;
  const provisional = audit.ruleStatus === "provisional";
  const majorCreditAudit = audit.courseMatch?.status === "verified";
  const detailedCourseAudit = majorCreditAudit && (audit.courseMatch?.requiredCourseSetStatus === "verified" || !!audit.courseMatch?.requiredCourseAssessments?.length);
  const currentClassificationApplied = audit.courseMatch?.currentClassificationApplied === true;
  const classificationSources = audit.courseMatch?.classificationSources ?? [];
  const classificationReferenceYear = audit.courseMatch?.classificationReferenceYear;
  const signatureCreditAudit = audit.courseMatch?.classificationSource === "transcript-program-signature";
  const profileMismatch = audit.courseMatch?.profileMismatch?.detected ? audit.courseMatch.profileMismatch : undefined;
  const classificationReview = audit.transcriptClassification?.status === "needs-review" ? audit.transcriptClassification : undefined;
  const certificationKnown = audit.certificationEvidence === "verified" || audit.certificationEvidence === "demo";
  const majorRequiredProgress = audit.categories.find((item) => item.key === "majorRequired");
  const confirmedMajorMissing = audit.missingCourses.filter((course) => course.category === "전공필수");
  const confirmedFoundationMissing = audit.missingCourses.filter((course) => course.category === "전공기초");
  const confirmedGeneralMissing = audit.missingCourses.filter((course) => course.category === "교양필수");
  const pendingCourseRecognitions = audit.courseMatch?.pendingCourseRecognitions ?? [];
  const transitionReviewCourses = audit.courseMatch?.transitionReviewCourses ?? [];
  const requirementPolicyReviewCourses = audit.courseMatch?.requirementPolicyReviewCourses ?? [];
  const transferRecognitionReviewCourses = (audit.courseMatch?.transferRecognitionReviewCourses ?? []).filter(c => audit.studentCourseDeclarations?.[c.code.toUpperCase()] !== "student-confirmed-uncompleted");
  const requiredCourseAssessments = audit.courseMatch?.requiredCourseAssessments ?? [];
  const reviewCauses = audit.courseMatch?.reviewCauses ?? [];
  const pendingEvaluationCause = reviewCauses.find(cause => cause.kind === "credit-category-conflict")
    ?? reviewCauses.find(cause => cause.kind === "major-profile-mismatch")
    ?? reviewCauses.find(cause => cause.kind === "curriculum-outside-verified-scope")
    ?? reviewCauses.find(cause => cause.kind === "major-evidence-insufficient");
  const futureHistoryUnverified = audit.courses.some(course => isFutureTranscriptTerm(course));
  const confirmedMajorCredits = audit.categories.filter(category => category.key.startsWith("major")).reduce((sum, category) => sum + category.earned, 0);
  const evaluationCauses = reviewCauses.filter((cause) => ["major-evidence-insufficient", "major-profile-mismatch", "curriculum-outside-verified-scope"].includes(cause.kind));
  const pendingMajorCredits = pendingCourseRecognitions.reduce((sum, item) => sum + item.credits, 0);
  const completedMajorCourseMap = new Map<string, DetailedAudit["courses"][number]>();
  for (const course of audit.courses) {
    if (!course.passed || course.categoryRecognition !== "recognized") continue;
    if (!majorCategoryMeta.some((meta) => meta.key === course.category)) continue;
    const key = course.code ? `code:${course.code.toUpperCase()}` : `name:${course.name}`;
    const previous = completedMajorCourseMap.get(key);
    if (!previous || `${course.year}-${course.semester}` > `${previous.year}-${previous.semester}`) completedMajorCourseMap.set(key, course);
  }
  const completedMajorCourses = [...completedMajorCourseMap.values()];
  const completedMajorCredits = completedMajorCourses.reduce((sum, course) => sum + course.credits, 0);
  const appliedCourseAllocations = [...new Map(audit.courses.filter(course => course.passed && course.reclassified)
    .map(course => [course.code.toUpperCase() || course.name, course])).values()];
  const completedMajorGroups = majorCategoryMeta.map((meta) => ({
    ...meta,
    courses: completedMajorCourses
      .filter((course) => course.category === meta.key)
      .sort((a, b) => `${a.year}-${a.semester}-${a.name}`.localeCompare(`${b.year}-${b.semester}-${b.name}`, "ko")),
  }));
  const majorCategoryShortages = audit.categories
    .filter((category) => majorCategoryMeta.some((meta) => meta.key === category.key)
      && category.evaluationStatus === "evaluated"
      && category.earned < category.required);
  const generalEducationAreaShortages = audit.generalEducation?.areas.filter((item) => item.status !== "satisfied") ?? [];
  const generalEducationCombinedShortages = audit.generalEducation?.combinedRequirements.filter((item) => item.status !== "satisfied") ?? [];
  const generalEducationAreaDeficits = new Map(
    (audit.generalEducation?.areas ?? []).map((item) => [item.id, Math.max(0, item.required - item.earned)]),
  );
  const combinedGeneralEducationActions = generalEducationCombinedShortages.flatMap((item) => {
    if (item.status !== "missing") {
      return [{ title: `${item.label} 합계 확인`, detail: `${item.earned}/${item.required}학점 · 매핑 검수 필요` }];
    }
    const combinedDeficit = Math.max(0, item.required - item.earned);
    const coveredByIndividualDeficits = item.areaIds.reduce(
      (sum, areaId) => sum + (generalEducationAreaDeficits.get(areaId) ?? 0),
      0,
    );
    const additionalDeficit = Math.max(0, combinedDeficit - coveredByIndividualDeficits);
    return additionalDeficit > 0
      ? [{ title: `${item.label} 합계 ${additionalDeficit}학점 보완`, detail: `${item.earned}/${item.required}학점 · 개별영역 부족분과 겹치지 않는 추가 학점` }]
      : [];
  });
  const personalityRequired = audit.generalEducation?.areas.find((item) => item.id === "personality-required");
  const personalityElective = audit.generalEducation?.areas.find((item) => item.id === "personality-elective");
  const specialGeneralEducationMatches = audit.generalEducation?.areas
    .flatMap((item) => item.matchedCourses)
    .filter((course, index, courses) => course.recognitionMode !== "direct"
      && courses.findIndex((candidate) => candidate.code.toUpperCase() === course.code.toUpperCase()) === index) ?? [];
  const confirmedRequirementActions = [
    confirmedMajorMissing.length ? { title: `전공필수 ${confirmedMajorMissing.length}과목 이수`, detail: confirmedMajorMissing.map((course) => course.name).join(" · ") } : null,
    confirmedFoundationMissing.length ? { title: `전공기초 ${confirmedFoundationMissing.length}과목 이수`, detail: confirmedFoundationMissing.map((course) => course.name).join(" · ") } : null,
    confirmedGeneralMissing.length ? { title: `교양필수 ${confirmedGeneralMissing.length}과목 이수`, detail: confirmedGeneralMissing.map((course) => course.name).join(" · ") } : null,
  ].filter((item): item is { title: string; detail: string } => Boolean(item));
  const nextActions = [
    ...generalEducationAreaShortages.map((item) => item.status === "missing"
      ? { title: `${item.label} ${Math.max(0, item.required - item.earned)}학점 보완`, detail: `${item.earned}/${item.required}학점 · 공식 코드 기준 미충족` }
      : { title: `${item.label} 인정 여부 확인`, detail: `${item.earned}/${item.required}학점 · 변경·대체 과목 검수 필요` }),
    ...combinedGeneralEducationActions,
    ...(profileMismatch
      ? [{ title: "전공 선택 다시 확인", detail: `${profileMismatch.inferredProgramLabel} 과목 지문 ${profileMismatch.matchedCourses}개 일치` }]
      : detailedCourseAudit
        ? confirmedRequirementActions
        : []),
    ...pendingCourseRecognitions.map((item) => ({ title: `${item.requiredName} 대체 인정 확인`, detail: `${item.substituteName}(${item.substituteCode}) · 승인 시 ${item.credits}학점` })),
    ...(!certificationKnown ? [{ title: "졸업인증 정보 입력", detail: "어학·봉사·자격증은 성적표만으로 확인 불가" }] : []),
  ].slice(0, 3);

  const selectNav = (id: NavId) => {
    setActive(id);
    setMobileOpen(false);
    window.scrollTo(0, 0);
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`} aria-label="주 메뉴">
        <div className="brand">
          <div className="brand-mark"><GraduationCap size={22} /></div>
          <div><strong>졸업나침반</strong><span>KMOU · BETA</span></div>
          <button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="메뉴 닫기"><X size={20} /></button>
        </div>
        <div className="profile-mini">
          <span className="profile-avatar">{String(audit.profile.admissionYear).slice(-2)}</span>
          <div><strong>{audit.profile.department}</strong><span>{audit.profile.admissionYear}학번 · {audit.profile.studentType}</span></div>
        </div>
        <nav>
          <p className="nav-eyebrow">MY GRADUATION</p>
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={active === id ? "active" : ""} onClick={() => selectNav(id)}>
              <Icon size={18} /><span>{label}</span>{id === "assistant" && <em>AI</em>}
            </button>
          ))}
        </nav>
        <div className="privacy-card">
          <ShieldCheck size={19} />
          <div><strong>브라우저 안에서 분석</strong><span>성적 파일은 서버에 저장하지 않아요.</span></div>
        </div>
        <div className="sidebar-footer"><CircleHelp size={16} /> 개인정보 처리 안내</div>
      </aside>

      {mobileOpen && <button className="sidebar-scrim" onClick={() => setMobileOpen(false)} aria-label="메뉴 닫기" />}

      <main className="main-area">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobileOpen(true)} aria-label="메뉴 열기"><Menu size={21} /></button>
          <div className="breadcrumb"><span>졸업나침반</span><ChevronRight size={14} /><strong>{navItems.find((item) => item.id === active)?.label}</strong></div>
          <div className="top-actions">
            <button className="icon-button" aria-label="프로필 설정" onClick={onEditProfile}><Settings2 size={18} /></button>
            <span className="status-dot" />
            <span className="saved-text">{systemPassed ? "학점 검사 PASS" : provisional ? "임시 승인 규칙" : "승인 규칙"}</span>
          </div>
        </header>

        <div className="content-wrap">
          {active === "upload" && <UploadView audit={audit} onAudit={setAudit} onShowDashboard={() => selectNav("dashboard")} />}
          {active === "assistant" && <AssistantView audit={audit} />}
          {active === "dashboard" && (
            <>
              <section className="page-heading">
                <div>
                  <span className="eyebrow">{audit.profile.admissionYear} · {audit.profile.department} · {audit.profile.studentType}</span>
                  <h1>{systemPassed ? <>시스템 학점 검사 <em>통과</em></> : <>{classificationReview ? "성적표 이수구분 " : profileMismatch ? "성적표와 선택 전공이 " : creditEvaluable ? `${audit.profile.admissionYear} 교육과정 ` : "선택 전공 확인 "}<em>{classificationReview ? "확인이 필요해요" : profileMismatch ? "일치하지 않을 수 있어요" : detailedCourseAudit ? "과목코드 진단" : creditEvaluable ? "영역별 학점 진단" : "검수 대기"}</em>{classificationReview || profileMismatch || !creditEvaluable ? "" : " 결과입니다"}</>}</h1>
                  <p>{classificationReview ? classificationReview.note : profileMismatch ? profileMismatch.message : creditEvaluable ? !finalAuditEvaluable ? "성적표에서 이수 완료된 전공기초·전공필수·전공선택 학점을 반영했습니다. 교육과정 자료가 연결되지 않은 과목도 인정된 이수구분에 따라 학점에 포함합니다." : currentClassificationApplied ? `${audit.profile.admissionYear}학번 졸업요건은 ${audit.profile.admissionYear} 원본으로 적용하고, ${classificationReferenceYear ?? "현행"} 자료는 개인 성적표의 전공 이수구분 교차검증에만 사용했습니다.` : signatureCreditAudit ? "선택 전공의 고유 과목명 지문을 확인한 뒤 종합정보시스템의 전공기초·전공필수·전공선택 학점을 반영했습니다. 개별 필수과목 목록은 추가 검수 중입니다." : "선택 전공의 입학학년도 교육과정표와 과목코드 지문을 대조했습니다. 교양 세부영역과 그 밖의 임시 범위는 별도로 표시합니다." : "학점·이수구분 충돌이나 선택 전공 불일치 등 확인이 필요한 내역이 있어 학점 준비도 판정을 보류했습니다."}</p>
                </div>
                <button className="primary-button" onClick={() => selectNav("upload")}><FileSpreadsheet size={18} />성적표 다시 분석</button>
              </section>

              {provisional && !systemPassed && (
                <section className="provisional-banner" role="status">
                  <AlertTriangle size={19} />
                  <div><strong>{creditEvaluable ? !finalAuditEvaluable ? "이수학점 반영 · 최종 졸업요건 별도 확인" : currentClassificationApplied ? `${audit.profile.admissionYear} 적용 원본 · 분류 보조자료 분리` : signatureCreditAudit ? "선택 전공 지문 확인 · 영역별 학점 반영" : "공식 전공 과목코드 적용 · 나머지 임시 범위" : "안전 모드 · 전체 판정 보류"}</strong><p>{creditEvaluable ? !finalAuditEvaluable ? "시스템 자료 안내: 학번별 필수과목 목록의 완전성과 졸업인증은 별도로 확인해야 합니다. 자료 미연결은 이수 완료 학점을 제외하는 사유가 아닙니다." : currentClassificationApplied ? `${classificationReferenceYear ?? "현행"} 자료는 전공 분류 확인에만 쓰며 ${audit.profile.admissionYear}학번의 졸업학점·필수요건을 대체하지 않습니다. 확정된 대체과목은 전공선택에 중복 합산하지 않습니다.` : signatureCreditAudit ? "다른 학과 성적표를 잘못 적용하지 않도록 전공 고유 과목명을 먼저 비교했습니다. 학번별 전공필수 전체 목록과 대체·폐지 과목은 추가 검수 중입니다." : "전공 분류는 공식 코드로 검증했습니다. 폐지·변경·대체과목과 졸업인증은 학사과·학과사무실의 최종 졸업사정과 다를 수 있습니다." : "충돌하거나 분류가 확인되지 않은 학점은 확인 전까지 학점 준비도에 반영하지 않습니다."}</p></div>
                  {onEditProfile && <button onClick={onEditProfile}>프로필 수정</button>}
                </section>
              )}

              {profileMismatch && (
                <section className="profile-mismatch-banner" role="alert">
                  <AlertTriangle size={20} />
                  <div><strong>전공 선택 불일치가 의심됩니다</strong><p>{profileMismatch.inferredProgramLabel} 전공 과목 지문과 {profileMismatch.matchedCourses}개 · {profileMismatch.matchedCredits}학점이 일치합니다. 현재 선택한 ‘{audit.profile.department}’ 판정은 중단했습니다.</p></div>
                  {onEditProfile && <button onClick={onEditProfile}>전공 다시 선택</button>}
                </section>
              )}

              {classificationReview && (
                <section className="profile-mismatch-banner" role="alert">
                  <AlertTriangle size={20} />
                  <div><strong>알 수 없는 이수구분은 일반선택으로 넣지 않았습니다</strong><p>{classificationReview.issues.map((issue) => `${issue.code || "코드 없음"} ${issue.name}(${issue.rawCategory || "빈 구분"})`).join(" · ")} · 합계 {classificationReview.unclassifiedCredits}학점은 확인 전까지 준비도와 영역별 학점에서 제외됩니다.</p></div>
                </section>
              )}

              <section className="overview-grid">
                <article className="card hero-card">
                  <div className="card-title-row">
                    <div><span className="card-kicker">GRADUATION READINESS</span><h2>{systemPassed ? "시스템 학점 검사 통과" : creditEvaluable && !finalAuditEvaluable ? "학점 기준 준비도" : "현재 졸업 준비도"}</h2></div>
                    <span className="warning-badge">{systemPassed ? "학점 검사 PASS" : profileMismatch ? "전공 불일치 의심" : detailedCourseAudit ? "과목코드 판정" : creditEvaluable ? "영역별 학점 판정" : "판정 보류"}</span>
                  </div>
                  <div className="hero-card-body">
                    <ScoreRing value={progress} creditOnly={!finalAuditEvaluable} passed={systemPassed} />
                    <div className="summary-metrics">
                      <div><span>성적표 총 취득학점</span><strong>{audit.earnedTotal}<small> / {audit.requiredTotal}</small></strong></div>
                      <div><span>전공필수 학점</span><strong>{majorRequiredProgress?.earned ?? "—"}<small>{majorRequiredProgress?.evaluationStatus === "evaluated" ? ` / ${majorRequiredProgress.required}${pendingMajorCredits ? ` · +${pendingMajorCredits} 확인` : ""}` : " 판정 보류"}</small></strong></div>
                      <div><span>{systemPassed || !finalAuditEvaluable ? "확인된 미이수 필수과목" : "졸업까지 남은 필수과목"}</span><strong>{systemPassed ? 0 : detailedCourseAudit ? audit.missingCourses.length : "?"}<small>{systemPassed ? "개 · 전체 목록은 별도 확인" : detailedCourseAudit ? `개 · 전필 ${confirmedMajorMissing.length}` : " 검수 대기"}</small></strong></div>
                      <div><span>졸업 인증</span><strong>{certificationKnown ? Number(audit.certification.language) + Number(audit.certification.activity) : "?"}<small>{certificationKnown ? " / 2" : " 확인 필요"}</small></strong></div>
                    </div>
                  </div>
                  {systemPassed && <p className="source-note">학점·영역과 확인된 필수과목 기준은 통과했습니다. 전공필수 전체 목록과 졸업인증은 학생이 확인하고, 최종 졸업 판정은 대학에서 합니다.</p>}
                  {futureHistoryUnverified && <p className="source-note">미래 학기 가상·미검증 이수내역이 포함되어 있습니다. 표시 학점은 업로드 시나리오의 합계이며 실제 취득을 확인한 학점이 아닙니다.</p>}
                  {!systemPassed && <div className="explain-strip"><Sparkles size={17} /><span><strong>판정 요약</strong> {creditEvaluable ? !finalAuditEvaluable ? `이수 완료 전공 ${confirmedMajorCredits}학점을 반영했습니다. 최소 학점 보완량은 ${audit.forecastCredits}학점입니다. 학번별 필수과목 전체 목록과 최종 졸업 가능 여부는 별도 확인이 필요합니다.` : detailedCourseAudit ? currentClassificationApplied ? `${audit.profile.admissionYear} 적용 원본으로 요건을 판정하고, 분류 보조자료는 성적표 이수구분 확인에만 썼습니다. 졸업까지 남은 필수과목은 ${audit.missingCourses.length}과목 ${mandatoryCredits}학점입니다.${pendingCourseRecognitions.length ? ` 대체 인정 확인 ${pendingCourseRecognitions.length}건은 확정 미이수에서 분리했습니다.` : ""}` : `공식 전공 과목코드와 성적표를 비교했습니다. 확인된 필수 미이수 과목 학점 합계는 ${mandatoryCredits}학점입니다.` : "선택 전공 지문과 성적표 이수구분을 대조해 영역별 전공학점을 반영했습니다. 학번별 전공필수 개별 미이수 목록은 아직 확정하지 않습니다." : `${classificationReview?.note ?? profileMismatch?.message ?? pendingEvaluationCause?.reason ?? "학점·이수구분 확인이 필요한 내역이 있습니다."} 성적표 이수 완료와 졸업요건 적용 범위는 별개입니다. 반영 가능한 전공 ${confirmedMajorCredits}학점은 유지했습니다.`}</span><button onClick={() => selectNav("assistant")}>근거 보기 <ChevronRight size={14} /></button></div>}
                </article>

                <article className="card next-card">
                  <div className="card-title-row"><div><span className="card-kicker">NEXT ACTION</span><h2>먼저 확인할 항목</h2></div><ClipboardCheck size={22} /></div>
                  <ol className="action-list">
                    {nextActions.map((item, index) => <li key={`${item.title}-${index}`}><span>{index + 1}</span><div><strong>{item.title}</strong><small>{item.detail}</small></div></li>)}
                  </ol>
                  <button className="secondary-button" onClick={() => selectNav("assistant")}>남은 요건 상담 <ChevronRight size={15} /></button>
                </article>
              </section>

              {audit.courseGuidance && <CourseGuidanceView guidance={audit.courseGuidance} onConfirm={codes => { const next = applyStudentUncompleted(audit, codes); setAudit(next); if (audit.guidanceIdentity && initialAudit?.guidanceIdentity && audit.guidanceIdentity.fileHash === initialAudit.guidanceIdentity.fileHash && audit.guidanceIdentity.studentType === initialAudit.guidanceIdentity.studentType && audit.guidanceIdentity.transferEntryYear === initialAudit.guidanceIdentity.transferEntryYear) onAuditChange?.(next); }} />}
              <section className="lower-grid">
                <article className="card progress-card">
                  <div className="card-title-row"><div><span className="card-kicker">CREDIT AUDIT</span><h2>영역별 이수 현황</h2></div><span className="rule-chip">{ruleVersion}</span></div>
                  <div className="category-grid">
                    {audit.categories.map((category) => {
                      const categoryEvaluable = category.evaluationStatus !== "not-evaluable";
                      const pct = category.required > 0 ? Math.min(100, Math.round((category.earned / category.required) * 100)) : 0;
                      return (
                        <div className={`category-row ${categoryEvaluable ? "" : "category-pending"}`} key={category.key} title={category.note}>
                          <div className="category-label"><span style={{ backgroundColor: category.color }}>{category.shortLabel}</span><strong>{category.label}</strong></div>
                          <div className="progress-track"><i style={{ width: `${pct}%`, backgroundColor: category.color }} /></div>
                          {categoryEvaluable
                            ? <div className="category-value"><strong>{category.earned}</strong><span>/ {category.required}</span>{category.pendingEarned !== undefined && category.pendingEarned > 0 && <small className="pending-credit">확정 {category.earned} · 성적표 표기 {category.reportedEarned ?? 0} · 확인 대기 {category.pendingEarned}학점</small>}{category.earned >= category.required ? <em>충족</em> : <em className="lack">{category.pendingEarned ? `추가 필요 ${Math.max(0, category.required - category.earned - category.pendingEarned)}~${category.required - category.earned}` : `-${category.required - category.earned}`}</em>}{category.key === "majorRequired" && pendingMajorCredits > 0 && <small className="pending-credit">대체 인정 시 {audit.courseMatch?.potentialRequiredCredits}/{category.required}</small>}{category.key === "freeElective" && audit.residualCredits && <small className="residual-credit">직접 {audit.residualCredits.rawFreeElectiveCredits} + 초과 이동 {audit.residualCredits.transferredSurplusCredits}{audit.residualCredits.excessFreeElectiveCredits > 0 ? ` · 기준보다 +${audit.residualCredits.excessFreeElectiveCredits}` : ""}</small>}</div>
                            : <div className="category-value pending"><strong>{category.earned}</strong><span>/ {category.required}</span><em>{category.key === "freeElective" ? "초과학점 근거 확인" : evaluationCauses[0]?.kind === "curriculum-outside-verified-scope" ? "공식표 확인 범위 밖" : profileMismatch ? "선택 전공 확인" : "전공 소속 근거 부족"}</em><small>{category.key === "freeElective" && audit.residualCredits ? `직접 ${audit.residualCredits.rawFreeElectiveCredits} + 확정 초과 ${audit.residualCredits.appliedSurplusCredits}` : `확정 ${category.earned} · 성적표 표기 ${category.reportedEarned ?? 0} · 확인 대기 ${category.pendingEarned ?? 0}학점`}</small>{category.key !== "freeElective" && <small>{Math.max(0, category.required - category.earned - (category.pendingEarned ?? 0)) !== Math.max(0, category.required - category.earned) ? `학점 기준 잔여 ${Math.max(0, category.required - category.earned - (category.pendingEarned ?? 0))}–${Math.max(0, category.required - category.earned)} · 보류 인정 여부에 따라` : `확정 학점 기준 잔여 ${Math.max(0, category.required - category.earned)} · 최종 판정 보류`}</small>}</div>}
                        </div>
                      );
                    })}
                  </div>
                  {appliedCourseAllocations.length > 0 && <details className="curriculum-info">
                    <summary>졸업요건 적용 분류 · {appliedCourseAllocations.length}과목</summary>
                    <p>성적표 원본의 이수구분은 보존합니다. 선택 학과·학번의 명시적인 교육과정 인정 규칙 또는 승인된 대체과목 규칙에 따라 아래 학점을 해당 영역에 한 번만 반영했습니다. 총 취득학점은 바뀌지 않습니다.</p>
                    <ul>{appliedCourseAllocations.map(course => <li key={`allocation-${course.code || course.name}`}>
                      <strong>{course.code} {course.name} · {course.credits}학점</strong>
                      <small>{course.rawCategory || categoryLabel(course.categoryAdjustment?.originalCategory ?? course.category)} → {categoryLabel(course.category)} · {course.categoryAdjustment?.reason}</small>
                    </li>)}</ul>
                  </details>}
                  {audit.residualCredits && (
                    <div className={`residual-policy-note ${audit.residualCredits.status === "not-evaluable" ? "is-pending" : ""}`}>
                      {audit.residualCredits.status === "evaluated" ? <ShieldCheck size={16} /> : <CircleAlert size={16} />}
                      <div><strong>일반선택은 ‘남은 학점 전체’로 다시 맞춥니다</strong><span>세부영역 초과는 먼저 해당 교양·전공 전체 기준을 채우고, 기준을 넘은 학점은 빠짐없이 일반선택 잔여학점으로 이동합니다. 영역 카드끼리 더해서 총학점을 계산하지는 않습니다.</span><small>{audit.residualCredits.note}{audit.residualCredits.sources.length ? ` · 이동 근거: ${audit.residualCredits.sources.map((source) => `${source.label} +${source.surplusCredits}`).join(", ")}` : ""}</small><div className="residual-ledger"><span><b>{audit.residualCredits.rawFreeElectiveCredits}</b><em>직접 일반선택</em></span><i>+</i><span><b>{audit.residualCredits.transferredSurplusCredits}</b><em>영역 초과 이동</em></span><i>=</i><span><b>{audit.residualCredits.effectiveFreeElectiveCredits}</b><em>판정 일반선택</em></span><span className="total-ledger"><b>{audit.applicableEarnedTotal}/{audit.requiredTotal}</b><em>판정 가능 총학점 · {Math.max(0, audit.requiredTotal - audit.applicableEarnedTotal)} 부족</em></span></div></div>
                    </div>
                  )}
                </article>

                <article className="card source-card">
                  <div className="card-title-row"><div><span className="card-kicker">EVIDENCE</span><h2>{audit.profile.admissionYear}학번 졸업요건 적용 원본</h2></div><BookOpenCheck size={22} /></div>
                  <div className="source-list">
                    {sources.map((source) => (
                      <a href={source.url} target="_blank" rel="noreferrer" key={source.id}>
                        <span><strong>{source.title}</strong><small>{source.organization} · {source.updatedAt}</small>{source.evidenceScope && <small>선택 근거: {source.evidenceScope.departmentName} · {source.evidenceScope.locator}</small>}</span><em className="source-role-label">{sourceRoleLabel[source.role ?? "cohort-requirement"]}</em><ExternalLink size={15} />
                      </a>
                    ))}
                  </div>
                  <p className="source-note"><ShieldCheck size={15} /> 학년도뿐 아니라 선택한 학부(과)·전공의 행·쪽·시트까지 일치하는 근거만 표시합니다. 다른 학과 자료와 다른 연도의 분류 보조자료는 졸업요건 원본에서 제외됩니다.</p>
                </article>
              </section>

              <section className={`card major-match-card ${creditEvaluable ? "is-verified" : "pending"}`}>
                <div className="card-title-row">
                  <div><span className="card-kicker">MAJOR IDENTITY & CREDIT AUDIT</span><h2>{signatureCreditAudit ? "선택 전공 지문 대조" : "선택 전공 과목코드 대조"}</h2></div>
                  <span className="verified-scope-badge">{creditEvaluable ? <><CheckCircle2 size={13} /> {!finalAuditEvaluable ? "성적표 이수구분 반영" : currentClassificationApplied ? "현재 분류 교차검증" : signatureCreditAudit ? "전공 지문 일치" : "공식 코드 적용"}</> : <><CircleAlert size={13} /> 판정 보류</>}</span>
                </div>
                <p>{audit.courseMatch?.note}</p>
                {classificationSources.length > 0 && (
                  <div className="classification-reference-panel">
                    <CircleHelp size={17} />
                    <div>
                      <strong>{classificationReferenceYear ?? "현행"} 전공 분류 교차검증 보조자료</strong>
                      <p>이 자료는 개인 성적표의 전필·전선 이수구분을 확인하는 데만 사용하며, {audit.profile.admissionYear}학번 졸업요건과 확정 필수과목 목록을 대체하지 않습니다.</p>
                      <div>{classificationSources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={`classification-${source.id}`}>{source.title}<ExternalLink size={13} /></a>)}</div>
                    </div>
                  </div>
                )}
                {audit.courseMatch?.requiredCourseSetStatus === "review" && !systemPassed && <div className="major-set-review"><CircleAlert size={15} /><span><strong>전공필수 전체 목록은 추가 확인 중입니다.</strong>{audit.courseMatch.requiredCourseSetNote} 공식 적용 행으로 확인된 개별 과목 판정은 아래에 따로 표시합니다.</span></div>}
                {pendingCourseRecognitions.length > 0 && <div className="major-set-review recognition-pending"><CircleAlert size={15} /><span><strong>대체 인정은 확정 미이수와 분리했습니다.</strong>{pendingCourseRecognitions.map((item) => `${item.requiredName}(${item.requiredCode}) ← ${item.substituteName}(${item.substituteCode})`).join(" · ")} · 승인 전에는 전공필수 학점에 더하지 않습니다.</span></div>}
                <div className="major-match-metrics">
                  <div><span>{audit.courseMatch?.programEvidence.method === "course-name-signature" ? "전공 지문 일치" : "공식표 코드 일치"}</span><strong>{audit.courseMatch?.programEvidence.method === "exact-course-code" ? audit.courseMatch.programEvidence.matchedCourses : signatureCreditAudit ? audit.courseMatch?.programEvidence.matchedCourses ?? 0 : audit.courseMatch?.matchedMajorCourses.length ?? 0}<small>개 · {audit.courseMatch?.programEvidence.method === "exact-course-code" ? audit.courseMatch.programEvidence.matchedCredits : signatureCreditAudit ? audit.courseMatch?.programEvidence.matchedCredits ?? 0 : audit.courseMatch?.matchedCredits ?? 0}학점</small></strong></div>
                  <div><span>개인 성적표 분류 인정</span><strong>{audit.courseMatch?.institutionallyRecognizedMajorCourses.length ?? 0}<small>개 · {audit.courseMatch?.institutionallyRecognizedCredits ?? 0}학점</small></strong></div>
                  <div><span>전공필수</span><strong>{majorRequiredProgress?.evaluationStatus === "evaluated" ? `${majorRequiredProgress.earned}/${majorRequiredProgress.required}` : "판정 보류"}<small>{pendingMajorCredits ? `대체 승인 시 ${audit.courseMatch?.potentialRequiredCredits}/${majorRequiredProgress?.required}` : majorRequiredProgress?.evaluationStatus === "evaluated" ? `부족 ${audit.courseMatch?.requiredCreditShortage ?? 0}학점` : `확정 ${majorRequiredProgress?.earned ?? 0} · 확인 대기 ${majorRequiredProgress?.pendingEarned ?? 0}학점`}</small></strong></div>
                </div>
                {audit.courseMatch?.programEvidence.scopedCodeDiagnostics && <p className="ge-audit-intro">동일 학번의 연결된 공식 전공표 범위: 단독 코드 {audit.courseMatch.programEvidence.scopedCodeDiagnostics.uniqueCodes.length}개 · 공유 코드 {audit.courseMatch.programEvidence.scopedCodeDiagnostics.sharedCodes.length}개 · 전체 코드가 겹치는 전공 {audit.courseMatch.programEvidence.scopedCodeDiagnostics.jointCandidateDepartmentIds.length}개. 이 범위의 코드 구분은 진단 참고이며 전체 판정 보류 기준을 바꾸지 않습니다.</p>}
                <p>영역별 부족 학점은 학점 합계로 계산합니다. 아래 과목별 이수·미이수와 대체 인정은 공식 적용 과목표 및 개인 성적표 근거에 따라 확실성 수준이 다릅니다.</p>
                {audit.courseMatch?.verifiedScope && <p className="ge-audit-intro"><strong>공식 확인 범위:</strong> {audit.courseMatch.verifiedScope}</p>}
                {evaluationCauses.length > 0 && <details className={`curriculum-info ${profileMismatch ? "is-warning" : ""}`} open={!!profileMismatch}>
                  <summary>{profileMismatch ? "선택 전공과 성적표 확인" : "교육과정 자료 제공 범위"}</summary>
                  <p>{profileMismatch ? profileMismatch.message : "선택 학과·학번의 교육과정 자료가 연결된 범위에서만 졸업요건을 계산합니다. 자료 범위 밖의 과목도 성적표의 이수 완료 내역은 그대로 표시합니다."}</p>
                  <ul>{evaluationCauses.map((cause) => <li key={cause.kind}><strong>{cause.reason}</strong><small>자료 범위: {cause.sourceScope}{cause.sourceUrl ? <> · <a href={cause.sourceUrl} target="_blank" rel="noreferrer">공식 원본</a></> : ""}</small></li>)}</ul>
                </details>}
                {completedMajorCourses.length === 0 && requiredCourseAssessments.some((item) => item.status === "completed") && <details className="curriculum-info"><summary>이수 완료 전공과목</summary><ul>{requiredCourseAssessments.filter((item) => item.status === "completed").map((item) => <li key={`completed-${item.code}`}><strong>{categoryLabel(item.category)} · {item.code} {item.name}</strong><small>{item.credits}학점 · 이수 완료</small></li>)}</ul></details>}
                {detailedCourseAudit && audit.missingCourses.length > 0 && (
                  <div className="major-missing-panel">
                    <div><strong>졸업까지 남은 필수과목 {audit.missingCourses.length}개</strong><span>공식 적용 과목표와 개인 성적표를 교과목번호로 대조했습니다. 아직 수강하지 않은 과목도 포함하며, 현재 학년의 누락을 뜻하지 않습니다.</span></div>
                    <ul>{audit.missingCourses.map((course) => <li key={`${course.category}-${course.code}`}><span>{course.category} · {course.code}</span><strong>{course.name}</strong><small>{course.credits}학점{course.recommendedYear ? ` · 권장 ${course.recommendedYear}학년${course.recommendedSemester ? ` ${course.recommendedSemester}학기` : ""}` : " · 권장시기 미확인"}{course.alternative ? ` · ${course.alternative}` : ""}</small></li>)}</ul>
                  </div>
                )}
                {detailedCourseAudit && audit.missingCourses.length === 0 && (
                  <div className="major-missing-panel is-complete"><CheckCircle2 size={17} /><span><strong>확인된 요건에서 남은 필수과목이 없습니다.</strong>현재 연결된 공식 적용 과목표 기준이며, 졸업인증과 별도 행정요건은 각각 확인해야 합니다.</span></div>
                )}
                {transitionReviewCourses.length > 0 && (
                  <details className="major-missing-panel is-review">
                    <summary><strong>개인 성적표·대체 인정 확인 {transitionReviewCourses.length}과목</strong></summary>
                    <p>아래 과목은 실제 이수내역의 학점·분류 또는 대체 승인 확인이 필요하여 남은 필수과목과 시간표 필수 추천에서 제외합니다. 확인할 문서와 이유를 각 과목에서 확인하세요.</p>
                    <ul>{transitionReviewCourses.map((course) => {
                      const assessment = requiredCourseAssessments.find((item) => item.code === course.code);
                      const source = [...(audit.courseMatch?.classificationSources ?? []), ...(audit.officialSources ?? [])]
                        .find((item) => item.id === (assessment?.sourceId ?? audit.courseMatch?.sourceId));
                      return <li key={`review-${course.code}`}><span>{assessment?.reviewCause?.kind === "substitution-approval-missing" ? "대체 승인 확인 필요" : "학점·이수구분 확인 필요"} · {course.code}</span><strong>{course.name}</strong><small>{course.credits}학점 · {assessment?.reason ?? course.note ?? "해당 입학년도·학과 공식 전공표와 학과 필수 지정·대체 인정 지침 확인 필요"}{assessment?.reviewCause ? ` · 필요한 근거: ${assessment.reviewCause.missingEvidence}` : ""}{assessment?.sourceScope ? ` · 확인 범위: ${assessment.sourceScope}` : ""}{assessment?.locator ? ` · ${assessment.locator}` : ""}{assessment?.sourceUrl || source ? <> · 출처: <a href={assessment?.sourceUrl ?? source?.url} target="_blank" rel="noreferrer">{source?.title ?? assessment?.sourceId ?? "공식 과목표"}</a></> : ""}</small></li>;
                    })}</ul>
                  </details>
                )}
                {requirementPolicyReviewCourses.length > 0 && <details className="curriculum-info">
                  <summary>교육과정 자료 안내 · {([...new Set(requirementPolicyReviewCourses.map(course => categoryLabel(course.category)))]).join(" · ")}</summary>
                  <p>연결된 교육과정 자료에서 필수 지정 또는 적용 범위를 확정하지 못한 항목입니다. 이미 이수한 과목은 이수 완료로 유지하며, 아래 항목을 남은 필수과목으로 안내하지 않습니다.</p>
                  <details><summary>자료 적용 범위 {requirementPolicyReviewCourses.length}개</summary><ul>{requirementPolicyReviewCourses.map(course => {
                    const assessment = requiredCourseAssessments.find(item => item.code === course.code);
                    return <li key={`policy-${course.code}`}><strong>{categoryLabel(course.category)} · {course.code} {course.name}</strong><small>{assessment?.reason ?? course.note}{assessment?.locator ? ` · ${assessment.locator}` : ""}{assessment?.sourceUrl ? <> · <a href={assessment.sourceUrl} target="_blank" rel="noreferrer">공식 원본</a></> : ""}</small></li>;
                  })}</ul></details>
                </details>}
                {transferRecognitionReviewCourses.length > 0 && <details className="curriculum-info">
                  <summary>이수내역 없는 필수과목 · 편입 인정 확인</summary>
                  <p>전적대 인정학점 총량만으로 개별 필수과목의 이수나 면제를 판단할 수 없습니다. 필수 지정은 확인했습니다. 성적표 이수내역이 없으며 이전학교에서도 미이수라면 수강이 필요합니다. 위 과목 안내에서 본인 미이수를 수강계획에 반영할 수 있습니다.</p>
                  <details><summary>인정 매핑 확인 대상 {transferRecognitionReviewCourses.length}과목</summary><ul>{transferRecognitionReviewCourses.map(course => {
                    const assessment = requiredCourseAssessments.find(item => item.code === course.code);
                    return <li key={`transfer-review-${course.code}`}><strong>{categoryLabel(course.category)} · {course.code} {course.name}</strong><small>{course.recommendedYear ? `권장 ${course.recommendedYear}학년${course.recommendedSemester ? ` ${course.recommendedSemester}학기` : ""}` : "권장시기 미확인"} · 개별 편입 인정·대체 매핑 확인 필요{assessment?.locator ? ` · ${assessment.locator}` : ""}{assessment?.sourceUrl ? <> · <a href={assessment.sourceUrl} target="_blank" rel="noreferrer">필수과목 원본</a></> : ""}</small></li>;
                  })}</ul></details>
                </details>}
                {!detailedCourseAudit && creditEvaluable && (
                  <div className="major-shortage-panel">
                    <div><strong>현재 확인 가능한 부족 항목</strong><span>영역별 학점은 계산하고, 개별 필수과목명은 공식 학번별 과목표가 연결될 때 확정합니다.</span></div>
                    <ul>
                      {majorCategoryShortages.length > 0
                        ? majorCategoryShortages.map((category) => <li key={category.key}><span>{category.label}</span><strong>{category.required - category.earned}학점 부족</strong><small>{category.earned}/{category.required}학점</small></li>)
                        : <li className="is-satisfied"><span>전공 영역 학점</span><strong>수치 기준 충족</strong><small>개별 필수과목은 검수 대기</small></li>}
                    </ul>
                  </div>
                )}
                {completedMajorCourses.length > 0 && (
                  <details className="major-completed-evidence" open>
                    <summary><CheckCircle2 size={15} /><span><strong>이수한 전공과목 {completedMajorCourses.length}개</strong>성적표 이수 학점 {completedMajorCredits}학점 · 전공기초/필수/선택별 상세 보기</span></summary>
                    <div className="major-completed-groups">
                      {completedMajorGroups.map((group) => (
                        <section key={group.key}>
                          <header><span>{group.shortLabel}</span><strong>{group.label}</strong><small>{group.courses.length}개 · {group.courses.reduce((sum, course) => sum + course.credits, 0)}학점</small></header>
                          <div>{group.courses.length > 0 ? group.courses.map((course) => (
                            <article key={`${group.key}-${course.code || course.name}`}>
                              <span>{course.code || "코드 없음"}</span>
                              <strong>{course.name}</strong>
                              <small>{course.year ? `${course.year} · ` : ""}{course.semester || "학기 정보 없음"} · {course.credits}학점{course.transferCredit ? " · 편입 인정" : ""}{isFutureTranscriptTerm(course) ? " · 미래 학기 가상·미검증 이수내역 (실제 취득 확인 불가)" : ""}</small>
                              <em>이수 완료</em>
                              {!["matched", "institution-recognized"].includes(course.majorCourseMatchStatus ?? "") && <small className="curriculum-applicability">{reviewCauses.some(cause => cause.kind === "credit-category-conflict" && cause.courseCodes.includes(course.code)) ? "졸업요건 적용: 학점·분류 확인" : "졸업요건 적용 자료 미연결"}</small>}
                            </article>
                          )) : <p>확인된 이수과목 없음</p>}</div>
                        </section>
                      ))}
                    </div>
                  </details>
                )}
              </section>

              {audit.generalEducation && (
                <section className="card ge-audit-card">
                  <div className="card-title-row">
                    <div><span className="card-kicker">VERIFIED GENERAL EDUCATION</span><h2>교양 세부영역 이수 현황</h2></div>
                    <span className="verified-scope-badge"><CheckCircle2 size={13} /> 학년도·전공 적용</span>
                  </div>
                  <p className="ge-audit-intro">{audit.profile.admissionYear}학년도 공식 교양교육과정표에서 {audit.profile.department}의 이수체계와 학년도별 교양 과목코드를 적용했습니다. 과목명 유사도는 사용하지 않고 공식 교과목번호가 정확히 일치한 경우만 합산합니다.</p>
                  {personalityRequired && (
                    <div className="ge-personality-note"><ShieldCheck size={16} /><span><strong>윤리는 독립된 전 학과 공통 필수영역이 아닙니다.</strong>{personalityElective ? "이 학번·전공은 앵커스피릿 필수와 별도로 인성 선택 2학점이 필요하며, 윤리와인간·정보와윤리 등은 그 인성 선택 영역의 인정 과목입니다." : "이 학번·전공은 인성 필수인 앵커스피릿만 요구하며, 별도의 윤리 또는 인성 선택 최소학점은 없습니다."}</span></div>
                  )}
                  <div className="ge-trust-strip" aria-label="교양 판정 안전장치">
                    <span><strong>적용 범위</strong>{audit.profile.admissionYear}학번 · {audit.profile.department}</span>
                    <span><strong>인정 방식</strong>{specialGeneralEducationMatches.length ? "공식 코드 · 검증된 특수 인정" : "공식 교양코드 직접 인정"}</span>
                    <span><strong>중복 방지</strong>동일 코드 1회만 합산</span>
                    <span><strong>불명확 코드</strong>자동 인정 없이 확인 필요</span>
                  </div>
                  <div className="ge-progress-grid">
                    {audit.generalEducation.areas.map((item) => (
                      <article className={`ge-progress-item status-${item.status}`} key={item.id}>
                        <div className="ge-progress-heading">
                          <span>{item.status === "satisfied" ? <CheckCircle2 size={16} /> : <CircleAlert size={16} />}{item.parentArea}</span>
                          <strong>{item.earned}<small> / {item.required}학점</small></strong>
                        </div>
                        <h3>{item.label}</h3>
                        <div className="ge-course-list">{item.matchedCourses.length ? item.matchedCourses.map((course) => (
                          <div className="ge-course-row" key={course.code}>
                            <span>{course.code} · {course.name} ({course.credits})</span>
                            <small className={`recognition-tag mode-${course.recognitionMode}`}>{recognitionLabel[course.recognitionMode]}</small>
                            {course.transferCredit && <small className="recognition-tag transfer">편입 인정</small>}
                          </div>
                        )) : <span>일치 과목 없음</span>}</div>
                        <em>{item.status === "satisfied" ? item.earned > item.required ? `충족 · +${item.earned - item.required}학점 초과` : "충족" : item.status === "missing" ? `최소 ${Math.max(0, item.required - item.earned)}학점 부족` : "대체·변경 과목 확인 필요"}</em>
                      </article>
                    ))}
                  </div>
                  <div className="ge-overflow-note"><CircleHelp size={15} /><span><strong>세부영역의 ‘초과’가 곧바로 일반선택으로 바뀌는 것은 아닙니다.</strong>예를 들어 해양과 문화가 5/2학점이면 5학점 모두 먼저 교양선택 총학점에 포함되고, 교양선택 전체 최소학점을 넘긴 부분만 일반선택 잔여 산정에 사용됩니다.</span></div>
                  {audit.generalEducation.combinedRequirements.map((item) => (
                    <div className={`ge-combined-row status-${item.status}`} key={item.id}>
                      <span>{item.status === "satisfied" ? <CheckCircle2 size={16} /> : <CircleAlert size={16} />}<strong>{item.label}</strong><small>동일 과목 중복 합산 없음</small></span>
                      <em>{item.earned} / {item.required}학점 · {item.status === "satisfied" ? "충족" : item.status === "missing" ? "미충족" : "확인 필요"}</em>
                    </div>
                  ))}
                  {audit.generalEducation.unmappedGeneralElectives.length > 0 && (
                    <div className="ge-unmapped-note"><CircleAlert size={16} /><span><strong>공식 영역표에 없는 코드가 있습니다.</strong>{audit.generalEducation.unmappedGeneralElectives.map((course) => `${course.code} ${course.name}`).join(", ")}의 변경·대체 인정 여부를 확인해야 합니다.</span></div>
                  )}
                  {audit.generalEducation.mappingConflicts.length > 0 && (
                    <div className="ge-unmapped-note"><AlertTriangle size={16} /><span><strong>안전 검사에서 매핑 이상을 발견했습니다.</strong>{audit.generalEducation.mappingConflicts.map((course) => `${course.code} · ${mappingConflictLabel[course.reason]}${course.expectedCredits === undefined ? "" : ` (성적표 ${course.credits} / 공식 ${course.expectedCredits}학점)`}`).join(", ")}는 자동 합산하지 않았습니다.</span></div>
                  )}
                  {specialGeneralEducationMatches.length > 0 && (
                    <details className="ge-recognition-evidence" open>
                      <summary><ShieldCheck size={15} /> 이중설강·교차강의는 왜 인정됐나요?</summary>
                      <div>
                        {specialGeneralEducationMatches.map((course) => (
                          <article key={course.code}>
                            <div><strong>{course.code} · {course.name}</strong><span>{recognitionLabel[course.recognitionMode]}{course.transferCredit ? " · 편입 인정행" : ""}</span></div>
                            <p>{course.evidence?.note} · <b>{course.evidence?.sheet}</b> {course.evidence?.cellRange}</p>
                            {course.categoryDifference && <small>성적표에는 ‘{course.transcriptCategory}’로 표시되지만, 공식 학과별 이수체계의 특수 인정 규칙에 따라 이 영역에는 합산했습니다. 이수구분별 총학점은 개인 성적표 원값을 유지합니다.</small>}
                          </article>
                        ))}
                      </div>
                    </details>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
