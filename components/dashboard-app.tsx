"use client";

import { useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  BookOpenCheck,
  Bot,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Database,
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
import { auditDemo } from "@/lib/graduation-engine";
import { officialSources, RULESET_VERSION } from "@/lib/rules";
import type { GraduationGoal } from "@/lib/onboarding";
import type { DetailedAudit } from "@/lib/types";
import UploadView from "@/components/views/upload-view";
import AssistantView from "@/components/views/assistant-view";
import PlannerView from "@/components/views/planner-view";
import AdminView from "@/components/views/admin-view";
import EvaluationView from "@/components/views/evaluation-view";

const navItems = [
  { id: "dashboard", label: "졸업 진단", icon: Gauge },
  { id: "upload", label: "성적표 업로드", icon: UploadCloud },
  { id: "assistant", label: "AI 졸업 상담", icon: Bot },
  { id: "planner", label: "수강 설계", icon: CalendarDays },
  { id: "admin", label: "요건 데이터", icon: Database },
  { id: "evaluation", label: "모델 · 평가", icon: BarChart3 },
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

function ScoreRing({ value }: { value: number | null }) {
  return (
    <div className={`score-ring ${value === null ? "score-pending" : ""}`} style={{ "--score": `${(value ?? 0) * 3.6}deg` } as React.CSSProperties}>
      <div>
        <strong>{value === null ? "—" : `${value}%`}</strong>
        <span>{value === null ? "판정 보류" : "판정 반영 이수율"}</span>
      </div>
    </div>
  );
}

interface DashboardAppProps {
  initialAudit?: DetailedAudit;
  initialView?: "dashboard" | "planner";
  graduationGoal?: GraduationGoal;
  onEditProfile?: () => void;
}

export default function DashboardApp({ initialAudit, initialView = "dashboard", graduationGoal = "regular", onEditProfile }: DashboardAppProps) {
  const [active, setActive] = useState<NavId>(initialView);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [audit, setAudit] = useState<DetailedAudit>(() => initialAudit ?? auditDemo());
  const auditEvaluable = audit.overallStatus === "evaluated";
  const progress = auditEvaluable ? Math.min(100, Math.round(((audit.requiredTotal - audit.forecastCredits) / audit.requiredTotal) * 100)) : null;
  const mandatoryCredits = audit.missingCourses.reduce((sum, course) => sum + course.credits, 0);
  const sources = audit.officialSources ?? officialSources;
  const ruleVersion = audit.ruleVersion ?? RULESET_VERSION;
  const provisional = audit.ruleStatus === "provisional";
  const majorCreditAudit = audit.courseMatch?.status === "verified";
  const detailedCourseAudit = majorCreditAudit && audit.courseMatch?.requiredCourseSetStatus === "verified";
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
  const pendingMajorCredits = pendingCourseRecognitions.reduce((sum, item) => sum + item.credits, 0);
  const completedMajorCourseMap = new Map<string, DetailedAudit["courses"][number]>();
  for (const course of audit.courses) {
    if (!course.passed || !["matched", "institution-recognized"].includes(course.majorCourseMatchStatus ?? "")) continue;
    if (!majorCategoryMeta.some((meta) => meta.key === course.category)) continue;
    const key = course.code ? `code:${course.code.toUpperCase()}` : `name:${course.name}`;
    const previous = completedMajorCourseMap.get(key);
    if (!previous || `${course.year}-${course.semester}` > `${previous.year}-${previous.semester}`) completedMajorCourseMap.set(key, course);
  }
  const completedMajorCourses = [...completedMajorCourseMap.values()];
  const completedMajorCredits = completedMajorCourses.reduce((sum, course) => sum + course.credits, 0);
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
        : auditEvaluable
          ? [{ title: "학번별 전공필수 과목표 검수", detail: "영역별 학점은 반영 · 개별 미이수 과목은 판정 보류" }]
          : [{ title: "전공 선택 또는 성적표 확인", detail: "전공 지문 부족 · 전공학점과 전체 퍼센트 판정 보류" }]),
    ...pendingCourseRecognitions.map((item) => ({ title: `${item.requiredName} 대체 인정 확인`, detail: `${item.substituteName}(${item.substituteCode}) · 승인 시 ${item.credits}학점` })),
    ...(!certificationKnown ? [{ title: "졸업인증 정보 입력", detail: "어학·봉사·자격증은 성적표만으로 확인 불가" }] : []),
  ].slice(0, 3);

  const selectNav = (id: NavId) => {
    setActive(id);
    setMobileOpen(false);
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
          {navItems.slice(0, 4).map(({ id, label, icon: Icon }) => (
            <button key={id} className={active === id ? "active" : ""} onClick={() => selectNav(id)}>
              <Icon size={18} /><span>{label}</span>{id === "assistant" && <em>AI</em>}
            </button>
          ))}
          <p className="nav-eyebrow admin-label">PROJECT LAB</p>
          {navItems.slice(4).map(({ id, label, icon: Icon }) => (
            <button key={id} className={active === id ? "active" : ""} onClick={() => selectNav(id)}>
              <Icon size={18} /><span>{label}</span>
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
            <span className="saved-text">{provisional ? "임시 승인 규칙" : "승인 규칙"}</span>
          </div>
        </header>

        <div className="content-wrap">
          {active === "upload" && <UploadView audit={audit} onAudit={setAudit} onShowDashboard={() => selectNav("dashboard")} />}
          {active === "assistant" && <AssistantView audit={audit} />}
          {active === "planner" && <PlannerView audit={audit} graduationGoal={graduationGoal} />}
          {active === "admin" && <AdminView />}
          {active === "evaluation" && <EvaluationView />}
          {active === "dashboard" && (
            <>
              <section className="page-heading">
                <div>
                  <span className="eyebrow">{audit.profile.admissionYear} · {audit.profile.department} · {audit.profile.studentType}</span>
                  <h1>{classificationReview ? "성적표 이수구분 " : profileMismatch ? "성적표와 선택 전공이 " : auditEvaluable ? `${audit.profile.admissionYear} 교육과정 ` : "선택 전공 확인 "}<em>{classificationReview ? "확인이 필요해요" : profileMismatch ? "일치하지 않을 수 있어요" : detailedCourseAudit ? "과목코드 진단" : auditEvaluable ? "영역별 학점 진단" : "검수 대기"}</em>{classificationReview || profileMismatch || !auditEvaluable ? "" : " 결과입니다"}</h1>
                  <p>{classificationReview ? classificationReview.note : profileMismatch ? profileMismatch.message : auditEvaluable ? currentClassificationApplied ? `${audit.profile.admissionYear}학번 졸업요건은 ${audit.profile.admissionYear} 원본으로 적용하고, ${classificationReferenceYear ?? "현행"} 자료는 개인 성적표의 전공 이수구분 교차검증에만 사용했습니다.` : signatureCreditAudit ? "선택 전공의 고유 과목명 지문을 확인한 뒤 종합정보시스템의 전공기초·전공필수·전공선택 학점을 반영했습니다. 개별 필수과목 목록은 추가 검수 중입니다." : "선택 전공의 입학학년도 교육과정표와 과목코드 지문을 대조했습니다. 교양 세부영역과 그 밖의 임시 범위는 별도로 표시합니다." : "총 취득학점은 참고로 표시하지만, 선택 전공을 뒷받침하는 과목 지문이 충분하지 않으면 전공학점과 전체 졸업 준비도 퍼센트를 계산하지 않습니다."}</p>
                </div>
                <button className="primary-button" onClick={() => selectNav("upload")}><FileSpreadsheet size={18} />성적표 다시 분석</button>
              </section>

              {provisional && (
                <section className="provisional-banner" role="status">
                  <AlertTriangle size={19} />
                  <div><strong>{auditEvaluable ? currentClassificationApplied ? `${audit.profile.admissionYear} 적용 원본 · 분류 보조자료 분리` : signatureCreditAudit ? "선택 전공 지문 확인 · 영역별 학점 반영" : "공식 전공 과목코드 적용 · 나머지 임시 범위" : "안전 모드 · 전체 판정 보류"}</strong><p>{auditEvaluable ? currentClassificationApplied ? `${classificationReferenceYear ?? "현행"} 자료는 전공 분류 확인에만 쓰며 ${audit.profile.admissionYear}학번의 졸업학점·필수요건을 대체하지 않습니다. 확정된 대체과목은 전공선택에 중복 합산하지 않습니다.` : signatureCreditAudit ? "다른 학과 성적표를 잘못 적용하지 않도록 전공 고유 과목명을 먼저 비교했습니다. 학번별 전공필수 전체 목록과 대체·폐지 과목은 추가 검수 중입니다." : "전공 분류는 공식 코드로 검증했습니다. 폐지·변경·대체과목과 졸업인증은 학사과·학과사무실의 최종 졸업사정과 다를 수 있습니다." : "성적표의 전공필수·전공선택 표기만으로 선택 학과를 단정하지 않습니다. 전공 지문이 충분할 때만 전공 충족과 전체 퍼센트를 표시합니다."}</p></div>
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
                    <div><span className="card-kicker">GRADUATION READINESS</span><h2>현재 졸업 준비도</h2></div>
                    <span className="warning-badge">{profileMismatch ? "전공 불일치 의심" : detailedCourseAudit ? "과목코드 판정" : auditEvaluable ? "영역별 학점 판정" : "판정 보류"}</span>
                  </div>
                  <div className="hero-card-body">
                    <ScoreRing value={progress} />
                    <div className="summary-metrics">
                      <div><span>성적표 총 취득학점</span><strong>{audit.earnedTotal}<small> / {audit.requiredTotal}</small></strong></div>
                      <div><span>전공필수 학점</span><strong>{majorRequiredProgress?.evaluationStatus === "evaluated" ? majorRequiredProgress.earned : "—"}<small>{majorRequiredProgress?.evaluationStatus === "evaluated" ? ` / ${majorRequiredProgress.required}${pendingMajorCredits ? ` · +${pendingMajorCredits} 확인` : ""}` : " 판정 보류"}</small></strong></div>
                      <div><span>확정 미이수 교과목</span><strong>{detailedCourseAudit ? audit.missingCourses.length : "?"}<small>{detailedCourseAudit ? `개 · 전필 ${confirmedMajorMissing.length}` : " 검수 대기"}</small></strong></div>
                      <div><span>졸업 인증</span><strong>{certificationKnown ? Number(audit.certification.language) + Number(audit.certification.activity) : "?"}<small>{certificationKnown ? " / 2" : " 확인 필요"}</small></strong></div>
                    </div>
                  </div>
                  <div className="explain-strip"><Sparkles size={17} /><span><strong>판정 요약</strong> {auditEvaluable ? detailedCourseAudit ? currentClassificationApplied ? `${audit.profile.admissionYear} 적용 원본으로 요건을 판정하고, 분류 보조자료는 성적표 이수구분 확인에만 썼습니다. 확정 미이수는 ${audit.missingCourses.length}과목 ${mandatoryCredits}학점입니다.${pendingCourseRecognitions.length ? ` 대체 인정 확인 ${pendingCourseRecognitions.length}건은 확정 미이수에서 분리했습니다.` : ""}` : `공식 전공 과목코드와 성적표를 비교했습니다. 확인된 필수 미이수 과목 학점 합계는 ${mandatoryCredits}학점입니다.` : "선택 전공 지문과 성적표 이수구분을 대조해 영역별 전공학점을 반영했습니다. 학번별 전공필수 개별 미이수 목록은 아직 확정하지 않습니다." : "선택 전공의 과목 지문이 부족해 전공학점과 전체 준비도는 자동 충족으로 처리하지 않았습니다."}</span><button onClick={() => selectNav("assistant")}>근거 보기 <ChevronRight size={14} /></button></div>
                </article>

                <article className="card next-card">
                  <div className="card-title-row"><div><span className="card-kicker">NEXT ACTION</span><h2>먼저 확인할 항목</h2></div><ClipboardCheck size={22} /></div>
                  <ol className="action-list">
                    {nextActions.map((item, index) => <li key={`${item.title}-${index}`}><span>{index + 1}</span><div><strong>{item.title}</strong><small>{item.detail}</small></div></li>)}
                  </ol>
                  <button className="secondary-button" onClick={() => selectNav("planner")}>수강 계획 만들기 <ChevronRight size={15} /></button>
                </article>
              </section>

              <section className="lower-grid">
                <article className="card progress-card">
                  <div className="card-title-row"><div><span className="card-kicker">CREDIT AUDIT</span><h2>영역별 이수 현황</h2></div><span className="rule-chip">{ruleVersion}</span></div>
                  <div className="category-grid">
                    {audit.categories.map((category) => {
                      const categoryEvaluable = category.evaluationStatus !== "not-evaluable";
                      const pct = categoryEvaluable && category.required > 0 ? Math.min(100, Math.round((category.earned / category.required) * 100)) : 0;
                      return (
                        <div className={`category-row ${categoryEvaluable ? "" : "category-pending"}`} key={category.key} title={category.note}>
                          <div className="category-label"><span style={{ backgroundColor: category.color }}>{category.shortLabel}</span><strong>{category.label}</strong></div>
                          <div className="progress-track"><i style={{ width: `${pct}%`, backgroundColor: category.color }} /></div>
                          {categoryEvaluable
                            ? <div className="category-value"><strong>{category.earned}</strong><span>/ {category.required}</span>{category.earned >= category.required ? <em>충족</em> : <em className="lack">-{category.required - category.earned}</em>}{category.key === "majorRequired" && pendingMajorCredits > 0 && <small className="pending-credit">대체 인정 시 {audit.courseMatch?.potentialRequiredCredits}/{category.required}</small>}{category.key === "freeElective" && audit.residualCredits && <small className="residual-credit">직접 {audit.residualCredits.rawFreeElectiveCredits} + 초과 이동 {audit.residualCredits.transferredSurplusCredits}{audit.residualCredits.excessFreeElectiveCredits > 0 ? ` · 기준보다 +${audit.residualCredits.excessFreeElectiveCredits}` : ""}</small>}</div>
                            : <div className="category-value pending"><strong>—</strong><span>/ {category.required}</span><em>코드 검수 대기</em><small>{category.key === "freeElective" && audit.residualCredits ? `직접 ${audit.residualCredits.rawFreeElectiveCredits} + 확정 초과 ${audit.residualCredits.appliedSurplusCredits}` : `성적표 표기 ${category.reportedEarned ?? 0}학점`}</small></div>}
                        </div>
                      );
                    })}
                  </div>
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

              <section className={`card major-match-card ${auditEvaluable ? "is-verified" : "pending"}`}>
                <div className="card-title-row">
                  <div><span className="card-kicker">MAJOR IDENTITY & CREDIT AUDIT</span><h2>{signatureCreditAudit ? "선택 전공 지문 대조" : "선택 전공 과목코드 대조"}</h2></div>
                  <span className="verified-scope-badge">{auditEvaluable ? <><CheckCircle2 size={13} /> {currentClassificationApplied ? "현재 분류 교차검증" : signatureCreditAudit ? "전공 지문 일치" : "공식 코드 적용"}</> : <><CircleAlert size={13} /> 판정 보류</>}</span>
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
                {audit.courseMatch?.requiredCourseSetStatus === "review" && <div className="major-set-review"><CircleAlert size={15} /><span><strong>전공필수 전체 목록은 추가 확인 중입니다.</strong>{audit.courseMatch.requiredCourseSetNote}</span></div>}
                {pendingCourseRecognitions.length > 0 && <div className="major-set-review recognition-pending"><CircleAlert size={15} /><span><strong>대체 인정은 확정 미이수와 분리했습니다.</strong>{pendingCourseRecognitions.map((item) => `${item.requiredName}(${item.requiredCode}) ← ${item.substituteName}(${item.substituteCode})`).join(" · ")} · 승인 전에는 전공필수 학점에 더하지 않습니다.</span></div>}
                <div className="major-match-metrics">
                  <div><span>{signatureCreditAudit ? "전공 지문 일치" : "공식표 코드 일치"}</span><strong>{signatureCreditAudit ? audit.courseMatch?.programEvidence.matchedCourses ?? 0 : audit.courseMatch?.matchedMajorCourses.length ?? 0}<small>개 · {signatureCreditAudit ? audit.courseMatch?.programEvidence.matchedCredits ?? 0 : audit.courseMatch?.matchedCredits ?? 0}학점</small></strong></div>
                  <div><span>개인 성적표 분류 인정</span><strong>{audit.courseMatch?.institutionallyRecognizedMajorCourses.length ?? 0}<small>개 · {audit.courseMatch?.institutionallyRecognizedCredits ?? 0}학점</small></strong></div>
                  <div><span>전공필수</span><strong>{majorRequiredProgress?.evaluationStatus === "evaluated" ? `${majorRequiredProgress.earned}/${majorRequiredProgress.required}` : "판정 보류"}<small>{pendingMajorCredits ? `대체 승인 시 ${audit.courseMatch?.potentialRequiredCredits}/${majorRequiredProgress?.required}` : `부족 ${audit.courseMatch?.requiredCreditShortage ?? 0}학점`}</small></strong></div>
                </div>
                {detailedCourseAudit && audit.missingCourses.length > 0 && (
                  <div className="major-missing-panel">
                    <div><strong>확정 미이수 필수과목 {audit.missingCourses.length}개</strong><span>공식 적용 과목표와 개인 성적표를 교과목번호로 대조했습니다.</span></div>
                    <ul>{audit.missingCourses.map((course) => <li key={`${course.category}-${course.code}`}><span>{course.category} · {course.code}</span><strong>{course.name}</strong><small>{course.credits}학점{course.alternative ? ` · ${course.alternative}` : ""}</small></li>)}</ul>
                  </div>
                )}
                {detailedCourseAudit && audit.missingCourses.length === 0 && (
                  <div className="major-missing-panel is-complete"><CheckCircle2 size={17} /><span><strong>확인된 필수과목 누락이 없습니다.</strong>현재 연결된 공식 적용 과목표 기준이며, 졸업인증과 별도 행정요건은 각각 확인해야 합니다.</span></div>
                )}
                {!detailedCourseAudit && transitionReviewCourses.length > 0 && (
                  <div className="major-missing-panel is-review">
                    <div><strong>필수 여부 최종 검수 후보 {transitionReviewCourses.length}과목</strong><span>현행 전공표에는 필수로 표시되지만 입학학년도 전환·대체표 확인 전에는 미이수로 확정하지 않습니다.</span></div>
                    <ul>{transitionReviewCourses.map((course) => <li key={`review-${course.code}`}><span>확인 필요 · {course.code}</span><strong>{course.name}</strong><small>{course.credits}학점 · 학과 적용 여부 검수 중</small></li>)}</ul>
                  </div>
                )}
                {!detailedCourseAudit && auditEvaluable && (
                  <div className="major-shortage-panel">
                    <div><strong>현재 확인 가능한 부족 항목</strong><span>영역별 학점은 계산하고, 개별 필수과목명은 공식 학번별 과목표가 연결될 때 확정합니다.</span></div>
                    <ul>
                      {majorCategoryShortages.length > 0
                        ? majorCategoryShortages.map((category) => <li key={category.key}><span>{category.label}</span><strong>{category.required - category.earned}학점 부족</strong><small>{category.earned}/{category.required}학점</small></li>)
                        : <li className="is-satisfied"><span>전공 영역 학점</span><strong>수치 기준 충족</strong><small>개별 필수과목은 검수 대기</small></li>}
                    </ul>
                  </div>
                )}
                {auditEvaluable && completedMajorCourses.length > 0 && (
                  <details className="major-completed-evidence" open>
                    <summary><CheckCircle2 size={15} /><span><strong>이수한 전공과목 {completedMajorCourses.length}개</strong>{completedMajorCredits}학점 · 전공기초/필수/선택별 상세 보기</span></summary>
                    <div className="major-completed-groups">
                      {completedMajorGroups.map((group) => (
                        <section key={group.key}>
                          <header><span>{group.shortLabel}</span><strong>{group.label}</strong><small>{group.courses.length}개 · {group.courses.reduce((sum, course) => sum + course.credits, 0)}학점</small></header>
                          <div>{group.courses.length > 0 ? group.courses.map((course) => (
                            <article key={`${group.key}-${course.code || course.name}`}>
                              <span>{course.code || "코드 없음"}</span>
                              <strong>{course.name}</strong>
                              <small>{course.year ? `${course.year} · ` : ""}{course.semester || "학기 정보 없음"} · {course.credits}학점{course.transferCredit ? " · 편입 인정" : ""}</small>
                              <em>{course.majorCourseMatchStatus === "matched" ? "공식 코드" : "성적표 분류"}</em>
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
