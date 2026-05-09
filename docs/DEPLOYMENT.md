# 코드오 배포 가이드

이 문서는 코드오 학원관리 프로그램을 로컬, 같은 와이파이, 인터넷 배포 환경에서 운영하는 방법을 정리한 문서입니다.

## 기본 구조

- 프론트: Vite + React + TypeScript
- 서버: Node.js + Express
- 데이터 저장: lowdb + `server/data.json`
- 인증: JWT

## 로컬 개발

### 설치

```bash
npm install
```

### 실행

```bash
npm run dev:full
```

이 명령은 서버와 프론트를 같이 실행합니다.

- 서버: 4000
- 프론트: 5173

포트가 이미 사용 중이면 Vite가 5174로 바뀔 수 있습니다.

### 단독 실행

서버만 실행:

```bash
npm run server
```

프론트만 실행:

```bash
npm run dev
```

## 같은 와이파이에서 사용

같은 공유기 아래의 휴대폰, 태블릿, 다른 PC에서 접속하려면 다음을 지키면 됩니다.

1. 서버 PC에서 서버가 0.0.0.0에 바인딩되어 있어야 합니다.
2. 프론트는 LAN 접속이 가능한 Vite host 옵션으로 실행해야 합니다.
3. 접속 기기들은 반드시 같은 네트워크에 있어야 합니다.
4. 방화벽에서 4000, 5173 포트를 허용해야 할 수 있습니다.

### 실행

```bash
npm run dev:lan:full
```

### 접속 주소

- 프론트: `http://서버IP:5173`
- API: `http://서버IP:4000`
- 헬스체크: `http://서버IP:4000/api/health`

서버 IP는 서버 PC에서 확인합니다.

## 운영 환경 변수

### 로컬 개발

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

### LAN 개발

서버 `.env`:

```bash
HOST=0.0.0.0
PORT=4000
JWT_SECRET=dev-only-change-me
JWT_EXPIRES_IN=8h
FRONTEND_ORIGIN=http://서버IP:5173
FRONTEND_ORIGINS=http://서버IP:5173,http://172.30.1.7:5173
```

프론트는 기본적으로 현재 호스트의 4000 포트를 바라보므로, 같은 와이파이에서 같은 IP로 열면 별도 설정 없이도 동작합니다.

### 인터넷 배포

프론트와 서버를 분리 배포할 때는 다음이 필요합니다.

- 프론트 환경변수: `VITE_API_BASE_URL`
- 서버 환경변수: `FRONTEND_ORIGIN`, `FRONTEND_ORIGINS`, `JWT_SECRET`
- 서버는 reverse proxy 뒤에서 HTTPS로 운영

## 배포 플랫폼 예시

### Vercel + Render/Railway

- 프론트는 Vercel
- API는 Render 또는 Railway
- API 주소를 프론트 환경변수에 넣습니다.

예시:

```bash
VITE_API_BASE_URL=https://api-your-app.onrender.com
```

서버 환경변수 예시:

```bash
PORT=4000
JWT_SECRET=replace-with-long-random-secret
JWT_EXPIRES_IN=8h
FRONTEND_ORIGIN=https://your-app.vercel.app
FRONTEND_ORIGINS=https://your-app.vercel.app,https://www.yourdomain.com,https://yourdomain.com
```

### Netlify + Render/Railway

예시:

```bash
VITE_API_BASE_URL=https://api-your-app.onrender.com
```

서버 환경변수 예시:

```bash
PORT=4000
JWT_SECRET=replace-with-long-random-secret
JWT_EXPIRES_IN=8h
FRONTEND_ORIGIN=https://your-app.netlify.app
FRONTEND_ORIGINS=https://your-app.netlify.app,https://www.yourdomain.com,https://yourdomain.com
```

## 데이터 백업

백업 파일은 현재 `server/data.json`을 복사해서 만듭니다.

예:

```bash
cp server/data.json server_data_backup_2026-05-09.json
```

복구할 때는 반대로 복사합니다.

```bash
cp server_data_backup_2026-05-09.json server/data.json
```

## 운영 체크리스트

- [ ] `npm run build` 성공
- [ ] `GET /api/health` 성공
- [ ] `GET /api/db` 성공
- [ ] 출결 저장 후 `server/data.json` 갱신 확인
- [ ] 다른 기기에서 LAN 주소로 접속 확인
- [ ] 방화벽 포트 확인
