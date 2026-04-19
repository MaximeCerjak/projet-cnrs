'use client'

import { useEffect, useRef } from 'react'
import { GLOBAL_CONFIG } from '@/app/lib/config/global'

function getArrowSizePx(): number {
  const vW = Math.max(GLOBAL_CONFIG.MIN_SIZE.width, window.innerWidth)
  const vH = Math.max(GLOBAL_CONFIG.MIN_SIZE.height, window.innerHeight)
  const A  = GLOBAL_CONFIG.ARROW
  return Math.round(Math.max(A.size_min, Math.min(A.size_max, Math.min(vW, vH) * A.size_vh / 100)))
}

export default function FullscreenBtn() {
  const ref = useRef<HTMLButtonElement>(null)

  const rebuild = () => {
    const el = ref.current; if (!el) return
    const sz = getArrowSizePx(); const stroke = 'rgba(255,255,255,0.75)'
    const glow = 'drop-shadow(0 0 7px rgba(255,210,80,.80)) drop-shadow(0 0 20px rgba(255,170,30,.50))'
    const fs = !!document.fullscreenElement
    const iconExpand = `
      <polyline points="15,3 21,3 21,9" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="transition:stroke .3s,filter .3s;"/>
      <polyline points="9,21 3,21 3,15" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="transition:stroke .3s,filter .3s;"/>
      <line x1="21" y1="3"  x2="14" y2="10" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" style="transition:stroke .3s,filter .3s;"/>
      <line x1="3"  y1="21" x2="10" y2="14" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" style="transition:stroke .3s,filter .3s;"/>`
    const iconCollapse = `
      <polyline points="4,14 10,14 10,20" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="transition:stroke .3s,filter .3s;"/>
      <polyline points="20,10 14,10 14,4" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="transition:stroke .3s,filter .3s;"/>
      <line x1="10" y1="14" x2="3"  y2="21" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" style="transition:stroke .3s,filter .3s;"/>
      <line x1="14" y1="10" x2="21" y2="3"  stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" style="transition:stroke .3s,filter .3s;"/>`
    el.innerHTML = `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" overflow="visible"
      style="display:block;transition:transform .35s cubic-bezier(0.34,1.56,0.64,1);transform-origin:center;">
      ${fs ? iconCollapse : iconExpand}</svg>`
    const svg = el.querySelector('svg')!
    const strokes = el.querySelectorAll<SVGElement>('[stroke]')
    el.onmouseenter = () => { svg.style.transform = 'scale(1.22)'; strokes.forEach(s => { s.style.stroke = 'rgba(255,230,130,0.95)'; s.style.filter = glow }) }
    el.onmouseleave = () => { svg.style.transform = 'scale(1)'; strokes.forEach(s => { s.style.stroke = stroke; s.style.filter = '' }) }
  }

  useEffect(() => {
    rebuild()
    const onChange = () => rebuild()
    document.addEventListener('fullscreenchange', onChange)
    window.addEventListener('resize', rebuild)
    return () => { document.removeEventListener('fullscreenchange', onChange); window.removeEventListener('resize', rebuild) }
  }, [])

  const toggle = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {})
    else document.exitFullscreen().catch(() => {})
  }

  return <button ref={ref} id="fs-btn" onClick={toggle} title="Plein écran" />
}