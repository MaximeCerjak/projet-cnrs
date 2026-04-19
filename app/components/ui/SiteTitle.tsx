'use client'

import { useEffect, useRef } from 'react'
import { useNavigationStore } from '@/app/stores/navigationStore'
import { GLOBAL_CONFIG } from '@/app/lib/config/global'

export default function SiteTitle() {
  const { experienceStarted } = useNavigationStore()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!experienceStarted) return
    const el = ref.current
    if (!el) return

    const { texte, couleur, char_delay, start_delay } = GLOBAL_CONFIG.TITLE
    const font = GLOBAL_CONFIG.FONTS.title

    el.style.fontFamily    = font.family
    el.style.fontSize      = `clamp(${font.size_min}px, ${font.size_vw}vw, ${font.size_max}px)`
    el.style.fontWeight    = String(font.weight)
    el.style.letterSpacing = font.spacing
    el.style.color         = couleur
    el.style.textTransform = 'uppercase'

    const fullText = texte.join(' ')
    let charIndex  = 0
    el.textContent = ''
    el.style.opacity = '1'

    const timeout = setTimeout(() => {
      const interval = setInterval(() => {
        el.textContent = fullText.slice(0, charIndex + 1)
        charIndex++
        if (charIndex >= fullText.length) clearInterval(interval)
      }, char_delay)
    }, start_delay)

    return () => clearTimeout(timeout)
  }, [experienceStarted])

  return (
    <div
      id="site-title"
      ref={ref}
      style={{
        position:     'absolute',
        top:          '3.2%',
        left:         '3.5%',
        zIndex:       15,
        pointerEvents: 'none',
        opacity:      0,
      }}
    />
  )
}