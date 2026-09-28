import type { StudentProfile, GraduationRuleSet } from "../../shared/types/graduation";
import { assertValidRuleSet } from "../../domain/curriculum/rule-validator";
export async function fetchActiveRule(
  profile: StudentProfile,
): Promise<GraduationRuleSet> {
  const query = new URLSearchParams({
    universityId: profile.universityId,
    admissionYear: String(profile.admissionYear),
    departmentId: profile.departmentId,
  });
  const response = await fetch(`/api/rules/active?${query}`);
  if (!response.ok)
    throw new Error(
      "이 적용 교육과정에 승인 또는 임시 승인된 공통 졸업요건 규칙이 없습니다.",
    );
  const data = (await response.json()) as { rule?: GraduationRuleSet };
  if (!data.rule || !["approved", "provisional"].includes(data.rule.status))
    throw new Error(
      "승인 또는 임시 승인된 공통 졸업요건 규칙만 사용할 수 있습니다.",
    );
  assertValidRuleSet(data.rule);
  if (data.rule.key.universityId !== profile.universityId || data.rule.key.admissionYear !== profile.admissionYear || data.rule.key.departmentId !== profile.departmentId) throw new Error("규칙 선택키가 일치하지 않습니다.");
  return data.rule;
}
