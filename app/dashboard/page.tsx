'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { UserSettings } from '@/types'

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]
}

interface DashboardData {
  dailyGoal: number
  totalMastered: number
  completedToday: boolean
}

export default function DashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const todayStr = toDateStr(new Date())

      const [{ data: settings }, { count: mastered }] = await Promise.all([
        supabase.from('user_settings').select('*').eq('id', user.id).single(),
        supabase
          .from('progress')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_mastered', true),
      ])

      const s = settings as UserSettings | null
      setData({
        dailyGoal: s?.daily_goal ?? 20,
        totalMastered: mastered ?? 0,
        completedToday: s?.last_completed_date === todayStr,
      })
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

  const progressPct = Math.round((data.totalMastered / 100) * 100)

  return (
    <div className="min-h-screen max-w-sm mx-auto flex flex-col">
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

      <main className="flex-1 p-5 space-y-4">
        {/* Progress card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#d9dde8]">
          <p className="text-xs font-semibold text-[#939bb4] uppercase tracking-wider mb-3">전체 암기 진도</p>
          <div className="flex items-end gap-2 mb-4">
            <span className="text-5xl font-black text-[#2e3856]">{data.totalMastered}</span>
            <span className="text-xl text-[#939bb4] mb-1 font-semibold">/ 100</span>
          </div>
          <div className="h-2.5 bg-[#eef0f8] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%`, backgroundColor: '#4255ff' }}
            />
          </div>
          <p className="text-right text-xs text-[#939bb4] mt-2 font-medium">{progressPct}% 완료</p>
        </div>

        {/* CTA */}
        {data.completedToday ? (
          <div className="bg-[#e8fdf2] border border-[#b2ecd1] rounded-2xl p-6 text-center">
            <p className="text-2xl mb-2">✓</p>
            <p className="font-bold text-[#1a7a4a] text-lg">오늘 학습 완료!</p>
            <p className="text-[#4caf82] text-sm mt-1">내일 또 만나요</p>
          </div>
        ) : (
          <button
            onClick={() => router.push('/study')}
            className="w-full py-5 rounded-2xl font-black text-white text-xl transition-opacity hover:opacity-90 active:opacity-80 shadow-lg"
            style={{ backgroundColor: '#4255ff', boxShadow: '0 4px 20px rgba(66, 85, 255, 0.35)' }}
          >
            학습 시작
            <span className="block text-sm font-normal mt-1 opacity-80">
              오늘 {data.dailyGoal}개
            </span>
          </button>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-[#d9dde8] text-center">
            <p className="text-2xl font-black text-[#4255ff]">{data.totalMastered}</p>
            <p className="text-xs text-[#939bb4] mt-1">암기 완료</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-[#d9dde8] text-center">
            <p className="text-2xl font-black text-[#2e3856]">{100 - data.totalMastered}</p>
            <p className="text-xs text-[#939bb4] mt-1">남은 단어</p>
          </div>
        </div>
      </main>
    </div>
  )
}
