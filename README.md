# 코드오 학원 수업/학생 관리 시스템

학원 운영자가 웹브라우저에서 학생, 수업, 출결, 성적, 납부, 상담, 회차, 보강을 한 곳에서 관리할 수 있는 React 기반 관리자 페이지입니다.

## 중요 안내

- 현재 프로젝트는 LocalStorage 기반입니다.
- 따라서 같은 URL로 접속하더라도 기기마다 데이터가 따로 저장됩니다.
- 같은 네트워크 밖에서도 접속 자체는 가능하지만, 여러 기기에서 동일 데이터를 공유하려면 백엔드 + DB가 필요합니다.

## 기술 스택

- React 18 + TypeScript + Vite
- LocalStorage 기반 영속 데이터 저장
- 반응형 관리자 UI (PC/모바일 지원)
- 배포 보안 헤더 설정 파일 포함:
  - [vercel.json](vercel.json)
  - [netlify.toml](netlify.toml)

## 실행 방법

```bash
npm install
npm run dev
```

서버 인증 + 프론트 동시 실행:

```bash
npm run dev:full
```

백엔드만 실행:

```bash
npm run server
```

프로덕션 빌드:

```bash
npm run build
```

모바일 포함 같은 네트워크(LAN) 접속:

```bash
npm run dev:lan
```

같은 네트워크 밖(인터넷) 접속은 아래 배포 절차를 사용합니다.

## 인터넷 접속 배포 (HTTPS)

### 1) Vercel 배포 (권장)

1. GitHub에 저장소 푸시
2. Vercel에서 저장소 Import
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. 배포 완료 후 발급된 HTTPS URL 사용

이 프로젝트는 [vercel.json](vercel.json)의 보안 헤더가 자동 적용됩니다.

### 2) Netlify 배포

1. GitHub 저장소 연결
2. Build Command: `npm run build`
3. Publish Directory: `dist`
4. 배포 완료 후 HTTPS URL 사용

이 프로젝트는 [netlify.toml](netlify.toml)의 보안 헤더가 적용됩니다.

## 보안 체크리스트

- HTTPS 강제 사용
- 관리자 전용 URL 공유 금지
- 배포 플랫폼의 2단계 인증(2FA) 활성화
- 주기적 비밀번호 변경
- 브라우저 공용 PC 자동 로그인/비밀번호 저장 금지

## 실무 운영 권장 구조

보안적으로 문제를 줄이고, 여러 기기에서 동일 데이터를 사용하려면 아래 구성이 필요합니다.

- 프론트엔드: 현재 React 앱
- 백엔드 API: 인증/권한/JWT/감사로그
- DB: PostgreSQL 등 서버 DB
- 파일 스토리지: 첨부파일 분리
- 백업: 자동 스냅샷 + 복구 테스트

현재 저장소는 프론트 단독 버전이므로, 보안과 데이터 일관성이 필요한 실제 운영에는 백엔드 연동을 권장합니다.

## 서버 인증/권한/감사로그

프로젝트에 서버 기반 인증 API가 포함되어 있습니다.

- 서버 파일: [server/index.js](server/index.js)
- 서버 데이터: [server/data.json](server/data.json)
- 환경 변수 예시: [.env.example](.env.example)

기능:

- JWT 로그인
- 역할 기반 접근 제어(원장/강사/상담)
- 서버 감사로그 저장 및 조회

기본 계정:

- 원장: `admin / Admin1234!`
- 강사: `teacher / Teacher1234!`
- 상담: `counsel / Counsel1234!`

필수 운영 설정:

- `.env`에 `JWT_SECRET`을 강력한 랜덤 값으로 변경
- `FRONTEND_ORIGIN` 또는 `FRONTEND_ORIGINS`를 실제 도메인으로 제한
- 서버는 HTTPS 뒤(리버스 프록시 포함)에서 운영

### 배포 조합별 환경 변수 예시

프론트는 `VITE_API_BASE_URL`을 사용하고, 서버는 `FRONTEND_ORIGIN`/`FRONTEND_ORIGINS`로 CORS를 제한합니다.

#### 1) 로컬 개발

프론트 `.env.local`:

```bash
VITE_API_BASE_URL=http://localhost:4000
```

서버 `.env`:

```bash
PORT=4000
JWT_SECRET=dev-only-change-me
JWT_EXPIRES_IN=8h
FRONTEND_ORIGIN=http://localhost:5173
FRONTEND_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

#### 2) Vercel(프론트) + Render/Railway(서버)

프론트(Vercel Environment Variables):

```bash
VITE_API_BASE_URL=https://api-your-app.onrender.com
```

서버(Render/Railway Environment Variables):

```bash
PORT=4000
JWT_SECRET=replace-with-long-random-secret
JWT_EXPIRES_IN=8h
FRONTEND_ORIGIN=https://your-app.vercel.app
FRONTEND_ORIGINS=https://your-app.vercel.app,https://www.yourdomain.com,https://yourdomain.com
```

#### 3) Netlify(프론트) + Render/Railway(서버)

프론트(Netlify Environment Variables):

```bash
VITE_API_BASE_URL=https://api-your-app.onrender.com
```

서버(Render/Railway Environment Variables):

```bash
PORT=4000
JWT_SECRET=replace-with-long-random-secret
JWT_EXPIRES_IN=8h
FRONTEND_ORIGIN=https://your-app.netlify.app
FRONTEND_ORIGINS=https://your-app.netlify.app,https://www.yourdomain.com,https://yourdomain.com
```

JWT_SECRET 생성 예시(Node):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

주의:

- `FRONTEND_ORIGIN`은 단일 값, `FRONTEND_ORIGINS`는 쉼표로 여러 도메인을 허용합니다.
- 프론트 도메인이 바뀌면 서버의 `FRONTEND_ORIGIN`/`FRONTEND_ORIGINS`도 반드시 함께 수정해야 로그인 API가 차단되지 않습니다.

### 커스텀 도메인 구성

루트 도메인(`yourdomain.com`)과 `www`를 함께 쓰는 구성을 권장합니다.

#### Vercel 프론트

1. Vercel 프로젝트 Settings > Domains에서 `yourdomain.com`, `www.yourdomain.com` 추가
2. DNS에 Vercel 안내값 반영
3. 리다이렉트 정책 선택(예: `www` -> 루트)

#### Netlify 프론트

1. Netlify Site settings > Domain management에서 커스텀 도메인 추가
2. DNS에 Netlify 안내 레코드 반영
3. Primary domain 지정(예: `yourdomain.com`)

#### 서버 API 도메인

1. Render/Railway에서 API 서비스 도메인 확인(예: `api.yourdomain.com`)
2. DNS에서 `api` 서브도메인을 서버 호스팅 주소에 연결
3. 서버 환경변수에 프론트 도메인 등록

```env
FRONTEND_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

4. 프론트 환경변수에 API 도메인 등록

```env
VITE_API_BASE_URL=https://api.yourdomain.com
```

### 붙여넣기 전용 배포 체크리스트

아래 항목을 순서대로 체크하면, 프론트/서버를 안전하게 연결해 배포할 수 있습니다.

#### A) Vercel(프론트) + Render/Railway(서버)

- [ ] 서버 배포 후 API URL 확보: `https://api-your-app.onrender.com`
- [ ] 서버 환경변수 설정

```env
PORT=4000
JWT_SECRET=replace-with-long-random-secret
JWT_EXPIRES_IN=8h
FRONTEND_ORIGIN=https://your-app.vercel.app
FRONTEND_ORIGINS=https://your-app.vercel.app,https://yourdomain.com,https://www.yourdomain.com
```

- [ ] 프론트(Vercel) 환경변수 설정

```env
VITE_API_BASE_URL=https://api-your-app.onrender.com
```

- [ ] Vercel 재배포
- [ ] 로그인 테스트(원장/강사/상담)
- [ ] 서버 헬스체크 확인: `https://api-your-app.onrender.com/api/health`
- [ ] 원장 계정으로 감사로그 화면 조회 확인

#### B) Netlify(프론트) + Render/Railway(서버)

- [ ] 서버 배포 후 API URL 확보: `https://api-your-app.onrender.com`
- [ ] 서버 환경변수 설정

```env
PORT=4000
JWT_SECRET=replace-with-long-random-secret
JWT_EXPIRES_IN=8h
FRONTEND_ORIGIN=https://your-app.netlify.app
FRONTEND_ORIGINS=https://your-app.netlify.app,https://yourdomain.com,https://www.yourdomain.com
```

- [ ] 프론트(Netlify) 환경변수 설정

```env
VITE_API_BASE_URL=https://api-your-app.onrender.com
```

- [ ] Netlify 재배포
- [ ] 로그인 테스트(원장/강사/상담)
- [ ] 서버 헬스체크 확인: `https://api-your-app.onrender.com/api/health`
- [ ] 원장 계정으로 감사로그 화면 조회 확인

#### 공통 최종 점검

- [ ] 서버 `JWT_SECRET`가 기본값이 아닌지 확인
- [ ] `FRONTEND_ORIGIN`/`FRONTEND_ORIGINS`가 실제 프론트 도메인과 정확히 일치하는지 확인
- [ ] 프론트의 `VITE_API_BASE_URL`이 실제 API 도메인인지 확인
- [ ] 브라우저 개발자도구 Network에서 로그인 요청이 200 응답인지 확인
- [ ] CORS 오류가 없고, 역할별 메뉴 권한이 정상 적용되는지 확인

## 화면 구조

- 좌측 사이드바: 메뉴 이동
- 상단 헤더: 현재 화면 제목, 회차 차감 규칙 안내
- 대시보드: 학생 수, 수업 수, 오늘 출결, 미납자, 회차 부족, 최근 데이터
- 학생 관리: 등록/수정/삭제, 검색/필터/정렬/페이징, 학생 상세 이동
- 수업 관리: 수업 CRUD, 수업별 학생 배정/해제, 정원 관리, 회차 현황
- 출결/보강 관리: 출결 등록, 결석-보강 연결, 보강 완료 처리
- 성적 관리: 시험 점수 입력/조회
- 납부 관리: 월별 수강료 납부/미납 관리
- 상담 관리: 학생/보호자 상담 기록
- 공지/메모: 운영 메모 관리
- 학생 상세 탭: 개요, 출결, 성적, 납부, 회차, 보강, 상담

## 데이터 모델

모든 데이터는 [src/App.tsx](src/App.tsx)에 타입으로 정의되어 있습니다.

- Student: 학생 기본 정보
  - 이름, 연락처, 학년, 학교, 보호자 정보, 주소, 메모
- AcademyClass: 수업 정보
  - 과목명, 강사, 요일, 시간, 강의실, 정원, 메모
- Enrollment: 학생-수업 배정 + 수강 회차 정보
  - 수강 시작/종료일
- Attendance: 출결 기록
  - 상태(출석/지각/결석/조퇴), 유형(정규/보강), 메모
- Makeup: 결석 수업을 대체하는 보강 정보
  - 결석 출결 ID 연결, 보강 예정일, 출석 여부, 완료 여부
- Grade: 성적 기록
- Payment: 납부 기록
- Counsel: 상담 기록
- Note: 공지/운영 메모

## 핵심 업무 규칙

회차 차감 규칙은 아래처럼 명확히 분리됩니다.

- 정규 수업 출결(출석/지각/결석/조퇴): 사용 회차 증가
- 보강 수업 출결: 사용 회차 미증가

즉,

- 학생이 결석하면 정규 수업으로 기록되어 사용 회차가 증가합니다.
- 결석 건은 보강 일정으로 연결할 수 있습니다.
- 보강 출석이 완료되어도 사용 회차는 증가하지 않습니다.

## 구현 범위

- CRUD: 학생/수업/배정/출결/보강/성적/납부/상담/메모
- 검색/필터/정렬/페이징: 학생 관리 화면 제공
- 상세 페이지 탭 구성: 학생별 통합 조회
- 입력 검증/오류 메시지 처리: 필수값, 범위값, 중복 배정, 정원 제한 등

## 파일 안내

- [src/App.tsx](src/App.tsx): 화면/상태/업무 규칙 전체
- [src/App.css](src/App.css): 관리자 UI 스타일
- [src/index.css](src/index.css): 기본 타이포/리셋

## 비고

현재 저장소는 LocalStorage 기반 단일 프론트엔드 구현입니다.
실무 배포 시에는 API 서버(인증/권한/백업/감사 로그 포함) 연결을 권장합니다.
