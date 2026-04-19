'use client'

import { useEffect, useRef } from 'react'
import { useNavigationStore } from '@/app/stores/navigationStore'
import { getAudioManager } from '@/app/lib/audio/audioManager'
import { GLOBAL_CONFIG } from '@/app/lib/config/global'
import { COLLABORATION_CONFIG } from '@/app/lib/config/scenes/collaboration'

export default function SceneAudio() {
  const { currentPage, experienceStarted } = useNavigationStore()
  const museeStarted = useRef(false)

  // Démarre le son musée dès que l'expérience commence
  useEffect(() => {
    if (!experienceStarted) return
    if (museeStarted.current) return
    museeStarted.current = true
    getAudioManager().startMuseeLoop()
  }, [experienceStarted])

  // Transitions audio à chaque changement de page
  useEffect(() => {
    if (!experienceStarted || !museeStarted.current) return
    const audio = getAudioManager()
    const A = GLOBAL_CONFIG.AUDIO

    switch (currentPage) {
      case 'vitrine':
      case 'phrenologie':
        audio.stopCollabLoop(A.collab_fade_out)
        audio.stopSanzaLoop(A.sanza_fade_out)
        audio.fadeMusee(A.musee_vol, A.musee_fade)
        break
      case 'collaboration':
        audio.fadeMusee(0, 1500)
        audio.startCollabLoop()
        break
      case 'chapitre-2':
        audio.stopCollabLoop(COLLABORATION_CONFIG.audio.fade_out)
        break
    }
  }, [currentPage, experienceStarted])

  useEffect(() => {
    return () => { getAudioManager().stopAll() }
  }, [])

  return null
}