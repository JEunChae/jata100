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
