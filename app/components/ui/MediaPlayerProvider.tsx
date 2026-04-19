'use client'

/**
 * MediaPlayerProvider — Monte MediaPlayer et enregistre son handle dans le store.
 * À placer dans le layout. Tout composant peut ensuite faire :
 *   const { player } = useMediaPlayerStore()
 *   player?.open(src, label)
 */

import { useEffect, useRef } from 'react'
import MediaPlayer, { type MediaPlayerHandle } from '@/app/components/ui/MediaPlayer'
import { useMediaPlayerStore } from '@/app/stores/mediaPlayerStore'

export default function MediaPlayerProvider() {
  const ref      = useRef<MediaPlayerHandle>(null)
  const setPlayer = useMediaPlayerStore(s => s.setPlayer)

  useEffect(() => {
    setPlayer(ref.current)
    return () => setPlayer(null)
  }, [setPlayer])

  return <MediaPlayer ref={ref} />
}