'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { SentenceExercise } from '@/types'

interface SentencePhaseProps {
  exercises: SentenceExercise[]
  userId: string
  onComplete: (stats: { correct: number; total: number }) => void
}

type AnswerState = 'idle' | 'correct' | 'wrong'

function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,!?;:'"()\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function syncSentenceProgress(
  userId: string,
  exerciseId: number,
  isCorrect: boolean,
  todayStr: string,
) {
  const supabase = createClient()
  const { data: existing } = await supabase
    .from('sentence_progress')
    .select('attempt_count, correct_count')
    .eq('user_id', userId)
    .eq('exercise_id', exerciseId)
    .single()

  const prev = existing ?? { attempt_count: 0, correct_count: 0 }
  await supabase.from('sentence_progress').upsert({
    user_id: userId,
    exercise_id: exerciseId,
    attempt_count: prev.attempt_count + 1,
    correct_count: prev.correct_count + (isCorrect ? 1 : 0),
    last_attempted_date: todayStr,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,exercise_id' })
}

export default function SentencePhase({ exercises, userId, onComplete }: SentencePhaseProps) {
  const router = useRouter()
  const [index, setIndex] = useState(0)
  const [input, setInput] = useState('')
  const [answerState, setAnswerState] = useState<AnswerState>('idle')
  const [correctCount, setCorrectCount] = useState(0)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const todayStr = new Date().toISOString().split('T')[0]

  const current = exercises[index]
  const progressPct = Math.max(2, (index / exercises.length) * 100)

  useEffect(() => {
    if (answerState === 'idle') inputRef.current?.focus()
  }, [answerState, index])

  function handleSubmit() {
    if (answerState !== 'idle' || !input.trim()) return

    const isCorrect = normalizeAnswer(input) === normalizeAnswer(current.english)
    setAnswerState(isCorrect ? 'correct' : 'wrong')
    if (isCorrect) setCorrectCount(c => c + 1)

    syncSentenceProgress(userId, current.id, isCorrect, todayStr)
  }

  function handleNext() {
    if (index + 1 >= exercises.length) {
      onComplete({ correct: correctCount, total: exercises.length })
      return
    }
    setIndex(i => i + 1)
    setInput('')
    setAnswerState('idle')
  }

  if (!current) return null

  // Parse hints: each hint string contains entries separated by " / "
  const hintItems = current.hints.flatMap(h => h.split(' / ').map(s => s.trim())).filter(Boolean)

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto md:pt-10">
      {/* Progress bar */}
      <div className="h-1.5 bg-[#eef0f8]">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${progressPct}%`, backgroundColor: '#4255ff' }}
        />
      </div>

      {/* Header */}
      <div className="flex justify-between items-center px-5 py-3 bg-white border-b border-[#d9dde8]">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-[#939bb4] hover:text-[#2e3856] transition-colors p-1 -ml-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-[#939bb4]">영작</span>
        <span className="text-sm font-semibold text-[#2e3856]">{index + 1} / {exercises.length}</span>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col p-5 gap-4">
        {/* Korean sentence */}
        <div className="bg-white rounded-2xl border-2 border-[#d9dde8] p-6 shadow-sm">
          <p className="text-xs font-semibold text-[#939bb4] uppercase tracking-wider mb-3">한국어 문장</p>
          <p className="text-lg font-bold text-[#2e3856] leading-relaxed">{current.korean}</p>
        </div>

        {/* Hints */}
        {hintItems.length > 0 && (
          <div className="bg-[#f8f9ff] rounded-2xl border border-[#e0e3f0] p-4">
            <p className="text-xs font-semibold text-[#939bb4] uppercase tracking-wider mb-2">힌트</p>
            <div className="flex flex-wrap gap-1.5">
              {hintItems.map((hint, i) => (
                <span
                  key={i}
                  className="inline-block bg-white border border-[#d9dde8] rounded-lg px-2 py-1 text-xs text-[#586380]"
                >
                  {hint}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="flex flex-col gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (answerState === 'idle') handleSubmit()
                else handleNext()
              }
            }}
            disabled={answerState !== 'idle'}
            placeholder="영어로 작성하세요..."
            rows={3}
            className="w-full rounded-2xl border-2 p-4 text-[#2e3856] text-base resize-none outline-none transition-all"
            style={{
              borderColor: answerState === 'correct' ? '#23b26d' : answerState === 'wrong' ? '#ff4444' : '#d9dde8',
              backgroundColor: answerState === 'correct' ? '#e8fdf2' : answerState === 'wrong' ? '#fff0f0' : 'white',
            }}
          />

          {/* Feedback */}
          {answerState !== 'idle' && (
            <div
              className="rounded-2xl border-2 p-4"
              style={{
                borderColor: answerState === 'correct' ? '#23b26d' : '#ff4444',
                backgroundColor: answerState === 'correct' ? '#e8fdf2' : '#fff0f0',
              }}
            >
              <p
                className="font-bold text-sm mb-1"
                style={{ color: answerState === 'correct' ? '#1a7a4a' : '#cc2222' }}
              >
                {answerState === 'correct' ? '정답! 🎯' : '오답'}
              </p>
              <p className="text-sm text-[#586380]">
                <span className="font-semibold">정답: </span>{current.english}
              </p>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="mt-auto">
          {answerState === 'idle' ? (
            <button
              onClick={handleSubmit}
              disabled={!input.trim()}
              className="w-full py-4 rounded-2xl font-bold text-white text-base transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: '#4255ff' }}
            >
              제출
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="w-full py-4 rounded-2xl font-bold text-white text-base transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#4255ff' }}
            >
              {index + 1 >= exercises.length ? '완료' : '다음 →'}
            </button>
          )}
        </div>
      </div>

      {/* Bottom stats */}
      <div className="px-5 pb-6 text-center">
        <p className="text-xs text-[#939bb4]">
          정답 <span className="font-bold text-[#23b26d]">{correctCount}</span> / {index + (answerState !== 'idle' ? 1 : 0)}
        </p>
      </div>
    </div>
  )
}
