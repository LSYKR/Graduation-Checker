export const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export function errorResponse(error: unknown) { const message = error instanceof Error ? error.message : "요청을 처리하지 못했습니다."; return json({ error: message }, /권한/.test(message) ? 403 : /찾지|잘못|필요|지원하지/.test(message) ? 400 : 500); }
