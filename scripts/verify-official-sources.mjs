import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const hash = async (path) => createHash("sha256").update(await readFile(path)).digest("hex");
const official = (value) => {
  if (!value) return true;
  const host = new URL(value).hostname.toLowerCase();
  return host === "kmou.ac.kr" || host.endsWith(".kmou.ac.kr");
};

const manifest = await readJson("data/sources/kmou/source-manifest.json");
assert.equal(manifest.policy.hashAlgorithm, "SHA-256");

for (const document of manifest.documents) {
  assert.ok(official(document.noticeUrl), `${document.documentId}: unofficial notice URL`);
  assert.ok(official(document.attachmentUrl), `${document.documentId}: unofficial attachment URL`);
  if (!document.localPath) continue;
  const absolute = resolve(root, document.localPath);
  const fileStat = await stat(absolute);
  assert.equal(fileStat.size, document.byteSize, `${document.documentId}: byte size mismatch`);
  assert.equal(await hash(absolute), document.sha256, `${document.documentId}: hash mismatch`);
}

const years = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
for (const year of years) {
  const candidate = await readJson(`data/rule-candidates/kmou/${year}/computer-engineering/curriculum/0.2.0.json`);
  assert.equal(candidate.status, "review", `${year}: candidate must not be approved`);
  assert.equal(candidate.selector.admissionYear, year);
  assert.equal(candidate.selector.studentType, undefined);
  assert.equal(candidate.selector.departmentId, "computer-engineering");
  assert.deepEqual(candidate.eligibilityRules.find((item) => item.goal === "regular")?.eligibleStudentTypes, ["freshman", "transfer"]);
  const sum = candidate.creditRequirements.reduce((total, item) => total + item.minimum, 0);
  assert.equal(sum, candidate.requiredTotalCredits, `${year}: credit sum mismatch`);
  assert.ok(candidate.sources.every((source) => source.fileHash?.startsWith("sha256:")), `${year}: unpinned candidate source`);
  assert.ok(candidate.generalEducationAreas.length > 0, `${year}: missing verified general-education area map`);
}

const coverage = await readJson("data/rule-candidates/kmou/coverage-2020-2026.json");
assert.equal(coverage.records.length, 7);
assert.equal(coverage.records.find((record) => record.curriculumYear === 2022).curriculumRule.operationalRule, "provisional");
assert.ok(coverage.records.filter((record) => record.curriculumYear !== 2022).every((record) => record.curriculumRule.operationalRule === "blocked"));
assert.ok(coverage.records.every((record) => record.transferApplication.usesSameCurriculumRule === true));
assert.ok(coverage.records.every((record) => record.transferApplication.separateTransferGraduationRule === false));

const transferOverlay = await readJson("data/policy-overlays/kmou/transfer/2024/0.1.0.json");
assert.equal(transferOverlay.status, "review");
assert.equal(transferOverlay.selector.transferEntryYear, 2024);
assert.equal(transferOverlay.selector.studentType, "transfer");
assert.equal(transferOverlay.composition.graduationRuleSelector.admissionYear, 2022);
assert.equal(transferOverlay.composition.separateTransferGraduationRule, false);
assert.equal(transferOverlay.creditRecognition.earlyGraduationAllowed, false);
assert.ok(transferOverlay.sources.every((source) => source.fileHash?.startsWith("sha256:")), "transfer overlay: unpinned source");

console.log(`Verified ${manifest.documents.filter((item) => item.localPath).length} local official files, ${years.length} shared curriculum candidates, and 1 transfer overlay.`);
