'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useNavigationStore } from '@/app/stores/navigationStore'
import { useNavigation } from '@/app/components/navigation/useNavigation'
import { GLOBAL_CONFIG } from '@/app/lib/config/global'
import { PHRENOLOGIE_CONFIG } from '@/app/lib/config/scenes/phrenologie'

export default function NavBar() {
  const { currentPage } = useNavigationStore()
  const { navigateTo }  = useNavigation()
  const ref     = useRef<HTMLDivElement>(null)
  const animRaf = useRef<number | null>(null)

  const draw = useCallback(() => {
    const el = ref.current; if (!el) return
    const C  = PHRENOLOGIE_CONFIG.navbar
    const F  = GLOBAL_CONFIG.FONTS.nav_btns
    const vW = Math.max(GLOBAL_CONFIG.MIN_SIZE.width,  window.innerWidth)
    const vH = Math.max(GLOBAL_CONFIG.MIN_SIZE.height, window.innerHeight)
    const ns = 'http://www.w3.org/2000/svg'
    const A  = GLOBAL_CONFIG.ARROW
    const sz = Math.round(Math.max(A.size_min, Math.min(A.size_max, Math.min(vW, vH) * A.size_vh / 100)))
    const h  = sz
    const bottom = Math.round(vH * 0.05)
    const y  = vH - bottom - h
    const fsBtnW = sz + Math.round(vW * 0.035) * 2
    const maxW   = vW - Math.round(vW * 0.035) - fsBtnW
    const bw     = Math.min(Math.round(vW * C.width), maxW)
    const x      = Math.round((vW - bw) / 2)
    const N      = C.labels.length
    const cellW  = bw / N

    const svg = document.createElementNS(ns, 'svg')
    svg.setAttribute('width', String(vW)); svg.setAttribute('height', String(vH))

    const perim = 2 * (bw + h)
    const outerRect = document.createElementNS(ns, 'rect')
    outerRect.setAttribute('class', 'nav-rect-path')
    outerRect.setAttribute('x', String(x)); outerRect.setAttribute('y', String(y))
    outerRect.setAttribute('width', String(bw)); outerRect.setAttribute('height', String(h))
    outerRect.setAttribute('stroke', C.stroke_color); outerRect.setAttribute('stroke-width', String(C.stroke_width))
    outerRect.style.strokeDasharray = String(perim); outerRect.style.strokeDashoffset = String(perim)
    outerRect.style.transition = `stroke-dashoffset ${C.draw_speed}s cubic-bezier(0.4,0,0.2,1)`
    svg.appendChild(outerRect)

    const seps: SVGLineElement[] = []; const sepDefaultX: number[] = []
    for (let i = 1; i < N; i++) {
      const sx = x + i * cellW; sepDefaultX.push(sx)
      const sep = document.createElementNS(ns, 'line')
      sep.setAttribute('class', 'nav-rect-path')
      sep.setAttribute('x1', String(sx)); sep.setAttribute('y1', String(y))
      sep.setAttribute('x2', String(sx)); sep.setAttribute('y2', String(y + h))
      sep.setAttribute('stroke', C.stroke_color); sep.setAttribute('stroke-width', String(C.stroke_width))
      const d = C.draw_speed + (i - 1) * C.sep_delay
      sep.style.strokeDasharray = String(h); sep.style.strokeDashoffset = String(h)
      sep.style.transition = `stroke-dashoffset ${C.sep_speed}s cubic-bezier(0.4,0,0.2,1) ${d}s`
      svg.appendChild(sep); seps.push(sep)
    }

    const navFontSize = Math.max(F.size_min, Math.min(F.size_max, Math.round(vW * F.size_vw / 100)))
    const txts: SVGTextElement[] = []
    C.labels.forEach((label, i) => {
      const d = C.draw_speed + i * C.sep_delay + C.text_delay
      const txt = document.createElementNS(ns, 'text')
      txt.setAttribute('class', 'nav-btn-label')
      txt.setAttribute('x', String(x + (i + 0.5) * cellW)); txt.setAttribute('y', String(y + h / 2))
      txt.setAttribute('fill', C.btn_color); txt.setAttribute('font-family', F.family)
      txt.setAttribute('font-size', navFontSize + 'px'); txt.setAttribute('letter-spacing', F.spacing)
      txt.setAttribute('font-weight', String(F.weight))
      txt.textContent = label; txt.style.opacity = '0'; txt.style.pointerEvents = 'none'
      txt.style.transition = `opacity ${C.text_fade}s ease ${d}s`
      svg.appendChild(txt); txts.push(txt)
    })

    const zones: SVGRectElement[] = []
    C.labels.forEach((_, i) => {
      const zone = document.createElementNS(ns, 'rect')
      zone.setAttribute('class', 'nav-btn-zone')
      zone.setAttribute('x', String(x + i * cellW)); zone.setAttribute('y', String(y))
      zone.setAttribute('width', String(cellW)); zone.setAttribute('height', String(h))
      zone.setAttribute('fill', 'transparent')
      svg.appendChild(zone); zones.push(zone)
    })

    el.innerHTML = ''; el.style.width = vW + 'px'; el.style.height = vH + 'px'; el.appendChild(svg)

    setTimeout(() => {
      outerRect.style.strokeDashoffset = '0'
      seps.forEach(s => { s.style.strokeDashoffset = '0' })
      txts.forEach(t => { t.style.opacity = '1' })
    }, 40)

    const EXPAND = cellW * 0.18; const DUR_MS = 600; 
    const sepCurX = sepDefaultX.slice();

    const animateSeps = (targetX: number[], targetTxtX: number[], hovI: number) => {
      if (animRaf.current) { cancelAnimationFrame(animRaf.current); animRaf.current = null }
      const startX = sepCurX.slice(); const startTX = txts.map(t => parseFloat(t.getAttribute('x') ?? '0'))
      const t0 = performance.now()
      const step = (now: number) => {
        const p = Math.min((now - t0) / DUR_MS, 1); const e = 1 - Math.pow(1 - p, 3)
        seps.forEach((sep, si) => { const nx = startX[si] + (targetX[si] - startX[si]) * e; sepCurX[si] = nx; sep.setAttribute('x1', String(nx)); sep.setAttribute('x2', String(nx)) })
        txts.forEach((txt, ti) => { const nx = startTX[ti] + (targetTxtX[ti] - startTX[ti]) * e; txt.setAttribute('x', String(nx)); txt.setAttribute('fill', ti === hovI ? C.btn_color_hover : C.btn_color) })
        if (p < 1) animRaf.current = requestAnimationFrame(step); else animRaf.current = null
      }
      animRaf.current = requestAnimationFrame(step)
    }

    zones.forEach((zone, i) => {
      zone.addEventListener('mouseenter', () => {
        const tSepX = sepDefaultX.map((sx, si) => si === i-1 ? sx-EXPAND : si === i ? sx+EXPAND : sx)
        const tTxtX = txts.map((_, ti) => {
          const lx = ti === 0     ? x      : (tSepX[ti-1] ?? sepDefaultX[ti-1])
          const rx = ti === N-1   ? x + bw : (tSepX[ti]   ?? sepDefaultX[ti])
          return (lx + rx) / 2
        })
        animateSeps(tSepX, tTxtX, i)
      })
      zone.addEventListener('mouseleave', () => {
        animateSeps(sepDefaultX.slice(), txts.map((_, ti) => x + (ti + 0.5) * cellW), -1)
        txts.forEach(t => t.setAttribute('fill', C.btn_color))
      })
      // Navigation depuis les actions déclarées dans la config
      const action = C.actions[i]
      if (action) zone.addEventListener('click', () => navigateTo(action))
    })
  }, [navigateTo])

  useEffect(() => {
    const el = ref.current; if (!el) return
    if (currentPage !== 'phrenologie') { el.classList.remove('visible'); return }
    const t = setTimeout(() => { draw(); el.classList.add('visible') }, PHRENOLOGIE_CONFIG.navbar.appear_at)
    return () => clearTimeout(t)
  }, [currentPage, draw])

  useEffect(() => {
    if (currentPage !== 'phrenologie') return
    window.addEventListener('resize', draw); document.addEventListener('fullscreenchange', draw)
    return () => { window.removeEventListener('resize', draw); document.removeEventListener('fullscreenchange', draw) }
  }, [currentPage, draw])

  return <div ref={ref} id="nav-bar" />
}