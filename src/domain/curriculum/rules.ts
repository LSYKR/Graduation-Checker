import { DEFAULT_RULE } from "./rule-registry";
export const officialSources = DEFAULT_RULE.sources;
export const RULESET_VERSION = DEFAULT_RULE.version;
export const ruleNotes = [...DEFAULT_RULE.courseOverrides.map((item) => `${item.courseCode}: ${item.reason}`), ...DEFAULT_RULE.substitutions.map((item) => `${item.requiredCode} 대체과목 ${item.substituteCodes.join(", ")}: ${item.note}`), ...DEFAULT_RULE.policies];
