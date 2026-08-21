import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import XLSXModule from "xlsx";

const XLSX = XLSXModule;

const root = resolve(import.meta.dirname, "..");
const outputPath = resolve(root, "data/extracted/kmou/general-education-catalog-code-index-2020-2026.json");
const sourceByYear = new Map([
  [2020, "data/sources/kmou/2020/2020_general_education_course_catalog.xlsx"],
  [2021, "data/sources/kmou/2021/2021_general_education_course_catalog.xlsx"],
  [2022, "data/sources/kmou/2022/2022_general_education_course_catalog.pdf"],
  [2023, "data/sources/kmou/2023/2023_general_education_course_catalog.pdf"],
  [2024, "data/sources/kmou/2024/2024_general_education_course_catalog.pdf"],
  [2025, "data/sources/kmou/2025/2025_general_education_course_catalog.pdf"],
  [2026, "data/sources/kmou/2026/2026_general_education_course_catalog.pdf"],
]);

const normalizeCode = (value) => String(value ?? "").trim().toUpperCase();
const validCode = (value) => /^(?:L\d{4}|\d{5})$/.test(value);
const sortCodes = (codes) => [...codes].sort((a, b) => a.localeCompare(b, "en"));

function codesFromWorkbook(path) {
  const workbook = XLSX.readFile(path, { cellDates: false });
  const codes = new Set();
  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", raw: false });
    const headerIndex = rows.findIndex((row) => row.some((cell) => String(cell).trim() === "교과목번호"));
    if (headerIndex < 0) continue;
    const headers = rows[headerIndex].map((cell) => String(cell).trim());
    const codeIndex = headers.indexOf("교과목번호");
    const typeIndex = headers.findIndex((header) => header === "교과구분" || header === "교과목구분");
    for (const row of rows.slice(headerIndex + 1)) {
      const courseType = String(row[typeIndex] ?? "").replace(/\s/g, "");
      const code = normalizeCode(row[codeIndex]);
      if (["교양필수", "교양선택"].includes(courseType) && validCode(code)) codes.add(code);
    }
  }
  return codes;
}

function codesFromPdf(path) {
  const text = execFileSync("pdftotext", ["-layout", path, "-"], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  const codes = new Set();
  for (const line of text.split(/\r?\n/)) {
    if (!/교양\s*(?:필수|선택)/.test(line)) continue;
    for (const token of line.match(/(?:^|\s)(L\d{4}|\d{5})(?=\s|$)/gi) ?? []) {
      const code = normalizeCode(token);
      if (validCode(code)) codes.add(code);
    }
  }
  return codes;
}

const years = {};
for (const [year, relativePath] of sourceByYear) {
  const absolutePath = resolve(root, relativePath);
  const bytes = await readFile(absolutePath);
  const codes = relativePath.endsWith(".xlsx") ? codesFromWorkbook(absolutePath) : codesFromPdf(absolutePath);
  if (codes.size < 50) throw new Error(`${year}: official general-education catalog extraction is unexpectedly small (${codes.size})`);
  years[String(year)] = {
    sourcePath: relativePath,
    sourceSha256: createHash("sha256").update(bytes).digest("hex"),
    matchPolicy: "exact-official-course-code",
    courseCount: codes.size,
    courseCodes: sortCodes(codes),
  };
}

const output = {
  schemaVersion: 1,
  universityId: "kmou",
  generatedAt: "2026-08-07",
  purpose: "학년도별 공식 교양과목 중 졸업 세부영역 대상이 아닌 과목을 안전하게 식별하기 위한 코드 색인",
  years,
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(Object.fromEntries(Object.entries(years).map(([year, value]) => [year, value.courseCount])));
