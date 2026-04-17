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

  return (
    <div className="min-h-screen flex flex-col p-4 max-w-lg mx-auto">
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-500 mb-1">
          <span>전투</span>
          <span>남은 단어 {queue.length}개</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full">
          <div
            className="h-2 bg-orange-500 rounded-full transition-all"
            style={{
              width: `${Math.max(5, (1 - queue.length / initialQueue.length) * 100)}%`,
            }}
          />
        </div>
      </div>

      {/* Word */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <p className="text-4xl font-bold mb-2">{current.word.english}</p>
        <p className="text-sm text-gray-400 mb-12">
          {current.word.type === 'Vi' ? '자동사' : '타동사'}
        </p>

        {/* Answer buttons */}
        <div className="w-full space-y-3">
          {choices.opts.map((opt) => {
            const isCorrect = opt === choices.correct
            let btnClass =
              'w-full py-4 px-6 rounded-xl font-semibold text-left border-2 transition-colors '

            if (answerState === 'idle') {
              btnClass += 'border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50'
            } else if (opt === selectedAnswer) {
              btnClass += answerState === 'correct'
                ? 'border-green-500 bg-green-50 text-green-700'
                : 'border-red-500 bg-red-50 text-red-700'
            } else if (answerState === 'wrong' && isCorrect) {
              btnClass += 'border-green-500 bg-green-50 text-green-700'
            } else {
              btnClass += 'border-gray-200 bg-white opacity-50'
            }

            return (
              <button
                key={opt}
                onClick={() => handleAnswer(opt)}
                disabled={answerState !== 'idle'}
                className={btnClass}
              >
                {opt}
              </button>
            )
          })}
        </div>

        {/* Feedback */}
        {answerState !== 'idle' && (
          <p className={`mt-4 font-semibold ${answerState === 'correct' ? 'text-green-600' : 'text-red-500'}`}>
            {answerState === 'correct' ? '정답!' : '오답 — 다시 나올 거예요'}
          </p>
        )}
      </div>

      {/* Stats */}
      <p className="text-center text-sm text-gray-400 mt-4">
        총 {attempts}번 시도 · 오늘 {newlyMastered}개 완료
      </p>
    </div>
  )
}
