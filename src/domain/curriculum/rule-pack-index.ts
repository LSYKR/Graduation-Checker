import generated from "@/generated/kmou-rule-pack-index.json";
import type { GraduationRuleSet } from "../../shared/types/graduation";

export type RulePackBasis = "official" | "estimated-previous-year";
export interface RulePackAvailability {
  admissionYear: number;
  basis: RulePackBasis;
  status: "active" | "draft";
  basedOnYear?: number;
  warning?: string;
}

interface GeneratedOffering {
  programId: string;
  displayName: string;
  currentUnit: string;
  curriculumCollegeName: "해양과학기술대학" | "공과대학" | "해양과학기술융합대학";
  batch: "digital" | "ocean-development" | "ocean-science" | "infrastructure";
  support: "credit-audit" | "partial-course-audit" | "detailed-provisional";
  creditSummary: Record<string, number>;
}

interface GeneratedPack extends RulePackAvailability {
  universityId: "kmou";
  offerings: GeneratedOffering[];
  operationalRules: GraduationRuleSet[];
}

export const KMOU_RULE_PACKS = generated.packs as GeneratedPack[];
export const KMOU_RULE_PACK_AVAILABILITY: RulePackAvailability[] = KMOU_RULE_PACKS.map(({ admissionYear, basis, status, basedOnYear, warning }) => ({ admissionYear, basis, status, basedOnYear, warning }));
export const KMOU_SUPPORTED_ADMISSION_YEARS = KMOU_RULE_PACKS.map((pack) => pack.admissionYear).sort((a, b) => b - a);
export const KMOU_PACK_OPERATIONAL_RULES = KMOU_RULE_PACKS.filter((pack) => pack.basis === "official" && pack.status === "active").flatMap((pack) => pack.operationalRules);

export function getKmouRulePackAvailability(admissionYear: number): RulePackAvailability | null {
  return KMOU_RULE_PACK_AVAILABILITY.find((pack) => pack.admissionYear === admissionYear) ?? null;
}

export function getGeneratedKmouOfferings(admissionYear?: number): Array<GeneratedOffering & { admissionYear: number }> {
  return KMOU_RULE_PACKS.filter((pack) => admissionYear === undefined || pack.admissionYear === admissionYear).flatMap((pack) => pack.offerings.map((offering) => ({ ...offering, admissionYear: pack.admissionYear })));
}
