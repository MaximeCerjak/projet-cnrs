'use client'

/**
 * useAudio — Hook d'accès à l'AudioManager depuis les composants React.
 *
 * Usage :
 *   const audio = useAudio()
 *   await audio.startMuseeLoop()
 *   audio.fadeMusee(0, 2000)
 *
 * L'AudioContext est initialisé au premier appel de getContext(),
 * ce qui doit se produire dans un handler de geste utilisateur.
 * StartScreen appelle audio.getContext() au clic pour débloquer l'audio.
 */

import { getAudioManager } from '@/app/lib/audio/audioManager'

export function useAudio() {
  return getAudioManager()
}