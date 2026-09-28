export const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
export class RequestError extends Error { constructor(message: string, public status = 400) { super(message); } }
export function errorResponse(error: unknown) {
  if (error instanceof RequestError) return json({ error: error.message }, error.status);
  if (error instanceof Error && error.message === "관리자 권한이 없습니다.") return json({ error: error.message }, 403);
  console.error(JSON.stringify({ event: "request_failed", code: "INTERNAL_ERROR" }));
  return json({ error: "요청을 처리하지 못했습니다." }, 500);
}
export async function readLimitedBytes(response: Response | Request, max: number) {
  if (Number(response.headers.get("content-length")) > max) throw new RequestError("요청 크기 제한을 초과했습니다.", 413);
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let length = 0, timedOut = false;
  const timer = setTimeout(() => { timedOut = true; void reader.cancel(); }, 15000);
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (timedOut) throw new RequestError("요청 시간이 초과되었습니다.", 408);
      if (done) break;
      length += value.byteLength;
      if (length > max) { await reader.cancel(); throw new RequestError("요청 크기 제한을 초과했습니다.", 413); }
      chunks.push(value);
    }
  } finally { clearTimeout(timer); reader.releaseLock(); }
  const result = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}
export async function readJsonBody(request: Request, max: number): Promise<unknown> {
  const bytes = await readLimitedBytes(request, max);
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new RequestError("JSON 요청이 필요합니다."); }
}

const windows = new Map<string, { start: number; count: number }>();
const MAX_RATE_LIMIT_WINDOWS = 2048;
function trustedClientKey(request: Request) {
  // Cloudflare supplies `request.cf` and overwrites CF-Connecting-IP at its edge.
  // Outside that runtime, forwarded headers are untrusted and callers share the
  // conservative process-local fallback bucket.
  const cloudflareRequest = request as Request & { cf?: unknown };
  const address = cloudflareRequest.cf ? request.headers.get("cf-connecting-ip")?.trim() : "";
  return address && address.length <= 64 ? address : "shared";
}
export function protectRequest(request: Request, bucket: string, limit = 30) {
  const origin = request.headers.get("origin");
  if (origin && origin !== (process.env.APP_ORIGIN || new URL(request.url).origin)) throw new RequestError("허용하지 않는 요청 출처입니다.", 403);
  const now = Date.now(), key = `${bucket}:${trustedClientKey(request)}`; let window = windows.get(key);
  if (!window || now - window.start >= 60000) {
    if (windows.size >= MAX_RATE_LIMIT_WINDOWS) {
      for (const [entryKey, entry] of windows) if (now - entry.start >= 60000) windows.delete(entryKey);
      while (windows.size >= MAX_RATE_LIMIT_WINDOWS) windows.delete(windows.keys().next().value as string);
    }
    window = { start: now, count: 0 }; windows.set(key, window);
  }
  if (++window.count > limit) throw new RequestError("잠시 후 다시 요청해주세요.", 429);
}
