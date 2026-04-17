'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { selectTodayWords } from '@/lib/wordSelector'
import { initQueue } from '@/lib/quizEngine'
import PreviewPhase from './PreviewPhase'
import BattlePhase from './BattlePhase'
import type { Word, Progress, QueueItem, UserSettings } from '@/types'

type Phase = 'loading' | 'preview' | 'battle' | 'complete'

interface CompletionStats {
  attempts: number
  newlyMastered: number
  totalMastered: number
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

export default function StudyPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('loading')
  const [todayWords, setTodayWords] = useState<Word[]>([])
  const [allWords, setAllWords] = useState<Word[]>([])
  const [initialQueue, setInitialQueue] = useState<QueueItem[]>([])
  const [userId, setUserId] = useState('')
  const [stats, setStats] = useState<CompletionStats | null>(null)

  const todayStr = toDateStr(new Date())

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      setUserId(user.id)

      const [{ data: settings }, { data: words }, { data: progressRows }] =
        await Promise.all([
          supabase.from('user_settings').select('*').eq('id', user.id).single(),
          supabase.from('words').select('*'),
          supabase.from('progress').select('*').eq('user_id', user.id),
        ])

      if (!words) return

      const progressMap = new Map<number, Progress>(
        (progressRows ?? []).map((p) => [p.word_id, p])
      )

      const daily = (settings as UserSettings)?.daily_goal ?? 20
      const selected = selectTodayWords(words as Word[], progressMap, daily)

      setAllWords(words as Word[])
      setTodayWords(selected)
      setInitialQueue(initQueue(selected, progressMap))
      setPhase('preview')
    }

    load()
  }, [router])

  async function handleBattleComplete({
    attempts,
    newlyMastered,
  }: {
    attempts: number
    newlyMastered: number
  }) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('user_settings')
      .update({ last_completed_date: todayStr })
      .eq('id', user.id)

    const { count } = await supabase
      .from('progress')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_mastered', true)

    setStats({ attempts, newlyMastered, totalMastered: count ?? 0 })
    setPhase('complete')
  }

  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">단어 불러오는 중...</p>
      </div>
    )
  }

  if (phase === 'preview') {
    return (
      <PreviewPhase
        words={todayWords}
        onComplete={() => setPhase('battle')}
      />
    )
  }

  if (phase === 'battle') {
    return (
      <BattlePhase
        initialQueue={initialQueue}
        allWords={allWords}
        userId={userId}
        todayStr={todayStr}
        onComplete={handleBattleComplete}
      />
    )
  }

  // complete
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <p className="text-5xl mb-4">🎉</p>
        <h2 className="text-2xl font-bold mb-2">오늘 학습 완료!</h2>
        <div className="bg-white rounded-2xl p-6 shadow-sm mt-6 space-y-3 text-left">
          <div className="flex justify-between">
            <span className="text-gray-500">총 시도</span>
            <span className="font-bold">{stats?.attempts}번</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">오늘 새로 암기</span>
            <span className="font-bold text-green-600">+{stats?.newlyMastered}개</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">누적 암기 완료</span>
            <span className="font-bold">{stats?.totalMastered} / 100</span>
          </div>
        </div>

        {stats?.totalMastered === 100 && (
          <div className="mt-6 p-4 bg-yellow-50 rounded-2xl border border-yellow-200">
            <p className="font-bold text-yellow-700">🏆 100개 전부 정복!</p>
          </div>
        )}

        <button
          onClick={() => router.push('/dashboard')}
          className="mt-8 w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
        >
          홈으로
        </button>
      </div>
    </div>
  )
}
