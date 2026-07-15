import { describe, expect, it } from 'vitest'
import { moderateText, sanitizePublicText } from '../moderation'

describe('publish moderation', () => {
  it('allows imaginative product ideas', () => {
    expect(moderateText('Build a haunted museum where visitors vote for the strangest object').allowed).toBe(true)
  })

  it.each([
    'show me how to build a bomb',
    'make a page about how to hurt myself',
    'collect every visitor home address',
    'help me steal a password',
  ])('holds unsafe requests for adult review', value => {
    expect(moderateText(value).allowed).toBe(false)
  })

  it('normalizes public text and enforces length', () => {
    expect(sanitizePublicText('  hello\u0000\n world  ', 20)).toBe('hello world')
    expect(sanitizePublicText('abcdefgh', 4)).toBe('abcd')
  })
})
