# Verb Memorizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a two-phase (preview → battle) English Vi/Vt verb memorization web app with smart error-prioritized repetition and pair word learning.

**Architecture:** Client-side quiz engine with fire-and-forget Supabase sync. Next.js 14 App Router handles routing; Supabase provides ID/PW auth (no email verification) and PostgreSQL. All quiz scoring runs in the browser — each answer triggers a background upsert to Supabase without awaiting.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Supabase JS v2 + @supabase/ssr, Vitest, Docker

---

## File Map

```
Dockerfile                     production image
docker-compose.yml             dev environment (hot-reload, port 3000)
.dockerignore                  exclude node_modules, .next
app/
  layout.tsx                   root layout with Tailwind globals
  page.tsx                     login page
  onboarding/page.tsx          first-login daily goal setup
  dashboard/page.tsx           home — today's progress + start button
  study/
    page.tsx                   session orchestrator (preview → battle)
    PreviewPhase.tsx           preview cards client component
    BattlePhase.tsx            quiz client component
  settings/page.tsx            daily goal + logout
middleware.ts                  route protection
lib/
  supabase/
    client.ts                  browser client (createBrowserClient)
    server.ts                  server client (createServerClient)
  auth.ts                      login / auto-create logic
  wordSelector.ts              today's word selection algorithm
  quizEngine.ts                queue management, scoring, fire-and-forget sync
types/index.ts                 shared TypeScript types
supabase/
  migrations/001_initial.sql   schema DDL + RLS
  seed.sql                     100 words INSERT
```

---

## Task 0: Docker Environment Setup

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `.dockerignore`

- [ ] **Step 1: Create Dockerfile**

```dockerfile
FROM node:20-alpine AS base

WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 2: Create docker-compose.yml**

```yaml
services:
  app:
    build:
      context: .
      target: dev
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
      - /app/.next
    env_file:
      - .env.local
    environment:
      - WATCHPACK_POLLING=true
```

- [ ] **Step 3: Create .dockerignore**

```
node_modules
.next
.git
.env.local
*.md
docs
.claude
```

- [ ] **Step 4: Commit**

```bash
git add Dockerfile docker-compose.yml .dockerignore
git commit -m "chore: add Docker dev environment"
```

---

## Task 1: Project Bootstrap

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `.env.local.example`

- [ ] **Step 1: Scaffold Next.js project**

```bash
cd /Users/jeong-eunchae/jata100
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir=false \
  --import-alias="@/*" \
  --no-git
```

Expected: project files created, `npm run dev` works.

- [ ] **Step 2: Install Supabase and test deps**

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install -D vitest @vitest/ui
```

- [ ] **Step 3: Configure Vitest**

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
```

- [ ] **Step 4: Add standalone output to next.config.ts**

Edit `next.config.ts` to add `output: 'standalone'` (required for Docker production image):
```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
}

export default nextConfig
```

- [ ] **Step 5: Create env example**

Create `.env.local.example`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Copy to `.env.local` and fill in real Supabase project values.

- [ ] **Step 6: Verify build compiles**

```bash
npm run build
```

Expected: build completes with no errors.

- [ ] **Step 7: Commit**

```bash
git init
git add -A
git commit -m "chore: bootstrap Next.js 14 + Tailwind + Supabase + Vitest"
```

---

## Task 2: Shared Types

**Files:**
- Create: `types/index.ts`

- [ ] **Step 1: Create types file**

```typescript
// types/index.ts

export type WordType = 'Vi' | 'Vt'

export interface Word {
  id: number
  english: string
  korean_vi: string | null
  korean_vt: string | null
  type: WordType
  pair_id: number | null
}

export interface Progress {
  user_id: string
  word_id: number
  error_count: number
  consecutive_correct: number
  is_mastered: boolean
  last_seen_date: string | null
  updated_at: string
}

export interface UserSettings {
  id: string
  daily_goal: number
  last_completed_date: string | null
  created_at: string
}

export interface QueueItem {
  word: Word
  progress: Progress
}
```

- [ ] **Step 2: Commit**

```bash
git add types/index.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Task 3: DB Schema Migration

**Files:**
- Create: `supabase/migrations/001_initial.sql`

- [ ] **Step 1: Write migration SQL**

```bash
mkdir -p supabase/migrations
```

Create `supabase/migrations/001_initial.sql`:
```sql
-- user settings
create table if not exists user_settings (
  id                  uuid primary key references auth.users(id) on delete cascade,
  daily_goal          int not null default 20,
  last_completed_date date,
  created_at          timestamptz default now()
);

alter table user_settings enable row level security;

create policy "users manage own settings"
  on user_settings for all
  using (auth.uid() = id);

-- words (seed data, publicly readable)
create table if not exists words (
  id         serial primary key,
  english    text not null,
  korean_vi  text,
  korean_vt  text,
  type       text not null check (type in ('Vi', 'Vt')),
  pair_id    int
);

alter table words enable row level security;

create policy "words are public"
  on words for select
  using (true);

-- progress
create table if not exists progress (
  id                  serial primary key,
  user_id             uuid references auth.users(id) on delete cascade,
  word_id             int references words(id),
  error_count         int not null default 0,
  consecutive_correct int not null default 0,
  is_mastered         boolean not null default false,
  last_seen_date      date,
  updated_at          timestamptz default now(),
  unique(user_id, word_id)
);

alter table progress enable row level security;

create policy "users manage own progress"
  on progress for all
  using (auth.uid() = user_id);
```

- [ ] **Step 2: Apply migration in Supabase dashboard**

Go to Supabase project → SQL Editor → paste and run the migration SQL.

Also in Supabase dashboard: **Authentication → Settings → Email Auth → disable "Confirm email"**.

- [ ] **Step 3: Verify tables exist**

In Supabase Table Editor, confirm `user_settings`, `words`, `progress` tables are created.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/001_initial.sql
git commit -m "feat: add DB schema migration with RLS"
```

---

## Task 4: Seed Data (100 Words)

**Files:**
- Create: `supabase/seed.sql`

- [ ] **Step 1: Write seed SQL**

Create `supabase/seed.sql`:
```sql
-- Paired words: 20 pairs = 40 rows
insert into words (english, korean_vi, korean_vt, type, pair_id) values
-- pair 1: rise/raise
('rise',   '오르다',    null,          'Vi', 1),
('raise',  null,        '~을 올리다',  'Vt', 1),
-- pair 2: lie/lay
('lie',    '눕다',      null,          'Vi', 2),
('lay',    null,        '~을 놓다',    'Vt', 2),
-- pair 3: sit/set
('sit',    '앉다',      null,          'Vi', 3),
('set',    null,        '~을 설정하다','Vt', 3),
-- pair 4: fall/fell
('fall',   '떨어지다',  null,          'Vi', 4),
('fell',   null,        '~을 쓰러뜨리다','Vt', 4),
-- pair 5: come/bring
('come',   '오다',      null,          'Vi', 5),
('bring',  null,        '~을 가져오다','Vt', 5),
-- pair 6: go/take
('go',     '가다',      null,          'Vi', 6),
('take',   null,        '~을 가져가다','Vt', 6),
-- pair 7: appear/show
('appear', '나타나다',  null,          'Vi', 7),
('show',   null,        '~을 보여주다','Vt', 7),
-- pair 8: grow (Vi) / grow (Vt)
('grow',   '자라다',    null,          'Vi', 8),
('grow',   null,        '~을 기르다',  'Vt', 8),
-- pair 9: hang (Vi) / hang (Vt)
('hang',   '매달리다',  null,          'Vi', 9),
('hang',   null,        '~을 걸다',    'Vt', 9),
-- pair 10: run (Vi) / run (Vt)
('run',    '달리다',    null,          'Vi', 10),
('run',    null,        '~을 운영하다','Vt', 10),
-- pair 11: turn (Vi) / turn (Vt)
('turn',   '돌다',      null,          'Vi', 11),
('turn',   null,        '~을 돌리다',  'Vt', 11),
-- pair 12: move (Vi) / move (Vt)
('move',   '움직이다',  null,          'Vi', 12),
('move',   null,        '~을 옮기다',  'Vt', 12),
-- pair 13: open (Vi) / open (Vt)
('open',   '열리다',    null,          'Vi', 13),
('open',   null,        '~을 열다',    'Vt', 13),
-- pair 14: close (Vi) / close (Vt)
('close',  '닫히다',    null,          'Vi', 14),
('close',  null,        '~을 닫다',    'Vt', 14),
-- pair 15: change (Vi) / change (Vt)
('change', '변하다',    null,          'Vi', 15),
('change', null,        '~을 바꾸다',  'Vt', 15),
-- pair 16: break (Vi) / break (Vt)
('break',  '부러지다',  null,          'Vi', 16),
('break',  null,        '~을 부수다',  'Vt', 16),
-- pair 17: stop (Vi) / stop (Vt)
('stop',   '멈추다',    null,          'Vi', 17),
('stop',   null,        '~을 멈추다',  'Vt', 17),
-- pair 18: start (Vi) / start (Vt)
('start',  '시작되다',  null,          'Vi', 18),
('start',  null,        '~을 시작하다','Vt', 18),
-- pair 19: spread (Vi) / spread (Vt)
('spread', '퍼지다',    null,          'Vi', 19),
('spread', null,        '~을 퍼뜨리다','Vt', 19),
-- pair 20: burn (Vi) / burn (Vt)
('burn',   '타다',      null,          'Vi', 20),
('burn',   null,        '~을 태우다',  'Vt', 20);

-- Pure Vi: 30 rows
insert into words (english, korean_vi, korean_vt, type, pair_id) values
('arrive',      '도착하다',   null, 'Vi', null),
('depart',      '출발하다',   null, 'Vi', null),
('emerge',      '나타나다',   null, 'Vi', null),
('exist',       '존재하다',   null, 'Vi', null),
('occur',       '발생하다',   null, 'Vi', null),
('happen',      '일어나다',   null, 'Vi', null),
('disappear',   '사라지다',   null, 'Vi', null),
('agree',       '동의하다',   null, 'Vi', null),
('succeed',     '성공하다',   null, 'Vi', null),
('fail',        '실패하다',   null, 'Vi', null),
('sleep',       '자다',       null, 'Vi', null),
('wake',        '깨다',       null, 'Vi', null),
('die',         '죽다',       null, 'Vi', null),
('live',        '살다',       null, 'Vi', null),
('swim',        '수영하다',   null, 'Vi', null),
('fly',         '날다',       null, 'Vi', null),
('walk',        '걷다',       null, 'Vi', null),
('jump',        '뛰다',       null, 'Vi', null),
('laugh',       '웃다',       null, 'Vi', null),
('cry',         '울다',       null, 'Vi', null),
('wait',        '기다리다',   null, 'Vi', null),
('work',        '일하다',     null, 'Vi', null),
('play',        '놀다',       null, 'Vi', null),
('smile',       '미소 짓다',  null, 'Vi', null),
('stand',       '서다',       null, 'Vi', null),
('kneel',       '무릎 꿇다',  null, 'Vi', null),
('cough',       '기침하다',   null, 'Vi', null),
('sneeze',      '재채기하다', null, 'Vi', null),
('hesitate',    '망설이다',   null, 'Vi', null),
('participate', '참가하다',   null, 'Vi', null);

-- Pure Vt: 30 rows
insert into words (english, korean_vi, korean_vt, type, pair_id) values
('discuss',   null, '~을 논의하다',       'Vt', null),
('mention',   null, '~을 언급하다',       'Vt', null),
('resemble',  null, '~을 닮다',           'Vt', null),
('contact',   null, '~에 연락하다',       'Vt', null),
('reach',     null, '~에 닿다',           'Vt', null),
('marry',     null, '~와 결혼하다',       'Vt', null),
('approach',  null, '~에 접근하다',       'Vt', null),
('enter',     null, '~에 들어가다',       'Vt', null),
('answer',    null, '~에 답하다',         'Vt', null),
('call',      null, '~을 부르다',         'Vt', null),
('help',      null, '~을 돕다',           'Vt', null),
('make',      null, '~을 만들다',         'Vt', null),
('create',    null, '~을 창조하다',       'Vt', null),
('build',     null, '~을 짓다',           'Vt', null),
('destroy',   null, '~을 파괴하다',       'Vt', null),
('find',      null, '~을 찾다',           'Vt', null),
('lose',      null, '~을 잃다',           'Vt', null),
('keep',      null, '~을 유지하다',       'Vt', null),
('send',      null, '~을 보내다',         'Vt', null),
('give',      null, '~을 주다',           'Vt', null),
('tell',      null, '~에게 말하다',       'Vt', null),
('ask',       null, '~에게 묻다',         'Vt', null),
('use',       null, '~을 사용하다',       'Vt', null),
('need',      null, '~을 필요로 하다',    'Vt', null),
('want',      null, '~을 원하다',         'Vt', null),
('like',      null, '~을 좋아하다',       'Vt', null),
('love',      null, '~을 사랑하다',       'Vt', null),
('hate',      null, '~을 싫어하다',       'Vt', null),
('know',      null, '~을 알다',           'Vt', null),
('consider',  null, '~을 고려하다',       'Vt', null);
```

- [ ] **Step 2: Apply seed in Supabase SQL Editor**

Paste and run `supabase/seed.sql` in Supabase SQL Editor.

- [ ] **Step 3: Verify row count**

Run in SQL Editor:
```sql
select count(*) from words;
-- Expected: 100
select count(*) from words where pair_id is not null;
-- Expected: 40
```

- [ ] **Step 4: Commit**

```bash
git add supabase/seed.sql
git commit -m "feat: add 100 Vi/Vt seed words with 20 pairs"
```

---

## Task 5: Supabase Client Setup

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`

- [ ] **Step 1: Create browser client**

```bash
mkdir -p lib/supabase
```

Create `lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Create server client**

Create `lib/supabase/server.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/
git commit -m "feat: add Supabase browser and server clients"
```

---

## Task 6: Auth Logic

**Files:**
- Create: `lib/auth.ts`
- Create: `lib/auth.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/auth.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { buildEmail, parseUsername } from './auth'

describe('buildEmail', () => {
  it('converts username to fake email', () => {
    expect(buildEmail('alice')).toBe('alice@jata100.app')
  })

  it('handles usernames with dots and hyphens', () => {
    expect(buildEmail('alice.kim')).toBe('alice.kim@jata100.app')
  })
})

describe('parseUsername', () => {
  it('extracts username from fake email', () => {
    expect(parseUsername('alice@jata100.app')).toBe('alice')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `buildEmail` and `parseUsername` not defined.

- [ ] **Step 3: Implement auth.ts**

Create `lib/auth.ts`:
```typescript
import { createClient } from './supabase/client'

export function buildEmail(username: string): string {
  return `${username}@jata100.app`
}

export function parseUsername(email: string): string {
  return email.replace('@jata100.app', '')
}

export async function loginOrCreate(
  username: string,
  password: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const email = buildEmail(username)

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (!signInError) return { error: null }

  // User doesn't exist — create account
  if (signInError.message.includes('Invalid login credentials')) {
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    })
    if (signUpError) return { error: signUpError.message }
    return { error: null }
  }

  return { error: signInError.message }
}

export async function logout(): Promise<void> {
  const supabase = createClient()
  await supabase.auth.signOut()
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: PASS — `buildEmail` and `parseUsername` tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/auth.ts lib/auth.test.ts
git commit -m "feat: add login/auto-create auth logic"
```

---

## Task 7: Route Middleware

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Create middleware**

Create `middleware.ts` at project root:
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Not logged in → force to login
  if (!user && pathname !== '/') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Logged in on login page → redirect
  if (user && pathname === '/') {
    const { data: settings } = await supabase
      .from('user_settings')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (!settings) {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat: add route protection middleware"
```

---

## Task 8: Login Page

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Update root layout**

Replace `app/layout.tsx`:
```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '자타 100',
  description: '영어 자/타동사 암기장',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Build login page**

Replace `app/page.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { loginOrCreate } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password.trim()) return

    setLoading(true)
    setError(null)

    const { error } = await loginOrCreate(username.trim(), password)
    if (error) {
      setError('로그인에 실패했습니다. 비밀번호를 확인해주세요.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-center mb-2">자타 100</h1>
        <p className="text-gray-500 text-center mb-8 text-sm">
          영어 자/타동사 완전 정복
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              아이디
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="아이디 입력"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 입력"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? '로딩 중...' : '시작하기'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          없는 아이디는 자동으로 만들어집니다
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify login page renders**

```bash
npm run dev
```

Open `http://localhost:3000`. Login form should render.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx app/layout.tsx
git commit -m "feat: add login page with auto-create UX"
```

---

## Task 9: Onboarding Page

**Files:**
- Create: `app/onboarding/page.tsx`

- [ ] **Step 1: Create onboarding page**

```bash
mkdir -p app/onboarding
```

Create `app/onboarding/page.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const GOAL_OPTIONS = [10, 20, 30, 50]

export default function OnboardingPage() {
  const router = useRouter()
  const [goal, setGoal] = useState(20)
  const [loading, setLoading] = useState(false)

  async function handleStart() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    await supabase.from('user_settings').upsert({
      id: user.id,
      daily_goal: goal,
    })

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h2 className="text-2xl font-bold text-center mb-2">하루 목표 설정</h2>
        <p className="text-gray-500 text-center mb-8 text-sm">
          매일 몇 개씩 공부할까요?
        </p>

        <div className="grid grid-cols-2 gap-3 mb-8">
          {GOAL_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setGoal(n)}
              className={`py-4 rounded-xl text-lg font-bold border-2 transition-colors ${
                goal === n
                  ? 'border-blue-600 bg-blue-50 text-blue-600'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {n}개
            </button>
          ))}
        </div>

        <button
          onClick={handleStart}
          disabled={loading}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? '저장 중...' : '시작하기'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/onboarding/
git commit -m "feat: add onboarding page for daily goal setup"
```

---

## Task 10: Word Selector Algorithm

**Files:**
- Create: `lib/wordSelector.ts`
- Create: `lib/wordSelector.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/wordSelector.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { selectTodayWords } from './wordSelector'
import type { Word, Progress } from '@/types'

function makeWord(id: number, type: 'Vi' | 'Vt', pair_id: number | null = null): Word {
  return { id, english: `word${id}`, korean_vi: type === 'Vi' ? '뜻' : null, korean_vt: type === 'Vt' ? '~을 뜻' : null, type, pair_id }
}

function makeProgress(word_id: number, overrides: Partial<Progress> = {}): Progress {
  return {
    user_id: 'user1',
    word_id,
    error_count: 0,
    consecutive_correct: 0,
    is_mastered: false,
    last_seen_date: null,
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('selectTodayWords', () => {
  it('excludes mastered words', () => {
    const words = [makeWord(1, 'Vi'), makeWord(2, 'Vi')]
    const map = new Map([
      [1, makeProgress(1, { is_mastered: true })],
      [2, makeProgress(2)],
    ])
    const result = selectTodayWords(words, map, 10)
    expect(result.map(w => w.id)).not.toContain(1)
    expect(result.map(w => w.id)).toContain(2)
  })

  it('respects daily_goal limit', () => {
    const words = Array.from({ length: 30 }, (_, i) => makeWord(i + 1, 'Vi'))
    const map = new Map(words.map(w => [w.id, makeProgress(w.id)]))
    const result = selectTodayWords(words, map, 5)
    expect(result.length).toBeLessThanOrEqual(5)
  })

  it('prioritizes words with higher error_count', () => {
    const words = [makeWord(1, 'Vi'), makeWord(2, 'Vi'), makeWord(3, 'Vi')]
    const map = new Map([
      [1, makeProgress(1, { error_count: 0 })],
      [2, makeProgress(2, { error_count: 5 })],
      [3, makeProgress(3, { error_count: 2 })],
    ])
    const result = selectTodayWords(words, map, 3)
    expect(result[0].id).toBe(2)
    expect(result[1].id).toBe(3)
  })

  it('auto-adds unmastered pair partner', () => {
    const words = [
      makeWord(1, 'Vi', 1),
      makeWord(2, 'Vt', 1),
      ...Array.from({ length: 10 }, (_, i) => makeWord(i + 10, 'Vi')),
    ]
    const map = new Map(words.map(w => [w.id, makeProgress(w.id)]))
    // daily_goal=1, only word 1 selected initially, but pair partner (2) should be added
    const result = selectTodayWords(words, map, 1)
    const ids = result.map(w => w.id)
    expect(ids).toContain(1)
    expect(ids).toContain(2)
  })

  it('does not add mastered pair partner', () => {
    const words = [
      makeWord(1, 'Vi', 1),
      makeWord(2, 'Vt', 1),
    ]
    const map = new Map([
      [1, makeProgress(1)],
      [2, makeProgress(2, { is_mastered: true })],
    ])
    const result = selectTodayWords(words, map, 10)
    const ids = result.map(w => w.id)
    expect(ids).toContain(1)
    expect(ids).not.toContain(2)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `selectTodayWords` not defined.

- [ ] **Step 3: Implement wordSelector.ts**

Create `lib/wordSelector.ts`:
```typescript
import type { Word, Progress } from '@/types'

export function selectTodayWords(
  allWords: Word[],
  progressMap: Map<number, Progress>,
  dailyGoal: number
): Word[] {
  const unmastered = allWords.filter(
    (w) => !progressMap.get(w.id)?.is_mastered
  )

  const sorted = [...unmastered].sort((a, b) => {
    const ea = progressMap.get(a.id)?.error_count ?? 0
    const eb = progressMap.get(b.id)?.error_count ?? 0
    if (eb !== ea) return eb - ea

    const da = progressMap.get(a.id)?.last_seen_date ?? ''
    const db = progressMap.get(b.id)?.last_seen_date ?? ''
    if (da !== db) return da < db ? -1 : 1

    return Math.random() - 0.5
  })

  const base = sorted.slice(0, dailyGoal)
  const selectedIds = new Set(base.map((w) => w.id))

  const extras: Word[] = []
  for (const w of base) {
    if (w.pair_id === null) continue
    const partner = unmastered.find(
      (u) => u.pair_id === w.pair_id && u.id !== w.id && !selectedIds.has(u.id)
    )
    if (partner) {
      extras.push(partner)
      selectedIds.add(partner.id)
    }
  }

  return [...base, ...extras]
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: PASS — all 5 wordSelector tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/wordSelector.ts lib/wordSelector.test.ts
git commit -m "feat: add word selector algorithm with pair support"
```

---

## Task 11: Quiz Engine

**Files:**
- Create: `lib/quizEngine.ts`
- Create: `lib/quizEngine.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/quizEngine.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { initQueue, processAnswer, getDistractor } from './quizEngine'
import type { Word, Progress } from '@/types'

function makeWord(id: number, type: 'Vi' | 'Vt', pair_id: number | null = null): Word {
  return {
    id,
    english: `word${id}`,
    korean_vi: type === 'Vi' ? '뜻Vi' : null,
    korean_vt: type === 'Vt' ? '~을 뜻Vt' : null,
    type,
    pair_id,
  }
}

function makeProgress(word_id: number, cc = 0, ec = 0): Progress {
  return {
    user_id: 'u1',
    word_id,
    consecutive_correct: cc,
    error_count: ec,
    is_mastered: false,
    last_seen_date: null,
    updated_at: '',
  }
}

describe('initQueue', () => {
  it('builds QueueItems for each word', () => {
    const words = [makeWord(1, 'Vi'), makeWord(2, 'Vt')]
    const map = new Map([[1, makeProgress(1)], [2, makeProgress(2)]])
    const queue = initQueue(words, map)
    expect(queue).toHaveLength(2)
    expect(queue[0].word.id).toBe(1)
    expect(queue[0].progress.consecutive_correct).toBe(0)
  })

  it('uses default progress when no entry exists', () => {
    const words = [makeWord(1, 'Vi')]
    const queue = initQueue(words, new Map())
    expect(queue[0].progress.error_count).toBe(0)
  })
})

describe('processAnswer - correct', () => {
  it('increments consecutive_correct', () => {
    const words = [makeWord(1, 'Vi')]
    const map = new Map([[1, makeProgress(1, 0)]])
    const queue = initQueue(words, map)
    const { updatedQueue, graduated } = processAnswer(queue, 0, true)
    expect(updatedQueue[0].progress.consecutive_correct).toBe(1)
    expect(graduated).toBe(false)
  })

  it('graduates at consecutive_correct = 3', () => {
    const words = [makeWord(1, 'Vi'), makeWord(2, 'Vi')]
    const map = new Map([
      [1, makeProgress(1, 2)],
      [2, makeProgress(2)],
    ])
    const queue = initQueue(words, map)
    const { updatedQueue, graduated } = processAnswer(queue, 0, true)
    expect(graduated).toBe(true)
    expect(updatedQueue).toHaveLength(1) // word 1 removed
    expect(updatedQueue[0].word.id).toBe(2)
  })
})

describe('processAnswer - wrong', () => {
  it('resets consecutive_correct and increments error_count', () => {
    const words = [makeWord(1, 'Vi'), makeWord(2, 'Vi')]
    const map = new Map([
      [1, makeProgress(1, 2, 0)],
      [2, makeProgress(2)],
    ])
    const queue = initQueue(words, map)
    const { updatedQueue, graduated } = processAnswer(queue, 0, false)
    expect(graduated).toBe(false)
    expect(updatedQueue[0].word.id).toBe(2) // word 2 is now first
    expect(updatedQueue[1].word.id).toBe(1) // word 1 moved to end
    expect(updatedQueue[1].progress.consecutive_correct).toBe(0)
    expect(updatedQueue[1].progress.error_count).toBe(1)
  })
})

describe('getDistractor', () => {
  it('returns pair partner meaning when available', () => {
    const viWord = makeWord(1, 'Vi', 42)
    const vtPartner = makeWord(2, 'Vt', 42)
    const allWords = [viWord, vtPartner]
    const distractor = getDistractor(viWord, allWords)
    expect(distractor).toBe('~을 뜻Vt')
  })

  it('falls back to random opposite-type word meaning', () => {
    const viWord = makeWord(1, 'Vi', null)
    const vtWord = makeWord(2, 'Vt', null)
    const allWords = [viWord, vtWord]
    const distractor = getDistractor(viWord, allWords)
    expect(distractor).toBe('~을 뜻Vt')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL.

- [ ] **Step 3: Implement quizEngine.ts**

Create `lib/quizEngine.ts`:
```typescript
import type { Word, Progress, QueueItem } from '@/types'
import { createClient } from './supabase/client'

export function initQueue(
  words: Word[],
  progressMap: Map<number, Progress>
): QueueItem[] {
  return words.map((word) => ({
    word,
    progress: progressMap.get(word.id) ?? {
      user_id: '',
      word_id: word.id,
      error_count: 0,
      consecutive_correct: 0,
      is_mastered: false,
      last_seen_date: null,
      updated_at: new Date().toISOString(),
    },
  }))
}

export function processAnswer(
  queue: QueueItem[],
  index: number,
  isCorrect: boolean
): { updatedQueue: QueueItem[]; graduated: boolean; updatedItem: QueueItem } {
  const item = queue[index]
  const updatedProgress: Progress = {
    ...item.progress,
    consecutive_correct: isCorrect ? item.progress.consecutive_correct + 1 : 0,
    error_count: isCorrect
      ? item.progress.error_count
      : item.progress.error_count + 1,
  }

  const graduated = updatedProgress.consecutive_correct >= 3
  if (graduated) updatedProgress.is_mastered = true

  const updatedItem: QueueItem = { ...item, progress: updatedProgress }
  const newQueue = [...queue]
  newQueue[index] = updatedItem

  if (graduated) {
    newQueue.splice(index, 1)
    return { updatedQueue: newQueue, graduated: true, updatedItem }
  }

  if (!isCorrect) {
    newQueue.splice(index, 1)
    newQueue.push(updatedItem)
  }

  return { updatedQueue: newQueue, graduated: false, updatedItem }
}

export function getDistractor(word: Word, allWords: Word[]): string {
  const targetType = word.type === 'Vi' ? 'Vt' : 'Vi'
  const meaningKey = targetType === 'Vt' ? 'korean_vt' : 'korean_vi'

  // Prefer pair partner
  if (word.pair_id !== null) {
    const partner = allWords.find(
      (w) => w.pair_id === word.pair_id && w.id !== word.id
    )
    if (partner?.[meaningKey]) return partner[meaningKey]!
  }

  // Random opposite-type word
  const candidates = allWords.filter(
    (w) => w.type === targetType && w.id !== word.id && w[meaningKey]
  )
  const pick = candidates[Math.floor(Math.random() * candidates.length)]
  return pick?.[meaningKey] ?? '—'
}

export function syncProgress(
  userId: string,
  progress: Progress,
  todayStr: string
): void {
  const supabase = createClient()
  supabase
    .from('progress')
    .upsert({
      user_id: userId,
      word_id: progress.word_id,
      error_count: progress.error_count,
      consecutive_correct: progress.consecutive_correct,
      is_mastered: progress.is_mastered,
      last_seen_date: todayStr,
      updated_at: new Date().toISOString(),
    })
    .then(() => {})
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: PASS — all quizEngine tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/quizEngine.ts lib/quizEngine.test.ts
git commit -m "feat: add quiz engine with queue, scoring, and fire-and-forget sync"
```

---

## Task 12: Preview Phase Component

**Files:**
- Create: `app/study/PreviewPhase.tsx`

- [ ] **Step 1: Create component**

```bash
mkdir -p app/study
```

Create `app/study/PreviewPhase.tsx`:
```typescript
'use client'

import { useState } from 'react'
import type { Word } from '@/types'

interface PreviewPhaseProps {
  words: Word[]
  onComplete: () => void
}

interface PreviewSlide {
  isPair: boolean
  words: Word[]
}

function buildSlides(words: Word[]): PreviewSlide[] {
  const seen = new Set<number>()
  const slides: PreviewSlide[] = []

  for (const word of words) {
    if (seen.has(word.id)) continue
    seen.add(word.id)

    if (word.pair_id !== null) {
      const partner = words.find(
        (w) => w.pair_id === word.pair_id && w.id !== word.id
      )
      if (partner && !seen.has(partner.id)) {
        seen.add(partner.id)
        slides.push({ isPair: true, words: [word, partner] })
        continue
      }
    }

    slides.push({ isPair: false, words: [word] })
  }

  return slides
}

function WordCard({ word }: { word: Word }) {
  const meaning = word.type === 'Vi' ? word.korean_vi : word.korean_vt
  const label = word.type === 'Vi' ? '자동사' : '타동사'
  const color = word.type === 'Vi' ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'
  const textColor = word.type === 'Vi' ? 'text-blue-600' : 'text-green-600'

  return (
    <div className={`flex-1 rounded-2xl border-2 p-6 ${color}`}>
      <span className={`text-xs font-bold uppercase tracking-wider ${textColor}`}>
        {label}
      </span>
      <p className="text-2xl font-bold mt-2 mb-1">{word.english}</p>
      <p className="text-lg text-gray-700">{meaning}</p>
    </div>
  )
}

export default function PreviewPhase({ words, onComplete }: PreviewPhaseProps) {
  const slides = buildSlides(words)
  const [index, setIndex] = useState(0)

  const current = slides[index]
  const isLast = index === slides.length - 1

  function handleNext() {
    if (isLast) {
      onComplete()
    } else {
      setIndex(index + 1)
    }
  }

  return (
    <div className="min-h-screen flex flex-col p-4 max-w-lg mx-auto">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-500 mb-1">
          <span>예습</span>
          <span>{index + 1} / {slides.length}</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full">
          <div
            className="h-2 bg-blue-500 rounded-full transition-all"
            style={{ width: `${((index + 1) / slides.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Card(s) */}
      <div className={`flex gap-3 flex-1 items-stretch mb-8 ${current.isPair ? 'flex-row' : 'flex-col justify-center'}`}>
        {current.words.map((w) => (
          <WordCard key={w.id} word={w} />
        ))}
      </div>

      <button
        onClick={handleNext}
        className="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold text-lg hover:bg-blue-700 transition-colors"
      >
        {isLast ? '전투 시작 →' : '다음'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/study/PreviewPhase.tsx
git commit -m "feat: add preview phase component with pair card layout"
```

---

## Task 13: Battle Phase Component

**Files:**
- Create: `app/study/BattlePhase.tsx`

- [ ] **Step 1: Create component**

Create `app/study/BattlePhase.tsx`:
```typescript
'use client'

import { useState, useMemo } from 'react'
import type { Word, QueueItem } from '@/types'
import { processAnswer, getDistractor, syncProgress } from '@/lib/quizEngine'

interface BattlePhaseProps {
  initialQueue: QueueItem[]
  allWords: Word[]
  userId: string
  todayStr: string
  onComplete: (stats: { attempts: number; newlyMastered: number }) => void
}

type AnswerState = 'idle' | 'correct' | 'wrong'

export default function BattlePhase({
  initialQueue,
  allWords,
  userId,
  todayStr,
  onComplete,
}: BattlePhaseProps) {
  const [queue, setQueue] = useState<QueueItem[]>(initialQueue)
  const [attempts, setAttempts] = useState(0)
  const [newlyMastered, setNewlyMastered] = useState(0)
  const [answerState, setAnswerState] = useState<AnswerState>('idle')
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)

  const current = queue[0]

  // Memoized per word.id — prevents choice shuffling during feedback re-renders
  const choices = useMemo(() => {
    if (!current) return null
    const correctMeaning =
      current.word.type === 'Vi' ? current.word.korean_vi! : current.word.korean_vt!
    const distractor = getDistractor(current.word, allWords)
    const opts = [correctMeaning, distractor].sort(() => Math.random() - 0.5)
    return { opts, correct: correctMeaning }
  }, [current?.word.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleAnswer(chosen: string) {
    if (answerState !== 'idle' || !choices) return

    const isCorrect = chosen === choices.correct
    setSelectedAnswer(chosen)
    setAnswerState(isCorrect ? 'correct' : 'wrong')
    setAttempts((a) => a + 1)

    const { updatedQueue, graduated, updatedItem } = processAnswer(queue, 0, isCorrect)

    syncProgress(userId, updatedItem.progress, todayStr)

    if (graduated) setNewlyMastered((n) => n + 1)

    setTimeout(() => {
      setQueue(updatedQueue)
      setAnswerState('idle')
      setSelectedAnswer(null)

      if (updatedQueue.length === 0) {
        onComplete({ attempts: attempts + 1, newlyMastered: newlyMastered + (graduated ? 1 : 0) })
      }
    }, 700)
  }

  if (!current || !choices) return null

  return (
    <div className="min-h-screen flex flex-col p-4 max-w-lg mx-auto">
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-500 mb-1">
          <span>전투</span>
          <span>남은 단어 {queue.length}개</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full">
          <div
            className="h-2 bg-orange-500 rounded-full transition-all"
            style={{
              width: `${Math.max(5, (1 - queue.length / initialQueue.length) * 100)}%`,
            }}
          />
        </div>
      </div>

      {/* Word */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <p className="text-4xl font-bold mb-2">{current.word.english}</p>
        <p className="text-sm text-gray-400 mb-12">
          {current.word.type === 'Vi' ? '자동사' : '타동사'}
        </p>

        {/* Answer buttons */}
        <div className="w-full space-y-3">
          {choices.opts.map((opt) => {
            const isCorrect = opt === choices.correct
            let btnClass =
              'w-full py-4 px-6 rounded-xl font-semibold text-left border-2 transition-colors '

            if (answerState === 'idle') {
              btnClass += 'border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50'
            } else if (opt === selectedAnswer) {
              btnClass += answerState === 'correct'
                ? 'border-green-500 bg-green-50 text-green-700'
                : 'border-red-500 bg-red-50 text-red-700'
            } else if (answerState === 'wrong' && isCorrect) {
              btnClass += 'border-green-500 bg-green-50 text-green-700'
            } else {
              btnClass += 'border-gray-200 bg-white opacity-50'
            }

            return (
              <button
                key={opt}
                onClick={() => handleAnswer(opt)}
                disabled={answerState !== 'idle'}
                className={btnClass}
              >
                {opt}
              </button>
            )
          })}
        </div>

        {/* Feedback */}
        {answerState !== 'idle' && (
          <p className={`mt-4 font-semibold ${answerState === 'correct' ? 'text-green-600' : 'text-red-500'}`}>
            {answerState === 'correct' ? '정답!' : '오답 — 다시 나올 거예요'}
          </p>
        )}
      </div>

      {/* Stats */}
      <p className="text-center text-sm text-gray-400 mt-4">
        총 {attempts}번 시도 · 오늘 {newlyMastered}개 완료
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/study/BattlePhase.tsx
git commit -m "feat: add battle phase quiz component"
```

---

## Task 14: Study Page (Orchestrator)

**Files:**
- Create: `app/study/page.tsx`

- [ ] **Step 1: Create study page**

Create `app/study/page.tsx`:
```typescript
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { selectTodayWords } from '@/lib/wordSelector'
import { initQueue } from '@/lib/quizEngine'
import PreviewPhase from './PreviewPhase'
import BattlePhase from './BattlePhase'
import type { Word, Progress, QueueItem, UserSettings } from '@/types'

type Phase = 'loading' | 'preview' | 'battle' | 'complete'

interface CompletionStats {
  attempts: number
  newlyMastered: number
  totalMastered: number
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

export default function StudyPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('loading')
  const [todayWords, setTodayWords] = useState<Word[]>([])
  const [allWords, setAllWords] = useState<Word[]>([])
  const [initialQueue, setInitialQueue] = useState<QueueItem[]>([])
  const [userId, setUserId] = useState('')
  const [stats, setStats] = useState<CompletionStats | null>(null)

  const todayStr = toDateStr(new Date())

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      setUserId(user.id)

      const [{ data: settings }, { data: words }, { data: progressRows }] =
        await Promise.all([
          supabase.from('user_settings').select('*').eq('id', user.id).single(),
          supabase.from('words').select('*'),
          supabase.from('progress').select('*').eq('user_id', user.id),
        ])

      if (!words) return

      const progressMap = new Map<number, Progress>(
        (progressRows ?? []).map((p) => [p.word_id, p])
      )

      const daily = (settings as UserSettings)?.daily_goal ?? 20
      const selected = selectTodayWords(words as Word[], progressMap, daily)

      setAllWords(words as Word[])
      setTodayWords(selected)
      setInitialQueue(initQueue(selected, progressMap))
      setPhase('preview')
    }

    load()
  }, [router])

  async function handleBattleComplete({
    attempts,
    newlyMastered,
  }: {
    attempts: number
    newlyMastered: number
  }) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Mark session as completed today
    await supabase
      .from('user_settings')
      .update({ last_completed_date: todayStr })
      .eq('id', user.id)

    const { count } = await supabase
      .from('progress')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_mastered', true)

    setStats({ attempts, newlyMastered, totalMastered: count ?? 0 })
    setPhase('complete')
  }

  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">단어 불러오는 중...</p>
      </div>
    )
  }

  if (phase === 'preview') {
    return (
      <PreviewPhase
        words={todayWords}
        onComplete={() => setPhase('battle')}
      />
    )
  }

  if (phase === 'battle') {
    return (
      <BattlePhase
        initialQueue={initialQueue}
        allWords={allWords}
        userId={userId}
        todayStr={todayStr}
        onComplete={handleBattleComplete}
      />
    )
  }

  // complete
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <p className="text-5xl mb-4">🎉</p>
        <h2 className="text-2xl font-bold mb-2">오늘 학습 완료!</h2>
        <div className="bg-white rounded-2xl p-6 shadow-sm mt-6 space-y-3 text-left">
          <div className="flex justify-between">
            <span className="text-gray-500">총 시도</span>
            <span className="font-bold">{stats?.attempts}번</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">오늘 새로 암기</span>
            <span className="font-bold text-green-600">+{stats?.newlyMastered}개</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">누적 암기 완료</span>
            <span className="font-bold">{stats?.totalMastered} / 100</span>
          </div>
        </div>

        {stats?.totalMastered === 100 && (
          <div className="mt-6 p-4 bg-yellow-50 rounded-2xl border border-yellow-200">
            <p className="font-bold text-yellow-700">🏆 100개 전부 정복!</p>
          </div>
        )}

        <button
          onClick={() => router.push('/dashboard')}
          className="mt-8 w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
        >
          홈으로
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/study/
git commit -m "feat: add study page orchestrating preview and battle phases"
```

---

## Task 15: Dashboard Page

**Files:**
- Create: `app/dashboard/page.tsx`

- [ ] **Step 1: Create dashboard**

```bash
mkdir -p app/dashboard
```

Create `app/dashboard/page.tsx`:
```typescript
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { UserSettings } from '@/types'

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]
}

interface DashboardData {
  dailyGoal: number
  totalMastered: number
  completedToday: boolean
}

export default function DashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const todayStr = toDateStr(new Date())

      const [{ data: settings }, { count: mastered }] = await Promise.all([
        supabase.from('user_settings').select('*').eq('id', user.id).single(),
        supabase
          .from('progress')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_mastered', true),
      ])

      const s = settings as UserSettings | null
      setData({
        dailyGoal: s?.daily_goal ?? 20,
        totalMastered: mastered ?? 0,
        completedToday: s?.last_completed_date === todayStr,
      })
    }
    load()
  }, [router])

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">불러오는 중...</p>
      </div>
    )
  }

  const progressPct = Math.round((data.totalMastered / 100) * 100)

  return (
    <div className="min-h-screen p-4 max-w-sm mx-auto">
      <div className="flex justify-between items-center mb-8 pt-4">
        <h1 className="text-2xl font-bold">자타 100</h1>
        <Link href="/settings" className="text-sm text-gray-400 hover:text-gray-600">
          설정
        </Link>
      </div>

      {/* Overall progress */}
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
        <p className="text-sm text-gray-500 mb-1">전체 진도</p>
        <p className="text-3xl font-bold mb-3">
          {data.totalMastered}
          <span className="text-lg text-gray-400 font-normal"> / 100</span>
        </p>
        <div className="h-3 bg-gray-100 rounded-full">
          <div
            className="h-3 bg-blue-500 rounded-full transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-right text-xs text-gray-400 mt-1">{progressPct}%</p>
      </div>

      {/* Start button */}
      {data.completedToday ? (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
          <p className="text-green-700 font-semibold text-lg">오늘 학습 완료! ✓</p>
          <p className="text-green-500 text-sm mt-1">내일 다시 만나요</p>
        </div>
      ) : (
        <button
          onClick={() => router.push('/study')}
          className="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold text-xl hover:bg-blue-700 transition-colors"
        >
          오늘 학습 시작
          <span className="block text-sm font-normal mt-1 opacity-80">
            하루 {data.dailyGoal}개
          </span>
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/
git commit -m "feat: add dashboard page with progress and start button"
```

---

## Task 16: Settings Page

**Files:**
- Create: `app/settings/page.tsx`

- [ ] **Step 1: Create settings page**

```bash
mkdir -p app/settings
```

Create `app/settings/page.tsx`:
```typescript
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { logout } from '@/lib/auth'

const GOAL_OPTIONS = [10, 20, 30, 50]

export default function SettingsPage() {
  const router = useRouter()
  const [goal, setGoal] = useState(20)
  const [saved, setSaved] = useState(false)
  const [userId, setUserId] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setUserId(user.id)

      const { data } = await supabase
        .from('user_settings')
        .select('daily_goal')
        .eq('id', user.id)
        .single()

      if (data) setGoal(data.daily_goal)
    }
    load()
  }, [router])

  async function handleSave() {
    const supabase = createClient()
    await supabase
      .from('user_settings')
      .update({ daily_goal: goal })
      .eq('id', userId)

    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleLogout() {
    await logout()
    router.push('/')
  }

  return (
    <div className="min-h-screen p-4 max-w-sm mx-auto">
      <div className="flex items-center gap-3 mb-8 pt-4">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
          ← 뒤로
        </button>
        <h2 className="text-xl font-bold">설정</h2>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
        <p className="font-semibold mb-4">하루 목표 단어 수</p>
        <div className="grid grid-cols-2 gap-3">
          {GOAL_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setGoal(n)}
              className={`py-3 rounded-xl font-bold border-2 transition-colors ${
                goal === n
                  ? 'border-blue-600 bg-blue-50 text-blue-600'
                  : 'border-gray-200 text-gray-600'
              }`}
            >
              {n}개
            </button>
          ))}
        </div>

        <button
          onClick={handleSave}
          className="w-full mt-4 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
        >
          {saved ? '저장됨 ✓' : '저장'}
        </button>
      </div>

      <button
        onClick={handleLogout}
        className="w-full py-3 border-2 border-red-200 text-red-500 rounded-xl font-semibold hover:bg-red-50 transition-colors"
      >
        로그아웃
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/settings/
git commit -m "feat: add settings page with daily goal and logout"
```

---

## Task 17: Build Verification & Deploy

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: all unit tests pass (auth, wordSelector, quizEngine).

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: build completes with no errors.

- [ ] **Step 3: Create vercel.json**

Create `vercel.json`:
```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install"
}
```

- [ ] **Step 4: Set environment variables in Vercel**

In Vercel project settings → Environment Variables, add:
```
NEXT_PUBLIC_SUPABASE_URL = <your supabase url>
NEXT_PUBLIC_SUPABASE_ANON_KEY = <your anon key>
```

- [ ] **Step 5: Deploy**

```bash
npx vercel --prod
```

- [ ] **Step 6: Smoke test on deployed URL**

1. Open deployed URL
2. Create new account with any ID/PW
3. Complete onboarding
4. Run through 1 full preview → battle session
5. Verify progress saves (check Supabase table editor)

- [ ] **Step 7: Final commit**

```bash
git add vercel.json
git commit -m "chore: add Vercel config and complete verb memorizer app"
```
