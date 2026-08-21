import type { TransferRecognitionSummary } from "./transcript-profile";
import type { StoredAuditSnapshot } from "./types";
import {
  getKmouProgramOffering,
  KMOU_PROGRAM_DEFINITIONS,
  type KmouProgramId,
} from "./kmou-program-catalog";

export const ONBOARDING_STORAGE_KEY = "kmou-grad-onboarding-v9";
export const LEGACY_ONBOARDING_STORAGE_KEYS = ["kmou-grad-onboarding-v8", "kmou-grad-onboarding-v7"] as const;
export const AUDIT_ENGINE_VERSION = "kmou-college-program-source-audit-0.27.0-alpha.1";

export const SUPPORTED_ADMISSION_YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020] as const;

export const SCHOOL_OPTIONS = [
  { id: "kmou", name: "한국해양대학교", supported: true },
  { id: "other-university", name: "다른 대학교 · 준비 중", supported: false },
] as const;

export const DEPARTMENT_OPTIONS = KMOU_PROGRAM_DEFINITIONS.map((program) => ({
  id: program.id,
  name: program.currentUnit,
  supported: true,
}));

export const STUDENT_TYPE_OPTIONS = [
  { id: "freshman", name: "신입학", supported: true },
  { id: "transfer", name: "편입학", supported: true },
  { id: "readmission", name: "재입학 · 준비 중", supported: false },
  { id: "international", name: "외국인 전형 · 준비 중", supported: false },
] as const;

export const GRADUATION_GOAL_OPTIONS = [
  { id: "regular", label: "정규 졸업", description: "현재 교육과정의 졸업요건 충족" },
  { id: "bachelors-masters", label: "학·석사 연계", description: "연계과정 자격과 졸업요건 함께 확인" },
  { id: "early-graduation", label: "조기졸업", description: "조기졸업 가능 여부와 추가 조건 확인" },
] as const;

export const GRADUATION_INTEREST_OPTIONS = [
  { id: "graduation-audit", label: "졸업 가능 여부", description: "현재 충족 여부부터 확인" },
  { id: "remaining-requirements", label: "남은 요건", description: "부족 학점과 과목을 우선 확인" },
  { id: "course-recommendations", label: "다음 학기 추천", description: "남은 요건 중심으로 수강 계획" },
  { id: "schedule-optimization", label: "공강 중심 설계", description: "개설 시간표와 공강 선호를 함께 반영" },
] as const;

export type SupportedStudentType = "freshman" | "transfer";
export type GraduationGoal = (typeof GRADUATION_GOAL_OPTIONS)[number]["id"];
export type GraduationInterest = (typeof GRADUATION_INTEREST_OPTIONS)[number]["id"];

export interface OnboardingTranscriptMetadata {
  fileName: string;
  fileSize: number;
  fileHash: string;
  sheetName: string;
  recognizedRows: number;
  latestAcademicTerm: string;
  transferRecognition: TransferRecognitionSummary;
  provisionalAudit?: StoredAuditSnapshot;
  auditEngineVersion: typeof AUDIT_ENGINE_VERSION;
  inspectedAt: string;
}

export interface OnboardingProfile {
  schemaVersion: 9;
  universityId: "kmou";
  universityName: "한국해양대학교";
  collegeId: "ocean-science-technology-convergence";
  collegeName: "해양과학기술융합대학";
  curriculumCollegeName: "해양과학기술대학" | "공과대학" | "해양과학기술융합대학";
  admissionYear: (typeof SUPPORTED_ADMISSION_YEARS)[number];
  curriculumYear: (typeof SUPPORTED_ADMISSION_YEARS)[number];
  transferEntryYear: number | null;
  departmentId: KmouProgramId;
  departmentName: string;
  currentDepartmentUnit: string;
  studentType: SupportedStudentType;
  graduationGoal: GraduationGoal;
  primaryInterest: GraduationInterest;
  transcript: OnboardingTranscriptMetadata;
  completedAt: string;
}

export function isSupportedAdmissionYear(value: number): value is OnboardingProfile["admissionYear"] {
  return SUPPORTED_ADMISSION_YEARS.includes(value as OnboardingProfile["admissionYear"]);
}

export function studentTypeLabel(type: SupportedStudentType): string {
  return type === "transfer" ? "편입학" : "신입학";
}

export function isGraduationGoal(value: string): value is GraduationGoal {
  return GRADUATION_GOAL_OPTIONS.some((option) => option.id === value);
}

export function isGraduationInterest(value: string): value is GraduationInterest {
  return GRADUATION_INTEREST_OPTIONS.some((option) => option.id === value);
}

export function graduationGoalLabel(goal: GraduationGoal): string {
  return GRADUATION_GOAL_OPTIONS.find((option) => option.id === goal)?.label ?? goal;
}

export function graduationInterestLabel(interest: GraduationInterest): string {
  return GRADUATION_INTEREST_OPTIONS.find((option) => option.id === interest)?.label ?? interest;
}

export function isSupportedDepartment(admissionYear: number, departmentId: string): departmentId is KmouProgramId {
  return Boolean(getKmouProgramOffering(admissionYear, departmentId));
}
