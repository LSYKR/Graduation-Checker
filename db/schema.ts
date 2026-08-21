import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const sourceDocuments = sqliteTable("source_documents", {
  id: text("id").primaryKey(),
  fileName: text("file_name").notNull(),
  sourceUrl: text("source_url"),
  universityId: text("university_id").notNull(),
  admissionYear: integer("admission_year").notNull(),
  transferEntryYear: integer("transfer_entry_year"),
  departmentId: text("department_id").notNull(),
  studentType: text("student_type").notNull(),
  status: text("status").notNull(),
  sha256: text("sha256").notNull(),
  contentType: text("content_type").notNull(),
  storageKey: text("storage_key").notNull(),
  candidateVersion: text("candidate_version"),
  candidateJson: text("candidate_json"),
  validationErrorsJson: text("validation_errors_json").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("source_documents_sha256_unique").on(table.sha256)]);

export const ruleSets = sqliteTable("rule_sets", {
  id: text("id").primaryKey(),
  version: text("version").notNull().unique(),
  universityId: text("university_id").notNull(),
  admissionYear: integer("admission_year").notNull(),
  transferEntryYear: integer("transfer_entry_year"),
  departmentId: text("department_id").notNull(),
  studentType: text("student_type").notNull(),
  ruleJson: text("rule_json").notNull(),
  sourceDocumentId: text("source_document_id").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(false),
  approvedBy: text("approved_by").notNull(),
  approvedAt: text("approved_at").notNull(),
});

export const ingestionEvents = sqliteTable("ingestion_events", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull(),
  action: text("action").notNull(),
  actor: text("actor").notNull(),
  detailJson: text("detail_json").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
});
