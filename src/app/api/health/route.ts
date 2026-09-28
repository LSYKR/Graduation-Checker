import { loadEnvironment } from "@/shared/config/environment";
import { bundledRuleRegistry } from "@/domain/curriculum/rule-registry";
export const dynamic = "force-dynamic";
export async function GET() {
  try { loadEnvironment(); if (!bundledRuleRegistry.list().length) throw new Error(); return Response.json({status:"ok",service:"kmou-grad-check"},{headers:{"Cache-Control":"no-store"}}); }
  catch {return Response.json({status:"unhealthy"},{status:503});}
}
