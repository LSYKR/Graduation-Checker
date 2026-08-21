"use client";

import { ArrowRight, CheckCircle2, CircleAlert, FileSpreadsheet, GraduationCap, Pencil, RotateCcw, ShieldCheck } from "lucide-react";
import { graduationGoalLabel, graduationInterestLabel, studentTypeLabel, type OnboardingProfile } from "@/lib/onboarding";
import { evidenceLabel, getRuleAvailability, type EvidenceState } from "@/lib/rule-availability";
import { EXPANSION_BATCH_LABELS, getKmouProgramOffering } from "@/lib/kmou-program-catalog";

interface OnboardingCompleteProps {
  profile: OnboardingProfile;
  onEdit: () => void;
  onReset: () => void;
  onOpenDashboard: () => void;
}

function EvidenceRow({ label, state }: { label: string; state: EvidenceState }) {
  return (
    <li className={`evidence-${state}`}>
      <span>{state === "verified" ? <CheckCircle2 size={15} /> : <CircleAlert size={15} />}{label}</span>
      <strong>{evidenceLabel(state)}</strong>
    </li>
  );
}

export default function OnboardingComplete({ profile, onEdit, onReset, onOpenDashboard }: OnboardingCompleteProps) {
  const recognition = profile.transcript.transferRecognition;
  const offering = getKmouProgramOffering(profile.curriculumYear, profile.departmentId);
  const availability = getRuleAvailability(profile.curriculumYear, profile.departmentId, profile.studentType, recognition);
  const majorCreditAudit = profile.transcript.provisionalAudit?.courseMatch?.status === "verified";
  const detailedMajorCourseAudit = majorCreditAudit
    && profile.transcript.provisionalAudit?.courseMatch?.requiredCourseSetStatus === "verified";
  const currentClassificationApplied = profile.transcript.provisionalAudit?.courseMatch?.currentClassificationApplied === true;
  const classificationReferenceYear = profile.transcript.provisionalAudit?.courseMatch?.classificationReferenceYear;
  const signatureCreditAudit = profile.transcript.provisionalAudit?.courseMatch?.classificationSource === "transcript-program-signature";
  const pendingRecognitionCount = profile.transcript.provisionalAudit?.courseMatch?.pendingCourseRecognitions.length ?? 0;
  const profileMismatch = profile.transcript.provisionalAudit?.courseMatch?.profileMismatch?.detected
    ? profile.transcript.provisionalAudit.courseMatch.profileMismatch
    : undefined;
  const interestButtonLabel = profile.primaryInterest === "course-recommendations" || profile.primaryInterest === "schedule-optimization"
    ? "수강 설계 열기"
    : profile.primaryInterest === "remaining-requirements"
      ? "남은 요건 보기"
      : "졸업 진단 보기";

  return (
    <main className="onboarding-complete-shell">
      <section className="complete-card">
        <div className="complete-icon"><CheckCircle2 size={34} /></div>
        <span className="onboarding-eyebrow">ONBOARDING COMPLETE</span>
        <h1>사용자 프로필 설정이 완료되었습니다.</h1>
        <p>졸업요건은 입학 구분과 무관하게 적용 교육과정·전공의 정확한 공통 규칙을 사용합니다. 편입생은 전적대 인정 교과목을 같은 규칙에 합산하고 편입 당시의 이수제약만 별도 확인합니다.</p>

        <div className="complete-profile-grid">
          <div><span><GraduationCap size={16} /> 적용 프로필</span><strong>{profile.universityName}<br />{profile.curriculumYear}학번/적용과정 · {profile.departmentName} · {studentTypeLabel(profile.studentType)}{profile.curriculumCollegeName !== profile.collegeName && <><br />당시 {profile.curriculumCollegeName} 편제</>}{profile.studentType === "transfer" && <><br />{profile.transferEntryYear ? `${profile.transferEntryYear}년 편입 인정 처리` : "편입 인정 처리 연도 확인 필요"}</>}</strong></div>
          <div><span><FileSpreadsheet size={16} /> 확인한 성적표</span><strong>{profile.transcript.fileName}<br />{profile.transcript.recognizedRows}개 교과목 · {profile.transcript.latestAcademicTerm}{profile.studentType === "transfer" && <><br />인정 {recognition.recognizedRows}개 · {recognition.recognizedCredits}학점</>}</strong></div>
          <div><span><ShieldCheck size={16} /> 이용 목적</span><strong>{graduationGoalLabel(profile.graduationGoal)} · {graduationInterestLabel(profile.primaryInterest)}</strong></div>
        </div>

        <div className="complete-evidence-box">
          <div className="complete-evidence-heading"><ShieldCheck size={18} /><div><strong>{profile.curriculumYear} 적용 교육과정 공식자료 준비 현황</strong><p>{availability.message}</p></div></div>
          <ul>
            <EvidenceRow label={`${profile.curriculumYear} 공통 졸업 편제학점`} state={availability.creditSummary} />
            <EvidenceRow label="상세 전공 교육과정" state={availability.detailedCurriculum} />
            <EvidenceRow label="교양교육 이수체계 원본" state={availability.generalEducation} />
            <EvidenceRow label="사회·경제/역사·문화/해양·윤리 과목코드" state={availability.generalEducationAreaMapping} />
            <EvidenceRow label="전공별 이중설강·교차강의 특수 인정" state={availability.generalEducationSpecialRecognition} />
            <EvidenceRow label="졸업인증 시행기준" state={availability.graduationCertification} />
            {profile.studentType === "transfer" && <EvidenceRow label="편입 인정학점·이수제약 오버레이" state={availability.transferOverlay} />}
            {profile.studentType === "transfer" && <EvidenceRow label="성적표 개인별 편입 인정학점 집계" state={availability.individualTransferRecognition} />}
            <EvidenceRow label="필수과목 전환·대체 인정" state={availability.requiredCourseTransitions} />
          </ul>
        </div>

        <div className={`complete-safety-box ${availability.operational === "provisional" ? "provisional" : ""}`}>
          <ShieldCheck size={19} />
          {availability.operational === "provisional"
            ? profileMismatch
              ? <div><strong>성적표와 선택 전공이 일치하지 않을 수 있습니다</strong><p>{profileMismatch.message} 메인 화면에서 전체 퍼센트와 전공 충족 판정을 중단했습니다.</p></div>
              : majorCreditAudit
                ? currentClassificationApplied
                  ? detailedMajorCourseAudit
                    ? <div><strong>{profile.curriculumYear} 적용 원본과 분류 보조자료를 분리했습니다</strong><p>졸업요건은 {profile.curriculumYear} 원본으로 적용하고, {classificationReferenceYear ?? "현행"} 자료는 성적표 이수구분 확인에만 사용했습니다.{pendingRecognitionCount ? ` 대체 인정 ${pendingRecognitionCount}건은 별도 확인으로 남겼습니다.` : " 확인된 대체과목은 한 번만 반영합니다."}</p></div>
                    : <div><strong>전공 영역별 학점 교차검증이 끝났습니다</strong><p>{classificationReferenceYear ?? "현행"} 보조자료는 전공 소속과 이수구분 확인에만 사용하며, {profile.curriculumYear}학번의 확정 필수과목 목록으로 사용하지 않습니다.</p></div>
                  : signatureCreditAudit
                    ? <div><strong>선택 전공과 성적표의 일치 지문을 확인했습니다</strong><p>전공 고유 과목명이 충분히 일치해 종합정보시스템의 전공기초·전공필수·전공선택 학점을 반영했습니다. 개별 필수과목 목록은 추가 검수 중입니다.</p></div>
                    : <div><strong>공식 전공 과목코드 진단을 열 수 있습니다</strong><p>전공과목을 공식 교과목번호로 대조했습니다. 폐지·변경·대체과목과 졸업인증은 학교의 최종 졸업사정 전 확인이 필요합니다.</p></div>
                : <div><strong>검수 상태 화면을 열 수 있습니다</strong><p>총 취득학점은 참고로 보여주지만, 상세 전공 과목표가 없는 상태에서는 전공학점과 전체 졸업 준비도 퍼센트를 판정하지 않습니다.{offering ? ` ${EXPANSION_BATCH_LABELS[offering.batch]} 대상입니다.` : ""}</p></div>
            : <div><strong>전체 졸업 판정은 아직 차단되어 있습니다</strong><p>이 학번의 전체 공통 규칙이 승인되지 않아 메인 진단을 열 수 없습니다.</p></div>}
        </div>

        <div className="complete-actions">
          <button className="onboarding-secondary" onClick={onReset}><RotateCcw size={16} /> 처음부터 다시</button>
          <button className="onboarding-secondary" onClick={onEdit}><Pencil size={16} /> 프로필 수정</button>
          {availability.operational === "provisional" && profile.transcript.provisionalAudit
            ? <button className="onboarding-primary" onClick={onOpenDashboard}>{profileMismatch ? "전공 불일치 확인" : interestButtonLabel} <ArrowRight size={16} /></button>
            : <button className="onboarding-primary" onClick={onEdit}><Pencil size={16} /> 성적표 다시 확인</button>}
        </div>
      </section>
    </main>
  );
}
