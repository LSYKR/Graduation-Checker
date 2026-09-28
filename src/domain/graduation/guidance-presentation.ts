/** Display summaries only; original evidence stays in the audit and disclosures. */
export function conciseCourseReason(reason: string, status: 'required' | 'candidate' | 'review' | 'completed' = 'required'): string {
  if (/학생 직접 미이수 확인|이전학교 포함 미이수로 직접 확인/.test(reason)) return '이전학교 포함 미이수로 직접 확인 · 수강 필요';
  if (/필수 지정 확인 · 성적표/.test(reason)) return '필수 지정 확인 · 성적표 이수내역 없음 · 이전학교에서도 미이수라면 수강 필요';
  if (status === 'completed') return '이수 또는 확인된 대체 이수로 반영된 과목입니다.';
  if (/충돌|상충|자료의 내용이 달라/.test(reason)) return '공식 자료의 내용이 달라 학과 확인이 필요합니다.';
  if (/편입/.test(reason)) return '과목별 편입 인정 여부를 확인하세요. 면제나 미이수는 확정하지 않았습니다.';
  if (/승인|대체|pending-substitution/.test(reason) && status === 'review') return '대체 인정과 승인 여부를 확인하세요. 승인 전에는 충족으로 확정하지 않습니다.';
  if (/미확인|불명|지정.*확인|검토/.test(reason)) return '필수 지정 또는 인정 근거를 추가로 확인해야 합니다.';
  if (status === 'review') return '과목별 인정 근거를 확인해야 합니다. 이수 필요 여부는 보류 중입니다.';
  if (status === 'candidate') return /합산/.test(reason) ? '연결 영역의 합산 기준을 채울 수 있는 선택 후보입니다.' : '영역 최소학점을 채우는 선택 후보입니다. 후보 전체를 이수할 의무는 없습니다.';
  return '교육과정에서 확인된 개별 필수 요건입니다.';
}
export function guidanceGapSummary(gaps: string[]): string {
  if (gaps.some(g => /불일치/.test(g))) return '선택 전공과 성적표를 확인하세요. 개인 이수 필요 여부는 보류 중입니다.';
  if (gaps.some(g => /충돌|상충|자료 간 차이/.test(g))) return '공식 자료 간 차이가 있습니다. 학과에 해당 과목의 필수 지정과 인정 여부를 확인하세요.';
  if (gaps.some(g => /편입/.test(g))) return '편입 인정 총량과 개별 필수과목 면제는 다릅니다. 과목별 인정 연결을 확인하세요.';
  if (gaps.some(g => /전체|필수.*목록|개별 필수/.test(g))) return '전체 필수과목 목록은 추가 확인이 필요합니다. 표시된 과목만으로 전체 요건 충족을 판단하지 마세요.';
  return '일부 과목·영역의 요건이나 인정 근거를 추가로 확인해야 합니다. 자세한 확인 항목은 아래에서 볼 수 있습니다.';
}
type GuidanceTextInput = { remaining: { name: string; credits: number; reason: string }[]; pools: { label?: string; condition: string; review: boolean; candidates: { name: string; reason: string }[] }[]; recognitionReview: { name: string; reason: string; recognitionKind?: string; requirementDesignation?: string }[]; dataGaps: string[] };
export function conciseGuidanceText(g: GuidanceTextInput): string {
  const sections = [g.remaining.length ? `확인된 남은 필수과목\n${g.remaining.slice(0, 5).map(c => `• ${c.name} · ${c.credits}학점 — ${conciseCourseReason(c.reason)}`).join('\n')}` : '확인된 남은 필수과목 없음. 전체 목록의 확인 여부는 자료 안내를 함께 확인하세요.'];
  const pools = g.pools.filter(p => p.candidates.length).slice(0, 3);
  if (pools.length) sections.push(`영역 선택 후보\n${pools.map(p => `• ${p.condition}${p.review ? ' · 인정 검토 필요, 확정 부족량 아님' : ''}\n  후보: ${p.candidates.slice(0, 3).map(c => c.name).join(', ')}`).join('\n')}`);
  if (g.recognitionReview.length) sections.push(`대체·편입 인정 확인\n${g.recognitionReview.slice(0, 3).map(c => `• ${c.name} — ${guidanceItemReason(c, 'review')}`).join('\n')}`);
  if (g.dataGaps.length) sections.push(`확인할 자료\n${guidanceGapSummary(g.dataGaps)}`);
  sections.push('일부 과목·후보를 우선 안내합니다. 전체 과목·후보와 정확한 판정 근거는 대시보드에서 확인하세요. 이번 학기 개설·분반은 미확인입니다.');
  return sections.join('\n\n');
}

export function guidanceItemReason(c: { reason: string; recognitionKind?: string; requirementDesignation?: string }, status: 'required' | 'candidate' | 'review' | 'completed' = 'required'): string {
  return c.recognitionKind === 'transfer-recognition-unresolved' && c.requirementDesignation === 'confirmed' && !/학생 직접 미이수 확인/.test(c.reason) ? '필수 지정 확인 · 성적표 이수내역 없음 · 이전학교에서도 미이수라면 수강 필요' : conciseCourseReason(c.reason, status);
}
