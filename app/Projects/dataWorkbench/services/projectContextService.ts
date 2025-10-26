// app/Projects/dataWorkbench/services/projectContextService.ts
'use client'

import { supabase } from '@/utils/supabase/client'
import { useProjectStore } from '../stores/projectStore'

const PREFERENCE_TYPE = 'last_project'

export interface LastProjectPreference {
  project_id: string
}

async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error) return null
    return data.user?.id ?? null
  } catch {
    return null
  }
}

export async function loadLastProject(): Promise<string | null> {
  const userId = await getCurrentUserId()
  const { setSelectedProjectId, setLoaded } = useProjectStore.getState()

  try {
    // Try server-side preference first
    if (userId) {
      const { data, error } = await supabase.rpc('get_user_preference', {
        p_preference_type: PREFERENCE_TYPE,
        p_table_name: 'projects',
        p_user_id: userId
      })

      if (!error && Array.isArray(data) && data.length > 0) {
        const prefs = data[0]?.preferences as LastProjectPreference | null
        const projectId = prefs?.project_id ?? null
        if (projectId) {
          setSelectedProjectId(projectId)
          setLoaded(true)
          // Mirror to localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem('last_project_id', projectId)
          }
          return projectId
        }
      }
    }

    // Fallback to localStorage
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('last_project_id')
      if (cached) {
        setSelectedProjectId(cached)
        setLoaded(true)
        return cached
      }
    }

    setLoaded(true)
    return null
  } catch (err) {
    setLoaded(true)
    return null
  }
}

export async function saveLastProject(projectId: string | null): Promise<boolean> {
  const userId = await getCurrentUserId()
  const { setSelectedProjectId } = useProjectStore.getState()

  try {
    setSelectedProjectId(projectId)
    if (typeof window !== 'undefined') {
      if (projectId) localStorage.setItem('last_project_id', projectId)
      else localStorage.removeItem('last_project_id')
    }

    if (userId && projectId) {
      const { data, error } = await supabase.rpc('save_user_preference', {
        p_preference_type: PREFERENCE_TYPE,
        p_preferences: { project_id: projectId },
        p_table_name: 'projects',
        p_user_id: userId,
        p_version: 1
      })
      return !error && Array.isArray(data)
    }
    return true
  } catch {
    return false
  }
}

export async function listProjects(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase.from('dynamic_projects').select('*').order('created_at', { ascending: false })
  if (error || !data) return []
  return data.map((row: any) => ({
    id: String(row.id),
    name: String(row.display_name ?? row.ProjectName ?? row.projectname ?? 'Untitled Project')
  }))
}


