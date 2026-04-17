'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { loginOrCreate } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password.trim()) return

    setLoading(true)
    setError(null)

    const { error } = await loginOrCreate(username.trim(), password)
    if (error) {
      setError('로그인에 실패했습니다. 비밀번호를 확인해주세요.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black text-[#2e3856]">자타 100</h1>
          <p className="text-[#939bb4] mt-1 text-sm">영어 자/타동사 완전 정복</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-semibold text-[#2e3856] mb-1.5">
              아이디
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="아이디 입력"
              className="w-full px-4 py-3 bg-white border border-[#d9dde8] rounded-xl text-[#2e3856] placeholder:text-[#c2c8d8] focus:outline-none focus:border-[#4255ff] focus:ring-2 focus:ring-[#4255ff]/20 transition-all"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#2e3856] mb-1.5">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 입력 (6자 이상)"
              className="w-full px-4 py-3 bg-white border border-[#d9dde8] rounded-xl text-[#2e3856] placeholder:text-[#c2c8d8] focus:outline-none focus:border-[#4255ff] focus:ring-2 focus:ring-[#4255ff]/20 transition-all"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-bold text-white text-base disabled:opacity-60 transition-opacity mt-2"
            style={{ backgroundColor: '#4255ff' }}
          >
            {loading ? '로딩 중...' : '시작하기'}
          </button>
        </form>

        <p className="text-center text-xs text-[#939bb4] mt-6">
          없는 아이디는 자동으로 계정이 만들어집니다
        </p>
      </div>
    </div>
  )
}
