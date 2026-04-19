import type { Word, Progress, QueueItem } from '@/types'
import { createClient } from './supabase/client'

export function initQueue(
  words: Word[],
  progressMap: Map<number, Progress>
): QueueItem[] {
  const items = words.map((word) => ({
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
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]]
  }
  return items
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
  newQueue.splice(index, 1)

  if (graduated) {
    return { updatedQueue: newQueue, graduated: true, updatedItem }
  }

  if (isCorrect) {
    // Re-insert at random position (not front) to avoid consecutive repetition
    const insertAt = newQueue.length === 0 ? 0 : 1 + Math.floor(Math.random() * newQueue.length)
    newQueue.splice(insertAt, 0, updatedItem)
  } else {
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
