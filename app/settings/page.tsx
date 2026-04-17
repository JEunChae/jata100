'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { logout } from '@/lib/auth'

const GOAL_OPTIONS = [10, 20, 30, 50]

export default function SettingsPage() {
  const router = useRouter()
  const [goal, setGoal] = useState(20)
  const [saved, setSaved] = useState(false)
  const [userId, setUserId] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setUserId(user.id)

      const { data } = await supabase
        .from('user_settings')
        .select('daily_goal')
        .eq('id', user.id)
        .single()

      if (data) setGoal(data.daily_goal)
    }
    load()
  }, [router])

  async function handleSave() {
    const supabase = createClient()
    await supabase
      .from('user_settings')
      .update({ daily_goal: goal })
      .eq('id', userId)

    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleLogout() {
    await logout()
    router.push('/')
  }

  return (
    <div className="min-h-screen max-w-sm mx-auto flex flex-col md:pt-10">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 py-4 bg-white border-b border-[#d9dde8]">
        <button
          onClick={() => router.back()}
          className="text-[#939bb4] hover:text-[#2e3856] transition-colors p-1 -ml-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-black text-[#2e3856]">설정</h2>
      </header>

      <main className="flex-1 p-5 space-y-4">
        {/* Goal selector */}
        <div className="bg-white rounded-2xl border border-[#d9dde8] p-5">
          <p className="text-xs font-semibold text-[#939bb4] uppercase tracking-wider mb-4">하루 목표 단어 수</p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {GOAL_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => setGoal(n)}
                className={`py-4 rounded-xl font-black text-lg border-2 transition-all ${
                  goal === n
                    ? 'border-[#4255ff] bg-[#4255ff] text-white'
                    : 'border-[#d9dde8] bg-white text-[#2e3856] hover:border-[#4255ff]/40'
                }`}
              >
                {n}개
              </button>
            ))}
          </div>

          <button
            onClick={handleSave}
            className="w-full py-3 rounded-xl font-bold text-white text-sm transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#4255ff' }}
          >
            {saved ? '저장됨 ✓' : '저장'}
          </button>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full py-4 rounded-2xl font-bold text-sm border-2 border-red-200 text-red-500 bg-white hover:bg-red-50 transition-colors"
        >
          로그아웃
        </button>
      </main>
    </div>
  )
}
