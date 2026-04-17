'use client'

import { useState, useMemo } from 'react'
import type { Word, QueueItem } from '@/types'
import { processAnswer, getDistractor, syncProgress } from '@/lib/quizEngine'

interface BattlePhaseProps {
  initialQueue: QueueItem[]
  allWords: Word[]
  userId: string
  todayStr: string
  onComplete: (stats: { attempts: number; newlyMastered: number }) => void
}

type AnswerState = 'idle' | 'correct' | 'wrong'

const LABELS = ['①', '②']

export default function BattlePhase({
  initialQueue,
  allWords,
  userId,
  todayStr,
  onComplete,
}: BattlePhaseProps) {
  const [queue, setQueue] = useState<QueueItem[]>(initialQueue)
  const [attempts, setAttempts] = useState(0)
  const [newlyMastered, setNewlyMastered] = useState(0)
  const [answerState, setAnswerState] = useState<AnswerState>('idle')
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)

  const current = queue[0]
  const progressPct = Math.max(2, (1 - queue.length / initialQueue.length) * 100)

  // Memoized per word.id — prevents choice shuffling during feedback re-renders
  const choices = useMemo(() => {
    if (!current) return null
    const correctMeaning =
      current.word.type === 'Vi' ? current.word.korean_vi! : current.word.korean_vt!
    const distractor = getDistractor(current.word, allWords)
    const opts = [correctMeaning, distractor].sort(() => Math.random() - 0.5)
    return { opts, correct: correctMeaning }
  }, [current?.word.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleAnswer(chosen: string) {
    if (answerState !== 'idle' || !choices) return

    const isCorrect = chosen === choices.correct
    setSelectedAnswer(chosen)
    setAnswerState(isCorrect ? 'correct' : 'wrong')
    setAttempts((a) => a + 1)

    const { updatedQueue, graduated, updatedItem } = processAnswer(queue, 0, isCorrect)

    syncProgress(userId, updatedItem.progress, todayStr)

    if (graduated) setNewlyMastered((n) => n + 1)

    setTimeout(() => {
      setQueue(updatedQueue)
      setAnswerState('idle')
      setSelectedAnswer(null)

      if (updatedQueue.length === 0) {
        onComplete({ attempts: attempts + 1, newlyMastered: newlyMastered + (graduated ? 1 : 0) })
      }
    }, 700)
  }

  if (!current || !choices) return null

  const isVi = current.word.type === 'Vi'

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
        <span className="text-sm font-semibold text-[#939bb4]">전투</span>
        <span className="text-sm font-semibold text-[#2e3856]">남은 {queue.length}개</span>
      </div>

      {/* Question card */}
      <div className="flex-1 flex flex-col items-center justify-center p-5">
        <div className="w-full bg-white rounded-2xl border-2 border-[#d9dde8] p-8 text-center mb-6 shadow-sm">
          <span
            className="inline-block text-xs font-black uppercase tracking-widest px-2 py-0.5 rounded-md mb-4 text-white"
            style={{ backgroundColor: isVi ? '#4255ff' : '#ff9500' }}
          >
            {isVi ? '자동사' : '타동사'}
          </span>
          <p className="text-4xl font-black text-[#2e3856]">{current.word.english}</p>
          <p className="text-[#939bb4] text-sm mt-3">뜻을 고르세요</p>
        </div>

        {/* Answer choices */}
        <div className="w-full space-y-3">
          {choices.opts.map((opt, i) => {
            const isCorrectOpt = opt === choices.correct
            let borderColor = '#d9dde8'
            let bgColor = 'white'
            let textColor = '#2e3856'
            let labelBg = '#eef0f8'
            let labelText = '#939bb4'

            if (answerState !== 'idle') {
              if (opt === selectedAnswer) {
                if (answerState === 'correct') {
                  borderColor = '#23b26d'; bgColor = '#e8fdf2'; textColor = '#1a7a4a'
                  labelBg = '#23b26d'; labelText = 'white'
                } else {
                  borderColor = '#ff4444'; bgColor = '#fff0f0'; textColor = '#cc2222'
                  labelBg = '#ff4444'; labelText = 'white'
                }
              } else if (answerState === 'wrong' && isCorrectOpt) {
                borderColor = '#23b26d'; bgColor = '#e8fdf2'; textColor = '#1a7a4a'
                labelBg = '#23b26d'; labelText = 'white'
              } else {
                bgColor = '#fafafa'; textColor = '#c2c8d8'
                labelBg = '#f0f1f5'; labelText = '#c2c8d8'
              }
            }

            return (
              <button
                key={opt}
                onClick={() => handleAnswer(opt)}
                disabled={answerState !== 'idle'}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 font-semibold text-left transition-all"
                style={{ borderColor, backgroundColor: bgColor, color: textColor }}
              >
                <span
                  className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black transition-all"
                  style={{ backgroundColor: labelBg, color: labelText }}
                >
                  {LABELS[i]}
                </span>
                <span className="flex-1">{opt}</span>
              </button>
            )
          })}
        </div>

        {/* Feedback */}
        {answerState !== 'idle' && (
          <p
            className="mt-4 font-bold text-sm"
            style={{ color: answerState === 'correct' ? '#23b26d' : '#ff4444' }}
          >
            {answerState === 'correct' ? '정답! 🎯' : '오답 — 다시 나올 거예요'}
          </p>
        )}
      </div>

      {/* Bottom stats */}
      <div className="px-5 pb-6 text-center">
        <p className="text-xs text-[#939bb4]">
          {attempts}번 시도 · 오늘 <span className="font-bold text-[#4255ff]">{newlyMastered}개</span> 완료
        </p>
      </div>
    </div>
  )
}
