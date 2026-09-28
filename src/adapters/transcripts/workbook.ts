import * as XLSX from "xlsx";
export const MAX_TRANSCRIPT_BYTES = 10 * 1024 * 1024;
const MIME_TYPES = new Set(["", "application/octet-stream", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]);
export function validateTranscriptFile(file: { name: string; size: number; type: string }) {
  if (!/\.(xlsx|xls)$/i.test(file.name) || !MIME_TYPES.has(file.type.toLowerCase())) throw new Error("지원하지 않는 Excel 파일 형식입니다.");
  if (!file.size || file.size > MAX_TRANSCRIPT_BYTES) throw new Error("성적표는 비어 있지 않은 10MB 이하 파일이어야 합니다.");
}
// Reject ZIP64/encryption and bound expansion before SheetJS reads members.
export function validateWorkbookBytes(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer), view = new DataView(buffer);
  if (bytes.length < 8 || bytes.length > MAX_TRANSCRIPT_BYTES) throw new Error("성적표 파일 크기가 잘못되었습니다.");
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) return;
  if (view.getUint32(0, true) !== 0x04034b50) throw new Error("Excel 파일 서명이 잘못되었습니다.");
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  }
  if (end < 0) throw new Error("손상된 Excel 압축파일입니다.");
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true), total = 0;
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || count > 128 || !count || offset + view.getUint32(end + 12, true) !== end) throw new Error("지원하지 않는 Excel 압축구조입니다.");
  const names = new Set<string>();
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) throw new Error("손상된 Excel 파일입니다.");
    const compressed = view.getUint32(offset + 20, true), expanded = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true), local = view.getUint32(offset + 42, true);
    const next = offset + 46 + nameLength + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    total += expanded;
    if (next > end || names.has(name) || name.includes("..") || name.startsWith("/") || name.includes("\\") || (view.getUint16(offset + 8, true) & 1) || expanded > 16 * 1024 * 1024 || total > 32 * 1024 * 1024 || expanded > Math.max(1024 * 1024, compressed * 200) || local + 30 > end || view.getUint32(local, true) !== 0x04034b50) throw new Error("비정상적인 Excel 압축파일입니다.");
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    if (start + compressed > end) throw new Error("손상된 Excel 데이터입니다.");
    names.add(name); offset = next;
  }
  if (offset !== end || !names.has("xl/workbook.xml")) throw new Error("Excel workbook이 없습니다.");
}
const HEADERS = [
  ["년도", "연도", "year"], ["학기", "semester"], ["교과목번호", "과목번호", "courseCode"],
  ["교과목명", "과목명", "courseName"], ["교과목구분▼", "교과목구분", "이수구분", "category"], ["학점", "credits"],
];
export function readTranscriptWorkbook(buffer: ArrayBuffer) {
  validateWorkbookBytes(buffer);
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false, sheetRows: 5002, cellFormula: false, cellHTML: false, cellStyles: false, bookVBA: false });
  if (!workbook.SheetNames.length || workbook.SheetNames.length > 16) throw new Error("성적표 시트 수가 잘못되었습니다.");
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const range = XLSX.utils.decode_range(sheet["!fullref"] ?? sheet["!ref"] ?? "A1");
    if (range.e.r >= 5001 || range.e.c >= 64) throw new Error("성적표 행 또는 열 제한을 초과했습니다.");
  }
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: "", raw: false });
  if (!rows.length) throw new Error("성적표에 교과목 데이터가 없습니다.");
  const headers = Object.keys(rows[0]);
  if (HEADERS.some(aliases => !aliases.some(alias => headers.includes(alias)))) throw new Error("성적표 필수 헤더가 누락되었습니다.");
  for (const row of rows) {
    const value = row["학점"] ?? row.credits;
    if (value !== undefined && value !== "" && (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 30)) throw new Error("잘못된 학점 값이 있습니다.");
  }
  return { rows, sheetName, headers };
}
