# Design Spec: 영어 자/타동사 암기장 (jata100)

Last updated: 2026-04-24

## Overview

영어 자동사/타동사를 직관적으로 구분해서 암기하는 웹 앱. 두 가지 학습 카테고리를 제공한다.

1. **자/타동사 단어** — 초급/중급/고급 레벨별 단어 암기 (오답 우선 스마트 반복)
2. **영작 연습** — 케쌤 커리큘럼 기반 문장 만들기 (한국어 → 영어 타이핑)

---

## 1. Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 16 (App Router) + Tailwind CSS v4 |
| Auth | Supabase Auth (ID/PW, 이메일 인증 없음) |
| DB | Supabase PostgreSQL + RLS |
| Deployment | Vercel |

---

## 2. Auth

- ID/PW 로그인 → 없으면 자동 계정 생성 (`{id}@jata100.app` 형식)
- 이메일 인증 없음, 세션 영구 유지
- 미로그인 → `/` / `user_settings` 없음 → `/onboarding` 리다이렉트

---

## 3. DB Schema

### 마이그레이션 파일

| 파일 | 내용 |
|------|------|
| `001_initial.sql` | `user_settings`, `words`, `progress` |
| `002_levels.sql` | `words.level`, `user_settings.current_level` 컬럼 추가 |
| `003_sentences.sql` | `sentence_exercises`, `sentence_progress` |

### RLS 정책 요약

| 테이블 | 정책 |
|--------|------|
| `user_settings` | `auth.uid() = id` |
| `words` | 전체 읽기 허용 |
| `progress` | `auth.uid() = user_id` |
| `sentence_exercises` | 전체 읽기 허용 |
| `sentence_progress` | `auth.uid() = user_id` |

---

## 4. 페이지 구조

```
/               로그인
/onboarding     하루 목표 설정 (최초 1회)
/dashboard      홈 — 자/타동사 레벨 카드 + 영작 카드
/study          자/타동사 학습 (?level=beginner|intermediate|advanced)
/sentence       영작 연습 (챕터 선택 → 문장 퀴즈)
/settings       하루 목표 변경 + 로그아웃
```

---

## 5. 카테고리 A: 자/타동사 단어

- 레벨 3단계 (초급/중급/고급), 각 100개, 자유 선택
- 구성: 짝꿍 쌍 20쌍(40개) + 순수 Vi 30개 + 순수 Vt 30개
- 짝꿍 쌍은 1유닛으로 취급 (daily_goal 카운트, 남은 개수 표시 모두)
- 예습(카드 보기) → 테스트(2지선다) 2단계 플로우
- 정답 3연속 → 졸업(is_mastered), 오답 → 오류 카운트 + 랜덤 위치 재삽입
- 매 답변 후 `progress` 테이블 fire-and-forget sync

---

## 6. 카테고리 B: 영작 연습

- 케쌤영어 커리큘럼 PDF 추출, 181문장, 13챕터
- 한국어 문장 + 힌트 단어 표시 → 영어 직접 입력 → 자동 채점
- 채점: 소문자 변환 + 구두점 제거 후 정답과 비교
- 오답 시 정답 바로 표시 (재시도 없음)
- `sentence_progress`에 attempt_count / correct_count 기록

---

## 7. 파일 구조

```
app/
├── page.tsx                  로그인
├── onboarding/page.tsx
├── dashboard/page.tsx
├── study/
│   ├── page.tsx              세션 컨트롤러
│   ├── PreviewPhase.tsx
│   └── BattlePhase.tsx
├── sentence/
│   ├── page.tsx              챕터 선택
│   └── SentencePhase.tsx
└── settings/page.tsx

lib/
├── supabase/                 클라이언트/서버 인스턴스
├── auth.ts
├── wordSelector.ts           단어 선택 알고리즘
└── quizEngine.ts             큐 관리 및 채점

supabase/
├── migrations/001~003
├── seed.sql                  초급 100개
├── seed_intermediate.sql     중급 100개
├── seed_advanced.sql         고급 100개
└── seed_sentences.sql        영작 181개
```
