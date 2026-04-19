// types/index.ts

export type WordType = 'Vi' | 'Vt'
export type WordLevel = 'beginner' | 'intermediate' | 'advanced'

export interface Word {
  id: number
  english: string
  korean_vi: string | null
  korean_vt: string | null
  type: WordType
  pair_id: number | null
  level: WordLevel
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
  current_level: WordLevel
  created_at: string
}

export interface QueueItem {
  word: Word
  progress: Progress
}

export interface SentenceExercise {
  id: number
  chapter: string
  order_index: number
  korean: string
  hints: string[]
  english: string
}

export interface SentenceProgress {
  user_id: string
  exercise_id: number
  attempt_count: number
  correct_count: number
  last_attempted_date: string | null
  updated_at: string
}
