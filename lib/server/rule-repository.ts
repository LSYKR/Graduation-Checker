import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { ingestionEvents, ruleSets, sourceDocuments } from "@/db/schema";
import { assertValidRuleSet } from "../rule-validator";
import { getRuntimeBindings } from "./runtime-env";
import type { DocumentTargetKey, GraduationRuleSet, IngestionDocument, IngestionStatus, RuleKey, StudentType } from "../types";

function rowToDocument(row: typeof sourceDocuments.$inferSelect): IngestionDocument {
  return {
    id: row.id,
    fileName: row.fileName,
    sourceUrl: row.sourceUrl,
    universityId: row.universityId,
    admissionYear: row.admissionYear,
    transferEntryYear: row.transferEntryYear,
    departmentId: row.departmentId,
    studentType: row.studentType as StudentType,
    status: row.status as IngestionStatus,
    sha256: row.sha256,
    contentType: row.contentType,
    storageKey: row.storageKey,
    candidateVersion: row.candidateVersion,
    candidateRule: row.candidateJson ? JSON.parse(row.candidateJson) as GraduationRuleSet : null,
    validationErrors: JSON.parse(row.validationErrorsJson) as string[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function event(documentId: string, action: string, actor: string, detail: object = {}) {
  await getDb().insert(ingestionEvents).values({
    id: crypto.randomUUID(),
    documentId,
    action,
    actor,
    detailJson: JSON.stringify(detail),
    createdAt: new Date().toISOString(),
  });
}

type CreateSourceDocumentInput = DocumentTargetKey & {
  fileName: string;
  sourceUrl: string | null;
  status: IngestionStatus;
  sha256: string;
  contentType: string;
  bytes: ArrayBuffer;
};

export async function createSourceDocument(input: CreateSourceDocumentInput): Promise<IngestionDocument> {
  const db = getDb();
  const existing = await db.select().from(sourceDocuments).where(eq(sourceDocuments.sha256, input.sha256)).limit(1);
  if (existing[0]) return rowToDocument(existing[0]);

  const id = crypto.randomUUID();
  const entrySegment = input.transferEntryYear ? `transfer-${input.transferEntryYear}` : "non-transfer";
  const storageKey = `official/${input.universityId}/${input.admissionYear}/${entrySegment}/${input.departmentId}/${input.studentType}/${id}/${input.fileName}`;
  const bucket = getRuntimeBindings().BUCKET;
  if (!bucket) throw new Error("Cloudflare R2 binding BUCKET을 사용할 수 없습니다.");
  await bucket.put(storageKey, input.bytes, {
    httpMetadata: { contentType: input.contentType },
    customMetadata: { sha256: input.sha256 },
  });

  const now = new Date().toISOString();
  await db.insert(sourceDocuments).values({
    id,
    fileName: input.fileName,
    sourceUrl: input.sourceUrl,
    universityId: input.universityId,
    admissionYear: input.admissionYear,
    transferEntryYear: input.transferEntryYear ?? null,
    departmentId: input.departmentId,
    studentType: input.studentType,
    status: input.status,
    sha256: input.sha256,
    contentType: input.contentType,
    storageKey,
    candidateVersion: null,
    candidateJson: null,
    validationErrorsJson: "[]",
    createdAt: now,
    updatedAt: now,
  });
  await event(id, "uploaded", "system");
  const [created] = await db.select().from(sourceDocuments).where(eq(sourceDocuments.id, id)).limit(1);
  return rowToDocument(created);
}

export async function listSourceDocuments() {
  return (await getDb().select().from(sourceDocuments).orderBy(desc(sourceDocuments.createdAt)).limit(50)).map(rowToDocument);
}

export async function saveCandidate(id: string, status: IngestionStatus, candidate: GraduationRuleSet | null, errors: string[]) {
  await getDb().update(sourceDocuments).set({
    status,
    candidateVersion: candidate?.version ?? null,
    candidateJson: candidate ? JSON.stringify(candidate) : null,
    validationErrorsJson: JSON.stringify(errors),
    updatedAt: new Date().toISOString(),
  }).where(eq(sourceDocuments.id, id));
  await event(id, status, "system", { errors });
}

export async function reviewSourceDocument(id: string, decision: "approve" | "reject", actor: string) {
  const db = getDb();
  const [row] = await db.select().from(sourceDocuments).where(eq(sourceDocuments.id, id)).limit(1);
  if (!row) throw new Error("검수할 문서를 찾지 못했습니다.");
  if (decision === "reject") {
    await db.update(sourceDocuments).set({ status: "rejected", updatedAt: new Date().toISOString() }).where(eq(sourceDocuments.id, id));
    await event(id, "rejected", actor);
    return;
  }
  if (row.status !== "review_pending" || !row.candidateJson) throw new Error("검수 대기 중인 규칙 후보만 승인할 수 있습니다.");
  const validationErrors = JSON.parse(row.validationErrorsJson) as string[];
  if (validationErrors.length) throw new Error("검증 오류가 있는 규칙 후보는 승인할 수 없습니다.");

  const rule = JSON.parse(row.candidateJson) as GraduationRuleSet;
  if (
    rule.key.universityId !== row.universityId ||
    rule.key.admissionYear !== row.admissionYear ||
    rule.key.departmentId !== row.departmentId
  ) throw new Error("문서 대상의 학교·적용 교육과정·학과와 공통 규칙 선택키가 일치하지 않습니다.");

  const now = new Date().toISOString();
  const approvedRule: GraduationRuleSet = {
    ...rule,
    status: "approved",
    reviewedAt: now.slice(0, 10),
  };
  assertValidRuleSet(approvedRule);
  await db.update(ruleSets).set({ active: false }).where(and(
    eq(ruleSets.universityId, rule.key.universityId),
    eq(ruleSets.admissionYear, rule.key.admissionYear),
    isNull(ruleSets.transferEntryYear),
    eq(ruleSets.departmentId, rule.key.departmentId),
    eq(ruleSets.studentType, "all"),
  ));
  await db.insert(ruleSets).values({
    id: crypto.randomUUID(),
    version: rule.version,
    universityId: rule.key.universityId,
    admissionYear: rule.key.admissionYear,
    transferEntryYear: null,
    departmentId: rule.key.departmentId,
    studentType: "all",
    ruleJson: JSON.stringify(approvedRule),
    sourceDocumentId: id,
    active: true,
    approvedBy: actor,
    approvedAt: now,
  });
  await db.update(sourceDocuments).set({ status: "approved", updatedAt: now }).where(eq(sourceDocuments.id, id));
  await event(id, "approved", actor, { version: rule.version });
}

export async function getActiveRule(key: RuleKey): Promise<GraduationRuleSet | null> {
  const rows = await getDb().select().from(ruleSets).where(and(
    eq(ruleSets.universityId, key.universityId),
    eq(ruleSets.admissionYear, key.admissionYear),
    isNull(ruleSets.transferEntryYear),
    eq(ruleSets.departmentId, key.departmentId),
    eq(ruleSets.studentType, "all"),
    eq(ruleSets.active, true),
  )).orderBy(desc(ruleSets.approvedAt)).limit(2);
  if (rows.length !== 1) return null;
  const rule = JSON.parse(rows[0].ruleJson) as GraduationRuleSet;
  assertValidRuleSet(rule);
  return rule.status === "approved" ? rule : null;
}
