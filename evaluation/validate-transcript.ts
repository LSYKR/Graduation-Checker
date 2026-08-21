import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { auditTranscript, parseTranscriptBuffer } from "../lib/graduation-engine";

const sourcePath = process.argv[2];
const expectedTotal = process.argv[3] ? Number(process.argv[3]) : undefined;
if (!sourcePath) {
  console.error("사용법: npm run evaluate:transcript -- <성적표.xlsx> [예상총학점]");
  process.exit(2);
}

const bytes = readFileSync(resolve(sourcePath));
const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
const parsed = parseTranscriptBuffer(buffer);
const audit = auditTranscript(parsed.courses);
if (!audit.courseMatch) throw new Error("전공 판정 결과가 없습니다.");
const courseMatch = audit.courseMatch;

if (expectedTotal !== undefined && audit.earnedTotal !== expectedTotal) {
  throw new Error(`총학점 불일치: expected=${expectedTotal}, actual=${audit.earnedTotal}`);
}

console.log(JSON.stringify({
  status: "passed",
  rows: parsed.recognizedRows,
  excludedRows: parsed.excludedRows,
  earnedTotal: audit.earnedTotal,
  reclassified: audit.reclassifiedCount,
  categories: Object.fromEntries(audit.categories.map((item) => [item.label, item.earned])),
  missingCourseCodes: audit.missingCourses.map((course) => course.code),
  majorCourseAudit: {
    status: courseMatch.status,
    currentClassificationApplied: courseMatch.currentClassificationApplied,
    programEvidence: courseMatch.programEvidence,
    matchedCredits: courseMatch.matchedCredits,
    institutionallyRecognizedCredits: courseMatch.institutionallyRecognizedCredits,
    unmatchedCredits: courseMatch.unmatchedCredits,
    requiredCreditShortage: courseMatch.requiredCreditShortage,
    potentialRequiredCredits: courseMatch.potentialRequiredCredits,
    pendingRecognitions: courseMatch.pendingCourseRecognitions.map((item) => `${item.requiredCode}<-${item.substituteCode}`),
  },
  forecastCredits: audit.forecastCredits,
  generalEducation: audit.generalEducation ? {
    areas: Object.fromEntries(audit.generalEducation.areas.map((item) => [item.id, {
      earned: item.earned,
      required: item.required,
      status: item.status,
    }])),
    combined: Object.fromEntries(audit.generalEducation.combinedRequirements.map((item) => [item.id, {
      earned: item.earned,
      required: item.required,
      status: item.status,
    }])),
    specialRecognitionCodes: audit.generalEducation.areas
      .flatMap((item) => item.matchedCourses)
      .filter((course) => course.recognitionMode !== "direct")
      .map((course) => course.code),
    unmappedCodes: audit.generalEducation.unmappedGeneralElectives.map((course) => course.code),
    mappingConflictCodes: audit.generalEducation.mappingConflicts.map((course) => course.code),
    conclusive: audit.generalEducation.conclusive,
  } : null,
}, null, 2));
