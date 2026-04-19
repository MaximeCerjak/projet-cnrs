'use client'

/**
 * CustomCursor — reproduit le comportement de app.js
 *
 * Sélecteurs actifs pour l'état "hotspot" :
 *   [data-arrow]      → toutes les flèches de navigation
 *   #fs-btn           → bouton fullscreen
 *   .roman-btn        → cercles romains
 *   [data-action]     → zones avec action
 *   .doc-btn          → boutons documents
 *   .nav-btn-zone     → zones navbar
 *   button            → boutons HTML natifs
 *   .hotspot-zone     → zones chapitre 2
 */

import { useEffect } from 'react'

const SELECTORS = [
  '[data-arrow]',
  '#fs-btn',
  '.roman-btn',
  '[data-action]',
  '.doc-btn',
  '.nav-btn-zone',
  'button',
  '.hotspot-zone',
  '#skip-btn',
  '.skip-wrap'
]

export default function CustomCursor() {
  useEffect(() => {
    const cursor = document.getElementById('cursor')
    if (!cursor) return

    const onMove = (e: MouseEvent) => {
      cursor.style.left = `${e.clientX}px`
      cursor.style.top  = `${e.clientY}px`
    }

    const onOver = (e: MouseEvent) => {
      const target = e.target as Element
      const hit = SELECTORS.some(sel => target.closest(sel))
      cursor.classList.toggle('hotspot', hit)
    }

    const onDown = () => cursor.classList.add('active')
    const onUp   = () => cursor.classList.remove('active')

    document.addEventListener('mousemove',  onMove,  { passive: true })
    document.addEventListener('mouseover',  onOver,  { passive: true })
    document.addEventListener('mousedown',  onDown)
    document.addEventListener('mouseup',    onUp)

    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseover', onOver)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('mouseup',   onUp)
    }
  }, [])

  return null
}