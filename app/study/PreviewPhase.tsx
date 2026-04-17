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

function WordCard({ word, fullWidth = false }: { word: Word; fullWidth?: boolean }) {
  const meaning = word.type === 'Vi' ? word.korean_vi : word.korean_vt
  const isVi = word.type === 'Vi'

  return (
    <div
      className={`${fullWidth ? 'w-full' : 'flex-1 min-w-0'} rounded-2xl p-3 sm:p-5 md:p-5 border-2 flex flex-col justify-center overflow-hidden`}
      style={{
        backgroundColor: isVi ? '#f0f1ff' : '#fff8ed',
        borderColor: isVi ? '#c5caff' : '#ffd89b',
      }}
    >
      <span
        className="inline-block self-start text-xs font-black uppercase tracking-widest px-2 py-0.5 rounded-md mb-2 sm:mb-3"
        style={{
          backgroundColor: isVi ? '#4255ff' : '#ff9500',
          color: 'white',
        }}
      >
        {isVi ? '자동사' : '타동사'}
      </span>
      <p className="text-xl sm:text-2xl md:text-2xl font-black mb-1 sm:mb-2 text-[#2e3856] break-words">{word.english}</p>
      <p className="text-sm sm:text-base md:text-base text-[#586380] break-words">{meaning}</p>
    </div>
  )
}

export default function PreviewPhase({ words, onComplete }: PreviewPhaseProps) {
  const slides = buildSlides(words)
  const [index, setIndex] = useState(0)

  const current = slides[index]
  const isLast = index === slides.length - 1
  const progressPct = ((index + 1) / slides.length) * 100

  function handleNext() {
    if (isLast) {
      onComplete()
    } else {
      setIndex(index + 1)
    }
  }

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto">
      {/* Top progress bar */}
      <div className="h-1.5 bg-[#eef0f8]">
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${progressPct}%`, backgroundColor: '#4255ff' }}
        />
      </div>

      {/* Header */}
      <div className="flex justify-between items-center px-5 py-3 bg-white border-b border-[#d9dde8]">
        <span className="text-sm font-semibold text-[#939bb4]">예습</span>
        <span className="text-sm font-semibold text-[#2e3856]">{index + 1} / {slides.length}</span>
      </div>

      {/* Cards */}
      <div className="flex-1 min-h-0 flex p-3 sm:p-5 md:p-6 max-h-[60vh] md:max-h-[55vh]">
        {current.isPair ? (
          <div className="flex gap-3 w-full">
            {current.words.map((w) => (
              <WordCard key={w.id} word={w} />
            ))}
          </div>
        ) : (
          <WordCard word={current.words[0]} fullWidth />
        )}
      </div>

      {/* Button */}
      <div className="p-5">
        <button
          onClick={handleNext}
          className="w-full py-4 rounded-2xl font-bold text-white text-lg transition-opacity hover:opacity-90 active:opacity-80"
          style={{ backgroundColor: '#4255ff' }}
        >
          {isLast ? '전투 시작 →' : '다음'}
        </button>
      </div>
    </div>
  )
}
