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
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-black text-[#2e3856]">하루 목표 설정</h2>
          <p className="text-[#939bb4] mt-1 text-sm">매일 몇 개씩 공부할까요?</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {GOAL_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setGoal(n)}
              className={`py-5 rounded-2xl text-xl font-black border-2 transition-all ${
                goal === n
                  ? 'border-[#4255ff] bg-[#4255ff] text-white shadow-lg'
                  : 'border-[#d9dde8] bg-white text-[#2e3856] hover:border-[#4255ff]/40'
              }`}
              style={goal === n ? { boxShadow: '0 4px 16px rgba(66,85,255,0.3)' } : {}}
            >
              {n}개
            </button>
          ))}
        </div>

        <button
          onClick={handleStart}
          disabled={loading}
          className="w-full py-4 rounded-xl font-bold text-white text-base disabled:opacity-60 transition-opacity"
          style={{ backgroundColor: '#4255ff' }}
        >
          {loading ? '저장 중...' : '시작하기 →'}
        </button>
      </div>
    </div>
  )
}
