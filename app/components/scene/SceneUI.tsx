'use client'

/**
 * SceneUI — Monte les composants UI déclarés dans le registry pour la scène courante.
 *
 * Ajouter un composant UI à une scène = modifier le registry.
 * Ajouter un nouveau type de composant UI = ajouter un cas ici + dans SceneDefinition.
 */

import { useNavigationStore } from '@/app/stores/navigationStore'
import { SCENE_REGISTRY } from '@/app/lib/scenes/registry'
import NavigationArrow from '@/app/components/navigation/NavigationArrow'
import NavBar          from '@/app/components/ui/NavBar'
import DocButtons      from '@/app/components/ui/DocButtons'
import RomanCircles    from '@/app/components/ui/RomanCircles'

export default function SceneUI() {
  const { currentPage } = useNavigationStore()
  const scene = SCENE_REGISTRY[currentPage]
  if (!scene) return null

  const { ui } = scene

  return (
    <>
      {ui.arrow && (
        <NavigationArrow
          showOnPage={currentPage}
          targetPage={ui.arrow.target}
          position={ui.arrow.position}
          direction={ui.arrow.direction}
          appearDelay={ui.arrow.delay}
        />
      )}
      {ui.navBar        && <NavBar />}
      {ui.docButtons    && <DocButtons />}
      {ui.romanCircles  && <RomanCircles />}
    </>
  )
}