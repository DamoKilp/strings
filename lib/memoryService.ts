// /lib/memoryService.ts
'use client';

import { createClient } from '@/utils/supabase/client';

export interface Memory {
  id: string;
  user_id: string;
  content: string;
  category: string | null;
  importance: number;
  created_at: string;
  updated_at: string;
  last_accessed_at: string | null;
  access_count: number;
}

export interface CreateMemoryInput {
  content: string;
  category?: string;
  importance?: number;
}

export interface UpdateMemoryInput {
  content?: string;
  category?: string;
  importance?: number;
  trackAccess?: boolean;
}

/**
 * Client-side service for managing AI memories
 */
export class MemoryService {
  /**
   * Fetch memories for the current user
   */
  static async getMemories(options?: {
    limit?: number;
    category?: string;
    minImportance?: number;
  }): Promise<Memory[]> {
    try {
      const params = new URLSearchParams();
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.category) params.set('category', options.category);
      if (options?.minImportance) params.set('minImportance', String(options.minImportance));

      const response = await fetch(`/api/memories?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch memories: ${response.statusText}`);
      }

      const data = await response.json();
      return data.memories || [];
    } catch (error) {
      console.error('[MemoryService] Error fetching memories:', error);
      return [];
    }
  }

  /**
   * Create a new memory
   */
  static async createMemory(input: CreateMemoryInput): Promise<Memory | null> {
    try {
      const response = await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error(`Failed to create memory: ${response.statusText}`);
      }

      const data = await response.json();
      return data.memory || null;
    } catch (error) {
      console.error('[MemoryService] Error creating memory:', error);
      return null;
    }
  }

  /**
   * Update a memory
   */
  static async updateMemory(id: string, input: UpdateMemoryInput): Promise<Memory | null> {
    try {
      const response = await fetch(`/api/memories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error(`Failed to update memory: ${response.statusText}`);
      }

      const data = await response.json();
      return data.memory || null;
    } catch (error) {
      console.error('[MemoryService] Error updating memory:', error);
      return null;
    }
  }

  /**
   * Delete a memory
   */
  static async deleteMemory(id: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/memories/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete memory: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error('[MemoryService] Error deleting memory:', error);
      return false;
    }
  }

  /**
   * Track that a memory was accessed (used in conversation)
   */
  static async trackMemoryAccess(id: string): Promise<void> {
    try {
      await this.updateMemory(id, { trackAccess: true });
    } catch (error) {
      console.error('[MemoryService] Error tracking memory access:', error);
    }
  }

  /**
   * Format memories for inclusion in AI prompts
   */
  static formatMemoriesForPrompt(memories: Memory[]): string {
    if (memories.length === 0) {
      return '';
    }

    const sections: string[] = ['**RELEVANT MEMORIES FROM PREVIOUS CONVERSATIONS:**'];
    
    // Group by category if available
    const byCategory = new Map<string, Memory[]>();
    const uncategorized: Memory[] = [];

    memories.forEach(memory => {
      if (memory.category) {
        if (!byCategory.has(memory.category)) {
          byCategory.set(memory.category, []);
        }
        byCategory.get(memory.category)!.push(memory);
      } else {
        uncategorized.push(memory);
      }
    });

    // Add categorized memories
    byCategory.forEach((memories, category) => {
      sections.push(`\n**${category.charAt(0).toUpperCase() + category.slice(1)}:**`);
      memories.forEach(memory => {
        sections.push(`- ${memory.content}`);
      });
    });

    // Add uncategorized memories
    if (uncategorized.length > 0) {
      sections.push('\n**Other:**');
      uncategorized.forEach(memory => {
        sections.push(`- ${memory.content}`);
      });
    }

    return sections.join('\n');
  }
}

