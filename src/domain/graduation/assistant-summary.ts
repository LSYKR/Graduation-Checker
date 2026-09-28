import { guidanceItemReason, conciseCourseReason, conciseGuidanceText, guidanceGapSummary } from "./guidance-presentation";
import { isFutureTranscriptTerm } from "./assistant-engine";
import type { DetailedAudit, RuleKey } from "../../shared/types/graduation";

export interface AssistantSummary {
  courseGuidance?: { remaining: { name: string; credits: number; reason: string }[]; pools: { label: string; condition: string; review: boolean; candidates: { name: string; reason: string }[] }[]; recognitionReview: { name: string; reason: string }[]; dataGaps: string[] };
  key: RuleKey;
  requiredTotal: number;
  earnedTotal: number;
  applicableEarnedTotal: number;
  forecastCredits: number;
  overallStatus: "evaluated" | "not-evaluable";
  creditEvaluationStatus?: "evaluated" | "not-evaluable";
  ruleStatus: "reviewed" | "draft" | "provisional" | "approved" | null;
  categories: { label: string; shortage: number; review: boolean; confirmed: number; reported: number; pending: number }[];
  generalEducation: { label: string; shortage: number; review: boolean }[];
  missingCourses: { name: string; credits: number; required: boolean }[];
  caveats: { requiredCourseSetReview: boolean; pendingRecognition: boolean; programEvidenceInsufficient: boolean; certificationUnverified: boolean; generalEducationInconclusive: boolean; futureHistoryUnverified: boolean };
}

export function makeAssistantSummary(audit: DetailedAudit, key: RuleKey): AssistantSummary {
  const summary: AssistantSummary = {
    ...(audit.courseGuidance ? { courseGuidance: {
      remaining: audit.courseGuidance.remaining.slice(0, 20).map(c => ({ name: safe(c.name).slice(0, 80), credits: c.credits, reason: conciseCourseReason(c.reason) })),
      pools: audit.courseGuidance.pools.slice(0, 6).map(p => ({ label: safe(p.label).slice(0, 80), condition: safe(p.condition).slice(0, 120), review: p.review, candidates: p.candidates.slice(0, 4).map(c => ({ name: safe(c.name).slice(0, 80), reason: conciseCourseReason(c.reason, 'candidate') })) })),
      recognitionReview: audit.courseGuidance.recognitionReview.slice(0, 6).map(c => ({ name: safe(c.name).slice(0, 80), reason: guidanceItemReason(c, 'review') })), dataGaps: audit.courseGuidance.dataGaps.length ? [guidanceGapSummary(audit.courseGuidance.dataGaps)] : [],
    } } : {}),
    key, requiredTotal: audit.requiredTotal, earnedTotal: audit.earnedTotal,
    applicableEarnedTotal: audit.applicableEarnedTotal, forecastCredits: audit.forecastCredits,
    overallStatus: audit.overallStatus, creditEvaluationStatus: audit.creditEvaluationStatus ?? audit.overallStatus, ruleStatus: audit.ruleStatus ?? null,
    categories: audit.categories.map(x => ({ label: x.label, shortage: Math.max(0, x.required - x.earned), review: x.evaluationStatus === "not-evaluable", confirmed: x.earned, reported: x.reportedEarned ?? x.earned, pending: x.pendingEarned ?? 0 })),
    generalEducation: [...(audit.generalEducation?.areas ?? []), ...(audit.generalEducation?.combinedRequirements ?? [])]
      .filter(x => x.required > x.earned).map(x => ({ label: x.label, shortage: x.required - x.earned, review: x.status === "needs-review" || x.status === "not-evaluable" })),
    missingCourses: audit.missingCourses.map(x => ({ name: x.name, credits: x.credits, required: x.priority === "필수" })),
    caveats: {
      requiredCourseSetReview: audit.courseMatch?.requiredCourseSetStatus === "review",
      pendingRecognition: !!audit.courseMatch?.pendingCourseRecognitions.length,
      programEvidenceInsufficient: audit.courseMatch?.programEvidence?.level === "insufficient" || audit.courseMatch?.status === "not-evaluable",
      certificationUnverified: audit.certificationEvidence !== "verified",
      generalEducationInconclusive: !audit.generalEducation?.conclusive,
      futureHistoryUnverified: !!audit.courses?.some(course => isFutureTranscriptTerm(course)),
    },
  };
  const g = summary.courseGuidance;
  if (g) {
    // Leave room for bounded question/key and route metadata within the 8 KiB request limit.
    let truncated = audit.courseGuidance!.remaining.length > g.remaining.length || audit.courseGuidance!.pools.length > g.pools.length || audit.courseGuidance!.pools.some(p => p.candidates.length > 4);
    while (new TextEncoder().encode(JSON.stringify(summary)).length > 4000) {
      truncated = true;
      if (g.pools.length) g.pools.pop();
      else if (g.remaining.length > 1) g.remaining.pop();
      else if (g.recognitionReview.length) g.recognitionReview.pop();
      else break;
    }
    if (truncated) g.dataGaps.push("상담 요약은 일부 과목·후보만 포함합니다. 전체 목록과 근거는 화면에서 확인하세요.");
  }
  return summary;
}

const safe = (s: string) => s.replace(/[\r\n<>]/g, " ").slice(0, 400) || "미확인";

function exact(value: unknown, keys: string[]): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && Object.keys(value).every(k => keys.includes(k));
}
const credit = (x: unknown) => typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 1000 && Math.round(x * 10) === x * 10;
const label = (x: unknown) => typeof x === "string" && x.length > 0 && x.length <= 80 && !/[\r\n<>]/.test(x);
export function validAssistantSummary(value: unknown, key: RuleKey): value is AssistantSummary {
  const keys = ["key", "requiredTotal", "earnedTotal", "applicableEarnedTotal", "forecastCredits", "overallStatus", "ruleStatus", "categories", "generalEducation", "missingCourses", "caveats"];
  if (value && typeof value === "object" && Object.hasOwn(value, "creditEvaluationStatus")) keys.push("creditEvaluationStatus");
  if (value && typeof value === "object" && Object.hasOwn(value, "courseGuidance")) keys.push("courseGuidance");
  if (!exact(value, keys)) return false;
  if (keys.includes("courseGuidance") && !validGuidance(value.courseGuidance)) return false;
  if (keys.includes("creditEvaluationStatus") && value.creditEvaluationStatus !== "evaluated" && value.creditEvaluationStatus !== "not-evaluable") return false;
  const k = value.key;
  if (!exact(k, ["universityId", "admissionYear", "departmentId"]) || k.universityId !== key.universityId || k.admissionYear !== key.admissionYear || k.departmentId !== key.departmentId) return false;
  if (![value.requiredTotal, value.earnedTotal, value.applicableEarnedTotal, value.forecastCredits].every(credit) || !["evaluated", "not-evaluable"].includes(String(value.overallStatus)) || ![null, "reviewed", "draft", "provisional", "approved"].includes(value.ruleStatus as string | null)) return false;
  if ((value.applicableEarnedTotal as number) > (value.earnedTotal as number)) return false;
  if (!Array.isArray(value.categories) || value.categories.length > 12 || !value.categories.every(x => exact(x, ["label", "shortage", "review", "confirmed", "reported", "pending"]) && label(x.label) && [x.shortage, x.confirmed, x.reported, x.pending].every(credit) && typeof x.review === "boolean")) return false;
  if (!Array.isArray(value.generalEducation) || value.generalEducation.length > 20 || !value.generalEducation.every(x => exact(x, ["label", "shortage", "review"]) && label(x.label) && credit(x.shortage) && typeof x.review === "boolean")) return false;
  if (!Array.isArray(value.missingCourses) || value.missingCourses.length > 30 || !value.missingCourses.every(x => exact(x, ["name", "credits", "required"]) && label(x.name) && credit(x.credits) && typeof x.required === "boolean")) return false;
  const c = value.caveats;
  return exact(c, ["requiredCourseSetReview", "pendingRecognition", "programEvidenceInsufficient", "certificationUnverified", "generalEducationInconclusive", "futureHistoryUnverified"]) && Object.values(c).every(x => typeof x === "boolean");
}

function validGuidance(g: unknown): boolean {
  const text = (s: unknown) => typeof s === "string" && s.length > 0 && s.length <= 400 && !/[\r\n<>]/.test(s);
  const list = (a: unknown, max: number, check: (x: unknown) => boolean) => Array.isArray(a) && a.length <= max && a.every(check);
  return exact(g, ["remaining", "pools", "recognitionReview", "dataGaps"])
    && list(g.remaining, 100, c => exact(c, ["name", "credits", "reason"]) && label(c.name) && credit(c.credits) && text(c.reason))
    && list(g.recognitionReview, 100, c => exact(c, ["name", "reason"]) && label(c.name) && text(c.reason))
    && list(g.dataGaps, 30, text)
    && list(g.pools, 30, p => exact(p, ["label", "condition", "review", "candidates"]) && label(p.label) && text(p.condition) && typeof p.review === "boolean" && list(p.candidates, 100, c => exact(c, ["name", "reason"]) && label(c.name) && text(c.reason)));
}
export function assistantGuidanceText(g: NonNullable<AssistantSummary["courseGuidance"]>): string {
  return conciseGuidanceText(g);
}
