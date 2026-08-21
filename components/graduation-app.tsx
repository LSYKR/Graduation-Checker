"use client";

import { useEffect, useState } from "react";
import OnboardingComplete from "@/components/onboarding-complete";
import OnboardingView from "@/components/onboarding-view";
import DashboardApp from "@/components/dashboard-app";
import {
  AUDIT_ENGINE_VERSION,
  LEGACY_ONBOARDING_STORAGE_KEYS,
  ONBOARDING_STORAGE_KEY,
  isGraduationGoal,
  isGraduationInterest,
  isSupportedAdmissionYear,
  type OnboardingProfile,
} from "@/lib/onboarding";
import { getKmouProgramOffering } from "@/lib/kmou-program-catalog";
import type { DetailedAudit } from "@/lib/types";

function auditFromProfile(profile: OnboardingProfile): DetailedAudit | null {
  const snapshot = profile.transcript.provisionalAudit;
  if (!snapshot) return null;
  return {
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
}

function readStoredProfile(): OnboardingProfile | null {
  for (const storageKey of [ONBOARDING_STORAGE_KEY, ...LEGACY_ONBOARDING_STORAGE_KEYS]) {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) continue;
    try {
      const parsed = JSON.parse(stored) as Record<string, unknown>;
      const migrated = parsed.schemaVersion === 8;
      const profile = (migrated
        ? { ...parsed, schemaVersion: 9, graduationGoal: "regular", primaryInterest: "graduation-audit" }
        : parsed) as unknown as OnboardingProfile;
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
        !validTranscript ||
        !validProvisionalAudit
      ) continue;
      if (migrated || storageKey !== ONBOARDING_STORAGE_KEY) {
        window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(profile));
        for (const legacyKey of LEGACY_ONBOARDING_STORAGE_KEYS) window.localStorage.removeItem(legacyKey);
      }
      return profile;
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
    const initialView = ["course-recommendations", "schedule-optimization"].includes(profile.primaryInterest) ? "planner" : "dashboard";
    return <DashboardApp initialAudit={initialAudit} initialView={initialView} graduationGoal={profile.graduationGoal} onEditProfile={() => { setDashboardOpen(false); setEditing(true); }} />;
  }
  return <OnboardingComplete profile={profile} onEdit={() => setEditing(true)} onReset={reset} onOpenDashboard={() => setDashboardOpen(true)} />;
}
