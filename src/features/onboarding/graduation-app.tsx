"use client";

import CourseGuidanceView from "@/features/graduation-audit/course-guidance-view";
import { applyStudentUncompleted, enrichRecognitionGuidance, makeCourseGuidance } from "@/domain/graduation/course-guidance";
import { bundledRuleRegistry } from "@/domain/curriculum/rule-registry";
import { useEffect, useState } from "react";
import OnboardingComplete from "@/features/onboarding/onboarding-complete";
import OnboardingView from "@/features/onboarding/onboarding-view";
import DashboardApp from "@/features/graduation-audit/dashboard-app";
import {
  AUDIT_ENGINE_VERSION,
  LEGACY_ONBOARDING_STORAGE_KEYS,
  ONBOARDING_STORAGE_KEY,
  isGraduationGoal,
  isGraduationInterest,
  isSupportedAdmissionYear,
  type OnboardingProfile,
} from "@/features/onboarding/model";
import { getKmouProgramOffering } from "@/domain/curriculum/kmou-program-catalog";
import type { DetailedAudit } from "@/shared/types/graduation";

export function auditFromProfile(profile: OnboardingProfile): DetailedAudit | null {
  const snapshot = profile.transcript.provisionalAudit;
  const rule = bundledRuleRegistry.find({ universityId: profile.universityId, admissionYear: profile.curriculumYear, departmentId: profile.departmentId });
  const g = snapshot?.courseGuidance;
  const identity = snapshot?.guidanceIdentity;
  if (!identity || identity.fileHash !== profile.transcript.fileHash || identity.studentType !== profile.studentType || identity.transferEntryYear !== profile.transferEntryYear) return null;
  if (!snapshot || !rule || profile.transcript.auditEngineVersion !== AUDIT_ENGINE_VERSION || snapshot.ruleVersion !== rule.version || !g || g.mode !== "personal" || g.key.universityId !== rule.key.universityId || g.key.departmentId !== rule.key.departmentId || g.key.admissionYear !== rule.key.admissionYear || g.ruleVersion !== rule.version) return null;
  const restored: DetailedAudit = {
    ...snapshot,
    profile: {
      admissionYear: profile.curriculumYear,
      transferEntryYear: profile.transferEntryYear ?? undefined,
      department: profile.departmentName,
      studentType: profile.studentType === "transfer" ? "편입생" : "신입생",
      universityId: profile.universityId,
      departmentId: profile.departmentId,
      studentTypeCode: profile.studentType,
    },
    courses: [],
  };
  return applyStudentUncompleted(enrichRecognitionGuidance(restored), Object.keys(snapshot.studentCourseDeclarations ?? {}).filter(code => snapshot.studentCourseDeclarations?.[code] === "student-confirmed-uncompleted"));
}

function readStoredProfile(): OnboardingProfile | null {
  for (const storageKey of [ONBOARDING_STORAGE_KEY, ...LEGACY_ONBOARDING_STORAGE_KEYS]) {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) continue;
    try {
      const parsed = JSON.parse(stored) as Record<string, unknown>;
      const migrated = parsed.schemaVersion === 8;
      const legacyPlanningInterest = parsed.primaryInterest === "course-recommendations" || parsed.primaryInterest === "schedule-optimization";
      const baseProfile = (migrated
        ? { ...parsed, schemaVersion: 9, graduationGoal: "regular", primaryInterest: "graduation-audit" }
        : parsed) as unknown as OnboardingProfile;
      const profile = legacyPlanningInterest
        ? { ...baseProfile, primaryInterest: "remaining-requirements" as const }
        : baseProfile;
      const validStudentType = profile.studentType === "freshman" || profile.studentType === "transfer";
      const validTranscript = Boolean(
        profile.transcript?.fileName &&
        profile.transcript?.fileHash &&
        profile.transcript?.recognizedRows > 0 &&
        profile.transcript?.transferRecognition &&
        profile.transcript?.auditEngineVersion === AUDIT_ENGINE_VERSION,
      );
      const offering = getKmouProgramOffering(profile.admissionYear, profile.departmentId);
      const generalEducationAreas = profile.transcript?.provisionalAudit?.generalEducation?.areas ?? [];
      const personalityScopeMatches = profile.admissionYear <= 2024
        ? generalEducationAreas.some((area) => area.id === "personality-required")
        : !generalEducationAreas.some((area) => area.id.startsWith("personality-"));
      const residualCredits = profile.transcript?.provisionalAudit?.residualCredits;
      const validProvisionalAudit = Boolean(
        profile.transcript?.provisionalAudit?.ruleStatus === "provisional" &&
        profile.transcript.provisionalAudit.overallStatus &&
        profile.transcript.provisionalAudit.courseMatch &&
        profile.transcript.provisionalAudit.requiredTotal === offering?.creditSummary.total &&
        profile.transcript.provisionalAudit.categories?.length === 6 &&
        generalEducationAreas.length > 0 &&
        personalityScopeMatches &&
        residualCredits?.policy === "residual-after-general-and-major" &&
        Number.isFinite(residualCredits.transferredSurplusCredits) &&
        Number.isFinite(residualCredits.reconciledKnownCredits) &&
        profile.transcript.provisionalAudit.transcriptClassification,
      );
      if (
        profile.schemaVersion !== 9 ||
        profile.universityId !== "kmou" ||
        profile.collegeId !== "ocean-science-technology-convergence" ||
        !offering ||
        profile.departmentName !== offering.displayName ||
        profile.curriculumCollegeName !== offering.curriculumCollegeName ||
        !isSupportedAdmissionYear(profile.admissionYear) ||
        !isSupportedAdmissionYear(profile.curriculumYear) ||
        profile.curriculumYear !== profile.admissionYear ||
        !isGraduationGoal(profile.graduationGoal) ||
        !isGraduationInterest(profile.primaryInterest) ||
        (profile.studentType === "transfer" && profile.graduationGoal === "early-graduation") ||
        !validStudentType ||
        !profile.transcript
      ) continue;
      if (migrated || legacyPlanningInterest || storageKey !== ONBOARDING_STORAGE_KEY) {
        window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(profile));
        for (const legacyKey of LEGACY_ONBOARDING_STORAGE_KEYS) window.localStorage.removeItem(legacyKey);
      }
      return validTranscript && validProvisionalAudit ? profile : { ...profile, transcript: { ...profile.transcript, provisionalAudit: undefined } };
    } catch {
      continue;
    }
  }
  return null;
}

export default function GraduationApp() {
  const [hydrated, setHydrated] = useState(false);
  const [profile, setProfile] = useState<OnboardingProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setProfile(readStoredProfile());
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function complete(nextProfile: OnboardingProfile) {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(nextProfile));
    setProfile(nextProfile);
    setEditing(false);
    setDashboardOpen(false);
  }

  function reset() {
    window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    setProfile(null);
    setEditing(false);
    setDashboardOpen(false);
  }

  if (!hydrated) return <main className="onboarding-loading" aria-label="온보딩 불러오는 중" />;
  if (!profile || editing) return <OnboardingView onComplete={complete} />;
  const initialAudit = auditFromProfile(profile);
  if (dashboardOpen && initialAudit) {
    return <DashboardApp initialAudit={initialAudit} onAuditChange={next => { const updated = { ...profile, transcript: { ...profile.transcript, provisionalAudit: { ...profile.transcript.provisionalAudit!, studentCourseDeclarations: next.studentCourseDeclarations } } }; window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(updated)); setProfile(updated); }} onEditProfile={() => { setDashboardOpen(false); setEditing(true); }} />;
  }
  const rule = bundledRuleRegistry.find({ universityId: profile.universityId, admissionYear: profile.curriculumYear, departmentId: profile.departmentId });
  if (dashboardOpen && rule) return <main className="onboarding-complete-shell"><div className="complete-card guidance-profile-shell"><button className="onboarding-secondary" onClick={() => setEditing(true)}>성적표 업로드 · 프로필 변경</button><p>개인 진단에는 성적표 업로드가 필요합니다. 저장된 원본 행이 없어 오래된 결과는 재계산할 수 없습니다.</p><CourseGuidanceView guidance={makeCourseGuidance(rule)} /></div></main>;
  return <OnboardingComplete guidance={rule ? <CourseGuidanceView guidance={initialAudit?.courseGuidance ?? makeCourseGuidance(rule)} /> : undefined} profile={profile} onEdit={() => setEditing(true)} onReset={reset} onOpenDashboard={() => setDashboardOpen(true)} />;
}
