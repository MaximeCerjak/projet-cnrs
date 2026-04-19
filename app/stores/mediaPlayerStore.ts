import { create } from 'zustand'
import type { MediaPlayerHandle } from '@/app/components/ui/MediaPlayer'

interface MediaPlayerStore {
  player: MediaPlayerHandle | null
  setPlayer: (player: MediaPlayerHandle | null) => void
}

export const useMediaPlayerStore = create<MediaPlayerStore>(set => ({
  player:    null,
  setPlayer: (player) => set({ player }),
}))