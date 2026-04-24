# Design Spec: 영어 자/타동사 암기장 (jata100)

Last updated: 2026-04-24

## Overview

영어 자동사/타동사를 직관적으로 구분해서 암기하는 웹 앱.
두 가지 학습 카테고리를 제공한다:
1. **자/타동사 단어** — 초급/중급/고급 레벨별 단어 암기 (오답 우선 스마트 반복)
2. **영작 연습** — 케쌤 커리큘럼 기반 문장 만들기 (한국어 → 영어 타이핑)

---

## 1. Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 16 (App Router) + Tailwind CSS v4 |
| Auth | Supabase Auth (ID/PW, 이메일 인증 없음) |
| DB | Supabase PostgreSQL |
| Deployment | Vercel |

---

## 2. Auth & Session

- 로그인 화면에서 ID/PW 입력 → `signInWithPassword` 시도
  - 실패(유저 없음) → `signUp`으로 자동 계정 생성 후 로그인
  - ID는 내부적으로 `{id}@jata100.app` 이메일 형식으로 저장
- 이메일 인증 절차 없음 (Supabase 설정에서 비활성화)
- 세션: Supabase JWT + localStorage — 로그아웃 버튼 누르기 전까지 영구 유지
- 라우팅 보호:
  - 미로그인 → `/` 리다이렉트
  - 첫 로그인 (`user_settings` 없음) → `/onboarding` 리다이렉트

---

## 3. DB Schema

### Migration 001 — 기본 테이블

```sql
CREATE TABLE user_settings (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id),
  daily_goal          INT NOT NULL DEFAULT 20,
  last_completed_date DATE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE words (
  id          SERIAL PRIMARY KEY,
  english     TEXT NOT NULL,
  korean_vi   TEXT,        -- 자동사 뜻 (없으면 null)
  korean_vt   TEXT,        -- 타동사 뜻, ~을 포함 (없으면 null)
  type        TEXT NOT NULL CHECK (type IN ('Vi', 'Vt')),
  pair_id     INT          -- 짝꿍끼리 동일 숫자, 없으면 null
);

CREATE TABLE progress (
  id                  SERIAL PRIMARY KEY,
  user_id             UUID REFERENCES auth.users(id),
  word_id             INT REFERENCES words(id),
  error_count         INT NOT NULL DEFAULT 0,
  consecutive_correct INT NOT NULL DEFAULT 0,
  is_mastered         BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen_date      DATE,
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, word_id)
);
```

**RLS:** `user_settings`, `progress` → `auth.uid() = user_id` / `words` → 전체 읽기 허용

### Migration 002 — 레벨 컬럼 추가

```sql
ALTER TABLE words ADD COLUMN IF NOT EXISTS level TEXT NOT NULL DEFAULT 'beginner';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS current_level TEXT NOT NULL DEFAULT 'beginner';
```

### Migration 003 — 영작 연습 테이블

```sql
CREATE TABLE sentence_exercises (
  id          SERIAL PRIMARY KEY,
  chapter     TEXT NOT NULL,        -- e.g. '홀수달 #1'
  order_index INTEGER NOT NULL,
  korean      TEXT NOT NULL,
  hints       TEXT[] NOT NULL DEFAULT '{}',
  english     TEXT NOT NULL,        -- 정답 (채점 기준)
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sentence_progress (
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id         INTEGER REFERENCES sentence_exercises(id) ON DELETE CASCADE,
  attempt_count       INTEGER NOT NULL DEFAULT 0,
  correct_count       INTEGER NOT NULL DEFAULT 0,
  last_attempted_date DATE,
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, exercise_id)
);
```

**RLS:** `sentence_exercises` → 전체 읽기 허용 / `sentence_progress` → `auth.uid() = user_id`

---

## 4. 페이지 구조

```
/               로그인 페이지
/onboarding     첫 로그인 1회 — 하루 목표 설정 (10/20/30/50)
/dashboard      홈 — 자/타동사 레벨 카드 + 영작 카드
/study          자/타동사 학습 (예습 → 테스트), ?level=beginner|intermediate|advanced
/sentence       영작 연습 (챕터 선택 → 문장 퀴즈)
/settings       하루 목표 변경 + 로그아웃
```

---

## 5. 카테고리 A: 자/타동사 단어 학습

### 레벨 구성

| 레벨 | 단어 수 | 설명 |
|------|---------|------|
| beginner | 100개 | rise/raise 등 대표 짝꿍 + 기본 자/타동사 |
| intermediate | 100개 | 일상회화 빈출 단어 |
| advanced | 100개 | 일상회화 심화 단어 |

각 레벨은 독립적으로 선택 가능 (순차 해제 없음).

### 단어 구성 (레벨당)

| 분류 | 개수 |
|------|------|
| 짝꿍 쌍 (Vi + Vt) | 20쌍 = 40개 |
| 순수 자동사 Vi | 30개 |
| 순수 타동사 Vt | 30개 |

### 세션 단어 선택 알고리즘 (`wordSelector.ts`)

```
1. 해당 레벨 단어 로드
2. is_mastered = false 필터
3. Fisher-Yates 셔플 후 오류 우선 정렬:
   error_count DESC → last_seen_date ASC → random
4. daily_goal 유닛 수 선택
   - 짝꿍 쌍 = 1유닛 (두 단어 함께 포함)
   - 단일 단어 = 1유닛
5. 짝꿍 파트너가 미완료면 자동 포함
```

### 예습 Phase (`PreviewPhase.tsx`)

- 오늘의 단어를 카드 형태로 순서대로 표시
- 짝꿍 단어: 두 카드 나란히 표시
- [다음] 버튼으로 넘기기만 (채점 없음)
- 완료 → 테스트 Phase 진입

### 테스트 Phase (`BattlePhase.tsx`)

```
큐 = 오늘의 단어 (Fisher-Yates 셔플)

각 문제:
  보기 2개:
    Vi → [자동사 뜻 정답] vs [타동사 뜻 오답]
    Vt → [타동사 뜻 정답] vs [자동사 뜻 오답]
    오답: 짝꿍 우선, 없으면 랜덤 반대 타입

  정답:
    consecutive_correct +1
    >= 3 → is_mastered = true → 큐 졸업

  오답:
    consecutive_correct = 0 / error_count +1
    큐 랜덤 위치(1 이후)에 재삽입 (같은 단어 연속 방지)

  완료 후 0.7초 딜레이 → 다음 문제
```

**헤더:** 남은 유닛 수 표시 (짝꿍 쌍 = 1로 카운트)

**fire-and-forget sync:** 매 답변마다 `progress` 테이블 upsert (await 없음)

---

## 6. 카테고리 B: 영작 연습

### 데이터

- 케쌤영어 커리큘럼 PDF 기반
- 181개 문장, 13개 챕터 (홀수달 #1~#9, 짝수달 #3~#9)
- 챕터별 15개 내외, 문법 주제별 분류

### 챕터 목록

| 챕터 | 주제 |
|------|------|
| 홀수달 #1 | 1형식 기본 |
| 홀수달 #2 | to부정사 |
| 홀수달 #3 | 동명사 |
| 홀수달 #4 | 의문to부정사 |
| 홀수달 #5 | 종속절 |
| 홀수달 #6 | 전치사 |
| 홀수달 #7 | 4형식 |
| 홀수달 #8 | 4형식 심화 |
| 짝수달 #3 | 2형식 |
| 짝수달 #5 | 수동태 |
| 짝수달 #7 | 5형식 |
| 짝수달 #8 | 5형식 심화 |
| 짝수달 #9 | 복합 리뷰 |

### 퀴즈 플로우 (`SentencePhase.tsx`)

```
챕터 선택 → 문제 순서대로 진행

각 문제:
  - 한국어 문장 표시
  - 힌트 단어 칩 표시 (영어 단어 / 한국어 뜻)
  - 텍스트 입력창
  - [제출] 클릭 또는 Enter

채점:
  정답 = normalizeAnswer(입력) === normalizeAnswer(정답)
  normalize: 소문자 변환 + 구두점 제거 + 공백 정규화

피드백:
  정답: 초록 하이라이트 + "정답! 🎯"
  오답: 빨간 하이라이트 + 정답 표시

[다음] 또는 Enter → 다음 문제
```

**진도:** `sentence_progress` 테이블에 attempt_count / correct_count 기록

---

## 7. 컴포넌트 구조

```
app/
├── page.tsx                  로그인
├── onboarding/page.tsx       하루 목표 설정
├── dashboard/page.tsx        홈 (두 카테고리 카드)
├── study/
│   ├── page.tsx              자/타동사 세션 컨트롤러
│   ├── PreviewPhase.tsx      예습 카드 뷰
│   └── BattlePhase.tsx       퀴즈 뷰
├── sentence/
│   ├── page.tsx              영작 챕터 선택 + 완료 화면
│   └── SentencePhase.tsx     문장 퀴즈 뷰
└── settings/page.tsx         설정

lib/
├── supabase/                 클라이언트/서버 인스턴스
├── auth.ts                   로그인/자동생성 로직
├── wordSelector.ts           오늘의 단어 선택 알고리즘
└── quizEngine.ts             큐 관리, 채점, sync

types/index.ts                Word, Progress, UserSettings, QueueItem,
                              SentenceExercise, SentenceProgress

supabase/
├── migrations/
│   ├── 001_initial.sql
│   ├── 002_levels.sql
│   └── 003_sentences.sql
├── seed.sql                  초급 단어 100개
├── seed_intermediate.sql     중급 단어 100개
├── seed_advanced.sql         고급 단어 100개
└── seed_sentences.sql        영작 문장 181개
```
