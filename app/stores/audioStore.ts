import { create } from 'zustand'

type AudioTrack = 'musee' | 'phren' | 'sanza' | 'silence' | 'collab' | null

interface AudioState {
  audioCtx:     AudioContext | null
  activeTrack:  AudioTrack
  setAudioCtx:  (ctx: AudioContext) => void
  setActiveTrack: (track: AudioTrack) => void
}

export const useAudioStore = create<AudioState>((set) => ({
  audioCtx:     null,
  activeTrack:  null,
  setAudioCtx:  (ctx)   => set({ audioCtx: ctx }),
  setActiveTrack: (track) => set({ activeTrack: track }),
}))