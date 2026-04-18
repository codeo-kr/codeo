import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'
import { JSONFilePreset } from 'lowdb/node'
import { fileURLToPath } from 'node:url'

const PORT = Number(process.env.PORT || 4000)
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h'
const FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const dbFilePath = fileURLToPath(new URL('./data.json', import.meta.url))

const db = await JSONFilePreset(dbFilePath, {
  users: [],
  auditLogs: [],
})

const app = express()

app.disable('x-powered-by')
app.use(helmet())
app.use(express.json({ limit: '1mb' }))

const corsOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  process.env.FRONTEND_ORIGIN,
  ...FRONTEND_ORIGINS,
].filter(Boolean))

const isLocalDevOrigin = (origin) => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.has(origin) || isLocalDevOrigin(origin)) {
        callback(null, true)
        return
      }
      callback(new Error('CORS blocked'))
    },
  }),
)

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
})

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
})

app.use('/api', apiLimiter)

const safeUser = (user) => ({
  id: user.id,
  name: user.name,
  role: user.role,
})

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) {
    res.status(401).json({ message: '인증 토큰이 필요합니다.' })
    return
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.user = payload
    next()
  } catch {
    res.status(401).json({ message: '유효하지 않은 토큰입니다.' })
  }
}

const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    res.status(403).json({ message: '권한이 없습니다.' })
    return
  }
  next()
}

const appendAudit = async ({ actorId, actorName, actorRole, action, detail }) => {
  db.data.auditLogs.unshift({
    id: nanoid(),
    actorId,
    actorName,
    actorRole,
    action,
    detail,
    createdAt: new Date().toISOString(),
  })
  db.data.auditLogs = db.data.auditLogs.slice(0, 5000)
  await db.write()
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'academy-auth-api' })
})

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { id, password } = req.body || {}
  if (!id || !password) {
    res.status(400).json({ message: '아이디와 비밀번호를 입력해 주세요.' })
    return
  }

  const user = db.data.users.find((item) => item.id === id)
  if (!user) {
    res.status(401).json({ message: '아이디 또는 비밀번호가 올바르지 않습니다.' })
    return
  }

  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) {
    res.status(401).json({ message: '아이디 또는 비밀번호가 올바르지 않습니다.' })
    return
  }

  const payload = safeUser(user)
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })

  await appendAudit({
    actorId: payload.id,
    actorName: payload.name,
    actorRole: payload.role,
    action: '로그인',
    detail: '서버 인증 로그인',
  })

  res.json({ token, user: payload })
})

app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ user: req.user })
})

app.post('/api/audit', authenticate, async (req, res) => {
  const { action, detail } = req.body || {}
  if (!action) {
    res.status(400).json({ message: 'action은 필수입니다.' })
    return
  }

  await appendAudit({
    actorId: req.user.id,
    actorName: req.user.name,
    actorRole: req.user.role,
    action,
    detail: String(detail || ''),
  })

  res.status(201).json({ ok: true })
})

app.get('/api/audit', authenticate, authorize('원장'), (req, res) => {
  const limit = Math.min(Number(req.query.limit || 300), 2000)
  res.json({ logs: db.data.auditLogs.slice(0, limit) })
})

app.listen(PORT, () => {
  console.log(`Auth API running on http://localhost:${PORT}`)
})
