"use client";

import { useRef } from "react";
import type { SchedulePlan } from "@/domain/courses/schedule-planner";

const weekdays = ["월", "화", "수", "목", "금", "토", "일"];

export default function Timetable({ plan }: { plan: SchedulePlan }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  return <div className="timetable" aria-label={`${plan.term} 추천 시간표`}>
    <button type="button" className="timetable-expand" onClick={() => dialogRef.current?.showModal()}>시간표 크게 보기</button>
    <TimetableContent plan={plan} />
    <dialog ref={dialogRef} className="timetable-dialog" aria-label={`${plan.term} 시간표 크게 보기`}>
      <div className="timetable-dialog-toolbar">
        <strong>{plan.term} 추천 시간표</strong>
        <button type="button" onClick={() => dialogRef.current?.close()} aria-label="시간표 닫기">닫기</button>
      </div>
      <div className="timetable timetable-expanded"><TimetableContent plan={plan} /></div>
    </dialog>
  </div>;
}

function TimetableContent({ plan }: { plan: SchedulePlan }) {
  const scheduled = plan.sections.flatMap(section => section.meetings.map((meeting, index) => ({ section, meeting, key: `${section.id}-${index}` })));
  const days = weekdays.filter(day => weekdays.indexOf(day) < 5 || scheduled.some(x => x.meeting.day === day));
  const periods = scheduled.flatMap(x => Array.from({ length: x.meeting.endPeriod - x.meeting.startPeriod + 1 }, (_, i) => x.meeting.startPeriod + i));
  const first = Math.min(...periods);
  const last = Math.max(...periods);
  const rows = periods.length ? Array.from({ length: last - first + 1 }, (_, i) => first + i) : [];
  const unscheduled = plan.sections.filter(x => !x.hasScheduledTime || !x.meetings.length);
  const entriesAt = (day: string, period: number) => scheduled.filter(x => x.meeting.day === day && x.meeting.startPeriod <= period && period <= x.meeting.endPeriod);
  const signature = (day: string, period: number) => entriesAt(day, period).map(x => x.key).sort().join("|");
  return <>
    <p className="timetable-summary">{plan.term} · {plan.sections.length}과목 · {plan.sections.reduce((n, x) => n + x.credits, 0)}학점</p>
    {rows.length > 0 && <div className="timetable-scroll"><table>
      <caption>{plan.term} 개설 분반 · 요일별 교시</caption>
      <thead><tr><th scope="col">교시</th>{days.map(day => <th scope="col" key={day}>{day}요일</th>)}</tr></thead>
      <tbody>{rows.map(period => <tr key={period}>
        <th scope="row">{period}교시</th>
        {days.map(day => {
          const entries = entriesAt(day, period);
          const current = signature(day, period);
          if (period > first && current === signature(day, period - 1) && entries.length) return null;
          let span = 1;
          if (entries.length) while (period + span <= last && signature(day, period + span) === current) span++;
          return <td key={day} rowSpan={span} className={entries.length ? "timetable-occupied" : undefined}>{entries.map(({ section, meeting, key }) => <span className="timetable-entry" key={key}>
            <strong>{section.title}</strong><small>{section.section}분반 · {meeting.room || "강의실 미확인"}</small>
          </span>)}</td>;
        })}
      </tr>)}</tbody>
    </table></div>}
    <details className="timetable-course-details"><summary>과목별 상세 정보</summary><ul>{plan.sections.map(section => <li key={section.id}>
      <strong>{section.title} {section.section}분반</strong> · {section.courseCode} · {section.credits}학점 · {section.remote ? "원격수업 표시" : "원격수업 표시 없음"}
      {section.meetings.map((meeting, index) => <span key={index}> · {meeting.day} {meeting.startPeriod}–{meeting.endPeriod}교시, {meeting.room || "강의실 미확인"}, {meeting.weeks.map(w => `${w.start}~${w.end}주`).join(", ") || "강의주차 미확인"}</span>)}
    </li>)}</ul></details>
    {unscheduled.length > 0 && <div className="timetable-unscheduled"><strong>시간 미지정 강좌</strong><ul>{unscheduled.map(section => <li key={section.id}>{section.title} {section.section}분반 ({section.courseCode}) · {section.cyber ? "사이버 강좌 · 정해진 수업 시간 없음" : "수업 시간 미확인 · 시간 충돌 확인 필요"}</li>)}</ul></div>}
    <details><summary>개설 자료 출처와 확인 사항</summary>
      <p>조회 {plan.retrievedAt ?? "미확인"} ({plan.retrievedAtBasis ?? "근거 미확인"}) · 가져오기 {plan.updatedAt ?? "미확인"} · SHA-256 {plan.sourceHash ?? "미확인"}</p>
      <ul>{plan.notes.map((note, index) => <li key={index}>{note}</li>)}</ul>
    </details>
  </>;
}
