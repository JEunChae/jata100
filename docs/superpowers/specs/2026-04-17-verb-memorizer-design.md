# jata100 Spec

Last updated: 2026-04-24

## Stack
Next.js 16 App Router · Tailwind CSS v4 · Supabase (Auth + PostgreSQL + RLS) · Vercel

## Auth
```
login(id, pw)
  → signInWithPassword({email: id@jata100.app, pw})
  → if 유저없음: signUp() → signIn()

route guard (middleware)
  → 미로그인 → /
  → user_settings 없음 → /onboarding
```

## DB (migrations 001~003)
```
user_settings   id(uuid PK), daily_goal, last_completed_date, current_level
words           id, english, korean_vi, korean_vt, type(Vi|Vt), pair_id, level
progress        user_id+word_id(PK), error_count, consecutive_correct, is_mastered, last_seen_date
sentence_exercises  id, chapter, order_index, korean, hints[], english
sentence_progress   user_id+exercise_id(PK), attempt_count, correct_count, last_attempted_date

RLS: progress/sentence_progress → auth.uid()=user_id
     words/sentence_exercises   → public read
```

## 카테고리 A — 자/타동사 (/study?level=)
```
단어 선택
  unmastered 필터 → Fisher-Yates 셔플 → error_count DESC 정렬
  → daily_goal 유닛 선택 (짝꿍 쌍 = 1유닛, 파트너 자동 포함)

테스트 큐
  정답 → consecutive_correct+1 / ≥3 → is_mastered=true, 졸업
  오답 → consecutive_correct=0, error_count+1, 큐 랜덤 위치 재삽입
  매 답변 → progress upsert (fire-and-forget)
```

## 카테고리 B — 영작 연습 (/sentence)
```
챕터 선택 → 문장 순서대로
  한국어 문장 + 힌트 단어 표시
  → 사용자 영어 입력
  → normalize(입력) === normalize(정답)   // 소문자·구두점 제거
  → 오답 시 정답 즉시 표시 (재시도 없음)
  → sentence_progress upsert

데이터: 케쌤 커리큘럼 181문장, 13챕터 (홀수달#1~8, 짝수달#3~9)
```
