import * as Preact from 'preact'
import * as PreactHooks from 'preact/hooks'
import * as PreactJsxRuntime from 'preact/jsx-runtime'
import * as Signals from '@preact/signals'
import * as Motion from 'motion'
import * as MotionReact from 'motion/react'
import * as Icons from '@phosphor-icons/react'
import * as Three from 'three'
import * as Chart from 'chart.js'
import * as Howler from 'howler'
import * as DateFns from 'date-fns'
import * as Marked from 'marked'

Object.assign(globalThis, {
  __VIBE_PACKAGES__: {
    preact: Preact,
    'preact/hooks': PreactHooks,
    'preact/jsx-runtime': PreactJsxRuntime,
    '@preact/signals': Signals,
    motion: Motion,
    'motion/react': MotionReact,
    '@phosphor-icons/react': Icons,
    three: Three,
    'chart.js': Chart,
    howler: Howler,
    'date-fns': DateFns,
    marked: Marked,
  },
})
