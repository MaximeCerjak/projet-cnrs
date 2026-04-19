'use client'

/**
 * NavigationController
 *
 * Composant sans rendu monté UNE SEULE FOIS dans le layout.
 * Il gère les événements scroll (wheel) et touch swipe globaux.
 *
 * Les flèches et autres composants utilisent useNavigation() uniquement
 * pour accéder à navigateTo() — sans recréer les event listeners.
 */

import { useNavigationController } from './useNavigation'

export default function NavigationController() {
  useNavigationController()
  return null
}