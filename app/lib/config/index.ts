/**
 * config/index.ts — Point d'entrée unique pour toute la config
 *
 * Usage :
 *   import { CONFIG } from '@/app/lib/config'
 *   CONFIG.GLOBAL.ARROW.size_vh
 *   CONFIG.SCENES.vitrine.torch.size
 *   CONFIG.SCENES['chapitre-2'].hotspots
 *
 * Ajouter une scène :
 *   1. Créer src/app/lib/config/scenes/ma-scene.ts
 *   2. L'importer ici et l'ajouter dans SCENES
 *   C'est tout.
 */

import { GLOBAL_CONFIG }        from './global'
import { VITRINE_CONFIG }       from './scenes/vitrine'
import { PHRENOLOGIE_CONFIG }   from './scenes/phrenologie'
import { COLLABORATION_CONFIG } from './scenes/collaboration'
import { CHAPITRE2_CONFIG }     from './scenes/chapitre-2'

export const CONFIG = {
  GLOBAL: GLOBAL_CONFIG,
  SCENES: {
    'vitrine':       VITRINE_CONFIG,
    'phrenologie':   PHRENOLOGIE_CONFIG,
    'collaboration': COLLABORATION_CONFIG,
    'chapitre-2':    CHAPITRE2_CONFIG,
  },
} as const

// Raccourcis pratiques pour ne pas casser les composants existants
// pendant la migration — à supprimer une fois tout migré
export const GLOBAL   = GLOBAL_CONFIG
export const SCENE_CONFIGS = CONFIG.SCENES

export type SceneId = keyof typeof CONFIG.SCENES