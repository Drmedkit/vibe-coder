import { describe, expect, it } from 'vitest'
import { isAllowedImport } from '../runtime-catalog'

describe('generated project import boundary', () => {
  it.each(['preact', 'preact/hooks', '@phosphor-icons/react', 'motion/react', './local'])('allows %s', value => {
    expect(isAllowedImport(value)).toBe(true)
  })

  it.each(['node:fs', 'child_process', 'axios', 'react', 'three/examples/jsm/controls/OrbitControls.js', '@unknown/package'])('rejects %s', value => {
    expect(isAllowedImport(value)).toBe(false)
  })
})
