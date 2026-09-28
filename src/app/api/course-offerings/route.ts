import { getActiveOfferingSnapshot } from "@/domain/courses/offering-snapshot";
import { json } from "@/infrastructure/http/request-utils";

export async function GET(request: Request) {
  const term = new URL(request.url).searchParams.get("term") ?? "";
  if (!/^\d{4}-[12]$/.test(term)) return json({ error: "학기를 YYYY-1 또는 YYYY-2 형식으로 지정하세요." }, 400);
  const snapshot = getActiveOfferingSnapshot(term);
  if (!snapshot) return json({ snapshot: null });
  return json({ snapshot: { term: snapshot.term, status: snapshot.status, provenance: snapshot.provenance, sections: snapshot.sections } });
}
