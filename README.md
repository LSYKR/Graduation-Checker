# 🎓 졸업나침반 | GradCompass

> **성적표 한 장으로, 졸업까지 남은 요건을 정확하게.**

입학년도·전공·성적표를 공식 교육과정과 대조해 **졸업 준비도, 부족 학점, 미이수 과목**을 보여주는 웹서비스입니다.

[📘 상세 프로젝트 문서](https://app.notion.com/p/In-Progress-3c30dab1221280678ea1f9d1f048e79e?source=copy_link)

## 핵심 기능

- 종합정보시스템 성적표 Excel 자동 분석
- 교과목번호 기반 전공·교양 이수 판정
- 입학년도·전공별 졸업요건 정확 매핑
- 대체과목·초과학점·일반선택 이관 처리
- 다른 전공 성적표 오적용 및 불확실한 판정 차단
- 부족 학점·미이수 과목·다음 행동 시각화

## 동작 방식

```text
학생 정보 입력 → 성적표 업로드 → 공식 졸업요건 대조 → 현재 진행도·남은 요건 확인
```

졸업판정은 LLM의 추측이 아닌 **결정형 규칙 엔진**이 수행합니다. 근거가 부족한 항목은 임의로 판정하지 않고 `확인 필요` 또는 `판정 보류`로 표시합니다.

## Tech Stack

`TypeScript` · `React 19` · `Next.js` · `Vinext` · `Vite` · `Cloudflare Workers` · `D1` · `R2` · `Drizzle ORM` · `SheetJS`

## 현재 지원 범위

**한국해양대학교 해양과학기술융합대학 · 2020~2026학번 · 신입학/편입학**

> 일부 연도·전공은 공식 상세 교육과정 검수 상태에 따라 세부 과목 판정이 보류될 수 있습니다.

## 개인정보 원칙

- 파일은 브라우저 메모리에서만 처리하며 학생 성적 업로드 API를 호출하지 않습니다.
- 학번·성명 열은 파서 결과 모델에 포함하지 않습니다.
- 실제 사용자 성적 파일은 저장소와 배포물에 포함하지 않습니다.
- 최종 졸업사정은 학사과 또는 학과사무실의 확인이 필요합니다.

## 실행 및 검증

```bash
npm install
npm run dev
npm run lint
npm run verify:sources
npm run test:source
npm run test:major-courses
npm run test:stability
npm run evaluate:all-programs
npm run evaluate
npm run evaluate:transcript -- <성적표.xlsx> [예상총학점]
npm run evaluate:transfer-profile -- <성적표.xlsx> [예상편입처리연도]
npm run build
```

## Roadmap

1. **Local LLM / LLM API 연결**  
   저장된 공식 규칙과 판정 결과를 기반으로 개인화된 설명·수강 방향 제공

2. **한국해양대학교 전체 학과 적용**  
   단과대학과 전공별 교육과정·졸업인증 규칙 확장

3. **다른 대학교로 확장**  
   학교별 성적표 어댑터와 규칙 패키지를 추가하는 멀티테넌트 구조 완성

---

> 본 서비스는 졸업 준비를 돕기 위한 참고 도구입니다. 최종 졸업 가능 여부는 학교의 공식 졸업사정을 기준으로 합니다.
