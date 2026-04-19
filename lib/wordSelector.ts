import type { Word, Progress } from '@/types'

export function isLevelComplete(
  levelWords: Word[],
  progressMap: Map<number, Progress>,
): boolean {
  return levelWords.length > 0 && levelWords.every(w => progressMap.get(w.id)?.is_mastered === true)
}

export function selectTodayWords(
  allWords: Word[],
  progressMap: Map<number, Progress>,
  dailyGoal: number
): Word[] {
  const unmastered = allWords.filter(
    (w) => !progressMap.get(w.id)?.is_mastered
  )

  const sorted = [...unmastered].sort((a, b) => {
    const ea = progressMap.get(a.id)?.error_count ?? 0
    const eb = progressMap.get(b.id)?.error_count ?? 0
    if (eb !== ea) return eb - ea

    const da = progressMap.get(a.id)?.last_seen_date ?? ''
    const db = progressMap.get(b.id)?.last_seen_date ?? ''
    if (da !== db) return da < db ? -1 : 1

    // Prefer words with pair_id when all else is equal
    if ((a.pair_id !== null) !== (b.pair_id !== null)) {
      return a.pair_id !== null ? -1 : 1
    }

    return Math.random() - 0.5
  })

  const base = sorted.slice(0, dailyGoal)
  const selectedIds = new Set(base.map((w) => w.id))

  const extras: Word[] = []
  for (const w of base) {
    if (w.pair_id === null) continue
    const partner = unmastered.find(
      (u) => u.pair_id === w.pair_id && u.id !== w.id && !selectedIds.has(u.id)
    )
    if (partner) {
      extras.push(partner)
      selectedIds.add(partner.id)
    }
  }

  return [...base, ...extras]
}
