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
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-2 border-[#4255ff] border-t-transparent rounded-full animate-spin" />
        <p className="text-[#939bb4] text-sm">단어 불러오는 중...</p>
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
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Trophy */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-black text-[#2e3856]">오늘 학습 완료!</h2>
          <p className="text-[#939bb4] mt-1 text-sm">수고했어요</p>
        </div>

        {/* Stats */}
        <div className="bg-white rounded-2xl border border-[#d9dde8] overflow-hidden mb-6">
          <div className="flex divide-x divide-[#d9dde8]">
            <div className="flex-1 p-5 text-center">
              <p className="text-3xl font-black text-[#4255ff]">{stats?.newlyMastered}</p>
              <p className="text-xs text-[#939bb4] mt-1">오늘 암기</p>
            </div>
            <div className="flex-1 p-5 text-center">
              <p className="text-3xl font-black text-[#2e3856]">{stats?.attempts}</p>
              <p className="text-xs text-[#939bb4] mt-1">총 시도</p>
            </div>
            <div className="flex-1 p-5 text-center">
              <p className="text-3xl font-black text-[#2e3856]">{stats?.totalMastered}</p>
              <p className="text-xs text-[#939bb4] mt-1">누적 완료</p>
            </div>
          </div>
        </div>

        {stats?.totalMastered === 100 && (
          <div
            className="mb-6 p-4 rounded-2xl text-center border"
            style={{ backgroundColor: '#fffbeb', borderColor: '#fcd34d' }}
          >
            <p className="font-black text-yellow-700">🏆 100개 전부 정복!</p>
          </div>
        )}

        <button
          onClick={() => router.push('/dashboard')}
          className="w-full py-4 rounded-2xl font-bold text-white text-base transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#4255ff' }}
        >
          홈으로
        </button>
      </div>
    </div>
  )
}
