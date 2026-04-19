'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useNavigationStore } from '@/app/stores/navigationStore'
import { useNavigation } from './useNavigation'
import { GLOBAL_CONFIG } from '@/app/lib/config/global'
import type { PageId } from '@/app/lib/types'

const PATHS: Record<string, string> = {
  down:  'M35 22 L35 48 M24 37 L35 48 L46 37',
  up:    'M35 48 L35 22 M24 33 L35 22 L46 33',
  left:  'M48 35 L22 35 M33 24 L22 35 L33 46',
  right: 'M22 35 L48 35 M37 24 L48 35 L37 46',
}

function getArrowSizePx(): number {
  const vW = Math.max(GLOBAL_CONFIG.MIN_SIZE.width, window.innerWidth)
  const vH = Math.max(GLOBAL_CONFIG.MIN_SIZE.height, window.innerHeight)
  const A  = GLOBAL_CONFIG.ARROW
  return Math.round(Math.max(A.size_min, Math.min(A.size_max, Math.min(vW, vH) * A.size_vh / 100)))
}

function getPosition(position: string): React.CSSProperties {
  const vW     = Math.max(GLOBAL_CONFIG.MIN_SIZE.width, window.innerWidth)
  const vH     = Math.max(GLOBAL_CONFIG.MIN_SIZE.height, window.innerHeight)
  const margin = Math.round(Math.min(vW, vH) * 0.05)
  switch (position) {
    case 'top-center':    return { top: '5%', bottom: 'auto', left: '50%', right: 'auto', transform: 'translateX(-50%)' }
    case 'bottom-left':   return { bottom: '46%', top: 'auto', left: '2%', right: 'auto', transform: 'none' }
    case 'bottom-right':  return { bottom: margin, top: 'auto', right: margin, left: 'auto', transform: 'none' }
    case 'bottom-center':
    default:              return { bottom: '5%', top: 'auto', left: '50%', right: 'auto', transform: 'translateX(-50%)' }
  }
}

function buildSVG(sz: number, svgPath: string, animated: boolean): string {
  const CIRC = 201; const PLEN = 60
  const co = animated ? CIRC : 0; const po = animated ? PLEN : 0
  return `<svg width="${sz}" height="${sz}" viewBox="0 0 70 70" overflow="visible"
    style="display:block;transition:transform .35s cubic-bezier(0.34,1.56,0.64,1);transform-origin:center;">
    <circle class="arrow-c" cx="35" cy="35" r="32" fill="none"
      stroke="rgba(255,255,255,0.75)" stroke-width="1.2"
      stroke-dasharray="${CIRC}" stroke-dashoffset="${co}"
      style="transition:stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1),stroke .3s,filter .3s;"/>
    <path class="arrow-p" d="${svgPath}" fill="none"
      stroke="rgba(255,255,255,0.80)" stroke-width="1.4"
      stroke-linecap="round" stroke-linejoin="round"
      stroke-dasharray="${PLEN}" stroke-dashoffset="${po}"
      style="transition:stroke-dashoffset 0.7s cubic-bezier(0.4,0,0.2,1) 1.3s,stroke .3s,filter .3s;"/>
  </svg>`
}

function attachHover(el: HTMLDivElement) {
  const svg = el.querySelector('svg')
  const c   = el.querySelector('.arrow-c') as SVGElement | null
  const p   = el.querySelector('.arrow-p') as SVGElement | null
  if (!svg || !c || !p) return
  const glow = 'drop-shadow(0 0 7px rgba(255,210,80,.80)) drop-shadow(0 0 20px rgba(255,170,30,.50))'
  el.onmouseenter = () => {
    svg.style.transform = 'scale(1.22)'
    c.style.stroke = 'rgba(255,230,130,0.95)'; c.style.filter = glow
    p.style.stroke = 'rgba(255,230,130,0.95)'; p.style.filter = glow
  }
  el.onmouseleave = () => {
    svg.style.transform = 'scale(1)'
    c.style.stroke = 'rgba(255,255,255,0.75)'; c.style.filter = ''
    p.style.stroke = 'rgba(255,255,255,0.80)'; p.style.filter = ''
  }
}

function rippleClick(el: HTMLDivElement, onNavigate: () => void) {
  const svg = el.querySelector('svg') as SVGSVGElement | null
  const c   = el.querySelector('.arrow-c') as SVGElement | null
  const p   = el.querySelector('.arrow-p') as SVGElement | null
  if (!svg || !c || !p) { onNavigate(); return }
  const sz = parseInt(svg.getAttribute('width') || '70') || 70
  const DIM = sz * 3; const CX = DIM / 2; const CY = DIM / 2
  const BASE_R = 32 * (sz / 70); const TOTAL = 800; const TAU = Math.PI * 2
  const cvs = document.createElement('canvas')
  cvs.width = DIM; cvs.height = DIM
  Object.assign(cvs.style, { position:'absolute', width:DIM+'px', height:DIM+'px',
    left:((sz-DIM)/2)+'px', top:((sz-DIM)/2)+'px', pointerEvents:'none', zIndex:'20' })
  el.appendChild(cvs)
  const ctx = cvs.getContext('2d')!
  const arcs  = Array.from({length:8},  (_,i) => ({ angle:(TAU/8)*i,  drift:(Math.random()-.5)*.5, len:.16+Math.random()*.18, delay:Math.random()*.1 }))
  const sparks = Array.from({length:14}, (_,i) => ({ angle:(TAU/14)*i+Math.random()*.35, speed:.55+Math.random()*.7, life:.45+Math.random()*.4, size:1.4+Math.random()*2.4, delay:.04+Math.random()*.18 }))
  const eo  = (t:number) => 1-Math.pow(1-t,3)
  const eo2 = (t:number) => 1-Math.pow(1-t,2)
  const t0 = performance.now()
  const frame = (now:number) => {
    const t = Math.min((now-t0)/TOTAL,1); ctx.clearRect(0,0,DIM,DIM)
    arcs.forEach(a => {
      const lt = Math.max(0,(t-a.delay)/(1-a.delay)); if(lt<=0) return
      const radius=BASE_R*(1+eo(lt)*1.05); const alpha=lt<.3?lt/.3:eo2(1-(lt-.3)/.7); if(alpha<=0.01) return
      const startA=a.angle+a.drift*eo(lt); const arcLen=TAU*a.len*(lt<.18?lt/.18:(lt>.72?eo2((1-lt)/.28):1))
      ctx.save(); ctx.strokeStyle=`rgba(255,${Math.floor(195+60*(1-lt))},${Math.floor(65+80*(1-lt))},${alpha*.88})`
      ctx.lineWidth=(2.8-lt*1.4)*(sz/70); ctx.lineCap='round'
      ctx.shadowColor=`rgba(255,185,40,${alpha*.55})`; ctx.shadowBlur=18*(sz/70)
      ctx.beginPath(); ctx.arc(CX,CY,radius,startA,startA+arcLen); ctx.stroke(); ctx.restore()
    })
    sparks.forEach(sp => {
      const lt=Math.max(0,(t-sp.delay)/sp.life); if(lt<=0||lt>1) return
      const dist=eo(lt)*BASE_R*2.2*sp.speed; const alpha=lt<.25?lt/.25:eo2(1-(lt-.25)/.75)
      ctx.save(); ctx.fillStyle=`rgba(255,${Math.floor(215+40*(1-lt))},${Math.floor(80+120*(1-lt))},${alpha*.92})`
      ctx.shadowColor=`rgba(255,195,50,${alpha*.5})`; ctx.shadowBlur=10*(sz/70)
      ctx.beginPath(); ctx.arc(CX+Math.cos(sp.angle)*dist,CY+Math.sin(sp.angle)*dist,sp.size*(sz/70)*(1-lt*.55),0,TAU); ctx.fill(); ctx.restore()
    })
    const halo=t<.12?eo(t/.12):eo2(1-(t-.12)/.88)
    if(halo>.01){const gr=ctx.createRadialGradient(CX,CY,0,CX,CY,BASE_R*.75);gr.addColorStop(0,`rgba(255,230,130,${halo*.5})`);gr.addColorStop(.5,`rgba(255,175,35,${halo*.18})`);gr.addColorStop(1,'rgba(255,110,0,0)');ctx.save();ctx.fillStyle=gr;ctx.beginPath();ctx.arc(CX,CY,BASE_R*.75,0,TAU);ctx.fill();ctx.restore()}
    const svgAlpha=t<.2?1:eo2(1-(t-.2)/.8); svg.style.opacity=String(svgAlpha)
    const warm=Math.floor(195+60*Math.min(t*6,1))
    c.style.stroke=`rgba(255,${warm},60,${svgAlpha*.9})`; p.style.stroke=`rgba(255,${warm},70,${svgAlpha*.9})`
    if(t<.35){const g=`drop-shadow(0 0 ${(1-t/.35)*14}px rgba(255,200,55,${.7*(1-t/.35)}))`; c.style.filter=g; p.style.filter=g}else{c.style.filter='';p.style.filter=''}
    if(t<1) requestAnimationFrame(frame); else{ctx.clearRect(0,0,DIM,DIM);cvs.remove()}
  }
  requestAnimationFrame(frame)
  setTimeout(() => onNavigate(), 400)
}

interface NavigationArrowProps {
  showOnPage:   PageId
  targetPage:   PageId
  position?:    'bottom-center' | 'top-center' | 'bottom-left' | 'bottom-right'
  direction?:   'up' | 'down' | 'left' | 'right'
  appearDelay?: number
}

export default function NavigationArrow({
  showOnPage, targetPage,
  position = 'bottom-center', direction = 'down', appearDelay = 0,
}: NavigationArrowProps) {
  const { experienceStarted, currentPage } = useNavigationStore()
  const { navigateTo, isTransitioning }    = useNavigation()
  const ref     = useRef<HTMLDivElement>(null)
  const drawing = useRef(false)
  const timers  = useRef<ReturnType<typeof setTimeout>[]>([])
  const svgPath = PATHS[direction] ?? PATHS.down

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = [] }

  const applyPos = useCallback(() => {
    const el = ref.current; if (!el) return
    Object.assign(el.style, getPosition(position))
  }, [position])

  const show = useCallback(() => {
    const el = ref.current; if (!el) return
    const sz = getArrowSizePx()
    applyPos()
    el.innerHTML = buildSVG(sz, svgPath, true)
    el.style.transition = 'opacity 1.0s ease'; el.style.opacity = '1'
    el.classList.add('visible')
    drawing.current = true
    timers.current.push(setTimeout(() => { drawing.current = false }, 2100))
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.querySelector('.arrow-c')?.setAttribute('stroke-dashoffset', '0')
      el.querySelector('.arrow-p')?.setAttribute('stroke-dashoffset', '0')
    }))
    attachHover(el)
    el.onclick = () => { if (drawing.current || isTransitioning) return; rippleClick(el, () => navigateTo(targetPage)) }
  }, [applyPos, svgPath, isTransitioning, navigateTo, targetPage])

  const hide = useCallback((instant = false) => {
    const el = ref.current; if (!el) return
    if (instant) {
      el.style.transition = 'none'; el.style.opacity = '0'
      el.classList.remove('visible'); el.innerHTML = ''; el.onclick = null
    } else {
      el.style.transition = 'opacity 400ms ease'; el.style.opacity = '0'
      el.classList.remove('visible')
      setTimeout(() => { if (el) { el.innerHTML = ''; el.onclick = null } }, 420)
    }
  }, [])

  const resize = useCallback(() => {
    const el = ref.current; if (!el || !el.classList.contains('visible')) return
    applyPos(); el.innerHTML = buildSVG(getArrowSizePx(), svgPath, false)
    attachHover(el)
    el.onclick = () => { if (drawing.current || isTransitioning) return; rippleClick(el, () => navigateTo(targetPage)) }
  }, [applyPos, svgPath, isTransitioning, navigateTo, targetPage])

  useEffect(() => {
    if (!experienceStarted) return
    if (currentPage !== showOnPage) { hide(true); return }
    clearTimers(); hide(true)
    timers.current.push(setTimeout(() => show(), appearDelay))
    return clearTimers
  }, [experienceStarted, currentPage, showOnPage, show, hide, appearDelay])

  useEffect(() => {
    if (currentPage !== showOnPage) return
    window.addEventListener('resize', resize)
    document.addEventListener('fullscreenchange', resize)
    return () => { window.removeEventListener('resize', resize); document.removeEventListener('fullscreenchange', resize) }
  }, [currentPage, showOnPage, resize])

  useEffect(() => {
    const el = ref.current; if (!el) return
    el.style.opacity = '0'
    Object.assign(el.style, getPosition(position))
  }, [position])

  return <div ref={ref} data-arrow="true" style={{ position: 'absolute', zIndex: 10, cursor: 'none' }} />
}