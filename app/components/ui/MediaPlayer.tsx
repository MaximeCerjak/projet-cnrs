'use client'
// @ts-nocheck

/**
 * MediaPlayer — Lecteur audio/vidéo avec UI SVG.
 * Portage fidèle de MediaPlayer.js.
 *
 * Exposé via ref impératif :
 *   playerRef.current.open(src, label)
 *   playerRef.current.close()
 *   playerRef.current.setOnClose(fn)
 *   playerRef.current.isActive()
 */

import { useImperativeHandle, useRef, forwardRef, useEffect } from 'react'
import { GLOBAL_CONFIG } from '@/app/lib/config/global'
import { getAudioManager } from '@/app/lib/audio/audioManager'

export interface MediaPlayerHandle {
  open:       (src: string, label: string) => void
  close:      () => void
  forceClose: () => void
  setOnClose: (fn: ((prevTitle: string | null) => void) | null) => void
  isActive:   () => boolean
  resize:     () => void
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function vW() { return Math.max(GLOBAL_CONFIG.MIN_SIZE.width,  window.innerWidth) }
function vH() { return Math.max(GLOBAL_CONFIG.MIN_SIZE.height, window.innerHeight) }
function isVideo(src: string) { return /\.mp4$/i.test(src) }

function getArrowSizePx() {
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
  rh = rw * P.video_ratio
  return { rw, rh, rx: (W - rw) / 2, ry: (H - rh) / 2 }
}

// ── Composant ──────────────────────────────────────────────────────────────────

const MediaPlayer = forwardRef<MediaPlayerHandle>((_, ref) => {
  const elRef = useRef<HTMLDivElement>(null)

  // État interne (pas de state React — tout impératif)
  const s = useRef({
    active:           false,
    src:              null as string | null,
    torchBefore:      0,
    playerHoverTitle: null as string | null,
    closeSessionId:   0,
    onClose:          null as ((t: string | null) => void) | null,
    videoLayout:      null as { videoWidthFrac: number; targetWidthFrac: number; isExpanded: boolean } | null,
    // Refs SVG/DOM
    mainSvg:          null as SVGSVGElement | null,
    rect:             null as SVGRectElement | null,
    closeSvg:         null as SVGSVGElement | null,
    closeGroup:       null as SVGGElement | null,
    closeCirc:        null as SVGCircleElement | null,
    closeCross:       null as SVGGElement | null,
    closeHit:         null as HTMLDivElement | null,
    playerAudio:      null as HTMLAudioElement | null,
    playerVideo:      null as HTMLVideoElement | null,
    waveCanvas:       null as HTMLCanvasElement | null,
    playHit:          null as HTMLDivElement | null,
    playCircle:       null as SVGCircleElement | null,
    playIcon:         null as SVGElement | null,
    pauseIcon:        null as SVGGElement | null,
    videoScaleBtn:    null as HTMLDivElement | null,
    videoScaleCirc:   null as SVGCircleElement | null,
    videoScaleIcon:   null as SVGGElement | null,
    videoSeekWrap:    null as HTMLDivElement | null,
    videoSeekBase:    null as SVGLineElement | null,
    videoSeekFill:    null as SVGLineElement | null,
    videoSepLine:     null as SVGLineElement | null,
    analyser:         null as AnalyserNode | null,
    waveRaf:          null as number | null,
    videoScaleAnimRaf: null as number | null,
    resizeRaf:        null as number | null,
  })

  // ── open() ───────────────────────────────────────────────────────────────────

  function open(src: string, label: string) {
    const st = s.current
    ++st.closeSessionId
    if (st.active) forceClose()

    const audio = getAudioManager()
    audio.stopSanzaLoop(GLOBAL_CONFIG.AUDIO.sanza_fade_out)

    st.active = true
    st.src    = src

    const el = elRef.current; if (!el) return
    const P  = GLOBAL_CONFIG.PLAYER
    const W  = vW(), H = vH()
    const ns = 'http://www.w3.org/2000/svg'
    const vid = isVideo(src)

    st.videoLayout = vid
      ? { videoWidthFrac: P.video_min_w, targetWidthFrac: P.video_min_w, isExpanded: false }
      : null

    // Torche — dim pendant lecture
    // (intégration TorchSystem à brancher via callback si nécessaire)

    const { rw, rh, rx, ry } = vid
      ? getVideoRect(st.videoLayout!.videoWidthFrac)
      : getAudioRect()

    el.innerHTML = ''
    el.style.pointerEvents = 'auto'

    // Backdrop
    const backdrop = document.createElement('div')
    backdrop.style.cssText = 'position:absolute;inset:0;z-index:29;pointer-events:none;'
    el.appendChild(backdrop)

    // SVG principal
    const svg = document.createElementNS(ns, 'svg')
    svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%')
    svg.style.cssText = 'position:absolute;inset:0;z-index:30;pointer-events:none;'
    st.mainSvg = svg

    const perim = 2 * (rw + rh)
    const rect  = document.createElementNS(ns, 'rect')
    rect.setAttribute('x', String(rx)); rect.setAttribute('y', String(ry))
    rect.setAttribute('width', String(rw)); rect.setAttribute('height', String(rh))
    rect.setAttribute('fill', `rgba(0,0,0,${vid ? P.video_bg_opacity : P.audio_bg_opacity})`)
    rect.setAttribute('stroke', P.stroke); rect.setAttribute('stroke-width', '1.2')
    rect.style.strokeDasharray = String(perim); rect.style.strokeDashoffset = String(perim)
    rect.style.transition = `stroke-dashoffset ${P.draw_speed}s cubic-bezier(0.4,0,0.2,1)`
    svg.appendChild(rect); el.appendChild(svg)
    st.rect = rect

    // Bouton fermeture
    buildCloseButton(el, W, H, P, ns)

    requestAnimationFrame(() => requestAnimationFrame(() => {
      rect.style.strokeDashoffset = '0'
      if (st.closeCirc) st.closeCirc.style.strokeDashoffset = '0'
      if (st.closeCross) (st.closeCross as SVGGElement).style.opacity = '1'
    }))

    if (vid) buildVideoPlayer(el, src, rx, ry, rw, rh, ns)
    else     buildAudioPlayer(el, src, rx, ry, rw, rh, ns)
  }

  // ── Bouton fermeture ─────────────────────────────────────────────────────────

  function buildCloseButton(el: HTMLDivElement, W: number, H: number, P: typeof GLOBAL_CONFIG.PLAYER, ns: string) {
    const st     = s.current
    const cSz    = getArrowSizePx(), cR = cSz / 2
    const cMarR  = Math.round(W * 0.035), cMarT = Math.round(H * 0.035)
    const closeDelay = P.draw_speed + P.close_delay
    const cPer   = Math.round(2 * Math.PI * cR), csR = cR * 0.46
    const cx0 = cR, cy0 = cR

    const closeSvg = document.createElementNS(ns, 'svg')
    closeSvg.setAttribute('width', String(cSz)); closeSvg.setAttribute('height', String(cSz))
    closeSvg.setAttribute('overflow', 'visible')
    closeSvg.style.cssText = `position:absolute;z-index:32;pointer-events:none;right:${cMarR}px;top:${cMarT}px;width:${cSz}px;height:${cSz}px;`
    st.closeSvg = closeSvg

    const closeGroup = document.createElementNS(ns, 'g')
    closeGroup.style.transformOrigin = `${cx0}px ${cy0}px`
    closeGroup.style.transition = 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)'
    st.closeGroup = closeGroup

    const closeCirc = document.createElementNS(ns, 'circle')
    closeCirc.setAttribute('cx', String(cx0)); closeCirc.setAttribute('cy', String(cy0)); closeCirc.setAttribute('r', String(cR - 1))
    closeCirc.setAttribute('fill', 'none'); closeCirc.setAttribute('stroke', P.stroke); closeCirc.setAttribute('stroke-width', '1.2')
    closeCirc.style.strokeDasharray = String(cPer); closeCirc.style.strokeDashoffset = String(cPer)
    closeCirc.style.transition = `stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1) ${closeDelay}s, stroke 0.2s, filter 0.2s`
    st.closeCirc = closeCirc

    const cross = document.createElementNS(ns, 'g')
    cross.setAttribute('stroke', P.stroke); cross.setAttribute('stroke-width', '1.4'); cross.setAttribute('stroke-linecap', 'round')
    cross.style.opacity = '0'; cross.style.transition = `opacity 0.3s ease ${closeDelay + 0.55}s, stroke 0.2s, filter 0.2s`
    const l1 = document.createElementNS(ns, 'line')
    l1.setAttribute('x1', String(cx0 - csR)); l1.setAttribute('y1', String(cy0 - csR)); l1.setAttribute('x2', String(cx0 + csR)); l1.setAttribute('y2', String(cy0 + csR))
    const l2 = document.createElementNS(ns, 'line')
    l2.setAttribute('x1', String(cx0 + csR)); l2.setAttribute('y1', String(cy0 - csR)); l2.setAttribute('x2', String(cx0 - csR)); l2.setAttribute('y2', String(cy0 + csR))
    cross.appendChild(l1); cross.appendChild(l2)
    st.closeCross = cross

    closeGroup.appendChild(closeCirc); closeGroup.appendChild(cross)
    closeSvg.appendChild(closeGroup); el.appendChild(closeSvg)

    const closeHit = document.createElement('div')
    closeHit.dataset.clickable = '1'
    closeHit.style.cssText = `position:absolute;z-index:33;border-radius:50%;cursor:none;width:${cSz}px;height:${cSz}px;right:${cMarR}px;top:${cMarT}px;`
    closeHit.addEventListener('click', () => cinematicClose())
    closeHit.addEventListener('mouseenter', () => {
      closeGroup.style.transform = 'scale(1.22)'
      const glow = 'drop-shadow(0 0 7px rgba(255,210,80,0.80)) drop-shadow(0 0 20px rgba(255,170,30,0.50))'
      closeCirc.setAttribute('stroke', P.btn_color_hover); closeCirc.style.filter = glow
      cross.setAttribute('stroke', P.btn_color_hover);     cross.style.filter = glow
    })
    closeHit.addEventListener('mouseleave', () => {
      closeGroup.style.transform = 'scale(1)'
      closeCirc.setAttribute('stroke', P.stroke); closeCirc.style.filter = ''
      cross.setAttribute('stroke', P.stroke);     cross.style.filter = ''
    })
    el.appendChild(closeHit)
    st.closeHit = closeHit
  }

  // ── Audio player ─────────────────────────────────────────────────────────────

  function buildAudioPlayer(el: HTMLDivElement, src: string, rx: number, ry: number, rw: number, rh: number, ns: string) {
    const st = s.current
    const P  = GLOBAL_CONFIG.PLAYER

    const audio = new Audio(src)
    audio.crossOrigin = 'anonymous'
    audio.preload = 'auto'
    st.playerAudio = audio

    const btnZoneW = rh, bR = rh * 0.28
    const bCX = rx + btnZoneW * 0.5, bCY = ry + rh * 0.5
    const bPer = 2 * Math.PI * bR, btnDelay = P.draw_speed * 0.4
    const waveGap = rh * P.audio_wave_gap
    const waveX = rx + btnZoneW + waveGap
    const waveW = rw - btnZoneW - waveGap * 2
    const waveH = rh * P.audio_wave_h
    const waveY = ry + (rh - waveH) / 2

    const wc = document.createElement('canvas')
    wc.width  = Math.max(2, Math.round(waveW))
    wc.height = Math.max(2, Math.round(waveH))
    wc.style.cssText = `position:absolute;z-index:31;pointer-events:none;opacity:0;left:${waveX}px;top:${waveY}px;width:${waveW}px;height:${waveH}px;transition:opacity 0.5s ease ${P.draw_speed + 0.2}s;`
    el.appendChild(wc); st.waveCanvas = wc
    requestAnimationFrame(() => { wc.style.opacity = '1' })

    const bSvg = document.createElementNS(ns, 'svg')
    bSvg.setAttribute('width', '100%'); bSvg.setAttribute('height', '100%')
    bSvg.style.cssText = 'position:absolute;inset:0;z-index:33;pointer-events:none;'

    const bCirc = document.createElementNS(ns, 'circle')
    bCirc.setAttribute('cx', String(bCX)); bCirc.setAttribute('cy', String(bCY)); bCirc.setAttribute('r', String(bR))
    bCirc.setAttribute('fill', 'none'); bCirc.setAttribute('stroke', P.btn_color); bCirc.setAttribute('stroke-width', '1.0')
    bCirc.style.strokeDasharray = String(bPer); bCirc.style.strokeDashoffset = String(bPer)
    bCirc.style.transition = `stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1) ${btnDelay}s, stroke 0.2s, filter 0.2s`
    bSvg.appendChild(bCirc); st.playCircle = bCirc

    const ic = bR * 0.42
    const playIcon = document.createElementNS(ns, 'polygon')
    playIcon.setAttribute('points', `${bCX - ic * 0.65},${bCY - ic} ${bCX - ic * 0.65},${bCY + ic} ${bCX + ic * 1.1},${bCY}`)
    playIcon.setAttribute('fill', P.btn_color); playIcon.style.opacity = '0'
    playIcon.style.transition = 'opacity 0.2s ease, fill 0.2s, filter 0.2s'
    bSvg.appendChild(playIcon); st.playIcon = playIcon

    const pauseIcon = document.createElementNS(ns, 'g')
    pauseIcon.setAttribute('fill', P.btn_color); pauseIcon.style.opacity = '0'
    pauseIcon.style.transition = 'opacity 0.2s ease, fill 0.2s, filter 0.2s'
    const prw = ic * 0.52, gap = ic * 0.34
    const bar1 = document.createElementNS(ns, 'rect')
    bar1.setAttribute('x', String(bCX - gap - prw)); bar1.setAttribute('y', String(bCY - ic)); bar1.setAttribute('width', String(prw)); bar1.setAttribute('height', String(ic * 2))
    const bar2 = document.createElementNS(ns, 'rect')
    bar2.setAttribute('x', String(bCX + gap)); bar2.setAttribute('y', String(bCY - ic)); bar2.setAttribute('width', String(prw)); bar2.setAttribute('height', String(ic * 2))
    pauseIcon.appendChild(bar1); pauseIcon.appendChild(bar2)
    bSvg.appendChild(pauseIcon); st.pauseIcon = pauseIcon
    el.appendChild(bSvg)

    const btnHit = document.createElement('div')
    btnHit.dataset.clickable = '1'
    btnHit.style.cssText = `position:absolute;z-index:34;border-radius:50%;cursor:none;width:${bR * 3.2}px;height:${bR * 3.2}px;left:${bCX - bR * 1.6}px;top:${bCY - bR * 1.6}px;`
    el.appendChild(btnHit); st.playHit = btnHit

    const setPlaying = (on: boolean) => {
      playIcon.style.opacity  = on ? '0' : '1'
      pauseIcon.style.opacity = on ? '1' : '0'
    }

    btnHit.addEventListener('mouseenter', () => { bCirc.setAttribute('stroke', P.btn_color_hover); bCirc.style.filter = 'drop-shadow(0 0 6px rgba(255,210,80,0.8))'; playIcon.setAttribute('fill', P.btn_color_hover); pauseIcon.setAttribute('fill', P.btn_color_hover) })
    btnHit.addEventListener('mouseleave', () => { bCirc.setAttribute('stroke', P.btn_color); bCirc.style.filter = ''; playIcon.setAttribute('fill', P.btn_color); pauseIcon.setAttribute('fill', P.btn_color) })
    btnHit.addEventListener('click', async () => { if (audio.paused) { try { await audio.play() } catch (_) {} } else { audio.pause() } })

    requestAnimationFrame(() => requestAnimationFrame(() => { bCirc.style.strokeDashoffset = '0' }))

    const ac      = getAudioManager().getAudioContext()
    const source  = ac.createMediaElementSource(audio)
    const analyser = ac.createAnalyser()
    analyser.fftSize = 2048
    source.connect(analyser); analyser.connect(ac.destination)
    st.analyser = analyser

    audio.addEventListener('play',  () => { setPlaying(true);  drawWaveform(wc, analyser) })
    audio.addEventListener('pause', () => { setPlaying(false); if (st.waveRaf) { cancelAnimationFrame(st.waveRaf); st.waveRaf = null }; wc.getContext('2d')?.clearRect(0, 0, wc.width, wc.height) })
    audio.addEventListener('ended', () => { setPlaying(false); if (st.waveRaf) { cancelAnimationFrame(st.waveRaf); st.waveRaf = null }; wc.getContext('2d')?.clearRect(0, 0, wc.width, wc.height); setTimeout(() => cinematicClose(), 400) })

    requestAnimationFrame(() => requestAnimationFrame(async () => { try { await audio.play() } catch (_) {} }))
  }

  function drawWaveform(canvas: HTMLCanvasElement, analyser: AnalyserNode) {
    const st  = s.current
    const P   = GLOBAL_CONFIG.PLAYER
    const ctx = canvas.getContext('2d')!
    const buf = new Uint8Array(analyser.frequencyBinCount)
    const draw = () => {
      st.waveRaf = requestAnimationFrame(draw)
      analyser.getByteTimeDomainData(buf)
      const cW = canvas.width, cH = canvas.height
      ctx.clearRect(0, 0, cW, cH); ctx.beginPath()
      ctx.strokeStyle = P.wave_color; ctx.lineWidth = P.wave_width
      const step = cW / buf.length
      buf.forEach((v, i) => { const x = i * step, y = ((v / 128) - 1) * (cH * 0.42) + cH / 2; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y) })
      ctx.stroke()
    }
    draw()
  }

  // ── Video player ─────────────────────────────────────────────────────────────

  function buildVideoPlayer(el: HTMLDivElement, src: string, rx: number, ry: number, rw: number, rh: number, ns: string) {
    const st = s.current
    const P  = GLOBAL_CONFIG.PLAYER
    const W  = vW(), H = vH()
    const inset = Math.max(1, Math.round(Math.min(W, H) * P.media_inset))
    const ctrlH = rh * P.video_ctrl_h, vidH = rh - ctrlH, sepY = ry + vidH

    const video = document.createElement('video')
    video.src = src; video.preload = 'auto'; video.playsInline = true
    st.playerVideo = video
    video.style.cssText = `position:absolute;z-index:31;object-fit:contain;background:#000;opacity:0;transition:opacity 0.5s ease ${P.draw_speed + 0.2}s;left:${rx + inset}px;top:${ry + inset}px;width:${Math.max(2, rw - inset * 2)}px;height:${Math.max(2, vidH - inset)}px;`
    el.appendChild(video)
    requestAnimationFrame(() => { video.style.opacity = '1' })

    const cSvg = document.createElementNS(ns, 'svg')
    cSvg.setAttribute('width', '100%'); cSvg.setAttribute('height', '100%')
    cSvg.style.cssText = 'position:absolute;inset:0;z-index:33;pointer-events:none;'

    const sepLine = document.createElementNS(ns, 'line')
    sepLine.setAttribute('x1', String(rx)); sepLine.setAttribute('y1', String(sepY)); sepLine.setAttribute('x2', String(rx + rw)); sepLine.setAttribute('y2', String(sepY))
    sepLine.setAttribute('stroke', P.stroke); sepLine.setAttribute('stroke-width', '1')
    sepLine.style.opacity = '0'; sepLine.style.transition = `opacity 0.35s ease ${P.draw_speed + 0.15}s`
    cSvg.appendChild(sepLine); st.videoSepLine = sepLine

    const btnDelay = P.draw_speed * 0.5, sidePad = rw * 0.03, bR = ctrlH * 0.30
    const leftCX = rx + sidePad + bR, rightCX = rx + rw - sidePad - bR
    const bCY = ry + vidH + ctrlH * 0.5, bPer = 2 * Math.PI * bR

    // Bouton play/pause
    const playCirc = document.createElementNS(ns, 'circle')
    playCirc.setAttribute('cx', String(leftCX)); playCirc.setAttribute('cy', String(bCY)); playCirc.setAttribute('r', String(bR))
    playCirc.setAttribute('fill', 'none'); playCirc.setAttribute('stroke', P.btn_color); playCirc.setAttribute('stroke-width', '1.0')
    playCirc.style.strokeDasharray = String(bPer); playCirc.style.strokeDashoffset = String(bPer)
    playCirc.style.transition = `stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1) ${btnDelay}s, stroke 0.2s, filter 0.2s`
    cSvg.appendChild(playCirc); st.playCircle = playCirc

    const ic = bR * 0.38
    const playIcon = document.createElementNS(ns, 'polygon')
    playIcon.setAttribute('points', `${leftCX - ic * 0.7},${bCY - ic} ${leftCX - ic * 0.7},${bCY + ic} ${leftCX + ic * 1.1},${bCY}`)
    playIcon.setAttribute('fill', P.btn_color); playIcon.style.opacity = '0'
    playIcon.style.transition = 'opacity 0.2s ease, fill 0.2s'
    cSvg.appendChild(playIcon); st.playIcon = playIcon

    const pauseIcon = document.createElementNS(ns, 'g')
    pauseIcon.setAttribute('fill', P.btn_color); pauseIcon.style.opacity = '0'
    pauseIcon.style.transition = 'opacity 0.2s ease, fill 0.2s'
    const prw = ic * 0.52, gap2 = ic * 0.34
    const vb1 = document.createElementNS(ns, 'rect'); vb1.setAttribute('x', String(leftCX - gap2 - prw)); vb1.setAttribute('y', String(bCY - ic)); vb1.setAttribute('width', String(prw)); vb1.setAttribute('height', String(ic * 2))
    const vb2 = document.createElementNS(ns, 'rect'); vb2.setAttribute('x', String(leftCX + gap2)); vb2.setAttribute('y', String(bCY - ic)); vb2.setAttribute('width', String(prw)); vb2.setAttribute('height', String(ic * 2))
    pauseIcon.appendChild(vb1); pauseIcon.appendChild(vb2)
    cSvg.appendChild(pauseIcon); st.pauseIcon = pauseIcon

    // Bouton taille vidéo
    const sizeCirc = document.createElementNS(ns, 'circle')
    sizeCirc.setAttribute('cx', String(rightCX)); sizeCirc.setAttribute('cy', String(bCY)); sizeCirc.setAttribute('r', String(bR))
    sizeCirc.setAttribute('fill', 'none'); sizeCirc.setAttribute('stroke', P.btn_color); sizeCirc.setAttribute('stroke-width', '1.0')
    sizeCirc.style.strokeDasharray = String(bPer); sizeCirc.style.strokeDashoffset = String(bPer)
    sizeCirc.style.transition = `stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1) ${btnDelay}s, stroke 0.2s, filter 0.2s`
    cSvg.appendChild(sizeCirc); st.videoScaleCirc = sizeCirc

    const arm = bR * 0.38, offBig = bR * 0.52
    const cdefs: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
    const sizeGroup = document.createElementNS(ns, 'g')
    sizeGroup.style.opacity = '0'; sizeGroup.style.transition = 'opacity 0.15s ease'
    st.videoScaleIcon = sizeGroup
    cdefs.forEach(([sx, sy]) => {
      const p = document.createElementNS(ns, 'path')
      const px = rightCX + sx * offBig, py = bCY + sy * offBig
      p.setAttribute('d', `M${px},${py + sy * arm} L${px},${py} L${px + sx * arm},${py}`)
      p.setAttribute('fill', 'none'); p.setAttribute('stroke', P.btn_color)
      p.setAttribute('stroke-width', '1.5'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round')
      sizeGroup.appendChild(p)
    })
    cSvg.appendChild(sizeGroup)

    // Seek bar
    const seekX1 = leftCX + bR + rw * 0.05, seekX2 = rightCX - bR - rw * 0.05, seekY = bCY, seekWrapH = ctrlH * P.video_seek_h
    const seekBase = document.createElementNS(ns, 'line')
    seekBase.setAttribute('x1', String(seekX1)); seekBase.setAttribute('y1', String(seekY)); seekBase.setAttribute('x2', String(seekX2)); seekBase.setAttribute('y2', String(seekY))
    seekBase.setAttribute('stroke', 'rgba(255,255,255,0.28)'); seekBase.setAttribute('stroke-width', String(P.video_seek_thick)); seekBase.setAttribute('stroke-linecap', 'round')
    cSvg.appendChild(seekBase); st.videoSeekBase = seekBase

    const seekFill = document.createElementNS(ns, 'line')
    seekFill.setAttribute('x1', String(seekX1)); seekFill.setAttribute('y1', String(seekY)); seekFill.setAttribute('x2', String(seekX1)); seekFill.setAttribute('y2', String(seekY))
    seekFill.setAttribute('stroke', P.stroke); seekFill.setAttribute('stroke-width', String(P.video_seek_thick)); seekFill.setAttribute('stroke-linecap', 'round')
    cSvg.appendChild(seekFill); st.videoSeekFill = seekFill
    el.appendChild(cSvg)

    // Hit areas
    const playHit = document.createElement('div')
    playHit.dataset.clickable = '1'
    playHit.style.cssText = `position:absolute;z-index:34;border-radius:50%;cursor:none;width:${bR * 3.2}px;height:${bR * 3.2}px;left:${leftCX - bR * 1.6}px;top:${bCY - bR * 1.6}px;`
    el.appendChild(playHit); st.playHit = playHit

    const sizeHit = document.createElement('div')
    sizeHit.dataset.clickable = '1'
    sizeHit.style.cssText = `position:absolute;z-index:34;border-radius:50%;cursor:none;width:${bR * 3.2}px;height:${bR * 3.2}px;left:${rightCX - bR * 1.6}px;top:${bCY - bR * 1.6}px;transition:transform 0.35s cubic-bezier(0.22,1,0.36,1);`
    el.appendChild(sizeHit); st.videoScaleBtn = sizeHit

    const seekWrap = document.createElement('div')
    seekWrap.dataset.clickable = '1'
    seekWrap.style.cssText = `position:absolute;z-index:34;cursor:none;left:${seekX1}px;top:${seekY - seekWrapH * 2.5}px;width:${seekX2 - seekX1}px;height:${seekWrapH * 5}px;`
    el.appendChild(seekWrap); st.videoSeekWrap = seekWrap

    const setPlaying = (on: boolean) => { playIcon.style.opacity = on ? '0' : '1'; pauseIcon.style.opacity = on ? '1' : '0' }

    playHit.addEventListener('mouseenter', () => { playCirc.setAttribute('stroke', P.btn_color_hover); playCirc.style.filter = 'drop-shadow(0 0 6px rgba(255,210,80,0.8))'; playIcon.setAttribute('fill', P.btn_color_hover); pauseIcon.setAttribute('fill', P.btn_color_hover) })
    playHit.addEventListener('mouseleave', () => { playCirc.setAttribute('stroke', P.btn_color); playCirc.style.filter = ''; playIcon.setAttribute('fill', P.btn_color); pauseIcon.setAttribute('fill', P.btn_color) })
    playHit.addEventListener('click', async () => { if (video.paused) { try { await video.play() } catch (_) {} } else { video.pause() } })

    sizeHit.addEventListener('mouseenter', () => { sizeCirc.setAttribute('stroke', P.btn_color_hover); sizeCirc.style.filter = 'drop-shadow(0 0 8px rgba(255,210,80,0.9))'; sizeGroup.querySelectorAll('path').forEach(p => p.setAttribute('stroke', P.btn_color_hover)); sizeHit.style.transform = 'scale(1.12)' })
    sizeHit.addEventListener('mouseleave', () => { sizeCirc.setAttribute('stroke', P.btn_color); sizeCirc.style.filter = ''; sizeGroup.querySelectorAll('path').forEach(p => p.setAttribute('stroke', P.btn_color)); sizeHit.style.transform = 'scale(1)' })
    sizeHit.addEventListener('click', () => { sizeHit.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.14)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(0.22,1,0.36,1)' }); applyVideoScale() })

    seekWrap.addEventListener('click', e => {
      const r = seekWrap.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
      if (isFinite(video.duration) && video.duration > 0) { video.currentTime = video.duration * ratio; updateVideoSeekUI() }
    })

    video.addEventListener('timeupdate',     () => updateVideoSeekUI())
    video.addEventListener('loadedmetadata', () => updateVideoSeekUI())
    video.addEventListener('play',           () => setPlaying(true))
    video.addEventListener('pause',          () => setPlaying(false))
    video.addEventListener('ended',          () => { setPlaying(false); updateVideoSeekUI(); setTimeout(() => cinematicClose(), 600) })

    requestAnimationFrame(() => requestAnimationFrame(() => {
      playCirc.style.strokeDashoffset = '0'; sizeCirc.style.strokeDashoffset = '0'
      sepLine.style.opacity = '1'; playIcon.style.opacity = '1'; sizeGroup.style.opacity = '1'
    }))
    requestAnimationFrame(() => requestAnimationFrame(async () => { try { await video.play() } catch (_) {} }))
  }

  // ── Scale vidéo ───────────────────────────────────────────────────────────────

  function applyVideoScale() {
    const st = s.current
    if (!st.active || !st.videoLayout || !st.playerVideo) return
    const P = GLOBAL_CONFIG.PLAYER
    if (st.videoScaleAnimRaf) { cancelAnimationFrame(st.videoScaleAnimRaf); st.videoScaleAnimRaf = null }

    const start       = st.videoLayout.videoWidthFrac ?? P.video_min_w
    const nextExpanded = !st.videoLayout.isExpanded
    const end         = nextExpanded ? P.video_max_w : P.video_min_w
    st.videoLayout.isExpanded      = nextExpanded
    st.videoLayout.targetWidthFrac = end

    if (st.videoScaleIcon && st.videoScaleCirc) {
      const cx  = parseFloat(st.videoScaleCirc.getAttribute('cx') ?? '0')
      const cy  = parseFloat(st.videoScaleCirc.getAttribute('cy') ?? '0')
      const r   = parseFloat(st.videoScaleCirc.getAttribute('r')  ?? '0')
      const arm = r * 0.38, distBig = r * 0.52, distSmall = r * 0.24
      const dist = nextExpanded ? distSmall : distBig
      const cdefs: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
      Array.from(st.videoScaleIcon.querySelectorAll('path')).forEach((p, i) => {
        const [sx, sy] = cdefs[i]
        const px = cx + sx * dist, py = cy + sy * dist
        p.setAttribute('d', `M${px},${py + sy * arm} L${px},${py} L${px + sx * arm},${py}`)
      })
    }

    const hoverTitleEl = document.getElementById('hover-title')
    if (nextExpanded) {
      hoverTitleEl?.classList.remove('visible')
    } else if (st.playerHoverTitle && hoverTitleEl) {
      setTimeout(() => { if (st.active && st.playerHoverTitle) hoverTitleEl.classList.add('visible') }, 200)
    }

    const duration = P.video_scale_duration_ms, easePow = P.video_scale_ease_power
    const t0 = performance.now()
    const step = (now: number) => {
      if (!st.active || !st.videoLayout || !st.playerVideo) { st.videoScaleAnimRaf = null; return }
      const p = Math.min((now - t0) / duration, 1)
      const e = 1 - Math.pow(1 - p, easePow)
      st.videoLayout.videoWidthFrac = start + (end - start) * e
      handleResize()
      if (p < 1) st.videoScaleAnimRaf = requestAnimationFrame(step)
      else { st.videoLayout.videoWidthFrac = end; st.videoScaleAnimRaf = null; handleResize() }
    }
    st.videoScaleAnimRaf = requestAnimationFrame(step)
  }

  function updateVideoSeekUI() {
    const st = s.current
    if (!st.playerVideo || !st.videoSeekFill || !st.videoSeekBase) return
    const dur = st.playerVideo.duration, cur = st.playerVideo.currentTime
    const ratio = isFinite(dur) && dur > 0 ? Math.max(0, Math.min(1, cur / dur)) : 0
    const x1 = parseFloat(st.videoSeekBase.getAttribute('x1') ?? '0')
    const x2 = parseFloat(st.videoSeekBase.getAttribute('x2') ?? '0')
    st.videoSeekFill.setAttribute('x2', String(x1 + (x2 - x1) * ratio))
  }

  // ── Fermeture ─────────────────────────────────────────────────────────────────

  function cinematicClose() {
    const st = s.current
    if (!st.active) return
    st.active = false
    const P = GLOBAL_CONFIG.PLAYER
    const fadeMs = P.fade_out_ms, fadeY = P.fade_out_y
    const sid = ++st.closeSessionId

    if (st.waveRaf) { cancelAnimationFrame(st.waveRaf); st.waveRaf = null }
    st.playerAudio?.pause()
    st.playerVideo?.pause()

    const el = elRef.current
    if (el) {
      el.style.overflow = 'hidden'
      Array.from(el.children).forEach(child => {
        const c = child as HTMLElement
        c.style.transition = `opacity ${fadeMs / 1000}s cubic-bezier(0.4,0,0.2,1), transform ${fadeMs / 1000}s cubic-bezier(0.4,0,0.2,1)`
        c.style.opacity    = '0'
        c.style.transform  = (c.style.transform || '') + ` translateY(${fadeY}px)`
      })
    }

    setTimeout(() => {
      if (sid !== st.closeSessionId) return
      if (st.playerAudio) { st.playerAudio.src = ''; st.playerAudio = null }
      if (st.playerVideo) { st.playerVideo.src = ''; st.playerVideo = null }
      st.analyser = null; st.src = null; st.videoLayout = null
      if (el) { el.innerHTML = ''; el.style.pointerEvents = 'none'; el.style.overflow = '' }

      // Restaure le fullscreen btn
      const fsBtn = document.getElementById('fs-btn')
      if (fsBtn) { fsBtn.style.transition = `opacity ${P.torch_ms / 1000}s ease`; fsBtn.style.opacity = '0.85' }

      const prevTitle = st.playerHoverTitle
      st.playerHoverTitle = null
      st.onClose?.(prevTitle)

      const stillOnZone = document.querySelector('.hotspot-zone:hover')
      if (!stillOnZone) {
        document.getElementById('hover-title')?.classList.remove('visible')
      }
    }, fadeMs + 40)
  }

  function forceClose() {
    const st = s.current
    st.active = false
    if (st.playerAudio) { st.playerAudio.src = ''; st.playerAudio = null }
    if (st.playerVideo) { st.playerVideo.src = ''; st.playerVideo = null }
    if (st.waveRaf) { cancelAnimationFrame(st.waveRaf); st.waveRaf = null }
    const el = elRef.current; if (el) { el.innerHTML = ''; el.style.pointerEvents = 'none' }
    st.playerHoverTitle = null
    st.onClose?.(null)
  }

  // ── Resize ────────────────────────────────────────────────────────────────────

  function scheduleResize() {
    const st = s.current
    if (!st.active || (!st.playerAudio && !st.playerVideo)) return
    if (st.resizeRaf) cancelAnimationFrame(st.resizeRaf)
    st.resizeRaf = requestAnimationFrame(() => { st.resizeRaf = null; handleResize() })
  }

  function handleResize() {
    const st = s.current
    if (!st.active || (!st.playerAudio && !st.playerVideo)) return
    const P  = GLOBAL_CONFIG.PLAYER, W = vW(), H = vH()
    const vid = !!st.playerVideo
    const { rw, rh, rx, ry } = vid
      ? getVideoRect(st.videoLayout?.videoWidthFrac ?? P.video_min_w)
      : getAudioRect()

    if (st.rect) {
      const p = 2 * (rw + rh)
      st.rect.setAttribute('x', String(rx)); st.rect.setAttribute('y', String(ry))
      st.rect.setAttribute('width', String(rw)); st.rect.setAttribute('height', String(rh))
      st.rect.style.strokeDasharray = String(p); st.rect.style.strokeDashoffset = '0'; st.rect.style.transition = 'none'
    }

    const cSz = getArrowSizePx(), cR = cSz / 2
    const cMarR = Math.round(W * 0.035), cMarT = Math.round(H * 0.035)
    const csRR = cR * 0.46, cx0R = cR, cy0R = cR
    if (st.closeSvg)  { st.closeSvg.setAttribute('width', String(cSz)); st.closeSvg.setAttribute('height', String(cSz)); st.closeSvg.style.right = cMarR + 'px'; st.closeSvg.style.top = cMarT + 'px'; st.closeSvg.style.width = cSz + 'px'; st.closeSvg.style.height = cSz + 'px' }
    if (st.closeGroup){ st.closeGroup.style.transformOrigin = `${cx0R}px ${cy0R}px` }
    if (st.closeCirc) { st.closeCirc.setAttribute('cx', String(cx0R)); st.closeCirc.setAttribute('cy', String(cy0R)); st.closeCirc.setAttribute('r', String(cR - 1)); const p = Math.round(2 * Math.PI * (cR - 1)); st.closeCirc.style.strokeDasharray = String(p); st.closeCirc.style.strokeDashoffset = '0' }
    if (st.closeCross){ const ls = st.closeCross.querySelectorAll('line'); ls[0]?.setAttribute('x1', String(cx0R - csRR)); ls[0]?.setAttribute('y1', String(cy0R - csRR)); ls[0]?.setAttribute('x2', String(cx0R + csRR)); ls[0]?.setAttribute('y2', String(cy0R + csRR)); ls[1]?.setAttribute('x1', String(cx0R + csRR)); ls[1]?.setAttribute('y1', String(cy0R - csRR)); ls[1]?.setAttribute('x2', String(cx0R - csRR)); ls[1]?.setAttribute('y2', String(cy0R + csRR)) }
    if (st.closeHit)  { st.closeHit.style.width = cSz + 'px'; st.closeHit.style.height = cSz + 'px'; st.closeHit.style.right = cMarR + 'px'; st.closeHit.style.top = cMarT + 'px' }

    if (vid && st.playerVideo) {
      const inset = Math.max(1, Math.round(Math.min(W, H) * P.media_inset))
      const ctrlH = rh * P.video_ctrl_h, vidH = rh - ctrlH, sepY = ry + vidH
      st.playerVideo.style.left = (rx + inset) + 'px'; st.playerVideo.style.top = (ry + inset) + 'px'
      st.playerVideo.style.width = Math.max(2, rw - inset * 2) + 'px'; st.playerVideo.style.height = Math.max(2, vidH - inset) + 'px'
      const sidePad = rw * 0.03, bR = ctrlH * 0.30
      const leftCX = rx + sidePad + bR, rightCX = rx + rw - sidePad - bR
      const bCY = ry + vidH + ctrlH * 0.5, bPer = 2 * Math.PI * bR
      const ic = bR * 0.38, prw2 = ic * 0.52, gap2 = ic * 0.34
      if (st.videoSepLine)  { st.videoSepLine.setAttribute('x1', String(rx)); st.videoSepLine.setAttribute('y1', String(sepY)); st.videoSepLine.setAttribute('x2', String(rx + rw)); st.videoSepLine.setAttribute('y2', String(sepY)); st.videoSepLine.style.opacity = '1' }
      if (st.playCircle)    { st.playCircle.setAttribute('cx', String(leftCX)); st.playCircle.setAttribute('cy', String(bCY)); st.playCircle.setAttribute('r', String(bR)); st.playCircle.style.strokeDasharray = String(bPer); st.playCircle.style.strokeDashoffset = '0' }
      if (st.playIcon)      { st.playIcon.setAttribute('points', `${leftCX - ic * 0.7},${bCY - ic} ${leftCX - ic * 0.7},${bCY + ic} ${leftCX + ic * 1.1},${bCY}`) }
      if (st.pauseIcon)     { const rs = st.pauseIcon.querySelectorAll('rect'); rs[0]?.setAttribute('x', String(leftCX - gap2 - prw2)); rs[0]?.setAttribute('y', String(bCY - ic)); rs[0]?.setAttribute('width', String(prw2)); rs[0]?.setAttribute('height', String(ic * 2)); rs[1]?.setAttribute('x', String(leftCX + gap2)); rs[1]?.setAttribute('y', String(bCY - ic)); rs[1]?.setAttribute('width', String(prw2)); rs[1]?.setAttribute('height', String(ic * 2)) }
      if (st.playHit)       { st.playHit.style.width = (bR * 3.2) + 'px'; st.playHit.style.height = (bR * 3.2) + 'px'; st.playHit.style.left = (leftCX - bR * 1.6) + 'px'; st.playHit.style.top = (bCY - bR * 1.6) + 'px' }
      if (st.videoScaleCirc){ st.videoScaleCirc.setAttribute('cx', String(rightCX)); st.videoScaleCirc.setAttribute('cy', String(bCY)); st.videoScaleCirc.setAttribute('r', String(bR)); st.videoScaleCirc.style.strokeDasharray = String(bPer); st.videoScaleCirc.style.strokeDashoffset = '0' }
      if (st.videoScaleIcon){ const arm = bR * 0.38, d = st.videoLayout?.isExpanded ? bR * 0.24 : bR * 0.52; const cdefs: [number,number][] = [[-1,-1],[1,-1],[1,1],[-1,1]]; Array.from(st.videoScaleIcon.querySelectorAll('path')).forEach((p, i) => { const [sx, sy] = cdefs[i]; const px = rightCX + sx * d, py = bCY + sy * d; p.style.transition = 'none'; p.setAttribute('d', `M${px},${py + sy * arm} L${px},${py} L${px + sx * arm},${py}`); requestAnimationFrame(() => { p.style.transition = 'stroke 0.2s' }) }); st.videoScaleIcon.style.opacity = '1' }
      if (st.videoScaleBtn) { st.videoScaleBtn.style.width = (bR * 3.2) + 'px'; st.videoScaleBtn.style.height = (bR * 3.2) + 'px'; st.videoScaleBtn.style.left = (rightCX - bR * 1.6) + 'px'; st.videoScaleBtn.style.top = (bCY - bR * 1.6) + 'px' }
      const seekX1 = leftCX + bR + rw * 0.05, seekX2 = rightCX - bR - rw * 0.05, seekY = bCY, swH = ctrlH * P.video_seek_h
      if (st.videoSeekWrap) { st.videoSeekWrap.style.left = seekX1 + 'px'; st.videoSeekWrap.style.top = (seekY - swH * 2.5) + 'px'; st.videoSeekWrap.style.width = (seekX2 - seekX1) + 'px'; st.videoSeekWrap.style.height = (swH * 5) + 'px' }
      if (st.videoSeekBase) { st.videoSeekBase.setAttribute('x1', String(seekX1)); st.videoSeekBase.setAttribute('y1', String(seekY)); st.videoSeekBase.setAttribute('x2', String(seekX2)); st.videoSeekBase.setAttribute('y2', String(seekY)); st.videoSeekBase.setAttribute('stroke-width', String(P.video_seek_thick)) }
      if (st.videoSeekFill) { st.videoSeekFill.setAttribute('x1', String(seekX1)); st.videoSeekFill.setAttribute('y1', String(seekY)); st.videoSeekFill.setAttribute('y2', String(seekY)); st.videoSeekFill.setAttribute('stroke-width', String(P.video_seek_thick)) }
      updateVideoSeekUI()
    } else if (st.playerAudio) {
      const bR = rh * 0.28, bCX = rx + rh * 0.5, bCY = ry + rh * 0.5, bPer = 2 * Math.PI * bR
      const wGap = rh * P.audio_wave_gap, wX = rx + rh + wGap, wW = rw - rh - wGap * 2, wH = rh * P.audio_wave_h, wY = ry + (rh - wH) / 2
      const ic = bR * 0.42, prw3 = ic * 0.52, gap3 = ic * 0.34
      if (st.waveCanvas)  { st.waveCanvas.width = Math.max(2, Math.round(wW)); st.waveCanvas.height = Math.max(2, Math.round(wH)); st.waveCanvas.style.left = wX + 'px'; st.waveCanvas.style.top = wY + 'px'; st.waveCanvas.style.width = wW + 'px'; st.waveCanvas.style.height = wH + 'px'; if (st.playerAudio.paused) st.waveCanvas.getContext('2d')?.clearRect(0, 0, st.waveCanvas.width, st.waveCanvas.height) }
      if (st.playCircle)  { st.playCircle.setAttribute('cx', String(bCX)); st.playCircle.setAttribute('cy', String(bCY)); st.playCircle.setAttribute('r', String(bR)); st.playCircle.style.strokeDasharray = String(bPer); st.playCircle.style.strokeDashoffset = '0' }
      if (st.playIcon)    { st.playIcon.setAttribute('points', `${bCX - ic * 0.65},${bCY - ic} ${bCX - ic * 0.65},${bCY + ic} ${bCX + ic * 1.1},${bCY}`) }
      if (st.pauseIcon)   { const rs = st.pauseIcon.querySelectorAll('rect'); rs[0]?.setAttribute('x', String(bCX - gap3 - prw3)); rs[0]?.setAttribute('y', String(bCY - ic)); rs[0]?.setAttribute('width', String(prw3)); rs[0]?.setAttribute('height', String(ic * 2)); rs[1]?.setAttribute('x', String(bCX + gap3)); rs[1]?.setAttribute('y', String(bCY - ic)); rs[1]?.setAttribute('width', String(prw3)); rs[1]?.setAttribute('height', String(ic * 2)) }
      if (st.playHit)     { st.playHit.style.width = (bR * 3.2) + 'px'; st.playHit.style.height = (bR * 3.2) + 'px'; st.playHit.style.left = (bCX - bR * 1.6) + 'px'; st.playHit.style.top = (bCY - bR * 1.6) + 'px' }
    }
  }

  // ── API impérative — déclarée après toutes les fonctions ─────────────────────

  useImperativeHandle(ref, () => ({
    open:       (src, label) => open(src, label),
    close:      ()           => cinematicClose(),
    forceClose: ()           => forceClose(),
    setOnClose: (fn)         => { s.current.onClose = fn },
    isActive:   ()           => s.current.active,
    resize:     ()           => scheduleResize(),
  }))

  // ── Resize listener ───────────────────────────────────────────────────────────

  useEffect(() => {
    const onResize = () => scheduleResize()
    window.addEventListener('resize', onResize)
    document.addEventListener('fullscreenchange', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      document.removeEventListener('fullscreenchange', onResize)
    }
  }, [])

  return (
    <div
      ref={elRef}
      id="media-player"
      style={{ position: 'absolute', inset: 0, zIndex: 30, pointerEvents: 'none' }}
    />
  )
})

MediaPlayer.displayName = 'MediaPlayer'
export default MediaPlayer