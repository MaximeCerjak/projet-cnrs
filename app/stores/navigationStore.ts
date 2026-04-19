import { create } from 'zustand'
import type { PageId } from '@/app/lib/types'
import { INITIAL_SCENE } from '@/app/lib/scenes/registry'

interface NavigationState {
  currentPage:       PageId
  previousPage:      PageId | null
  isTransitioning:   boolean
  experienceStarted: boolean

  setPage:          (page: PageId, previous?: PageId) => void
  setTransitioning: (v: boolean) => void
  startExperience:  () => void
}

export const useNavigationStore = create<NavigationState>((set) => ({
  currentPage:       INITIAL_SCENE,
  previousPage:      null,
  isTransitioning:   false,
  experienceStarted: false,

  setPage: (page, previous) => set(state => ({
    currentPage:  page,
    previousPage: previous ?? state.currentPage,
  })),

  setTransitioning: (v) => set({ isTransitioning: v }),
  startExperience:  ()  => set({ experienceStarted: true }),
}))