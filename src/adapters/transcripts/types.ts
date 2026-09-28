import type { GraduationRuleSet, ParseResult, TranscriptCourse } from "../../shared/types/graduation";
export interface TranscriptAdapter { id: string; universityId: string; normalizeRows(rows: Record<string, unknown>[], rule: GraduationRuleSet): TranscriptCourse[]; parse(buffer: ArrayBuffer, rule: GraduationRuleSet): ParseResult; }
