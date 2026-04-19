'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { UserSettings, WordLevel } from '@/types'

const LEVEL_LABEL: Record<WordLevel, string> = {
  beginner: '초급',
  intermediate: '중급',
  advanced: '고급',
}

const LEVELS: WordLevel[] = ['beginner', 'intermediate', 'advanced']

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]
}

interface DashboardData {
  dailyGoal: number
  levelProgress: Record<WordLevel, number>
}

export default function DashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const [{ data: settings }, { data: words }, { data: progressRows }] = await Promise.all([
        supabase.from('user_settings').select('daily_goal').eq('id', user.id).single(),
        supabase.from('words').select('id, level'),
        supabase.from('progress').select('word_id').eq('user_id', user.id).eq('is_mastered', true),
      ])

      const s = settings as Pick<UserSettings, 'daily_goal'> | null
      const masteredIds = new Set((progressRows ?? []).map((p: { word_id: number }) => p.word_id))

      const levelProgress = {} as Record<WordLevel, number>
      for (const level of LEVELS) {
        const ids = (words ?? [])
          .filter((w: { id: number; level: string }) => w.level === level)
          .map((w: { id: number }) => w.id)
        levelProgress[level] = ids.filter(id => masteredIds.has(id)).length
      }

      setData({ dailyGoal: s?.daily_goal ?? 20, levelProgress })
    }
    load()
  }, [router])

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#4255ff] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen max-w-sm mx-auto flex flex-col md:pt-10">
      {/* Header */}
      <header className="flex justify-between items-center px-5 py-4 bg-white border-b border-[#d9dde8]">
        <span className="text-lg font-black text-[#2e3856]">자타 100</span>
        <Link href="/settings" className="text-[#939bb4] hover:text-[#2e3856] transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Link>
      </header>

      <main className="flex-1 p-5 space-y-5">
        <section className="space-y-3">
          <p className="text-xs font-semibold text-[#939bb4] uppercase tracking-wider px-1">자/타동사 단어</p>
          {LEVELS.map((level) => {
            const mastered = data.levelProgress[level]
            const pct = Math.round((mastered / 100) * 100)
            return (
              <button
                key={level}
                onClick={() => router.push(`/study?level=${level}`)}
                className="w-full bg-white rounded-2xl border border-[#d9dde8] p-5 text-left hover:border-[#4255ff]/50 hover:shadow-sm transition-all active:opacity-80"
              >
                <div className="flex justify-between items-center mb-3">
                  <span className="font-black text-[#2e3856] text-lg">{LEVEL_LABEL[level]}</span>
                  <span className="text-sm font-bold text-[#4255ff]">{mastered} / 100</span>
                </div>
                <div className="h-2 bg-[#eef0f8] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: '#4255ff' }}
                  />
                </div>
                <p className="text-xs text-[#939bb4] mt-2">{pct}% 완료</p>
              </button>
            )
          })}
        </section>

        <section className="space-y-3">
          <p className="text-xs font-semibold text-[#939bb4] uppercase tracking-wider px-1">영작 연습</p>
          <button
            onClick={() => router.push('/sentence')}
            className="w-full bg-white rounded-2xl border border-[#d9dde8] p-5 text-left hover:border-[#ff9500]/50 hover:shadow-sm transition-all active:opacity-80"
          >
            <div className="flex justify-between items-center">
              <div>
                <span className="font-black text-[#2e3856] text-lg">문장 만들기</span>
                <p className="text-xs text-[#939bb4] mt-1">케쌤 커리큘럼 · 181문장</p>
              </div>
              <span
                className="text-xs font-black uppercase tracking-widest px-2 py-1 rounded-lg text-white"
                style={{ backgroundColor: '#ff9500' }}
              >
                영작
              </span>
            </div>
          </button>
        </section>
      </main>
    </div>
  )
}
