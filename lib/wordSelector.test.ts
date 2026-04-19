import { describe, it, expect } from 'vitest'
import { selectTodayWords, isLevelComplete } from './wordSelector'
import type { Word, Progress } from '@/types'

function makeWord(id: number, type: 'Vi' | 'Vt', pair_id: number | null = null): Word {
  return { id, english: `word${id}`, korean_vi: type === 'Vi' ? '뜻' : null, korean_vt: type === 'Vt' ? '~을 뜻' : null, type, pair_id, level: 'beginner' }
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
    ]
    const map = new Map(words.map(w => [w.id, makeProgress(w.id)]))
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

describe('isLevelComplete', () => {
  it('returns true when all words are mastered', () => {
    const words = [makeWord(1, 'Vi'), makeWord(2, 'Vt')]
    const map = new Map([
      [1, makeProgress(1, { is_mastered: true })],
      [2, makeProgress(2, { is_mastered: true })],
    ])
    expect(isLevelComplete(words, map)).toBe(true)
  })

  it('returns false when some words are unmastered', () => {
    const words = [makeWord(1, 'Vi'), makeWord(2, 'Vt')]
    const map = new Map([
      [1, makeProgress(1, { is_mastered: true })],
      [2, makeProgress(2, { is_mastered: false })],
    ])
    expect(isLevelComplete(words, map)).toBe(false)
  })

  it('returns false for empty word list', () => {
    expect(isLevelComplete([], new Map())).toBe(false)
  })
})
