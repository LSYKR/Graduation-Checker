import type { CategoryKey, GraduationRuleSet, TranscriptCourse } from "@/lib/types";

export const DUMMY_DATA_NOTICE = "안정성 검사 전용 합성 성적표이며 실제 학생 개인정보를 포함하지 않습니다.";
export const RANDOM_STABILITY_ITERATIONS_PER_OFFERING = 32;
export const DUMMY_CATEGORY_KEYS: CategoryKey[] = [
  "generalRequired",
  "generalElective",
  "majorFoundation",
  "majorRequired",
  "majorElective",
  "freeElective",
];

const CATEGORY_CODES: Record<CategoryKey, string> = {
  generalRequired: "GR",
  generalElective: "GE",
  majorFoundation: "MF",
  majorRequired: "MR",
  majorElective: "ME",
  freeElective: "FE",
};

const CATEGORY_NAMES: Record<CategoryKey, string> = {
  generalRequired: "교양필수",
  generalElective: "교양선택",
  majorFoundation: "전공기초",
  majorRequired: "전공필수",
  majorElective: "전공선택",
  freeElective: "일반선택",
};

function requiredCredits(rule: GraduationRuleSet): Record<CategoryKey, number> {
  const totals = Object.fromEntries(DUMMY_CATEGORY_KEYS.map((key) => [key, 0])) as Record<CategoryKey, number>;
  for (const requirement of rule.credits) totals[requirement.key] = requirement.required;
  return totals;
}

function buildCoursesForTotals(
  rule: GraduationRuleSet,
  totals: Record<CategoryKey, number>,
): TranscriptCourse[] {
  const courses: TranscriptCourse[] = [];
  for (const category of DUMMY_CATEGORY_KEYS) {
    let remaining = Math.max(0, Math.round(totals[category]));
    let categoryIndex = 1;
    while (remaining > 0) {
      const credits = Math.min(3, remaining);
      const ordinal = courses.length + 1;
      courses.push({
        rowNumber: ordinal + 1,
        year: String(rule.key.admissionYear + Math.floor((ordinal - 1) / 12)),
        semester: ordinal % 2 ? "1학기" : "2학기",
        code: `DUMMY-${rule.key.admissionYear}-${rule.key.departmentId}-${CATEGORY_CODES[category]}-${String(categoryIndex).padStart(2, "0")}`,
        name: `합성 ${CATEGORY_NAMES[category]} 과목 ${categoryIndex}`,
        rawCategory: CATEGORY_NAMES[category],
        category,
        credits,
        grade: "A0",
        professor: "합성데이터",
        englishName: `Synthetic ${CATEGORY_CODES[category]} Course ${categoryIndex}`,
        passed: true,
        transferCredit: ordinal % 7 === 0,
        reclassified: false,
      });
      remaining -= credits;
      categoryIndex += 1;
    }
  }
  return courses;
}

export function buildRequirementDummyTranscript(
  rule: GraduationRuleSet,
  overrides: Partial<Record<CategoryKey, number>> = {},
): TranscriptCourse[] {
  return buildCoursesForTotals(rule, { ...requiredCredits(rule), ...overrides });
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFor(rule: GraduationRuleSet, iteration: number): number {
  const text = `${rule.key.universityId}:${rule.key.admissionYear}:${rule.key.departmentId}:${iteration}`;
  let hash = 2166136261;
  for (const character of text) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function buildSeededDummyTranscript(
  rule: GraduationRuleSet,
  iteration: number,
): TranscriptCourse[] {
  const random = seededRandom(seedFor(rule, iteration));
  const requirements = requiredCredits(rule);
  const totals = { ...requirements };
  for (const category of DUMMY_CATEGORY_KEYS) {
    totals[category] = Math.max(0, requirements[category] + Math.floor(random() * 16) - 6);
  }

  const courses = buildCoursesForTotals(rule, totals);
  const duplicateCount = courses.length ? 1 + Math.floor(random() * 3) : 0;
  for (let index = 0; index < duplicateCount; index += 1) {
    const original = courses[Math.floor(random() * courses.length)];
    courses.push({
      ...original,
      rowNumber: courses.length + 2,
      code: random() > 0.5 ? original.code.toLowerCase() : original.code,
      credits: random() > 0.75 ? original.credits + 1 : original.credits,
      grade: "B+",
    });
  }

  const failedCount = 1 + Math.floor(random() * 3);
  for (let index = 0; index < failedCount; index += 1) {
    const category = DUMMY_CATEGORY_KEYS[Math.floor(random() * DUMMY_CATEGORY_KEYS.length)];
    courses.push({
      rowNumber: courses.length + 2,
      year: String(rule.key.admissionYear + 1),
      semester: "2학기",
      code: `DUMMY-FAIL-${rule.key.admissionYear}-${rule.key.departmentId}-${iteration}-${index}`,
      name: `합성 낙제 제외 과목 ${index + 1}`,
      rawCategory: CATEGORY_NAMES[category],
      category,
      credits: 1 + Math.floor(random() * 3),
      grade: "F",
      professor: "합성데이터",
      englishName: `Synthetic Failed Course ${index + 1}`,
      passed: false,
      transferCredit: false,
      reclassified: false,
    });
  }

  for (let index = courses.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [courses[index], courses[swapIndex]] = [courses[swapIndex], courses[index]];
  }
  return courses;
}
