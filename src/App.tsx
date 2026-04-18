import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
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
  | 'studentDetail'

type UserRole = '원장' | '강사' | '상담'

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

type AttendanceDraft = {
  status: AttendanceStatus
  memo: string
  createMakeup: boolean
  makeupDate: string
}

const STORAGE_KEY = 'academy_admin_db_v1'
const AUTH_KEY = 'academy_admin_auth_v1'
const AUTH_TOKEN_KEY = 'academy_admin_auth_token_v1'
const AUDIT_KEY = 'academy_admin_audit_v1'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const DEDUCT_STATUSES: AttendanceStatus[] = ['출석', '지각', '결석', '조퇴']
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
  원장: ['dashboard', 'students', 'classes', 'attendance', 'grades', 'payments', 'counsels', 'notes', 'audit', 'studentDetail'],
  강사: ['dashboard', 'students', 'classes', 'attendance', 'grades', 'notes', 'studentDetail'],
  상담: ['dashboard', 'students', 'payments', 'counsels', 'notes', 'studentDetail'],
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`
}

function byRecent<T extends { createdAt: string }>(list: T[]) {
  return [...list].sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))
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

function loadDb(): DB {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return seedDb()
  try {
    const parsed = JSON.parse(raw) as DB
    if (!parsed.students || !parsed.classes) return seedDb()
    return parsed
  } catch {
    return seedDb()
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

function loadAuthToken(): string {
  return sessionStorage.getItem(AUTH_TOKEN_KEY) ?? ''
}

function App() {
  const [db, setDb] = useState<DB>(loadDb)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(loadAuthUser)
  const [authToken, setAuthToken] = useState<string>(loadAuthToken)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(loadAuditLogs)
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
    capacity: 10,
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
    memo: '',
  })
  const [makeupPeriod, setMakeupPeriod] = useState({
    startDate: '',
    endDate: '',
  })
  const [makeupScheduleDraft, setMakeupScheduleDraft] = useState<Record<string, string>>({})

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  }, [db])

  useEffect(() => {
    localStorage.setItem(AUDIT_KEY, JSON.stringify(auditLogs))
  }, [auditLogs])

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
          status: prev[student.id]?.status ?? existingAttendance?.status ?? '출석',
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
    setDb((prev) => updater(prev))
    if (action) appendAudit(action, detail ?? '')
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
        setError('아이디 또는 비밀번호가 올바르지 않습니다.')
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
    if (!window.confirm('학생을 삭제하면 관련 데이터도 함께 삭제됩니다. 진행할까요?')) return
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
    if (!window.confirm(`${targetStudent.name} 학생을 퇴원 처리할까요? 활성 배정 수업에서 자동 제외됩니다.`)) return

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
      capacity: 10,
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

    let insertedCount = 0
    let updatedCount = 0
    let makeupCount = 0

    updateDb((prev) => {
      const nextAttendances = [...prev.attendances]
      let nextMakeups = [...prev.makeups]

      selectedAttendanceClassStudents.forEach((student) => {
        const draft = attendanceDrafts[student.id] ?? {
          status: '출석',
          memo: '',
          createMakeup: false,
          makeupDate: attendanceForm.date,
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
    const already = db.makeups.find((m) => m.absentAttendanceId === absentAttendance.id && m.status !== '완료')
    if (already) {
      setError('이미 보강 예정으로 등록된 결석 수업입니다.')
      return
    }

    const next: Makeup = {
      id: uid('makeup'),
      studentId: absentAttendance.studentId,
      classId: absentAttendance.classId,
      absentAttendanceId: absentAttendance.id,
      scheduledDate: makeupForm.scheduledDate,
      status: '예정',
      attended: false,
      memo: makeupForm.memo,
      createdAt: new Date().toISOString(),
    }
    updateDb((prev) => ({ ...prev, makeups: [next, ...prev.makeups] }), '보강 등록', next.scheduledDate)
    setMakeupForm({ absentAttendanceId: '', scheduledDate: today, memo: '' })
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

  const cancelAttendanceRecord = (attendanceId: string) => {
    const targetAttendance = db.attendances.find((attendance) => attendance.id === attendanceId)
    if (!targetAttendance) return

    if (!window.confirm('해당 출결 기록을 취소할까요?')) {
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
            <select
              value={studentGradeFilter}
              onChange={(e) => {
                setStudentGradeFilter(e.target.value)
                setStudentPage(1)
              }}
            >
              <option value="전체">전체 학년</option>
              {[...new Set(db.students.map((s) => s.grade))].map((grade) => (
                <option key={grade} value={grade}>{grade}</option>
              ))}
            </select>
            <select value={studentSort} onChange={(e) => setStudentSort(e.target.value as 'name' | 'createdAt')}>
              <option value="createdAt">최신 등록순</option>
              <option value="name">이름순</option>
            </select>
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
                return (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.grade} / {s.school}</td>
                    <td>{s.isWithdrawn ? `퇴원 (${s.withdrawnAt || '-'})` : '재원'}</td>
                    <td>{s.phone}</td>
                    <td>{s.guardianName} ({s.guardianPhone})</td>
                    <td>{assigned.length}개</td>
                    <td>{checkedSessions}회</td>
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
            <select value={classForm.day} onChange={(e) => setClassForm((f) => ({ ...f, day: e.target.value }))}>
              <option value="">요일 선택</option>
              {!CLASS_DAY_OPTIONS.includes(classForm.day) && classForm.day && (
                <option value={classForm.day}>{classForm.day} (기존 값)</option>
              )}
              {CLASS_DAY_OPTIONS.map((day) => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
            <select value={classForm.startTime} onChange={(e) => setClassForm((f) => ({ ...f, startTime: e.target.value }))}>
              <option value="">시작시간</option>
              {!HOUR_TIME_OPTIONS.includes(classForm.startTime) && classForm.startTime && (
                <option value={classForm.startTime}>{classForm.startTime} (기존 값)</option>
              )}
              {HOUR_TIME_OPTIONS.map((time) => (
                <option key={time} value={time}>{time}</option>
              ))}
            </select>
            <select value={classForm.endTime} onChange={(e) => setClassForm((f) => ({ ...f, endTime: e.target.value }))}>
              <option value="">종료시간</option>
              {!HOUR_TIME_OPTIONS.includes(classForm.endTime) && classForm.endTime && (
                <option value={classForm.endTime}>{classForm.endTime} (기존 값)</option>
              )}
              {HOUR_TIME_OPTIONS.map((time) => (
                <option key={time} value={time}>{time}</option>
              ))}
            </select>
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
                    capacity: 10,
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
              <select value={assignForm.studentId} onChange={(e) => setAssignForm((f) => ({ ...f, studentId: e.target.value }))}>
                <option value="">학생 선택</option>
                {availableStudents.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.grade})</option>
                ))}
              </select>
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

    const filteredRegularAbsents = regularAbsents.filter((attendance) =>
      isInMakeupPeriod(attendance.date),
    )

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
            <select value={attendanceForm.classId} onChange={(e) => setAttendanceForm((f) => ({ ...f, classId: e.target.value, time: '' }))}>
              <option value="">수업 선택</option>
              {db.classes.map((c) => (
                <option key={c.id} value={c.id}>{c.subject} ({c.day} {c.time})</option>
              ))}
            </select>
            <select value={attendanceForm.time} onChange={(e) => setAttendanceForm((f) => ({ ...f, time: e.target.value }))}>
              <option value="">출결 시간 선택</option>
              {HOUR_TIME_OPTIONS.map((time) => (
                <option key={time} value={time}>{time}</option>
              ))}
            </select>
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
                        status: '출석' as AttendanceStatus,
                        memo: '',
                        createMakeup: false,
                        makeupDate: attendanceForm.date,
                      }

                      return (
                        <tr key={student.id}>
                          <td>{student.name}</td>
                          <td>{student.grade}</td>
                          <td>
                            <select
                              value={draft.status}
                              onChange={(e) =>
                                setAttendanceDrafts((prev) => ({
                                  ...prev,
                                  [student.id]: {
                                    ...draft,
                                    status: e.target.value as AttendanceStatus,
                                    createMakeup:
                                      e.target.value === '결석' ? draft.createMakeup : false,
                                  },
                                }))
                              }
                            >
                              <option value="출석">출석</option>
                              <option value="지각">지각</option>
                              <option value="결석">결석</option>
                              <option value="조퇴">조퇴</option>
                            </select>
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
              onClick={() => setMakeupPeriod({ startDate: '', endDate: '' })}
            >
              기간 초기화
            </button>
          </div>
          <p className="helper">결석일 또는 보강예정일이 선택한 기간에 포함된 항목만 표시됩니다.</p>
          <form className="inline-form" onSubmit={submitMakeup}>
            <select value={makeupForm.absentAttendanceId} onChange={(e) => setMakeupForm((f) => ({ ...f, absentAttendanceId: e.target.value }))}>
              <option value="">결석 수업 선택</option>
              {filteredRegularAbsents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.date} {a.time || ''} · {studentMap.get(a.studentId)?.name ?? '삭제된 학생'} · {classMap.get(a.classId)?.subject}
                </option>
              ))}
            </select>
            <input type="date" value={makeupForm.scheduledDate} onChange={(e) => setMakeupForm((f) => ({ ...f, scheduledDate: e.target.value }))} />
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
                {byRecent(db.attendances).map((a) => (
                  <tr key={a.id}>
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
          <select value={gradeForm.studentId} onChange={(e) => setGradeForm((f) => ({ ...f, studentId: e.target.value }))}>
            <option value="">학생 선택</option>
            {db.students.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
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
          <select value={paymentForm.studentId} onChange={(e) => setPaymentForm((f) => ({ ...f, studentId: e.target.value }))}>
            <option value="">학생 선택</option>
            {db.students.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <input type="month" value={paymentForm.month} onChange={(e) => setPaymentForm((f) => ({ ...f, month: e.target.value }))} />
          <input type="number" min={0} value={paymentForm.amount} onChange={(e) => setPaymentForm((f) => ({ ...f, amount: Number(e.target.value) }))} placeholder="수강료" />
          <select value={paymentForm.status} onChange={(e) => setPaymentForm((f) => ({ ...f, status: e.target.value as '완납' | '미납' }))}>
            <option value="완납">완납</option>
            <option value="미납">미납</option>
          </select>
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
          <select value={counselForm.studentId} onChange={(e) => setCounselForm((f) => ({ ...f, studentId: e.target.value }))}>
            <option value="">학생 선택</option>
            {db.students.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
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
            <div>강사: teacher / Teacher1234!</div>
            <div>상담: counsel / Counsel1234!</div>
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
