'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SentencePhase from './SentencePhase'
import type { SentenceExercise } from '@/types'

type View = 'loading' | 'chapters' | 'quiz' | 'complete'

interface ChapterInfo {
  name: string
  total: number
  correct: number
}

interface CompleteStats {
  correct: number
  total: number
}

export default function SentencePage() {
  const router = useRouter()
  const [view, setView] = useState<View>('loading')
  const [chapters, setChapters] = useState<ChapterInfo[]>([])
  const [exercises, setExercises] = useState<SentenceExercise[]>([])
  const [userId, setUserId] = useState('')
  const [stats, setStats] = useState<CompleteStats | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setUserId(user.id)

      const [{ data: exWithIds }, { data: progRows }] = await Promise.all([
        supabase.from('sentence_exercises').select('id, chapter').order('id'),
        supabase.from('sentence_progress')
          .select('exercise_id, correct_count')
          .eq('user_id', user.id),
      ])

      const progMap = new Map<number, number>(
        (progRows ?? []).map((p: { exercise_id: number; correct_count: number }) => [p.exercise_id, p.correct_count])
      )

      const chapterMap = new Map<string, { total: number; correct: number }>()
      for (const ex of exWithIds ?? []) {
        const ch = ex.chapter as string
        const c = chapterMap.get(ch) ?? { total: 0, correct: 0 }
        c.total++
        if ((progMap.get(ex.id) ?? 0) > 0) c.correct++
        chapterMap.set(ch, c)
      }

      const chapterList: ChapterInfo[] = Array.from(chapterMap.entries()).map(([name, v]) => ({
        name,
        total: v.total,
        correct: v.correct,
      }))

      setChapters(chapterList)
      setView('chapters')
    }
    load()
  }, [router])

  async function startChapter(chapterName: string) {
    const supabase = createClient()
    const { data } = await supabase
      .from('sentence_exercises')
      .select('*')
      .eq('chapter', chapterName)
      .order('order_index')

    setExercises((data as SentenceExercise[]) ?? [])
    setView('quiz')
  }

  function handleComplete(s: CompleteStats) {
    setStats(s)
    setView('complete')
  }

  if (view === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#4255ff] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (view === 'quiz') {
    return (
      <SentencePhase
        exercises={exercises}
        userId={userId}
        onComplete={handleComplete}
      />
    )
  }

  if (view === 'complete' && stats) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-black text-[#2e3856]">챕터 완료!</h2>
            <p className="text-[#939bb4] mt-1 text-sm">수고했어요</p>
          </div>
          <div className="bg-white rounded-2xl border border-[#d9dde8] overflow-hidden mb-6">
            <div className="flex divide-x divide-[#d9dde8]">
              <div className="flex-1 p-5 text-center">
                <p className="text-3xl font-black text-[#23b26d]">{stats.correct}</p>
                <p className="text-xs text-[#939bb4] mt-1">정답</p>
              </div>
              <div className="flex-1 p-5 text-center">
                <p className="text-3xl font-black text-[#2e3856]">{stats.total - stats.correct}</p>
                <p className="text-xs text-[#939bb4] mt-1">오답</p>
              </div>
              <div className="flex-1 p-5 text-center">
                <p className="text-3xl font-black text-[#4255ff]">{stats.total}</p>
                <p className="text-xs text-[#939bb4] mt-1">총 문제</p>
              </div>
            </div>
          </div>
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

  // chapters view
  return (
    <div className="min-h-screen max-w-sm mx-auto flex flex-col">
      <header className="flex items-center gap-3 px-5 py-4 bg-white border-b border-[#d9dde8]">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-[#939bb4] hover:text-[#2e3856] transition-colors p-1 -ml-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-lg font-black text-[#2e3856]">영작 연습</span>
      </header>

      <main className="flex-1 p-4 space-y-2">
        <p className="text-xs font-semibold text-[#939bb4] uppercase tracking-wider px-1 pb-1">챕터 선택</p>
        {chapters.map((ch) => {
          const pct = Math.round((ch.correct / ch.total) * 100)
          return (
            <button
              key={ch.name}
              onClick={() => startChapter(ch.name)}
              className="w-full bg-white rounded-2xl border border-[#d9dde8] p-4 text-left hover:border-[#4255ff]/50 hover:shadow-sm transition-all active:opacity-80"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-[#2e3856]">{ch.name}</span>
                <span className="text-sm font-bold text-[#4255ff]">{ch.correct} / {ch.total}</span>
              </div>
              <div className="h-1.5 bg-[#eef0f8] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: '#4255ff' }}
                />
              </div>
            </button>
          )
        })}
      </main>
    </div>
  )
}
