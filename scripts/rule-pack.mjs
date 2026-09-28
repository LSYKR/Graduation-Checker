import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packsRoot = process.env.RULE_PACK_ROOT ? resolve(process.env.RULE_PACK_ROOT) : resolve(root, "rules/packs/kmou");
const generatedPath = process.env.RULE_PACK_GENERATED ? resolve(process.env.RULE_PACK_GENERATED) : resolve(root, "src/generated/kmou-rule-pack-index.json");
const categoryKeys = new Set(["generalRequired", "generalElective", "majorFoundation", "majorRequired", "majorElective", "freeElective"]);

const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

export function validateRulePack(value, context = "rule pack") {
  const errors = [];
  if (!object(value)) return [`${context}: 최상위 값은 객체여야 합니다.`];
  const pack = value;
  if (pack.schemaVersion !== "1.0") errors.push(`${context}.schemaVersion: 1.0이어야 합니다.`);
  if (pack.universityId !== "kmou") errors.push(`${context}.universityId: kmou여야 합니다.`);
  if (!Number.isInteger(pack.admissionYear) || pack.admissionYear < 1900 || pack.admissionYear > 2200) errors.push(`${context}.admissionYear: 1900~2200 정수여야 합니다.`);
  if (!['official', 'estimated-previous-year'].includes(pack.basis)) errors.push(`${context}.basis: official 또는 estimated-previous-year여야 합니다.`);
  if (!['active', 'draft'].includes(pack.status)) errors.push(`${context}.status: active 또는 draft여야 합니다.`);
  if (!Array.isArray(pack.offerings)) errors.push(`${context}.offerings: 배열이어야 합니다.`);
  if (!Array.isArray(pack.operationalRules)) errors.push(`${context}.operationalRules: 배열이어야 합니다.`);
  if (pack.basis === "estimated-previous-year") {
    if (pack.status !== "draft") errors.push(`${context}.status: 이전 학년도 추정 팩은 draft여야 합니다.`);
    if (!Number.isInteger(pack.basedOnYear) || pack.basedOnYear >= pack.admissionYear) errors.push(`${context}.basedOnYear: 대상보다 이전 학년도여야 합니다.`);
    if (typeof pack.warning !== "string" || !pack.warning.includes("공식 미확인")) errors.push(`${context}.warning: '공식 미확인' 경고가 필요합니다.`);
    if (Array.isArray(pack.operationalRules) && pack.operationalRules.length) errors.push(`${context}.operationalRules: 추정 팩은 공식 판정 규칙을 활성화할 수 없습니다.`);
  } else {
    if (own(pack, "basedOnYear")) errors.push(`${context}.basedOnYear: 공식 팩에는 둘 수 없습니다.`);
    if (pack.status !== "active") errors.push(`${context}.status: 공식 팩은 active여야 합니다.`);
  }
  const offeringIds = new Set();
  for (const [index, item] of (Array.isArray(pack.offerings) ? pack.offerings : []).entries()) {
    const path = `${context}.offerings[${index}]`;
    if (!object(item)) { errors.push(`${path}: 객체여야 합니다.`); continue; }
    if (!item.programId || typeof item.programId !== "string") errors.push(`${path}.programId: 문자열이 필요합니다.`);
    else if (offeringIds.has(item.programId)) errors.push(`${path}.programId: 중복된 전공 ID입니다.`);
    else offeringIds.add(item.programId);
    for (const key of ["displayName", "currentUnit", "curriculumCollegeName", "batch", "support"]) if (typeof item[key] !== "string" || !item[key]) errors.push(`${path}.${key}: 문자열이 필요합니다.`);
    if (!object(item.creditSummary)) errors.push(`${path}.creditSummary: 객체가 필요합니다.`);
    else {
      const keys = ["generalElective", "generalRequired", "majorFoundation", "minimumMajorElective", "minimumMajorRequired", "advancedMajorElective", "advancedMajorRequired", "freeElective"];
      let sum = 0;
      for (const key of keys) { const amount = item.creditSummary[key]; if (!Number.isFinite(amount) || amount < 0) errors.push(`${path}.creditSummary.${key}: 0 이상의 숫자여야 합니다.`); else sum += amount; }
      if (!Number.isFinite(item.creditSummary.total) || item.creditSummary.total <= 0) errors.push(`${path}.creditSummary.total: 양수여야 합니다.`);
      else if (sum !== item.creditSummary.total) errors.push(`${path}.creditSummary: 영역 합계 ${sum}와 총학점 ${item.creditSummary.total}이 다릅니다.`);
    }
  }
  const ruleKeys = new Set();
  for (const [index, rule] of (Array.isArray(pack.operationalRules) ? pack.operationalRules : []).entries()) {
    const path = `${context}.operationalRules[${index}]`;
    if (!object(rule)) { errors.push(`${path}: 객체여야 합니다.`); continue; }
    if (!object(rule.key)) errors.push(`${path}.key: 객체가 필요합니다.`);
    else {
      if (rule.key.universityId !== pack.universityId || rule.key.admissionYear !== pack.admissionYear) errors.push(`${path}.key: 팩의 학교·입학년도와 일치해야 합니다.`);
      if (!offeringIds.has(rule.key.departmentId)) errors.push(`${path}.key.departmentId: offerings에 없는 전공입니다.`);
      const key = `${rule.key.universityId}:${rule.key.admissionYear}:${rule.key.departmentId}`;
      if (ruleKeys.has(key)) errors.push(`${path}.key: 중복 운영 규칙입니다.`); else ruleKeys.add(key);
    }
    if (rule.schemaVersion !== "1.0" || !rule.version) errors.push(`${path}: schemaVersion 1.0과 version이 필요합니다.`);
    if (!['approved', 'provisional'].includes(rule.status)) errors.push(`${path}.status: 활성 팩 규칙은 approved 또는 provisional이어야 합니다.`);
    if (!Number.isFinite(rule.requiredTotal) || rule.requiredTotal <= 0) errors.push(`${path}.requiredTotal: 양수여야 합니다.`);
    if (!Array.isArray(rule.credits) || !rule.credits.length) errors.push(`${path}.credits: 비어 있지 않은 배열이어야 합니다.`);
    else for (const [creditIndex, credit] of rule.credits.entries()) if (!object(credit) || !categoryKeys.has(credit.key) || !Number.isFinite(credit.required) || credit.required < 0) errors.push(`${path}.credits[${creditIndex}]: 지원 영역과 0 이상의 required가 필요합니다.`);
    for (const key of ["requiredCourses", "courseOverrides", "substitutions", "certifications", "policies", "sources", "evidence"]) if (!Array.isArray(rule[key])) errors.push(`${path}.${key}: 배열이어야 합니다.`);
  }
  if (pack.basis === "official" && pack.admissionYear > 2026 && (!(pack.offerings?.length) || !(pack.operationalRules?.length))) errors.push(`${context}: 새 공식 학년도에는 offerings와 operationalRules가 모두 필요합니다.`);
  return errors;
}

function packFiles() {
  if (!existsSync(packsRoot)) return [];
  return readdirSync(packsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => resolve(packsRoot, entry.name, "pack.json")).filter(existsSync).sort();
}

function readPack(path) {
  try { return { value: JSON.parse(readFileSync(path, "utf8")), errors: [] }; }
  catch (error) { return { value: null, errors: [`${path}: JSON을 읽을 수 없습니다: ${error instanceof Error ? error.message : String(error)}`] }; }
}

export function buildIndex() {
  const packs = [];
  const errors = [];
  const years = new Set();
  for (const path of packFiles()) {
    const result = readPack(path);
    errors.push(...result.errors);
    if (!result.value) continue;
    errors.push(...validateRulePack(result.value, path));
    if (years.has(result.value.admissionYear)) errors.push(`${path}: 입학년도가 중복되었습니다.`);
    years.add(result.value.admissionYear);
    packs.push(result.value);
  }
  packs.sort((a, b) => a.admissionYear - b.admissionYear);
  return { index: { schemaVersion: "1.0", packs }, errors };
}

const stable = (value) => `${JSON.stringify(value, null, 2)}\n`;

function sync(check) {
  const { index, errors } = buildIndex();
  if (errors.length) throw new Error(errors.join("\n"));
  const next = stable(index);
  if (check) {
    const current = existsSync(generatedPath) ? readFileSync(generatedPath, "utf8") : "";
    if (current !== next) throw new Error("생성 인덱스가 규칙 팩과 다릅니다. rule-pack sync를 실행하세요.");
    return;
  }
  mkdirSync(dirname(generatedPath), { recursive: true });
  const temporaryPath = `${generatedPath}.${process.pid}.tmp`;
  try {
    writeFileSync(temporaryPath, next, { flag: "wx" });
    renameSync(temporaryPath, generatedPath);
  } finally {
    if (existsSync(temporaryPath)) rmSync(temporaryPath);
  }
}

function scaffold(year, fromYear) {
  if (!Number.isInteger(year) || year < 1900 || year > 2200) throw new Error("scaffold 대상 연도는 1900~2200 정수여야 합니다.");
  const target = resolve(packsRoot, String(year), "pack.json");
  if (existsSync(target)) throw new Error(`${year} 규칙 팩이 이미 있습니다.`);
  const available = buildIndex().index.packs.filter((pack) => pack.admissionYear < year);
  const source = fromYear ? available.find((pack) => pack.admissionYear === fromYear) : available.at(-1);
  if (!source) throw new Error("복사할 이전 학년도 규칙 팩이 없습니다.");
  const draft = { ...source, admissionYear: year, basis: "estimated-previous-year", status: "draft", basedOnYear: source.admissionYear, warning: `${year}학번은 ${source.admissionYear}학년도 기준 추정이며 공식 미확인 상태입니다.`, offerings: source.offerings.map((item) => ({ ...item })), operationalRules: [] };
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, stable(draft));
  console.log(target);
}

const [command, arg, ...rest] = process.argv.slice(2);
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (command === "scaffold") scaffold(Number(arg), rest[0] === "--from" ? Number(rest[1]) : undefined);
    else if (command === "validate") { const { errors } = buildIndex(); if (errors.length) throw new Error(errors.join("\n")); console.log("규칙 팩 검증 완료"); }
    else if (command === "sync") { sync(arg === "--check"); console.log(arg === "--check" ? "생성 인덱스 일치" : "생성 인덱스 갱신 완료"); }
    else throw new Error("사용법: rule-pack <scaffold YEAR [--from YEAR] | validate | sync [--check]>");
  } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}
