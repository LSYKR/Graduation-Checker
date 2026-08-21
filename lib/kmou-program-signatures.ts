import type { MajorProgramEvidence, TranscriptCourse } from "./types";

export interface KmouProgramIdentitySignature {
  programId: string;
  label: string;
  keywords: string[];
  minimumMatchedCourses?: number;
  minimumMatchedCredits?: number;
  minimumDistinctSignals?: number;
}

const signatures: KmouProgramIdentitySignature[] = [
  { programId: "ship-ocean-systems-engineering", label: "조선해양시스템공학", keywords: ["조선공학", "선박설계", "선체구조", "저항추진", "조선해양", "선박해양"] },
  { programId: "ocean-engineering", label: "해양공학", keywords: ["해양공학개론", "해양구조물", "해양유체역학", "해안공학", "파랑", "해양토질"] },
  { programId: "energy-resources-engineering", label: "에너지자원공학", keywords: ["자원공학", "석유공학", "저류층", "시추공학", "자원개발", "암석역학"] },
  { programId: "marine-architecture-disaster-prevention", label: "건축방재공학", keywords: ["건축방재", "건축구조", "건축시공", "재난관리", "구조설계", "건축환경"] },
  { programId: "marine-spatial-design", label: "공간디자인", keywords: ["공간디자인", "실내디자인", "건축디자인", "디자인스튜디오", "공간계획", "표현기법"] },
  { programId: "marine-architecture-engineering", label: "해양건축공학", keywords: ["해양건축", "건축설계", "건축구조", "건축시공", "건축환경", "도시설계"] },
  { programId: "ocean-environment-science", label: "해양환경학", keywords: ["해양학개론", "물리해양", "화학해양", "생물해양", "해양관측", "해양환경"] },
  { programId: "marine-biotechnology", label: "해양생물공학", keywords: ["해양생명공학", "분자생물", "생화학", "미생물", "유전공학", "세포생물"] },
  { programId: "fisheries-bioscience", label: "수산바이오공학", keywords: ["수산바이오", "양식학", "어류", "사료영양", "수산생물", "어병"] },
  { programId: "marine-sports-science", label: "해양스포츠과학", keywords: ["해양스포츠", "스포츠과학", "운동생리", "수영", "체육", "해양레저"] },
  { programId: "mechanical-systems-engineering", label: "기계시스템공학", keywords: ["기계설계", "기계공학", "기계진동", "동역학", "재료역학", "유체기계"] },
  { programId: "refrigeration-air-conditioning-engineering", label: "냉동공조공학", keywords: ["냉동공학", "공기조화", "열전달", "냉동시스템", "냉매", "공조설비"] },
  { programId: "marine-advanced-materials-engineering", label: "해양신소재융합공학", keywords: ["신소재", "금속재료", "재료공학", "부식", "용접", "재료분석"] },
  { programId: "electrical-electronics-engineering", label: "전기전자공학", keywords: ["전기기기", "전력공학", "전자기학", "전기회로", "전기설비", "전력전자"] },
  { programId: "electronic-communications-engineering", label: "전자정보통신공학", keywords: ["전자통신", "통신이론", "디지털통신", "전자회로", "신호및시스템", "정보통신"] },
  { programId: "nano-semiconductor-engineering", label: "나노반도체공학", keywords: ["반도체", "나노소재", "전자재료", "반도체소자", "박막", "고체전자"] },
  { programId: "radio-mobility-convergence-engineering", label: "전파융합공학", keywords: ["전파공학", "마이크로파", "안테나", "무선통신", "rf회로", "전자파"] },
  { programId: "data-science", label: "데이터사이언스", keywords: ["데이터사이언스", "데이터마이닝", "데이터시각화", "빅데이터", "통계적학습", "데이터분석"] },
  { programId: "intelligent-control-systems-engineering", label: "지능제어시스템공학", keywords: ["제어공학", "자동제어", "계측공학", "plc", "로봇제어", "공정제어"] },
  { programId: "computer-engineering", label: "컴퓨터공학", keywords: ["운영체제", "자료구조", "컴퓨터구조", "소프트웨어공학", "컴퓨터네트워크", "임베디드시스템"] },
  { programId: "logistics-systems-engineering", label: "물류시스템공학", keywords: ["물류관리", "물류시스템", "공급사슬", "항만물류", "운송", "물류최적화"] },
  { programId: "environmental-engineering", label: "환경공학", keywords: ["환경공학", "수질", "대기오염", "하폐수", "폐기물", "토양오염", "환경미생물"] },
  { programId: "civil-engineering", label: "토목공학", keywords: ["토목공학", "구조역학", "철근콘크리트", "지반공학", "측량학", "수리학"] },
];

const normalize = (value: string) => value
  .normalize("NFKC")
  .toLocaleLowerCase("ko-KR")
  .replace(/[^\p{L}\p{N}]+/gu, "");

const byProgram = new Map(signatures.map((signature) => [signature.programId, signature]));

export function getKmouProgramIdentitySignature(programId: string): KmouProgramIdentitySignature | null {
  return byProgram.get(programId) ?? null;
}

export function measureKmouProgramIdentity(
  courses: TranscriptCourse[],
  programId: string,
): MajorProgramEvidence {
  const signature = getKmouProgramIdentitySignature(programId);
  const deduplicatedMajorCourses = new Map<string, TranscriptCourse>();
  for (const course of courses.filter((item) => item.passed && ["majorFoundation", "majorRequired", "majorElective"].includes(item.category))) {
    const key = course.code
      ? `code:${course.code.toUpperCase()}`
      : `name:${normalize(course.name)}`;
    const previous = deduplicatedMajorCourses.get(key);
    if (!previous || course.credits > previous.credits) deduplicatedMajorCourses.set(key, course);
  }
  const transcriptMajorCourses = [...deduplicatedMajorCourses.values()];
  if (!signature) {
    return {
      level: "insufficient",
      matchedCourses: 0,
      matchedCredits: 0,
      transcriptMajorCourses: transcriptMajorCourses.length,
      matchRatio: 0,
      method: "none",
    };
  }

  const normalizedKeywords = signature.keywords.map((keyword) => ({ raw: keyword, normalized: normalize(keyword) }));
  const matched = transcriptMajorCourses.flatMap((course) => {
    const courseName = normalize(course.name);
    const signals = normalizedKeywords.filter((keyword) => courseName.includes(keyword.normalized));
    return signals.length ? [{ course, signals }] : [];
  });
  const distinctSignals = new Set(matched.flatMap((item) => item.signals.map((signal) => signal.normalized))).size;
  const matchedCredits = matched.reduce((sum, item) => sum + item.course.credits, 0);
  const minimumMatchedCourses = signature.minimumMatchedCourses ?? 3;
  const minimumMatchedCredits = signature.minimumMatchedCredits ?? 6;
  const minimumDistinctSignals = signature.minimumDistinctSignals ?? 3;
  const strong = matched.length >= minimumMatchedCourses
    && matchedCredits >= minimumMatchedCredits
    && distinctSignals >= minimumDistinctSignals;
  const partial = matched.length >= 2 && matchedCredits >= 3 && distinctSignals >= 2;
  const matchRatio = transcriptMajorCourses.length ? matched.length / transcriptMajorCourses.length : 0;

  return {
    level: strong ? "strong" : partial ? "partial" : "insufficient",
    matchedCourses: matched.length,
    matchedCredits,
    transcriptMajorCourses: transcriptMajorCourses.length,
    matchRatio: Math.round(matchRatio * 1000) / 1000,
    method: "course-name-signature",
    matchedCourseNames: matched.map((item) => item.course.name),
    distinctSignals,
    confidenceScore: matched.length * 4 + distinctSignals * 2 + Math.round(matchedCredits * 10) / 50,
  };
}

export function detectKmouProgramSignatureMismatch(
  courses: TranscriptCourse[],
  selectedProgramId: string,
): { programId: string; label: string; evidence: MajorProgramEvidence } | null {
  const candidates = signatures
    .map((signature) => ({
      programId: signature.programId,
      label: signature.label,
      evidence: measureKmouProgramIdentity(courses, signature.programId),
    }))
    .filter((candidate) => candidate.evidence.level === "strong")
    .sort((a, b) => (b.evidence.confidenceScore ?? 0) - (a.evidence.confidenceScore ?? 0)
      || b.evidence.matchedCourses - a.evidence.matchedCourses
      || b.evidence.matchedCredits - a.evidence.matchedCredits);

  const strongest = candidates[0];
  if (!strongest || strongest.programId === selectedProgramId) return null;
  const selected = candidates.find((candidate) => candidate.programId === selectedProgramId);
  if (selected && (strongest.evidence.confidenceScore ?? 0) < (selected.evidence.confidenceScore ?? 0) + 8) return null;
  return strongest;
}

export const KMOU_PROGRAM_IDENTITY_SIGNATURES = signatures;
