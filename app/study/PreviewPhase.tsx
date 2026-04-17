'use client'

import { useState } from 'react'
import type { Word } from '@/types'

interface PreviewPhaseProps {
  words: Word[]
  onComplete: () => void
}

interface PreviewSlide {
  isPair: boolean
  words: Word[]
}

function buildSlides(words: Word[]): PreviewSlide[] {
  const seen = new Set<number>()
  const slides: PreviewSlide[] = []

  for (const word of words) {
    if (seen.has(word.id)) continue
    seen.add(word.id)

    if (word.pair_id !== null) {
      const partner = words.find(
        (w) => w.pair_id === word.pair_id && w.id !== word.id
      )
      if (partner && !seen.has(partner.id)) {
        seen.add(partner.id)
        slides.push({ isPair: true, words: [word, partner] })
        continue
      }
    }

    slides.push({ isPair: false, words: [word] })
  }

  return slides
}

function WordCard({ word }: { word: Word }) {
  const meaning = word.type === 'Vi' ? word.korean_vi : word.korean_vt
  const label = word.type === 'Vi' ? '자동사' : '타동사'
  const color = word.type === 'Vi' ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'
  const textColor = word.type === 'Vi' ? 'text-blue-600' : 'text-green-600'

  return (
    <div className={`flex-1 rounded-2xl border-2 p-6 ${color}`}>
      <span className={`text-xs font-bold uppercase tracking-wider ${textColor}`}>
        {label}
      </span>
      <p className="text-2xl font-bold mt-2 mb-1">{word.english}</p>
      <p className="text-lg text-gray-700">{meaning}</p>
    </div>
  )
}

export default function PreviewPhase({ words, onComplete }: PreviewPhaseProps) {
  const slides = buildSlides(words)
  const [index, setIndex] = useState(0)

  const current = slides[index]
  const isLast = index === slides.length - 1

  function handleNext() {
    if (isLast) {
      onComplete()
    } else {
      setIndex(index + 1)
    }
  }

  return (
    <div className="min-h-screen flex flex-col p-4 max-w-lg mx-auto">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-500 mb-1">
          <span>예습</span>
          <span>{index + 1} / {slides.length}</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full">
          <div
            className="h-2 bg-blue-500 rounded-full transition-all"
            style={{ width: `${((index + 1) / slides.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Card(s) */}
      <div className={`flex gap-3 flex-1 items-stretch mb-8 ${current.isPair ? 'flex-row' : 'flex-col justify-center'}`}>
        {current.words.map((w) => (
          <WordCard key={w.id} word={w} />
        ))}
      </div>

      <button
        onClick={handleNext}
        className="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold text-lg hover:bg-blue-700 transition-colors"
      >
        {isLast ? '전투 시작 →' : '다음'}
      </button>
    </div>
  )
}
