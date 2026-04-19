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
    level: 'beginner',
  }
}

function makeQueue(...items: Array<[Word, Progress]>): import('@/types').QueueItem[] {
  return items.map(([word, progress]) => ({ word, progress }))
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
    expect(queue.map(q => q.word.id).sort()).toEqual([1, 2])
  })

  it('uses default progress when no entry exists', () => {
    const words = [makeWord(1, 'Vi')]
    const queue = initQueue(words, new Map())
    expect(queue[0].progress.error_count).toBe(0)
  })
})

describe('processAnswer - correct', () => {
  it('increments consecutive_correct', () => {
    const queue = makeQueue([makeWord(1, 'Vi'), makeProgress(1, 0)])
    const { updatedQueue, graduated } = processAnswer(queue, 0, true)
    expect(updatedQueue[0].progress.consecutive_correct).toBe(1)
    expect(graduated).toBe(false)
  })

  it('graduates at consecutive_correct = 3', () => {
    const queue = makeQueue(
      [makeWord(1, 'Vi'), makeProgress(1, 2)],
      [makeWord(2, 'Vi'), makeProgress(2, 0)],
    )
    const { updatedQueue, graduated } = processAnswer(queue, 0, true)
    expect(graduated).toBe(true)
    expect(updatedQueue).toHaveLength(1)
    expect(updatedQueue[0].word.id).toBe(2)
  })

  it('re-inserts correct (non-graduated) word away from front', () => {
    const queue = makeQueue(
      [makeWord(1, 'Vi'), makeProgress(1, 0)],
      [makeWord(2, 'Vi'), makeProgress(2, 0)],
      [makeWord(3, 'Vi'), makeProgress(3, 0)],
    )
    // Run many times to verify word 1 never stays at position 0
    for (let i = 0; i < 20; i++) {
      const { updatedQueue } = processAnswer([...queue], 0, true)
      expect(updatedQueue).toHaveLength(3)
      expect(updatedQueue[0].word.id).not.toBe(1)
    }
  })
})

describe('processAnswer - wrong', () => {
  it('resets consecutive_correct, increments error_count, moves to end', () => {
    const queue = makeQueue(
      [makeWord(1, 'Vi'), makeProgress(1, 2, 0)],
      [makeWord(2, 'Vi'), makeProgress(2, 0, 0)],
    )
    const { updatedQueue, graduated } = processAnswer(queue, 0, false)
    expect(graduated).toBe(false)
    expect(updatedQueue[0].word.id).toBe(2)
    expect(updatedQueue[1].word.id).toBe(1)
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
