import { getActiveRule } from "@/lib/server/rule-repository";
import { errorResponse, json } from "@/lib/server/request-utils";
import { bundledRuleRegistry } from "@/lib/rule-registry";
import type { GraduationRuleSet, RuleKey } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    const key: RuleKey = {
      universityId: query.get("universityId") ?? "kmou",
      admissionYear: Number(query.get("admissionYear") ?? 2022),
      departmentId: query.get("departmentId") ?? "computer-engineering",
    };
    let stored: GraduationRuleSet | null = null;
    let databaseUnavailable = false;
    try {
      stored = await getActiveRule(key);
    } catch {
      databaseUnavailable = true;
    }
    if (stored) return json({ rule: stored, source: "approved-database" });
    const provisional = bundledRuleRegistry.find(key);
    if (provisional?.status === "provisional") {
      return json({
        rule: provisional,
        source: "bundled-provisional",
        warning: provisional.assurance?.warning ?? "임시 규칙이며 최종 졸업사정이 아닙니다.",
        databaseUnavailable,
      });
    }
    if (databaseUnavailable) throw new Error("승인 규칙 저장소를 확인할 수 없습니다.");
    return json({ rule: null, source: "not-found", error: "이 프로필에 승인 또는 임시 승인된 규칙이 없습니다." }, 404);
  } catch (error) {
    return errorResponse(error);
  }
}
