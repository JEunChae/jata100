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

    if ((a.pair_id !== null) !== (b.pair_id !== null)) {
      return a.pair_id !== null ? -1 : 1
    }

    return Math.random() - 0.5
  })

  // 짝꿍을 1유닛으로 계산해서 정확히 dailyGoal 유닛 선택
  const result: Word[] = []
  const selectedIds = new Set<number>()
  let units = 0

  for (const word of sorted) {
    if (units >= dailyGoal) break
    if (selectedIds.has(word.id)) continue

    selectedIds.add(word.id)
    result.push(word)

    if (word.pair_id !== null) {
      const partner = unmastered.find(
        (u) => u.pair_id === word.pair_id && u.id !== word.id && !selectedIds.has(u.id)
      )
      if (partner) {
        selectedIds.add(partner.id)
        result.push(partner)
      }
    }

    units++
  }

  return result
}
