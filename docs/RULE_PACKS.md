# 입학학년도 규칙 팩

입학학년도 추가는 `rules/packs/kmou/<연도>/pack.json`으로 관리한다. 앱은 `src/generated/kmou-rule-pack-index.json`만 읽으므로 새 연도를 위해 TypeScript 목록을 수정하지 않는다.

## 새 연도 준비

```text
node scripts/rule-pack.mjs scaffold 2027
node scripts/rule-pack.mjs validate
node scripts/rule-pack.mjs sync
node scripts/rule-pack.mjs sync --check
```

`scaffold`는 가장 최근 팩의 전공 구조를 복사하지만 `estimated-previous-year`, `draft`, `공식 미확인` 경고로 고정하고 운영 규칙을 비운다. 이 상태는 연도와 전공 선택을 위한 미리보기일 뿐 공식 판정이나 공식 출처로 활성화되지 않는다.

공식 자료 검수가 끝나면 `basis`를 `official`, `status`를 `active`로 바꾸고 해당 연도의 `offerings`와 완전한 `operationalRules`를 입력한다. 각 운영 규칙의 학교·입학년도·전공은 팩과 offerings에 정확히 일치해야 한다. 영역별 학점 합계, 출처 적용 연도와 전공, 원본 해시 등 기존 운영 규칙 검증도 통과해야 한다.

`sync` 출력은 결정적이며 저장소에 함께 커밋한다. CI에서는 `validate`와 `sync --check`를 실행해 잘못된 팩과 생성 파일 누락을 차단한다.
