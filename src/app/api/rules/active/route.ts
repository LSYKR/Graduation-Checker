import { errorResponse, json, RequestError } from "@/infrastructure/http/request-utils";
import { bundledRuleRegistry } from "@/domain/curriculum/rule-registry";
import type { RuleKey } from "@/shared/types/graduation";

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    const universityId = query.get("universityId") ?? "kmou";
    const admissionYearText = query.get("admissionYear") ?? "2022";
    const departmentId = query.get("departmentId") ?? "computer-engineering";
    const admissionYear = Number(admissionYearText);
    if (!Number.isInteger(admissionYear) || admissionYear < 1900 || admissionYear > 2100 || !universityId.trim() || universityId.length > 80 || !departmentId.trim() || departmentId.length > 120) throw new RequestError("학교·입학년도·학과 선택값이 잘못되었습니다.");
    const key: RuleKey = { universityId, admissionYear, departmentId };
    const provisional = bundledRuleRegistry.find(key);
    if (provisional && ["approved", "provisional"].includes(provisional.status)) {
      return json({
        rule: provisional,
        source: provisional.status === "approved" ? "bundled-approved" : "bundled-provisional",
        warning: provisional.assurance?.warning ?? "임시 규칙이며 최종 졸업사정이 아닙니다.",
        databaseUnavailable: false,
      });
    }
    return json({ rule: null, source: "not-found", error: "이 프로필에 승인 또는 임시 승인된 규칙이 없습니다." }, 404);
  } catch (error) {
    return errorResponse(error);
  }
}
