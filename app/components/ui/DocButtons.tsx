'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useNavigationStore } from '@/app/stores/navigationStore'
import { GLOBAL_CONFIG } from '@/app/lib/config/global'
import { PHRENOLOGIE_CONFIG } from '@/app/lib/config/scenes/phrenologie'

export default function DocButtons() {
  const { currentPage } = useNavigationStore()
  const ref = useRef<HTMLDivElement>(null)

  const draw = useCallback(() => {
    const el = ref.current; if (!el) return
    const C    = PHRENOLOGIE_CONFIG.docs
    const F    = GLOBAL_CONFIG.FONTS.doc_btns
    const w    = window.innerWidth; const h = window.innerHeight
    const btnW = Math.max(C.width_min, Math.min(C.width_max, w * C.width_vw / 100))
    const btnH = Math.max(C.height_min, Math.min(C.height_max, h * C.height_vh / 100))

    el.innerHTML = C.labels.map((label, i) => `
      <div class="doc-btn" data-index="${i}" style="width:${btnW}px;height:${btnH}px">
        <svg width="${btnW}" height="${btnH}" viewBox="0 0 ${btnW} ${btnH}"
          xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0;overflow:visible;">
          <rect class="doc-rect" x="0.5" y="0.5" width="${btnW-1}" height="${btnH-1}"
            stroke-dasharray="${2*(btnW+btnH)}" stroke-dashoffset="${2*(btnW+btnH)}"/>
          <text class="doc-label" x="${btnW/2}" y="${btnH/2}"
            font-family="${F.family}" font-weight="${F.weight}"
            font-size="clamp(${F.size_min}px,${F.size_vw}vw,${F.size_max}px)"
            letter-spacing="${F.spacing}">${label}</text>
        </svg>
      </div>`).join('')

    requestAnimationFrame(() => {
      el.querySelectorAll('.doc-rect').forEach((r, i) => setTimeout(() => r.classList.add('drawn'), 300 + i * 150))
      el.querySelectorAll('.doc-label').forEach((t, i) => setTimeout(() => t.classList.add('drawn'), 600 + i * 150))
    })

    el.querySelectorAll('.doc-btn').forEach((btn, i) => {
      const rect = btn.querySelector('.doc-rect') as SVGElement | null
      const label = btn.querySelector('.doc-label') as SVGElement | null
      const allBtns = el.querySelectorAll('.doc-btn')

      btn.addEventListener('mouseenter', () => {
        btn.classList.add('hovered')
        allBtns.forEach((b, j) => { if (j !== i) { b.classList.remove('push-up','push-down'); b.classList.add(j < i ? 'push-up' : 'push-down') } })
        if (rect) { rect.setAttribute('stroke', 'rgba(255,220,120,0.8)'); rect.style.filter = 'drop-shadow(0 0 7px rgba(255,210,80,.80)) drop-shadow(0 0 20px rgba(255,170,30,.50))' }
        label?.setAttribute('fill', 'rgba(255,220,120,1)')
      })
      btn.addEventListener('mouseleave', () => {
        btn.classList.remove('hovered')
        allBtns.forEach(b => b.classList.remove('push-up','push-down'))
        if (rect) { rect.setAttribute('stroke', 'rgba(255,255,255,0.72)'); rect.style.filter = '' }
        label?.setAttribute('fill', 'rgba(255,255,255,0.82)')
      })
    })
  }, [])

  useEffect(() => {
    const el = ref.current; if (!el) return
    if (currentPage !== 'phrenologie') { el.classList.remove('visible'); return }
    const t = setTimeout(() => { draw(); el.classList.add('visible') }, PHRENOLOGIE_CONFIG.docs.appear_at)
    return () => clearTimeout(t)
  }, [currentPage, draw])

  useEffect(() => {
    if (currentPage !== 'phrenologie') return
    window.addEventListener('resize', draw); document.addEventListener('fullscreenchange', draw)
    return () => { window.removeEventListener('resize', draw); document.removeEventListener('fullscreenchange', draw) }
  }, [currentPage, draw])

  return <div ref={ref} id="doc-btns" />
}