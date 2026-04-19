/**
 * types.ts — Types globaux de l'application
 */

// Identifiant de scène — string slug, extensible sans impact
export type PageId = string

// Hotspot chapitre interactif
export interface Hotspot {
  img:      string   // id de l'élément DOM
  label:    string
  l:        number   // left %
  t:        number   // top %
  w:        number   // width %
  h:        number   // height %
  media?:   string   // URL Cloudflare, injectée depuis Supabase
}

// État du media player
export interface PlayerState {
  isOpen:  boolean
  src:     string | null
  label:   string | null
  isVideo: boolean
}

// Config d'une flèche de navigation
export interface ArrowConfig {
  position:  'bottom-center' | 'top-center' | 'bottom-left' | 'bottom-right'
  direction: 'up' | 'down' | 'left' | 'right'
  delay:     number   // ms avant apparition
  target:    PageId   // scène cible au clic
}