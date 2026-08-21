CREATE TABLE `ingestion_events` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`action` text NOT NULL,
	`actor` text NOT NULL,
	`detail_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rule_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`version` text NOT NULL,
	`university_id` text NOT NULL,
	`admission_year` integer NOT NULL,
	`department_id` text NOT NULL,
	`student_type` text NOT NULL,
	`rule_json` text NOT NULL,
	`source_document_id` text NOT NULL,
	`active` integer DEFAULT false NOT NULL,
	`approved_by` text NOT NULL,
	`approved_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rule_sets_version_unique` ON `rule_sets` (`version`);--> statement-breakpoint
CREATE TABLE `source_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`file_name` text NOT NULL,
	`source_url` text,
	`university_id` text NOT NULL,
	`admission_year` integer NOT NULL,
	`department_id` text NOT NULL,
	`student_type` text NOT NULL,
	`status` text NOT NULL,
	`sha256` text NOT NULL,
	`content_type` text NOT NULL,
	`storage_key` text NOT NULL,
	`candidate_version` text,
	`candidate_json` text,
	`validation_errors_json` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_documents_sha256_unique` ON `source_documents` (`sha256`);