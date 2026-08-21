import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import { summarizeTranscriptRows, type TranscriptRawRow } from "../lib/transcript-profile";

const sourcePath = process.argv[2];
const expectedTransferEntryYear = process.argv[3] ? Number(process.argv[3]) : undefined;
if (!sourcePath) {
  console.error("사용법: npm run evaluate:transfer-profile -- <성적표.xlsx> [예상편입처리연도]");
  process.exit(2);
}

const bytes = readFileSync(resolve(sourcePath));
const workbook = XLSX.read(bytes, { type: "buffer", cellDates: false });
const sheetName = workbook.SheetNames[0];
if (!sheetName) throw new Error("Excel 파일에서 첫 번째 시트를 찾지 못했습니다.");
const rows = XLSX.utils.sheet_to_json<TranscriptRawRow>(workbook.Sheets[sheetName], { defval: "", raw: false });
const summary = summarizeTranscriptRows(rows);

if (summary.transferRecognition.status !== "detected") {
  throw new Error(`편입 인정 처리 연도를 하나로 확정할 수 없습니다: ${summary.transferRecognition.status}`);
}
if (expectedTransferEntryYear !== undefined && summary.transferRecognition.years[0] !== expectedTransferEntryYear) {
  throw new Error(`편입 처리 연도 불일치: expected=${expectedTransferEntryYear}, actual=${summary.transferRecognition.years[0]}`);
}

console.log(JSON.stringify({
  status: "passed",
  sheetName,
  recognizedRows: summary.recognizedRows,
  latestAcademicTerm: summary.latestAcademicTerm,
  transferRecognition: summary.transferRecognition,
  privacy: "과목별 원문·학번·성명은 출력하지 않음",
}, null, 2));
