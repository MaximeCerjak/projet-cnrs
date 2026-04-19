/**
 * registry.ts — Registre de toutes les scènes de l'application
 *
 * Chaque SceneDefinition déclare :
 *   - id          : slug unique de la scène
 *   - background  : id du div bg-layer dans le DOM
 *   - ui          : composants UI à monter (flèche, navbar, docButtons, circles)
 *   - scroll      : navigation au scroll (optionnel)
 *   - torch       : taille cible de la torche (optionnel, null = torche cachée)
 *
 * Ajouter une scène = ajouter une entrée ici.
 * Le layout, SceneUI et NavigationController lisent ce registre automatiquement.
 */

import type { PageId, ArrowConfig } from '@/app/lib/types'

export interface SceneDefinition {
  id:          PageId
  background:  string
  torch:       number | null   // fraction de min(vW,vH), null = torche masquée
  ui: {
    arrow?:        ArrowConfig
    docButtons?:   boolean
    navBar?:       boolean
    romanCircles?: boolean
  }
  scroll?: {
    up?:   PageId
    down?: PageId
  }
}

export const SCENE_REGISTRY: Record<PageId, SceneDefinition> = {

  vitrine: {
    id:         'vitrine',
    background: 'bg-vitrine',
    torch:       0.65,
    ui: {
      arrow: {
        position:  'bottom-center',
        direction: 'down',
        delay:      5000,
        target:    'phrenologie',
      },
    },
    scroll: { down: 'phrenologie' },
  },

  phrenologie: {
    id:         'phrenologie',
    background: 'bg-phrenologie',
    torch:       0.22,
    ui: {
      arrow: {
        position:  'top-center',
        direction: 'up',
        delay:      5500,
        target:    'vitrine',
      },
      docButtons: true,
      navBar:     true,
    },
    scroll: { up: 'vitrine' },
  },

  collaboration: {
    id:         'collaboration',
    background: 'bg-collaboration',
    torch:       0.45,
    ui: {
      arrow: {
        position:  'bottom-left',
        direction: 'left',
        delay:      4000,
        target:    'phrenologie',
      },
      romanCircles: true,
    },
  },

  'chapitre-2': {
    id:         'chapitre-2',
    background: 'bg-chapitre2',
    torch:       null,            // lumière propre, torche globale masquée
    ui:          {},              // tout géré en interne par Chapitre2Scene
  },

  // ── À venir ────────────────────────────────────────────────────────────────
  // carnet: {
  //   id:         'carnet',
  //   background: 'bg-carnet',
  //   torch:       0.40,
  //   ui: { arrow: { position: 'top-center', direction: 'up', delay: 1000, target: 'phrenologie' } },
  //   scroll: { up: 'phrenologie' },
  // },
  //
  // apropos: {
  //   id:         'apropos',
  //   background: 'bg-apropos',
  //   torch:       0.40,
  //   ui: { arrow: { position: 'top-center', direction: 'up', delay: 1000, target: 'phrenologie' } },
  //   scroll: { up: 'phrenologie' },
  // },

}

export const INITIAL_SCENE: PageId = 'vitrine'