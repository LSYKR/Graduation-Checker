import { drizzle } from "drizzle-orm/d1"; import * as schema from "./schema"; import { getRuntimeBindings } from "@/lib/server/runtime-env";
export function getDb() { const db = getRuntimeBindings().DB; if (!db) throw new Error("Cloudflare D1 binding DB를 사용할 수 없습니다."); return drizzle(db, { schema }); }
