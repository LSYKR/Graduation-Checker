import { DEFAULT_RULE } from "../../domain/curriculum/rule-registry";
import { getTranscriptAdapter, kmouTranscriptAdapter } from "../../adapters/transcripts/index";
import type { GraduationRuleSet, ParseResult } from "../../shared/types/graduation";
export * from "../../domain/graduation/graduation-engine";
export function normalizeTranscriptRows(rows: Record<string, unknown>[], rule: GraduationRuleSet = DEFAULT_RULE) {
  return kmouTranscriptAdapter.normalizeRows(rows, rule);
}

export function parseTranscriptBuffer(buffer: ArrayBuffer, rule: GraduationRuleSet = DEFAULT_RULE): ParseResult {
  return getTranscriptAdapter(rule.key.universityId).parse(buffer, rule);
}
