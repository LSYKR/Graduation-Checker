"use client";

import { useMemo, useState } from "react";
import { CalendarCheck2, Check, Clock3, Info, Lock, Sparkles, WandSparkles } from "lucide-react";
import type { GraduationGoal } from "@/lib/onboarding";
import type { CategoryKey, DetailedAudit } from "@/lib/types";

interface PlannerViewProps {
  audit: DetailedAudit;
  graduationGoal?: GraduationGoal;
}

type PlannerGoal = "regular" | "linked" | "early";
type RecommendationPriority = "필수" | "확인" | "권장";

interface Recommendation {
  code: string;
  name: string;
  credits: number;
  kind: string;
  priority: RecommendationPriority;
  reason: string;
}

const categoryKinds: Partial<Record<CategoryKey, string>> = {
  generalRequired: "교양필수",
  generalElective: "교양선택",
  majorFoundation: "전공기초",
  majorRequired: "전공필수",
  majorElective: "전공선택",
  freeElective: "일반선택",
};

function initialPlannerGoal(goal: GraduationGoal): PlannerGoal {
  if (goal === "bachelors-masters") return "linked";
  if (goal === "early-graduation") return "early";
  return "regular";
}

function buildRecommendations(audit: DetailedAudit): Recommendation[] {
  const recommendations = new Map<string, Recommendation>();
  const add = (recommendation: Recommendation) => {
    if (!recommendations.has(recommendation.code)) recommendations.set(recommendation.code, recommendation);
  };

  for (const course of audit.missingCourses) {
    add({
      code: course.code,
      name: course.name,
      credits: course.credits,
      kind: course.category,
      priority: course.priority,
      reason: course.note ?? "공식 적용 과목표와 성적표 대조 결과",
    });
  }

  for (const area of audit.generalEducation?.areas ?? []) {
    if (area.status !== "missing") continue;
    const deficit = Math.max(0, area.required - area.earned);
    if (!deficit) continue;
    add({
      code: `GE-${area.id}`,
      name: `${area.label} 영역 보완`,
      credits: deficit,
      kind: area.parentArea,
      priority: "필수",
      reason: `공식 교양 과목코드 기준 ${area.earned}/${area.required}학점`,
    });
  }

  const representedKinds = new Set([...recommendations.values()].map((course) => course.kind));
  for (const category of audit.categories) {
    if (category.evaluationStatus !== "evaluated" || category.earned >= category.required || category.key === "freeElective") continue;
    const kind = categoryKinds[category.key] ?? category.label;
    if (representedKinds.has(kind)) continue;
    const deficit = category.required - category.earned;
    add({
      code: `AREA-${category.key}`,
      name: `${category.label} ${deficit}학점 보완`,
      credits: deficit,
      kind,
      priority: "필수",
      reason: "개설과목표 연결 전에는 특정 과목을 임의 추천하지 않습니다.",
    });
  }

  for (const item of audit.courseMatch?.pendingCourseRecognitions ?? []) {
    add({
      code: item.substituteCode,
      name: item.substituteName,
      credits: item.credits,
      kind: "대체 인정",
      priority: "확인",
      reason: `${item.requiredName}(${item.requiredCode}) 대체 인정 확인 필요`,
    });
  }

  return [...recommendations.values()];
}

export default function PlannerView({ audit, graduationGoal = "regular" }: PlannerViewProps) {
  const recommendations = useMemo(() => buildRecommendations(audit), [audit]);
  const [goal, setGoal] = useState<PlannerGoal>(() => initialPlannerGoal(graduationGoal));
  const [dayOff, setDayOff] = useState("friday");
  const [selected, setSelected] = useState(() => new Set(
    recommendations.filter((course) => course.priority !== "확인").map((course) => course.code),
  ));
  const selectedCourses = recommendations.filter((course) => selected.has(course.code));
  const total = selectedCourses.reduce((sum, course) => sum + course.credits, 0);
  const requiredCredits = selectedCourses.filter((course) => course.priority === "필수").reduce((sum, course) => sum + course.credits, 0);
  const electiveCredits = selectedCourses.filter((course) => course.kind === "전공선택").reduce((sum, course) => sum + course.credits, 0);
  const plannerAvailable = audit.overallStatus === "evaluated" && audit.courseMatch?.status === "verified";
  const transferStudent = audit.profile.studentTypeCode === "transfer";

  function toggle(code: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function recalculate() {
    setSelected(new Set(recommendations.filter((course) => course.priority !== "확인").map((course) => course.code)));
  }

  if (!plannerAvailable) {
    return (
      <section className="workspace-view planner-view">
        <div className="view-heading"><div><span className="eyebrow">SAFE COURSE PLANNER</span><h1>상세 과목 추천은 검수 후 열립니다</h1><p>{audit.profile.admissionYear}학번 · {audit.profile.department}은 현재 선택 전공과 성적표의 일치 여부를 먼저 확인해야 합니다.</p></div><span className="local-badge"><Lock size={14} /> 상세 규칙 대기</span></div>
        <article className="card planning-note-card amber"><Info size={19} /><div><strong>다른 전공의 과목을 추천하지 않습니다</strong><p>선택 전공의 과목 지문이 확인되기 전에는 수강 과목명을 생성하지 않습니다. 졸업 진단 화면에서 전공 선택과 성적표를 먼저 확인해주세요.</p></div></article>
      </section>
    );
  }

  return (
    <section className="workspace-view planner-view">
      <div className="view-heading"><div><span className="eyebrow">GOAL-AWARE COURSE PLANNER</span><h1>남은 요건으로 다음 학기를 설계해요</h1><p>확인된 필수과목과 영역별 부족학점을 먼저 반영하고, 미검수 과목은 생성하지 않습니다.</p></div><span className="local-badge ai"><WandSparkles size={14} /> {audit.forecastCredits}학점 보완 예상</span></div>
      <div className="planner-layout">
        <div className="planner-primary">
          <article className="card plan-controls">
            <div className="control-group"><label>졸업 목표</label><div className="segmented"><button className={goal === "regular" ? "active" : ""} onClick={() => setGoal("regular")}>정규 졸업</button><button className={goal === "linked" ? "active" : ""} onClick={() => setGoal("linked")}>학·석사 연계</button><button className={goal === "early" ? "active" : ""} disabled={transferStudent} title={transferStudent ? "편입생은 조기졸업 대상에서 제외됩니다" : "조기졸업 자격은 별도 확인이 필요합니다"} onClick={() => setGoal("early")}>{transferStudent && <Lock size={12} />} 조기졸업</button></div></div>
            <div className="control-group"><label>공강 선호</label><select value={dayOff} onChange={(event) => setDayOff(event.target.value)}><option value="friday">금요일 공강</option><option value="monday">월요일 공강</option><option value="none">공강보다 필수 우선</option></select></div>
            <button className="generate-button" disabled={!recommendations.length} onClick={recalculate}><Sparkles size={16} /> 기본 추천안 복원</button>
          </article>
          <article className="card course-plan-card">
            <div className="section-title"><div><span className="card-kicker">REQUIREMENT-BASED SET</span><h2>우선 확인·수강 후보</h2></div><span>{selected.size}개 · {total}학점</span></div>
            {recommendations.length ? (
              <div className="course-plan-list">
                {recommendations.map((course) => (
                  <button className={selected.has(course.code) ? "selected" : ""} key={course.code} onClick={() => toggle(course.code)}>
                    <span className="course-check">{selected.has(course.code) && <Check size={13} />}</span>
                    <span className="course-code">{course.code}</span>
                    <span className="course-name"><strong>{course.name}</strong><small>{course.reason}</small></span>
                    <span className="course-kind">{course.kind}</span><strong className="course-credit">{course.credits}학점</strong><em className={`priority ${course.priority}`}>{course.priority}</em>
                  </button>
                ))}
              </div>
            ) : <div className="course-plan-empty"><Check size={18} /><strong>현재 확정된 보완 항목이 없습니다.</strong><span>졸업인증과 행정요건은 별도로 확인해야 합니다.</span></div>}
          </article>
        </div>
        <aside className="planner-side">
          <article className="card plan-summary-card">
            <span className="card-kicker">PLAN SUMMARY</span><h2>다음 학기 계획안</h2>
            <div className="big-credit"><strong>{total}</strong><span>학점</span></div>
            <dl><div><dt>필수 보완</dt><dd>{requiredCredits}학점</dd></div><div><dt>전공선택</dt><dd>{electiveCredits}학점</dd></div><div><dt>예상 누적</dt><dd>{audit.earnedTotal + total}학점</dd></div><div><dt>공강 조건</dt><dd>{dayOff === "friday" ? "금요일" : dayOff === "monday" ? "월요일" : "미적용"}</dd></div></dl>
            <p><Info size={13} /> 실제 개설 여부와 시간 충돌은 수강편람 연결 후 확정합니다.</p>
          </article>
          <article className="card planning-note-card"><CalendarCheck2 size={19} /><div><strong>추천 원칙</strong><p>공식 필수과목 → 영역 부족 → 졸업인증 → 공강 선호 순서로 반영합니다.</p></div></article>
          <article className="card planning-note-card amber"><Clock3 size={19} /><div><strong>{goal === "linked" ? "연계과정 자격 확인" : goal === "early" ? "조기졸업 자격 확인" : "개설 시간표 연결 전"}</strong><p>{goal === "regular" ? "현재 후보는 졸업요건 기준입니다. 분반과 강의시간은 아직 공강 계산에 반영되지 않았습니다." : "선택한 목표의 별도 신청 자격과 행정 일정은 학과·학사과 확인이 필요합니다."}</p></div></article>
        </aside>
      </div>
    </section>
  );
}
