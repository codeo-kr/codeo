import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import './App.css'

type MenuKey =
  | 'dashboard'
  | 'students'
  | 'classes'
  | 'attendance'
  | 'grades'
  | 'payments'
  | 'counsels'
  | 'notes'
  | 'audit'
  | 'changeHistory'
  | 'studentDetail'

type UserRole = '원장' | '부원장' | '강사' | '상담'

type AuthUser = {
  id: string
  name: string
  role: UserRole
}

type AuditLog = {
  id: string
  actorId: string
  actorName: string
  actorRole: UserRole
  action: string
  detail: string
  createdAt: string
}

type DataChangeEntry = {
  field: string
  before: string
  after: string
}

type DataChangeType = '추가' | '수정' | '삭제'

type DataChangeLog = {
  id: string
  actorId: string
  actorName: string
  actorRole: UserRole
  action: string
  detail: string
  entityType: string
  entityId: string
  entityLabel: string
  changeType: DataChangeType
  changes: DataChangeEntry[]
  createdAt: string
}

type Student = {
  id: string
  name: string
  phone: string
  grade: string
  school: string
  guardianName: string
  guardianPhone: string
  address: string
  memo: string
  isWithdrawn?: boolean
  withdrawnAt?: string
  createdAt: string
  sessionOffset?: number
}

type AcademyClass = {
  id: string
  subject: string
  teacher: string
  day: string
  time: string
  room: string
  capacity: number
  memo: string
  createdAt: string
}

type Enrollment = {
  id: string
  studentId: string
  classId: string
  startDate: string
  endDate: string
  createdAt: string
}

type AttendanceStatus = '출석' | '지각' | '결석' | '조퇴'
type AttendanceType = '정규' | '보강'

type Attendance = {
  id: string
  date: string
  time: string
  classId: string
  studentId: string
  status: AttendanceStatus
  type: AttendanceType
  memo: string
  makeupId?: string
  createdAt: string
}

type Grade = {
  id: string
  studentId: string
  subject: string
  date: string
  score: number
  memo: string
  createdAt: string
}

type Payment = {
  id: string
  studentId: string
  month: string
  amount: number
  status: '완납' | '미납'
  memo: string
  createdAt: string
}

type Counsel = {
  id: string
  studentId: string
  date: string
  withGuardian: boolean
  content: string
  createdAt: string
}

type Note = {
  id: string
  date: string
  content: string
  createdAt: string
}

type Makeup = {
  id: string
  studentId: string
  classId: string
  absentAttendanceId: string
  scheduledDate: string
  status: '예정' | '완료'
  attended: boolean
  memo: string
  createdAt: string
}

type DB = {
  students: Student[]
  classes: AcademyClass[]
  enrollments: Enrollment[]
  attendances: Attendance[]
  grades: Grade[]
  payments: Payment[]
  counsels: Counsel[]
  notes: Note[]
  makeups: Makeup[]
}

type DBCollectionKey = keyof DB

type AttendanceDraft = {
  status: AttendanceStatus | ''
  memo: string
  createMakeup: boolean
  makeupDate: string
}

type TimetableEntry = {
  classId: string
  subject: string
  teacher: string
  time: string
  students: { id: string; name: string }[]
  sessionType: '정규' | '보강'
}

type SearchableOption = {
  value: string
  label: string
  searchText?: string
}

const STORAGE_KEY = 'academy_admin_db_v1'
const AUTH_KEY = 'academy_admin_auth_v1'
const AUTH_TOKEN_KEY = 'academy_admin_auth_token_v1'
const AUDIT_KEY = 'academy_admin_audit_v1'
const CHANGE_LOG_KEY = 'academy_admin_change_log_v1'
const DB_COLLECTION_KEYS: DBCollectionKey[] = ['students', 'classes', 'enrollments', 'attendances', 'grades', 'payments', 'counsels', 'notes', 'makeups']
const COLLECTION_LABELS: Record<DBCollectionKey, string> = {
  students: '학생',
  classes: '수업',
  enrollments: '수강 배정',
  attendances: '출결',
  grades: '성적',
  payments: '납부',
  counsels: '상담',
  notes: '공지/메모',
  makeups: '보강',
}
const API_BASE_URL = (() => {
  const envBase = (import.meta.env.VITE_API_BASE_URL ?? '').trim()
  if (envBase) {
    return envBase.replace(/\/$/, '')
  }

  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
    // 개발 환경: 같은 호스트의 4000 포트를 API 서버로 사용
    return `${protocol}//${hostname}:4000`
  }

  return ''
})()
const DEDUCT_STATUSES: AttendanceStatus[] = ['출석', '지각', '결석', '조퇴']
const WEEK_DAYS = ['월', '화', '수', '목', '금', '토', '일'] as const
const PAYMENT_STATUS_OPTIONS: SearchableOption[] = [
  { value: '완납', label: '완납' },
  { value: '미납', label: '미납' },
]
const ATTENDANCE_HISTORY_STATUS_OPTIONS: SearchableOption[] = [
  { value: '출석', label: '출석' },
  { value: '지각', label: '지각' },
  { value: '결석', label: '결석' },
  { value: '조퇴', label: '조퇴' },
]
const STUDENT_SORT_OPTIONS: SearchableOption[] = [
  { value: 'createdAt', label: '최신 등록순' },
  { value: 'name', label: '이름순' },
]
const CLASS_DAY_OPTIONS = [
  '월',
  '화',
  '수',
  '목',
  '금',
  '토',
  '일',
  '월/수',
  '화/목',
  '수/금',
  '월/수/금',
  '화/목/토',
]
const HOUR_TIME_OPTIONS = Array.from({ length: 18 }, (_, i) => `${String(i + 6).padStart(2, '0')}:00`)

const today = new Date().toISOString().slice(0, 10)

const ROLE_MENU_ACCESS: Record<UserRole, MenuKey[]> = {
  원장: ['dashboard', 'students', 'classes', 'attendance', 'grades', 'payments', 'counsels', 'notes', 'audit', 'changeHistory', 'studentDetail'],
  부원장: ['dashboard', 'students', 'classes', 'attendance', 'grades', 'payments', 'counsels', 'notes', 'audit', 'changeHistory', 'studentDetail'],
  강사: ['dashboard', 'students', 'classes', 'attendance', 'grades', 'notes', 'studentDetail'],
  상담: ['dashboard', 'students', 'payments', 'counsels', 'notes', 'studentDetail'],
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`
}

function byRecent<T extends { createdAt: string }>(list: T[]) {
  return [...list].sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))
}

function summarizeValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'boolean') return value ? '예' : '아니오'
  if (Array.isArray(value)) return value.map((item) => summarizeValue(item)).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function resolveEntityLabel(collection: DBCollectionKey, item: Record<string, unknown>, db: DB): string {
  const studentsById = new Map(db.students.map((student) => [student.id, student]))
  const classesById = new Map(db.classes.map((academyClass) => [academyClass.id, academyClass]))

  switch (collection) {
    case 'students':
      return summarizeValue(item.name)
    case 'classes':
      return summarizeValue(item.subject)
    case 'enrollments': {
      const studentName = studentsById.get(String(item.studentId ?? ''))?.name ?? '삭제된 학생'
      const className = classesById.get(String(item.classId ?? ''))?.subject ?? '삭제된 수업'
      return `${studentName} / ${className}`
    }
    case 'attendances': {
      const studentName = studentsById.get(String(item.studentId ?? ''))?.name ?? '삭제된 학생'
      const className = classesById.get(String(item.classId ?? ''))?.subject ?? '삭제된 수업'
      return `${summarizeValue(item.date)} ${summarizeValue(item.time)} / ${studentName} / ${className}`
    }
    case 'grades': {
      const studentName = studentsById.get(String(item.studentId ?? ''))?.name ?? '삭제된 학생'
      return `${studentName} / ${summarizeValue(item.subject)}`
    }
    case 'payments': {
      const studentName = studentsById.get(String(item.studentId ?? ''))?.name ?? '삭제된 학생'
      return `${studentName} / ${summarizeValue(item.month)}`
    }
    case 'counsels': {
      const studentName = studentsById.get(String(item.studentId ?? ''))?.name ?? '삭제된 학생'
      return `${studentName} / ${summarizeValue(item.date)}`
    }
    case 'notes':
      return summarizeValue(item.content).slice(0, 40)
    case 'makeups': {
      const studentName = studentsById.get(String(item.studentId ?? ''))?.name ?? '삭제된 학생'
      const className = classesById.get(String(item.classId ?? ''))?.subject ?? '삭제된 수업'
      return `${studentName} / ${className} / ${summarizeValue(item.scheduledDate)}`
    }
    default:
      return summarizeValue(item.id)
  }
}

function buildChangeEntries(previousItem: Record<string, unknown> | null, nextItem: Record<string, unknown> | null, changeType: DataChangeType) {
  const fieldSet = new Set<string>()

  if (previousItem) {
    Object.keys(previousItem).forEach((field) => {
      if (field !== 'id' && field !== 'createdAt') fieldSet.add(field)
    })
  }

  if (nextItem) {
    Object.keys(nextItem).forEach((field) => {
      if (field !== 'id' && field !== 'createdAt') fieldSet.add(field)
    })
  }

  const entries = [...fieldSet].flatMap((field) => {
    const beforeValue = previousItem?.[field]
    const afterValue = nextItem?.[field]

    if (changeType === '수정' && JSON.stringify(beforeValue) === JSON.stringify(afterValue)) {
      return [] as DataChangeEntry[]
    }

    return [{
      field,
      before: summarizeValue(beforeValue),
      after: summarizeValue(afterValue),
    }]
  })

  return entries
}

function buildDataChangeLogs(previousDb: DB, nextDb: DB, actor: AuthUser | null, action: string, detail: string) {
  if (!actor) return [] as DataChangeLog[]

  const createdAt = new Date().toISOString()
  const logs: DataChangeLog[] = []

  DB_COLLECTION_KEYS.forEach((collection) => {
    const previousItems = previousDb[collection] as Array<Record<string, unknown>>
    const nextItems = nextDb[collection] as Array<Record<string, unknown>>
    const previousMap = new Map(previousItems.map((item) => [String(item.id), item]))
    const nextMap = new Map(nextItems.map((item) => [String(item.id), item]))

    nextMap.forEach((nextItem, itemId) => {
      const previousItem = previousMap.get(itemId)
      if (!previousItem) {
        logs.push({
          id: uid('change'),
          actorId: actor.id,
          actorName: actor.name,
          actorRole: actor.role,
          action,
          detail,
          entityType: COLLECTION_LABELS[collection],
          entityId: itemId,
          entityLabel: resolveEntityLabel(collection, nextItem, nextDb),
          changeType: '추가',
          changes: buildChangeEntries(null, nextItem, '추가'),
          createdAt,
        })
        return
      }

      const changes = buildChangeEntries(previousItem, nextItem, '수정')
      if (changes.length === 0) return

      logs.push({
        id: uid('change'),
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action,
        detail,
        entityType: COLLECTION_LABELS[collection],
        entityId: itemId,
        entityLabel: resolveEntityLabel(collection, nextItem, nextDb),
        changeType: '수정',
        changes,
        createdAt,
      })
    })

    previousMap.forEach((previousItem, itemId) => {
      if (nextMap.has(itemId)) return

      logs.push({
        id: uid('change'),
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action,
        detail,
        entityType: COLLECTION_LABELS[collection],
        entityId: itemId,
        entityLabel: resolveEntityLabel(collection, previousItem, previousDb),
        changeType: '삭제',
        changes: buildChangeEntries(previousItem, null, '삭제'),
        createdAt,
      })
    })
  })

  return logs
}

function parseTimeToMinute(value: string) {
  const [hourRaw, minuteRaw] = value.split(':')
  const hour = Number(hourRaw)
  const minute = Number(minuteRaw)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return hour * 60 + minute
}

function hoursInRange(range: string) {
  const [startRaw, endRaw] = range.split('-')
  if (!startRaw || !endRaw) return [] as number[]

  const startMinute = parseTimeToMinute(startRaw)
  const endMinute = parseTimeToMinute(endRaw)
  if (startMinute === null || endMinute === null || endMinute <= startMinute) {
    return [] as number[]
  }

  // Show each session only in its starting hour cell to keep the weekly view compact.
  return [Math.floor(startMinute / 60)]
}

function splitClassDays(value: string) {
  return value
    .split('/')
    .map((day) => day.trim())
    .filter((day): day is (typeof WEEK_DAYS)[number] => WEEK_DAYS.includes(day as (typeof WEEK_DAYS)[number]))
}

function getWeekDayFromDate(dateValue: string) {
  const [yearRaw, monthRaw, dayRaw] = dateValue.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null

  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return null
  return WEEK_DAYS[(date.getDay() + 6) % 7]
}

function withCurrentValue(options: SearchableOption[], value: string, suffix = '기존 값') {
  if (!value || options.some((option) => option.value === value)) {
    return options
  }

  return [{ value, label: `${value} (${suffix})` }, ...options]
}

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  emptyMessage = '검색 결과가 없습니다.',
  disabled = false,
  clearable = false,
  clearLabel = '선택 해제',
}: {
  value: string
  onChange: (value: string) => void
  options: SearchableOption[]
  placeholder: string
  emptyMessage?: string
  disabled?: boolean
  clearable?: boolean
  clearLabel?: string
}) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const selectedOption = options.find((option) => option.value === value) ?? null

  useEffect(() => {
    if (!isOpen) {
      setQuery(selectedOption?.label ?? '')
    }
  }, [isOpen, selectedOption])

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return options

    return options.filter((option) => {
      const haystack = `${option.label} ${option.searchText ?? ''}`.toLowerCase()
      return haystack.includes(normalized)
    })
  }, [options, query])

  const selectOption = (nextValue: string) => {
    const nextOption = options.find((option) => option.value === nextValue) ?? null
    onChange(nextValue)
    setQuery(nextOption?.label ?? '')
    setIsOpen(false)
  }

  return (
    <div
      className={`search-select${disabled ? ' disabled' : ''}`}
      onBlurCapture={(e) => {
        const nextTarget = e.relatedTarget as Node | null
        if (!e.currentTarget.contains(nextTarget)) {
          setIsOpen(false)
          setQuery(selectedOption?.label ?? '')
        }
      }}
    >
      <div className="search-select-field">
        <input
          value={query}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            const nextQuery = e.target.value
            setQuery(nextQuery)
            setIsOpen(true)
            if (!nextQuery.trim() && value) {
              onChange('')
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && filteredOptions.length > 0) {
              e.preventDefault()
              selectOption(filteredOptions[0].value)
            }
            if (e.key === 'Escape') {
              setIsOpen(false)
              setQuery(selectedOption?.label ?? '')
            }
          }}
        />
        {clearable && value && !disabled && (
          <button
            type="button"
            className="search-select-clear"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange('')
              setQuery('')
              setIsOpen(false)
            }}
          >
            {clearLabel}
          </button>
        )}
      </div>

      {isOpen && !disabled && (
        <div className="search-select-menu">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`search-select-option${option.value === value ? ' active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectOption(option.value)}
              >
                {option.label}
              </button>
            ))
          ) : (
            <div className="search-select-empty">{emptyMessage}</div>
          )}
        </div>
      )}
    </div>
  )
}

function seedDb(): DB {
  const class1 = 'class_math_a'
  const class2 = 'class_eng_b'
  const student1 = 'stu_kimminji'
  const student2 = 'stu_leedoyun'
  const absentId = 'att_absent_1'

  return {
    students: [
      {
        id: student1,
        name: '김민지',
        phone: '010-1234-5678',
        grade: '중2',
        school: '한빛중학교',
        guardianName: '김현수',
        guardianPhone: '010-5555-1001',
        address: '서울시 강동구',
        memo: '수학 심화반 희망',
        createdAt: '2026-04-11T10:11:00.000Z',
      },
      {
        id: student2,
        name: '이도윤',
        phone: '010-7777-2222',
        grade: '고1',
        school: '푸른고등학교',
        guardianName: '이정은',
        guardianPhone: '010-3333-2201',
        address: '서울시 송파구',
        memo: '영어 내신 집중',
        createdAt: '2026-04-14T14:21:00.000Z',
      },
    ],
    classes: [
      {
        id: class1,
        subject: '중등 수학 심화',
        teacher: '박선생',
        day: '화/목',
        time: '18:00-19:30',
        room: '301호',
        capacity: 12,
        memo: '서술형 대비',
        createdAt: '2026-04-01T09:00:00.000Z',
      },
      {
        id: class2,
        subject: '고등 영어 내신',
        teacher: '최선생',
        day: '월/수',
        time: '20:00-21:30',
        room: '202호',
        capacity: 14,
        memo: '내신 기출 분석',
        createdAt: '2026-04-01T09:20:00.000Z',
      },
    ],
    enrollments: [
      {
        id: 'enroll_1',
        studentId: student1,
        classId: class1,
        startDate: '2026-04-01',
        endDate: '',
        createdAt: '2026-04-01T09:30:00.000Z',
      },
      {
        id: 'enroll_2',
        studentId: student2,
        classId: class2,
        startDate: '2026-04-01',
        endDate: '',
        createdAt: '2026-04-01T09:31:00.000Z',
      },
    ],
    attendances: [
      {
        id: 'att_1',
        date: '2026-04-15',
        time: '18:00',
        classId: class1,
        studentId: student1,
        status: '출석',
        type: '정규',
        memo: '',
        createdAt: '2026-04-15T11:00:00.000Z',
      },
      {
        id: absentId,
        date: '2026-04-16',
        time: '18:00',
        classId: class1,
        studentId: student1,
        status: '결석',
        type: '정규',
        memo: '감기',
        createdAt: '2026-04-16T11:00:00.000Z',
      },
      {
        id: 'att_2',
        date: '2026-04-15',
        time: '20:00',
        classId: class2,
        studentId: student2,
        status: '지각',
        type: '정규',
        memo: '교통 지연',
        createdAt: '2026-04-15T12:00:00.000Z',
      },
      {
        id: 'att_3',
        date: '2026-04-18',
        time: '18:00',
        classId: class1,
        studentId: student1,
        status: '출석',
        type: '보강',
        memo: '결석 보강 참여',
        makeupId: 'makeup_1',
        createdAt: '2026-04-18T08:00:00.000Z',
      },
    ],
    grades: [
      {
        id: 'grade_1',
        studentId: student1,
        subject: '수학',
        date: '2026-04-10',
        score: 87,
        memo: '함수 단원 보완 필요',
        createdAt: '2026-04-10T19:00:00.000Z',
      },
      {
        id: 'grade_2',
        studentId: student2,
        subject: '영어',
        date: '2026-04-10',
        score: 92,
        memo: '독해 안정적',
        createdAt: '2026-04-10T19:05:00.000Z',
      },
    ],
    payments: [
      {
        id: 'pay_1',
        studentId: student1,
        month: '2026-04',
        amount: 320000,
        status: '완납',
        memo: '카드 결제',
        createdAt: '2026-04-03T10:00:00.000Z',
      },
      {
        id: 'pay_2',
        studentId: student2,
        month: '2026-04',
        amount: 340000,
        status: '미납',
        memo: '이번 주 납부 예정',
        createdAt: '2026-04-03T10:20:00.000Z',
      },
    ],
    counsels: [
      {
        id: 'counsel_1',
        studentId: student1,
        date: '2026-04-12',
        withGuardian: true,
        content: '중간고사 대비 학습량 조정 요청',
        createdAt: '2026-04-12T13:00:00.000Z',
      },
      {
        id: 'counsel_2',
        studentId: student2,
        date: '2026-04-15',
        withGuardian: false,
        content: '영어 어휘 테스트 계획 공유',
        createdAt: '2026-04-15T15:00:00.000Z',
      },
    ],
    notes: [
      {
        id: 'note_1',
        date: '2026-04-16',
        content: '중간고사 대비 자습실 운영시간 22시까지 연장',
        createdAt: '2026-04-16T09:00:00.000Z',
      },
      {
        id: 'note_2',
        date: '2026-04-17',
        content: '다음 주 학부모 간담회 일정 공지 필요',
        createdAt: '2026-04-17T09:10:00.000Z',
      },
    ],
    makeups: [
      {
        id: 'makeup_1',
        studentId: student1,
        classId: class1,
        absentAttendanceId: absentId,
        scheduledDate: '2026-04-18',
        status: '완료',
        attended: true,
        memo: '보강 완료',
        createdAt: '2026-04-16T18:00:00.000Z',
      },
    ],
  }
}

function loadAuthUser(): AuthUser | null {
  const raw = sessionStorage.getItem(AUTH_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

function loadAuditLogs(): AuditLog[] {
  const raw = localStorage.getItem(AUDIT_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as AuditLog[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function loadChangeLogs(): DataChangeLog[] {
  const raw = localStorage.getItem(CHANGE_LOG_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as DataChangeLog[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function loadAuthToken(): string {
  return sessionStorage.getItem(AUTH_TOKEN_KEY) ?? ''
}

function App() {
  const [db, setDb] = useState<DB>(seedDb)
  const [dbLoaded, setDbLoaded] = useState(false)
  const [hasMigratableData, setHasMigratableData] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(loadAuthUser)
  const [authToken, setAuthToken] = useState<string>(loadAuthToken)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(loadAuditLogs)
  const [changeLogs, setChangeLogs] = useState<DataChangeLog[]>(loadChangeLogs)
  const [loginId, setLoginId] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [menu, setMenu] = useState<MenuKey>('dashboard')
  const [selectedStudentId, setSelectedStudentId] = useState<string>('')
  const [studentTab, setStudentTab] = useState<'overview' | 'attendance' | 'grades' | 'payments' | 'sessions' | 'makeups' | 'counsels'>('overview')
  const [error, setError] = useState<string>('')
  const [notice, setNotice] = useState<string>('')

  const [studentSearch, setStudentSearch] = useState('')
  const [studentGradeFilter, setStudentGradeFilter] = useState('전체')
  const [studentSort, setStudentSort] = useState<'name' | 'createdAt'>('createdAt')
  const [studentPage, setStudentPage] = useState(1)
  const pageSize = 6

  const [editingSessionStudentId, setEditingSessionStudentId] = useState<string | null>(null)
  const [editingSessionValue, setEditingSessionValue] = useState<string>('')

  const [editingStudentId, setEditingStudentId] = useState<string>('')
  const [studentForm, setStudentForm] = useState({
    name: '',
    phone: '',
    grade: '',
    school: '',
    guardianName: '',
    guardianPhone: '',
    address: '',
    memo: '',
  })

  const [editingClassId, setEditingClassId] = useState<string>('')
  const [classForm, setClassForm] = useState({
    subject: '',
    teacher: '',
    day: '',
    startTime: '',
    endTime: '',
    room: '',
    capacity: 7,
    memo: '',
  })

  const [assignClassId, setAssignClassId] = useState<string>('')
  const [assignForm, setAssignForm] = useState({
    studentId: '',
    startDate: today,
  })

  const [attendanceForm, setAttendanceForm] = useState({
    date: today,
    classId: '',
    time: '',
  })
  const [attendanceDrafts, setAttendanceDrafts] = useState<Record<string, AttendanceDraft>>({})
  const [attendanceHistoryStudentId, setAttendanceHistoryStudentId] = useState('')
  const [attendanceHistoryClassId, setAttendanceHistoryClassId] = useState('')
  const [attendanceHistoryStatus, setAttendanceHistoryStatus] = useState('')
  const [attendanceHistoryStartDate, setAttendanceHistoryStartDate] = useState(today)
  const [attendanceHistoryEndDate, setAttendanceHistoryEndDate] = useState(today)

  const [gradeForm, setGradeForm] = useState({
    studentId: '',
    subject: '',
    date: today,
    score: 80,
    memo: '',
  })

  const [paymentForm, setPaymentForm] = useState({
    studentId: '',
    month: today.slice(0, 7),
    amount: 0,
    status: '완납' as '완납' | '미납',
    memo: '',
  })

  const [counselForm, setCounselForm] = useState({
    studentId: '',
    date: today,
    withGuardian: true,
    content: '',
  })

  const [noteForm, setNoteForm] = useState({
    date: today,
    content: '',
  })

  const [makeupForm, setMakeupForm] = useState({
    absentAttendanceId: '',
    scheduledDate: today,
    makeupClassId: '',
    memo: '',
  })
  const [makeupPeriod, setMakeupPeriod] = useState({
    startDate: today,
    endDate: today,
  })
  const [makeupScheduleDraft, setMakeupScheduleDraft] = useState<Record<string, string>>({})
  const [makeupClassDraft, setMakeupClassDraft] = useState<Record<string, string>>({})

  useEffect(() => {
    // 로컬 백업 저장
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
    if (!dbLoaded || !authToken) return
    // 서버에 디바운스 저장 (1초 후)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      fetch(`${API_BASE_URL}/api/db`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ db }),
      }).catch(() => {})
    }, 1000)
  }, [db, dbLoaded, authToken])

  // 로그인 후 서버에서 DB 로드
  useEffect(() => {
    if (!currentUser || !authToken) return
    setDbLoaded(false)
    fetch(`${API_BASE_URL}/api/db`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('load-failed')
        return res.json() as Promise<{ db: DB | null }>
      })
      .then(({ db: serverDb }) => {
        if (serverDb && serverDb.students) {
          // 서버에 데이터 있음 → 서버 데이터 사용
          setDb(serverDb)
          setHasMigratableData(false)
        } else {
          // 서버에 데이터 없음 → localStorage 마이그레이션 확인
          const localRaw = localStorage.getItem(STORAGE_KEY)
          if (localRaw) {
            try {
              const localDb = JSON.parse(localRaw) as DB
              if (localDb.students && localDb.students.length > 0) {
                setHasMigratableData(true)
                setDb(localDb)
              }
            } catch {
              /* ignore */
            }
          }
        }
        setDbLoaded(true)
      })
      .catch(() => {
        // 서버 연결 실패 시 localStorage 폴백
        const localRaw = localStorage.getItem(STORAGE_KEY)
        if (localRaw) {
          try {
            const localDb = JSON.parse(localRaw) as DB
            if (localDb.students) setDb(localDb)
          } catch { /* ignore */ }
        }
        setDbLoaded(true)
      })
  }, [currentUser, authToken])

  useEffect(() => {
    localStorage.setItem(AUDIT_KEY, JSON.stringify(auditLogs))
  }, [auditLogs])

  useEffect(() => {
    localStorage.setItem(CHANGE_LOG_KEY, JSON.stringify(changeLogs))
  }, [changeLogs])

  useEffect(() => {
    if (currentUser) {
      sessionStorage.setItem(AUTH_KEY, JSON.stringify(currentUser))
    } else {
      sessionStorage.removeItem(AUTH_KEY)
    }
  }, [currentUser])

  useEffect(() => {
    if (authToken) {
      sessionStorage.setItem(AUTH_TOKEN_KEY, authToken)
    } else {
      sessionStorage.removeItem(AUTH_TOKEN_KEY)
    }
  }, [authToken])

  const studentMap = useMemo(() => {
    const map = new Map<string, Student>()
    db.students.forEach((item) => map.set(item.id, item))
    return map
  }, [db.students])

  const classMap = useMemo(() => {
    const map = new Map<string, AcademyClass>()
    db.classes.forEach((item) => map.set(item.id, item))
    return map
  }, [db.classes])

  const activeEnrollmentByStudentClass = useMemo(() => {
    const map = new Map<string, Enrollment>()
    db.enrollments
      .filter((e) => !e.endDate)
      .forEach((e) => map.set(`${e.studentId}_${e.classId}`, e))
    return map
  }, [db.enrollments])

  const todayAttendances = db.attendances.filter((a) => a.date === today)
  const unpaidCount = db.payments.filter((p) => p.status === '미납').length
  const gradeFilterOptions = useMemo(
    () => [
      { value: '전체', label: '전체 학년' },
      ...[...new Set(db.students.map((student) => student.grade))].map((grade) => ({
        value: grade,
        label: grade,
      })),
    ],
    [db.students],
  )
  const studentOptions = useMemo(
    () => db.students.map((student) => ({
      value: student.id,
      label: `${student.name} (${student.grade})`,
      searchText: `${student.school} ${student.phone} ${student.guardianName} ${student.guardianPhone}`,
    })),
    [db.students],
  )
  const attendanceClassOptions = useMemo(() => {
    const selectedDay = getWeekDayFromDate(attendanceForm.date)
    const dayRank = new Map<(typeof WEEK_DAYS)[number], number>(WEEK_DAYS.map((day, index) => [day, index]))

    return [...db.classes]
      .sort((left, right) => {
        const leftMatches = selectedDay && left.day === selectedDay ? 0 : 1
        const rightMatches = selectedDay && right.day === selectedDay ? 0 : 1
        if (leftMatches !== rightMatches) return leftMatches - rightMatches

        const leftDayRank = dayRank.get(left.day as (typeof WEEK_DAYS)[number]) ?? 99
        const rightDayRank = dayRank.get(right.day as (typeof WEEK_DAYS)[number]) ?? 99
        if (leftDayRank !== rightDayRank) return leftDayRank - rightDayRank

        if (left.time !== right.time) return left.time.localeCompare(right.time)
        return left.subject.localeCompare(right.subject, 'ko-KR')
      })
      .map((academyClass) => ({
        value: academyClass.id,
        label: `${academyClass.subject} (${academyClass.day} ${academyClass.time})`,
        searchText: `${academyClass.teacher} ${academyClass.room}`,
      }))
  }, [attendanceForm.date, db.classes])
  const classDayOptions = useMemo(
    () => withCurrentValue(CLASS_DAY_OPTIONS.map((day) => ({ value: day, label: day })), classForm.day),
    [classForm.day],
  )
  const classStartTimeOptions = useMemo(
    () => withCurrentValue(HOUR_TIME_OPTIONS.map((time) => ({ value: time, label: time })), classForm.startTime),
    [classForm.startTime],
  )
  const classEndTimeOptions = useMemo(
    () => withCurrentValue(HOUR_TIME_OPTIONS.map((time) => ({ value: time, label: time })), classForm.endTime),
    [classForm.endTime],
  )
  const attendanceTimeOptions = useMemo(
    () => HOUR_TIME_OPTIONS.map((time) => ({ value: time, label: time })),
    [],
  )

  const getMakeupClassOptionsForDate = (date: string) => {
    const scheduledWeekDay = getWeekDayFromDate(date)
    if (!scheduledWeekDay) return [] as SearchableOption[]

    return [...db.classes]
      .filter((academyClass) => splitClassDays(academyClass.day).includes(scheduledWeekDay))
      .sort((left, right) => {
        if (left.time !== right.time) return left.time.localeCompare(right.time)
        return left.subject.localeCompare(right.subject, 'ko-KR')
      })
      .map((academyClass) => ({
        value: academyClass.id,
        label: `${academyClass.subject} (${academyClass.day} ${academyClass.time})`,
        searchText: `${academyClass.teacher} ${academyClass.room}`,
      }))
  }

  const makeupClassOptions = useMemo(
    () => getMakeupClassOptionsForDate(makeupForm.scheduledDate),
    [db.classes, makeupForm.scheduledDate],
  )

  const weeklyTimetable = useMemo(() => {
    const activeStudentsByClass = new Map<string, string[]>()
    db.enrollments
      .filter((enrollment) => !enrollment.endDate)
      .forEach((enrollment) => {
        if (!studentMap.get(enrollment.studentId)) return
        const existing = activeStudentsByClass.get(enrollment.classId) ?? []
        existing.push(enrollment.studentId)
        activeStudentsByClass.set(enrollment.classId, existing)
      })

    const schedule = new Map<string, TimetableEntry[]>()

    db.classes.forEach((academyClass) => {
      const days = splitClassDays(academyClass.day)
      const hours = hoursInRange(academyClass.time)
      if (!days.length || !hours.length) return

      const entry: TimetableEntry = {
        classId: academyClass.id,
        subject: academyClass.subject,
        teacher: academyClass.teacher,
        time: academyClass.time,
        students: (activeStudentsByClass.get(academyClass.id) ?? [])
          .sort((leftId, rightId) => {
            const leftName = studentMap.get(leftId)?.name ?? ''
            const rightName = studentMap.get(rightId)?.name ?? ''
            return leftName.localeCompare(rightName, 'ko-KR')
          })
          .map((studentId) => ({
            id: studentId,
            name: studentMap.get(studentId)?.name ?? '삭제된 학생',
          })),
        sessionType: '정규',
      }

      days.forEach((day) => {
        hours.forEach((hour) => {
          const key = `${day}_${hour}`
          const bucket = schedule.get(key) ?? []
          bucket.push(entry)
          schedule.set(key, bucket)
        })
      })
    })

    db.makeups.forEach((makeup) => {
      const day = getWeekDayFromDate(makeup.scheduledDate)
      if (!day) return

      const linkedClass = classMap.get(makeup.classId)
      if (!linkedClass) return

      const hours = hoursInRange(linkedClass.time)
      if (!hours.length) return

      const studentName = studentMap.get(makeup.studentId)?.name
      if (!studentName) return

      const entry: TimetableEntry = {
        classId: linkedClass.id,
        subject: linkedClass.subject,
        teacher: linkedClass.teacher,
        time: linkedClass.time,
        // For makeup sessions, show only the target student.
        students: [{ id: makeup.studentId, name: studentName }],
        sessionType: '보강',
      }

      hours.forEach((hour) => {
        const key = `${day}_${hour}`
        const bucket = schedule.get(key) ?? []
        bucket.push(entry)
        schedule.set(key, bucket)
      })
    })

    schedule.forEach((entries, key) => {
      const sorted = [...entries].sort((a, b) => {
        if (a.time === b.time) return a.subject.localeCompare(b.subject, 'ko-KR')
        return a.time.localeCompare(b.time)
      })
      schedule.set(key, sorted)
    })

    return schedule
  }, [classMap, db.classes, db.enrollments, db.makeups, studentMap])

  const todayAbsentStudentsByClass = useMemo(() => {
    const map = new Map<string, Set<string>>()
    todayAttendances
      .filter((attendance) => attendance.type === '정규' && attendance.status === '결석')
      .forEach((attendance) => {
        const bucket = map.get(attendance.classId) ?? new Set<string>()
        bucket.add(attendance.studentId)
        map.set(attendance.classId, bucket)
      })
    return map
  }, [todayAttendances])

  const selectedAttendanceClassStudents = useMemo(() => {
    if (!attendanceForm.classId) return [] as Student[]
    return db.enrollments
      .filter((en) => en.classId === attendanceForm.classId && !en.endDate)
      .map((en) => studentMap.get(en.studentId))
      .filter(Boolean) as Student[]
  }, [attendanceForm.classId, db.enrollments, studentMap])

  useEffect(() => {
    const selectedClass = classMap.get(attendanceForm.classId)
    const defaultTime = selectedClass?.time.split('-')[0] ?? ''
    if (attendanceForm.classId && !attendanceForm.time && defaultTime) {
      setAttendanceForm((prev) => ({ ...prev, time: defaultTime }))
    }
  }, [attendanceForm.classId, attendanceForm.time, classMap])

  useEffect(() => {
    if (menu === 'attendance' && !attendanceForm.date) {
      setAttendanceForm((prev) => ({ ...prev, date: today }))
    }
  }, [attendanceForm.date, menu])

  useEffect(() => {
    if (!attendanceForm.classId) {
      setAttendanceDrafts({})
      return
    }

    setAttendanceDrafts((prev) => {
      const nextDrafts: Record<string, AttendanceDraft> = {}
      selectedAttendanceClassStudents.forEach((student) => {
        const existingAttendance = db.attendances.find(
          (attendance) =>
            attendance.classId === attendanceForm.classId &&
            attendance.studentId === student.id &&
            attendance.date === attendanceForm.date &&
            attendance.type === '정규',
        )

        const existingMakeup = existingAttendance
          ? db.makeups.find(
              (makeup) =>
                makeup.absentAttendanceId === existingAttendance.id && makeup.status === '예정',
            )
          : undefined

        nextDrafts[student.id] = {
          status: prev[student.id]?.status ?? existingAttendance?.status ?? '',
          memo: prev[student.id]?.memo ?? existingAttendance?.memo ?? '',
          createMakeup:
            prev[student.id]?.createMakeup ?? Boolean(existingMakeup),
          makeupDate:
            prev[student.id]?.makeupDate ?? existingMakeup?.scheduledDate ?? attendanceForm.date,
        }
      })
      return nextDrafts
    })
  }, [attendanceForm.classId, attendanceForm.date, db.attendances, db.makeups, selectedAttendanceClassStudents])

  useEffect(() => {
    if (!makeupForm.makeupClassId) return
    const selectedWeekDay = getWeekDayFromDate(makeupForm.scheduledDate)
    const selectedClass = classMap.get(makeupForm.makeupClassId)
    const isValid = Boolean(
      selectedWeekDay && selectedClass && splitClassDays(selectedClass.day).includes(selectedWeekDay),
    )

    if (!isValid) {
      setMakeupForm((prev) => ({ ...prev, makeupClassId: '' }))
    }
  }, [classMap, makeupForm.makeupClassId, makeupForm.scheduledDate])

  useEffect(() => {
    if (!currentUser) return
    if (canAccess(menu)) return
    setMenu('dashboard')
  }, [currentUser, menu])

  useEffect(() => {
    if (!currentUser || !authToken) return
    if (currentUser.role !== '원장') return

    fetch(`${API_BASE_URL}/api/audit?limit=500`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('load-failed')
        return response.json() as Promise<{ logs: AuditLog[] }>
      })
      .then((result) => {
        if (Array.isArray(result.logs)) {
          setAuditLogs(result.logs)
        }
      })
      .catch(() => {
        // Keep local logs on fetch failure.
      })
  }, [currentUser, authToken])

  const appendAudit = (action: string, detail: string) => {
    if (!currentUser) return
    const next: AuditLog = {
      id: uid('audit'),
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      action,
      detail,
      createdAt: new Date().toISOString(),
    }
    setAuditLogs((prev) => [next, ...prev].slice(0, 5000))

    if (!authToken) return
    fetch(`${API_BASE_URL}/api/audit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ action, detail }),
    }).catch(() => {
      // Keep local audit trail if server audit write fails.
    })
  }

  const updateDb = (updater: (prev: DB) => DB, action?: string, detail?: string) => {
    setError('')
    setNotice('')
    const nextDb = updater(db)
    setDb(nextDb)
    if (action) appendAudit(action, detail ?? '')

    const nextChangeLogs = buildDataChangeLogs(db, nextDb, currentUser, action ?? '데이터 변경', detail ?? '')
    if (nextChangeLogs.length > 0) {
      setChangeLogs((prev) => [...nextChangeLogs, ...prev].slice(0, 8000))
    }
  }

  const canAccess = (target: MenuKey) => {
    if (!currentUser) return false
    return ROLE_MENU_ACCESS[currentUser.role].includes(target)
  }

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: loginId, password: loginPassword }),
      })

      if (!response.ok) {
        let serverMessage = ''
        try {
          const errorData = (await response.json()) as { message?: string }
          serverMessage = String(errorData?.message ?? '').trim()
        } catch {
          // Ignore parse errors and fall back to generic message.
        }

        if (response.status === 401) {
          setError(serverMessage || '아이디 또는 비밀번호가 올바르지 않습니다.')
        } else {
          setError(serverMessage || '로그인 요청에 실패했습니다. API 주소 및 서버 상태를 확인해 주세요.')
        }
        return
      }

      const data = (await response.json()) as { token: string; user: AuthUser }
      setAuthToken(data.token)
      setCurrentUser(data.user)
      setError('')
      setLoginPassword('')
      setMenu('dashboard')
      setNotice(`${data.user.name} 로그인 완료`)
    } catch {
      setError('로그인 서버 연결에 실패했습니다. 서버 실행 상태를 확인해 주세요.')
    }
  }

  const handleLogout = () => {
    if (currentUser) {
      appendAudit('로그아웃', '관리자 로그아웃')
    }
    setCurrentUser(null)
    setAuthToken('')
    setAuditLogs([])
    setLoginId('')
    setLoginPassword('')
    setMenu('dashboard')
    setNotice('')
    setError('')
  }

  const handleStudentExcelImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setError('')
      setNotice('')

      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      if (!firstSheetName) {
        setError('엑셀 시트를 찾을 수 없습니다.')
        return
      }

      const worksheet = workbook.Sheets[firstSheetName]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' })
      if (rows.length === 0) {
        setError('등록할 학생 데이터가 없습니다.')
        return
      }

      const normalize = (value: unknown) => String(value ?? '').trim()
      const normalizeHeader = (value: string) => value.replace(/\s+/g, '').toLowerCase()
      const pickByHeader = (row: Record<string, unknown>, candidates: string[]) => {
        const normalizedCandidates = candidates.map(normalizeHeader)
        const matchedKey = Object.keys(row).find((key) =>
          normalizedCandidates.includes(normalizeHeader(key)),
        )
        return matchedKey ? row[matchedKey] : ''
      }

      let inserted = 0
      let updated = 0
      let skippedMissingRequired = 0

      setDb((prev) => {
        const currentStudents = [...prev.students]
        const phoneToIndex = new Map<string, number>()
        currentStudents.forEach((s, index) => {
          const currentPhone = s.phone.trim()
          if (currentPhone) phoneToIndex.set(currentPhone, index)
        })
        const nextStudents: Student[] = []

        rows.forEach((row) => {
          const name = normalize(pickByHeader(row, ['이름', '학생명', 'name']))
          const phone = normalize(pickByHeader(row, ['연락처', '학생연락처', '전화번호', 'phone']))
          const grade = normalize(pickByHeader(row, ['학년', 'grade']))
          const school = normalize(pickByHeader(row, ['학교', 'school']))
          const guardianName = normalize(pickByHeader(row, ['보호자이름', '보호자 이름', 'guardianname']))
          const guardianPhone = normalize(
            pickByHeader(row, ['보호자연락처', '보호자 연락처', 'guardianphone']),
          )
          const address = normalize(pickByHeader(row, ['주소', 'address']))
          const memo = normalize(pickByHeader(row, ['메모', '비고', 'memo']))

          if (!name || !grade) {
            skippedMissingRequired += 1
            return
          }

          const existingIndex = phone ? phoneToIndex.get(phone) : undefined
          if (existingIndex !== undefined) {
            const existing = currentStudents[existingIndex]
            currentStudents[existingIndex] = {
              ...existing,
              name,
              grade,
              school,
              guardianName,
              guardianPhone,
              address,
              memo,
            }
            updated += 1
            return
          }

          if (phone) {
            phoneToIndex.set(phone, currentStudents.length + nextStudents.length)
          }
          inserted += 1

          nextStudents.push({
            id: uid('stu'),
            name,
            phone,
            grade,
            school,
            guardianName,
            guardianPhone,
            address,
            memo,
            createdAt: new Date().toISOString(),
          })
        })

        return {
          ...prev,
          students: [...nextStudents, ...currentStudents],
        }
      })

      if (inserted === 0 && updated === 0) {
        setError('처리된 학생이 없습니다. 헤더명 또는 필수값(이름/학년)을 확인해 주세요.')
      } else {
        setNotice(`엑셀 업로드 완료: ${inserted}명 등록, ${updated}명 업데이트, ${skippedMissingRequired}건 누락`)
      }
    } catch {
      setError('엑셀 파일 처리 중 오류가 발생했습니다. .xlsx 파일을 확인해 주세요.')
    } finally {
      e.target.value = ''
    }
  }

  const getDeductedCount = (studentId: string, classId: string) => {
    return db.attendances.filter(
      (attendance) =>
        attendance.studentId === studentId &&
        attendance.classId === classId &&
        attendance.type === '정규' &&
        DEDUCT_STATUSES.includes(attendance.status),
    ).length
  }

  const filteredStudents = useMemo(() => {
    const base = db.students.filter((s) => {
      const term = studentSearch.trim().toLowerCase()
      const matchedSearch =
        !term ||
        [s.name, s.phone, s.school, s.guardianName, s.guardianPhone].some((v) =>
          v.toLowerCase().includes(term),
        )
      const matchedGrade = studentGradeFilter === '전체' || s.grade === studentGradeFilter
      return matchedSearch && matchedGrade
    })

    base.sort((a, b) => {
      if (studentSort === 'name') {
        return a.name.localeCompare(b.name, 'ko')
      }
      return a.createdAt > b.createdAt ? -1 : 1
    })

    return base
  }, [db.students, studentSearch, studentGradeFilter, studentSort])

  const totalStudentPages = Math.max(Math.ceil(filteredStudents.length / pageSize), 1)
  const pagedStudents = filteredStudents.slice((studentPage - 1) * pageSize, studentPage * pageSize)

  useEffect(() => {
    if (studentPage > totalStudentPages) setStudentPage(totalStudentPages)
  }, [studentPage, totalStudentPages])

  const resetStudentForm = () => {
    setEditingStudentId('')
    setStudentForm({
      name: '',
      phone: '',
      grade: '',
      school: '',
      guardianName: '',
      guardianPhone: '',
      address: '',
      memo: '',
    })
  }

  const submitStudent = (e: FormEvent) => {
    e.preventDefault()
    if (!studentForm.name || !studentForm.grade) {
      setError('학생 이름, 학년은 필수입니다.')
      return
    }

    if (editingStudentId) {
      updateDb((prev) => ({
        ...prev,
        students: prev.students.map((s) =>
          s.id === editingStudentId ? { ...s, ...studentForm } : s,
        ),
      }), '학생 수정', studentForm.name)
    } else {
      const next: Student = {
        id: uid('stu'),
        ...studentForm,
        isWithdrawn: false,
        withdrawnAt: '',
        createdAt: new Date().toISOString(),
      }
      updateDb((prev) => ({ ...prev, students: [next, ...prev.students] }), '학생 등록', next.name)
    }

    resetStudentForm()
  }

  const startEditStudent = (student: Student) => {
    setEditingStudentId(student.id)
    setStudentForm({
      name: student.name,
      phone: student.phone,
      grade: student.grade,
      school: student.school,
      guardianName: student.guardianName,
      guardianPhone: student.guardianPhone,
      address: student.address,
      memo: student.memo,
    })
  }

  const deleteStudent = (studentId: string) => {
    const targetStudent = studentMap.get(studentId)
    if (!window.confirm(`${targetStudent?.name ?? '해당'} 학생을 삭제하면 관련 데이터도 함께 삭제됩니다. 진행할까요?`)) return
    updateDb((prev) => ({
      ...prev,
      students: prev.students.filter((s) => s.id !== studentId),
      enrollments: prev.enrollments.filter((x) => x.studentId !== studentId),
      attendances: prev.attendances.filter((x) => x.studentId !== studentId),
      grades: prev.grades.filter((x) => x.studentId !== studentId),
      payments: prev.payments.filter((x) => x.studentId !== studentId),
      counsels: prev.counsels.filter((x) => x.studentId !== studentId),
      makeups: prev.makeups.filter((x) => x.studentId !== studentId),
    }), '학생 삭제', studentId)
    if (selectedStudentId === studentId) {
      setSelectedStudentId('')
      setMenu('students')
    }
  }

  const withdrawStudent = (studentId: string) => {
    const targetStudent = studentMap.get(studentId)
    if (!targetStudent || targetStudent.isWithdrawn) return
    if (!window.confirm(`${targetStudent.name} 학생을 퇴원 처리할까요? 활성 배정 수업에서 자동 제외되며, 출결/보강 데이터는 유지됩니다.`)) return

    updateDb((prev) => ({
      ...prev,
      students: prev.students.map((student) =>
        student.id === studentId
          ? { ...student, isWithdrawn: true, withdrawnAt: today }
          : student,
      ),
      enrollments: prev.enrollments.map((enrollment) =>
        enrollment.studentId === studentId && !enrollment.endDate
          ? { ...enrollment, endDate: today }
          : enrollment,
      ),
    }), '학생 퇴원', targetStudent.name)
    setNotice(`${targetStudent.name} 학생을 퇴원 처리했고, 배정 수업에서 제외했습니다.`)
  }

  const restoreStudent = (studentId: string) => {
    const targetStudent = studentMap.get(studentId)
    if (!targetStudent || !targetStudent.isWithdrawn) return
    if (!window.confirm(`${targetStudent.name} 학생을 재원 상태로 복원할까요?`)) return

    updateDb((prev) => ({
      ...prev,
      students: prev.students.map((student) =>
        student.id === studentId
          ? { ...student, isWithdrawn: false, withdrawnAt: '' }
          : student,
      ),
    }), '학생 복원', targetStudent.name)
    setNotice(`${targetStudent.name} 학생을 재원 상태로 복원했습니다.`)
  }

  const resetStudentSessions = (studentId: string) => {
    const targetStudent = studentMap.get(studentId)
    if (!targetStudent) return
    if (!window.confirm(`${targetStudent.name} 학생의 체크 회차를 초기화할까요? (정규 출결 및 연동 보강 데이터가 정리됩니다.)`)) {
      return
    }

    updateDb((prev) => {
      const targetRegularAttendances = prev.attendances.filter(
        (attendance) => attendance.studentId === studentId && attendance.type === '정규',
      )
      const targetAttendanceIds = new Set(targetRegularAttendances.map((attendance) => attendance.id))

      const removedMakeups = prev.makeups.filter((makeup) =>
        targetAttendanceIds.has(makeup.absentAttendanceId),
      )
      const removedMakeupIds = new Set(removedMakeups.map((makeup) => makeup.id))

      return {
        ...prev,
        attendances: prev.attendances.filter(
          (attendance) =>
            !(
              (attendance.studentId === studentId && attendance.type === '정규') ||
              (attendance.type === '보강' && attendance.makeupId && removedMakeupIds.has(attendance.makeupId))
            ),
        ),
        makeups: prev.makeups.filter((makeup) => !targetAttendanceIds.has(makeup.absentAttendanceId)),
      }
    })
    setNotice(`${targetStudent.name} 학생의 체크 회차를 초기화했습니다.`)
  }

  const saveSessionEdit = (studentId: string, checkedSessions: number) => {
    const parsed = parseInt(editingSessionValue, 10)
    if (isNaN(parsed) || parsed < 0) {
      setError('회차는 0 이상의 숫자여야 합니다.')
      setEditingSessionStudentId(null)
      return
    }
    const newOffset = parsed - checkedSessions
    const targetStudent = studentMap.get(studentId)
    updateDb(
      (prev) => ({
        ...prev,
        students: prev.students.map((s) =>
          s.id === studentId ? { ...s, sessionOffset: newOffset } : s,
        ),
      }),
      '회차 수동 수정',
      `${targetStudent?.name ?? studentId}: ${checkedSessions + (targetStudent?.sessionOffset ?? 0)}회 → ${parsed}회`,
    )
    setEditingSessionStudentId(null)
    setNotice(`회차가 ${parsed}회로 수정되었습니다.`)
  }

  const submitClass = (e: FormEvent) => {
    e.preventDefault()
    if (!classForm.subject || !classForm.teacher || !classForm.day || !classForm.startTime || !classForm.endTime) {
      setError('수업명, 강사, 요일, 시간은 필수입니다.')
      return
    }
    if (classForm.startTime >= classForm.endTime) {
      setError('종료시간은 시작시간보다 늦어야 합니다.')
      return
    }
    if (classForm.capacity <= 0) {
      setError('정원은 1명 이상이어야 합니다.')
      return
    }

    const mergedTime = `${classForm.startTime}-${classForm.endTime}`

    if (editingClassId) {
      updateDb((prev) => ({
        ...prev,
        classes: prev.classes.map((c) =>
          c.id === editingClassId
            ? {
                ...c,
                subject: classForm.subject,
                teacher: classForm.teacher,
                day: classForm.day,
                time: mergedTime,
                room: classForm.room,
                capacity: classForm.capacity,
                memo: classForm.memo,
              }
            : c,
        ),
      }), '수업 수정', classForm.subject)
    } else {
      const next: AcademyClass = {
        id: uid('class'),
        subject: classForm.subject,
        teacher: classForm.teacher,
        day: classForm.day,
        time: mergedTime,
        room: classForm.room,
        capacity: classForm.capacity,
        memo: classForm.memo,
        createdAt: new Date().toISOString(),
      }
      updateDb((prev) => ({ ...prev, classes: [next, ...prev.classes] }), '수업 등록', next.subject)
    }

    setEditingClassId('')
    setClassForm({
      subject: '',
      teacher: '',
      day: '',
      startTime: '',
      endTime: '',
      room: '',
      capacity: 7,
      memo: '',
    })
  }

  const startEditClass = (item: AcademyClass) => {
    const [startTime = '', endTime = ''] = item.time.split('-')
    setEditingClassId(item.id)
    setClassForm({
      subject: item.subject,
      teacher: item.teacher,
      day: item.day,
      startTime,
      endTime,
      room: item.room,
      capacity: item.capacity,
      memo: item.memo,
    })
  }

  const deleteClass = (classId: string) => {
    if (!window.confirm('수업을 삭제하면 배정/출결/보강 데이터도 함께 삭제됩니다. 진행할까요?')) return
    updateDb((prev) => ({
      ...prev,
      classes: prev.classes.filter((c) => c.id !== classId),
      enrollments: prev.enrollments.filter((x) => x.classId !== classId),
      attendances: prev.attendances.filter((x) => x.classId !== classId),
      makeups: prev.makeups.filter((x) => x.classId !== classId),
    }), '수업 삭제', classId)
    if (assignClassId === classId) setAssignClassId('')
  }

  const submitEnrollment = (e: FormEvent) => {
    e.preventDefault()
    if (!assignClassId || !assignForm.studentId) {
      setError('수업과 학생을 선택해 주세요.')
      return
    }

    const exists = activeEnrollmentByStudentClass.get(`${assignForm.studentId}_${assignClassId}`)
    if (exists) {
      setError('이미 배정된 학생입니다.')
      return
    }

    const classEnrollmentCount = db.enrollments.filter((x) => x.classId === assignClassId && !x.endDate).length
    const cls = classMap.get(assignClassId)
    if (cls && classEnrollmentCount >= cls.capacity) {
      setError('정원이 가득 찼습니다.')
      return
    }

    const next: Enrollment = {
      id: uid('enroll'),
      classId: assignClassId,
      studentId: assignForm.studentId,
      startDate: assignForm.startDate,
      endDate: '',
      createdAt: new Date().toISOString(),
    }
    updateDb((prev) => ({ ...prev, enrollments: [next, ...prev.enrollments] }), '학생 배정', `${assignClassId}:${assignForm.studentId}`)
    setAssignForm({
      studentId: '',
      startDate: today,
    })
  }

  const removeEnrollment = (enrollmentId: string) => {
    if (!window.confirm('수업에서 제외할까요? 종료일자가 오늘 날짜로 자동 저장됩니다.')) return
    updateDb((prev) => ({
      ...prev,
      enrollments: prev.enrollments.map((x) =>
        x.id === enrollmentId ? { ...x, endDate: today } : x,
      ),
    }), '배정 해제', enrollmentId)
  }

  const submitAttendance = (e: FormEvent) => {
    e.preventDefault()
    if (!attendanceForm.classId || !attendanceForm.time) {
      setError('수업과 시간을 선택해 주세요.')
      return
    }

    if (selectedAttendanceClassStudents.length === 0) {
      setError('선택한 수업에 배정된 학생이 없습니다.')
      return
    }

    const hasSelectedStatus = selectedAttendanceClassStudents.some((student) => {
      const draft = attendanceDrafts[student.id]
      return Boolean(draft?.status)
    })
    if (!hasSelectedStatus) {
      setError('상태를 하나도 선택하지 않았습니다.')
      return
    }

    let insertedCount = 0
    let updatedCount = 0
    let makeupCount = 0

    updateDb((prev) => {
      const nextAttendances = [...prev.attendances]
      let nextMakeups = [...prev.makeups]

      selectedAttendanceClassStudents.forEach((student) => {
        const draft = attendanceDrafts[student.id] ?? {
          status: '',
          memo: '',
          createMakeup: false,
          makeupDate: attendanceForm.date,
        }

        if (!draft.status) {
          return
        }

        const attendanceIndex = nextAttendances.findIndex(
          (attendance) =>
            attendance.classId === attendanceForm.classId &&
            attendance.studentId === student.id &&
            attendance.date === attendanceForm.date &&
            attendance.type === '정규',
        )

        const attendanceId =
          attendanceIndex >= 0 ? nextAttendances[attendanceIndex].id : uid('att')

        const attendanceRecord: Attendance = {
          id: attendanceId,
          date: attendanceForm.date,
          time: attendanceForm.time,
          classId: attendanceForm.classId,
          studentId: student.id,
          status: draft.status,
          type: '정규',
          memo: draft.memo,
          createdAt:
            attendanceIndex >= 0
              ? nextAttendances[attendanceIndex].createdAt
              : new Date().toISOString(),
        }

        if (attendanceIndex >= 0) {
          nextAttendances[attendanceIndex] = attendanceRecord
          updatedCount += 1
        } else {
          nextAttendances.unshift(attendanceRecord)
          insertedCount += 1
        }

        const plannedMakeupIndex = nextMakeups.findIndex(
          (makeup) => makeup.absentAttendanceId === attendanceId && makeup.status === '예정',
        )

        if (draft.status === '결석' && draft.createMakeup) {
          if (plannedMakeupIndex >= 0) {
            nextMakeups[plannedMakeupIndex] = {
              ...nextMakeups[plannedMakeupIndex],
              scheduledDate: draft.makeupDate,
              memo: draft.memo || nextMakeups[plannedMakeupIndex].memo,
            }
          } else {
            nextMakeups.unshift({
              id: uid('makeup'),
              studentId: student.id,
              classId: attendanceForm.classId,
              absentAttendanceId: attendanceId,
              scheduledDate: draft.makeupDate,
              status: '예정',
              attended: false,
              memo: draft.memo || '결석 보강 자동 생성',
              createdAt: new Date().toISOString(),
            })
            makeupCount += 1
          }
        } else if (plannedMakeupIndex >= 0) {
          nextMakeups = nextMakeups.filter(
            (makeup) => !(makeup.absentAttendanceId === attendanceId && makeup.status === '예정'),
          )
        }
      })

      return {
        ...prev,
        attendances: nextAttendances,
        makeups: nextMakeups,
      }
    }, '출결 저장', `${attendanceForm.classId}:${attendanceForm.date}`)

    setNotice(`출결 저장 완료: ${insertedCount}건 신규, ${updatedCount}건 수정, ${makeupCount}건 보강 예정 생성`)

    setAttendanceForm({
      date: today,
      classId: '',
      time: '',
    })
    setAttendanceDrafts({})
  }

  const markAllAttendancePresent = () => {
    if (!attendanceForm.classId) {
      setError('수업을 먼저 선택해 주세요.')
      return
    }
    if (selectedAttendanceClassStudents.length === 0) {
      setError('선택한 수업에 배정된 학생이 없습니다.')
      return
    }

    setAttendanceDrafts((prev) => {
      const nextDrafts = { ...prev }
      selectedAttendanceClassStudents.forEach((student) => {
        const current = nextDrafts[student.id] ?? {
          status: '' as AttendanceStatus | '',
          memo: '',
          createMakeup: false,
          makeupDate: attendanceForm.date,
        }

        nextDrafts[student.id] = {
          ...current,
          status: '출석',
          createMakeup: false,
          makeupDate: current.makeupDate || attendanceForm.date,
        }
      })
      return nextDrafts
    })

    setNotice('선택한 수업의 배정 학생들을 모두 출석으로 표시했습니다.')
  }

  const clearAllAttendanceDrafts = () => {
    if (!attendanceForm.classId) {
      setError('수업을 먼저 선택해 주세요.')
      return
    }
    if (selectedAttendanceClassStudents.length === 0) {
      setError('선택한 수업에 배정된 학생이 없습니다.')
      return
    }

    setAttendanceDrafts((prev) => {
      const nextDrafts = { ...prev }
      selectedAttendanceClassStudents.forEach((student) => {
        const current = nextDrafts[student.id] ?? {
          status: '' as AttendanceStatus | '',
          memo: '',
          createMakeup: false,
          makeupDate: attendanceForm.date,
        }

        nextDrafts[student.id] = {
          ...current,
          status: '',
          createMakeup: false,
        }
      })
      return nextDrafts
    })

    setNotice('선택한 수업의 배정 학생 출석 상태를 모두 해제했습니다.')
  }

  const submitGrade = (e: FormEvent) => {
    e.preventDefault()
    if (!gradeForm.studentId || !gradeForm.subject) {
      setError('학생과 과목은 필수입니다.')
      return
    }
    if (gradeForm.score < 0 || gradeForm.score > 100) {
      setError('점수는 0~100 사이여야 합니다.')
      return
    }
    const next: Grade = { id: uid('grade'), ...gradeForm, createdAt: new Date().toISOString() }
    updateDb((prev) => ({ ...prev, grades: [next, ...prev.grades] }), '성적 등록', gradeForm.subject)
    setGradeForm({ studentId: '', subject: '', date: today, score: 80, memo: '' })
  }

  const submitPayment = (e: FormEvent) => {
    e.preventDefault()
    if (!paymentForm.studentId || !paymentForm.month) {
      setError('학생과 월 정보는 필수입니다.')
      return
    }
    if (paymentForm.amount <= 0) {
      setError('수강료는 1원 이상이어야 합니다.')
      return
    }
    const next: Payment = { id: uid('pay'), ...paymentForm, createdAt: new Date().toISOString() }
    updateDb((prev) => ({ ...prev, payments: [next, ...prev.payments] }), '납부 등록', paymentForm.month)
    setPaymentForm({ studentId: '', month: today.slice(0, 7), amount: 0, status: '완납', memo: '' })
  }

  const submitCounsel = (e: FormEvent) => {
    e.preventDefault()
    if (!counselForm.studentId || !counselForm.content) {
      setError('학생과 상담 내용은 필수입니다.')
      return
    }
    const next: Counsel = { id: uid('counsel'), ...counselForm, createdAt: new Date().toISOString() }
    updateDb((prev) => ({ ...prev, counsels: [next, ...prev.counsels] }), '상담 등록', counselForm.date)
    setCounselForm({ studentId: '', date: today, withGuardian: true, content: '' })
  }

  const submitNote = (e: FormEvent) => {
    e.preventDefault()
    if (!noteForm.content.trim()) {
      setError('공지/메모 내용을 입력해 주세요.')
      return
    }
    const next: Note = {
      id: uid('note'),
      date: noteForm.date,
      content: noteForm.content,
      createdAt: new Date().toISOString(),
    }
    updateDb((prev) => ({ ...prev, notes: [next, ...prev.notes] }), '메모 등록', noteForm.date)
    setNoteForm({ date: today, content: '' })
  }

  const submitMakeup = (e: FormEvent) => {
    e.preventDefault()
    const absentAttendance = db.attendances.find((a) => a.id === makeupForm.absentAttendanceId)
    if (!absentAttendance) {
      setError('결석 수업을 선택해 주세요.')
      return
    }
    const selectedMakeupClass = classMap.get(makeupForm.makeupClassId)
    if (!selectedMakeupClass) {
      setError('보강을 들을 수업을 선택해 주세요.')
      return
    }
    const scheduledWeekDay = getWeekDayFromDate(makeupForm.scheduledDate)
    if (!scheduledWeekDay || !splitClassDays(selectedMakeupClass.day).includes(scheduledWeekDay)) {
      setError('선택한 날짜에 있는 수업만 보강으로 등록할 수 있습니다.')
      return
    }
    const already = db.makeups.find((m) => m.absentAttendanceId === absentAttendance.id && m.status !== '완료')
    if (already) {
      setError('이미 보강 예정으로 등록된 결석 수업입니다.')
      return
    }

    const next: Makeup = {
      id: uid('makeup'),
      studentId: absentAttendance.studentId,
      classId: makeupForm.makeupClassId,
      absentAttendanceId: absentAttendance.id,
      scheduledDate: makeupForm.scheduledDate,
      status: '예정',
      attended: false,
      memo: makeupForm.memo,
      createdAt: new Date().toISOString(),
    }
    updateDb((prev) => ({ ...prev, makeups: [next, ...prev.makeups] }), '보강 등록', next.scheduledDate)
    setMakeupForm({ absentAttendanceId: '', scheduledDate: today, makeupClassId: '', memo: '' })
  }

  const completeMakeup = (makeupId: string, attended: boolean) => {
    const makeup = db.makeups.find((m) => m.id === makeupId)
    if (!makeup) return

    const attendanceRecord: Attendance | null = attended
      ? {
          id: uid('att'),
          date: makeup.scheduledDate,
          time: classMap.get(makeup.classId)?.time.split('-')[0] ?? '',
          classId: makeup.classId,
          studentId: makeup.studentId,
          status: '출석',
          type: '보강',
          memo: '보강 출석',
          makeupId: makeup.id,
          createdAt: new Date().toISOString(),
        }
      : null

    updateDb((prev) => ({
      ...prev,
      makeups: prev.makeups.map((m) =>
        m.id === makeupId ? { ...m, status: '완료', attended } : m,
      ),
      attendances: attendanceRecord ? [attendanceRecord, ...prev.attendances] : prev.attendances,
    }), '보강 완료', makeupId)
  }

  const changeMakeupSchedule = (makeupId: string) => {
    const nextDate = makeupScheduleDraft[makeupId]
    if (!nextDate) {
      setError('변경할 보강 일자를 선택해 주세요.')
      return
    }
    updateDb((prev) => ({
      ...prev,
      makeups: prev.makeups.map((m) =>
        m.id === makeupId && m.status === '예정' ? { ...m, scheduledDate: nextDate } : m,
      ),
    }), '보강 일정 변경', makeupId)
  }

  const changeMakeupClass = (makeupId: string) => {
    const nextClassId = makeupClassDraft[makeupId]
    if (!nextClassId) {
      setError('변경할 보강 수업을 선택해 주세요.')
      return
    }

    const makeup = db.makeups.find((item) => item.id === makeupId)
    const nextClass = classMap.get(nextClassId)
    if (!makeup || !nextClass) {
      setError('선택한 보강 수업을 찾을 수 없습니다.')
      return
    }

    const scheduledWeekDay = getWeekDayFromDate(makeup.scheduledDate)
    if (!scheduledWeekDay || !splitClassDays(nextClass.day).includes(scheduledWeekDay)) {
      setError('선택한 날짜에 있는 수업만 보강으로 선택할 수 있습니다.')
      return
    }

    updateDb((prev) => ({
      ...prev,
      makeups: prev.makeups.map((makeup) =>
        makeup.id === makeupId && makeup.status === '예정'
          ? { ...makeup, classId: nextClassId }
          : makeup,
      ),
    }), '보강 수업 변경', makeupId)
  }

  const cancelMakeup = (makeupId: string) => {
    const targetMakeup = db.makeups.find((makeup) => makeup.id === makeupId)
    if (!targetMakeup) return

    if (targetMakeup.status !== '예정') {
      setError('예정 상태인 보강만 취소할 수 있습니다.')
      return
    }

    if (!window.confirm('이 보강 예정과 관련 메모를 삭제할까요?')) {
      return
    }

    updateDb((prev) => ({
      ...prev,
      makeups: prev.makeups.filter((makeup) => makeup.id !== makeupId),
    }), '보강 취소', makeupId)

    setNotice('보강 예정이 취소되었습니다.')
  }

  const cancelAttendanceRecord = (attendanceId: string) => {
    const targetAttendance = db.attendances.find((attendance) => attendance.id === attendanceId)
    if (!targetAttendance) return

    const linkedMakeups =
      targetAttendance.type === '정규'
        ? db.makeups.filter((makeup) => makeup.absentAttendanceId === attendanceId)
        : []
    const confirmMessage =
      targetAttendance.type === '정규' && linkedMakeups.length > 0
        ? '이 결석을 취소하면 연결된 보강 예약과 보강 출결도 함께 삭제됩니다. 계속할까요?'
        : '해당 출결 기록을 취소할까요?'

    if (!window.confirm(confirmMessage)) {
      return
    }

    updateDb((prev) => {
      if (targetAttendance.type === '정규') {
        const linkedMakeups = prev.makeups.filter(
          (makeup) => makeup.absentAttendanceId === attendanceId,
        )
        const linkedMakeupIds = new Set(linkedMakeups.map((makeup) => makeup.id))

        return {
          ...prev,
          attendances: prev.attendances.filter(
            (attendance) =>
              attendance.id !== attendanceId &&
              !(
                attendance.type === '보강' &&
                attendance.makeupId &&
                linkedMakeupIds.has(attendance.makeupId)
              ),
          ),
          makeups: prev.makeups.filter((makeup) => makeup.absentAttendanceId !== attendanceId),
        }
      }

      if (targetAttendance.makeupId) {
        return {
          ...prev,
          attendances: prev.attendances.filter((attendance) => attendance.id !== attendanceId),
          makeups: prev.makeups.map((makeup) =>
            makeup.id === targetAttendance.makeupId
              ? { ...makeup, status: '예정', attended: false }
              : makeup,
          ),
        }
      }

      return {
        ...prev,
        attendances: prev.attendances.filter((attendance) => attendance.id !== attendanceId),
      }
    }, '출결 취소', attendanceId)

    setNotice('출결 기록을 취소했습니다.')
  }

  const selectedStudent = db.students.find((s) => s.id === selectedStudentId)

  const regularAbsents = db.attendances.filter((a) => a.type === '정규' && a.status === '결석')

  const renderDashboard = () => {
    const recentStudents = byRecent(db.students).slice(0, 5)
    const recentCounsels = byRecent(db.counsels).slice(0, 5)
    const recentNotes = byRecent(db.notes).slice(0, 5)

    const billingNoticeStudents = db.students
      .filter((student) => !student.isWithdrawn)
      .map((student) => {
        const checkedSessions = db.attendances.filter(
          (attendance) =>
            attendance.studentId === student.id &&
            attendance.type === '정규' &&
            DEDUCT_STATUSES.includes(attendance.status),
        ).length
        const totalSessions = checkedSessions + (student.sessionOffset ?? 0)
        return { student, totalSessions }
      })
      .filter(({ totalSessions }) => totalSessions >= 0 && totalSessions % 4 === 0)
      .sort((a, b) => {
        if (a.totalSessions !== b.totalSessions) return b.totalSessions - a.totalSessions
        return a.student.name.localeCompare(b.student.name, 'ko-KR')
      })

    const todayStatusCount = {
      출석: todayAttendances.filter((x) => x.status === '출석').length,
      지각: todayAttendances.filter((x) => x.status === '지각').length,
      결석: todayAttendances.filter((x) => x.status === '결석').length,
      조퇴: todayAttendances.filter((x) => x.status === '조퇴').length,
    }

    return (
      <div className="panel-grid">
        <section className="stats-grid">
          <article className="stat-card">
            <h3>전체 학생 수</h3>
            <strong>{db.students.length}명</strong>
          </article>
          <article className="stat-card">
            <h3>전체 수업 수</h3>
            <strong>{db.classes.length}개</strong>
          </article>
          <article className="stat-card">
            <h3>오늘 출결</h3>
            <strong>{todayAttendances.length}건</strong>
            <p>출석 {todayStatusCount.출석} / 지각 {todayStatusCount.지각} / 결석 {todayStatusCount.결석}</p>
          </article>
          <article className="stat-card">
            <h3>미납자 수</h3>
            <strong>{unpaidCount}명</strong>
          </article>
        </section>

        <section className="card">
          <h3>최근 등록 학생</h3>
          <ul className="line-list">
            {recentStudents.map((s) => (
              <li key={s.id}>
                <span>{s.name}</span>
                <small>{s.grade} · {s.school}</small>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h3>최근 상담 기록</h3>
          <ul className="line-list">
            {recentCounsels.map((c) => (
              <li key={c.id}>
                <span>{studentMap.get(c.studentId)?.name ?? '삭제된 학생'}</span>
                <small>{c.date} · {c.content}</small>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h3>최근 공지/메모</h3>
          <ul className="line-list">
            {recentNotes.map((n) => (
              <li key={n.id}>
                <span>{n.content}</span>
                <small>{n.date}</small>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h3>수강료 발송대상</h3>
          <ul className="line-list">
            {billingNoticeStudents.length === 0 ? (
              <li>
                <span>대상 없음</span>
                <small>전체체크회차가 4의 배수인 학생이 없습니다.</small>
              </li>
            ) : (
              billingNoticeStudents.map(({ student, totalSessions }) => (
                <li key={student.id}>
                  <span>{student.name}</span>
                  <small>{student.grade} · {student.school} · 전체체크회차 {totalSessions}회</small>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="card">
          <h3>주간 시간표</h3>
          <div className="table-wrap timetable-wrap">
            <table className="timetable">
              <thead>
                <tr>
                  <th className="time-col">시간</th>
                  {WEEK_DAYS.map((day) => (
                    <th key={day}>{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HOUR_TIME_OPTIONS.map((slot) => {
                  const hour = Number(slot.slice(0, 2))
                  return (
                    <tr key={slot}>
                      <th className="time-col">{slot}</th>
                      {WEEK_DAYS.map((day) => {
                        const entries = weeklyTimetable.get(`${day}_${hour}`) ?? []
                        return (
                          <td key={`${day}_${slot}`}>
                            {entries.length ? (
                              <div className="timetable-cell-list">
                                {entries.map((entry) => {
                                  const studentLabel = entry.sessionType === '보강' ? '보강 대상' : '학생'
                                  const absentStudentIds = todayAbsentStudentsByClass.get(entry.classId) ?? new Set<string>()

                                  return (
                                    <article key={`${entry.classId}_${day}_${slot}`} className="timetable-item">
                                      <strong>
                                        {entry.subject}
                                        <span className={`badge ${entry.sessionType === '보강' ? 'makeup' : 'ok'}`}>
                                          {entry.sessionType}
                                        </span>
                                      </strong>
                                      <small>{entry.time} · {entry.teacher}</small>
                                      <small>
                                        {studentLabel}:{' '}
                                        {entry.students.length > 0
                                          ? entry.students.map((student, index) => (
                                              <span key={student.id}>
                                                <span
                                                  className={
                                                    entry.sessionType === '정규' && absentStudentIds.has(student.id)
                                                      ? 'student-name absent'
                                                      : 'student-name'
                                                  }
                                                >
                                                  {student.name}
                                                </span>
                                                {index < entry.students.length - 1 ? ', ' : ''}
                                              </span>
                                            ))
                                          : '-'}
                                      </small>
                                    </article>
                                  )
                                })}
                              </div>
                            ) : (
                              <span className="timetable-empty">-</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    )
  }

  const renderStudents = () => (
    <div className="panel-grid">
      <section className="card form-card">
        <h3>{editingStudentId ? '학생 정보 수정' : '학생 등록'}</h3>
        <div className="actions upload-actions">
          <label className="btn ghost file-btn">
            학생 엑셀 일괄등록(.xlsx)
            <input type="file" accept=".xlsx,.xls" onChange={handleStudentExcelImport} />
          </label>
        </div>
        <form className="grid-form" onSubmit={submitStudent}>
          <input
            placeholder="이름"
            value={studentForm.name}
            onChange={(e) => setStudentForm((f) => ({ ...f, name: e.target.value }))}
          />
          <input
            placeholder="연락처"
            value={studentForm.phone}
            onChange={(e) => setStudentForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <input
            placeholder="학년"
            value={studentForm.grade}
            onChange={(e) => setStudentForm((f) => ({ ...f, grade: e.target.value }))}
          />
          <input
            placeholder="학교"
            value={studentForm.school}
            onChange={(e) => setStudentForm((f) => ({ ...f, school: e.target.value }))}
          />
          <input
            placeholder="보호자 이름"
            value={studentForm.guardianName}
            onChange={(e) => setStudentForm((f) => ({ ...f, guardianName: e.target.value }))}
          />
          <input
            placeholder="보호자 연락처"
            value={studentForm.guardianPhone}
            onChange={(e) => setStudentForm((f) => ({ ...f, guardianPhone: e.target.value }))}
          />
          <input
            className="span-2"
            placeholder="주소"
            value={studentForm.address}
            onChange={(e) => setStudentForm((f) => ({ ...f, address: e.target.value }))}
          />
          <textarea
            className="span-2"
            placeholder="메모"
            value={studentForm.memo}
            onChange={(e) => setStudentForm((f) => ({ ...f, memo: e.target.value }))}
          />
          <div className="actions span-2">
            <button type="submit" className="btn primary">{editingStudentId ? '수정 저장' : '등록'}</button>
            <button type="button" className="btn ghost" onClick={resetStudentForm}>초기화</button>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="table-topbar">
          <h3>학생 목록</h3>
          <div className="filters">
            <input
              placeholder="학생명/연락처/학교 검색"
              value={studentSearch}
              onChange={(e) => {
                setStudentSearch(e.target.value)
                setStudentPage(1)
              }}
            />
            <SearchableSelect
              value={studentGradeFilter}
              onChange={(value) => {
                setStudentGradeFilter(value || '전체')
                setStudentPage(1)
              }}
              placeholder="학년 검색/선택"
              options={gradeFilterOptions}
              emptyMessage="학년 검색 결과가 없습니다."
            />
            <SearchableSelect
              value={studentSort}
              onChange={(value) => setStudentSort((value || 'createdAt') as 'name' | 'createdAt')}
              placeholder="정렬 방식 선택"
              options={STUDENT_SORT_OPTIONS}
              emptyMessage="정렬 옵션이 없습니다."
            />
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>이름</th>
                <th>학년/학교</th>
                <th>상태</th>
                <th>연락처</th>
                <th>보호자</th>
                <th>배정 수업</th>
                <th>전체 체크 회차</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {pagedStudents.map((s) => {
                const assigned = db.enrollments.filter((e) => e.studentId === s.id && !e.endDate)
                const checkedSessions = db.attendances.filter(
                  (a) => a.studentId === s.id && a.type === '정규' && DEDUCT_STATUSES.includes(a.status),
                ).length
                const absentSessions = db.attendances.filter(
                  (a) => a.studentId === s.id && a.type === '정규' && a.status === '결석',
                ).length
                const totalSessions = checkedSessions + (s.sessionOffset ?? 0)
                const isEditingSession = editingSessionStudentId === s.id
                return (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.grade} / {s.school}</td>
                    <td>{s.isWithdrawn ? `퇴원 (${s.withdrawnAt || '-'})` : '재원'}</td>
                    <td>{s.phone}</td>
                    <td>{s.guardianName} ({s.guardianPhone})</td>
                    <td>{assigned.length}개</td>
                    <td>
                      {isEditingSession ? (
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input
                            type="number"
                            min={0}
                            style={{ width: 60, padding: '2px 4px', fontSize: 13 }}
                            value={editingSessionValue}
                            onChange={(e) => setEditingSessionValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveSessionEdit(s.id, checkedSessions)
                              if (e.key === 'Escape') setEditingSessionStudentId(null)
                            }}
                            autoFocus
                          />
                            <button className="btn mini" onClick={() => saveSessionEdit(s.id, checkedSessions)}>저장</button>
                            <button className="btn mini" onClick={() => setEditingSessionStudentId(null)}>취소</button>
                          </span>
                          <small style={{ color: '#7a8a99' }}>결석 {absentSessions}회</small>
                        </span>
                      ) : (
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {totalSessions}회
                            {(s.sessionOffset ?? 0) !== 0 && (
                              <span style={{ fontSize: 11, color: '#888' }}>
                                (자동 {checkedSessions}회{s.sessionOffset! > 0 ? ` +${s.sessionOffset}` : ` ${s.sessionOffset}`})
                              </span>
                            )}
                            <button
                              className="btn mini"
                              onClick={() => {
                                setEditingSessionStudentId(s.id)
                                setEditingSessionValue(String(totalSessions))
                              }}
                            >
                              수정
                            </button>
                          </span>
                          <small style={{ color: '#7a8a99' }}>결석 {absentSessions}회</small>
                        </span>
                      )}
                    </td>
                    <td className="row-actions">
                      <button
                        className="btn mini"
                        onClick={() => {
                          setSelectedStudentId(s.id)
                          setMenu('studentDetail')
                        }}
                      >
                        상세
                      </button>
                      <button className="btn mini" onClick={() => startEditStudent(s)}>수정</button>
                      <button
                        className="btn mini"
                        onClick={() => (s.isWithdrawn ? restoreStudent(s.id) : withdrawStudent(s.id))}
                      >
                        {s.isWithdrawn ? '복원' : '퇴원처리'}
                      </button>
                      <button className="btn mini" onClick={() => resetStudentSessions(s.id)}>회차 초기화</button>
                      <button className="btn mini danger" onClick={() => deleteStudent(s.id)}>삭제</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="pager">
          <button className="btn mini" disabled={studentPage === 1} onClick={() => setStudentPage((p) => p - 1)}>이전</button>
          <span>{studentPage} / {totalStudentPages}</span>
          <button className="btn mini" disabled={studentPage === totalStudentPages} onClick={() => setStudentPage((p) => p + 1)}>다음</button>
        </div>
      </section>
    </div>
  )

  const renderClasses = () => {
    const selectedClassEnrollments = db.enrollments.filter((e) => e.classId === assignClassId && !e.endDate)
    const availableStudents = db.students.filter(
      (s) => !s.isWithdrawn && !activeEnrollmentByStudentClass.has(`${s.id}_${assignClassId}`),
    )

    return (
      <div className="panel-grid">
        <section className="card form-card">
          <h3>{editingClassId ? '수업 정보 수정' : '수업 등록'}</h3>
          <form className="grid-form" onSubmit={submitClass}>
            <input placeholder="과목명" value={classForm.subject} onChange={(e) => setClassForm((f) => ({ ...f, subject: e.target.value }))} />
            <input placeholder="강사" value={classForm.teacher} onChange={(e) => setClassForm((f) => ({ ...f, teacher: e.target.value }))} />
            <SearchableSelect
              value={classForm.day}
              onChange={(value) => setClassForm((f) => ({ ...f, day: value }))}
              placeholder="요일 검색/선택"
              options={classDayOptions}
              emptyMessage="요일 검색 결과가 없습니다."
            />
            <SearchableSelect
              value={classForm.startTime}
              onChange={(value) => setClassForm((f) => ({ ...f, startTime: value }))}
              placeholder="시작시간 검색/선택"
              options={classStartTimeOptions}
              emptyMessage="시작시간 검색 결과가 없습니다."
            />
            <SearchableSelect
              value={classForm.endTime}
              onChange={(value) => setClassForm((f) => ({ ...f, endTime: value }))}
              placeholder="종료시간 검색/선택"
              options={classEndTimeOptions}
              emptyMessage="종료시간 검색 결과가 없습니다."
            />
            <input placeholder="강의실" value={classForm.room} onChange={(e) => setClassForm((f) => ({ ...f, room: e.target.value }))} />
            <input
              type="number"
              placeholder="정원"
              value={classForm.capacity}
              onChange={(e) => setClassForm((f) => ({ ...f, capacity: Number(e.target.value) }))}
            />
            <textarea className="span-2" placeholder="수업 메모" value={classForm.memo} onChange={(e) => setClassForm((f) => ({ ...f, memo: e.target.value }))} />
            <div className="actions span-2">
              <button type="submit" className="btn primary">{editingClassId ? '수정 저장' : '등록'}</button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setEditingClassId('')
                  setClassForm({
                    subject: '',
                    teacher: '',
                    day: '',
                    startTime: '',
                    endTime: '',
                    room: '',
                    capacity: 7,
                    memo: '',
                  })
                }}
              >
                초기화
              </button>
            </div>
          </form>
        </section>

        <section className="card">
          <h3>수업 목록</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>수업명</th>
                  <th>강사</th>
                  <th>요일/시간</th>
                  <th>강의실</th>
                  <th>정원</th>
                  <th>수강생</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {db.classes.map((c) => {
                  const cnt = db.enrollments.filter((e) => e.classId === c.id && !e.endDate).length
                  return (
                    <tr key={c.id}>
                      <td>{c.subject}</td>
                      <td>{c.teacher}</td>
                      <td>{c.day} / {c.time}</td>
                      <td>{c.room}</td>
                      <td>{cnt}/{c.capacity}</td>
                      <td>{cnt}명</td>
                      <td className="row-actions">
                        <button className="btn mini" onClick={() => setAssignClassId(c.id)}>학생관리</button>
                        <button className="btn mini" onClick={() => startEditClass(c)}>수정</button>
                        <button className="btn mini danger" onClick={() => deleteClass(c.id)}>삭제</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        {assignClassId && (
          <section className="card">
            <h3>수업 학생 배정: {classMap.get(assignClassId)?.subject}</h3>
            <form className="grid-form" onSubmit={submitEnrollment}>
              <SearchableSelect
                value={assignForm.studentId}
                onChange={(value) => setAssignForm((f) => ({ ...f, studentId: value }))}
                placeholder="학생 검색 후 선택"
                options={availableStudents.map((student) => ({
                  value: student.id,
                  label: `${student.name} (${student.grade})`,
                  searchText: `${student.school} ${student.phone}`,
                }))}
                emptyMessage="선택 가능한 학생이 없습니다."
              />
              <input type="date" value={assignForm.startDate} onChange={(e) => setAssignForm((f) => ({ ...f, startDate: e.target.value }))} />
              <div className="actions span-2">
                <button type="submit" className="btn primary">학생 배정</button>
              </div>
            </form>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>학생</th>
                    <th>수강 기간</th>
                    <th>사용 회차</th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedClassEnrollments.map((enroll) => {
                    const usedCount = getDeductedCount(enroll.studentId, enroll.classId)
                    const student = studentMap.get(enroll.studentId)
                    return (
                      <tr key={enroll.id}>
                        <td>{student?.name ?? '삭제된 학생'}</td>
                        <td>{enroll.startDate} ~ 수강중</td>
                        <td>{usedCount}회</td>
                        <td className="row-actions">
                          <button className="btn mini" onClick={() => {
                            setSelectedStudentId(enroll.studentId)
                            setMenu('studentDetail')
                          }}>상세</button>
                          <button className="btn mini danger" onClick={() => removeEnrollment(enroll.id)}>배정 해제</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    )
  }

  const renderAttendance = () => {
    const isInMakeupPeriod = (date: string) => {
      if (!date) return false
      const matchedStart = !makeupPeriod.startDate || date >= makeupPeriod.startDate
      const matchedEnd = !makeupPeriod.endDate || date <= makeupPeriod.endDate
      return matchedStart && matchedEnd
    }

    const filteredAttendanceHistory = byRecent(db.attendances).filter((attendance) => {
      const matchedStudent = !attendanceHistoryStudentId || attendance.studentId === attendanceHistoryStudentId
      const matchedClass = !attendanceHistoryClassId || attendance.classId === attendanceHistoryClassId
      const matchedStatus = !attendanceHistoryStatus || attendance.status === attendanceHistoryStatus
      const matchedStartDate = !attendanceHistoryStartDate || attendance.date >= attendanceHistoryStartDate
      const matchedEndDate = !attendanceHistoryEndDate || attendance.date <= attendanceHistoryEndDate
      return matchedStudent && matchedClass && matchedStatus && matchedStartDate && matchedEndDate
    })

    const filteredRegularAbsents = regularAbsents.filter((attendance) => isInMakeupPeriod(attendance.date))

    const filteredMakeups = byRecent(db.makeups).filter((makeup) => {
      const absentAttendance = db.attendances.find(
        (attendance) => attendance.id === makeup.absentAttendanceId,
      )
      return (
        isInMakeupPeriod(makeup.scheduledDate) ||
        (absentAttendance ? isInMakeupPeriod(absentAttendance.date) : false)
      )
    })

    return (
      <div className="panel-grid">
        <section className="card form-card">
          <h3>출결 등록</h3>
          <p className="helper">수업을 선택하면 배정된 학생 전체를 한 번에 출석체크할 수 있습니다. 정규 수업의 출석/지각/결석/조퇴는 회차 차감 대상입니다.</p>
          <form className="grid-form" onSubmit={submitAttendance}>
            <input type="date" value={attendanceForm.date} onChange={(e) => setAttendanceForm((f) => ({ ...f, date: e.target.value }))} />
            <SearchableSelect
              value={attendanceForm.classId}
              onChange={(value) => setAttendanceForm((f) => ({ ...f, classId: value, time: '' }))}
              placeholder="수업 검색 후 선택"
              options={attendanceClassOptions}
              emptyMessage="수업 검색 결과가 없습니다."
              clearable
              clearLabel="지우기"
            />
            <SearchableSelect
              value={attendanceForm.time}
              onChange={(value) => setAttendanceForm((f) => ({ ...f, time: value }))}
              placeholder="출결 시간 검색/선택"
              options={attendanceTimeOptions}
              emptyMessage="출결 시간 검색 결과가 없습니다."
            />
            <div className="actions span-2">
              <button type="button" className="btn" onClick={markAllAttendancePresent}>
                일괄 출석체크
              </button>
              <button type="button" className="btn" onClick={clearAllAttendanceDrafts}>
                일괄 출석체크 해제
              </button>
            </div>
            <div className="span-2 table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>학생</th>
                    <th>학년</th>
                    <th>상태</th>
                    <th>메모</th>
                    <th>보강 예정 생성</th>
                    <th>보강 예정일</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedAttendanceClassStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6}>수업을 선택하면 배정 학생 출석체크 목록이 표시됩니다.</td>
                    </tr>
                  ) : (
                    selectedAttendanceClassStudents.map((student) => {
                      const draft = attendanceDrafts[student.id] ?? {
                        status: '' as AttendanceStatus | '',
                        memo: '',
                        createMakeup: false,
                        makeupDate: attendanceForm.date,
                      }

                      const setAttendanceStatus = (nextStatus: AttendanceStatus) => {
                        setAttendanceDrafts((prev) => ({
                          ...prev,
                          [student.id]: {
                            ...draft,
                            status: draft.status === nextStatus ? '' : nextStatus,
                            createMakeup: nextStatus === '결석' ? draft.createMakeup : false,
                          },
                        }))
                      }

                      return (
                        <tr key={student.id}>
                          <td>{student.name}</td>
                          <td>{student.grade}</td>
                          <td>
                            <div className="attendance-status-control">
                              <label className="check">
                                <input
                                  type="checkbox"
                                  checked={draft.status === '출석'}
                                  onChange={() => setAttendanceStatus('출석')}
                                />
                                출석
                              </label>
                              <label className="check">
                                <input
                                  type="checkbox"
                                  checked={draft.status === '결석'}
                                  onChange={() => setAttendanceStatus('결석')}
                                />
                                결석
                              </label>
                              <label className="check">
                                <input
                                  type="checkbox"
                                  checked={draft.status === '지각'}
                                  onChange={() => setAttendanceStatus('지각')}
                                />
                                지각
                              </label>
                              <label className="check">
                                <input
                                  type="checkbox"
                                  checked={draft.status === '조퇴'}
                                  onChange={() => setAttendanceStatus('조퇴')}
                                />
                                조퇴
                              </label>
                            </div>
                          </td>
                          <td>
                            <input
                              value={draft.memo}
                              placeholder="학생별 메모"
                              onChange={(e) =>
                                setAttendanceDrafts((prev) => ({
                                  ...prev,
                                  [student.id]: { ...draft, memo: e.target.value },
                                }))
                              }
                            />
                          </td>
                          <td>
                            <label className="check">
                              <input
                                type="checkbox"
                                checked={draft.createMakeup}
                                disabled={draft.status !== '결석'}
                                onChange={(e) =>
                                  setAttendanceDrafts((prev) => ({
                                    ...prev,
                                    [student.id]: { ...draft, createMakeup: e.target.checked },
                                  }))
                                }
                              />
                              생성
                            </label>
                          </td>
                          <td>
                            <input
                              type="date"
                              value={draft.makeupDate}
                              disabled={draft.status !== '결석' || !draft.createMakeup}
                              onChange={(e) =>
                                setAttendanceDrafts((prev) => ({
                                  ...prev,
                                  [student.id]: { ...draft, makeupDate: e.target.value },
                                }))
                              }
                            />
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="actions span-2">
              <button type="submit" className="btn primary">수업별 출결 저장</button>
            </div>
          </form>
        </section>

        <section className="card">
          <h3>결석/보강 관리</h3>
          <div className="inline-form">
            <input
              type="date"
              value={makeupPeriod.startDate}
              onChange={(e) => setMakeupPeriod((prev) => ({ ...prev, startDate: e.target.value }))}
            />
            <input
              type="date"
              value={makeupPeriod.endDate}
              onChange={(e) => setMakeupPeriod((prev) => ({ ...prev, endDate: e.target.value }))}
            />
            <button
              type="button"
              className="btn"
              onClick={() => setMakeupPeriod({ startDate: today, endDate: today })}
            >
              기간 초기화
            </button>
          </div>
          <p className="helper">결석일 또는 보강예정일이 선택한 기간에 포함된 항목만 표시됩니다.</p>
          <form className="inline-form" onSubmit={submitMakeup}>
            <SearchableSelect
              value={makeupForm.absentAttendanceId}
              onChange={(value) => setMakeupForm((f) => ({ ...f, absentAttendanceId: value }))}
              placeholder="결석 수업 선택"
              options={filteredRegularAbsents.map((attendance) => ({
                value: attendance.id,
                label: `${attendance.date} ${attendance.time || ''} · ${studentMap.get(attendance.studentId)?.name ?? '삭제된 학생'} · ${classMap.get(attendance.classId)?.subject ?? '삭제된 수업'}`,
                searchText: `${studentMap.get(attendance.studentId)?.grade ?? ''} ${classMap.get(attendance.classId)?.teacher ?? ''}`,
              }))}
              emptyMessage="선택 가능한 결석 수업이 없습니다."
            />
            <input type="date" value={makeupForm.scheduledDate} onChange={(e) => setMakeupForm((f) => ({ ...f, scheduledDate: e.target.value }))} />
            <SearchableSelect
              value={makeupForm.makeupClassId}
              onChange={(value) => setMakeupForm((f) => ({ ...f, makeupClassId: value }))}
              placeholder="보강을 들을 수업 선택"
              options={makeupClassOptions}
              emptyMessage="선택한 날짜에 있는 수업이 없습니다."
            />
            <input placeholder="보강 메모" value={makeupForm.memo} onChange={(e) => setMakeupForm((f) => ({ ...f, memo: e.target.value }))} />
            <button type="submit" className="btn primary">보강 예정 등록</button>
          </form>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>학생</th>
                  <th>결석 수업</th>
                  <th>보강 예정일</th>
                  <th>보강 수업</th>
                  <th>출석 여부</th>
                  <th>완료 여부</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {filteredMakeups.map((m) => {
                  const absent = db.attendances.find((a) => a.id === m.absentAttendanceId)
                  return (
                    <tr key={m.id}>
                      <td>{studentMap.get(m.studentId)?.name ?? '삭제된 학생'}</td>
                      <td>{absent?.date} {absent?.time || ''} · {classMap.get(m.classId)?.subject}</td>
                      <td>{m.scheduledDate}</td>
                      <td>{classMap.get(m.classId)?.subject ?? '삭제된 수업'}</td>
                      <td>{m.attended ? '출석' : '미출석'}</td>
                      <td>{m.status}</td>
                      <td className="row-actions">
                        {m.status === '예정' && (
                          <>
                            <input
                              type="date"
                              value={makeupScheduleDraft[m.id] ?? m.scheduledDate}
                              onChange={(e) =>
                                setMakeupScheduleDraft((prev) => ({ ...prev, [m.id]: e.target.value }))
                              }
                            />
                            <button className="btn mini" onClick={() => changeMakeupSchedule(m.id)}>일정 변경</button>
                            <SearchableSelect
                              value={makeupClassDraft[m.id] ?? m.classId}
                              onChange={(value) => setMakeupClassDraft((prev) => ({ ...prev, [m.id]: value }))}
                              placeholder="보강 수업 선택"
                              options={getMakeupClassOptionsForDate(m.scheduledDate)}
                              emptyMessage="해당 날짜에 있는 수업이 없습니다."
                            />
                            <button className="btn mini" onClick={() => changeMakeupClass(m.id)}>수업 변경</button>
                            <button className="btn mini danger" onClick={() => cancelMakeup(m.id)}>보강 취소</button>
                            <button className="btn mini" onClick={() => completeMakeup(m.id, true)}>출석 완료</button>
                            <button className="btn mini danger" onClick={() => completeMakeup(m.id, false)}>미출석 완료</button>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <h3>출결 내역</h3>
          <div className="inline-form">
            <SearchableSelect
              value={attendanceHistoryStudentId}
              onChange={setAttendanceHistoryStudentId}
              placeholder="학생별 조회"
              options={studentOptions}
              emptyMessage="학생 검색 결과가 없습니다."
              clearable
              clearLabel="전체"
            />
            <SearchableSelect
              value={attendanceHistoryClassId}
              onChange={setAttendanceHistoryClassId}
              placeholder="수업별 조회"
              options={attendanceClassOptions}
              emptyMessage="수업 검색 결과가 없습니다."
              clearable
              clearLabel="전체"
            />
            <input
              type="date"
              value={attendanceHistoryStartDate}
              onChange={(e) => setAttendanceHistoryStartDate(e.target.value)}
              placeholder="시작일"
            />
            <input
              type="date"
              value={attendanceHistoryEndDate}
              onChange={(e) => setAttendanceHistoryEndDate(e.target.value)}
              placeholder="종료일"
            />
            <SearchableSelect
              value={attendanceHistoryStatus}
              onChange={setAttendanceHistoryStatus}
              placeholder="상태별 조회"
              options={ATTENDANCE_HISTORY_STATUS_OPTIONS}
              emptyMessage="상태 검색 결과가 없습니다."
              clearable
              clearLabel="전체"
            />
            <button
              type="button"
              className="btn"
              onClick={() => {
                setAttendanceHistoryStudentId('')
                setAttendanceHistoryClassId('')
                setAttendanceHistoryStatus('')
                setAttendanceHistoryStartDate(today)
                setAttendanceHistoryEndDate(today)
              }}
            >
              필터 초기화
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>시간</th>
                  <th>학생</th>
                  <th>수업</th>
                  <th>유형</th>
                  <th>상태</th>
                  <th>회차 반영</th>
                  <th>메모</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttendanceHistory.length === 0 ? (
                  <tr>
                    <td colSpan={9}>조회 조건에 맞는 출결 내역이 없습니다.</td>
                  </tr>
                ) : filteredAttendanceHistory.map((a) => (
                  <tr key={a.id} className={a.status === '결석' ? 'attendance-history-row absent' : 'attendance-history-row'}>
                    <td>{a.date}</td>
                    <td>{a.time || '-'}</td>
                    <td>{studentMap.get(a.studentId)?.name ?? '삭제된 학생'}</td>
                    <td>{classMap.get(a.classId)?.subject ?? '삭제된 수업'}</td>
                    <td>{a.type}</td>
                    <td>{a.status}</td>
                    <td>{a.type === '정규' ? '차감' : '미차감'}</td>
                    <td>{a.memo}</td>
                    <td className="row-actions">
                      <button className="btn mini danger" onClick={() => cancelAttendanceRecord(a.id)}>
                        출결 취소
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    )
  }

  const renderGrades = () => (
    <div className="panel-grid">
      <section className="card form-card">
        <h3>성적 입력</h3>
        <form className="grid-form" onSubmit={submitGrade}>
          <SearchableSelect
            value={gradeForm.studentId}
            onChange={(value) => setGradeForm((f) => ({ ...f, studentId: value }))}
            placeholder="학생 검색 후 선택"
            options={studentOptions}
            emptyMessage="학생 검색 결과가 없습니다."
          />
          <input placeholder="과목" value={gradeForm.subject} onChange={(e) => setGradeForm((f) => ({ ...f, subject: e.target.value }))} />
          <input type="date" value={gradeForm.date} onChange={(e) => setGradeForm((f) => ({ ...f, date: e.target.value }))} />
          <input type="number" min={0} max={100} value={gradeForm.score} onChange={(e) => setGradeForm((f) => ({ ...f, score: Number(e.target.value) }))} />
          <textarea className="span-2" placeholder="성적 메모" value={gradeForm.memo} onChange={(e) => setGradeForm((f) => ({ ...f, memo: e.target.value }))} />
          <div className="actions span-2"><button className="btn primary">저장</button></div>
        </form>
      </section>

      <section className="card">
        <h3>성적 기록</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>학생</th>
                <th>과목</th>
                <th>일자</th>
                <th>점수</th>
                <th>메모</th>
              </tr>
            </thead>
            <tbody>
              {byRecent(db.grades).map((g) => (
                <tr key={g.id}>
                  <td>{studentMap.get(g.studentId)?.name ?? '삭제된 학생'}</td>
                  <td>{g.subject}</td>
                  <td>{g.date}</td>
                  <td>{g.score}</td>
                  <td>{g.memo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )

  const renderPayments = () => (
    <div className="panel-grid">
      <section className="card form-card">
        <h3>납부 등록</h3>
        <form className="grid-form" onSubmit={submitPayment}>
          <SearchableSelect
            value={paymentForm.studentId}
            onChange={(value) => setPaymentForm((f) => ({ ...f, studentId: value }))}
            placeholder="학생 검색 후 선택"
            options={studentOptions}
            emptyMessage="학생 검색 결과가 없습니다."
          />
          <input type="month" value={paymentForm.month} onChange={(e) => setPaymentForm((f) => ({ ...f, month: e.target.value }))} />
          <input type="number" min={0} value={paymentForm.amount} onChange={(e) => setPaymentForm((f) => ({ ...f, amount: Number(e.target.value) }))} placeholder="수강료" />
          <SearchableSelect
            value={paymentForm.status}
            onChange={(value) => setPaymentForm((f) => ({ ...f, status: (value || '완납') as '완납' | '미납' }))}
            placeholder="납부 상태 선택"
            options={PAYMENT_STATUS_OPTIONS}
            emptyMessage="납부 상태 검색 결과가 없습니다."
          />
          <textarea className="span-2" placeholder="결제 메모" value={paymentForm.memo} onChange={(e) => setPaymentForm((f) => ({ ...f, memo: e.target.value }))} />
          <div className="actions span-2"><button className="btn primary">저장</button></div>
        </form>
      </section>

      <section className="card">
        <h3>월별 납부 현황</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>월</th>
                <th>학생</th>
                <th>수강료</th>
                <th>상태</th>
                <th>메모</th>
              </tr>
            </thead>
            <tbody>
              {byRecent(db.payments).map((p) => (
                <tr key={p.id}>
                  <td>{p.month}</td>
                  <td>{studentMap.get(p.studentId)?.name ?? '삭제된 학생'}</td>
                  <td>{p.amount.toLocaleString()}원</td>
                  <td>
                    <span className={p.status === '미납' ? 'badge bad' : 'badge ok'}>{p.status}</span>
                  </td>
                  <td>{p.memo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )

  const renderCounsels = () => (
    <div className="panel-grid">
      <section className="card form-card">
        <h3>상담 기록 등록</h3>
        <form className="grid-form" onSubmit={submitCounsel}>
          <SearchableSelect
            value={counselForm.studentId}
            onChange={(value) => setCounselForm((f) => ({ ...f, studentId: value }))}
            placeholder="학생 검색 후 선택"
            options={studentOptions}
            emptyMessage="학생 검색 결과가 없습니다."
          />
          <input type="date" value={counselForm.date} onChange={(e) => setCounselForm((f) => ({ ...f, date: e.target.value }))} />
          <label className="check">
            <input type="checkbox" checked={counselForm.withGuardian} onChange={(e) => setCounselForm((f) => ({ ...f, withGuardian: e.target.checked }))} />
            보호자 상담
          </label>
          <textarea className="span-2" placeholder="상담 내용" value={counselForm.content} onChange={(e) => setCounselForm((f) => ({ ...f, content: e.target.value }))} />
          <div className="actions span-2"><button className="btn primary">저장</button></div>
        </form>
      </section>

      <section className="card">
        <h3>상담 기록 목록</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>학생</th>
                <th>일자</th>
                <th>유형</th>
                <th>내용</th>
              </tr>
            </thead>
            <tbody>
              {byRecent(db.counsels).map((c) => (
                <tr key={c.id}>
                  <td>{studentMap.get(c.studentId)?.name ?? '삭제된 학생'}</td>
                  <td>{c.date}</td>
                  <td>{c.withGuardian ? '보호자 상담' : '학생 상담'}</td>
                  <td>{c.content}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )

  const renderNotes = () => (
    <div className="panel-grid">
      <section className="card form-card">
        <h3>공지/메모 등록</h3>
        <form className="grid-form" onSubmit={submitNote}>
          <input type="date" value={noteForm.date} onChange={(e) => setNoteForm((f) => ({ ...f, date: e.target.value }))} />
          <textarea className="span-2" placeholder="공지 또는 내부 메모" value={noteForm.content} onChange={(e) => setNoteForm((f) => ({ ...f, content: e.target.value }))} />
          <div className="actions span-2"><button className="btn primary">저장</button></div>
        </form>
      </section>

      <section className="card">
        <h3>공지/메모 목록</h3>
        <ul className="line-list">
          {byRecent(db.notes).map((n) => (
            <li key={n.id}>
              <span>{n.content}</span>
              <small>{n.date}</small>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )

  const renderAudit = () => (
    <div className="panel-grid">
      <section className="card">
        <h3>감사 로그</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>시각</th>
                <th>사용자</th>
                <th>권한</th>
                <th>행위</th>
                <th>상세</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5}>기록이 없습니다.</td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.createdAt.replace('T', ' ').slice(0, 19)}</td>
                    <td>{log.actorName}</td>
                    <td>{log.actorRole}</td>
                    <td>{log.action}</td>
                    <td>{log.detail}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )

  const renderChangeHistory = () => {
    const addedCount = changeLogs.filter((log) => log.changeType === '추가').length
    const updatedCount = changeLogs.filter((log) => log.changeType === '수정').length
    const deletedCount = changeLogs.filter((log) => log.changeType === '삭제').length

    return (
      <div className="panel-grid">
        <section className="stats-grid">
          <article className="stat-card">
            <h3>전체 변경 건수</h3>
            <strong>{changeLogs.length}건</strong>
          </article>
          <article className="stat-card">
            <h3>추가</h3>
            <strong>{addedCount}건</strong>
          </article>
          <article className="stat-card">
            <h3>수정</h3>
            <strong>{updatedCount}건</strong>
          </article>
          <article className="stat-card">
            <h3>삭제</h3>
            <strong>{deletedCount}건</strong>
          </article>
        </section>

        <section className="card">
          <h3>데이터 변경 이력</h3>
          <p className="helper">이 화면은 현재 앱에서 발생한 데이터 추가/수정/삭제 내역을 항목별로 기록합니다. 기존 데이터는 이 기능 추가 이후부터 추적됩니다.</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>시각</th>
                  <th>사용자</th>
                  <th>작업</th>
                  <th>데이터</th>
                  <th>변경 유형</th>
                  <th>대상</th>
                  <th>변경 내용</th>
                </tr>
              </thead>
              <tbody>
                {changeLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7}>변경 이력이 없습니다.</td>
                  </tr>
                ) : (
                  changeLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{log.createdAt.replace('T', ' ').slice(0, 19)}</td>
                      <td>{log.actorName} ({log.actorRole})</td>
                      <td>
                        <div>{log.action}</div>
                        <small>{log.detail || '-'}</small>
                      </td>
                      <td>{log.entityType}</td>
                      <td>
                        <span className={`badge ${log.changeType === '삭제' ? 'bad' : 'ok'}`}>{log.changeType}</span>
                      </td>
                      <td>
                        <div>{log.entityLabel}</div>
                        <small>{log.entityId}</small>
                      </td>
                      <td>
                        <ul className="change-list">
                          {log.changes.length === 0 ? (
                            <li>변경 필드 없음</li>
                          ) : (
                            log.changes.map((change) => (
                              <li key={`${log.id}_${change.field}`}>
                                <strong>{change.field}</strong>: {change.before} → {change.after}
                              </li>
                            ))
                          )}
                        </ul>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    )
  }

  const renderStudentDetail = () => {
    if (!selectedStudent) {
      return (
        <section className="card">
          <h3>학생 상세</h3>
          <p>학생 목록에서 상세를 선택해 주세요.</p>
        </section>
      )
    }

    const enrollments = db.enrollments.filter((x) => x.studentId === selectedStudent.id)
    const attends = byRecent(db.attendances.filter((x) => x.studentId === selectedStudent.id))
    const grades = byRecent(db.grades.filter((x) => x.studentId === selectedStudent.id))
    const pays = byRecent(db.payments.filter((x) => x.studentId === selectedStudent.id))
    const counsels = byRecent(db.counsels.filter((x) => x.studentId === selectedStudent.id))
    const makeups = byRecent(db.makeups.filter((x) => x.studentId === selectedStudent.id))

    const absentList = attends.filter((a) => a.type === '정규' && a.status === '결석')
    const makeupPlanned = makeups.filter((m) => m.status === '예정')
    const makeupDone = makeups.filter((m) => m.status === '완료')

    return (
      <div className="panel-grid">
        <section className="card student-summary">
          <div>
            <h3>{selectedStudent.name}</h3>
            <p>{selectedStudent.grade} · {selectedStudent.school}</p>
          </div>
          <div className="summary-grid">
            <span>학생 연락처: {selectedStudent.phone}</span>
            <span>보호자: {selectedStudent.guardianName} ({selectedStudent.guardianPhone})</span>
            <span>주소: {selectedStudent.address}</span>
            <span>메모: {selectedStudent.memo || '없음'}</span>
          </div>
        </section>

        <section className="card">
          <div className="tabs">
            <button className={studentTab === 'overview' ? 'tab active' : 'tab'} onClick={() => setStudentTab('overview')}>개요</button>
            <button className={studentTab === 'attendance' ? 'tab active' : 'tab'} onClick={() => setStudentTab('attendance')}>출결</button>
            <button className={studentTab === 'grades' ? 'tab active' : 'tab'} onClick={() => setStudentTab('grades')}>성적</button>
            <button className={studentTab === 'payments' ? 'tab active' : 'tab'} onClick={() => setStudentTab('payments')}>납부</button>
            <button className={studentTab === 'sessions' ? 'tab active' : 'tab'} onClick={() => setStudentTab('sessions')}>회차</button>
            <button className={studentTab === 'makeups' ? 'tab active' : 'tab'} onClick={() => setStudentTab('makeups')}>보강</button>
            <button className={studentTab === 'counsels' ? 'tab active' : 'tab'} onClick={() => setStudentTab('counsels')}>상담</button>
          </div>

          {studentTab === 'overview' && (
            <div className="overview-cards">
              <article className="small-card">
                <h4>결석 수업 목록</h4>
                <p>{absentList.length}건</p>
              </article>
              <article className="small-card">
                <h4>보강 예정 목록</h4>
                <p>{makeupPlanned.length}건</p>
              </article>
              <article className="small-card">
                <h4>보강 완료 목록</h4>
                <p>{makeupDone.length}건</p>
              </article>
              <article className="small-card">
                <h4>미납 건수</h4>
                <p>{pays.filter((p) => p.status === '미납').length}건</p>
              </article>
            </div>
          )}

          {studentTab === 'attendance' && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>시간</th>
                    <th>수업</th>
                    <th>유형</th>
                    <th>상태</th>
                    <th>회차 반영</th>
                  </tr>
                </thead>
                <tbody>
                  {attends.map((a) => (
                    <tr key={a.id}>
                      <td>{a.date}</td>
                      <td>{a.time || '-'}</td>
                      <td>{classMap.get(a.classId)?.subject ?? '삭제된 수업'}</td>
                      <td>{a.type}</td>
                      <td>{a.status}</td>
                      <td>{a.type === '정규' ? '차감' : '미차감'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {studentTab === 'grades' && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>일자</th>
                    <th>과목</th>
                    <th>점수</th>
                    <th>메모</th>
                  </tr>
                </thead>
                <tbody>
                  {grades.map((g) => (
                    <tr key={g.id}>
                      <td>{g.date}</td>
                      <td>{g.subject}</td>
                      <td>{g.score}</td>
                      <td>{g.memo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {studentTab === 'payments' && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>월</th>
                    <th>금액</th>
                    <th>상태</th>
                    <th>메모</th>
                  </tr>
                </thead>
                <tbody>
                  {pays.map((p) => (
                    <tr key={p.id}>
                      <td>{p.month}</td>
                      <td>{p.amount.toLocaleString()}원</td>
                      <td>{p.status}</td>
                      <td>{p.memo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {studentTab === 'sessions' && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>수업</th>
                    <th>수강 기간</th>
                    <th>사용 회차</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((enroll) => {
                    const usedCount = getDeductedCount(enroll.studentId, enroll.classId)
                    return (
                      <tr key={enroll.id}>
                        <td>{classMap.get(enroll.classId)?.subject ?? '삭제된 수업'}</td>
                        <td>{enroll.startDate} ~ {enroll.endDate || '수강중'}</td>
                        <td>{usedCount}회</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {studentTab === 'makeups' && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>결석 일자</th>
                    <th>수업</th>
                    <th>보강 예정</th>
                    <th>보강 출석</th>
                    <th>완료 여부</th>
                  </tr>
                </thead>
                <tbody>
                  {makeups.map((m) => {
                    const absent = db.attendances.find((a) => a.id === m.absentAttendanceId)
                    return (
                      <tr key={m.id}>
                        <td>{absent?.date ?? '-'}</td>
                        <td>{classMap.get(m.classId)?.subject ?? '삭제된 수업'}</td>
                        <td>{m.scheduledDate}</td>
                        <td>{m.attended ? '출석' : '미출석'}</td>
                        <td>{m.status}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {studentTab === 'counsels' && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>일자</th>
                    <th>유형</th>
                    <th>내용</th>
                  </tr>
                </thead>
                <tbody>
                  {counsels.map((c) => (
                    <tr key={c.id}>
                      <td>{c.date}</td>
                      <td>{c.withGuardian ? '보호자 상담' : '학생 상담'}</td>
                      <td>{c.content}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    )
  }

  const renderContent = () => {
    if (menu === 'dashboard') return renderDashboard()
    if (menu === 'students') return renderStudents()
    if (menu === 'classes') return renderClasses()
    if (menu === 'attendance') return renderAttendance()
    if (menu === 'grades') return renderGrades()
    if (menu === 'payments') return renderPayments()
    if (menu === 'counsels') return renderCounsels()
    if (menu === 'notes') return renderNotes()
    if (menu === 'audit') return renderAudit()
    if (menu === 'changeHistory') return renderChangeHistory()
    return renderStudentDetail()
  }

  const menuItems: { key: MenuKey; label: string }[] = [
    { key: 'dashboard', label: '대시보드' },
    { key: 'students', label: '학생 관리' },
    { key: 'classes', label: '수업 관리' },
    { key: 'attendance', label: '출결/보강 관리' },
    { key: 'grades', label: '성적 관리' },
    { key: 'payments', label: '납부 관리' },
    { key: 'counsels', label: '상담 관리' },
    { key: 'notes', label: '공지/메모' },
    { key: 'audit', label: '감사 로그' },
    { key: 'changeHistory', label: '데이터 변경이력' },
    { key: 'studentDetail', label: '학생 상세' },
  ]

  const visibleMenuItems = menuItems.filter((item) => canAccess(item.key))

  if (!currentUser) {
    return (
      <div className="auth-layout">
        <section className="auth-card">
          <h1>코드오 학원관리 로그인</h1>
          <p>역할 기반 접근 제어가 적용된 관리자 화면입니다.</p>
          <form className="grid-form" onSubmit={handleLogin}>
            <input value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="아이디" />
            <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="비밀번호" />
            <div className="actions span-2">
              <button type="submit" className="btn primary">로그인</button>
            </div>
          </form>
          <div className="helper">
            <div>원장: admin / Admin1234!</div>
            <div>부원장: vice / Vice1234!</div>
            <div>강사: teacher / Teacher1234!</div>
            <div>상담: counsel / Counsel1234!</div>
          </div>
        </section>
      </div>
    )
  }

  // 로그인 후 서버 DB 로딩 중
  if (!dbLoaded) {
    return (
      <div className="auth-layout">
        <section className="auth-card" style={{ textAlign: 'center' }}>
          <h2>데이터 불러오는 중...</h2>
          <p style={{ color: '#888', marginTop: 8 }}>서버에서 데이터를 가져오고 있습니다.</p>
        </section>
      </div>
    )
  }

  // 로컬 데이터 마이그레이션 확인
  if (hasMigratableData) {
    const migrateToServer = () => {
      fetch(`${API_BASE_URL}/api/db`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ db }),
      })
        .then(() => {
          setHasMigratableData(false)
          setNotice('데이터를 서버로 이전했습니다. 이제 모든 기기에서 동일한 데이터를 사용할 수 있습니다.')
        })
        .catch(() => setError('서버 저장 실패. 나중에 다시 시도해주세요.'))
    }
    return (
      <div className="auth-layout">
        <section className="auth-card">
          <h2>데이터 이전 안내</h2>
          <p style={{ marginTop: 8 }}>
            이 PC의 브라우저에 저장된 기존 데이터를 서버로 이전하면<br />
            모든 기기(PC·핸드폰 등)에서 동일한 데이터를 사용할 수 있습니다.
          </p>
          <p style={{ marginTop: 8, color: '#888', fontSize: 13 }}>
            학생 {db.students.length}명 · 수업 {db.classes.length}개 · 출결 {db.attendances.length}건 데이터가 감지되었습니다.
          </p>
          <div className="actions" style={{ marginTop: 16, gap: 8 }}>
            <button className="btn primary" onClick={migrateToServer}>서버로 이전하기</button>
            <button className="btn" onClick={() => setHasMigratableData(false)}>건너뛰기</button>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>코드오 학원관리</h1>
        <p>{currentUser.name} · {currentUser.role}</p>
        <nav>
          {visibleMenuItems.map((item) => (
            <button
              key={item.key}
              className={menu === item.key ? 'menu-btn active' : 'menu-btn'}
              onClick={() => setMenu(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="main">
        <header className="topbar">
          <div>
            <h2>
              {menuItems.find((m) => m.key === menu)?.label}
              {menu === 'studentDetail' && selectedStudent ? ` - ${selectedStudent.name}` : ''}
            </h2>
            <small>{today} 기준 운영 현황</small>
          </div>
          <div className="topbar-memo">
            <strong>회차 규칙</strong>
            <span>정규 출결(출석/지각/결석/조퇴): 차감</span>
            <span>보강 출석: 미차감</span>
            <button className="btn mini" onClick={handleLogout}>로그아웃</button>
          </div>
        </header>

        {error && <div className="error-box">{error}</div>}
        {notice && <div className="notice-box">{notice}</div>}

        <main>{renderContent()}</main>
      </div>
    </div>
  )
}

export default App
