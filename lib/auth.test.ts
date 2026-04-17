import { describe, it, expect } from 'vitest'
import { buildEmail, parseUsername } from './auth'

describe('buildEmail', () => {
  it('converts username to fake email', () => {
    expect(buildEmail('alice')).toBe('alice@jata100.app')
  })

  it('handles usernames with dots and hyphens', () => {
    expect(buildEmail('alice.kim')).toBe('alice.kim@jata100.app')
  })
})

describe('parseUsername', () => {
  it('extracts username from fake email', () => {
    expect(parseUsername('alice@jata100.app')).toBe('alice')
  })
})
