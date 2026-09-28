import { KMOU_CREDIT_AUDIT_RULES } from "./kmou-program-catalog";
import { assertValidRuleSet } from "./rule-validator";
import { attachVerifiedMajorCourseCatalog } from "./verified-major-curricula";
import { KMOU_PACK_OPERATIONAL_RULES } from "./rule-pack-index";
import type { GraduationRuleSet, RuleKey, StudentProfile } from "../../shared/types/graduation";
export const DEFAULT_PROFILE: StudentProfile = {
  universityId: "kmou",
  admissionYear: 2022,
  transferEntryYear: 2024,
  departmentId: "computer-engineering",
  department: "컴퓨터공학과",
  studentType: "transfer",
  studentTypeLabel: "편입생",
};
export const DEFAULT_RULE = attachVerifiedMajorCourseCatalog(KMOU_PACK_OPERATIONAL_RULES.find((rule) => rule.key.admissionYear === 2022 && rule.key.departmentId === "computer-engineering")!);
assertValidRuleSet(DEFAULT_RULE);
const keyOf = (key: RuleKey) =>
  `${key.universityId}:${key.admissionYear}:${key.departmentId}`;
export class RuleRegistry {
  private readonly rules = new Map<string, GraduationRuleSet>();
  constructor(initial: GraduationRuleSet[] = []) {
    for (const rule of initial) this.register(rule);
  }
  register(rule: GraduationRuleSet) {
    assertValidRuleSet(rule);
    this.rules.set(keyOf(rule.key), rule);
  }
  find(key: RuleKey) {
    return this.rules.get(keyOf(key)) ?? null;
  }
  list() {
    return [...this.rules.values()];
  }
}
// 모든 학과·학번에는 공식 편제학점 기반 1차 규칙을 제공한다. 정확한 입학학년도
// 상세표가 확보된 전공만 같은 키의 과목 카탈로그를 결합한다. 2022 컴퓨터공학의
// 팩의 운영 규칙은 같은 정확 키를 마지막에 등록해 명시적으로 덮어쓴다.
const rulesWithVerifiedCatalogs = KMOU_CREDIT_AUDIT_RULES.map(attachVerifiedMajorCourseCatalog);
export const bundledRuleRegistry = new RuleRegistry([...rulesWithVerifiedCatalogs, ...KMOU_PACK_OPERATIONAL_RULES.map(attachVerifiedMajorCourseCatalog)]);
export const transcriptAdapterRegistry = [
  {
    universityId: "kmou",
    id: "kmou-tis-v1",
    label: "한국해양대학교 종합정보시스템 Excel",
  },
];
