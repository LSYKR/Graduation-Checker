import { runGeneralAssistant } from "@/application/services/assistant-service";
import { validAssistantSummary } from "@/domain/graduation/assistant-summary";
import { errorResponse, json, protectRequest, readLimitedBytes, RequestError } from "@/infrastructure/http/request-utils";
import type { RuleKey } from "@/shared/types/graduation";
import { loadEnvironment } from "@/shared/config/environment";
export async function GET() { const config = loadEnvironment(); return json({ configured: config.provider !== "disabled", provider: config.provider, privacy: "question-and-minimal-summary-local-only" }); }
export async function POST(request: Request) {
  try {
    protectRequest(request, "assistant");
    const bytes = await readLimitedBytes(request, 8192);
    let body: unknown;
    try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new RequestError("JSON 요청이 필요합니다."); }
    const exact = (value: unknown, fields: string[]): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === fields.length && Object.keys(value).every(field => fields.includes(field));
    if (!exact(body, ["question", "key", "summary"]) || typeof body.question !== "string" || !body.question.trim() || body.question.length > 1200 || !exact(body.key, ["universityId", "admissionYear", "departmentId"]) || typeof body.key.universityId !== "string" || !Number.isInteger(body.key.admissionYear) || typeof body.key.departmentId !== "string" || !validAssistantSummary(body.summary, body.key as unknown as RuleKey)) throw new RequestError("질문과 유효한 최소 진단 요약이 필요합니다.");
    return json(await runGeneralAssistant(body.question.trim(), body.key as unknown as RuleKey, body.summary));
  } catch(error) { return errorResponse(error); }
}
