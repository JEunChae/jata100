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
