# 코드오 API 명세

이 문서는 프론트와 서버를 분리해서 유지보수할 때 필요한 최소 API 정보를 정리한 문서입니다.

## 개요

- 서버 엔트리포인트: [server/index.js](../server/index.js)
- 인증 방식: JWT Bearer 토큰
- 데이터 저장: lowdb가 [server/data.json](../server/data.json)을 읽고 씁니다.
- 기본 운영 포트:
  - 서버: 4000
  - 프론트 개발 서버: 5173

## 공통 규칙

- 모든 인증 필요 API는 요청 헤더에 `Authorization: Bearer <token>` 형식이 필요합니다.
- 요청 바디는 JSON 형식입니다.
- 응답도 JSON 형식입니다.
- CORS는 로컬 개발 주소와 사설망 주소를 허용합니다.

## 인증 흐름

### POST /api/auth/login

로그인 성공 시 JWT 토큰과 사용자 정보를 반환합니다.

요청 바디:

```json
{
  "id": "admin",
  "password": "Admin1234!"
}
```

응답 예시:

```json
{
  "token": "jwt-token",
  "user": {
    "id": "admin",
    "name": "원장계정",
    "role": "원장"
  }
}
```

### GET /api/auth/me

현재 토큰의 사용자 정보를 반환합니다.

응답 예시:

```json
{
  "user": {
    "id": "admin",
    "name": "원장계정",
    "role": "원장"
  }
}
```

## 상태 확인

### GET /api/health

서버가 살아 있는지 확인하는 헬스체크입니다.

응답 예시:

```json
{
  "ok": true,
  "service": "academy-auth-api"
}
```

## 감사 로그

### POST /api/audit

작업 로그를 서버 감사로그에 추가합니다.

요청 바디:

```json
{
  "action": "학생 등록",
  "detail": "홍길동"
}
```

### GET /api/audit

원장과 부원장만 조회할 수 있습니다.

응답 예시:

```json
{
  "logs": []
}
```

## 학원 데이터

### GET /api/db

현재 학원 데이터를 조회합니다.

응답 예시:

```json
{
  "db": {
    "students": [],
    "classes": [],
    "enrollments": [],
    "attendances": [],
    "grades": [],
    "payments": [],
    "counsels": [],
    "notes": [],
    "makeups": []
  }
}
```

### PUT /api/db

학원 데이터를 저장합니다.

현재 구현은 두 가지 입력을 허용합니다.

1. 전체 DB 저장
2. 컬렉션 단위 patch 저장

전체 DB 저장 예시:

```json
{
  "db": {
    "students": [],
    "classes": [],
    "enrollments": [],
    "attendances": [],
    "grades": [],
    "payments": [],
    "counsels": [],
    "notes": [],
    "makeups": []
  }
}
```

patch 저장 예시:

```json
{
  "patches": [
    {
      "collection": "students",
      "upserts": [
        {
          "id": "stu_123",
          "name": "홍길동"
        }
      ],
      "deletes": ["stu_old"]
    }
  ]
}
```

## 데이터 스키마

### students

- id
- name
- phone
- grade
- school
- guardianName
- guardianPhone
- address
- memo
- isWithdrawn
- withdrawnAt
- createdAt
- sessionOffset

### classes

- id
- subject
- teacher
- day
- time
- room
- capacity
- memo
- createdAt

### enrollments

- id
- studentId
- classId
- startDate
- endDate
- createdAt

### attendances

- id
- date
- time
- classId
- studentId
- status
- type
- memo
- makeupId
- createdAt

### grades

- id
- studentId
- subject
- date
- score
- memo
- createdAt

### payments

- id
- studentId
- month
- amount
- status
- memo
- createdAt

### counsels

- id
- studentId
- date
- withGuardian
- content
- createdAt

### notes

- id
- date
- content
- createdAt

### makeups

- id
- studentId
- classId
- absentAttendanceId
- scheduledDate
- status
- attended
- memo
- createdAt

## 프론트 연동 참고

- 프론트 API 기준점은 [src/App.tsx](../src/App.tsx)입니다.
- `VITE_API_BASE_URL`이 있으면 그 값을 우선 사용합니다.
- 없으면 현재 호스트의 4000 포트를 사용합니다.
- 서버가 있는 상태에서는 localStorage는 캐시용으로만 사용합니다.

## 유지보수 시 주의

- 전체 DB를 통째로 덮어쓰는 방식은 여러 사용자 환경에서 데이터 유실을 만들 수 있습니다.
- patch 저장 로직을 수정할 때는 컬렉션별 upsert/delete가 모두 보존되는지 확인하세요.
- 로그인 실패나 CORS 오류가 나면 먼저 프론트 도메인과 서버 환경변수를 확인하세요.
