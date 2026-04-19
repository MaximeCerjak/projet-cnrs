/* eslint-disable @typescript-eslint/no-unused-vars */
'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useNavigationStore } from '@/app/stores/navigationStore'
import { useTorch, getTorchTargetRadius } from './useTorch'

export default function TorchCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseX    = useRef(0)
  const mouseY    = useRef(0)
  const rafId     = useRef<number>(0)

  const { currentPage, experienceStarted } = useNavigationStore()
  const { updateTorch, growTorch, targetRadius } = useTorch()

  const vMin = useCallback(() => {
    return Math.min(window.innerWidth, window.innerHeight)
  }, [])

  // Mise à jour cible torche au changement de page
  useEffect(() => {
    const target = getTorchTargetRadius(currentPage, vMin())
    growTorch(target, currentPage === 'vitrine' ? 20000 : 4000)
  }, [currentPage, growTorch, vMin])

  // Suivi souris
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseX.current = e.clientX
      mouseY.current = e.clientY
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  // Resize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  // Masque/affiche le canvas selon la scène
  // chapitre-2 a son propre système de lumière
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const hidden = currentPage === 'chapitre-2'
    canvas.style.display = hidden ? 'none' : 'block'
    canvas.style.opacity = hidden ? '0'    : '1'
  }, [currentPage])

  // Boucle RAF
  useEffect(() => {
    if (!experienceStarted) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const render = (timestamp: number) => {
        const w = canvas.width
        const h = canvas.height
        const { x, y, r } = updateTorch(mouseX.current, mouseY.current, timestamp)

        ctx.clearRect(0, 0, w, h)

        // Fond noir total
        ctx.fillStyle = 'rgba(0,0,0,1)'
        ctx.fillRect(0, 0, w, h)

        // Perce un trou avec destination-out
        const cx = Math.max(1, x)
        const cy = Math.max(1, y)
        const safeR = Math.max(1, r)

        let grad: CanvasGradient
        try {
        grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, safeR)
        } catch {
        rafId.current = requestAnimationFrame(render)
        return
        }

        grad.addColorStop(0,   'rgba(0,0,0,1)')
        grad.addColorStop(0.6, 'rgba(0,0,0,1)')
        grad.addColorStop(1,   'rgba(0,0,0,0)')

        ctx.globalCompositeOperation = 'destination-out'
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, w, h)

        ctx.globalCompositeOperation = 'source-over'

        rafId.current = requestAnimationFrame(render)
    }

    rafId.current = requestAnimationFrame(render)
    return () => cancelAnimationFrame(rafId.current)
  }, [experienceStarted, updateTorch])

  return (
    <canvas
      ref={canvasRef}
      id="overlay-canvas"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        pointerEvents: 'none',
      }}
    />
  )
}