/**
 * audioManager.ts — Singleton AudioManager
 *
 * Gestion centralisée de tous les sons via Web Audio API.
 * Portage fidèle de AudioManager.js.
 *
 * Usage depuis n'importe quel composant :
 *   import { getAudioManager } from '@/app/lib/audio/audioManager'
 *   const audio = getAudioManager()
 *   await audio.startMuseeLoop()
 *   audio.fadeMusee(0, 2000)
 *
 * Le singleton est créé une seule fois au premier appel de getAudioManager().
 * L'AudioContext n'est créé qu'au premier geste utilisateur (StartScreen click).
 */

import { GLOBAL_CONFIG } from '@/app/lib/config/global'

interface Track {
  src:  AudioBufferSourceNode | null
  gain: GainNode | null
}

type TrackName = 'musee' | 'phreno' | 'sanza' | 'silence' | 'collab'

class AudioManager {
  private ctx:    AudioContext | null = null
  private tracks: Record<TrackName, Track> = {
    musee:   { src: null, gain: null },
    phreno:  { src: null, gain: null },
    sanza:   { src: null, gain: null },
    silence: { src: null, gain: null },
    collab:  { src: null, gain: null },
  }

  // ── Contexte Web Audio ────────────────────────────────────────────────────

  getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    if (this.ctx.state === 'suspended') this.ctx.resume()
    return this.ctx
  }

  /** Alias pour MediaPlayer (analyse waveform) */
  getAudioContext(): AudioContext {
    return this.getContext()
  }

  async loadBuffer(url: string): Promise<AudioBuffer | null> {
    const ctx = this.getContext()
    try {
      const response    = await fetch(url)
      const arrayBuffer = await response.arrayBuffer()
      return await ctx.decodeAudioData(arrayBuffer)
    } catch (e) {
      console.error('[AudioManager] Load failed:', url, e)
      return null
    }
  }

  // ── Helpers privés ─────────────────────────────────────────────────────────

  private fade(gain: GainNode, toVolume: number, durationMs: number) {
    const ctx = this.getContext()
    gain.gain.cancelScheduledValues(ctx.currentTime)
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(toVolume, ctx.currentTime + durationMs / 1000)
  }

  private stopTrack(name: TrackName, fadeDurationMs: number) {
    const { src, gain } = this.tracks[name]
    if (!gain) return
    const ctx = this.getContext()
    const ms  = fadeDurationMs
    gain.gain.cancelScheduledValues(ctx.currentTime)
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + ms / 1000)
    // Reset immédiat pour éviter double-stop
    this.tracks[name] = { src: null, gain: null }
    setTimeout(() => { try { src?.stop() } catch (_) {} }, ms + 50)
  }

  private async startLoop(
    name: TrackName,
    url: string,
    volume: number,
    fadeInMs: number
  ): Promise<void> {
    if (this.tracks[name].src) return
    const ctx = this.getContext()
    const buf = await this.loadBuffer(url)
    if (!buf) return

    const src  = ctx.createBufferSource()
    const gain = ctx.createGain()
    src.buffer = buf
    src.loop   = true
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + fadeInMs / 1000)
    src.connect(gain)
    gain.connect(ctx.destination)
    src.start()
    src.onended = () => {
      if (this.tracks[name].src === src) this.tracks[name] = { src: null, gain: null }
    }
    this.tracks[name] = { src, gain }
  }

  // ── Musée ──────────────────────────────────────────────────────────────────

  async startMuseeLoop(): Promise<void> {
    const A = GLOBAL_CONFIG.AUDIO
    await this.startLoop('musee', '/sons/MuseeLoop.mp3', A.musee_vol, A.musee_fade)
  }

  fadeMusee(toVolume: number, durationMs: number) {
    const { gain } = this.tracks.musee
    if (!gain) return
    this.fade(gain, toVolume, durationMs)
  }

  /** Coupe instantanément le musée sans fade */
  hardMuseeMute() {
    const { gain } = this.tracks.musee
    if (!gain) return
    const ctx = this.getContext()
    gain.gain.cancelScheduledValues(ctx.currentTime)
    gain.gain.setValueAtTime(0, ctx.currentTime)
  }

  // ── Phrénologie ────────────────────────────────────────────────────────────

  async playPhrenoSound(): Promise<AudioBufferSourceNode | null> {
    const ctx = this.getContext()
    const A   = GLOBAL_CONFIG.AUDIO
    const buf = await this.loadBuffer('/sons/S-phrenologie.mp3')
    if (!buf) return null

    this.fadeMusee(0, A.musee_fade)

    const src  = ctx.createBufferSource()
    const gain = ctx.createGain()
    src.buffer = buf
    src.loop   = false
    const dur  = buf.duration

    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + A.phren_fade_in / 1000)
    const fadeOutStart = Math.max(A.phren_fade_in / 1000, dur - A.phren_fade_out / 1000)
    gain.gain.setValueAtTime(1.0, ctx.currentTime + fadeOutStart)
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + dur)

    src.connect(gain)
    gain.connect(ctx.destination)
    src.start()

    src.onended = () => {
      if (this.tracks.phreno.src === src) this.tracks.phreno = { src: null, gain: null }
    }
    this.tracks.phreno = { src, gain }
    return src
  }

  stopPhrenoSound() {
    const { src } = this.tracks.phreno
    if (src) {
      try { src.onended = null; src.stop() } catch (_) {}
      this.tracks.phreno = { src: null, gain: null }
    }
    this.fadeMusee(GLOBAL_CONFIG.AUDIO.musee_vol, GLOBAL_CONFIG.AUDIO.musee_fade)
  }

  // ── Sanza (buste) ──────────────────────────────────────────────────────────

  async startSanzaLoop(): Promise<void> {
    const A = GLOBAL_CONFIG.AUDIO
    await this.startLoop('sanza', '/sons/buste.mp3', A.sanza_vol, A.sanza_fade_in)
  }

  stopSanzaLoop(fadeDurationMs?: number) {
    this.stopTrack('sanza', fadeDurationMs ?? GLOBAL_CONFIG.AUDIO.sanza_fade_out)
  }

  // ── Silence ────────────────────────────────────────────────────────────────

  async startSilenceLoop(): Promise<void> {
    const A = GLOBAL_CONFIG.AUDIO
    await this.startLoop('silence', '/sons/Sanza.mp3', A.silence_vol, A.silence_fade_in)
  }

  stopSilenceLoop(fadeDurationMs?: number) {
    this.stopTrack('silence', fadeDurationMs ?? GLOBAL_CONFIG.AUDIO.silence_fade_out)
  }

  // ── Collaboration ──────────────────────────────────────────────────────────

  async startCollabLoop(): Promise<void> {
    const A = GLOBAL_CONFIG.AUDIO
    await this.startLoop('collab', '/sons/collaboration.mp3', A.collab_vol, A.collab_fade_in)
  }

  stopCollabLoop(fadeDurationMs?: number) {
    this.stopTrack('collab', fadeDurationMs ?? GLOBAL_CONFIG.AUDIO.collab_fade_out)
  }

  // ── Utilitaires ────────────────────────────────────────────────────────────

  stopAll() {
    this.stopPhrenoSound()
    this.stopSanzaLoop()
    this.stopSilenceLoop()
    this.stopCollabLoop()
  }

  isMuseeRunning(): boolean {
    return !!this.tracks.musee.src
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────────

let instance: AudioManager | null = null

export function getAudioManager(): AudioManager {
  if (!instance) instance = new AudioManager()
  return instance
}