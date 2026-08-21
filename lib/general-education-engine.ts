import type { GeneralEducationRecognitionRule, GraduationRuleSet } from "./rule-model";
import type {
  GeneralEducationAudit,
  GeneralEducationMatchedCourse,
  GeneralEducationRecognitionMode,
  TranscriptCourse,
} from "./types";

interface ResolvedAreaMatch {
  areaId: string;
  mode: GeneralEducationRecognitionMode;
  expectedCredits: number;
  evidence?: GeneralEducationRecognitionRule["evidence"];
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function dedupePassedCourses(courses: TranscriptCourse[]): TranscriptCourse[] {
  const deduped = new Map<string, TranscriptCourse>();
  for (const course of courses.filter((item) => item.passed)) {
    const code = normalizeCode(course.code);
    const key = code ? `code:${code}` : `name:${course.name.trim()}`;
    const previous = deduped.get(key);
    if (!previous || course.credits > previous.credits) deduped.set(key, course);
  }
  return [...deduped.values()];
}

function resolveAreaMatches(
  course: TranscriptCourse,
  ruleSet: GraduationRuleSet,
  recognitionRules: GeneralEducationRecognitionRule[],
): ResolvedAreaMatch[] {
  const normalizedCode = normalizeCode(course.code);
  if (!normalizedCode) return [];
  const matches = new Map<string, ResolvedAreaMatch>();

  for (const area of ruleSet.generalEducationAreas) {
    const candidate = area.eligibleCourses.find((item) => normalizeCode(item.code) === normalizedCode);
    if (candidate) {
      matches.set(area.id, { areaId: area.id, mode: "direct", expectedCredits: candidate.credits });
    }
  }

  const transcriptKind = course.transferCredit ? "transfer-recognized" : "completed";
  for (const recognition of recognitionRules) {
    if (normalizeCode(recognition.courseCode) !== normalizedCode) continue;
    if (!recognition.acceptedTranscriptKinds.includes(transcriptKind)) continue;
    matches.set(recognition.targetAreaId, {
      areaId: recognition.targetAreaId,
      mode: recognition.mode,
      expectedCredits: recognition.credits,
      evidence: recognition.evidence,
    });
  }

  return [...matches.values()];
}

export function matchGeneralEducationAreas(
  code: string,
  ruleSet: GraduationRuleSet,
  recognitionRules: GeneralEducationRecognitionRule[] = [],
): string[] {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) return [];
  const direct = ruleSet.generalEducationAreas
    .filter((area) => area.eligibleCourses.some((course) => course.code.trim().toUpperCase() === normalizedCode))
    .map((area) => area.id);
  const special = recognitionRules
    .filter((recognition) => normalizeCode(recognition.courseCode) === normalizedCode)
    .map((recognition) => recognition.targetAreaId);
  return [...new Set([...direct, ...special])];
}

export interface GeneralEducationEvaluationOptions {
  verifiedNonTargetCourseCodes?: string[];
  recognitionRules?: GeneralEducationRecognitionRule[];
}

function matchedCourse(
  course: TranscriptCourse,
  match: ResolvedAreaMatch | undefined,
): GeneralEducationMatchedCourse {
  const recognitionMode = match?.mode ?? "direct";
  return {
    code: course.code,
    name: course.name,
    credits: course.credits,
    recognitionMode,
    transferCredit: course.transferCredit,
    transcriptCategory: course.rawCategory,
    categoryDifference: recognitionMode !== "direct" && course.category !== "generalElective",
    evidence: match?.evidence,
  };
}

export function evaluateGeneralEducation(
  courses: TranscriptCourse[],
  ruleSet: GraduationRuleSet,
  options: GeneralEducationEvaluationOptions = {},
): GeneralEducationAudit {
  const verifiedNonTargetCodes = new Set(
    (options.verifiedNonTargetCourseCodes ?? []).map((code) => code.trim().toUpperCase()),
  );
  const recognitionRules = options.recognitionRules ?? [];
  const knownAreaIds = new Set(ruleSet.generalEducationAreas.map((area) => area.id));
  const evaluatedCourses = dedupePassedCourses(courses).map((course) => {
    const matches = resolveAreaMatches(course, ruleSet, recognitionRules);
    const areaIds = [...new Set(matches.map((match) => match.areaId))];
    const invalidAreaIds = areaIds.filter((areaId) => !knownAreaIds.has(areaId));
    const creditMismatch = matches.find((match) => Math.abs(match.expectedCredits - course.credits) > 0.001);
    const conflictReason = invalidAreaIds.length > 0
      ? "unknown-area" as const
      : areaIds.length > 1
        ? "multiple-areas" as const
        : creditMismatch
          ? "credit-mismatch" as const
          : null;
    return {
      ...course,
      matches,
      conflictReason,
      expectedCredits: creditMismatch?.expectedCredits,
      generalEducationAreaIds: conflictReason ? [] : areaIds,
    };
  });

  const mappingConflicts = evaluatedCourses
    .filter((course) => course.conflictReason)
    .map((course) => ({
      code: course.code,
      name: course.name,
      credits: course.credits,
      areaIds: course.matches.map((match) => match.areaId),
      reason: course.conflictReason!,
      expectedCredits: course.expectedCredits,
    }));

  const unmappedGeneralElectives = evaluatedCourses
    .filter((course) => course.category === "generalElective"
      && course.generalEducationAreaIds.length === 0
      && !course.conflictReason
      && !verifiedNonTargetCodes.has(course.code.trim().toUpperCase()))
    .map((course) => matchedCourse(course, undefined));

  const areas = ruleSet.generalEducationAreas.map((requirement) => {
    const matchedCourses = evaluatedCourses
      .filter((course) => course.generalEducationAreaIds.includes(requirement.id))
      .map((course) => matchedCourse(course, course.matches.find((match) => match.areaId === requirement.id)));
    const earned = matchedCourses.reduce((sum, course) => sum + course.credits, 0);
    const status = requirement.eligibleCourses.length === 0
      ? "not-evaluable" as const
      : earned >= requirement.minimumCredits
        ? "satisfied" as const
        : unmappedGeneralElectives.length || mappingConflicts.length
          ? "needs-review" as const
          : "missing" as const;
    return {
      id: requirement.id,
      label: requirement.label,
      parentArea: requirement.parentArea,
      creditCategory: requirement.creditCategory
        ?? (requirement.id === "personality-required" ? "generalRequired" : "generalElective"),
      earned,
      required: requirement.minimumCredits,
      status,
      matchedCourses,
    };
  });

  const combinedRequirements = ruleSet.generalEducationCombinedRequirements.map((requirement) => {
    const matched = new Map<string, GeneralEducationMatchedCourse>();
    for (const course of evaluatedCourses) {
      if (!course.generalEducationAreaIds.some((areaId) => requirement.areaIds.includes(areaId))) continue;
      const key = course.code ? course.code.toUpperCase() : `name:${course.name}`;
      const match = course.matches.find((candidate) => requirement.areaIds.includes(candidate.areaId));
      matched.set(key, matchedCourse(course, match));
    }
    const matchedCourses = [...matched.values()];
    const earned = matchedCourses.reduce((sum, course) => sum + course.credits, 0);
    const referencedAreas = areas.filter((area) => requirement.areaIds.includes(area.id));
    const notEvaluable = referencedAreas.length !== requirement.areaIds.length || referencedAreas.some((area) => area.status === "not-evaluable");
    const status = notEvaluable
      ? "not-evaluable" as const
      : earned >= requirement.minimumCredits
        ? "satisfied" as const
        : unmappedGeneralElectives.length || mappingConflicts.length
          ? "needs-review" as const
          : "missing" as const;
    return {
      id: requirement.id,
      label: requirement.label,
      areaIds: requirement.areaIds,
      earned,
      required: requirement.minimumCredits,
      status,
      matchedCourses,
    };
  });

  return {
    areas,
    combinedRequirements,
    unmappedGeneralElectives,
    mappingConflicts,
    conclusive: mappingConflicts.length === 0
      && [...areas, ...combinedRequirements].every((item) => item.status !== "needs-review" && item.status !== "not-evaluable"),
  };
}
