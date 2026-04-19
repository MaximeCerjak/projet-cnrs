'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useNavigationStore } from '@/app/stores/navigationStore'
import { useNavigation } from '@/app/components/navigation/useNavigation'
import { GLOBAL_CONFIG } from '@/app/lib/config/global'
import { COLLABORATION_CONFIG } from '@/app/lib/config/scenes/collaboration'

export default function RomanCircles() {
  const { currentPage } = useNavigationStore()
  const { navigateTo }  = useNavigation()
  const ref = useRef<HTMLDivElement>(null)

  const draw = useCallback(() => {
    const el = ref.current; if (!el) return
    const C  = COLLABORATION_CONFIG.circles
    const F  = GLOBAL_CONFIG.FONTS
    const h  = window.innerHeight
    const size = h * C.size_vh / 100
    const gap  = h * C.gap_vh / 100

    el.innerHTML = C.labels.map((label, i) => `
      <div class="roman-btn" data-index="${i}" style="width:${size}px;height:${size}px;margin:0 ${gap/2}px">
        <svg width="${size}" height="${size}" viewBox="0 0 100 100" overflow="visible">
          <circle class="roman-c" cx="50" cy="50" r="46"
            stroke="rgba(255,255,255,0.7)" stroke-dasharray="289" stroke-dashoffset="289"
            style="transition:stroke-dashoffset 0.8s ease ${i * C.stagger}ms"/>
          <text class="roman-num" x="50" y="50"
            font-family="${F.roman.family}"
            font-size="clamp(${F.roman.size_min}px,${F.roman.size_vw}vw,${F.roman.size_max}px)"
            font-weight="${F.roman.weight}" letter-spacing="${F.roman.spacing}"
            fill="rgba(255,255,255,0.8)"
            opacity="0"
            style="transition:opacity 0.5s ease ${i * C.stagger + 400}ms">${label}</text>
        </svg>
      </div>`).join('')

    const drawTimer = setTimeout(() => {
      el.querySelectorAll('.roman-c').forEach(c => { (c as SVGElement).style.strokeDashoffset = '0' })
      el.querySelectorAll('.roman-num').forEach(t => { (t as SVGElement).style.opacity = '1' })
    }, C.appear_at)

    const hoverTitle = document.getElementById('hover-title')

    el.querySelectorAll('.roman-btn').forEach((btn, i) => {
      const circle  = btn.querySelector('.roman-c') as SVGElement | null
      const text    = btn.querySelector('.roman-num') as SVGElement | null
      const allBtns = el.querySelectorAll('.roman-btn')

      btn.addEventListener('mouseenter', () => {
        btn.classList.add('hovered')
        allBtns.forEach((b, j) => { if (j !== i) { b.classList.remove('push-up','push-down'); b.classList.add(j < i ? 'push-up' : 'push-down') } })
        circle?.setAttribute('stroke', 'rgba(255,220,120,1)')
        if (circle) (circle as SVGElement).style.filter = 'drop-shadow(0 0 7px rgba(255,210,80,0.80))'
        text?.setAttribute('fill', 'rgba(255,220,120,1)')
        if (hoverTitle && C.hover_titles[i]) {
          const f = GLOBAL_CONFIG.FONTS.hover_title
          const vW = Math.max(GLOBAL_CONFIG.MIN_SIZE.width, window.innerWidth)
          const sz = Math.max(f.size_min, Math.min(f.size_max, Math.round(vW * f.size_vw / 100)))
          Object.assign(hoverTitle.style, { fontFamily: f.family, fontSize: sz+'px', fontWeight: String(f.weight), letterSpacing: f.spacing, fontStyle: 'italic' })
          hoverTitle.innerHTML = `<span class="ht-text">${C.hover_titles[i]}</span>`
          hoverTitle.classList.add('visible')
        }
      })

      btn.addEventListener('mouseleave', () => {
        btn.classList.remove('hovered')
        allBtns.forEach(b => b.classList.remove('push-up','push-down'))
        circle?.setAttribute('stroke', 'rgba(255,255,255,0.7)')
        if (circle) (circle as SVGElement).style.filter = ''
        text?.setAttribute('fill', 'rgba(255,255,255,0.8)')
        if (hoverTitle) hoverTitle.classList.remove('visible')
      })

      btn.addEventListener('click', () => {
        const action = C.actions[i]
        if (action) navigateTo(action)
      })
    })

    return () => clearTimeout(drawTimer)
  }, [navigateTo])

  useEffect(() => {
    const el = ref.current; if (!el) return
    if (currentPage !== 'collaboration') {
      el.classList.remove('visible')
      document.getElementById('hover-title')?.classList.remove('visible')
      return
    }
    draw()
    setTimeout(() => el.classList.add('visible'), 50)
  }, [currentPage, draw])

  useEffect(() => {
    if (currentPage !== 'collaboration') return
    window.addEventListener('resize', draw); document.addEventListener('fullscreenchange', draw)
    return () => { window.removeEventListener('resize', draw); document.removeEventListener('fullscreenchange', draw) }
  }, [currentPage, draw])

  return (
    <>
      <div ref={ref} id="roman-circles" />
      <div id="hover-title" />
    </>
  )
}