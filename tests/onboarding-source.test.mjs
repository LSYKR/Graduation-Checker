import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const onboardingConfig = await readFile(new URL("../lib/onboarding.ts", import.meta.url), "utf8");
const onboardingView = await readFile(new URL("../components/onboarding-view.tsx", import.meta.url), "utf8");
const programSearch = await readFile(new URL("../components/program-search-select.tsx", import.meta.url), "utf8");
const appRoot = await readFile(new URL("../components/graduation-app.tsx", import.meta.url), "utf8");
const onboardingComplete = await readFile(new URL("../components/onboarding-complete.tsx", import.meta.url), "utf8");
const dashboard = await readFile(new URL("../components/dashboard-app.tsx", import.meta.url), "utf8");
const planner = await readFile(new URL("../components/views/planner-view.tsx", import.meta.url), "utf8");
const onboardingCss = await readFile(new URL("../app/onboarding.css", import.meta.url), "utf8");
const globalCss = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("온보딩 지원 학번은 2020~2026으로 제한된다", () => {
  assert.match(onboardingConfig, /\[2026, 2025, 2024, 2023, 2022, 2021, 2020\]/);
});

test("다른 학교는 준비 중으로 유지하고 학과는 학번별 카탈로그에서 만든다", () => {
  assert.match(onboardingConfig, /다른 대학교 · 준비 중/);
  assert.match(onboardingView, /ProgramSearchSelect/);
  assert.match(programSearch, /searchKmouProgramOptions\(admissionYear, query\)/);
  assert.match(onboardingView, /disabled=\{!option\.supported\}/);
});

test("조건 설정은 저장된 개인값이나 특정 학번·전공·입학 구분을 자동 입력하지 않는다", () => {
  assert.doesNotMatch(onboardingView, /initialProfile/);
  assert.match(onboardingView, /useState<number \| null>\(null\)/);
  assert.match(onboardingView, /useState<string>\(""\)/);
  assert.match(onboardingView, /useState<SupportedStudentType \| "">\(""\)/);
  assert.match(programSearch, /학번을 먼저 선택해주세요/);
  assert.doesNotMatch(appRoot, /initialProfile=/);
});

test("검색 입력은 전공 선택에만 적용되고 키보드·스크린리더용 콤보박스 동작을 제공한다", () => {
  assert.match(programSearch, /role="combobox"/);
  assert.match(programSearch, /role="listbox"/);
  assert.match(programSearch, /aria-activedescendant/);
  assert.match(programSearch, /ArrowDown/);
  assert.match(programSearch, /ArrowUp/);
  assert.match(programSearch, /event\.key === "Enter"/);
  assert.match(programSearch, /event\.key === "Escape"/);
  assert.match(onboardingView, /이름·과거 명칭 검색/);
  assert.doesNotMatch(onboardingView, /학교 검색|단과대학 검색|입학년도 검색/);
});

test("왼쪽 안내는 네 단계 워크플로우로 표시하고 하단 버전 문구를 노출하지 않는다", () => {
  assert.doesNotMatch(onboardingView, /<h1>졸업요건 체크<\/h1>/);
  assert.match(onboardingView, /학생 정보 입력/);
  assert.match(onboardingView, /성적표 업로드/);
  assert.match(onboardingView, /졸업요건 대조/);
  assert.match(onboardingView, /결과 확인/);
  assert.doesNotMatch(onboardingView, /onboarding-version/);
  assert.match(onboardingCss, /onboarding-workflow[^}]+margin-top: 24px/);
  assert.match(onboardingCss, /onboarding-trust-list[^}]+margin-top: clamp\(34px, 4\.5vh, 52px\)/);
  assert.doesNotMatch(onboardingCss, /onboarding-trust-list[^}]+margin-top: auto/);
});

test("졸업 목표와 우선 조회 목적은 빈 값에서 선택하고 완료 후 화면에 연결한다", () => {
  assert.match(onboardingConfig, /GRADUATION_GOAL_OPTIONS/);
  assert.match(onboardingConfig, /GRADUATION_INTEREST_OPTIONS/);
  assert.match(onboardingView, /useState<GraduationGoal \| "">\(""\)/);
  assert.match(onboardingView, /useState<GraduationInterest \| "">\(""\)/);
  assert.match(onboardingView, /가장 먼저 알고 싶은 내용/);
  assert.match(onboardingView, /편입학은 선택할 수 없습니다/);
  assert.match(appRoot, /course-recommendations/);
  assert.match(appRoot, /schedule-optimization/);
  assert.match(appRoot, /initialView=\{initialView\}/);
  assert.match(onboardingComplete, /graduationGoalLabel/);
  assert.match(onboardingComplete, /graduationInterestLabel/);
});

test("수강설계는 컴퓨터공학 고정 목록 대신 현재 판정의 남은 요건을 사용한다", () => {
  assert.match(planner, /audit\.missingCourses/);
  assert.match(planner, /audit\.generalEducation\?\.areas/);
  assert.match(planner, /audit\.courseMatch\?\.pendingCourseRecognitions/);
  assert.match(planner, /audit\.overallStatus === "evaluated"/);
  assert.doesNotMatch(planner, /const recommendations = \[/);
  assert.doesNotMatch(planner, /55254/);
});

test("졸업진단 작업영역은 고정 최대폭 없이 첫 화면과 같은 비율로 확장한다", () => {
  assert.match(globalCss, /\.content-wrap \{ width: calc\(100% - 48px\)/);
  assert.doesNotMatch(globalCss, /\.content-wrap \{ width: min\(1260px/);
  assert.match(globalCss, /@media \(min-width: 1081px\)/);
});

test("넓은 화면의 졸업진단은 글자·수치·그래프를 함께 확대한다", () => {
  assert.match(globalCss, /Wide-screen graduation audit readability/);
  assert.match(globalCss, /@media \(min-width: 1280px\)/);
  assert.match(globalCss, /\.score-ring \{ width: 180px; height: 180px; \}/);
  assert.match(globalCss, /\.progress-track \{ height: 9px;/);
  assert.match(globalCss, /\.category-label strong \{ font-size: 13px; \}/);
  assert.match(globalCss, /\.ge-progress-heading strong \{ font-size: 20px; \}/);
});

test("온보딩 파일은 정확한 학번·전공 규칙으로 파생 요약을 만들고 원본은 저장하지 않는다", () => {
  assert.match(onboardingView, /auditTranscript/);
  assert.match(onboardingView, /bundledRuleRegistry\.find/);
  assert.match(onboardingView, /departmentId/);
  assert.match(onboardingView, /파생된 학점·교양영역 요약만 저장합니다/);
});

test("원본 성적표 대신 메타데이터와 파생 판정 요약만 브라우저 저장한다", () => {
  assert.match(onboardingConfig, /OnboardingTranscriptMetadata/);
  assert.match(onboardingConfig, /schemaVersion: 9/);
  assert.match(onboardingConfig, /kmou-grad-onboarding-v9/);
  assert.match(onboardingConfig, /kmou-grad-onboarding-v8/);
  assert.match(appRoot, /parsed\.schemaVersion === 8/);
  assert.match(appRoot, /for \(const storageKey of/);
  assert.match(onboardingConfig, /AUDIT_ENGINE_VERSION/);
  assert.match(onboardingView, /fileHash: await sha256/);
  assert.match(onboardingView, /transferRecognition: summary\.transferRecognition/);
  assert.match(onboardingView, /provisionalAudit:/);
  assert.match(appRoot, /window\.localStorage\.setItem/);
  assert.doesNotMatch(appRoot, /arrayBuffer|FileReader/);
  assert.match(appRoot, /courses: \[\]/);
});

test("편입생의 적용 교육과정 연도와 편입 처리 연도를 분리한다", () => {
  assert.match(onboardingConfig, /curriculumYear/);
  assert.match(onboardingConfig, /transferEntryYear/);
  assert.match(onboardingView, /편입 인정학점은 같은 교육과정에 합산합니다/);
  assert.match(onboardingView, /인정 한도는 별도로 확인합니다/);
  assert.match(onboardingView, /transcript\.transferRecognition\.years\[0\]/);
});

test("전공 지문이 부족하면 퍼센트를 닫고, 충분하면 영역별 학점 진단만 연다", () => {
  assert.match(onboardingComplete, /수강 설계 열기/);
  assert.match(onboardingComplete, /졸업 진단 보기/);
  assert.match(onboardingComplete, /전체 졸업 준비도 퍼센트를 판정하지 않습니다/);
  assert.match(onboardingComplete, /availability\.operational === "provisional"/);
  assert.match(appRoot, /DashboardApp initialAudit/);
  assert.match(dashboard, /교양 세부영역 이수 현황/);
  assert.match(dashboard, /안전 모드 · 전체 판정 보류/);
  assert.match(dashboard, /전공 선택 불일치가 의심됩니다/);
  assert.match(dashboard, /학년도·전공 적용/);
  assert.match(dashboard, /영역별 학점 판정/);
  assert.match(onboardingComplete, /전공 고유 과목명이 충분히 일치/);
});

test("온보딩은 상세 110개와 2025~2026 부분 42개 조합의 판정 범위를 명확히 안내한다", () => {
  assert.match(onboardingView, /2020~2024학번은 각 학번 22개 전공/);
  assert.match(onboardingView, /2020학번은 당시 해양과학기술대학·공과대학 구분/);
  assert.match(onboardingView, /공식 1학기 표 범위만 판정/);
  assert.match(onboardingView, /2025·2026학번은 공식 신입생 1학기 표 범위만 적용/);
  assert.match(onboardingView, /그 밖의 개별 미이수 과목은 확정하지 않습니다/);
});
