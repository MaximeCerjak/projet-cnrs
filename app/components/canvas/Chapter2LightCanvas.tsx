'use client'

/**
 * Chapter2LightCanvas
 *
 * Canvas de lumière fixe centrée pour le Chapitre 2.
 * Reproduit fidèlement Chapter2LightSystem.js.
 *
 * Exposé via ref impératif pour que Chapitre2Scene puisse appeler :
 *   lightRef.current.show()
 *   lightRef.current.hide(immediate?)
 *   lightRef.current.setFraction(frac, opacity?)
 *   lightRef.current.animateToFraction(frac, durationMs, opacity?) → Promise
 */

import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react'
import { GLOBAL_CONFIG } from '@/app/lib/config/global'
import { O, osc } from '@/app/lib/oscillators'

export interface Chapter2LightHandle {
  show: () => void
  hide: (immediate?: boolean) => void
  setFraction: (frac: number, opacity?: number) => void
  animateToFraction: (frac: number, durationMs: number, opacity?: number) => Promise<void>
  resize: () => void
}

function vW() { return Math.max(GLOBAL_CONFIG.MIN_SIZE.width,  window.innerWidth) }
function vH() { return Math.max(GLOBAL_CONFIG.MIN_SIZE.height, window.innerHeight) }
function minDim() { return Math.min(vW(), vH()) }

const Chapter2LightCanvas = forwardRef<Chapter2LightHandle>((_, ref) => {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const state      = useRef({
    visible:     false,
    opacity:     0,
    radius:      0,
    radiusFrac:  0,
  })
  const rafRef     = useRef<number | null>(null)
  const animRafRef = useRef<number | null>(null)

  // ── Render loop ────────────────────────────────────────────────────────────

  const render = (t: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const s  = state.current
    const W  = canvas.width
    const H  = canvas.height
    const active = s.visible && s.opacity > 0.001 && s.radius > 1

    const cx = W / 2 + (active ? osc(O.dx, t) * 0.38 : 0)
    const cy = H / 2 + (active ? osc(O.dy, t) * 0.30 : 0)

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, W, H)

    if (!active) return

    const intensity = 1
      + osc(O.b1, t) + osc(O.b2, t)
      + osc(O.f1, t) + osc(O.f2, t)
      + osc(O.f3, t) + osc(O.f4, t)
    const r  = Math.max(0, s.radius * Math.max(0.74, intensity))
    const wp = osc(O.w, t)

    const safeGrad = (x0: number, y0: number, r0: number, r1: number) => {
      if (!isFinite(r1) || r1 <= 0) return null
      return ctx.createRadialGradient(cx, cy, Math.max(0, r0), cx, cy, Math.max(0.001, r1))
    }

    ctx.globalAlpha = s.opacity
    ctx.globalCompositeOperation = 'destination-out'

    const g1 = safeGrad(cx, cy, 0, r * 3.9)
    if (g1) {
      g1.addColorStop(0,    'rgba(0,0,0,0.28)')
      g1.addColorStop(0.22, 'rgba(0,0,0,0.16)')
      g1.addColorStop(0.55, 'rgba(0,0,0,0.07)')
      g1.addColorStop(0.82, 'rgba(0,0,0,0.02)')
      g1.addColorStop(1,    'rgba(0,0,0,0)')
      ctx.beginPath(); ctx.arc(cx, cy, r * 3.9, 0, Math.PI * 2)
      ctx.fillStyle = g1; ctx.fill()
    }

    const g2 = safeGrad(cx, cy, 0, r * 2.25)
    if (g2) {
      g2.addColorStop(0,    'rgba(0,0,0,0.44)')
      g2.addColorStop(0.35, 'rgba(0,0,0,0.28)')
      g2.addColorStop(0.68, 'rgba(0,0,0,0.10)')
      g2.addColorStop(1,    'rgba(0,0,0,0)')
      ctx.beginPath(); ctx.arc(cx, cy, r * 2.25, 0, Math.PI * 2)
      ctx.fillStyle = g2; ctx.fill()
    }

    const g3 = safeGrad(cx, cy, 0, r * 1.03)
    if (g3) {
      g3.addColorStop(0,    'rgba(0,0,0,0.78)')
      g3.addColorStop(0.28, 'rgba(0,0,0,0.68)')
      g3.addColorStop(0.58, 'rgba(0,0,0,0.42)')
      g3.addColorStop(0.82, 'rgba(0,0,0,0.16)')
      g3.addColorStop(1,    'rgba(0,0,0,0)')
      ctx.beginPath(); ctx.arc(cx, cy, r * 1.03, 0, Math.PI * 2)
      ctx.fillStyle = g3; ctx.fill()
    }

    const rC = Math.max(1, r * (0.28 + Math.abs(osc(O.f1, t)) * 0.15))
    const gC = safeGrad(cx, cy, 0, rC)
    if (gC) {
      gC.addColorStop(0, 'rgba(0,0,0,0.18)')
      gC.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.beginPath(); ctx.arc(cx, cy, rC, 0, Math.PI * 2)
      ctx.fillStyle = gC; ctx.fill()
    }

    ctx.globalCompositeOperation = 'source-over'

    const wR = Math.max(1, r * 0.62 * Math.max(0.55, intensity))
    const wA = 0.048 + Math.abs(wp) * 0.028
    const gW = safeGrad(cx, cy, 0, wR)
    if (gW) {
      const gb = Math.floor(Math.max(0, Math.min(255, 185 + wp * 14)))
      gW.addColorStop(0,    `rgba(255,${gb},70,${(wA * 1.5).toFixed(3)})`)
      gW.addColorStop(0.45, `rgba(255,170,55,${wA.toFixed(3)})`)
      gW.addColorStop(1,    'rgba(255,130,20,0)')
      ctx.beginPath(); ctx.arc(cx, cy, wR, 0, Math.PI * 2)
      ctx.fillStyle = gW; ctx.fill()
    }

    const vIn  = Math.max(0, r * 1.05)
    const vOut = Math.max(vIn + 1, Math.sqrt(W * W + H * H) * 0.74)
    const gV   = safeGrad(cx, cy, vIn, vOut)
    if (gV) {
      gV.addColorStop(0,   'rgba(0,0,0,0)')
      gV.addColorStop(0.2, 'rgba(0,0,0,0.18)')
      gV.addColorStop(0.6, 'rgba(0,0,0,0.55)')
      gV.addColorStop(1,   'rgba(0,0,0,0.92)')
      ctx.fillStyle = gV
      ctx.fillRect(0, 0, W, H)
    }

    ctx.globalAlpha = 1
  }

  // ── Imperative API ─────────────────────────────────────────────────────────

  useImperativeHandle(ref, () => ({

    show() {
      const canvas = canvasRef.current
      if (!canvas) return
      state.current.visible = true
      canvas.style.display  = 'block'
      canvas.style.opacity  = '1'
    },

    hide(immediate = false) {
      const canvas = canvasRef.current
      if (!canvas) return
      state.current.visible = false
      if (immediate) {
        state.current.radius     = 0
        state.current.opacity    = 0
        state.current.radiusFrac = 0
        canvas.style.opacity = '0'
        canvas.style.display = 'none'
      } else {
        canvas.style.opacity = '0'
        setTimeout(() => {
          if (!state.current.visible && canvas) canvas.style.display = 'none'
        }, 260)
      }
    },

    setFraction(frac: number, opacity = 1) {
      const s      = state.current
      s.radiusFrac = Math.max(0, frac)
      s.radius     = minDim() * s.radiusFrac
      s.opacity    = Math.max(0, Math.min(1, opacity))
    },

    animateToFraction(targetFrac: number, durationMs: number, targetOpacity = 1): Promise<void> {
      if (animRafRef.current) cancelAnimationFrame(animRafRef.current)

      const s          = state.current
      const startFrac  = s.radiusFrac
      const startOp    = s.opacity
      const tFrac      = Math.max(0, targetFrac)
      const t0         = performance.now()

      return new Promise(resolve => {
        const step = (now: number) => {
          const p  = Math.min((now - t0) / Math.max(1, durationMs), 1)
          const e  = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2
          s.radiusFrac = startFrac + (tFrac - startFrac) * e
          s.radius     = minDim() * s.radiusFrac
          s.opacity    = startOp  + (targetOpacity - startOp) * e

          if (p < 1) {
            animRafRef.current = requestAnimationFrame(step)
          } else {
            animRafRef.current = null
            s.radiusFrac = tFrac
            s.radius     = minDim() * tFrac
            s.opacity    = targetOpacity
            resolve()
          }
        }
        animRafRef.current = requestAnimationFrame(step)
      })
    },

    resize() {
      const canvas = canvasRef.current
      if (!canvas) return
      const w = vW(); const h = vH()
      canvas.width  = w; canvas.height  = h
      canvas.style.width  = w + 'px'
      canvas.style.height = h + 'px'
      if (state.current.radiusFrac > 0)
        state.current.radius = minDim() * state.current.radiusFrac
    },
  }))

  // ── Mount / unmount ────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Taille initiale
    const w = vW(); const h = vH()
    canvas.width = w; canvas.height = h
    canvas.style.width  = w + 'px'
    canvas.style.height = h + 'px'

    // RAF loop
    const loop = (t: number) => {
      rafRef.current = requestAnimationFrame(loop)
      render(t)
    }
    rafRef.current = requestAnimationFrame(loop)

    const onResize = () => {
      const w = vW(); const h = vH()
      canvas.width = w; canvas.height = h
      canvas.style.width  = w + 'px'
      canvas.style.height = h + 'px'
      if (state.current.radiusFrac > 0)
        state.current.radius = minDim() * state.current.radiusFrac
    }
    window.addEventListener('resize', onResize, { passive: true })

    return () => {
      if (rafRef.current)     cancelAnimationFrame(rafRef.current)
      if (animRafRef.current) cancelAnimationFrame(animRafRef.current)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      id="chapter2-fixed-light"
      style={{
        position:      'absolute',
        inset:         0,
        zIndex:        2,
        pointerEvents: 'none',
        opacity:       0,
        display:       'none',
      }}
    />
  )
})

Chapter2LightCanvas.displayName = 'Chapter2LightCanvas'
export default Chapter2LightCanvas