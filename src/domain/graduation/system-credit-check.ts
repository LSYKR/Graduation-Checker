import { isFutureTranscriptTerm } from "./assistant-engine";
import type { DetailedAudit } from "../../shared/types/graduation";

export type SystemCreditCheck = "passed" | "needs-credits" | "needs-review";

/** Student-facing credit check; the full university graduation audit remains separate. */
export function getSystemCreditCheck(audit: DetailedAudit): SystemCreditCheck {
  const unresolvedTranscriptCodes = new Set(audit.courses
    .filter(course => course.passed && (course.majorCourseMatchStatus === "not-evaluable" || course.categoryRecognition === "unrecognized"))
    .map(course => course.code.toUpperCase()).filter(Boolean));
  const personalConflict = !audit.courseMatch
    || audit.courseMatch.programEvidence.level !== "strong"
    || audit.courseMatch.profileMismatch?.detected
    || audit.transcriptClassification?.status === "needs-review"
    || audit.courseMatch.unmatchedCredits > 0
    || !!audit.courseMatch.unmatchedTranscriptMajorCourses.length
    || !!audit.courseMatch.pendingCourseRecognitions.length
    || !!audit.courseMatch.transferRecognitionReviewCourses?.length
    || !!audit.courseMatch.reviewCauses?.some(cause => ["major-evidence-insufficient", "major-profile-mismatch", "unmatched-course-code", "substitution-approval-missing", "transfer-recognition-unresolved"].includes(cause.kind)
      || cause.kind === "credit-category-conflict" && cause.courseCodes.some(code => unresolvedTranscriptCodes.has(code.toUpperCase())))
    || audit.courses.some(course => isFutureTranscriptTerm(course));
  const creditEvaluable = (audit.creditEvaluationStatus ?? audit.overallStatus) === "evaluated";
  const categoriesEvaluable = audit.categories.length > 0 && audit.categories.every(category => category.evaluationStatus === "evaluated")
    && audit.residualCredits?.status !== "not-evaluable";
  const generalEducationConclusive = !!audit.generalEducation?.conclusive
    && audit.generalEducation.mappingConflicts.length === 0
    && audit.generalEducation.areas.every(area => area.status !== "needs-review" && area.status !== "not-evaluable")
    && audit.generalEducation.combinedRequirements.every(item => item.status !== "needs-review" && item.status !== "not-evaluable");
  if (personalConflict || !creditEvaluable || !categoriesEvaluable || !generalEducationConclusive) return "needs-review";

  if (audit.applicableEarnedTotal < audit.requiredTotal || audit.forecastCredits > 0
    || audit.categories.some(category => category.earned < category.required)
    || audit.generalEducation!.areas.some(area => area.status === "missing" || area.earned < area.required)
    || audit.generalEducation!.combinedRequirements.some(item => item.status === "missing" || item.earned < item.required)
    || audit.missingCourses.some(course => course.priority === "필수")) return "needs-credits";

  return "passed";
}
