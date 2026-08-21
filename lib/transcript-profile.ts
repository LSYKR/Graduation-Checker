import type { CategoryKey } from "./types";

export type TranscriptRawRow = Record<string, unknown>;
export type TransferRecognitionStatus = "detected" | "missing" | "ambiguous";

export interface TransferRecognitionSummary {
  status: TransferRecognitionStatus;
  years: number[];
  recognizedRows: number;
  recognizedCredits: number;
  categoryCredits: Partial<Record<CategoryKey, number>>;
}

export interface TranscriptRowSummary {
  recognizedRows: number;
  latestAcademicTerm: string;
  transferRecognition: TransferRecognitionSummary;
}

export const TRANSFER_RECOGNITION_SEMESTER = "편입생 인정학점";

const CATEGORY_BY_LABEL: Record<string, CategoryKey> = {
  교양필수: "generalRequired",
  교필: "generalRequired",
  교양선택: "generalElective",
  교선: "generalElective",
  전공기초: "majorFoundation",
  전기: "majorFoundation",
  전공필수: "majorRequired",
  전필: "majorRequired",
  전공선택: "majorElective",
  전선: "majorElective",
  일반선택: "freeElective",
  일선: "freeElective",
  일반: "freeElective",
};

export function readTranscriptText(row: TranscriptRawRow, aliases: readonly string[]): string {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(row, alias)) {
      return String(row[alias] ?? "").trim();
    }
  }
  return "";
}

function readCredits(row: TranscriptRawRow): number {
  const parsed = Number.parseFloat(readTranscriptText(row, ["학점", "credits"]).replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function readYear(row: TranscriptRawRow): number | null {
  const parsed = Number.parseInt(readTranscriptText(row, ["년도", "연도", "year"]).replace(/[^0-9]/g, ""), 10);
  return Number.isInteger(parsed) && parsed >= 1900 && parsed <= 2200 ? parsed : null;
}

function isCourseRow(row: TranscriptRawRow): boolean {
  return Boolean(
    readTranscriptText(row, ["교과목번호", "과목번호", "courseCode"]) ||
    readTranscriptText(row, ["교과목명", "과목명", "courseName"]),
  );
}

function latestAcademicTerm(rows: TranscriptRawRow[]): string {
  const candidates = rows
    .filter(isCourseRow)
    .map((row) => {
      const year = readYear(row);
      const semester = readTranscriptText(row, ["학기", "semester"]);
      const semesterRank = semester.includes("2") ? 2 : semester.includes("1") ? 1 : 0;
      return { year, semesterRank, semester };
    })
    .filter((item): item is { year: number; semesterRank: number; semester: string } => item.year !== null)
    .sort((a, b) => b.year - a.year || b.semesterRank - a.semesterRank);

  const latest = candidates[0];
  if (!latest) return "확인 필요";
  const normalizedSemester = latest.semesterRank ? `${latest.semesterRank}학기` : latest.semester || "학기 확인 필요";
  return `${latest.year}학년도 ${normalizedSemester}`;
}

export function summarizeTransferRecognition(rows: TranscriptRawRow[]): TransferRecognitionSummary {
  const transferRows = rows.filter((row) =>
    isCourseRow(row) && readTranscriptText(row, ["학기", "semester"]).includes(TRANSFER_RECOGNITION_SEMESTER),
  );
  const years = [...new Set(transferRows.map(readYear).filter((year): year is number => year !== null))].sort((a, b) => a - b);
  const categoryCredits: Partial<Record<CategoryKey, number>> = {};
  let recognizedCredits = 0;

  for (const row of transferRows) {
    const credits = readCredits(row);
    recognizedCredits += credits;
    const label = readTranscriptText(row, ["교과목구분▼", "교과목구분", "이수구분", "category"]).replace(/\s/g, "");
    const category = CATEGORY_BY_LABEL[label];
    if (category) categoryCredits[category] = (categoryCredits[category] ?? 0) + credits;
  }

  return {
    status: transferRows.length === 0 ? "missing" : years.length === 1 ? "detected" : "ambiguous",
    years,
    recognizedRows: transferRows.length,
    recognizedCredits: Math.round(recognizedCredits * 100) / 100,
    categoryCredits,
  };
}

export function summarizeTranscriptRows(rows: TranscriptRawRow[]): TranscriptRowSummary {
  return {
    recognizedRows: rows.filter(isCourseRow).length,
    latestAcademicTerm: latestAcademicTerm(rows),
    transferRecognition: summarizeTransferRecognition(rows),
  };
}

const CATEGORY_LABELS: Array<[CategoryKey, string]> = [
  ["generalRequired", "교필"],
  ["generalElective", "교선"],
  ["majorFoundation", "전기"],
  ["majorRequired", "전필"],
  ["majorElective", "전선"],
  ["freeElective", "일선"],
];

export function formatTransferCategoryCredits(summary: TransferRecognitionSummary): string {
  return CATEGORY_LABELS
    .map(([key, label]) => summary.categoryCredits[key] ? `${label} ${summary.categoryCredits[key]}학점` : "")
    .filter(Boolean)
    .join(" · ");
}
