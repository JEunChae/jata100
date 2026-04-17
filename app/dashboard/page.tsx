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
        <p className="text-gray-400">불러오는 중...</p>
      </div>
    )
  }

  const progressPct = Math.round((data.totalMastered / 100) * 100)

  return (
    <div className="min-h-screen p-4 max-w-sm mx-auto">
      <div className="flex justify-between items-center mb-8 pt-4">
        <h1 className="text-2xl font-bold">자타 100</h1>
        <Link href="/settings" className="text-sm text-gray-400 hover:text-gray-600">
          설정
        </Link>
      </div>

      {/* Overall progress */}
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
        <p className="text-sm text-gray-500 mb-1">전체 진도</p>
        <p className="text-3xl font-bold mb-3">
          {data.totalMastered}
          <span className="text-lg text-gray-400 font-normal"> / 100</span>
        </p>
        <div className="h-3 bg-gray-100 rounded-full">
          <div
            className="h-3 bg-blue-500 rounded-full transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-right text-xs text-gray-400 mt-1">{progressPct}%</p>
      </div>

      {/* Start button */}
      {data.completedToday ? (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
          <p className="text-green-700 font-semibold text-lg">오늘 학습 완료! ✓</p>
          <p className="text-green-500 text-sm mt-1">내일 다시 만나요</p>
        </div>
      ) : (
        <button
          onClick={() => router.push('/study')}
          className="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold text-xl hover:bg-blue-700 transition-colors"
        >
          오늘 학습 시작
          <span className="block text-sm font-normal mt-1 opacity-80">
            하루 {data.dailyGoal}개
          </span>
        </button>
      )}
    </div>
  )
}
