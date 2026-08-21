import type { GraduationRuleSet, ParseResult, TranscriptCourse } from "../types";
export interface TranscriptAdapter { id: string; universityId: string; normalizeRows(rows: Record<string, unknown>[], rule: GraduationRuleSet): TranscriptCourse[]; parse(buffer: ArrayBuffer, rule: GraduationRuleSet): ParseResult; }
