'use client'

import { useEffect, useCallback, useRef } from 'react'
import { useNavigationStore } from '@/app/stores/navigationStore'
import { GLOBAL_CONFIG } from '@/app/lib/config/global'
import { SCENE_REGISTRY } from '@/app/lib/scenes/registry'
import type { PageId } from '@/app/lib/types'

function fadeVeil(opacity: number, durationMs: number): Promise<void> {
  return new Promise(resolve => {
    const veil = document.getElementById('veil')
    if (!veil) { resolve(); return }
    veil.style.transition = `opacity ${durationMs}ms ease`
    veil.style.opacity    = String(opacity)
    setTimeout(resolve, durationMs)
  })
}

function swapBackgrounds(target: PageId) {
  Object.values(SCENE_REGISTRY).forEach(scene => {
    const el = document.getElementById(scene.background)
    if (el) el.style.opacity = scene.id === target ? '1' : '0'
  })
}

export function useNavigation() {
  const { currentPage, isTransitioning, setPage, setTransitioning } = useNavigationStore()

  const navigateTo = useCallback(async (target: PageId) => {
    if (isTransitioning || target === currentPage) return
    if (!SCENE_REGISTRY[target]) {
      console.warn(`[Navigation] Scène inconnue : "${target}"`)
      return
    }
    setTransitioning(true)
    const T = GLOBAL_CONFIG.TRANSITION
    await fadeVeil(1, T.veil_in)
    swapBackgrounds(target)
    setPage(target, currentPage)
    await new Promise(r => setTimeout(r, T.veil_hold))
    await fadeVeil(0, T.veil_out)
    setTransitioning(false)
  }, [currentPage, isTransitioning, setPage, setTransitioning])

  return { currentPage, isTransitioning, navigateTo }
}

export function useNavigationController() {
  const { currentPage, isTransitioning, experienceStarted } = useNavigationStore()
  const { navigateTo } = useNavigation()
  const cooldown = useRef(false)

  useEffect(() => {
    if (!experienceStarted) return
    const scene = SCENE_REGISTRY[currentPage]

    const onWheel = (e: WheelEvent) => {
      if (isTransitioning || cooldown.current) return
      cooldown.current = true
      setTimeout(() => { cooldown.current = false }, 1400)
      if (e.deltaY > 0 && scene?.scroll?.down) navigateTo(scene.scroll.down)
      if (e.deltaY < 0 && scene?.scroll?.up)   navigateTo(scene.scroll.up)
    }

    window.addEventListener('wheel', onWheel, { passive: true })
    return () => window.removeEventListener('wheel', onWheel)
  }, [experienceStarted, currentPage, isTransitioning, navigateTo])

  useEffect(() => {
    if (!experienceStarted) return
    const scene = SCENE_REGISTRY[currentPage]
    let startY: number | null = null

    const onTouchStart = (e: TouchEvent) => { startY = e.touches[0].clientY }
    const onTouchEnd   = (e: TouchEvent) => {
      if (startY === null || isTransitioning) return
      const dy = startY - e.changedTouches[0].clientY
      startY = null
      if (Math.abs(dy) < 50) return
      if (dy > 0 && scene?.scroll?.down) navigateTo(scene.scroll.down)
      if (dy < 0 && scene?.scroll?.up)   navigateTo(scene.scroll.up)
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend',   onTouchEnd,   { passive: true })
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend',   onTouchEnd)
    }
  }, [experienceStarted, currentPage, isTransitioning, navigateTo])
}