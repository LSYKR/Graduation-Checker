import { kmouTranscriptAdapter } from "./kmou-tis"; import type { TranscriptAdapter } from "./types";
const adapters = new Map<string, TranscriptAdapter>([[kmouTranscriptAdapter.universityId, kmouTranscriptAdapter]]);
export function getTranscriptAdapter(universityId: string): TranscriptAdapter { const adapter = adapters.get(universityId); if (!adapter) throw new Error(`${universityId}용 성적표 어댑터가 아직 등록되지 않았습니다.`); return adapter; }
export { kmouTranscriptAdapter };
