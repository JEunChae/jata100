'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const GOAL_OPTIONS = [10, 20, 30, 50]

export default function OnboardingPage() {
  const router = useRouter()
  const [goal, setGoal] = useState(20)
  const [loading, setLoading] = useState(false)

  async function handleStart() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    await supabase.from('user_settings').upsert({
      id: user.id,
      daily_goal: goal,
    })

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h2 className="text-2xl font-bold text-center mb-2">하루 목표 설정</h2>
        <p className="text-gray-500 text-center mb-8 text-sm">
          매일 몇 개씩 공부할까요?
        </p>

        <div className="grid grid-cols-2 gap-3 mb-8">
          {GOAL_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setGoal(n)}
              className={`py-4 rounded-xl text-lg font-bold border-2 transition-colors ${
                goal === n
                  ? 'border-blue-600 bg-blue-50 text-blue-600'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {n}개
            </button>
          ))}
        </div>

        <button
          onClick={handleStart}
          disabled={loading}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? '저장 중...' : '시작하기'}
        </button>
      </div>
    </div>
  )
}
