'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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

function WordCard({ word, compact = false }: { word: Word; compact?: boolean }) {
  const meaning = word.type === 'Vi' ? word.korean_vi : word.korean_vt
  const isVi = word.type === 'Vi'

  return (
    <div
      className={`${compact ? 'flex-1 min-w-0' : 'w-full'} rounded-2xl border-2 p-5 sm:p-7`}
      style={{
        backgroundColor: isVi ? '#f0f1ff' : '#fff8ed',
        borderColor: isVi ? '#c5caff' : '#ffd89b',
      }}
    >
      <span
        className="inline-block text-xs font-black uppercase tracking-widest px-2 py-0.5 rounded-md mb-4"
        style={{ backgroundColor: isVi ? '#4255ff' : '#ff9500', color: 'white' }}
      >
        {isVi ? '자동사' : '타동사'}
      </span>
      <p className="text-2xl sm:text-3xl font-black mb-2 text-[#2e3856]">{word.english}</p>
      <p className="text-base sm:text-lg text-[#586380]">{meaning}</p>
    </div>
  )
}

export default function PreviewPhase({ words, onComplete }: PreviewPhaseProps) {
  const router = useRouter()
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
    <div className="min-h-screen flex flex-col max-w-lg mx-auto md:pt-10">
      {/* Top progress bar */}
      <div className="h-1.5 bg-[#eef0f8]">
        <div
          className="h-full transition-all duration-300"
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
        <span className="text-sm font-semibold text-[#939bb4]">예습</span>
        <span className="text-sm font-semibold text-[#2e3856]">{index + 1} / {slides.length}</span>
      </div>

      {/* Cards */}
      <div className="px-4 py-5 sm:px-6">
        {current.isPair ? (
          <div className="flex gap-3 w-full">
            {current.words.map((w) => (
              <WordCard key={w.id} word={w} compact />
            ))}
          </div>
        ) : (
          <WordCard word={current.words[0]} />
        )}
      </div>

      {/* Button */}
      <div className="p-5">
        <button
          onClick={handleNext}
          className="w-full py-4 rounded-2xl font-bold text-white text-lg transition-opacity hover:opacity-90 active:opacity-80"
          style={{ backgroundColor: '#4255ff' }}
        >
          {isLast ? '테스트 시작 →' : '다음'}
        </button>
      </div>
    </div>
  )
}
