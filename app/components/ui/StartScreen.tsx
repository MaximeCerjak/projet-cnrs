'use client'

import { useEffect, useRef } from 'react'
import { useNavigationStore } from '@/app/stores/navigationStore'
import { GLOBAL_CONFIG } from '@/app/lib/config/global'
import { getAudioManager } from '@/app/lib/audio/audioManager'

export default function StartScreen() {
  const { experienceStarted, startExperience } = useNavigationStore()
  const ref = useRef<HTMLDivElement>(null)

  const handleClick = async () => {
    // Déverrouille l'AudioContext — doit être dans un handler de geste utilisateur
    getAudioManager().getContext()
    startExperience()
  }

  useEffect(() => {
    if (!experienceStarted) return
    const el = ref.current; if (!el) return
    document.body.classList.add('experience-started')
    try { document.documentElement.requestFullscreen() } catch (_) {}
    el.style.transition = `opacity ${GLOBAL_CONFIG.START_SCREEN.fadeOut}ms ease`
    el.style.opacity    = '0'
    const t = setTimeout(() => el.remove(), GLOBAL_CONFIG.START_SCREEN.fadeOut + 200)
    return () => clearTimeout(t)
  }, [experienceStarted])

  return (
    <div id="start-screen" ref={ref} onClick={handleClick}>
      <div className="ss-title">Bienvenue</div>
      <div className="ss-body">
        Ce site propose une expérience sonore.<br />
        L&apos;usage d&apos;un casque est recommandé.
      </div>
      <div className="ss-cta">Cliquez pour commencer</div>
    </div>
  )
}