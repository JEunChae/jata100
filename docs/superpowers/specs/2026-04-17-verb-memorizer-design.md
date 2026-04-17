# Design Spec: 영어 자/타동사 암기장

Date: 2026-04-17

## Overview

영어 자동사/타동사를 직관적으로 구분해서 암기하는 웹 앱.
100개의 대표 단어를 오답 우선 스마트 반복과 짝꿍 세트 학습으로 완전 정복한다.

---

## 1. Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 14 (App Router) + Tailwind CSS |
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

```sql
-- 유저 설정 (Supabase auth.users.id를 PK로 사용)
CREATE TABLE user_settings (
  id          UUID PRIMARY KEY REFERENCES auth.users(id),
  daily_goal  INT NOT NULL DEFAULT 20,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 단어 (관리자 seed 100개)
CREATE TABLE words (
  id          SERIAL PRIMARY KEY,
  english     TEXT NOT NULL,
  korean_vi   TEXT,           -- 자동사 뜻 (없으면 null)
  korean_vt   TEXT,           -- 타동사 뜻, ~을 포함 (없으면 null)
  type        TEXT NOT NULL,  -- 'Vi' | 'Vt'
  pair_id     INT             -- 짝꿍끼리 동일 숫자, 없으면 null
);

-- 학습 진도
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

**RLS 정책:** 모든 테이블에 `auth.uid() = user_id` Row Level Security 적용.

---

## 4. 페이지 구조

```
/               로그인 페이지
/onboarding     첫 로그인 1회 — 하루 목표 설정 (10/20/30/50)
/dashboard      홈 — 오늘 진도 + 전체 진도 + 학습 시작 버튼
/study          학습 화면 (예습 → 전투)
/settings       하루 목표 변경 + 로그아웃
```

---

## 5. 퀴즈 엔진 로직

### 세션 단어 선택 (클라이언트)

```
1. progress 전체 로드 (유저별)
2. is_mastered = false 필터
3. 오늘 이미 졸업한 단어 제외 (last_seen_date = today AND consecutive_correct >= 3)
4. 우선순위 정렬: error_count DESC → last_seen_date ASC → random
5. daily_goal 개수 슬라이스
6. pair_id 있는 단어 포함 시 짝꿍 단어 자동 추가
```

### 예습 Phase

- 오늘의 N개 단어를 순서대로 카드 형태로 표시
- 짝꿍 단어: 두 카드 나란히 표시 (차이점 강조)
- [다음] 버튼으로 넘기기만 (채점 없음)
- 전체 완료 → 전투 Phase 시작

### 전투 Phase

```
큐 = 오늘의 N개 단어 (셔플)

각 문제:
  보기 2개 표시:
    Vi 단어 → [정답: 자동사 뜻] vs [오답: 타동사 뜻]
    Vt 단어 → [정답: 타동사 뜻] vs [오답: 자동사 뜻]
    오답 보기는 짝꿍 단어 우선, 없으면 랜덤 반대 타입 단어에서 선택

  정답 선택:
    consecutive_correct +1
    consecutive_correct >= 3 → is_mastered = true → 큐에서 졸업

  오답 선택:
    consecutive_correct = 0
    error_count +1
    큐 맨 뒤로 재삽입

세션 종료: 큐.length === 0
```

**consecutive_correct는 날짜 넘어도 누적** (어제 2번 → 오늘 1번 = 완료)

### 백그라운드 Sync

```typescript
// await 없이 fire-and-forget
supabase.from('progress').upsert({
  user_id, word_id,
  consecutive_correct,
  error_count,
  is_mastered,
  last_seen_date: today,
  updated_at: new Date()
})
```

### 세션 종료 화면

- 총 시도 횟수
- 신규 암기 완료 단어 수
- 누적 암기 완료 수 (N/100)

### 오늘 세션 재진입 차단

- 전투 Phase 완료(큐 = 0) 후 `/dashboard` 복귀
- `last_seen_date = today` 이고 오늘 전투 완료 플래그(세션 상태)가 있으면
  [학습 시작] 버튼 비활성화 + "오늘 학습 완료! 내일 다시 만나요" 메시지

### 전체 정복 엔드 스크린

- 100개 전부 `is_mastered = true`가 되면 특별 완료 화면 표시
- 이후 is_mastered 리셋 여부는 추후 결정 (현재 스코프 외)

---

## 6. 단어 시드 데이터 (100개)

### 구성

| 분류 | 개수 |
|------|------|
| 짝꿍 쌍 (Vi + Vt) | 20쌍 = 40개 |
| 순수 자동사 Vi | 30개 |
| 순수 타동사 Vt | 30개 |

### 짝꿍 20쌍

| pair_id | Vi | 뜻 | Vt | 뜻 |
|---------|----|----|----|----|
| 1 | rise | 오르다 | raise | ~을 올리다 |
| 2 | lie | 눕다 | lay | ~을 놓다 |
| 3 | sit | 앉다 | set | ~을 설정하다 |
| 4 | fall | 떨어지다 | fell | ~을 쓰러뜨리다 |
| 5 | come | 오다 | bring | ~을 가져오다 |
| 6 | go | 가다 | take | ~을 가져가다 |
| 7 | appear | 나타나다 | show | ~을 보여주다 |
| 8 | grow | 자라다 | grow | ~을 기르다 |
| 9 | hang | 매달리다 | hang | ~을 걸다 |
| 10 | run | 달리다 | run | ~을 운영하다 |
| 11 | turn | 돌다 | turn | ~을 돌리다 |
| 12 | move | 움직이다 | move | ~을 옮기다 |
| 13 | open | 열리다 | open | ~을 열다 |
| 14 | close | 닫히다 | close | ~을 닫다 |
| 15 | change | 변하다 | change | ~을 바꾸다 |
| 16 | break | 부러지다 | break | ~을 부수다 |
| 17 | stop | 멈추다 | stop | ~을 멈추다 |
| 18 | start | 시작되다 | start | ~을 시작하다 |
| 19 | spread | 퍼지다 | spread | ~을 퍼뜨리다 |
| 20 | burn | 타다 | burn | ~을 태우다 |

### 순수 자동사 Vi 30개

arrive, depart, emerge, exist, occur, happen, disappear, agree, succeed,
fail, sleep, wake, die, live, swim, fly, walk, run, jump, fall,
laugh, cry, wait, work, play, smile, stand, kneel, cough, sneeze

### 순수 타동사 Vt 30개

discuss, mention, resemble, contact, reach, marry, approach, enter,
answer, call, help, make, create, build, destroy, find, lose, keep,
send, give, tell, ask, show, use, need, want, like, love, hate, know

---

## 7. 컴포넌트 구조 (핵심)

```
app/
├── (auth)/
│   └── page.tsx              로그인
├── onboarding/
│   └── page.tsx              하루 목표 설정
├── dashboard/
│   └── page.tsx              홈
├── study/
│   ├── page.tsx              세션 컨트롤러
│   ├── PreviewPhase.tsx      예습 카드 뷰
│   └── BattlePhase.tsx       퀴즈 뷰
└── settings/
    └── page.tsx              설정

lib/
├── supabase.ts               클라이언트 인스턴스
├── auth.ts                   로그인/자동생성 로직
├── wordSelector.ts           오늘의 단어 선택 알고리즘
└── quizEngine.ts             큐 관리, 채점, sync
```
