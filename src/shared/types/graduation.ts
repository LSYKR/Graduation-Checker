export type CategoryKey = "generalRequired" | "generalElective" | "majorFoundation" | "majorRequired" | "majorElective" | "freeElective";
export type MajorCourseCategory = Extract<CategoryKey, "majorFoundation" | "majorRequired" | "majorElective">;
export type StudentType = "freshman" | "transfer";
export interface StudentProfile { universityId: string; admissionYear: number; transferEntryYear?: number; departmentId: string; department: string; studentType: StudentType; studentTypeLabel: string; }
export interface RuleKey { universityId: string; admissionYear: number; departmentId: string; }
export interface DocumentTargetKey extends RuleKey { transferEntryYear?: number; studentType: StudentType; }
export type EvaluationStatus = "evaluated" | "not-evaluable";
export interface CategoryProgress { key: CategoryKey; label: string; shortLabel: string; earned: number; reportedEarned?: number; pendingEarned?: number; required: number; color: string; evaluationStatus: EvaluationStatus; note?: string; }
export interface ResidualCreditSource { key: Exclude<CategoryKey, "freeElective">; label: string; earned: number; required: number; surplusCredits: number; }
export interface ResidualCreditAudit { policy: "residual-after-general-and-major"; status: EvaluationStatus; rawFreeElectiveCredits: number; verifiedSurplusCredits: number; transferredSurplusCredits: number; appliedSurplusCredits: number; effectiveFreeElectiveCredits: number; requiredFreeElectiveCredits: number; remainingFreeElectiveCredits: number; excessFreeElectiveCredits: number; minimumAllocatedCredits: number; reconciledKnownCredits: number; sources: ResidualCreditSource[]; note: string; }
export interface TranscriptClassificationIssue { rowNumber: number; code: string; name: string; rawCategory: string; credits: number; }
export interface TranscriptClassificationAudit { status: "verified" | "needs-review"; unclassifiedCredits: number; issues: TranscriptClassificationIssue[]; note: string; }
export interface CreditRequirement { key: CategoryKey; label: string; shortLabel: string; required: number; color: string; }
export interface MissingCourse { code: string; name: string; credits: number; category: string; priority: "필수" | "권장"; alternative?: string; note?: string; recommendedYear?: number; recommendedSemester?: 1 | 2; }
export interface CourseOverride { courseCode: string; category: CategoryKey; reason: string; authority?: "curriculum-requirement" | "approved-substitution"; }
export interface CourseSubstitution { requiredCode: string; substituteCodes: string[]; requiresApproval: boolean; note: string; }
export interface CertificationRule { id: string; label: string; description: string; required: boolean; }
export type OfficialSourceRole = "cohort-requirement" | "multi-year-requirement" | "university-policy" | "classification-reference";
export type OfficialSourceDocumentScope = "university-wide" | "college-wide" | "department" | "program-row";
export interface OfficialSourceEvidenceScope {
  departmentId: string;
  departmentName: string;
  locator: string;
  page?: number;
  sheet?: string;
  row?: number;
}
export interface OfficialSource {
  id: string;
  documentId?: string;
  title: string;
  organization: string;
  updatedAt: string;
  url: string;
  fileHash?: string;
  documentVersionId?: string;
  role?: OfficialSourceRole;
  documentYear?: number;
  appliesToAdmissionYears?: number[];
  appliesToDepartmentIds?: string[];
  documentScope?: OfficialSourceDocumentScope;
  evidenceScope?: OfficialSourceEvidenceScope;
}
export interface EvidenceChunk { id: string; sourceId: string; title: string; text: string; keywords: string[]; }
export type OperationalRuleStatus = "reviewed" | "draft" | "provisional" | "approved";
export interface RuleAssurance {
  overall: "provisional" | "approved";
  verifiedScopes: string[];
  provisionalScopes: string[];
  warning: string;
}
export interface MajorCourseCatalogEntry {
  code: string;
  name: string;
  category: MajorCourseCategory;
  credits: number;
  required: boolean;
  recommendedYear?: number;
  recommendedSemester?: 1 | 2;
}
export interface MajorCourseCatalog {
  id: string;
  version: string;
  status: "verified" | "review";
  sourceId: string;
  sourceIds?: string[];
  matchPolicy: "exact-course-code";
  role?: "cohort-catalog" | "current-classification";
  referenceYear?: number;
  sources?: OfficialSource[];
  activation?: {
    minimumTranscriptMatches: number;
    minimumMatchedCredits: number;
    minimumCategoryAgreementRatio: number;
  };
  requiredCourseSetStatus: "verified" | "review";
  requiredCourseSetNote?: string;
  categoryRequirementModes?: Partial<Record<MajorCourseCategory, "all-listed" | "minimum-from-pool">>;
  entries: MajorCourseCatalogEntry[];
}
export interface GraduationRuleSet { schemaVersion: "1.0"; version: string; status: OperationalRuleStatus; key: RuleKey; profileLabel: string; requiredTotal: number; credits: CreditRequirement[]; requiredCourses: MissingCourse[]; courseOverrides: CourseOverride[]; substitutions: CourseSubstitution[]; certifications: CertificationRule[]; policies: string[]; sources: OfficialSource[]; evidence: EvidenceChunk[]; reviewedAt: string; assurance?: RuleAssurance; majorCourseCatalog?: MajorCourseCatalog; }
export interface AuditSnapshot { studentCourseDeclarations?: Record<string, "student-confirmed-uncompleted">; guidanceIdentity?: { fileHash: string; studentType: StudentType; transferEntryYear: number | null }; courseGuidance?: CourseGuidance; profile: { admissionYear: number; transferEntryYear?: number; department: string; studentType: string; universityId?: string; departmentId?: string; studentTypeCode?: StudentType; }; overallStatus: EvaluationStatus; creditEvaluationStatus?: EvaluationStatus; earnedTotal: number; applicableEarnedTotal: number; requiredTotal: number; categories: CategoryProgress[]; residualCredits?: ResidualCreditAudit; generalEducationCreditShortage?: number; transcriptClassification?: TranscriptClassificationAudit; missingCourses: MissingCourse[]; certification: { language: boolean; activity: boolean; }; certificationEvidence?: "verified" | "unknown" | "demo"; ruleVersion?: string; ruleStatus?: OperationalRuleStatus; officialSources?: OfficialSource[]; courseMatch?: MajorCourseMatchAudit; }
export type GeneralEducationStatus = "satisfied" | "missing" | "needs-review" | "not-evaluable";
export type GeneralEducationRecognitionMode = "direct" | "double-listed" | "cross-institution";
export interface GeneralEducationRecognitionEvidence { sourceId: string; sheet: string; cellRange: string; note: string; }
export interface GeneralEducationMatchedCourse {
  code: string;
  name: string;
  credits: number;
  recognitionMode: GeneralEducationRecognitionMode;
  transferCredit: boolean;
  transcriptCategory: string;
  categoryDifference: boolean;
  evidence?: GeneralEducationRecognitionEvidence;
}
export interface GeneralEducationMappingConflict {
  code: string;
  name: string;
  credits: number;
  areaIds: string[];
  reason: "multiple-areas" | "unknown-area" | "credit-mismatch";
  expectedCredits?: number;
}
export interface GeneralEducationAreaProgress { id: string; label: string; parentArea: string; creditCategory?: Extract<CategoryKey, "generalRequired" | "generalElective">; earned: number; required: number; status: GeneralEducationStatus; matchedCourses: GeneralEducationMatchedCourse[]; }
export interface GeneralEducationCombinedProgress { id: string; label: string; areaIds: string[]; earned: number; required: number; status: GeneralEducationStatus; matchedCourses: GeneralEducationMatchedCourse[]; }
export interface GeneralEducationAudit { areas: GeneralEducationAreaProgress[]; combinedRequirements: GeneralEducationCombinedProgress[]; unmappedGeneralElectives: GeneralEducationMatchedCourse[]; mappingConflicts: GeneralEducationMappingConflict[]; conclusive: boolean; }
export interface TranscriptCourse { rowNumber: number; year: string; semester: string; code: string; name: string; rawCategory: string; category: CategoryKey; categoryRecognition?: "recognized" | "unrecognized"; credits: number; grade: string; professor: string; englishName: string; passed: boolean; transferCredit: boolean; reclassified: boolean; categoryAdjustment?: { originalCategory: CategoryKey; reason: string; authority: "curriculum-requirement" | "approved-substitution" }; majorCourseMatchStatus?: "matched" | "institution-recognized" | "unmatched" | "not-evaluable" | "not-applicable"; catalogCategory?: MajorCourseCategory; generalEducationAreaIds?: string[]; generalEducationMatchStatus?: "matched" | "unmapped" | "not-applicable"; }
export interface ParseResult { sheetName: string; courses: TranscriptCourse[]; warnings: string[]; recognizedRows: number; excludedRows: number; }
export interface MajorCourseMatchItem { code: string; name: string; credits: number; transcriptCategory: CategoryKey; recognizedCategory?: MajorCourseCategory; catalogCategory?: MajorCourseCategory; transferCredit?: boolean; recognitionReason?: "catalog" | "individual-transcript" | "transfer-recognition" | "curriculum-transition"; }
export interface MajorProgramEvidence {
  level: "strong" | "partial" | "insufficient";
  matchedCourses: number;
  matchedCredits: number;
  transcriptMajorCourses: number;
  matchRatio: number;
  method?: "exact-course-code" | "course-name-signature" | "none";
  matchedCourseNames?: string[];
  distinctSignals?: number;
  confidenceScore?: number;
  // Diagnostic uniqueness is limited to bundled same-cohort catalogs; it never activates a verdict.
  scopedCodeDiagnostics?: {
    sourceScope: string;
    uniqueCodes: string[];
    sharedCodes: string[];
    candidates: Array<{ code: string; departmentIds: string[] }>;
    jointCandidateDepartmentIds: string[];
  };
}
export interface PendingCourseRecognition {
  requiredCode: string;
  requiredName: string;
  substituteCode: string;
  substituteName: string;
  credits: number;
  note: string;
}
export type ReviewCauseKind = "major-evidence-insufficient" | "major-profile-mismatch" | "curriculum-outside-verified-scope" | "unmatched-course-code" | "requirement-designation-missing" | "source-row-unavailable" | "credit-category-conflict" | "substitution-approval-missing" | "transfer-recognition-unresolved";
export interface ReviewCause {
  kind: ReviewCauseKind;
  reason: string;
  missingEvidence: string;
  courseCodes: string[];
  sourceScope: string;
  sourceId?: string;
  sourceUrl?: string;
  locator?: string;
}
export interface RequiredCourseAssessment {
  code: string;
  name: string;
  credits: number;
  category: MajorCourseCategory;
  classification: "official-row" | "catalog-only" | "conflict" | "unverified";
  status: "completed" | "confirmed-missing" | "pending-substitution" | "needs-review";
  reason: string;
  reviewCause?: ReviewCause;
  sourceUrl?: string;
  sourceScope?: string;
  sourceId?: string;
  sourceHash?: string;
  locator?: string;
  substituteCode?: string;
  requirementDesignation?: "confirmed" | "needs-review";
  recommendedYear?: number;
  recommendedSemester?: 1 | 2;
}
export interface ProgramProfileMismatch {
  detected: boolean;
  inferredProgramId?: string;
  inferredProgramLabel?: string;
  matchedCourses: number;
  matchedCredits: number;
  message: string;
}
export interface MajorCourseMatchAudit {
  reviewCauses?: ReviewCause[];
  verifiedScope?: string;
  status: "verified" | "not-evaluable";
  selectedProgramId: string;
  sourceId?: string;
  sourceIds?: string[];
  classificationSources?: OfficialSource[];
  classificationReferenceYear?: number;
  classificationSource?: "cohort-catalog" | "current-classification" | "transcript-program-signature";
  currentClassificationApplied?: boolean;
  requiredCourseSetStatus?: "verified" | "review";
  requiredCourseSetNote?: string;
  matchedMajorCourses: MajorCourseMatchItem[];
  institutionallyRecognizedMajorCourses: MajorCourseMatchItem[];
  unmatchedTranscriptMajorCourses: MajorCourseMatchItem[];
  matchedCredits: number;
  institutionallyRecognizedCredits: number;
  unmatchedCredits: number;
  programEvidence: MajorProgramEvidence;
  transitionReviewCourses: MissingCourse[];
  requirementPolicyReviewCourses?: MissingCourse[];
  transferRecognitionReviewCourses?: MissingCourse[];
  requiredCourseAssessments: RequiredCourseAssessment[];
  pendingCourseRecognitions: PendingCourseRecognition[];
  requiredCreditShortage: number;
  potentialRequiredCredits: number;
  profileMismatch?: ProgramProfileMismatch;
  note: string;
}
export interface DetailedAudit extends AuditSnapshot { courses: TranscriptCourse[]; reclassifiedCount: number; passedCourseCount: number; forecastCredits: number; generalEducation?: GeneralEducationAudit; }
export type StoredAuditSnapshot = Omit<DetailedAudit, "profile" | "courses">;
export type IngestionStatus = "uploaded" | "extracting" | "review_pending" | "approved" | "rejected" | "gpt_pending" | "failed";
export interface IngestionDocument { id: string; fileName: string; sourceUrl: string | null; universityId: string; admissionYear: number; transferEntryYear: number | null; departmentId: string; studentType: StudentType; status: IngestionStatus; sha256: string; contentType: string; storageKey: string; candidateVersion: string | null; candidateRule: GraduationRuleSet | null; validationErrors: string[]; createdAt: string; updatedAt: string; }
export interface AssistantAuditContext { profile: StudentProfile; audit: DetailedAudit; ruleVersion: string; }

export interface CourseGuidanceItem { recognitionKind?: "transfer-recognition-unresolved" | "substitution-approval-missing"; requirementDesignation?: "confirmed" | "needs-review"; planningBasis?: "student-confirmed-uncompleted"; code: string; name: string; credits: number; category: string; reason: string; sourceId?: string; locator?: string; recommendedYear?: number; recommendedSemester?: 1 | 2; }
export interface CourseGuidancePool { id: string; label: string; minimumCredits: number; review: boolean; condition: string; candidates: CourseGuidanceItem[]; }
export interface CourseGuidance { completedCodes?: string[]; key: RuleKey; ruleVersion: string; mode: "personal" | "curriculum"; completed: CourseGuidanceItem[]; remaining: CourseGuidanceItem[]; recognitionReview: CourseGuidanceItem[]; pools: CourseGuidancePool[]; dataGaps: string[]; offeringStatus: "unknown"; }
