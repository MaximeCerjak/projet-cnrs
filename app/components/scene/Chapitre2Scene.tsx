'use client'

/**
 * Chapitre2Scene — Scène interactive complète
 *
 * Séquence :
 *  1. Intro cinématique (fond chapitre2.png + lumière + son phrénologie)
 *  2. Transition vers phase interactive (chapitre2base.png + hotspots)
 *  3. Sortie avec citation typée + skip
 *  4. Navigation vers collaboration
 */

import { useEffect, useRef, useCallback } from 'react'
import { useNavigationStore } from '@/app/stores/navigationStore'
import { useNavigation } from '@/app/components/navigation/useNavigation'
import { SCENE_REGISTRY } from '@/app/lib/scenes/registry'
import { GLOBAL_CONFIG } from '@/app/lib/config/global'
import { CHAPITRE2_CONFIG } from '@/app/lib/config/scenes/chapitre-2'
import { getAudioManager } from '@/app/lib/audio/audioManager'
import { useMediaPlayerStore } from '@/app/stores/mediaPlayerStore'
import Chapter2LightCanvas, { type Chapter2LightHandle } from '@/app/components/canvas/Chapter2LightCanvas'

// ── Helpers ───────────────────────────────────────────────────────────────────

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function waitAbortable(ms: number, signal: { aborted: boolean }): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error('aborted')); return }
    const t = setTimeout(() => {
      if (signal.aborted) reject(new Error('aborted'))
      else resolve()
    }, ms)
    // Polling minimal pour annulation rapide
    const check = setInterval(() => {
      if (signal.aborted) { clearTimeout(t); clearInterval(check); reject(new Error('aborted')) }
    }, 50)
    // Cleanup si resolve normal
    const orig = resolve
    resolve = () => { clearInterval(check); orig() }
  })
}

function preloadImage(url: string): Promise<boolean> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload  = () => resolve(true)
    img.onerror = () => resolve(false)
    img.src = url
  })
}

function fadeVeil(opacity: number, durationMs: number): Promise<void> {
  return new Promise(resolve => {
    const veil = document.getElementById('veil')
    if (!veil) { resolve(); return }
    veil.style.transition = `opacity ${durationMs}ms ease`
    veil.style.opacity    = String(opacity)
    setTimeout(resolve, durationMs)
  })
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface AbortSignal { aborted: boolean }

// ── Composant ─────────────────────────────────────────────────────────────────

export default function Chapitre2Scene() {
  const { currentPage, experienceStarted } = useNavigationStore()
  const { navigateTo } = useNavigation()
  // player lu via hook pour le rendu, mais dans les callbacks impératifs
  // on utilise useMediaPlayerStore.getState() pour éviter les closures périmées
  useMediaPlayerStore(s => s.player) // abonnement pour re-render si nécessaire

  const lightRef       = useRef<Chapter2LightHandle>(null)
  const torchCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const hotspotLayerRef = useRef<HTMLDivElement>(null)
  const skipBtnRef     = useRef<HTMLDivElement>(null)
  const subtitleRef    = useRef<HTMLDivElement>(null)
  const hoverTitleRef  = useRef<HTMLDivElement>(null)
  const bgChap2Ref     = useRef<HTMLElement | null>(null)

  // État interne de la scène
  const sceneState = useRef({
    active:            false,
    isInteractive:     false,
    interactiveReady:  false,
    isTransitioningOut: false,
    activeHotspot:     null as string | null,
    hotspotLeaveTimer: null as ReturnType<typeof setTimeout> | null,
    hoverTitleCurrent: null as string | null,
    hoverTitleTimer:   null as ReturnType<typeof setTimeout> | null,
    abortSignal:       { aborted: false } as AbortSignal,
    timers:            [] as ReturnType<typeof setTimeout>[],
    skipCallback:      null as (() => void) | null,
  })

  const addTimer = (fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      sceneState.current.timers = sceneState.current.timers.filter(t => t !== id)
      fn()
    }, ms)
    sceneState.current.timers.push(id)
    return id
  }

  const clearAllTimers = () => {
    sceneState.current.timers.forEach(clearTimeout)
    sceneState.current.timers = []
    sceneState.current.abortSignal.aborted = true
  }

  // ── Torche globale ─────────────────────────────────────────────────────────

  const hideGlobalTorch = () => {
    const c = document.getElementById('overlay-canvas') as HTMLCanvasElement | null
    if (!c) return
    c.style.opacity = '0'
    c.style.display = 'none'
  }

  const showGlobalTorch = () => {
    const c = document.getElementById('overlay-canvas') as HTMLCanvasElement | null
    if (!c) return
    c.style.display = 'block'
    c.style.opacity = '1'
  }

  // ── Sous-titre ─────────────────────────────────────────────────────────────

  const showSubtitle = () => {
    const el = subtitleRef.current
    if (!el) return
    const C  = CHAPITRE2_CONFIG
    const f  = GLOBAL_CONFIG.FONTS.subtitle
    const vw = Math.max(GLOBAL_CONFIG.MIN_SIZE.width, window.innerWidth)
    el.innerHTML = C.subtitle
    el.style.fontFamily    = f.family
    el.style.fontSize      = Math.max(f.size_min, Math.min(f.size_max, Math.round(vw * f.size_vw / 100))) + 'px'
    el.style.fontWeight    = String(f.weight)
    el.style.letterSpacing = f.spacing
    el.style.fontStyle     = f.style
    el.classList.add('visible')
  }

  const hideSubtitle = (immediate = false) => {
    const el = subtitleRef.current
    if (!el) return
    if (immediate) {
      el.style.transition = 'none'
      el.classList.remove('visible')
      void el.offsetHeight
      el.style.transition = ''
      return
    }
    el.style.transition = 'opacity 0.75s ease, transform 0.85s cubic-bezier(0.55,0,0.45,1)'
    el.style.opacity    = '0'
    el.style.transform  = 'translateY(-6px)'
    setTimeout(() => {
      if (!el) return
      el.classList.remove('visible')
      el.style.opacity   = ''
      el.style.transform = ''
      el.style.transition = ''
    }, 900)
  }

  // ── Skip button ────────────────────────────────────────────────────────────

  const getSkipSize = () => {
    const vW = Math.max(GLOBAL_CONFIG.MIN_SIZE.width, window.innerWidth)
    const vH = Math.max(GLOBAL_CONFIG.MIN_SIZE.height, window.innerHeight)
    const A  = GLOBAL_CONFIG.ARROW
    const sz = Math.round(Math.max(A.size_min, Math.min(A.size_max, Math.min(vW, vH) * A.size_vh / 100)))
    return { W: sz * 3, H: sz }
  }

  const showSkipButton = (onClick: () => void) => {
    const el = skipBtnRef.current
    if (!el) return
    const { W, H } = getSkipSize()
    const perim = 2 * (W + H)
    const fs    = Math.min(15, Math.max(9, Math.round(H * 0.38)))

    el.innerHTML = `
      <div class="skip-wrap" style="width:${W}px;height:${H}px;position:relative;cursor:none;">
        <svg width="${W}" height="${H}" style="position:absolute;inset:0;overflow:visible;">
          <rect class="skip-rect" x="1" y="1" width="${W-2}" height="${H-2}"
            stroke-dasharray="${perim}" stroke-dashoffset="${perim}"/>
          <text class="skip-label" x="${W/2}" y="${H/2}"
            font-size="${fs}" font-family="Cinzel,serif" font-weight="400"
            letter-spacing="0.18em" fill="rgba(255,255,255,0.82)"
            dominant-baseline="middle" text-anchor="middle">Passer</text>
        </svg>
      </div>`

    const wrap  = el.querySelector('.skip-wrap') as HTMLElement
    const svg   = wrap.querySelector('svg') as SVGSVGElement
    const rect  = el.querySelector('.skip-rect') as SVGElement
    const label = el.querySelector('.skip-label') as SVGElement

    const glow = 'drop-shadow(0 0 7px rgba(255,210,80,.80)) drop-shadow(0 0 20px rgba(255,170,30,.50))'
    svg.style.transition = 'transform .35s cubic-bezier(0.34,1.56,0.64,1)'
    svg.style.transformOrigin = 'center'

    wrap.onmouseenter = () => {
      svg.style.transform = 'scale(1.22)'
      rect.setAttribute('stroke', 'rgba(255,230,130,0.95)')
      rect.style.filter = glow
      label.setAttribute('fill', 'rgba(255,220,120,1)')
    }
    wrap.onmouseleave = () => {
      svg.style.transform = 'scale(1)'
      rect.setAttribute('stroke', 'rgba(255,255,255,0.72)')
      rect.style.filter = ''
      label.setAttribute('fill', 'rgba(255,255,255,0.82)')
    }
    wrap.onclick = onClick
    sceneState.current.skipCallback = onClick

    el.classList.add('visible')
    requestAnimationFrame(() => requestAnimationFrame(() => {
      rect.classList.add('drawn')
      setTimeout(() => label.classList.add('drawn'), 850)
    }))
  }

  const hideSkipButton = (immediate = false) => {
    const el = skipBtnRef.current
    if (!el) return
    el.classList.remove('visible')
    sceneState.current.skipCallback = null
    if (immediate) el.innerHTML = ''
    else setTimeout(() => { if (!el.classList.contains('visible')) el.innerHTML = '' }, 700)
  }

  // ── Hover title ────────────────────────────────────────────────────────────

  const setHoverTitle = (text: string) => {
    const el  = hoverTitleRef.current
    const s   = sceneState.current
    if (!el || !text) return

    const f  = GLOBAL_CONFIG.FONTS.hover_title
    const vW = Math.max(GLOBAL_CONFIG.MIN_SIZE.width, window.innerWidth)
    const sz = Math.max(f.size_min, Math.min(f.size_max, Math.round(vW * f.size_vw / 100)))
    el.style.fontFamily    = f.family
    el.style.fontSize      = sz + 'px'
    el.style.fontWeight    = String(f.weight)
    el.style.letterSpacing = f.spacing
    el.style.fontStyle     = 'italic'

    if (s.hoverTitleTimer !== null) {
      clearTimeout(s.hoverTitleTimer); s.hoverTitleTimer = null
    }
    if (s.hoverTitleCurrent === text) return

    if (!s.hoverTitleCurrent) {
      el.innerHTML = `<span class="ht-text">${text}</span>`
      s.hoverTitleCurrent = text
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('visible')))
    } else {
      const span = el.querySelector('.ht-text')
      if (!span) {
        el.innerHTML = `<span class="ht-text">${text}</span>`
        s.hoverTitleCurrent = text
        return
      }
      span.classList.add('fading')
      s.hoverTitleCurrent = text
      setTimeout(() => {
        span.innerHTML = text
        span.classList.remove('fading')
      }, 230)
    }
  }

  const clearHoverTitle = () => {
    const el = hoverTitleRef.current
    const s  = sceneState.current
    if (s.hoverTitleTimer !== null) clearTimeout(s.hoverTitleTimer)
    s.hoverTitleTimer = setTimeout(() => {
      el?.classList.remove('visible')
      s.hoverTitleCurrent = null
      s.hoverTitleTimer   = null
    }, 30)
  }

  // ── Hotspot images ─────────────────────────────────────────────────────────

  const showHotspotImg = (imgId: string) => {
    const s = sceneState.current
    if (s.hotspotLeaveTimer) { clearTimeout(s.hotspotLeaveTimer); s.hotspotLeaveTimer = null }
    if (s.activeHotspot === imgId) return
    if (s.activeHotspot) document.getElementById(s.activeHotspot)?.classList.remove('active')
    s.activeHotspot = imgId
    document.getElementById(imgId)?.classList.add('active')
  }

  const hideHotspotImg = () => {
    const s = sceneState.current
    if (s.hotspotLeaveTimer) clearTimeout(s.hotspotLeaveTimer)
    s.hotspotLeaveTimer = setTimeout(() => {
      if (s.activeHotspot) document.getElementById(s.activeHotspot)?.classList.remove('active')
      s.activeHotspot    = null
      s.hotspotLeaveTimer = null
    }, 40)
  }

  // ── Hotspots ───────────────────────────────────────────────────────────────

  const buildHotspots = useCallback((onMediaOpen: (src: string, label: string) => void) => {
    const layer = hotspotLayerRef.current
    if (!layer) return
    const s  = sceneState.current
    const HS = CHAPITRE2_CONFIG.hotspots
    const C  = CHAPITRE2_CONFIG

    layer.innerHTML = ''
    s.hoverTitleCurrent = null

    HS.forEach((h, i) => {
      const zone = document.createElement('div')
      zone.className      = 'hotspot-zone'
      zone.style.left     = h.l + '%'
      zone.style.top      = h.t + '%'
      zone.style.width    = h.w + '%'
      zone.style.height   = h.h + '%'
      zone.style.position      = 'absolute'
      zone.style.pointerEvents = 'auto'
      zone.style.cursor        = 'none'

      const displayLabel = /^\d+$/.test(h.label.trim()) ? 'Zone\u00A0' + h.label.trim() : h.label

      zone.addEventListener('mouseenter', () => {
        if (!s.interactiveReady || s.isTransitioningOut) return
        showHotspotImg(h.img)
        setHoverTitle(displayLabel)
      })

      zone.addEventListener('mouseleave', () => {
        if (!s.interactiveReady) return
        hideHotspotImg()
        clearHoverTitle()
      })

      zone.addEventListener('click', () => {
        if (!s.interactiveReady || !h.media || s.isTransitioningOut) return
        // Désactive les hotspots pendant la lecture
        s.interactiveReady = false
        // Réduction lumière
        const L = C.light
        lightRef.current?.animateToFraction(L.media_frac, L.media_duration, 1)
        onMediaOpen(h.media, h.label)
      })

      layer.appendChild(zone)
    })
  }, [])

  const cleanupHotspots = () => {
    const layer = hotspotLayerRef.current
    if (layer) layer.innerHTML = ''
    const s = sceneState.current
    if (s.hotspotLeaveTimer) { clearTimeout(s.hotspotLeaveTimer); s.hotspotLeaveTimer = null }
    if (s.hoverTitleTimer)   { clearTimeout(s.hoverTitleTimer);   s.hoverTitleTimer   = null }
    if (s.activeHotspot) {
      document.getElementById(s.activeHotspot)?.classList.remove('active')
      s.activeHotspot = null
    }
    hoverTitleRef.current?.classList.remove('visible')
    s.hoverTitleCurrent = null
    document.body.classList.remove('page3')
  }

  // ── Transition intro → base ────────────────────────────────────────────────

  const transitionIntroToBase = async (signal: AbortSignal) => {
    const bg = document.getElementById('bg-chapitre2')
    if (!bg) return

    await preloadImage('/images/chapitre2base.png')
    if (signal.aborted) return

    const DURATION = CHAPITRE2_CONFIG.light.trans_duration

    // Crée un layer temporaire sous bg
    const baseLayer = document.createElement('div')
    baseLayer.style.cssText = [
      'position:absolute', 'inset:0', 'z-index:0', 'pointer-events:none',
      'background-image:url("/images/chapitre2base.png")',
      'background-size:100% 100%', 'background-position:center',
      'background-repeat:no-repeat', 'background-color:#000', 'opacity:0',
    ].join(';')

    const app = document.getElementById('app')
    if (app && bg) app.insertBefore(baseLayer, bg)

    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    if (signal.aborted) { baseLayer.remove(); return }

    baseLayer.style.transition = `opacity ${DURATION}ms cubic-bezier(0.25,0.46,0.45,0.94) 80ms, transform ${DURATION}ms cubic-bezier(0.25,0.46,0.45,0.94)`
    baseLayer.style.transform  = 'scale(1.12)'
    requestAnimationFrame(() => {
      baseLayer.style.opacity   = '1'
      baseLayer.style.transform = 'scale(1)'
    })

    bg.style.transition = `opacity ${DURATION * 0.85}ms cubic-bezier(0.42,0,0.78,1), transform ${DURATION}ms cubic-bezier(0.25,0.46,0.45,0.94)`
    bg.style.transform  = 'scale(1.10)'
    bg.style.opacity    = '0'

    await lightRef.current?.animateToFraction(CHAPITRE2_CONFIG.light.interactive_frac, DURATION, 1)
    if (signal.aborted) { baseLayer.remove(); return }

    await wait(150)

    bg.style.transition        = 'none'
    bg.style.transform         = 'scale(1)'
    bg.style.opacity           = '1'
    bg.style.backgroundImage   = 'url("/images/chapitre2base.png")'
    bg.style.backgroundSize    = '100% 100%'
    bg.style.backgroundPosition = 'center'
    bg.style.backgroundRepeat  = 'no-repeat'
    bg.style.willChange        = ''
    baseLayer.remove()
  }

  // ── Phase interactive ──────────────────────────────────────────────────────

  const startInteractivePhase = async (fromSkip: boolean, signal: AbortSignal) => {
    const s = sceneState.current
    if (!s.active || s.isInteractive || s.isTransitioningOut) return
    s.isInteractive    = true
    s.interactiveReady = false

    hideSkipButton()

    // Arrête le son phrénologique dès la transition
    const audio = getAudioManager()
    if (fromSkip) {
      audio.stopPhrenoSound()
      audio.fadeMusee(0, 260)
    } else {
      audio.stopPhrenoSound()
      audio.fadeMusee(0, 700)
    }

    await transitionIntroToBase(signal)
    if (signal.aborted) return

    showSubtitle()

    addTimer(() => {
      if (!s.active || s.isTransitioningOut) return
      showNavigationArrow(signal)
    }, 420)

    addTimer(() => {
      if (!s.active || s.isTransitioningOut) return
      document.body.classList.add('page3')
      buildHotspots((src: string, label: string) => {
        // Lit le player depuis le store au moment du clic — évite les closures périmées
        const p = useMediaPlayerStore.getState().player
        if (!p) return

        // Arrêt immédiat de la sanza — on ne veut pas de fade qui chevauche le média
        getAudioManager().stopSanzaLoop(0)

        p.setOnClose(() => {
          const sc = sceneState.current
          if (!sc.active || sc.isTransitioningOut) return
          lightRef.current?.animateToFraction(
            CHAPITRE2_CONFIG.light.interactive_frac,
            CHAPITRE2_CONFIG.light.media_duration,
            1
          )
          // Relance sanza seulement si aucun autre média n'est actif
          const p = useMediaPlayerStore.getState().player
          if (!p?.isActive()) {
            getAudioManager().startSanzaLoop()
          }
          sc.interactiveReady = true
        })
        p.open(src, label)
      })
      s.interactiveReady = true
    }, 760)

    // Lance la boucle sanza après la transition — seulement si aucun média en cours
    addTimer(() => {
      if (!s.active || s.isTransitioningOut) return
      const p = useMediaPlayerStore.getState().player
      if (p?.isActive()) return
      getAudioManager().startSanzaLoop()
    }, 180)
  }

  // Flèche de sortie chapitre 2 (bas-gauche, ←)
  const arrowRef = useRef<HTMLDivElement | null>(null)

  const showNavigationArrow = (signal: AbortSignal) => {
    const s = sceneState.current
    if (!arrowRef.current) {
      const el = document.createElement('div')
      el.id = 'arrow-chap2'
      el.dataset.arrow = 'true'
      el.style.cssText = 'position:absolute;z-index:10;opacity:0;cursor:none;'
      document.getElementById('app')?.appendChild(el)
      arrowRef.current = el
    }
    const el  = arrowRef.current
    const vW  = Math.max(GLOBAL_CONFIG.MIN_SIZE.width, window.innerWidth)
    const vH  = Math.max(GLOBAL_CONFIG.MIN_SIZE.height, window.innerHeight)
    const A   = GLOBAL_CONFIG.ARROW
    const sz  = Math.round(Math.max(A.size_min, Math.min(A.size_max, Math.min(vW, vH) * A.size_vh / 100)))
    const margin = Math.round(Math.min(vW, vH) * 0.05)

    el.style.bottom    = margin + 'px'
    el.style.left      = margin + 'px'
    el.style.transform = 'none'

    const CIRC = 201; const PLEN = 60
    el.innerHTML = `
      <svg width="${sz}" height="${sz}" viewBox="0 0 70 70" overflow="visible"
        style="display:block;transition:transform .35s cubic-bezier(0.34,1.56,0.64,1);transform-origin:center;">
        <circle class="arrow-c" cx="35" cy="35" r="32" fill="none"
          stroke="rgba(255,255,255,0.75)" stroke-width="1.2"
          stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC}"
          style="transition:stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1),stroke .3s,filter .3s;"/>
        <path class="arrow-p" d="M48 35 L22 35 M33 24 L22 35 L33 46" fill="none"
          stroke="rgba(255,255,255,0.80)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"
          stroke-dasharray="${PLEN}" stroke-dashoffset="${PLEN}"
          style="transition:stroke-dashoffset 0.7s cubic-bezier(0.4,0,0.2,1) 1.3s,stroke .3s,filter .3s;"/>
      </svg>`

    el.style.transition = 'opacity 1.0s ease'
    el.style.opacity    = '1'

    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.querySelector('.arrow-c')?.setAttribute('stroke-dashoffset', '0')
      el.querySelector('.arrow-p')?.setAttribute('stroke-dashoffset', '0')
    }))

    const svg = el.querySelector('svg') as SVGElement
    const c   = el.querySelector('.arrow-c') as SVGElement
    const p   = el.querySelector('.arrow-p') as SVGElement
    const glow = 'drop-shadow(0 0 7px rgba(255,210,80,.80)) drop-shadow(0 0 20px rgba(255,170,30,.50))'

    el.onmouseenter = () => {
      svg.style.transform = 'scale(1.22)'
      c.style.stroke = 'rgba(255,230,130,0.95)'; c.style.filter = glow
      p.style.stroke = 'rgba(255,230,130,0.95)'; p.style.filter = glow
    }
    el.onmouseleave = () => {
      svg.style.transform = 'scale(1)'
      c.style.stroke = 'rgba(255,255,255,0.75)'; c.style.filter = ''
      p.style.stroke = 'rgba(255,255,255,0.80)'; p.style.filter = ''
    }

    let drawing = true
    setTimeout(() => { drawing = false }, 2100)

    el.onclick = () => {
      if (drawing || signal.aborted) return
      transitionOutWithQuote(signal)
    }
  }

  const hideNavigationArrow = () => {
    const el = arrowRef.current
    if (!el) return
    el.style.transition = 'opacity 400ms ease'
    el.style.opacity    = '0'
    setTimeout(() => { el.remove(); arrowRef.current = null }, 420)
  }

  // ── Sortie avec citation ───────────────────────────────────────────────────

  const transitionOutWithQuote = async (signal: AbortSignal) => {
    const s = sceneState.current
    if (!s.active || s.isTransitioningOut) return
    s.isTransitioningOut = true
    s.interactiveReady   = false

    const QUOTE_TEXT = `\nCe qui a été le plus difficile à comprendre ou à aborder ?\n\nCe qui m'a le plus dérangé, c'est l'ambiguïté de son geste. Est-ce qu'il est un assassin ? un résistant ? un fanatique ? un héros ? ce n'est pas facile de trancher. On se rend vite compte que ça dépend du point de vue.\n\nEt comme il n'a pas laissé de traces écrites personnelles, on doit lire entre les lignes des récits officiels. C'est frustrant de ne pas vraiment savoir qui il était, ce qu'il pensait, ce qu'il ressentait. Mais c'est aussi ce qui rend cette recherche passionnante.`

    hideNavigationArrow()
    hideSkipButton(true)
    cleanupHotspots()

    await fadeVeil(1, 1100)
    if (signal.aborted) return

    hideSubtitle(false)
    document.getElementById('bg-chapitre2')!.style.opacity = '0'

    // Lance le typing de citation
    await runQuoteTyping(QUOTE_TEXT, signal)
    if (signal.aborted) return

    // Sortie finale
    hideSubtitle(false)

    const quoteEl = document.getElementById('chapter-quote')
    if (quoteEl) {
      quoteEl.style.transition = 'opacity 1400ms cubic-bezier(0.55,0,0.45,1)'
      quoteEl.style.opacity    = '0'
      await wait(1450)
      quoteEl.style.transition = ''
      quoteEl.style.opacity    = ''
      quoteEl.classList.remove('visible')
      quoteEl.innerHTML = ''
    }

    await lightRef.current?.animateToFraction(0, 600, 0)
    lightRef.current?.hide(true)
    await wait(400)

    // On gère déjà le veil manuellement — on appelle le store directement
    // pour éviter : closure périmée sur isTransitioning, double fadeVeil, guard target===currentPage
    const store = useNavigationStore.getState()
    if (!sceneState.current.active || store.currentPage !== 'chapitre-2') return

    // Swap des backgrounds puis navigation sans fadeVeil (déjà opaque depuis fadeVeil(1,1100))
    Object.values(SCENE_REGISTRY).forEach(scene => {
      const el = document.getElementById(scene.background)
      if (el) el.style.opacity = scene.id === 'collaboration' ? '1' : '0'
    })
    store.setPage('collaboration', 'chapitre-2')

    await fadeVeil(0, GLOBAL_CONFIG.TRANSITION.veil_out)
  }

  // ── Quote typing ───────────────────────────────────────────────────────────

  const runQuoteTyping = async (text: string, signal: AbortSignal) => {
    const rootEl = document.getElementById('chapter-quote')
    if (!rootEl) return

    // Injection styles CSS une seule fois
    if (!document.getElementById('quote-seq-style')) {
      const style = document.createElement('style')
      style.id = 'quote-seq-style'
      style.textContent = `@keyframes quoteSeqBlink { 0%,46%{opacity:1} 47%,100%{opacity:0} }`
      document.head.appendChild(style)
    }

    const vW   = Math.max(window.innerWidth, 320)
    const vH   = Math.max(window.innerHeight, 320)
    const vMin = Math.min(vW, vH)
    const fontPx   = Math.max(12, Math.min(52, Math.round(vMin * 2.75 / 100)))
    const columnPx = Math.max(260, Math.min(920, Math.round(vW * 0.68)))
    const padX  = Math.max(25, Math.min(1000, Math.round(vW * 0.25)))
    const padY  = Math.max(10, Math.min(200,  Math.round(vH * 0.10)))

    rootEl.style.cssText = `
      position:absolute;inset:0;z-index:7;display:flex;align-items:center;
      justify-content:center;padding:${padY}px ${padX}px;
      pointer-events:none;opacity:0;transition:opacity 2.6s ease;box-sizing:border-box;`

    rootEl.innerHTML = `
      <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
        <div style="width:${columnPx}px;max-width:100%;">
          <div id="quote-text" style="
            width:100%;color:rgba(239,232,220,0.96);
            font-family:'Cormorant Garamond',Georgia,serif;
            font-size:${fontPx}px;line-height:1.84;letter-spacing:0.008em;
            font-weight:300;text-align:justify;white-space:pre-wrap;
            text-shadow:0 0 30px rgba(255,255,255,0.035),0 6px 18px rgba(0,0,0,0.32);">
            <span id="quote-body"></span><span id="quote-cursor"
              style="display:inline-block;width:0.55ch;margin-left:0.02em;
              color:rgba(239,232,220,0.82);animation:quoteSeqBlink 1.35s steps(1) infinite;">▍</span>
          </div>
        </div>
      </div>`

    rootEl.classList.add('visible')
    // Déclenche le fondu CSS
    requestAnimationFrame(() => requestAnimationFrame(() => { rootEl.style.opacity = '1' }))

    const bodyEl   = document.getElementById('quote-body')!
    const skipDelay = CHAPITRE2_CONFIG.timing.skip_btn_delay

    // Lance le skip button après délai
    let skipped = false
    const skipPromise = new Promise<void>(resolve => {
      const t = setTimeout(() => {
        if (signal.aborted) { resolve(); return }
        showSkipButton(() => {
          skipped = true
          if (bodyEl) bodyEl.textContent = text
          hideSkipButton(true)
          resolve()
        })
      }, skipDelay)
      sceneState.current.timers.push(t)
    })

    // Typing expressif
    const typingPromise = (async () => {
      const CFG = {
        baseDelay: 54, humanizeRatio: 0.22,
        commaPause: 75, semicolonPause: 125, colonPause: 150,
        dashPause: 170, sentencePause: 245, lineBreakPause: 170,
        paragraphPause: 560, softWordRelease: 12, longWordPause: 18,
        emphasisPause: 50, afterTypingDelay: 2800,
      }

      let output = ''; let currentWord = ''
      for (let i = 0; i < text.length; i++) {
        if (signal.aborted || skipped) break
        const ch   = text[i]
        const prev = i > 0 ? text[i-1] : ''
        const next = i < text.length - 1 ? text[i+1] : ''
        output += ch
        if (bodyEl) bodyEl.textContent = output
        if (/\S/.test(ch) && ch !== '\n') currentWord += ch
        else currentWord = ''

        let delay = CFG.baseDelay
        delay += (Math.random() * 2 - 1) * CFG.baseDelay * CFG.humanizeRatio
        if (ch === ',') delay += CFG.commaPause
        else if (ch === ';') delay += CFG.semicolonPause
        else if (ch === ':') delay += CFG.colonPause
        else if (ch === '—') delay += CFG.dashPause
        else if ('.!?'.includes(ch)) delay += CFG.sentencePause
        if (ch === '\n' && prev === '\n') delay += CFG.paragraphPause
        else if (ch === '\n') delay += CFG.lineBreakPause
        if (ch === ' ' && currentWord.length > 0) {
          delay += CFG.softWordRelease
          if (currentWord.length >= 8) delay += CFG.longWordPause
        }

        await new Promise(r => setTimeout(r, Math.max(10, Math.round(delay))))
      }

      if (!skipped && !signal.aborted) {
        hideSkipButton(true)
        await wait(CFG.afterTypingDelay)
      }
    })()

    await Promise.race([typingPromise, skipPromise])
  }

  // ── Scène principale ───────────────────────────────────────────────────────

  const enterScene = async () => {
    const s = sceneState.current
    s.active            = true
    s.isInteractive     = false
    s.interactiveReady  = false
    s.isTransitioningOut = false
    s.abortSignal       = { aborted: false }
    const signal        = s.abortSignal

    hideGlobalTorch()
    cleanupHotspots()
    hideSkipButton(true)
    hideSubtitle(true)

    const bg = document.getElementById('bg-chapitre2')
    if (bg) {
      bg.style.transition       = 'none'
      bg.style.transform        = 'scale(1)'
      bg.style.backgroundImage  = 'url("/images/chapitre2.png")'
      bg.style.backgroundSize   = 'cover'
      bg.style.backgroundPosition = 'center'
      bg.style.backgroundRepeat = 'no-repeat'
      bg.style.backgroundColor  = '#000'
      bg.style.opacity          = '1'
    }

    // Masque les autres backgrounds
    ;['bg-vitrine','bg-phrenologie','bg-collaboration'].forEach(id => {
      const el = document.getElementById(id)
      if (el) el.style.opacity = '0'
    })

    await fadeVeil(1, 0)

    try {
      await preloadImage('/images/chapitre2.png')
      if (signal.aborted) return

      showSubtitle()
      lightRef.current?.show()
      lightRef.current?.setFraction(0, 0)

      await fadeVeil(0, 1400)
      if (signal.aborted) return

      lightRef.current?.animateToFraction(
        CHAPITRE2_CONFIG.light.intro_frac,
        CHAPITRE2_CONFIG.light.intro_duration,
        1
      )

      await new Promise<void>(r => { const t = setTimeout(r, CHAPITRE2_CONFIG.timing.phren_sound_delay); s.timers.push(t) })
      if (signal.aborted) return

      // Son phrénologie — placeholder jusqu'à l'AudioManager
      // Son phrénologique d'intro
      const audio = getAudioManager()
      const phrenoSrc = await audio.playPhrenoSound()

      if (!phrenoSrc) {
        startInteractivePhase(false, signal)
        return
      }

      // Fin naturelle du son → phase interactive
      phrenoSrc.addEventListener('ended', () => {
        if (!s.active || s.isInteractive || s.isTransitioningOut) return
        startInteractivePhase(false, signal)
      }, { once: true })

      // Bouton "Passer" après délai configurable
      addTimer(() => {
        if (!s.active || s.isInteractive || s.isTransitioningOut) return
        showSkipButton(() => {
          if (!s.active || s.isInteractive || s.isTransitioningOut) return
          startInteractivePhase(true, signal)
        })
      }, CHAPITRE2_CONFIG.timing.skip_intro_delay)

    } catch {
      // Interruption silencieuse
    }
  }

  const exitScene = () => {
    const s = sceneState.current
    s.active = false
    clearAllTimers()
    // Arrête les sons du chapitre 2
    const audio = getAudioManager()
    audio.stopPhrenoSound()
    audio.stopSanzaLoop()
    audio.stopSilenceLoop()

    hideNavigationArrow()
    hideSkipButton(true)
    hideSubtitle(true)
    cleanupHotspots()
    lightRef.current?.hide(true)
    showGlobalTorch()

    // Reset bg
    const bg = document.getElementById('bg-chapitre2')
    if (bg) {
      bg.style.opacity   = '0'
      bg.style.transform = ''
      bg.style.transition = ''
    }

    // Reset veil
    const veil = document.getElementById('veil')
    if (veil) { veil.style.transition = 'none'; veil.style.opacity = '0' }

    // Reset chapter-quote
    const quote = document.getElementById('chapter-quote')
    if (quote) { quote.classList.remove('visible'); quote.innerHTML = '' }

    document.body.classList.remove('page3')
  }

  useEffect(() => {
    if (!experienceStarted) return
    if (currentPage === 'chapitre-2') {
      enterScene()
    } else {
      exitScene()
    }
    return () => {
      if (currentPage === 'chapitre-2') exitScene()
    }
  }, [experienceStarted, currentPage])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <Chapter2LightCanvas ref={lightRef} />

      {/* Hotspot layer */}
      <div
        ref={hotspotLayerRef}
        id="hotspot-layer"
        style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }}
      />

      {/* Images hotspot */}
      {CHAPITRE2_CONFIG.hotspots.map(h => (
        <div
          key={h.img}
          id={h.img}
          className="hotspot-img"
          style={{ backgroundImage: `url('/images/${h.img}.png')` }}
        />
      ))}

      {/* Sous-titre chapitre */}
      <div ref={subtitleRef} id="chapitre-subtitle" />

      {/* Hover title */}
      <div ref={hoverTitleRef} id="hover-title" />

      {/* Skip button */}
      <div ref={skipBtnRef} id="skip-btn" />

      {/* Chapter quote */}
      <div id="chapter-quote" />
    </>
  )
}