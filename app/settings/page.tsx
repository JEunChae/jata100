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
    <div className="min-h-screen p-4 max-w-sm mx-auto">
      <div className="flex items-center gap-3 mb-8 pt-4">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
          ← 뒤로
        </button>
        <h2 className="text-xl font-bold">설정</h2>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
        <p className="font-semibold mb-4">하루 목표 단어 수</p>
        <div className="grid grid-cols-2 gap-3">
          {GOAL_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setGoal(n)}
              className={`py-3 rounded-xl font-bold border-2 transition-colors ${
                goal === n
                  ? 'border-blue-600 bg-blue-50 text-blue-600'
                  : 'border-gray-200 text-gray-600'
              }`}
            >
              {n}개
            </button>
          ))}
        </div>

        <button
          onClick={handleSave}
          className="w-full mt-4 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
        >
          {saved ? '저장됨 ✓' : '저장'}
        </button>
      </div>

      <button
        onClick={handleLogout}
        className="w-full py-3 border-2 border-red-200 text-red-500 rounded-xl font-semibold hover:bg-red-50 transition-colors"
      >
        로그아웃
      </button>
    </div>
  )
}
