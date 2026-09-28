import { ChevronRight } from "lucide-react";

const steps = [
  ["종합정보시스템 로그인", "학교 계정으로 접속합니다."],
  ["학사 → 성적 → 전체성적조회", "전체 학기 성적을 엽니다."],
  ["상세정보 선택", "교과목별 표가 보이는지 확인합니다."],
  ["Excel 다운로드", "파일을 수정하지 않고 그대로 저장합니다."],
] as const;

export default function TranscriptDownloadGuide({ compact = false }: { compact?: boolean }) {
  return (
    <section className={compact ? "transcript-guide-compact" : "card guide-card"} aria-labelledby={compact ? "onboarding-transcript-guide-title" : "transcript-guide-title"}>
      {!compact && <span className="card-kicker">DOWNLOAD GUIDE</span>}
      <h2 id={compact ? "onboarding-transcript-guide-title" : "transcript-guide-title"}>성적표 받는 방법</h2>
      {compact ? (
        <p>종합정보시스템 로그인 → 학사 → 성적 → 전체성적조회 → 상세정보 선택 → Excel 다운로드. 내려받은 <strong>.xlsx 또는 .xls</strong> 파일을 선택하세요.</p>
      ) : (
        <ol>
          {steps.map(([title, description], index) => (
            <li key={title}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{title}</strong><small>{description}</small></div></li>
          ))}
        </ol>
      )}
      <a href="https://tis.kmou.ac.kr" target="_blank" rel="noopener noreferrer" aria-label="종합정보시스템 열기 (새 창)">종합정보시스템 열기 <ChevronRight size={14} aria-hidden="true" /></a>
    </section>
  );
}
