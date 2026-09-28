# 전공 교육과정 후보 가져오기

이 도구는 공식 원본 PDF/XLSX와 사람이 정규화한 JSON을 함께 검증한다. 수업 개설표·시간표는 교육과정 증거로 사용하지 않는다. 결과는 검토 후보이며 졸업 규칙, 카탈로그, UI를 자동 변경하지 않는다.

```sh
sha256sum /path/to/original.pdf
node --import ./scripts/test-register.mjs scripts/import-major-curriculum.ts /path/to/normalized.json /tmp/curriculum-review
```

Node 및 프로젝트 의존성이 필요하다. PDF는 `pdftotext`가 필요하며 매 실행 원본에서 `-layout` 텍스트를 다시 추출한다. 별도 제공된 텍스트 파일은 신뢰하지 않는다. 파일 경로는 JSON 파일 디렉터리 기준이다. 출력은 `candidate.json`, `report.json`이며 기존 파일을 덮어쓰지 않는다.

```json
{
  "key": {"universityId":"kmou","admissionYear":2025,"departmentId":"radio-mobility-convergence-engineering"},
  "source": {
    "file":"original.pdf",
    "sha256":"원본 바이트의 소문자 SHA-256 64자리",
    "officialUrl":"https://www.kmou.ac.kr/공식첨부주소",
    "title":"2025학년도 전파모빌리티융합공학전공 교육과정표",
    "year":2025,
    "program":"전파모빌리티융합공학전공",
    "documentKind":"curriculum",
    "scope":"program-curriculum"
  },
  "rows":[{
    "code":"51338","name":"전자기학 I","credits":3,
    "category":"majorRequired","required":true,
    "semester":"2학년 1학기",
    "evidence":{"page":1,"locator":"1쪽 전공필수 51338 행"}
  }]
}
```

`program`은 해당 학번·전공의 등록된 표시명 또는 ` · ` 뒤의 정확한 전공명을 사용한다. `category`는 `majorFoundation`, `majorRequired`, `majorElective` 중 하나이다. 코드의 대문자와 선행 0을 보존한다. 이름 유사도나 다른 학번의 자료로 대응하지 않는다. `required`는 반드시 `true`, `false`, `null` 중 하나이며 불명확한 경우 `null`로 보류한다. `majorRequired`만 구분 자체가 필수 지정 근거가 된다. `majorElective`의 `false`는 필수로 지정되지 않았다는 뜻이며 자유 선택을 보증하지 않는다. `majorFoundation`의 필수 여부는 구분만으로 증명하지 않으며 명시적인 정책 근거를 별도 검토할 때까지 보류한다. 위 예시는 형식 예시이며 실제 원본 경로·해시·공식 URL·행을 입력해야 한다.

XLSX 증거는 `{"sheet":"교육과정","row":12,"columns":{"code":1,"name":2,"credits":3,"category":4,"program":5,"year":6},"locator":"교육과정!12"}`처럼 실제 시트명과 1부터 시작하는 행·각 열 번호를 지정한다. 검증된 표 경계를 따로 제공하지 않으므로 여섯 열은 서로 다르고 연속해야 하며, 원본 행의 다른 열에 값이 있으면 인접 표·추가 구분을 배제할 수 없어 보류한다. 여섯 열에서 해당 원본 행에서 코드·이름·이수구분·학점·전공·교육과정 연도가 정확히 일치해야 한다. 원본이 머리말에만 전공·연도를 두는 XLSX는 현재 보수적으로 거절한다. PDF는 지정 페이지의 교육과정 연도가 정확히 일치하고 혼합 연도가 없어야 하며 같은 물리적 행에 정확한 전공 접두어·코드·이름·구분·학점/이론/실습이 일치해야 한다. 나란한 표나 모호한 행은 보류한다. 추출 과정에서 줄바꿈된 표는 보수적으로 거절될 수 있으므로 원본과 추출 결과를 검토한다.

동일 코드의 동일 이름·학점·구분·필수 여부는 학기와 원본 위치를 합친다. 중복 충돌, 기존 규칙/교육과정/1학기 공식 보충표와의 충돌, 필수 지정 불명확성은 `hold`로 남긴다. 잘못된 행은 `invalid`이며 둘 다 종료 코드 2를 반환한다. 원본 부재, 해시·학번·전공 불일치 등 입력 자체의 문제는 오류로 중단한다.

`ready-for-review`도 승인이나 완전성 판정이 아니다. 모든 페이지/시트의 누락, 택일/대체 과목, 필수의 의미, 교육과정 적용 학번 및 문서 종류를 사람이 검토한 후 별도 변경으로 카탈로그와 근거를 등록하고 테스트해야 한다. 현재 도구는 행 증거 일치를 확인하며 전체 교육과정의 완전성이나 다운로드 주소와 로컬 파일의 동일성을 자동 증명하지 않는다.

기존 `scripts/rule-source.mjs`는 프로젝트 루트 원본의 수령·검토 기록을 관리한다. `approve`는 이미 승인된 정확 키 규칙이 해당 해시를 인용할 때만 기록하며, 후보를 승인 규칙으로 승격시키지 않는다.

선택적 실제 PDF 통합 테스트는 아래처럼 실행한다. 해당 테스트는 2025 전파 공식 원본의 SHA-256을 고정하고, 올바른 행과 잘못된 페이지·전공을 검증한다. 다른 파일 버전에는 새 검토와 해시 갱신이 필요하다.

```sh
CURRICULUM_IMPORT_PDF=/path/to/radio-curriculum.pdf node --import ./scripts/test-register.mjs --test --test-isolation=none tests/curriculum-import.test.ts
```
