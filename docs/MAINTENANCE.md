# 코드오 유지보수 가이드

이 문서는 다른 AI 또는 후속 유지보수자가 이 저장소를 안전하게 이어서 작업할 수 있도록 정리한 내부 메모입니다.

## 한 줄 요약

- 프론트는 Vite + React + TypeScript, 서버는 Node.js + Express, 데이터는 `server/data.json` 기반입니다.
- 서버가 있는 환경에서는 서버를 기준으로 데이터가 동기화되고, 브라우저 `localStorage`는 보조 캐시 역할만 합니다.
- 데이터가 사라진 것처럼 보이면 대부분 `server/data.json`과 백업 파일의 시점 차이, 또는 서버/브라우저 캐시 불일치입니다.

## 실행 포인트

- 프론트 진입점: [src/App.tsx](../src/App.tsx)
- 서버 진입점: [server/index.js](../server/index.js)
- 서버 데이터: [server/data.json](../server/data.json)
- 환경 변수 예시: [.env.example](../.env.example)
- 작업 스크립트: [package.json](../package.json)

## 현재 아키텍처

### 프론트

- Vite dev server는 기본적으로 5173 포트를 사용합니다.
- `npm run dev:lan`은 `--host` 옵션으로 LAN 접속을 허용합니다.
- `src/App.tsx`는 `VITE_API_BASE_URL`이 있으면 그 주소를, 없으면 현재 호스트의 `:4000`을 API 주소로 사용합니다.

### 서버

- 서버 엔트리포인트는 반드시 `server/index.js`입니다.
- lowdb가 `server/data.json`을 읽고 씁니다.
- CORS는 `localhost`, `127.0.0.1`, `10.x.x.x`, `172.16~31.x.x`, `192.168.x.x` 같은 개발/사설망 주소를 허용합니다.
- `helmet`과 `express-rate-limit`은 유지해야 합니다.

## 데이터 저장 원칙

- 서버 저장이 1차 원본입니다.
- 브라우저 `localStorage`는 비상용 캐시입니다.
- 여러 사용자가 동시에 쓰는 환경에서 전체 DB를 통째로 덮어쓰면 데이터 유실이 생길 수 있어서, 현재는 변경분을 서버로 패치하는 구조를 사용합니다.

### 중요

- `server/data.json`을 수동으로 지우거나 localStorage 데이터로 덮어쓰지 마세요.
- 데이터가 줄어든 것처럼 보이면 먼저 백업 파일과 `server/data.json`의 시점을 비교하세요.
- 최신 백업 파일 예시: `server_data_backup_2026-05-09.json`

## 유지보수할 때 꼭 보는 로직

### 회차/출결 규칙

- 차감 대상은 `출석`, `지각`, `결석`, `조퇴`입니다.
- `결석예정`은 회차에 반영하지 않는 표시용 상태입니다.
- 확인할 위치:
  - 회차 차감 기준: [src/App.tsx](../src/App.tsx)
  - 출결 등록 화면: [src/App.tsx](../src/App.tsx)
  - 출결 내역 회차 표시: [src/App.tsx](../src/App.tsx)
  - 상단 회차 규칙 안내: [src/App.tsx](../src/App.tsx)

### 보강 규칙

- 결석/결석예정 학생 모두 보강 관리 화면에서 선택할 수 있게 되어 있습니다.
- 보강 생성/완료/취소는 출결 레코드와 연결되어 있으니, 수정할 때는 보강 상태와 출결 상태를 같이 보아야 합니다.

### 학생 회차

- 학생별 사용 회차는 정규 출결 기준으로 계산됩니다.
- `sessionOffset`은 수동 보정값입니다.
- 회차 관련 수식 변경 시, 대시보드의 발송대상/학생 목록/학생 상세 탭을 함께 확인해야 합니다.

## 서버 동기화 방식

- 현재 프론트는 `updateDb()` 경로에서 변경분을 계산해 서버에 보냅니다.
- 서버는 `PUT /api/db`에서 patch 목록을 병합합니다.
- 이 구조를 바꿀 때는 아래를 같이 확인해야 합니다.
  - `updateDb()`
  - `buildDbPatches()`
  - `server/index.js`의 `applyDbPatches()`
  - `PUT /api/db`

## 배포/실행 메모

- 로컬 개발:
  - `npm run dev:full`
  - 포트 충돌 시 Vite가 5174로 넘어갈 수 있습니다.
- LAN 사용:
  - `npm run dev:lan:full`
  - 휴대폰/다른 PC는 서버 PC의 LAN IP로 접속합니다.
- 일반적으로 확인할 주소:
  - 프론트: `http://172.30.1.7:5173`
  - API: `http://172.30.1.7:4000`

## 백업/복구 절차

1. 현재 `server/data.json`을 복사해 날짜가 들어간 파일로 저장합니다.
2. 예: `server_data_backup_2026-05-09.json`
3. 복구할 때는 해당 백업 파일을 `server/data.json`으로 다시 복사합니다.
4. 복구 후에는 `npm run build`와 `/api/health`를 확인합니다.

## 다른 AI가 작업할 때 주의할 점

- 먼저 `server/data.json`과 백업 파일의 차이를 확인하세요.
- 서버가 켜진 상태에서 localStorage만 보고 판단하지 마세요.
- `npm run dev:full`이 죽는 경우, 5173/4000 포트 충돌이나 기존 프로세스가 남아 있는지 확인하세요.
- 문구만 바꿀 때도 회차 계산, 출결 내역 표시, 보강 목록, 상단 규칙 안내를 같이 보세요.
- `결석예정`은 차감이 아니므로, 계산 로직에 넣지 마세요.

## 확인 체크리스트

- [ ] `npm run build` 통과
- [ ] `GET /api/health` 응답 확인
- [ ] `GET /api/db` 응답 확인
- [ ] 출결 저장 후 `server/data.json` 갱신 확인
- [ ] 보강 등록/완료/취소가 출결과 함께 일관되게 동작하는지 확인
- [ ] LAN IP로 다른 기기 접속 확인
