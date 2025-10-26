// app/Projects/dataWorkbench/stores/projectStore.ts
'use client'

import { create } from 'zustand'

export interface ProjectContextState {
  selectedProjectId: string | null
  isLoaded: boolean
  error: string | null
}

export interface ProjectContextActions {
  setSelectedProjectId: (projectId: string | null) => void
  setLoaded: (loaded: boolean) => void
  setError: (message: string | null) => void
}

export type ProjectStore = ProjectContextState & ProjectContextActions

export const useProjectStore = create<ProjectStore>((set) => ({
  selectedProjectId: null,
  isLoaded: false,
  error: null,

  setSelectedProjectId: (projectId) => set({ selectedProjectId: projectId }),
  setLoaded: (loaded) => set({ isLoaded: loaded }),
  setError: (message) => set({ error: message })
}))



