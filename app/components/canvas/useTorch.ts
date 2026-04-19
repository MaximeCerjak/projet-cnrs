'use client'

import { useRef, useCallback } from 'react'
import { GLOBAL_CONFIG } from '@/app/lib/config/global'
import { SCENE_REGISTRY } from '@/app/lib/scenes/registry'
import type { PageId } from '@/app/lib/types'

export function getTorchTargetRadius(page: PageId, vMin: number): number {
  const scene = SCENE_REGISTRY[page]
  // torch: null = scène avec son propre système de lumière (chapitre-2)
  if (!scene || scene.torch === null) return 0
  return vMin * scene.torch
}

export function useTorch() {
  const torchX       = useRef(0)
  const torchY       = useRef(0)
  const torchRadius  = useRef(0)
  const targetRadius = useRef(0)
  const growStart    = useRef<number | null>(null)
  const growFrom     = useRef(0)
  const growDuration = useRef(0)

  const growTorch = useCallback((target: number, durationMs: number) => {
    growFrom.current     = torchRadius.current
    targetRadius.current = target
    growStart.current    = performance.now()
    growDuration.current = durationMs
  }, [])

  const updateTorch = useCallback((mouseX: number, mouseY: number, timestamp: number) => {
    torchX.current += (mouseX - torchX.current) * GLOBAL_CONFIG.TORCH.lag
    torchY.current += (mouseY - torchY.current) * GLOBAL_CONFIG.TORCH.lag

    if (growStart.current !== null) {
      const elapsed  = timestamp - growStart.current
      const progress = Math.min(elapsed / growDuration.current, 1)
      const ease     = 1 - Math.pow(1 - progress, 3) // easeOutCubic
      torchRadius.current = growFrom.current + (targetRadius.current - growFrom.current) * ease
      if (progress >= 1) growStart.current = null
    }

    return { x: torchX.current, y: torchY.current, r: torchRadius.current }
  }, [])

  return { updateTorch, growTorch, torchRadius, targetRadius }
}