'use client'

/**
 * MediaPlayer — Lecteur audio/vidéo avec UI SVG.
 *
 * API impérative inchangée :
 *   playerRef.current.open(src, label)
 *   playerRef.current.close()
 *   playerRef.current.forceClose()
 *   playerRef.current.setOnClose(fn)
 *   playerRef.current.isActive()
 *   playerRef.current.resize()
 */

import {
  useImperativeHandle, useRef, forwardRef, useEffect,
  useState, useCallback,
} from 'react'
import { GLOBAL_CONFIG } from '@/app/lib/config/global'
import { getAudioManager } from '@/app/lib/audio/audioManager'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MediaPlayerHandle {
  open:       (src: string, label: string) => void
  close:      () => void
  forceClose: () => void
  setOnClose: (fn: ((prevTitle: string | null) => void) | null) => void
  isActive:   () => boolean
  resize:     () => void
}

// ── Web Component : <audio-waveform> ──────────────────────────────────────────
// Encapsule entièrement le canvas + boucle RAF.
// Usage : <audio-waveform /> puis waveformEl.setAnalyser(node) / .start() / .stop()

// ── Interface du Web Component ────────────────────────────────────────────────

interface AudioWaveformElement extends HTMLElement {
  setAnalyser: (node: AnalyserNode) => void
  start:       () => void
  stop:        () => void
  resize:      () => void
}

function registerWaveformComponent() {
  if (typeof window === 'undefined' || customElements.get('audio-waveform')) return

  class AudioWaveform extends HTMLElement {
    private canvas:   HTMLCanvasElement
    private analyser: AnalyserNode | null = null
    private raf:      number | null       = null
    constructor() {
      super()
      const shadow = this.attachShadow({ mode: 'open' })
      this.canvas  = document.createElement('canvas')
      this.canvas.style.cssText = 'width:100%;height:100%;display:block;'
      shadow.appendChild(this.canvas)
    }

    connectedCallback() {
      this.resize()
    }

    resize() {
      const rect = this.getBoundingClientRect()
      if (rect.width > 0)  this.canvas.width  = Math.round(rect.width)
      if (rect.height > 0) this.canvas.height = Math.round(rect.height)
    }

    setAnalyser(node: AnalyserNode) {
      this.analyser = node
    }

    start() {
      if (!this.raf) this.loop()
    }

    stop() {
      if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null }
      const ctx = this.canvas.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    }

    private loop = () => {
      this.raf = requestAnimationFrame(this.loop)
      if (!this.analyser) return
      const W   = this.canvas.width
      const H   = this.canvas.height
      const ctx = this.canvas.getContext('2d')
      if (!ctx || W < 2 || H < 2) return

      const buf = new Uint8Array(this.analyser.frequencyBinCount)
      this.analyser.getByteTimeDomainData(buf)

      ctx.clearRect(0, 0, W, H)
      ctx.lineWidth   = GLOBAL_CONFIG.PLAYER.wave_width
      ctx.strokeStyle = GLOBAL_CONFIG.PLAYER.wave_color
      ctx.beginPath()

      const slice = W / buf.length
      let x = 0
      for (let i = 0; i < buf.length; i++) {
        const y = (buf[i] / 128) * (H / 2)
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        x += slice
      }
      ctx.lineTo(W, H / 2)
      ctx.stroke()
    }
  }

  customElements.define('audio-waveform', AudioWaveform)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function vW() { return Math.max(GLOBAL_CONFIG.MIN_SIZE.width,  window.innerWidth) }
function vH() { return Math.max(GLOBAL_CONFIG.MIN_SIZE.height, window.innerHeight) }
function isVideo(src: string) { return /\.(mp4|mov|webm)$/i.test(src) }

function useViewport() {
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    const onResize = () => forceUpdate(n => n + 1)
    window.addEventListener('resize', onResize)
    document.addEventListener('fullscreenchange', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      document.removeEventListener('fullscreenchange', onResize)
    }
  }, [])
}

function getArrowSz() {
  const A = GLOBAL_CONFIG.ARROW
  return Math.round(Math.max(A.size_min, Math.min(A.size_max, Math.min(vW(), vH()) * A.size_vh / 100)))
}

function getAudioRect() {
  const P = GLOBAL_CONFIG.PLAYER, W = vW(), H = vH()
  let rw = W * P.audio_w, rh = H * P.audio_h
  if (rh > H * 0.24) rh = H * 0.24
  if (rw > W * 0.82) rw = W * 0.82
  return { rw, rh, rx: (W - rw) / 2, ry: (H - rh) / 2 }
}

function getVideoRect(frac: number) {
  const P = GLOBAL_CONFIG.PLAYER, W = vW(), H = vH()
  let rw = W * frac, rh = rw * P.video_ratio
  if (rh > H * 0.80) { rh = H * 0.80; rw = rh / P.video_ratio }
  if (rw < W * P.video_min_w) rw = W * P.video_min_w
  if (rw > W * P.video_max_w) rw = W * P.video_max_w
  return { rw, rh: rw * P.video_ratio, rx: (W - rw) / 2, ry: (H - rw * P.video_ratio) / 2 }
}

// ── Styles SVG partagés ───────────────────────────────────────────────────────

const GOLD_HOVER = 'rgba(255,220,120,1)'
const GOLD_GLOW  = 'drop-shadow(0 0 7px rgba(255,210,80,.80)) drop-shadow(0 0 20px rgba(255,170,30,.50))'

// ── Sous-composant : bouton SVG circulaire ─────────────────────────────────────

function CircleBtn({
  cx, cy, r, drawn = true,
  drawDelay = 0, drawDuration = 0.6,
  children, onClick, title,
}: {
  cx: number; cy: number; r: number
  drawn?:        boolean
  drawDelay?:    number
  drawDuration?: number
  children:   React.ReactNode
  onClick:    () => void
  title?:     string
}) {
  const P   = GLOBAL_CONFIG.PLAYER
  const per = Math.round(2 * Math.PI * r)
  const [hovered, setHovered] = useState(false)

  return (
    <g
      style={{ cursor: 'none' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      aria-label={title}
    >
      {/* Zone de clic invisible */}
      <circle cx={cx} cy={cy} r={r * 1.6} fill="transparent" />
      <g style={{ transform: `scale(${hovered ? 1.22 : 1})`, transformOrigin: `${cx}px ${cy}px`, transition: 'transform .35s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={hovered ? GOLD_HOVER : P.stroke}
          strokeWidth="1.2"
          strokeDasharray={per}
          strokeDashoffset={drawn ? 0 : per}
          style={{
            transition: `stroke-dashoffset ${drawDuration}s cubic-bezier(0.4,0,0.2,1) ${drawDelay}s, stroke .2s, filter .2s`,
            filter: hovered ? GOLD_GLOW : undefined,
          }}
        />
        {children}
      </g>
    </g>
  )
}

// ── Sous-composant : bouton fermeture ─────────────────────────────────────────

function CloseButton({ W, H, drawn, onClose }: { W: number; H: number; drawn: boolean; onClose: () => void }) {
  const P     = GLOBAL_CONFIG.PLAYER
  const sz    = getArrowSz()
  const r     = sz / 2
  const marR  = Math.round(W * 0.035)
  const marT  = Math.round(H * 0.035)
  const arm   = r * 0.46

  return (
    <svg
      width={sz} height={sz}
      style={{ position: 'absolute', right: marR, top: marT, zIndex: 32, overflow: 'visible' }}
    >
      <CircleBtn
        cx={r} cy={r} r={r - 1}
        drawn={drawn}
        drawDelay={P.draw_speed + P.close_delay}
        onClick={onClose}
        title="Fermer"
      >
        <g
          stroke={GLOBAL_CONFIG.PLAYER.stroke} strokeWidth="1.4" strokeLinecap="round"
          style={{ opacity: drawn ? 1 : 0, transition: `opacity 0.3s ease ${P.draw_speed + P.close_delay + 0.55}s` }}
        >
          <line x1={r - arm} y1={r - arm} x2={r + arm} y2={r + arm} />
          <line x1={r + arm} y1={r - arm} x2={r - arm} y2={r + arm} />
        </g>
      </CircleBtn>
    </svg>
  )
}

// ── Sous-composant : icône play/pause ─────────────────────────────────────────

function PlayPauseIcon({ cx, cy, r, playing }: { cx: number; cy: number; r: number; playing: boolean }) {
  const P   = GLOBAL_CONFIG.PLAYER
  const ic  = r * 0.42
  const prw = ic * 0.52
  const gap = ic * 0.34

  return (
    <>
      {/* Icône play */}
      <polygon
        points={`${cx - ic * 0.65},${cy - ic} ${cx - ic * 0.65},${cy + ic} ${cx + ic * 1.1},${cy}`}
        fill={P.btn_color}
        style={{ opacity: playing ? 0 : 1, transition: 'opacity 0.2s ease' }}
      />
      {/* Icône pause */}
      <g fill={P.btn_color} style={{ opacity: playing ? 1 : 0, transition: 'opacity 0.2s ease' }}>
        <rect x={cx - gap - prw} y={cy - ic} width={prw} height={ic * 2} />
        <rect x={cx + gap}       y={cy - ic} width={prw} height={ic * 2} />
      </g>
    </>
  )
}

// ── Sous-composant : icône expand/collapse ────────────────────────────────────

function ExpandIcon({ cx, cy, r, expanded }: { cx: number; cy: number; r: number; expanded: boolean }) {
  const arm  = r * 0.38
  const dist = expanded ? r * 0.24 : r * 0.52
  const dirs: [number, number][] = [[-1,-1],[1,-1],[1,1],[-1,1]]

  return (
    <g stroke={GLOBAL_CONFIG.PLAYER.btn_color} strokeWidth="1.4" strokeLinecap="round" fill="none">
      {dirs.map(([sx, sy], i) => {
        const px = cx + sx * dist, py = cy + sy * dist
        return (
          <path
            key={i}
            d={`M${px},${py + sy * arm} L${px},${py} L${px + sx * arm},${py}`}
            style={{ transition: 'all 0.3s ease' }}
          />
        )
      })}
    </g>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────

const MediaPlayer = forwardRef<MediaPlayerHandle>((_, ref) => {
  useViewport()

  // ── State ──
  const [active,   setActive]   = useState(false)
  const [src,      setSrc]      = useState<string | null>(null)
  const [playing,  setPlaying]  = useState(false)
  const [drawn,    setDrawn]    = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [vidFrac,  setVidFrac]  = useState<number>(GLOBAL_CONFIG.PLAYER.video_min_w)

  // ── Refs impératives (media + callbacks) ──
  const audioRef     = useRef<HTMLAudioElement>(null)
  const videoRef     = useRef<HTMLVideoElement>(null)
  const waveRef      = useRef<AudioWaveformElement | null>(null)  // audio-waveform custom element
  const onCloseRef   = useRef<((t: string | null) => void) | null>(null)
  const hoverTitle   = useRef<string | null>(null)
  const sessionId    = useRef(0)
  const scaleRaf     = useRef<number | null>(null)
  const vidFracRef   = useRef<number>(GLOBAL_CONFIG.PLAYER.video_min_w)

  // ── Web Component registration ──
  useEffect(() => { registerWaveformComponent() }, [])

  // ── Waveform : connexion AudioContext ──
  useEffect(() => {
    if (!active || !src || isVideo(src)) return
    const audio = audioRef.current
    if (!audio) return

    const ac       = getAudioManager().getAudioContext()
    const source   = ac.createMediaElementSource(audio)
    const analyser = ac.createAnalyser()
    analyser.fftSize = 2048
    source.connect(analyser)
    analyser.connect(ac.destination)

    waveRef.current?.setAnalyser(analyser)

    return () => {
      try { source.disconnect() } catch (_) {}
    }
  }, [active, src])

  // ── Sync waveform play/pause ──
  useEffect(() => {
    playing ? waveRef.current?.start() : waveRef.current?.stop()
  }, [playing])

  // ── Resize waveform sur changement de viewport ──
  useEffect(() => {
    waveRef.current?.resize()
  })

  // ── Seek vidéo ──
  const [seekRatio, setSeekRatio] = useState(0)
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const update = () => {
      const r = isFinite(video.duration) && video.duration > 0
        ? Math.max(0, Math.min(1, video.currentTime / video.duration)) : 0
      setSeekRatio(r)
    }
    video.addEventListener('timeupdate', update)
    video.addEventListener('loadedmetadata', update)
    return () => { video.removeEventListener('timeupdate', update); video.removeEventListener('loadedmetadata', update) }
  }, [active, src])

  // ── Expand animation ──
  const applyExpand = useCallback((toExpanded: boolean) => {
    const P     = GLOBAL_CONFIG.PLAYER
    const start = vidFracRef.current
    const end   = toExpanded ? P.video_max_w : P.video_min_w
    setExpanded(toExpanded)

    if (scaleRaf.current) cancelAnimationFrame(scaleRaf.current)
    const t0   = performance.now()
    const pow  = P.video_scale_ease_power
    const dur  = P.video_scale_duration_ms

    const step = (now: number) => {
      const p = Math.min((now - t0) / dur, 1)
      const e = 1 - Math.pow(1 - p, pow)
      const f = start + (end - start) * e
      vidFracRef.current = f
      setVidFrac(f)
      if (p < 1) scaleRaf.current = requestAnimationFrame(step)
      else { vidFracRef.current = end; scaleRaf.current = null }
    }
    scaleRaf.current = requestAnimationFrame(step)
  }, [])

  // ── open() ──
  const open = useCallback((newSrc: string, label: string) => {
    ++sessionId.current
    hoverTitle.current = label

    getAudioManager().stopSanzaLoop(GLOBAL_CONFIG.AUDIO.sanza_fade_out)

    setSrc(newSrc)
    setActive(true)
    setPlaying(false)
    setDrawn(false)
    setExpanded(false)
    setVidFrac(GLOBAL_CONFIG.PLAYER.video_min_w)
    vidFracRef.current = GLOBAL_CONFIG.PLAYER.video_min_w
    setSeekRatio(0)

    // Déclenche l'animation d'apparition
    requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)))

    // Autoplay après montage
    requestAnimationFrame(() => requestAnimationFrame(() => {
      audioRef.current?.play().catch(() => {})
      videoRef.current?.play().catch(() => {})
    }))
  }, [])

  // ── cinematicClose() ──
  const cinematicClose = useCallback(() => {
    const sid = ++sessionId.current
    setDrawn(false)
    audioRef.current?.pause()
    videoRef.current?.pause()
    if (scaleRaf.current) { cancelAnimationFrame(scaleRaf.current); scaleRaf.current = null }

    const P = GLOBAL_CONFIG.PLAYER
    setTimeout(() => {
      if (sid !== sessionId.current) return
      setActive(false)
      setSrc(null)
      setPlaying(false)

      const fsBtn = document.getElementById('fs-btn')
      if (fsBtn) fsBtn.style.opacity = '0.85'

      const prev = hoverTitle.current
      hoverTitle.current = null
      onCloseRef.current?.(prev)

      if (!document.querySelector('.hotspot-zone:hover')) {
        document.getElementById('hover-title')?.classList.remove('visible')
      }
    }, P.fade_out_ms + 40)
  }, [])

  // ── forceClose() ──
  const forceClose = useCallback(() => {
    ++sessionId.current
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = '' }
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.src = '' }
    if (scaleRaf.current) { cancelAnimationFrame(scaleRaf.current); scaleRaf.current = null }
    setActive(false)
    setSrc(null)
    setPlaying(false)
    setDrawn(false)
    hoverTitle.current = null
    onCloseRef.current?.(null)
  }, [])

  // ── API impérative ──
  useImperativeHandle(ref, () => ({
    open,
    close:      () => cinematicClose(),
    forceClose: () => forceClose(),
    setOnClose: (fn) => { onCloseRef.current = fn },
    isActive:   () => active,
    resize:     () => { waveRef.current?.resize() },
  }), [open, cinematicClose, forceClose, active])

  // ── Render ──
  if (!active || !src) return null

  const P   = GLOBAL_CONFIG.PLAYER
  const vid = isVideo(src)
  const W   = vW(), H = vH()

  const { rw, rh, rx, ry } = vid ? getVideoRect(vidFrac) : getAudioRect()
  const perim = 2 * (rw + rh)

  // Layout vidéo — calculé une seule fois, partagé entre SVG / video / seekWrap
  const vl = vid ? (() => {
    const ctrlH   = rh * P.video_ctrl_h
    const vidH    = rh - ctrlH
    const bR      = ctrlH * 0.30
    const bCY     = ry + vidH + ctrlH * 0.5
    const sidePad = rw * 0.03
    const leftCX  = rx + sidePad + bR
    const rightCX = rx + rw - sidePad - bR
    const seekX1  = leftCX + bR + rw * 0.05
    const seekX2  = rightCX - bR - rw * 0.05
    const inset   = Math.max(1, Math.round(Math.min(W, H) * P.media_inset))
    const swH     = ctrlH * P.video_seek_h
    return { ctrlH, vidH, bR, bCY, leftCX, rightCX, seekX1, seekX2, inset, swH,
             sepY: ry + vidH, seekX: seekX1 + (seekX2 - seekX1) * seekRatio }
  })() : null

  // ── Fade-out container ──
  // Le wrapper clip isole le translateY dans overflow:hidden pour éviter
  // l'apparition des scrollbars pendant le fade-out.
  const clipStyle: React.CSSProperties = {
    position:      'absolute',
    inset:          0,
    zIndex:         30,
    overflow:      'hidden',
    pointerEvents: drawn ? 'auto' : 'none',
  }

  const containerStyle: React.CSSProperties = {
    position:   'absolute',
    inset:       0,
    transition: `opacity ${P.fade_out_ms}ms cubic-bezier(0.4,0,0.2,1), transform ${P.fade_out_ms}ms cubic-bezier(0.4,0,0.2,1)`,
    opacity:    drawn ? 1 : 0,
    transform:  drawn ? 'translateY(0px)' : `translateY(${P.fade_out_y}px)`,
  }

  return (
    <div style={clipStyle}>
    <div style={containerStyle}>

      {/* ── SVG principal (cadre + contrôles) ── */}
      <svg
        width="100%" height="100%"
        style={{ position: 'absolute', inset: 0, zIndex: 30, pointerEvents: 'none', overflow: 'visible' }}
      >
        {/* Fond semi-transparent */}
        <rect
          x={rx} y={ry} width={rw} height={rh}
          fill={`rgba(0,0,0,${vid ? P.video_bg_opacity : P.audio_bg_opacity})`}
        />

        {/* Cadre animé */}
        <rect
          x={rx} y={ry} width={rw} height={rh}
          fill="none"
          stroke={P.stroke} strokeWidth="1.2"
          strokeDasharray={perim}
          strokeDashoffset={drawn ? 0 : perim}
          style={{ transition: `stroke-dashoffset ${P.draw_speed}s cubic-bezier(0.4,0,0.2,1)` }}
        />

        {/* ── Contrôles audio ── */}
        {!vid && (() => {
          const bR  = rh * 0.28
          const bCX = rx + rh * 0.5
          const bCY = ry + rh * 0.5
          return (
            <CircleBtn
              cx={bCX} cy={bCY} r={bR}
              drawn={drawn} drawDelay={P.draw_speed * 0.4}
              onClick={() => {
                const a = audioRef.current
                if (!a) return
                a.paused ? a.play().catch(() => {}) : a.pause()
              }}
              title="Lecture / Pause"
            >
              <PlayPauseIcon cx={bCX} cy={bCY} r={bR} playing={playing} />
            </CircleBtn>
          )
        })()}

        {/* ── Contrôles vidéo ── */}
        {vid && vl && (() => {
          const { sepY, bR, bCY, leftCX, rightCX, seekX1, seekX2, seekX } = vl

          return (<>
            {/* Séparateur */}
            <line
              x1={rx} y1={sepY} x2={rx + rw} y2={sepY}
              stroke={P.stroke} strokeWidth="0.8" opacity="0.6"
              style={{ opacity: drawn ? 0.6 : 0, transition: 'opacity 0.4s ease' }}
            />

            {/* Play/pause */}
            <CircleBtn
              cx={leftCX} cy={bCY} r={bR}
              drawn={drawn} drawDelay={P.draw_speed * 0.4}
              onClick={() => {
                const v = videoRef.current
                if (!v) return
                v.paused ? v.play().catch(() => {}) : v.pause()
              }}
              title="Lecture / Pause"
            >
              <PlayPauseIcon cx={leftCX} cy={bCY} r={bR} playing={playing} />
            </CircleBtn>

            {/* Seek bar — base */}
            <line
              x1={seekX1} y1={bCY} x2={seekX2} y2={bCY}
              stroke={P.stroke} strokeWidth={P.video_seek_thick}
              strokeLinecap="round" opacity="0.3"
            />
            {/* Seek bar — progression */}
            <line
              x1={seekX1} y1={bCY} x2={seekX} y2={bCY}
              stroke={P.stroke} strokeWidth={P.video_seek_thick}
              strokeLinecap="round"
            />

            {/* Bouton expand */}
            <CircleBtn
              cx={rightCX} cy={bCY} r={bR}
              drawn={drawn} drawDelay={P.draw_speed * 0.5}
              onClick={() => applyExpand(!expanded)}
              title={expanded ? 'Réduire' : 'Agrandir'}
            >
              <ExpandIcon cx={rightCX} cy={bCY} r={bR} expanded={expanded} />
            </CircleBtn>
          </>)
        })()}
      </svg>

      {/* ── Bouton fermeture ── */}
      <CloseButton W={W} H={H} drawn={drawn} onClose={cinematicClose} />

      {/* ── Waveform audio (Web Component) ── */}
      {!vid && (
        // @ts-expect-error — custom element
        <audio-waveform
          ref={waveRef}
          style={{
            position: 'absolute',
            left:    rx + rh + rh * P.audio_wave_gap,
            top:     ry + rh * (1 - P.audio_wave_h) / 2,
            width:   rw - rh - rh * P.audio_wave_gap * 2,
            height:  rh * P.audio_wave_h,
            zIndex:  31,
            opacity: drawn ? 1 : 0,
            transition: `opacity 0.5s ease ${P.draw_speed + 0.2}s`,
          }}
        />
      )}

      {/* ── Élément vidéo ── */}
      {vid && vl && (() => {
        const { vidH, inset } = vl
        return (
          <video
            ref={videoRef}
            src={src}
            crossOrigin="anonymous"
            playsInline
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => { setPlaying(false); setTimeout(cinematicClose, 600) }}
            onClick={() => { const v = videoRef.current; if (!v) return; v.paused ? v.play().catch(() => {}) : v.pause() }}
            style={{
              position: 'absolute',
              left:     rx + inset,
              top:      ry + inset,
              width:    Math.max(2, rw - inset * 2),
              height:   Math.max(2, vidH - inset),
              zIndex:   31,
              objectFit: 'contain',
              background: '#000',
              cursor: 'none',
            }}
          />
        )
      })()}

      {/* ── Élément audio (invisible) ── */}
      {!vid && (
        <audio
          ref={audioRef}
          src={src}
          crossOrigin="anonymous"
          preload="auto"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => { setPlaying(false); setTimeout(cinematicClose, 400) }}
        />
      )}

      {/* ── Zone de seek vidéo (hit area) ── */}
      {vid && vl && (() => {
        const { bCY, seekX1, seekX2, swH } = vl
        return (
          <div
            style={{
              position: 'absolute', zIndex: 34, cursor: 'none',
              left: seekX1, top: bCY - swH * 2.5,
              width: seekX2 - seekX1, height: swH * 5,
            }}
            onClick={e => {
              const rect  = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
              const v     = videoRef.current
              if (v && isFinite(v.duration) && v.duration > 0) v.currentTime = v.duration * ratio
            }}
          />
        )
      })()}

    </div>
    </div>
  )
})

MediaPlayer.displayName = 'MediaPlayer'
export default MediaPlayer